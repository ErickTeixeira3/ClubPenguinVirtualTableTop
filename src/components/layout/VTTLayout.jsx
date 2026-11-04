import { useMemo, useState } from "react";
import { ref, set as rtdbSet } from "firebase/database";
import { rtdb } from "../../services/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { useCampaign } from "../../contexts/CampaignContext";
import { useScenes } from "../../hooks/useScenes";
import { useCharacters } from "../../hooks/useCharacters";
import { useCompendium } from "../../hooks/useCompendium";
import { useChatRolls } from "../../hooks/useChatRolls";
import { useJournalNotes } from "../../hooks/useJournalNotes";
import { getNoteTypeMeta } from "../../engines/aliasEngine";
import GMPanelModal from "../gm/GMPanelModal";
import BoardViewport from "../canvas/BoardViewport";
import ScenesManagerModal from "../scenes/ScenesManagerModal";
import CharacterSheetModal from "../sheets/CharacterSheetModal";
import CharactersSidebarList from "../sheets/CharactersSidebarList";
import CompendiumModal from "../compendium/CompendiumModal";
import ChatSidebarPanel from "../chat/ChatSidebarPanel";
import JournalWorkspace from "../journal/JournalWorkspace";
import PlayerProfileModal from "./PlayerProfileModal";

