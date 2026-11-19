import { useMemo, useState } from "react";
import { FOLDER_DOMAINS } from "../../domain/constants.js";
import { AppError, ERROR_CODES } from "../../domain/errors.js";
import {
  collectDescendantFolderIds,
  validateFolderMove
} from "../../engines/folders/index.js";
import { useNotifications } from "../../hooks/useNotifications";
import ConfirmDeleteModal from "../ui/ConfirmDeleteModal";
import ConfirmDialog from "../ui/ConfirmDialog";
import CharacterTreeView from "./CharacterTreeView";
import CreateEntryModal from "./CreateEntryModal";
import MoveCharacterModal from "./MoveCharacterModal";
import SpawnTokenModal from "./SpawnTokenModal";
import { useCharacterTree } from "./useCharacterTree";

function resolveOwnerName(ownerId, gmId, playersMap = {}, currentUserId = null) {
  if (!ownerId) return "Sem Dono";
  if (gmId && ownerId === gmId) return "Mestre";
  if (currentUserId && ownerId === currentUserId) return "Você";
  const player = playersMap?.[ownerId];
  return (
    player?.displayName ||
    player?.name ||
    player?.email?.split("@")[0] ||
    ownerId
  );
}

export default function CharactersSidebarList({
  characters = [],
  folders = [],
  campaignId,
  isGM,
  canEditCharacter = null,
  canDeleteCharacter = null,
  canEditFolder = null,
  canDeleteFolder = null,
  currentUser,
  playersMap = {},
  gmId,
  onlineUsers = {},
  onCreateCharacter,
  onOpenSheet,
  onSpawnToken,
  onDeleteCharacter,
  onCreateFolder,
  onRenameFolder = null,
  onUpdateFolder = null,
  onDeleteFolder,
  onMoveCharacterToFolder,
  onMoveFolder,
  onTransferFolderOwnership = null
}) {
  const { notifyError } = useNotifications();
  const [collapsedMap, setCollapsedMap] = useState({});
  const [createConfig, setCreateConfig] = useState(null);
  const [movingChar, setMovingChar] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [characterToDelete, setCharacterToDelete] = useState(null);
  const [spawnModalChar, setSpawnModalChar] = useState(null);
  const [transferConfirmation, setTransferConfirmation] = useState(null);

  const { playerList, sections } = useCharacterTree({
    characters,
    folders,
    currentUserUid: currentUser?.uid || null,
    isGM: Boolean(isGM),
    gmId: gmId || null,
    playersMap,
    canEditFolder
  });

  const foldersById = useMemo(
    () => new Map(folders.map((f) => [f.id, f])),
    [folders]
  );

  const toggleCollapse = (id) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleRenameFolder = async (folderId, nextName) => {
    if (onRenameFolder) {
      return onRenameFolder(folderId, nextName);
    }
    if (onUpdateFolder) {
      return onUpdateFolder(folderId, { name: nextName });
    }
    return false;
  };

  const handleOpenCreateCharacter = (targetFolder = null, targetOwnerId = null) => {
    setCreateConfig({
      type: "character",
      folderId: targetFolder?.id || "",
      ownerId:
        targetOwnerId ||
        targetFolder?.ownerId ||
        (isGM ? gmId || currentUser?.uid : currentUser?.uid)
    });
  };

  const handleOpenCreateFolder = (parentFolder = null, targetOwnerId = null) => {
    setCreateConfig({
      type: "folder",
      folderId: parentFolder?.id || "",
      ownerId:
        targetOwnerId ||
        parentFolder?.ownerId ||
        (isGM ? gmId || currentUser?.uid : currentUser?.uid)
    });
  };

  const handleConfirmCreate = async ({
    type,
    name,
    charType,
    folderId,
    ownerId
  }) => {
    try {
      if (type === "character") {
        const charId = await onCreateCharacter?.({
          name,
          type: charType,
          folderId: folderId || null,
          ownerId: ownerId || currentUser?.uid,
          visibleToAll: charType === "pc"
        });
        if (charId) {
          onOpenSheet?.(charId);
        }
        setCreateConfig(null);
      } else {
        const createdId = await onCreateFolder?.({
          name,
          parentId: folderId || null,
          ownerId: ownerId || currentUser?.uid
        });
        if (createdId !== null && createdId !== false) {
          setCreateConfig(null);
        }
      }
    } catch (err) {
      notifyError(err);
    }
  };

  const handleConfirmMoveCharModal = async (
    charId,
    targetFolderId,
    targetOwnerId
  ) => {
    try {
      const ok = await onMoveCharacterToFolder?.(
        charId,
        targetFolderId || null,
        targetOwnerId || null
      );
      if (ok !== false) {
        setMovingChar(null);
      }
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDropCharacter = async (charId, targetFolderId, targetOwnerId) => {
    const char = characters.find((c) => c.id === charId);
    if (!char) return;
    if (!isGM && char.ownerId !== currentUser?.uid) {
      notifyError("Você não tem permissão para mover esta ficha.");
      return;
    }

    const nextOwnerId = isGM
      ? targetOwnerId || char.ownerId || gmId || currentUser?.uid
      : char.ownerId;

    if (
      (char.folderId || null) === (targetFolderId || null) &&
      (char.ownerId || null) === (nextOwnerId || null)
    ) {
      return;
    }

    if (isGM && nextOwnerId && char.ownerId && nextOwnerId !== char.ownerId) {
      const targetLabel = resolveOwnerName(
        nextOwnerId,
        gmId,
        playersMap,
        currentUser?.uid
      );
      setTransferConfirmation({
        kind: "character",
        title: "Transferir Ficha?",
        question: `Mover "${char.name}" e transferir a posse para ${targetLabel}?`,
        onExecute: () =>
          onMoveCharacterToFolder?.(
            char.id,
            targetFolderId || null,
            nextOwnerId
          )
      });
      return;
    }

    try {
      await onMoveCharacterToFolder?.(
        char.id,
        targetFolderId || null,
        char.ownerId || nextOwnerId || null
      );
    } catch (err) {
      notifyError(err);
    }
  };

  const handleDropFolder = async (folderId, targetParentId, targetOwnerId) => {
    const folder = foldersById.get(folderId);
    if (!folder) return;

    if (!isGM && folder.ownerId !== currentUser?.uid) {
      notifyError("Você não tem permissão para mover esta pasta.");
      return;
    }

    const cleanTargetParentId = targetParentId || null;
    if (cleanTargetParentId === folder.id) {
      notifyError(
        new AppError(
          ERROR_CODES.CYCLE_DETECTED,
          "Não é possível mover uma pasta para dentro dela mesma."
        )
      );
      return;
    }

    const descendants = collectDescendantFolderIds(folder.id, folders, {
      includeSelf: true
    });
    if (cleanTargetParentId && descendants.includes(cleanTargetParentId)) {
      notifyError(
        new AppError(
          ERROR_CODES.CYCLE_DETECTED,
          "Não é possível mover uma pasta para dentro de suas próprias subpastas."
        )
      );
      return;
    }

    const nextOwnerId = isGM
      ? targetOwnerId || folder.ownerId || gmId || currentUser?.uid
      : folder.ownerId;

    const isCrossOwner = Boolean(
      isGM && nextOwnerId && folder.ownerId && nextOwnerId !== folder.ownerId
    );

    const validation = validateFolderMove({
      folder: isCrossOwner
        ? { ...folder, domain: folder.domain || FOLDER_DOMAINS.CHARACTER, ownerId: nextOwnerId }
        : { ...folder, domain: folder.domain || FOLDER_DOMAINS.CHARACTER },
      targetParentId: cleanTargetParentId,
      foldersById
    });
    if (!validation.ok) {
      notifyError(validation.errors[0]);
      return;
    }

    if (
      (folder.parentId || null) === cleanTargetParentId &&
      (folder.ownerId || null) === (nextOwnerId || null)
    ) {
      return;
    }

    if (isCrossOwner) {
      const targetLabel = resolveOwnerName(
        nextOwnerId,
        gmId,
        playersMap,
        currentUser?.uid
      );
      setTransferConfirmation({
        kind: "folder",
        title: "Transferir Pasta?",
        question: `Transferir "${folder.name}", suas subpastas e fichas para ${targetLabel}?`,
        onExecute: () =>
          onMoveFolder
            ? onMoveFolder(folder.id, cleanTargetParentId, nextOwnerId)
            : onTransferFolderOwnership?.(
                folder.id,
                nextOwnerId,
                cleanTargetParentId
              )
      });
      return;
    }

    try {
      await onMoveFolder?.(
        folder.id,
        cleanTargetParentId,
        folder.ownerId || nextOwnerId || null
      );
    } catch (err) {
      notifyError(err);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        background: "#ffffff",
        overflow: "hidden"
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "10px",
          borderBottom: "1px solid #e2e8f0",
          background: "#ffffff",
          flexShrink: 0
        }}
      >
        <button
          type="button"
          className="cp-btn"
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 800,
            background: "#f8fafc",
            border: "1.5px solid #cbd5e1",
            color: "#1e293b"
          }}
          onClick={() => handleOpenCreateCharacter()}
        >
          + Personagem
        </button>

        <button
          type="button"
          className="cp-btn"
          style={{
            flex: 1,
            padding: "6px 10px",
            fontSize: "12px",
            fontWeight: 800,
            background: "#f8fafc",
            border: "1.5px solid #cbd5e1",
            color: "#1e293b"
          }}
          onClick={() => handleOpenCreateFolder()}
        >
          + Pasta
        </button>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "4px 0"
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const defaultRootOwner = isGM ? gmId || currentUser?.uid : currentUser?.uid;
          const charId = e.dataTransfer.getData("text/character-id");
          if (charId) {
            handleDropCharacter(charId, null, defaultRootOwner);
            return;
          }
          const folderId = e.dataTransfer.getData("text/folder-id");
          if (folderId) {
            handleDropFolder(folderId, null, defaultRootOwner);
          }
        }}
      >
        {sections.map((section) => (
          <CharacterTreeView
            key={section.id}
            section={section}
            campaignId={campaignId}
            isGM={Boolean(isGM)}
            canEditCharacter={canEditCharacter}
            canDeleteCharacter={canDeleteCharacter}
            canEditFolder={canEditFolder}
            canDeleteFolder={canDeleteFolder}
            currentUserId={currentUser?.uid || null}
            onlineUsers={onlineUsers}
            collapsedMap={collapsedMap}
            onToggleCollapse={toggleCollapse}
            onOpenSheet={onOpenSheet}
            onOpenSpawnModal={onSpawnToken ? setSpawnModalChar : null}
            onDeleteCharacter={(charId) => {
              const found = characters.find((c) => c.id === charId);
              setCharacterToDelete(found || { id: charId, name: "Personagem" });
            }}
            onOpenMoveModal={setMovingChar}
            onOpenCreateCharacter={handleOpenCreateCharacter}
            onOpenCreateFolder={handleOpenCreateFolder}
            onStartCreateInFolder={(fld, entryType) => {
              if (entryType === "character") {
                handleOpenCreateCharacter(fld, fld.ownerId);
              } else {
                handleOpenCreateFolder(fld, fld.ownerId);
              }
            }}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={(folderId) => {
              const found = foldersById.get(folderId);
              setFolderToDelete(found || { id: folderId, name: "Pasta" });
            }}
            onDropCharacterOnFolder={(charId, targetFolder) =>
              handleDropCharacter(charId, targetFolder.id, targetFolder.ownerId)
            }
            onDropFolderOnFolder={(draggedFolderId, targetFolder) =>
              handleDropFolder(
                draggedFolderId,
                targetFolder.id,
                targetFolder.ownerId
              )
            }
            onDropCharacterOnSectionRoot={(charId, targetSection) =>
              handleDropCharacter(charId, null, targetSection.ownerId)
            }
            onDropFolderOnSectionRoot={(draggedFolderId, targetSection) =>
              handleDropFolder(draggedFolderId, null, targetSection.ownerId)
            }
            onInvalidFolderName={notifyError}
          />
        ))}
      </div>

      {createConfig && (
        <CreateEntryModal
          initialConfig={createConfig}
          folders={folders}
          isGM={Boolean(isGM)}
          gmId={gmId || null}
          currentUserId={currentUser?.uid || null}
          playerList={playerList}
          onConfirm={handleConfirmCreate}
          onClose={() => setCreateConfig(null)}
          onValidationError={notifyError}
        />
      )}

      {movingChar && (
        <MoveCharacterModal
          character={movingChar}
          folders={folders}
          onConfirm={handleConfirmMoveCharModal}
          onClose={() => setMovingChar(null)}
        />
      )}

      {spawnModalChar && (
        <SpawnTokenModal
          character={spawnModalChar}
          isGM={Boolean(isGM)}
          onConfirm={onSpawnToken}
          onClose={() => setSpawnModalChar(null)}
        />
      )}

      {transferConfirmation && (
        <ConfirmDialog
          title={transferConfirmation.title}
          question={transferConfirmation.question}
          confirmLabel="Transferir"
          confirmVariant="green"
          onCancel={() => setTransferConfirmation(null)}
          onConfirm={async () => {
            const exec = transferConfirmation.onExecute;
            setTransferConfirmation(null);
            try {
              await exec?.();
            } catch (err) {
              notifyError(err);
            }
          }}
        />
      )}

      {characterToDelete && (
        <ConfirmDialog
          title="Excluir ficha?"
          question={`Remover "${characterToDelete.name}"?`}
          confirmLabel="Excluir"
          onCancel={() => setCharacterToDelete(null)}
          onConfirm={async () => {
            const cid = characterToDelete.id;
            setCharacterToDelete(null);
            try {
              await onDeleteCharacter?.(cid);
            } catch (err) {
              notifyError(err);
            }
          }}
        />
      )}

      {folderToDelete && (
        <ConfirmDeleteModal
          title={`Excluir Pasta "${folderToDelete.name}"`}
          question="Deseja excluir também as fichas desta pasta?"
          moveLabel="Não, mover fichas para a pasta pai"
          deleteLabel="Sim, excluir pasta e fichas"
          onCancel={() => setFolderToDelete(null)}
          onMove={async () => {
            const fid = folderToDelete.id;
            setFolderToDelete(null);
            await onDeleteFolder?.(fid, {
              mode: "moveToParent",
              deleteContents: false
            });
          }}
          onDelete={async () => {
            const fid = folderToDelete.id;
            setFolderToDelete(null);
            await onDeleteFolder?.(fid, {
              mode: "deleteAll",
              deleteContents: true
            });
          }}
        />
      )}
    </div>
  );
}
