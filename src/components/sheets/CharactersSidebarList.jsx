import { useMemo, useState } from "react";
import { useMediaUrl } from "../../hooks/useMediaUrl";

function CharacterRow({
  character,
  campaignId,
  isGM,
  canEdit,
  onlineUsers = {},
  onOpenSheet,
  onOpenSpawnModal,
  onDeleteCharacter,
  onOpenMoveModal
}) {
  const { url: avatarUrl } = useMediaUrl(
    character.avatarMediaId || character.defaultToken?.mediaId,
    character.avatarExternalUrl || character.defaultToken?.externalUrl,
    campaignId
  );

  const [isHovered, setIsHovered] = useState(false);

  const handleOpenNewWindow = (e) => {
    e.stopPropagation();
    const url = `${window.location.origin}${window.location.pathname}?sheetId=${encodeURIComponent(character.id)}`;
    window.open(
      url,
      `cpvtt_sheet_${character.id}`,
      "width=1080,height=760,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  const isOnline = Boolean(
    character.ownerId && onlineUsers[character.ownerId]
  );

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/character-id", character.id);
      }}
      onClick={() => onOpenSheet(character.id)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 8px",
        borderBottom: "1px solid #edf2f7",
        background: isHovered ? "#f7fafc" : "#ffffff",
        cursor: "pointer",
        transition: "background 0.15s ease",
        gap: "8px"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
        {/* Avatar circular estilo Club Penguin / VTT */}
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#1a202c",
            border: `2px solid ${character.cardColor || "#2b6cb0"}`,
            overflow: "hidden",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={character.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ color: "#ffffff", fontSize: "12px", fontWeight: 800 }}>
              {(character.name || "P").slice(0, 2).toUpperCase()}
            </span>
          )}
        </div>

        {/* Nome do personagem */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "13px",
              color: "#1e293b",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {character.name}
          </div>
          {character.resources?.hp && (
            <div style={{ fontSize: "10px", fontWeight: 700, color: "#64748b" }}>
              HP {character.resources.hp.current}/{character.resources.hp.max}
            </div>
          )}
        </div>
      </div>

      <div
        style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ações em hover */}
        {isHovered && (
          <>
            {onOpenSpawnModal && (
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={() => onOpenSpawnModal(character)}
                title="Colocar Token no Mapa"
              >
                +Mapa
              </button>
            )}

            <button
              type="button"
              className="cp-btn cp-btn-gold"
              style={{ padding: "2px 6px", fontSize: "10px" }}
              onClick={handleOpenNewWindow}
              title="Abrir em Nova Janela"
            >
              ↗
            </button>

            {onOpenMoveModal && (
              <button
                type="button"
                className="cp-btn"
                style={{ padding: "2px 6px", fontSize: "10px" }}
                onClick={() => onOpenMoveModal(character)}
                title="Mover para pasta..."
              >
                📁
              </button>
            )}

            {(isGM || canEdit) && (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "2px 5px", fontSize: "10px" }}
                onClick={() => onDeleteCharacter(character.id)}
                title="Excluir Personagem"
              >
                ✕
              </button>
            )}
          </>
        )}

        {/* Ponto de status laranja / verde na direita como na referência */}
        <div
          title={isOnline ? "Online" : "Personagem Ativo"}
          style={{
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: isOnline ? "#22c55e" : "#f59e0b",
            boxShadow: "0 0 4px rgba(245, 158, 11, 0.5)",
            flexShrink: 0
          }}
        />
      </div>
    </div>
  );
}

