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
import {
  buildNormalizedAliases,
  detectAliasMentionsInText
} from "../engines/aliasEngine";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

export function useJournalNotes() {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM, isGM } = useCampaign();
  const [rawItems, setRawItems] = useState([]);

  useEffect(() => {
    if (!user || !campaignId) return;

    const notesCol = collection(db, "campaigns", campaignId, "notes");
    const unsubscribeNotes = onSnapshot(
      notesCol,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data()
        }));
        list.sort((a, b) => (b.updatedAtMs || 0) - (a.updatedAtMs || 0));
        setRawItems(list);
      },
      (err) => {
        console.error("Erro ao carregar diários:", err);
      }
    );

    return () => {
      unsubscribeNotes();
    };
  }, [user, campaignId]);

  const rawNotes = useMemo(
    () => rawItems.filter((item) => !item.isFolder),
    [rawItems]
  );

  const rawFolders = useMemo(() => {
    const folders = rawItems.filter((item) => Boolean(item.isFolder));
    folders.sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""));
    return folders;
  }, [rawItems]);

  // Filtra estritamente as notas às quais o usuário atual tem acesso (Anti-Spoiler)
  const accessibleNotes = useMemo(() => {
    if (!user) return [];
    if (isGM) return rawNotes;

    const uid = user.uid;
    return rawNotes.filter((n) => {
      if (n.scope === "party") return true;
      if (n.scope === "player" && n.ownerId === uid) return true;
      const vis = Array.isArray(n.visibleTo) ? n.visibleTo : [];
      return vis.includes("ALL") || vis.includes(uid);
    });
  }, [rawNotes, isGM, user]);

  const buildPermissionsForScope = (scope, targetOwnerId) => {
    const gmUid = campaign?.gmId || user?.uid;
    const owner = targetOwnerId || user?.uid;

    if (scope === "gm") {
      return {
        ownerId: gmUid,
        visibleTo: [gmUid].filter(Boolean),
        editableBy: [gmUid].filter(Boolean)
      };
    }

    if (scope === "party") {
      return {
        ownerId: owner,
        visibleTo: ["ALL"],
        editableBy: ["ALL"]
      };
    }

    // scope === 'player'
    const allowed = Array.from(new Set([gmUid, owner].filter(Boolean)));
    return {
      ownerId: owner,
      visibleTo: allowed,
      editableBy: allowed
    };
  };

  const createNote = async ({
    scope = "party", // 'gm' | 'player' | 'party'
    ownerId = null,
    noteType = "lore", // 'character' | 'lore' | 'location' | 'event' | 'quest'
    folder = "", // Nome da pasta dentro da categoria
    title,
    aliases = [],
    content = "",
    sections = [],
    relatedNoteIds = [],
    ignoredAliases = [],
    linkedCharacterSheetId = null,
    file = null
  }) => {
    if (!user || !campaignId || !title?.trim()) return null;

    let imageMediaId = null;
    if (file) {
      const uploaded = await uploadCompressedMedia({
        file,
        category: "avatar",
        campaignId,
        uploadedBy: user.uid
      });
      imageMediaId = uploaded.mediaId;
    }

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);

    const cleanAliases = Array.isArray(aliases)
      ? aliases.map((a) => a.trim()).filter(Boolean)
      : [];
    const cleanIgnoredAliases = Array.isArray(ignoredAliases)
      ? ignoredAliases.map((a) => a.trim()).filter(Boolean)
      : [];
    const aliasesNormalized = buildNormalizedAliases(title.trim(), cleanAliases);

    const { mentionedNoteIds } = detectAliasMentionsInText(
      content,
      accessibleNotes,
      noteId,
      cleanIgnoredAliases
    );

    const perms = buildPermissionsForScope(scope, ownerId || user.uid);

    const newNote = {
      id: noteId,
      scope,
      ...perms,
      clonedFromNoteId: null,
      noteType,
      folder: (folder || "").trim(),
      linkedCharacterSheetId: linkedCharacterSheetId || null,
      title: title.trim(),
      aliases: cleanAliases,
      aliasesNormalized,
      ignoredAliases: cleanIgnoredAliases,
      imageMediaId,
      content: content || "",
      sections: Array.isArray(sections) ? sections : [],
      relatedNoteIds: Array.isArray(relatedNoteIds) ? relatedNoteIds : [],
      mentionedNoteIds,
      graphNode: {
        x: null,
        y: null,
        pinned: false
      },
      updatedAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(noteRef, newNote);
    setRawItems((prev) =>
      prev.some((n) => n.id === noteId) ? prev : [newNote, ...prev]
    );
    return noteId;
  };

  const updateNote = async (noteId, updates = {}, newFile = null) => {
    if (!user || !campaignId || !noteId) return;
    const existing = rawNotes.find((n) => n.id === noteId);
    if (!existing) return;

    const nextTitle = updates.title !== undefined ? updates.title : existing.title;
    const nextAliases =
      updates.aliases !== undefined ? updates.aliases : existing.aliases || [];
    const nextIgnoredAliases =
      updates.ignoredAliases !== undefined
        ? updates.ignoredAliases
        : existing.ignoredAliases || [];
    const nextContent =
      updates.content !== undefined ? updates.content : existing.content || "";

    const aliasesNormalized = buildNormalizedAliases(nextTitle, nextAliases);
    const { mentionedNoteIds } = detectAliasMentionsInText(
      nextContent,
      accessibleNotes,
      noteId,
      nextIgnoredAliases
    );

    const payload = {
      ...updates,
      aliasesNormalized,
      mentionedNoteIds,
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp()
    };

    if (newFile) {
      const uploaded = await uploadCompressedMedia({
        file: newFile,
        category: "avatar",
        campaignId,
        uploadedBy: user.uid
      });
      if (existing.imageMediaId) {
        await deleteMedia(existing.imageMediaId, campaignId);
      }
      payload.imageMediaId = uploaded.mediaId;
    }

    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
    await updateDoc(noteRef, payload);
  };

  const updateNodePosition = async (noteId, x, y) => {
    if (!user || !campaignId || !noteId) return;
    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
    await updateDoc(noteRef, {
      graphNode: {
        x: Math.round(x),
        y: Math.round(y),
        pinned: true
      }
    });
  };

  // Clona ou disponibiliza um card para outro diário (GM <-> Player <-> Grupo)
  const cloneNoteToTarget = async (
    sourceNote,
    { targetScope = "party", targetOwnerId = null }
  ) => {
    if (!user || !campaignId || !sourceNote) return null;

    const noteId = `note_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
    const perms = buildPermissionsForScope(
      targetScope,
      targetOwnerId || user.uid
    );

    const clonedNote = {
      ...sourceNote,
      id: noteId,
      scope: targetScope,
      ...perms,
      clonedFromNoteId: sourceNote.id,
      graphNode: {
        x: null,
        y: null,
        pinned: false
      },
      updatedAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(noteRef, clonedNote);
    setRawItems((prev) =>
      prev.some((n) => n.id === noteId) ? prev : [clonedNote, ...prev]
    );
    return noteId;
  };

  // Disponibiliza o acesso de visualização do card para o Grupo ou para um jogador específico
  const shareNoteWithTarget = async (noteId, target) => {
    if (!user || !campaignId || !noteId || !target) return;
    const note = rawNotes.find((n) => n.id === noteId);
    if (!note) return;

    const currentVis = Array.isArray(note.visibleTo) ? [...note.visibleTo] : [];
    const updates = {
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp()
    };

    if (target === "party" || target === "ALL") {
      if (!currentVis.includes("ALL")) {
        currentVis.push("ALL");
      }
      updates.visibleTo = currentVis;
    } else {
      if (!currentVis.includes(target)) {
        currentVis.push(target);
      }
      updates.visibleTo = currentVis;
    }

    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
    await updateDoc(noteRef, updates);
  };

  // Revoga o acesso de visualização de um card (permitido para o Mestre ou dono)
  const revokeNoteAccess = async (noteId, target) => {
    if (!user || !campaignId || !noteId || !target) return;
    const note = rawNotes.find((n) => n.id === noteId);
    if (!note) return;

    if (!isRealGM && note.ownerId !== user.uid) return;

    let currentVis = Array.isArray(note.visibleTo) ? [...note.visibleTo] : [];
    const updates = {
      updatedAtMs: Date.now(),
      updatedAt: serverTimestamp()
    };

    if (target === "party" || target === "ALL") {
      currentVis = currentVis.filter((v) => v !== "ALL");
      updates.visibleTo = currentVis;
      if (note.scope === "party") {
        updates.scope = "player";
      }
    } else {
      currentVis = currentVis.filter((v) => v !== target);
      updates.visibleTo = currentVis;
    }

    const noteRef = doc(db, "campaigns", campaignId, "notes", noteId);
    await updateDoc(noteRef, updates);
  };

  const deleteNote = async (noteId) => {
    if (!user || !campaignId || !noteId) return;
    const existing = rawNotes.find((n) => n.id === noteId);
    if (!existing) return;
    if (!isRealGM && existing.ownerId !== user.uid) return;

    await deleteDoc(doc(db, "campaigns", campaignId, "notes", noteId));
  };

  // Filtra as pastas acessíveis
  const accessibleFolders = useMemo(() => {
    if (!user) return [];
    if (isGM) return rawFolders;
    const uid = user.uid;
    return rawFolders.filter((f) => {
      if (f.scope === "party") return true;
      if (f.scope === "player" && f.ownerId === uid) return true;
      return false;
    });
  }, [rawFolders, isGM, user]);

  const createFolder = async ({ name, noteType, scope = "party", ownerId = null }) => {
    if (!user || !campaignId || !name?.trim() || !noteType) return null;
    const folderId = `folder_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    // Salva na coleção 'notes' com a flag isFolder: true para usar as mesmas regras de permissão já ativas no Firestore
    const folderRef = doc(db, "campaigns", campaignId, "notes", folderId);
    const perms = buildPermissionsForScope(scope, ownerId || user.uid);
    const newFolder = {
      id: folderId,
      isFolder: true,
      name: name.trim(),
      title: name.trim(),
      noteType,
      scope,
      ...perms,
      updatedAtMs: Date.now(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(folderRef, newFolder);
    setRawItems((prev) =>
      prev.some((item) => item.id === folderId) ? prev : [newFolder, ...prev]
    );
    return folderId;
  };

  const deleteFolder = async (folderId, folderPath, noteType) => {
    if (!user || !campaignId) return;

    const cleanTargetPath = (folderPath || "")
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      .join("/");

    // Remove a pasta principal e quaisquer subpastas filhas explícitas
    const foldersToDelete = rawFolders.filter((f) => {
      if (folderId && f.id === folderId) return true;
      if (f.noteType !== noteType || !cleanTargetPath) return false;
      const fPath = (f.name || "")
        .split("/")
        .map((s) => s.trim())
        .filter(Boolean)
        .join("/");
      return fPath === cleanTargetPath || fPath.startsWith(`${cleanTargetPath}/`);
    });

    for (const f of foldersToDelete) {
      await deleteDoc(doc(db, "campaigns", campaignId, "notes", f.id));
    }

    // Se houver notas nessa pasta ou subpastas dela, move para a pasta pai (ou raiz)
    if (cleanTargetPath && noteType) {
      const parentPath = cleanTargetPath.includes("/")
        ? cleanTargetPath.substring(0, cleanTargetPath.lastIndexOf("/"))
        : "";

      const notesInFolder = rawNotes.filter((n) => {
        if (n.noteType !== noteType) return false;
        const nPath = (n.folder || "")
          .split("/")
          .map((s) => s.trim())
          .filter(Boolean)
          .join("/");
        return nPath === cleanTargetPath || nPath.startsWith(`${cleanTargetPath}/`);
      });

      for (const n of notesInFolder) {
        await updateDoc(doc(db, "campaigns", campaignId, "notes", n.id), {
          folder: parentPath,
          updatedAtMs: Date.now(),
          updatedAt: serverTimestamp()
        });
      }
    }
  };

  return {
    accessibleNotes,
    accessibleFolders,
    createNote,
    updateNote,
    updateNodePosition,
    cloneNoteToTarget,
    shareNoteWithTarget,
    revokeNoteAccess,
    deleteNote,
    createFolder,
    deleteFolder
  };
}

