import { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../services/firebase";
import { uploadCompressedMedia, deleteMedia } from "../services/mediaService";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

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
  const { campaignId, campaign, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);

  useEffect(() => {
    if (!user || !campaignId) return;

    const charCol = collection(db, "campaigns", campaignId, "characters");
    const unsubscribe = onSnapshot(
      charCol,
      (snapshot) => {
        const list = snapshot.docs.map((d) => {
          const data = d.data();
          if (Array.isArray(data.inventory)) {
            data.inventory = data.inventory.map((it) => {
              const nameLower = (it.name || "").toLowerCase();
              const idLower = (it.id || "").toLowerCase();
              const iconLower = (it.icon || "").toLowerCase();
              if (
                nameLower.includes("peixe") ||
                nameLower.includes("fish") ||
                nameLower.includes("fluffy") ||
                idLower.includes("peixe")
              ) {
                if (!iconLower || iconLower === "meat" || iconLower === "carne" || iconLower === "fish") {
                  return { ...it, icon: "fluffy_fish" };
                }
              }
              return it;
            });
          }
          return {
            id: d.id,
            ...data
          };
        });
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setRawItems(list);
      },
      (err) => {
        console.error("Erro ao carregar fichas e pastas:", err);
      }
    );

    return () => unsubscribe();
  }, [user, campaignId]);

  const rawCharacters = useMemo(
    () => rawItems.filter((i) => !i.isFolder),
    [rawItems]
  );

  const rawFolders = useMemo(
    () => rawItems.filter((i) => Boolean(i.isFolder)),
    [rawItems]
  );

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
    const effectiveOwnerId = ownerId || user.uid;
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
      name: name?.trim() || "Novo Pinguim",
      type,
      ownerId: effectiveOwnerId,
      folderId: folderId || null,
      cardColor: cardColor || "#02529c",
      visibleTo,
      editableBy,
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
    const effectiveOwnerId = ownerId || (isGM ? gmUid : user.uid);
    const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const folderRef = doc(db, "campaigns", campaignId, "characters", folderId);

    const visibleTo = Array.from(
      new Set([gmUid, effectiveOwnerId, "ALL"].filter(Boolean))
    );
    const editableBy = Array.from(new Set([gmUid, effectiveOwnerId].filter(Boolean)));

    const newFolder = {
      id: folderId,
      isFolder: true,
      name: name.trim(),
      parentId: parentId || null,
      ownerId: effectiveOwnerId,
      visibleTo,
      editableBy,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(folderRef, newFolder);
    setRawItems((prev) =>
      prev.some((item) => item.id === folderId) ? prev : [...prev, newFolder]
    );
    return folderId;
  };

  const updateFolder = async (folderId, updates) => {
    if (!user || !campaignId || !folderId) return;
    const folderRef = doc(db, "campaigns", campaignId, "characters", folderId);
    await updateDoc(folderRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const deleteFolder = async (folderId) => {
    if (!user || !campaignId || !folderId) return;
    const folderTarget = rawFolders.find((f) => f.id === folderId);
    if (!folderTarget) return;
    if (!isGM && folderTarget.ownerId !== user.uid) return;

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

    // Mover personagens contidos para o pai da pasta deletada ou raiz
    const parentDestination = folderTarget.parentId || null;
    const affectedChars = rawCharacters.filter((c) =>
      allFolderIds.includes(c.folderId)
    );
    for (const c of affectedChars) {
      const cRef = doc(db, "campaigns", campaignId, "characters", c.id);
      await updateDoc(cRef, {
        folderId: parentDestination,
        updatedAt: serverTimestamp()
      });
    }

    // Deleta os documentos de pastas
    for (const fid of allFolderIds) {
      await deleteDoc(doc(db, "campaigns", campaignId, "characters", fid));
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
    await updateCharacter(charId, updates);
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

  const updateCharacter = async (charId, updates) => {
    if (!user || !campaignId || !charId) return;
    const charRef = doc(db, "campaigns", campaignId, "characters", charId);
    await updateDoc(charRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  };

  const updateCharacterResource = async (charId, resourceKey, nextCurrent) => {
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target) return;
    const existingRes = target.resources?.[resourceKey] || {
      label: resourceKey.toUpperCase(),
      current: 0,
      max: 10
    };
    await updateCharacter(charId, {
      [`resources.${resourceKey}`]: {
        ...existingRes,
        current: Math.max(0, Number(nextCurrent) || 0)
      }
    });
  };

  const uploadCharacterImage = async (
    charId,
    file,
    targetField = "avatar" // 'avatar' | 'token'
  ) => {
    if (!user || !campaignId || !charId || !file) return;
    const target = rawCharacters.find((c) => c.id === charId);
    if (!target) return;

    const category = targetField === "token" ? "token" : "avatar";
    const uploaded = await uploadCompressedMedia({
      file,
      category,
      campaignId,
      uploadedBy: user.uid
    });

    if (targetField === "token") {
      const oldMediaId = target.defaultToken?.mediaId;
      if (oldMediaId) {
        await deleteMedia(oldMediaId, campaignId);
      }
      await updateCharacter(charId, {
        defaultToken: {
          ...(target.defaultToken || {}),
          mediaId: uploaded.mediaId,
          externalUrl: null
        }
      });
    } else {
      const oldMediaId = target.avatarMediaId;
      if (oldMediaId) {
        await deleteMedia(oldMediaId, campaignId);
      }
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
    if (!isGM && target.ownerId !== user.uid) return;

    if (target.avatarMediaId) {
      await deleteMedia(target.avatarMediaId, campaignId);
    }
    if (target.defaultToken?.mediaId) {
      await deleteMedia(target.defaultToken.mediaId, campaignId);
    }
    await deleteDoc(doc(db, "campaigns", campaignId, "characters", charId));
  };

  return {
    characters,
    allCharacters: rawCharacters,
    folders,
    canEditCharacter,
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