export default function VTTLayout() {
  const { user, logout } = useAuth();
  const {
    campaignId,
    campaign,
    onlineUsers,
    isRealGM,
    isGM,
    viewAsPlayer,
    setViewAsPlayer,
    myPlayerProfile,
    firestoreError
  } = useCampaign();

  const {
    scenes,
    activeScene,
    scenesError,
    createScene,
    updateScene,
    deleteScene,
    activateSceneForTable
  } = useScenes();

  const {
    characters,
    canEditCharacter,
    createCharacter,
    updateCharacter,
    updateCharacterResource,
    uploadCharacterImage,
    deleteCharacter
  } = useCharacters();

  const {
    entries: compendiumEntries,
    createEntry,
    updateEntry,
    deleteEntry
  } = useCompendium();

  const {
    messages,
    sendTextMessage,
    executeRoll,
    deleteMessage
  } = useChatRolls();

  const {
    accessibleNotes,
    createNote,
    updateNote,
    updateNodePosition,
    cloneNoteToTarget,
    deleteNote
  } = useJournalNotes();

  // Verifica se foi aberto via botão "Nova Janela ↗" (?sheetId=...)
  const standaloneSheetId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("sheetId") || null;
  }, []);

  const [activeDockModule, setActiveDockModule] = useState("board");
  const [activeSidebarTab, setActiveSidebarTab] = useState("sheets"); // 'chat' | 'sheets' | 'journal'
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [gmModalOpen, setGmModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [scenesModalOpen, setScenesModalOpen] = useState(false);
  const [compendiumModalOpen, setCompendiumModalOpen] = useState(false);
  const [openCharacterId, setOpenCharacterId] = useState(null);
  const [rollVisibility, setRollVisibility] = useState("public"); // 'public' | 'gm_only'

  const onlineList = Object.values(onlineUsers || {}).filter((u) => u?.online);
  const currentDisplayName =
    myPlayerProfile?.displayName ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Pinguim";

  const activeCharacter = useMemo(() => {
    if (openCharacterId) {
      return characters.find((c) => c.id === openCharacterId) || null;
    }
    return (
      characters.find((c) => c.ownerId === user?.uid) ||
      characters[0] ||
      null
    );
  }, [characters, openCharacterId, user?.uid]);

  const openedSheetCharacter = useMemo(() => {
    const targetId = standaloneSheetId || openCharacterId;
    if (!targetId) return null;
    return characters.find((c) => c.id === targetId) || null;
  }, [characters, standaloneSheetId, openCharacterId]);

  const handleExecuteSheetRoll = async (rollParams) => {
    await executeRoll({
      ...rollParams,
      onDeductResource: updateCharacterResource
    });
    if (!standaloneSheetId) {
      setSidebarOpen(true);
      setActiveSidebarTab("chat");
    }
  };

  // Coloca o Token do Personagem diretamente no Mapa Ativo em Tempo Real
  const handleSpawnCharacterToken = async (char) => {
    const targetSceneId = activeScene?.id || campaign?.activeSceneId;
    if (!char || !targetSceneId || !user) return;

    const tokenId = `tok_${char.id}_${Date.now().toString().slice(-4)}`;
    const tokenRef = ref(
      rtdb,
      `vtt_realtime/${campaignId}/tokens/${targetSceneId}/${tokenId}`
    );

    const cellSizePx = Number(activeScene?.grid?.cellSizePx) || 64;
    const widthPx = Number(activeScene?.mapImage?.widthPx) || 1920;
    const heightPx = Number(activeScene?.mapImage?.heightPx) || 1080;
    const startX =
      Math.round(widthPx / 2 / cellSizePx) * cellSizePx;
    const startY =
      Math.round(heightPx / 2 / cellSizePx) * cellSizePx;

    await rtdbSet(tokenRef, {
      id: tokenId,
      characterId: char.id,
      layer: "tokens",
      name: char.name || "Pinguim",
      mediaId: char.defaultToken?.mediaId || char.avatarMediaId || null,
      externalUrl:
        char.defaultToken?.externalUrl || char.avatarExternalUrl || null,
      x: startX,
      y: startY,
      sizeInCells: Number(char.defaultToken?.sizeInCells) || 1,
      rotation: 0,
      ringColor: char.cardColor || "#3090f0",
      visibleToPlayers: char.type !== "npc" || isGM,
      controlledBy: Array.from(
        new Set([campaign?.gmId, char.ownerId].filter(Boolean))
      ),
      hpCurrent: Number(char.resources?.hp?.current ?? 20),
      hpMax: Number(char.resources?.hp?.max ?? 20),
      showBarsToPlayers: true,
      updatedBy: user.uid,
      updatedAt: Date.now()
    });
  };

  // Modo Janela Dedicada (Pop-out para tela cheia ou Alt+Tab)
  if (standaloneSheetId) {
    if (!openedSheetCharacter) {
      return (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <div className="cp-window">
            <h2 className="cp-title" style={{ padding: "12px 24px" }}>
              CARREGANDO FICHA...
            </h2>
          </div>
        </div>
      );
    }

    return (
      <CharacterSheetModal
        character={openedSheetCharacter}
        campaignId={campaignId}
        playersMap={campaign?.players || {}}
        compendiumEntries={compendiumEntries}
        canEdit={canEditCharacter(openedSheetCharacter)}
        isGM={isGM}
        rollVisibility={rollVisibility}
        onChangeRollVisibility={setRollVisibility}
        onUpdateCharacter={updateCharacter}
        onUploadCharacterImage={uploadCharacterImage}
        onExecuteRoll={handleExecuteSheetRoll}
        onSpawnTokenOnMap={
          activeScene ? handleSpawnCharacterToken : null
        }
        isStandaloneWindow={true}
      />
    );
  }

  const combinedError = firestoreError || scenesError;

  return (
    <div className="vtt-shell">
      {/* Barra Superior */}
      <header className="vtt-topbar">
        <div className="vtt-topbar-left">
          <h2 className="cp-title" style={{ fontSize: "20px" }}>
            {campaign?.name || "CLUB PENGUIN VTT"}
          </h2>

          <span
            className={`cp-badge ${isGM ? "cp-badge-gm" : "cp-badge-player"}`}
          >
            {isGM ? "MESTRE EPF" : "PLAYER"}
          </span>

          {isRealGM && (
            <button
              type="button"
              className={`cp-btn cp-btn-epf ${viewAsPlayer ? "active" : ""}`}
              style={{ padding: "5px 12px", fontSize: "12px" }}
              onClick={() => setViewAsPlayer((prev) => !prev)}
            >
              {viewAsPlayer ? "Visão: Player" : "Visão: Mestre"}
            </button>
          )}
        </div>

        <div className="vtt-topbar-center">
          <div className="presence-list">
            {onlineList.map((u) => (
              <div key={u.uid} className="presence-pill">
                <span className="presence-dot" />
                {u.photoURL && (
                  <img
                    src={u.photoURL}
                    alt=""
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      objectFit: "cover"
                    }}
                  />
                )}
                <span>{u.displayName}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="vtt-topbar-right">
          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{
              padding: "5px 12px",
              fontSize: "12px",
              display: "flex",
              alignItems: "center",
              gap: "8px"
            }}
            onClick={() => setProfileModalOpen(true)}
            title="Editar Perfil do Jogador"
          >
            {myPlayerProfile?.photoURL ? (
              <img
                src={myPlayerProfile.photoURL}
                alt=""
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1.5px solid #001b3a"
                }}
              />
            ) : (
              <span style={{ fontSize: "14px" }}>🐧</span>
            )}
            <span>{currentDisplayName}</span>
          </button>

          <button
            type="button"
            className="cp-btn cp-btn-epf"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={() => setGmModalOpen(true)}
          >
            Mesa EPF
          </button>

          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </header>

      {/* Área Principal do Tabuleiro */}
      <main className="vtt-stage">
        {combinedError && (
          <div
            className="cp-window"
            style={{
              maxWidth: "460px",
              zIndex: 30,
              position: "absolute",
              top: "64px"
            }}
          >
            <div
              className="cp-window-inner"
              style={{ color: "#b71c1c", fontWeight: 700 }}
            >
              {combinedError}
            </div>
          </div>
        )}

        {activeDockModule === "board" && (
          <BoardViewport
            activeScene={activeScene}
            campaignId={campaignId}
            playersMap={campaign?.players || {}}
            isGM={isGM}
            onUpdateSceneGrid={updateScene}
            onOpenScenesManager={() => setScenesModalOpen(true)}
          />
        )}

        {activeDockModule === "journal" && (
          <JournalWorkspace
            campaignId={campaignId}
            currentUserId={user?.uid}
            isGM={isGM}
            playersMap={campaign?.players || {}}
            characters={characters}
            accessibleNotes={accessibleNotes}
            onCreateNote={createNote}
            onUpdateNote={updateNote}
            onUpdateNodePosition={updateNodePosition}
            onCloneNoteToTarget={cloneNoteToTarget}
            onDeleteNote={deleteNote}
            onOpenCharacterSheet={(charId) => setOpenCharacterId(charId)}
          />
        )}

        {/* Alça Lateral (Pull Handle) Estilo Roll20 / Foundry para Puxar o Menu Direito */}
        <button
          type="button"
          className="cp-btn cp-btn-gold"
          onClick={() => setSidebarOpen((prev) => !prev)}
          style={{
            position: "absolute",
            right: "10px",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 28,
            padding: "14px 8px",
            borderRadius: "12px 0 0 12px"
          }}
        >
          {sidebarOpen ? "▶" : "◀"}
        </button>

        {/* Dock Inferior Clássico do Club Penguin */}
        <nav className="vtt-dock">
          <button
            type="button"
            className={`cp-btn ${
              activeDockModule === "board" ? "cp-btn-gold" : ""
            }`}
            onClick={() => setActiveDockModule("board")}
          >
            Tabuleiro
          </button>

          {isGM && (
            <button
              type="button"
              className={`cp-btn ${scenesModalOpen ? "cp-btn-gold" : ""}`}
              onClick={() => setScenesModalOpen(true)}
            >
              Mapas ({scenes.length})
            </button>
          )}

          <button
            type="button"
            className={`cp-btn ${openCharacterId ? "cp-btn-gold" : ""}`}
            onClick={async () => {
              if (activeCharacter) {
                setOpenCharacterId(activeCharacter.id);
              } else {
                const displayName =
                  user?.displayName || user?.email?.split("@")[0] || "Pinguim";
                const createdId = await createCharacter({
                  name: displayName,
                  type: "pc",
                  visibleToAll: true
                });
                if (createdId) {
                  setOpenCharacterId(createdId);
                } else {
                  setSidebarOpen(true);
                  setActiveSidebarTab("sheets");
                }
              }
            }}
          >
            Meu Pinguim
          </button>

          <button
            type="button"
            className={`cp-btn ${compendiumModalOpen ? "cp-btn-gold" : ""}`}
            onClick={() => setCompendiumModalOpen(true)}
          >
            Livro / Compêndio
          </button>

          <button
            type="button"
            className={`cp-btn ${
              activeDockModule === "journal" ? "cp-btn-gold" : ""
            }`}
            onClick={() => setActiveDockModule("journal")}
          >
            Diários & Teia
          </button>
        </nav>
      </main>

      {/* Menu Lateral Direito Puxável (Estilo Roll20 / Foundry) */}
      <aside className={`vtt-sidebar ${sidebarOpen ? "" : "collapsed"}`}>
        <div className="vtt-sidebar-tabs">
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "chat" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("chat")}
          >
            Chat
          </button>
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "sheets" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("sheets")}
          >
            Personagens ({characters.length})
          </button>
          <button
            type="button"
            className={`vtt-tab-btn ${
              activeSidebarTab === "journal" ? "active" : ""
            }`}
            onClick={() => setActiveSidebarTab("journal")}
          >
            Diários ({accessibleNotes.length})
          </button>
        </div>

        <div className="vtt-sidebar-content">
          {activeSidebarTab === "chat" && (
            <ChatSidebarPanel
              messages={messages}
              activeCharacter={activeCharacter}
              rollVisibility={rollVisibility}
              onChangeRollVisibility={setRollVisibility}
              onSendText={sendTextMessage}
              onExecuteRoll={handleExecuteSheetRoll}
              onDeleteMessage={deleteMessage}
              isGM={isGM}
            />
          )}

          {activeSidebarTab === "sheets" && (
            <CharactersSidebarList
              characters={characters}
              campaignId={campaignId}
              isGM={isGM}
              onCreateCharacter={createCharacter}
              onOpenSheet={(charId) => setOpenCharacterId(charId)}
              onSpawnToken={activeScene ? handleSpawnCharacterToken : null}
              onDeleteCharacter={deleteCharacter}
              onOpenCompendium={() => setCompendiumModalOpen(true)}
            />
          )}

          {activeSidebarTab === "journal" && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                height: "100%",
                minHeight: 0
              }}
            >
              <button
                type="button"
                className="cp-btn cp-btn-gold"
                style={{ width: "100%" }}
                onClick={() => setActiveDockModule("journal")}
              >
                Abrir Diários & Teia ({accessibleNotes.length})
              </button>

              <button
                type="button"
                className="cp-btn"
                style={{ width: "100%" }}
                onClick={() => setCompendiumModalOpen(true)}
              >
                Abrir Livro do Mestre
              </button>

              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  paddingRight: "2px"
                }}
              >
                {accessibleNotes.map((note) => {
                  const meta = getNoteTypeMeta(note.noteType);
                  return (
                    <div
                      key={note.id}
                      onClick={() => setActiveDockModule("journal")}
                      style={{
                        background: "#ffffff",
                        border: "2px solid #001b3a",
                        borderLeft: `6px solid ${meta.color}`,
                        borderRadius: "10px",
                        padding: "7px 9px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "2px"
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "12px",
                            color: "#001b3a"
                          }}
                        >
                          {note.title}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 800,
                            color: "#02529c"
                          }}
                        >
                          {meta.singular.toUpperCase()}
                        </span>
                      </div>
                      {Array.isArray(note.aliases) &&
                        note.aliases.length > 0 && (
                          <div
                            style={{
                              fontSize: "10px",
                              color: "#475569",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis"
                            }}
                          >
                            {note.aliases.join(", ")}
                          </div>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Modais Flutuantes */}
      {profileModalOpen && (
        <PlayerProfileModal onClose={() => setProfileModalOpen(false)} />
      )}

      {gmModalOpen && <GMPanelModal onClose={() => setGmModalOpen(false)} />}

      {isGM && scenesModalOpen && (
        <ScenesManagerModal
          scenes={scenes}
          activeSceneId={campaign?.activeSceneId || null}
          campaignId={campaignId}
          onCreateScene={createScene}
          onUpdateScene={updateScene}
          onDeleteScene={deleteScene}
          onActivateScene={activateSceneForTable}
          onClose={() => setScenesModalOpen(false)}
        />
      )}

      {compendiumModalOpen && (
        <CompendiumModal
          entries={compendiumEntries}
          isGM={isGM}
          onCreateEntry={createEntry}
          onUpdateEntry={updateEntry}
          onDeleteEntry={deleteEntry}
          onClose={() => setCompendiumModalOpen(false)}
        />
      )}

      {openedSheetCharacter && (
        <CharacterSheetModal
          character={openedSheetCharacter}
          campaignId={campaignId}
          playersMap={campaign?.players || {}}
          compendiumEntries={compendiumEntries}
          canEdit={canEditCharacter(openedSheetCharacter)}
          isGM={isGM}
          rollVisibility={rollVisibility}
          onChangeRollVisibility={setRollVisibility}
          onUpdateCharacter={updateCharacter}
          onUploadCharacterImage={uploadCharacterImage}
          onExecuteRoll={handleExecuteSheetRoll}
          onSpawnTokenOnMap={
            activeScene ? handleSpawnCharacterToken : null
          }
          onClose={() => setOpenCharacterId(null)}
        />
      )}
    </div>
  );
}
