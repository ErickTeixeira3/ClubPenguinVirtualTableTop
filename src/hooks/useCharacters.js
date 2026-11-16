import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "firebase/firestore";
import {
  ref,
  get as rtdbGet,
  update as rtdbUpdate
} from "firebase/database";
import { applyOwnerAndGmAudience, subscribeVisibleCollection } from "../services/visibilityService";
import { db, rtdb } from "../services/firebase";
import { uploadCompressedMedia } from "../services/mediaService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";
import { useFolders } from "./useFolders";

export const DEFAULT_ATTRIBUTES = [
  { key: "forca", label: "Força", value: 2 },
  { key: "agilidade", label: "Agilidade", value: 2 },
  { key: "intelecto", label: "Intelecto", value: 2 },
  { key: "vigor", label: "Vigor", value: 2 },
  { key: "espirito", label: "Espírito", value: 2 }
];

export const DEFAULT_SKILLS = [
  { id: "sk_luta", name: "Luta", attribute: "forca", bonus: 2, formula: "1d20 + @forca + @luta" },
  { id: "sk_pontaria", name: "Pontaria", attribute: "agilidade", bonus: 2, formula: "1d20 + @agilidade + @pontaria" },
  { id: "sk_furtividade", name: "Furtividade", attribute: "agilidade", bonus: 1, formula: "1d20 + @agilidade + @furtividade" },
  { id: "sk_percepcao", name: "Percepção", attribute: "intelecto", bonus: 2, formula: "1d20 + @intelecto + @percepcao" },
  { id: "sk_resistencia", name: "Resistência", attribute: "vigor", bonus: 2, formula: "1d20 + @vigor + @resistencia" }
];