function FolderItem({
  folder,
  allFolders,
  allCharacters,
  campaignId,
  isGM,
  canEdit,
  onlineUsers,
  collapsedMap,
  onToggleCollapse,
  onOpenSheet,
  onOpenSpawnModal,
  onDeleteCharacter,
  onOpenMoveModal,
  onStartCreateInFolder,
  onRenameFolder,
  onDeleteFolder,
  onMoveCharacterToFolder,
  onMoveFolder
}) {
  const [isOver, setIsOver] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(folder.name);

  const isCollapsed = Boolean(collapsedMap[folder.id]);

  const subfolders = useMemo(
    () => allFolders.filter((f) => f.parentId === folder.id),
    [allFolders, folder.id]
  );

  const folderChars = useMemo(
    () => allCharacters.filter((c) => c.folderId === folder.id),
    [allCharacters, folder.id]
  );

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const charId = e.dataTransfer.getData("text/character-id");
    if (charId) {
      onMoveCharacterToFolder(charId, folder.id, folder.ownerId);
      return;
    }

    const draggedFolderId = e.dataTransfer.getData("text/folder-id");
    if (draggedFolderId && draggedFolderId !== folder.id) {
      onMoveFolder(draggedFolderId, folder.id, folder.ownerId);
    }
  };

  const handleSaveRename = (e) => {
    e.preventDefault();
    if (tempName.trim()) {
      onRenameFolder(folder.id, tempName.trim());
    }
    setEditingName(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Cabeçalho da Pasta */}
      <div
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("text/folder-id", folder.id);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsOver(true);
        }}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "5px 6px",
          borderBottom: "1px solid #edf2f7",
          background: isOver ? "#e0f2fe" : "#ffffff",
          cursor: "pointer",
          fontWeight: 700,
          userSelect: "none"
        }}
      >
        <div
          onClick={() => onToggleCollapse(folder.id)}
          style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}
        >
          {/* Botão + / - no estilo da imagem anexada */}
          <span
            style={{
              width: "16px",
              textAlign: "center",
              fontSize: "14px",
              fontWeight: 900,
              color: "#334155"
            }}
          >
            {isCollapsed ? "+" : "-"}
          </span>

          {editingName ? (
            <form onSubmit={handleSaveRename} onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                className="cp-input"
                value={tempName}
                autoFocus
                onChange={(e) => setTempName(e.target.value)}
                onBlur={handleSaveRename}
                style={{ fontSize: "12px", padding: "2px 5px", width: "120px" }}
              />
            </form>
          ) : (
            <span
              style={{
                fontSize: "13px",
                color: folder.parentId ? "#0284c7" : "#1e293b",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {folder.name}
            </span>
          )}

          <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
            ({folderChars.length + subfolders.length})
          </span>
        </div>

        {/* Ações da Pasta */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="cp-btn"
            style={{ padding: "1px 5px", fontSize: "10px" }}
            onClick={() => onStartCreateInFolder(folder, "character")}
            title="Novo Personagem nesta Pasta"
          >
            +👤
          </button>
          <button
            type="button"
            className="cp-btn"
            style={{ padding: "1px 5px", fontSize: "10px" }}
            onClick={() => onStartCreateInFolder(folder, "folder")}
            title="Nova Subpasta nesta Pasta"
          >
            +📁
          </button>
          <button
            type="button"
            className="cp-btn"
            style={{ padding: "1px 5px", fontSize: "10px" }}
            onClick={() => setEditingName((prev) => !prev)}
            title="Renomear Pasta"
          >
            ✏️
          </button>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "1px 5px", fontSize: "10px" }}
            onClick={() => onDeleteFolder(folder.id)}
            title="Excluir Pasta"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Conteúdo Expandido com indentação clássica */}
      {!isCollapsed && (
        <div
          style={{
            paddingLeft: "18px",
            borderLeft: "2px solid #e2e8f0",
            marginLeft: "8px"
          }}
        >
          {/* Subpastas recursivas */}
          {subfolders.map((sub) => (
            <FolderItem
              key={sub.id}
              folder={sub}
              allFolders={allFolders}
              allCharacters={allCharacters}
              campaignId={campaignId}
              isGM={isGM}
              canEdit={canEdit}
              onlineUsers={onlineUsers}
              collapsedMap={collapsedMap}
              onToggleCollapse={onToggleCollapse}
              onOpenSheet={onOpenSheet}
              onOpenSpawnModal={onOpenSpawnModal}
              onDeleteCharacter={onDeleteCharacter}
              onOpenMoveModal={onOpenMoveModal}
              onStartCreateInFolder={onStartCreateInFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onMoveCharacterToFolder={onMoveCharacterToFolder}
              onMoveFolder={onMoveFolder}
            />
          ))}

          {/* Personagens dentro da pasta */}
          {folderChars.map((char) => (
            <CharacterRow
              key={char.id}
              character={char}
              campaignId={campaignId}
              isGM={isGM}
              canEdit={canEdit}
              onlineUsers={onlineUsers}
              onOpenSheet={onOpenSheet}
              onOpenSpawnModal={onOpenSpawnModal}
              onDeleteCharacter={onDeleteCharacter}
              onOpenMoveModal={onOpenMoveModal}
            />
          ))}

          {subfolders.length === 0 && folderChars.length === 0 && (
            <div
              style={{
                fontSize: "11px",
                color: "#94a3b8",
                padding: "6px 8px",
                fontStyle: "italic"
              }}
            >
              (Pasta vazia - arraste itens para cá)
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CharactersSidebarList({
  characters = [],
  folders = [],
  campaignId,
  isGM,
  currentUser,
  playersMap = {},
  gmId,
  onlineUsers = {},
  onCreateCharacter,
  onOpenSheet,
  onSpawnToken,
  onDeleteCharacter,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveCharacterToFolder,
  onMoveFolder
}) {
  // Estado de colapso de seções e pastas
  const [collapsedMap, setCollapsedMap] = useState({});

  // Diálogo para criação rápida de Personagem ou Pasta
  const [createModal, setCreateModal] = useState(null); // { type: 'character' | 'folder', folderId, ownerId }
  const [modalName, setModalName] = useState("");
  const [modalCharType, setModalCharType] = useState("pc");
  const [modalOwnerId, setModalOwnerId] = useState("");
  const [modalFolderId, setModalFolderId] = useState("");

  // Diálogo para mover personagem
  const [movingChar, setMovingChar] = useState(null);
  const [targetMoveFolder, setTargetMoveFolder] = useState("");

  // Diálogo para colocar token no mapa (definir se exibe nome e visibilidade)
  const [spawnModalChar, setSpawnModalChar] = useState(null);
  const [spawnShowName, setSpawnShowName] = useState(true);
  const [spawnVisibleToPlayers, setSpawnVisibleToPlayers] = useState(true);

  const handleOpenSpawnModal = (char) => {
    setSpawnModalChar(char);
    setSpawnShowName(char.defaultToken?.showName !== false);
    setSpawnVisibleToPlayers(char.type !== "npc" || isGM);
  };

  const toggleCollapse = (id) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Separação de Players registrados (excluindo o GM)
  const playerList = useMemo(() => {
    const list = Object.entries(playersMap)
      .filter(([uid]) => uid !== gmId)
      .map(([uid, p]) => ({
        uid,
        displayName: p.displayName || p.name || p.email?.split("@")[0] || "Jogador",
        photoURL: p.photoURL || null
      }));
    return list;
  }, [playersMap, gmId]);

  // Abre modal de criação de personagem
  const handleOpenCreateCharacter = (targetFolder = null, targetOwnerId = null) => {
    setModalName("");
    setModalCharType("pc");
    setModalFolderId(targetFolder?.id || "");
    setModalOwnerId(targetOwnerId || targetFolder?.ownerId || (isGM ? (gmId || currentUser?.uid) : currentUser?.uid));
    setCreateModal({ type: "character" });
  };

  // Abre modal de criação de pasta
  const handleOpenCreateFolder = (parentFolder = null, targetOwnerId = null) => {
    setModalName("");
    setModalFolderId(parentFolder?.id || "");
    setModalOwnerId(targetOwnerId || parentFolder?.ownerId || (isGM ? (gmId || currentUser?.uid) : currentUser?.uid));
    setCreateModal({ type: "folder" });
  };

  const handleConfirmCreate = async (e) => {
    e.preventDefault();
    if (!modalName.trim()) return;

    if (createModal.type === "character") {
      const charId = await onCreateCharacter({
        name: modalName.trim(),
        type: modalCharType,
        folderId: modalFolderId || null,
        ownerId: modalOwnerId || currentUser?.uid,
        visibleToAll: modalCharType === "pc"
      });
      if (charId) {
        onOpenSheet(charId);
      }
    } else {
      await onCreateFolder({
        name: modalName.trim(),
        parentId: modalFolderId || null,
        ownerId: modalOwnerId || currentUser?.uid
      });
    }

    setCreateModal(null);
  };

  const handleConfirmMove = async (e) => {
    e.preventDefault();
    if (!movingChar) return;
    await onMoveCharacterToFolder(
      movingChar.id,
      targetMoveFolder || null,
      isGM ? modalOwnerId || null : null
    );
    setMovingChar(null);
  };

  // Lista de GM (Fora de qualquer seção de player)
  const gmRootChars = useMemo(() => {
    return characters.filter((c) => {
      const isPlayerChar = playerList.some((p) => p.uid === c.ownerId);
      return !isPlayerChar && !c.folderId;
    });
  }, [characters, playerList]);

  const gmRootFolders = useMemo(() => {
    return folders.filter((f) => {
      const isPlayerFolder = playerList.some((p) => p.uid === f.ownerId);
      return !isPlayerFolder && !f.parentId;
    });
  }, [folders, playerList]);

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
      {/* Botões do Topo: + Personagem e + Pasta (conforme a imagem) */}
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

      {/* Árvore estruturada de Personagens e Pastas */}
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
          const charId = e.dataTransfer.getData("text/character-id");
          if (charId) {
            onMoveCharacterToFolder(charId, null, isGM ? gmId : currentUser?.uid);
          }
        }}
      >
        {/* =========================================================================
            VISÃO DO MESTRE: ITENS DO PRÓPRIO MESTRE ("FORA DE QUALQUER SEÇÃO")
           ========================================================================= */}
        {isGM && (
          <div style={{ marginBottom: "12px" }}>
            {/* Personagens na raiz do Mestre (ex: Yema Kr'wov, Ejoesha Loemea) */}
            {gmRootChars.map((char) => (
              <CharacterRow
                key={char.id}
                character={char}
                campaignId={campaignId}
                isGM={isGM}
                canEdit={true}
                onlineUsers={onlineUsers}
                onOpenSheet={onOpenSheet}
                onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                onDeleteCharacter={onDeleteCharacter}
                onOpenMoveModal={(c) => {
                  setMovingChar(c);
                  setTargetMoveFolder(c.folderId || "");
                }}
              />
            ))}

            {/* Pastas na raiz do Mestre (ex: + NPC's, + Inimigos) */}
            {gmRootFolders.map((folder) => (
              <FolderItem
                key={folder.id}
                folder={folder}
                allFolders={folders}
                allCharacters={characters}
                campaignId={campaignId}
                isGM={isGM}
                canEdit={true}
                onlineUsers={onlineUsers}
                collapsedMap={collapsedMap}
                onToggleCollapse={toggleCollapse}
                onOpenSheet={onOpenSheet}
                onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                onDeleteCharacter={onDeleteCharacter}
                onOpenMoveModal={(c) => {
                  setMovingChar(c);
                  setTargetMoveFolder(c.folderId || "");
                }}
                onStartCreateInFolder={(fld, type) => {
                  if (type === "character") handleOpenCreateCharacter(fld, fld.ownerId);
                  else handleOpenCreateFolder(fld, fld.ownerId);
                }}
                onRenameFolder={(fid, nextName) => onUpdateFolder(fid, { name: nextName })}
                onDeleteFolder={onDeleteFolder}
                onMoveCharacterToFolder={onMoveCharacterToFolder}
                onMoveFolder={onMoveFolder}
              />
            ))}
          </div>
        )}

        {/* =========================================================================
            SEÇÕES DOS JOGADORES (- Jogador 1, - Jogador 2, - Jogador 3...)
           ========================================================================= */}
        {isGM && playerList.map((player) => {
          const isPlayerCollapsed = Boolean(collapsedMap[`player_${player.uid}`]);
          const playerChars = characters.filter((c) => c.ownerId === player.uid && !c.folderId);
          const playerFolders = folders.filter((f) => f.ownerId === player.uid && !f.parentId);
          const totalPlayerCount =
            characters.filter((c) => c.ownerId === player.uid).length +
            folders.filter((f) => f.ownerId === player.uid).length;

          return (
            <div
              key={player.uid}
              style={{
                borderTop: "1.5px solid #e2e8f0",
                marginTop: "4px"
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const charId = e.dataTransfer.getData("text/character-id");
                if (charId) {
                  onMoveCharacterToFolder(charId, null, player.uid);
                }
              }}
            >
              {/* Cabeçalho da Seção do Jogador (ex: - Jogador 1) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "7px 10px",
                  background: "#f8fafc",
                  cursor: "pointer",
                  userSelect: "none"
                }}
              >
                <div
                  onClick={() => toggleCollapse(`player_${player.uid}`)}
                  style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}
                >
                  <span style={{ fontSize: "14px", fontWeight: 900, color: "#334155" }}>
                    {isPlayerCollapsed ? "+" : "-"}
                  </span>
                  <span style={{ fontSize: "13px", fontWeight: 800, color: "#1e293b" }}>
                    {player.displayName}
                  </span>
                  <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 700 }}>
                    ({totalPlayerCount})
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "1px 6px", fontSize: "10px" }}
                    onClick={() => handleOpenCreateCharacter(null, player.uid)}
                    title="Criar personagem para este jogador"
                  >
                    +👤
                  </button>
                  <button
                    type="button"
                    className="cp-btn"
                    style={{ padding: "1px 6px", fontSize: "10px" }}
                    onClick={() => handleOpenCreateFolder(null, player.uid)}
                    title="Criar pasta para este jogador"
                  >
                    +📁
                  </button>
                </div>
              </div>

              {/* Itens do Jogador */}
              {!isPlayerCollapsed && (
                <div style={{ paddingLeft: "10px" }}>
                  {/* Personagens na raiz deste Jogador */}
                  {playerChars.map((char) => (
                    <CharacterRow
                      key={char.id}
                      character={char}
                      campaignId={campaignId}
                      isGM={isGM}
                      canEdit={true}
                      onlineUsers={onlineUsers}
                      onOpenSheet={onOpenSheet}
                      onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                      onDeleteCharacter={onDeleteCharacter}
                      onOpenMoveModal={(c) => {
                        setMovingChar(c);
                        setTargetMoveFolder(c.folderId || "");
                      }}
                    />
                  ))}

                  {/* Pastas deste Jogador (ex: Transformações, npcs da minha historia, Aliados) */}
                  {playerFolders.map((folder) => (
                    <FolderItem
                      key={folder.id}
                      folder={folder}
                      allFolders={folders}
                      allCharacters={characters}
                      campaignId={campaignId}
                      isGM={isGM}
                      canEdit={true}
                      onlineUsers={onlineUsers}
                      collapsedMap={collapsedMap}
                      onToggleCollapse={toggleCollapse}
                      onOpenSheet={onOpenSheet}
                      onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                      onDeleteCharacter={onDeleteCharacter}
                      onOpenMoveModal={(c) => {
                        setMovingChar(c);
                        setTargetMoveFolder(c.folderId || "");
                      }}
                      onStartCreateInFolder={(fld, type) => {
                        if (type === "character") handleOpenCreateCharacter(fld, player.uid);
                        else handleOpenCreateFolder(fld, player.uid);
                      }}
                      onRenameFolder={(fid, nextName) => onUpdateFolder(fid, { name: nextName })}
                      onDeleteFolder={onDeleteFolder}
                      onMoveCharacterToFolder={onMoveCharacterToFolder}
                      onMoveFolder={onMoveFolder}
                    />
                  ))}

                  {playerChars.length === 0 && playerFolders.length === 0 && (
                    <div
                      style={{
                        padding: "8px 12px",
                        fontSize: "11px",
                        color: "#94a3b8",
                        fontStyle: "italic"
                      }}
                    >
                      (Nenhum personagem ou pasta para este jogador)
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* =========================================================================
            VISÃO DO JOGADOR: APENAS SEUS PRÓPRIOS PERSONAGENS E PASTAS
           ========================================================================= */}
        {!isGM && (
          <div>
            {/* Personagens do jogador na raiz */}
            {characters
              .filter((c) => c.ownerId === currentUser?.uid && !c.folderId)
              .map((char) => (
                <CharacterRow
                  key={char.id}
                  character={char}
                  campaignId={campaignId}
                  isGM={false}
                  canEdit={true}
                  onlineUsers={onlineUsers}
                  onOpenSheet={onOpenSheet}
                  onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                  onDeleteCharacter={onDeleteCharacter}
                  onOpenMoveModal={(c) => {
                    setMovingChar(c);
                    setTargetMoveFolder(c.folderId || "");
                  }}
                />
              ))}

            {/* Pastas do jogador */}
            {folders
              .filter((f) => f.ownerId === currentUser?.uid && !f.parentId)
              .map((folder) => (
                <FolderItem
                  key={folder.id}
                  folder={folder}
                  allFolders={folders}
                  allCharacters={characters}
                  campaignId={campaignId}
                  isGM={false}
                  canEdit={true}
                  onlineUsers={onlineUsers}
                  collapsedMap={collapsedMap}
                  onToggleCollapse={toggleCollapse}
                  onOpenSheet={onOpenSheet}
                  onOpenSpawnModal={onSpawnToken ? handleOpenSpawnModal : null}
                  onDeleteCharacter={onDeleteCharacter}
                  onOpenMoveModal={(c) => {
                    setMovingChar(c);
                    setTargetMoveFolder(c.folderId || "");
                  }}
                  onStartCreateInFolder={(fld, type) => {
                    if (type === "character") handleOpenCreateCharacter(fld, currentUser?.uid);
                    else handleOpenCreateFolder(fld, currentUser?.uid);
                  }}
                  onRenameFolder={(fid, nextName) => onUpdateFolder(fid, { name: nextName })}
                  onDeleteFolder={onDeleteFolder}
                  onMoveCharacterToFolder={onMoveCharacterToFolder}
                  onMoveFolder={onMoveFolder}
                />
              ))}
          </div>
        )}
      </div>

      {/* Modal de Criação (Personagem ou Pasta) */}
      {createModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 27, 58, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setCreateModal(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "3px solid #008be3",
              borderRadius: "14px",
              padding: "16px",
              width: "100%",
              maxWidth: "340px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#003264" }}>
              {createModal.type === "character" ? "Novo Personagem" : "Nova Pasta"}
            </div>

            <form onSubmit={handleConfirmCreate} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input
                type="text"
                className="cp-input"
                placeholder={createModal.type === "character" ? "Nome do Personagem..." : "Nome da Pasta..."}
                value={modalName}
                onChange={(e) => setModalName(e.target.value)}
                autoFocus
                required
                style={{ fontSize: "13px", padding: "6px 10px" }}
              />

              {/* Se for Personagem e for GM: tipo PC ou NPC */}
              {createModal.type === "character" && isGM && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>Tipo</label>
                  <select
                    className="cp-input"
                    value={modalCharType}
                    onChange={(e) => setModalCharType(e.target.value)}
                    style={{ fontSize: "12px", padding: "5px" }}
                  >
                    <option value="pc">Personagem de Jogador (PC)</option>
                    <option value="npc">Personagem do Mestre (NPC)</option>
                  </select>
                </div>
              )}

              {/* Destino da Pasta */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                  {createModal.type === "character" ? "Pasta de Destino" : "Pasta Mãe (Opcional)"}
                </label>
                <select
                  className="cp-input"
                  value={modalFolderId}
                  onChange={(e) => setModalFolderId(e.target.value)}
                  style={{ fontSize: "12px", padding: "5px" }}
                >
                  <option value="">Raiz / Fora de qualquer pasta</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      📁 {f.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Se for GM: Atribuição de Dono / Seção */}
              {isGM && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                    Dono / Seção
                  </label>
                  <select
                    className="cp-input"
                    value={modalOwnerId}
                    onChange={(e) => setModalOwnerId(e.target.value)}
                    style={{ fontSize: "12px", padding: "5px" }}
                  >
                    <option value={gmId || currentUser?.uid}>Mestre (Minhas Fichas)</option>
                    {playerList.map((p) => (
                      <option key={p.uid} value={p.uid}>
                        👤 {p.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{ padding: "5px 12px", fontSize: "12px" }}
                  onClick={() => setCreateModal(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cp-btn cp-btn-green"
                  style={{ padding: "5px 16px", fontSize: "12px" }}
                >
                  Criar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para mover personagem para outra pasta */}
      {movingChar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 27, 58, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setMovingChar(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "3px solid #008be3",
              borderRadius: "14px",
              padding: "16px",
              width: "100%",
              maxWidth: "320px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#003264" }}>
              Mover &quot;{movingChar.name}&quot;
            </div>

            <form onSubmit={handleConfirmMove} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <select
                className="cp-input"
                value={targetMoveFolder}
                onChange={(e) => setTargetMoveFolder(e.target.value)}
                style={{ fontSize: "12px", padding: "6px" }}
              >
                <option value="">Raiz / Fora de qualquer pasta</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    📁 {f.name}
                  </option>
                ))}
              </select>

              <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cp-btn cp-btn-orange"
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                  onClick={() => setMovingChar(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="cp-btn cp-btn-green"
                  style={{ padding: "4px 14px", fontSize: "11px" }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para Colocar Token no Mapa com opção de exibir nome */}
      {spawnModalChar && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 27, 58, 0.45)",
            backdropFilter: "blur(2px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setSpawnModalChar(null)}
        >
          <div
            style={{
              background: "#ffffff",
              border: "3px solid #008be3",
              borderRadius: "14px",
              padding: "16px",
              width: "100%",
              maxWidth: "320px",
              boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "14px", fontWeight: 800, color: "#003264" }}>
              Colocar Token no Mapa
            </div>

            <div style={{ fontSize: "13px", fontWeight: 700, color: "#1e293b" }}>
              {spawnModalChar.name}
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                fontWeight: 700,
                color: "#1e293b",
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={spawnShowName}
                onChange={(e) => setSpawnShowName(e.target.checked)}
              />
              Exibir nome no token
            </label>

            {isGM && (
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "#1e293b",
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={spawnVisibleToPlayers}
                  onChange={(e) => setSpawnVisibleToPlayers(e.target.checked)}
                />
                Visível para jogadores
              </label>
            )}

            <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginTop: "4px" }}>
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                style={{ padding: "4px 10px", fontSize: "11px" }}
                onClick={() => setSpawnModalChar(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="cp-btn cp-btn-green"
                style={{ padding: "4px 14px", fontSize: "11px" }}
                onClick={() => {
                  onSpawnToken(spawnModalChar, {
                    showName: spawnShowName,
                    visibleToPlayers: spawnVisibleToPlayers
                  });
                  setSpawnModalChar(null);
                }}
              >
                + No Mapa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