export function useCharacters() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);
  // Fase 5: pastas dedicadas via useFolders (listener unificado da subcoleção folders)
  const { folders: dedicatedFolders, setFolders: setDedicatedFolders } = useFolders("character");

  // Fase 3.1 (V-13): listeners dependem só de uid/campaignId/prontidão da campanha/papel,
  // não do objeto `campaign` (recriado a cada snapshot da campanha ou resolução de avatar).
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    if (!listenerUid || !campaignId || !campaignReady) return;

    const charCol = collection(db, "campaigns", campaignId, "characters");
    // Fase 6.2 (A5/A7/A8/A9: o dono sempre recebe as próprias fichas).
    const unsubscribeChars = subscribeVisibleCollection({
      colRef: charCol,
      isRealGM,
      uid: listenerUid,
      includeOwned: true,
      onNext: (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((item) => !item.isDeleted && !item.migratedToFoldersCollection);
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawItems(list);
      },
      onError: (err) => {
        console.error("Erro ao carregar fichas:", err);
      }
    });

    return () => unsubscribeChars();
  }, [listenerUid, campaignId, campaignReady, isRealGM]);

  const rawCharacters = useMemo(
    () => rawItems.filter((i) => !i.isFolder && !i.isDeleted),
    [rawItems]
  );

  const rawFolders = useMemo(() => {
    const map = new Map();
    rawItems
      .filter((i) => Boolean(i.isFolder) && !i.isDeleted && !i.migratedToFoldersCollection)
      .forEach((f) => map.set(f.id, f));
    dedicatedFolders
      .filter((f) => !f.isDeleted)
      .forEach((f) => map.set(f.id, f));
    const list = Array.from(map.values());
    list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    return list;
  }, [rawItems, dedicatedFolders]);

  const characters = useMemo(() => {
    if (isGM) return rawCharacters;
    const currentUid = user?.uid;
    return rawCharacters.filter((c) => {
      const vis = Array.isArray(c.visibleTo) ? c.visibleTo : [];
      return (
        c.ownerId === currentUid ||
        vis.includes("ALL") ||
        (currentUid && vis.includes(currentUid))
      );
    });
  }, [rawCharacters, isGM, user?.uid]);

  const folders = useMemo(() => {
    if (isGM) return rawFolders;
    const currentUid = user?.uid;
    const gmUid = campaign?.gmId;
    return rawFolders.filter((f) => {
      const vis = Array.isArray(f.visibleTo) ? f.visibleTo : [];
      return (
        f.ownerId === currentUid ||
        vis.includes("ALL") ||
        (currentUid && vis.includes(currentUid)) ||
        f.ownerId === gmUid
      );
    });
  }, [rawFolders, isGM, user?.uid, campaign?.gmId]);

  const canEditCharacter = (character) => {
    if (!user || !character) return false;
    if (isGM) return true;
    if (character.ownerId === user.uid) return true;
    const editList = Array.isArray(character.editableBy)
      ? character.editableBy
      : [];
    return editList.includes("ALL") || editList.includes(user.uid);
  };

  const canEditFolder = (folder) => {
    if (!user || !folder) return false;
    if (isGM) return true;
    if (folder.ownerId === user.uid) return true;
    const editList = Array.isArray(folder.editableBy)
      ? folder.editableBy
      : [];
    return editList.includes("ALL") || editList.includes(user.uid);
  };

  // Fase 3.1 (D-3): excluir (Soft Delete) é exclusivo do dono ou do Mestre; `editableBy` só edita.
  const canDeleteCharacter = (character) =>
    Boolean(user && character && (isGM || character.ownerId === user.uid));

  const canDeleteFolder = (folder) =>
    Boolean(user && folder && (isGM || folder.ownerId === user.uid));

  const syncCharacterToActiveSceneTokens = async (targetChar, updates = {}) => {
    const activeSceneId = campaign?.activeSceneId;
    if (!user || !campaignId || !activeSceneId || !targetChar) return;

    const merged = { ...targetChar, ...updates };
    const isGmTemplate = Boolean(
      merged.type === "npc" ||
        (campaign?.gmId && merged.ownerId === campaign.gmId)
    );
    if (isGmTemplate) return;

    const tokenUpdates = {};

    if ("name" in updates) {
      tokenUpdates.name = updates.name?.trim() || "Token";
    }
    if ("defense" in updates) {
      tokenUpdates.defense = Number(updates.defense ?? 10);
    }
    if ("cardColor" in updates) {
      tokenUpdates.ringColor = updates.cardColor || "#3090f0";
    }

    for (const [resKey, curField, maxField] of [
      ["hp", "hpCurrent", "hpMax"],
      ["mp", "mpCurrent", "mpMax"]
    ]) {
      const resObjUpdate =
        updates[`resources.${resKey}`] || updates.resources?.[resKey];
      const dotCurrent = updates[`resources.${resKey}.current`];
      const dotMax = updates[`resources.${resKey}.max`];

      if (dotCurrent !== undefined) {
        tokenUpdates[curField] = Number(dotCurrent ?? 0);
      } else if (
        resObjUpdate &&
        typeof resObjUpdate === "object" &&
        "current" in resObjUpdate
      ) {
        tokenUpdates[curField] = Number(resObjUpdate.current ?? 0);
      }

      if (dotMax !== undefined) {
        tokenUpdates[maxField] = Number(dotMax ?? 0);
      } else if (
        resObjUpdate &&
        typeof resObjUpdate === "object" &&
        "max" in resObjUpdate
      ) {
        tokenUpdates[maxField] = Number(resObjUpdate.max ?? 0);
      }
    }

    const touchedVisualToken =
      "defaultToken" in updates ||
      "avatarMediaId" in updates ||
      "avatarExternalUrl" in updates ||
      "defaultToken.showName" in updates ||
      "defaultToken.sizeInCells" in updates ||
      "defaultToken.mediaId" in updates ||
      "defaultToken.externalUrl" in updates;

    if (touchedVisualToken) {
      const mergedDefaultToken = {
        ...(targetChar.defaultToken || {}),
        ...(updates.defaultToken && typeof updates.defaultToken === "object"
          ? updates.defaultToken
          : {})
      };
      if ("defaultToken.showName" in updates) {
        mergedDefaultToken.showName = updates["defaultToken.showName"];
      }
      if ("defaultToken.sizeInCells" in updates) {
        mergedDefaultToken.sizeInCells = updates["defaultToken.sizeInCells"];
      }
      if ("defaultToken.mediaId" in updates) {
        mergedDefaultToken.mediaId = updates["defaultToken.mediaId"];
      }
      if ("defaultToken.externalUrl" in updates) {
        mergedDefaultToken.externalUrl = updates["defaultToken.externalUrl"];
      }

      if (
        "defaultToken" in updates ||
        "avatarMediaId" in updates ||
        "avatarExternalUrl" in updates ||
        "defaultToken.mediaId" in updates ||
        "defaultToken.externalUrl" in updates
      ) {
        const hasExplicitTokenMedia =
          Boolean(mergedDefaultToken.mediaId) ||
          Boolean(mergedDefaultToken.externalUrl);
        if (hasExplicitTokenMedia) {
          tokenUpdates.mediaId = mergedDefaultToken.mediaId || null;
          tokenUpdates.externalUrl = mergedDefaultToken.mediaId
            ? null
            : mergedDefaultToken.externalUrl || null;
        } else {
          tokenUpdates.mediaId = merged.avatarMediaId || null;
          tokenUpdates.externalUrl = merged.avatarMediaId
            ? null
            : merged.avatarExternalUrl || null;
        }
      }

      if ("showName" in mergedDefaultToken) {
        tokenUpdates.showName = mergedDefaultToken.showName !== false;
      }
      if ("sizeInCells" in mergedDefaultToken && mergedDefaultToken.sizeInCells) {
        tokenUpdates.sizeInCells = Math.max(
          1,
          Math.min(8, Number(mergedDefaultToken.sizeInCells) || 1)
        );
      }
    }

    if (Object.keys(tokenUpdates).length === 0) return;

    tokenUpdates.updatedBy = user.uid;
    tokenUpdates.updatedAt = Date.now();

    try {
      const sceneTokensRef = ref(
        rtdb,
        `vtt_realtime/${campaignId}/tokens/${activeSceneId}`
      );
      const snap = await rtdbGet(sceneTokensRef);
      if (!snap.exists()) return;

      const tokensMap = snap.val() || {};
      const matchingIds = Object.entries(tokensMap)
        .filter(([, tok]) => tok && tok.characterId === targetChar.id && !tok.isGmToken)
        .map(([tokId]) => tokId);

      if (matchingIds.length === 0) return;

      await Promise.all(
        matchingIds.map((tokId) =>
          rtdbUpdate(
            ref(
              rtdb,
              `vtt_realtime/${campaignId}/tokens/${activeSceneId}/${tokId}`
            ),
            tokenUpdates
          )
        )
      );
    } catch (err) {
      console.warn("Erro ao sincronizar ficha do PC com tokens RTDB:", err);
    }
  };

  // Fase 6.2 (A7/A8): gravações do Mestre que mexem em dono ou permissões mantêm Mestre e dono
  const withOwnerAndGmAudience = (updates, target) =>
    applyOwnerAndGmAudience(updates, target, campaign?.gmId || user?.uid);

  const createCharacter = async ({
    name,
    type = "pc", // 'pc' | 'npc'
    cardColor = "#02529c",
    visibleToAll = false,
    folderId = null,
    ownerId = null
  }) => {
    if (!user || !campaignId) return null;

    const gmUid = campaign?.gmId || user.uid;
    const effectiveOwnerId = isGM && ownerId ? ownerId : user.uid;
    const effectiveType = isGM ? type : "pc";
    const charId = `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const charRef = doc(db, "campaigns", campaignId, "characters", charId);

    const visibleTo = Array.from(
      new Set(
        [gmUid, effectiveOwnerId, ...(visibleToAll ? ["ALL"] : [])].filter(Boolean)
      )
    );
    const editableBy = Array.from(new Set([gmUid, effectiveOwnerId].filter(Boolean)));

    const newCharacter = {
      id: charId,
      campaignId,
      name: name?.trim() || "Novo Pinguim",
      type: effectiveType,
      ownerId: effectiveOwnerId,
      folderId: folderId || null,
      cardColor: cardColor || "#02529c",
      visibleTo,
      editableBy,
      isDeleted: false,
      level: 1,
      defense: 12,
      avatarMediaId: null,
      avatarExternalUrl: null,
      defaultToken: {
        mediaId: null,
        externalUrl: null,
        sizeInCells: 1,
        ringColor: cardColor || "#3090f0"
      },
      resources: {
        hp: { label: "Vida", current: 25, max: 25 },
        mp: { label: "Energia", current: 15, max: 15 }
      },
      attributes: DEFAULT_ATTRIBUTES,
      skills: DEFAULT_SKILLS,
      abilities: [
        {
          id: "ab_bola_neve",
          name: "Arremesso de Bola de Neve",
          elementColor: "#00bcd4",
          cost: { resource: "mp", amount: 0 },
          hitFormula: "1d20 + @agilidade + @pontaria",
          effectFormula: "1d6 + @agilidade",
          trigger: "active",
          effectType: "damage",
          savingThrow: { enabled: false, dcFormula: "12", attribute: "resistencia", effectDescription: "" },
          description: "Ataque rápido à distância."
        }
      ],
      inventory: [
        {
          id: "inv_peixe",
          name: "Peixe Fresco",
          icon: "fluffy_fish",
          qty: 2,
          elementColor: "#38c172",
          rollFormula: "1d8 + 2",
          trigger: "active",
          effectType: "heal",
          consumeOnUse: true,
          description: "Recupera vida ao consumir."
        }
      ],
      rollGroups: [
        {
          id: "grp_combate",
          name: "Ações de Combate",
          rolls: [
            {
              id: "r_custom_1",
              name: "Ataque Básico",
              color: "#e53935",
              hitFormula: "1d20 + @forca + @luta",
              effectFormula: "1d8 + @forca",
              effectType: "damage",
              rollKind: "attack",
              sourceType: "custom",
              sourceId: null,
              costResource: "mp",
              costAmount: 0
            }
          ]
        },
        {
          id: "grp_testes",
          name: "Testes Rápidos",
          rolls: [
            {
              id: "r_custom_2",
              name: "Iniciativa",
              color: "#fdd835",
              hitFormula: "1d20 + @agilidade",
              effectFormula: "",
              rollKind: "check",
              sourceType: "custom",
              sourceId: null,
              costResource: "mp",
              costAmount: 0
            }
          ]
        }
      ],
      biography: "",
      notes: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(charRef, newCharacter);
      setRawItems((prev) => {
        if (prev.some((c) => c.id === charId)) return prev;
        return [...prev, newCharacter];
      });
      return charId;
    } catch (err) {
      console.error("Erro ao salvar personagem no Firestore:", err);
      throw err;
    }
  };

  const createFolder = async ({ name, parentId = null, ownerId = null }) => {
    if (!user || !campaignId || !name?.trim()) return null;
    const gmUid = campaign?.gmId || user.uid;
    const effectiveOwnerId = isGM ? ownerId || gmUid : user.uid;
    const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const folderRef = doc(db, "campaigns", campaignId, "folders", folderId);

    const visibleTo = Array.from(
      new Set([gmUid, effectiveOwnerId, "ALL"].filter(Boolean))
    );
    const editableBy = Array.from(new Set([gmUid, effectiveOwnerId].filter(Boolean)));

    const newFolder = {
      id: folderId,
      campaignId,
      folderType: "character",
      isFolder: true,
      // Fase 6.1 (A4): a regra publicada de folders exige scope "player"|"party" para quem não é Mestre
      scope: "player",
      name: name.trim(),
      parentId: parentId || null,
      ownerId: effectiveOwnerId,
      visibleTo,
      editableBy,
      isDeleted: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(folderRef, newFolder);
    setDedicatedFolders((prev) =>
      prev.some((item) => item.id === folderId) ? prev : [...prev, newFolder]
    );
    return folderId;
  };

  const updateFolder = async (folderId, updates) => {
    if (!user || !campaignId || !folderId) return;
    const folderTarget = rawFolders.find((f) => f.id === folderId);
    if (!folderTarget || !canEditFolder(folderTarget)) return;

    const sanitizedUpdates = isGM ? withOwnerAndGmAudience(updates, folderTarget) : { ...updates };
    if (!isGM) {
      delete sanitizedUpdates.ownerId;
      delete sanitizedUpdates.visibleTo;
      delete sanitizedUpdates.editableBy;
      delete sanitizedUpdates.isDeleted;
      delete sanitizedUpdates.isFolder;
      delete sanitizedUpdates.folderType;
      delete sanitizedUpdates.campaignId;
    }

    const isLegacy = rawItems.some((i) => i.id === folderId && i.isFolder);
    const folderRef = doc(
      db,
      "campaigns",
      campaignId,
      isLegacy ? "characters" : "folders",
      folderId
    );
    await updateDoc(folderRef, {
      ...sanitizedUpdates,
      campaignId,
      updatedAt: serverTimestamp()
    });
  };

  const deleteFolder = async (folderId, options = { deleteContents: false }) => {
    if (!user || !campaignId || !folderId) return;
    const folderTarget = rawFolders.find((f) => f.id === folderId);
    if (!folderTarget) return;
    if (!canDeleteFolder(folderTarget)) return;

    const deleteContents = Boolean(options?.deleteContents);

    // Localiza todas as subpastas recursivamente
    const collectFolderIds = (fid) => {
      let ids = [fid];
      const children = rawFolders.filter((f) => f.parentId === fid);
      for (const child of children) {
        ids = ids.concat(collectFolderIds(child.id));
      }
      return ids;
    };
    const allFolderIds = collectFolderIds(folderId);

    const parentDestination = folderTarget.parentId || null;
    const affectedChars = rawCharacters.filter(
      (c) => allFolderIds.includes(c.folderId) && canEditCharacter(c)
    );

    for (const c of affectedChars) {
      const cRef = doc(db, "campaigns", campaignId, "characters", c.id);
      if (deleteContents) {
        // Fase 3.1 (D-3): fichas de outros donos (acesso via editableBy) não são ocultadas;
        // permanecem e são movidas para a pasta pai, como na opção "mover".
        if (!canDeleteCharacter(c)) {
          await updateDoc(cRef, {
            folderId: parentDestination,
            updatedAt: serverTimestamp()
          });
          continue;
        }
        await updateDoc(cRef, {
          campaignId,
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid
        });
      } else {
        await updateDoc(cRef, {
          folderId: parentDestination,
          updatedAt: serverTimestamp()
        });
      }
    }

    // Soft Delete nos documentos de pastas (tanto na coleção dedicada quanto legada)
    for (const fid of allFolderIds) {
      const folderDoc = rawFolders.find((f) => f.id === fid);
      if (folderDoc && !canDeleteFolder(folderDoc)) continue;

      const inDedicated = dedicatedFolders.some((f) => f.id === fid);
      const inLegacy = rawItems.some((i) => i.id === fid && i.isFolder);
      if (inDedicated) {
        await updateDoc(doc(db, "campaigns", campaignId, "folders", fid), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid
        }).catch(() => {});
      }
      if (inLegacy) {
        await updateDoc(doc(db, "campaigns", campaignId, "characters", fid), {
          isDeleted: true,
          deletedAt: serverTimestamp(),
          deletedBy: user.uid
        }).catch(() => {});
      }
    }
  };

  const moveCharacterToFolder = async (charId, targetFolderId, targetOwnerId = null) => {
    if (!user || !campaignId || !charId) return;
    const char = rawCharacters.find((c) => c.id === charId);
    if (!char) return;
    if (!isGM && char.ownerId !== user.uid) return;

    const updates = {
      folderId: targetFolderId || null
    };
    if (targetOwnerId && isGM) {
      updates.ownerId = targetOwnerId;
    }
    await updateCharacter(charId, updates, { skipTokenSync: true });
  };

  const moveFolder = async (folderId, targetParentId, targetOwnerId = null) => {
    if (!user || !campaignId || !folderId) return;
    const folder = rawFolders.find((f) => f.id === folderId);
    if (!folder) return;
    if (!isGM && folder.ownerId !== user.uid) return;
    if (folderId === targetParentId) return;

    const updates = {
      parentId: targetParentId || null
    };
    if (targetOwnerId && isGM) {
      updates.ownerId = targetOwnerId;
    }
    await updateFolder(folderId, updates);
  };

  const updateCharacter = async (charId, updates, options = {}) => {
    if (!user || !campaignId || !charId) return;
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target || !canEditCharacter(target)) return;

    const sanitizedUpdates = isGM ? withOwnerAndGmAudience(updates, target) : { ...updates };
    if (!isGM) {
      delete sanitizedUpdates.ownerId;
      delete sanitizedUpdates.visibleTo;
      delete sanitizedUpdates.editableBy;
      delete sanitizedUpdates.isDeleted;
      delete sanitizedUpdates.campaignId;
      delete sanitizedUpdates.type;
    }

    const charRef = doc(db, "campaigns", campaignId, "characters", charId);
    await updateDoc(charRef, {
      ...sanitizedUpdates,
      updatedAt: serverTimestamp()
    });

    if (!options?.skipTokenSync) {
      await syncCharacterToActiveSceneTokens(target, sanitizedUpdates);
    }
  };

  const updateCharacterResource = async (
    charId,
    resourceKey,
    nextCurrent,
    options = {}
  ) => {
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target || !canEditCharacter(target)) return;
    const cleanCurrent = Math.max(0, Number(nextCurrent) || 0);
    if (!target.resources?.[resourceKey]) {
      await updateCharacter(
        charId,
        {
          [`resources.${resourceKey}`]: {
            label:
              resourceKey === "mp"
                ? "Energia"
                : resourceKey === "hp"
                  ? "Vida"
                  : resourceKey.toUpperCase(),
            current: cleanCurrent,
            max: 10
          }
        },
        options
      );
      return;
    }
    await updateCharacter(
      charId,
      { [`resources.${resourceKey}.current`]: cleanCurrent },
      options
    );
  };

  const uploadCharacterImage = async (
    charId,
    file,
    targetField = "avatar" // 'avatar' | 'token'
  ) => {
    if (!user || !campaignId || !charId || !file) return;
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target || !canEditCharacter(target)) return;

    const category = targetField === "token" ? "token" : "avatar";
    const uploaded = await uploadCompressedMedia({
      file,
      category,
      campaignId,
      uploadedBy: user.uid
    });

    if (targetField === "token") {
      await updateCharacter(charId, {
        defaultToken: {
          ...(target.defaultToken || {}),
          mediaId: uploaded.mediaId,
          externalUrl: null
        }
      });
    } else {
      await updateCharacter(charId, {
        avatarMediaId: uploaded.mediaId,
        avatarExternalUrl: null
      });
    }
  };

  const deleteCharacter = async (charId) => {
    if (!user || !campaignId || !charId) return;
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target) return;
    if (!canDeleteCharacter(target)) return;

    await updateDoc(doc(db, "campaigns", campaignId, "characters", charId), {
      campaignId,
      isDeleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: user.uid
    });
  };

  return {
    characters,
    allCharacters: rawCharacters,
    folders,
    canEditCharacter,
    canEditFolder,
    canDeleteCharacter,
    canDeleteFolder,
    createCharacter,
    updateCharacter,
    updateCharacterResource,
    uploadCharacterImage,
    deleteCharacter,
    createFolder,
    updateFolder,
    deleteFolder,
    moveCharacterToFolder,
    moveFolder
  };
}
