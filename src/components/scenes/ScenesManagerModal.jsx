import { useEffect, useState } from "react";
import {
  compressImageToWebP,
  formatBytes
} from "../../engines/imageCompressor";
import { DEFAULT_GRID_CONFIG } from "../../hooks/useScenes";
import { useMediaUrl } from "../../hooks/useMediaUrl";

function SceneThumbnail({ scene, campaignId }) {
  const { url, loading } = useMediaUrl(
    scene.mapImage?.mediaId,
    scene.mapImage?.externalUrl,
    campaignId
  );

  return (
    <div
      style={{
        width: "96px",
        height: "64px",
        borderRadius: "10px",
        border: "2px solid var(--cp-blue-border)",
        background: "#06192e",
        overflow: "hidden",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {loading && (
        <span style={{ fontSize: "11px", color: "#90caf9" }}>...</span>
      )}
      {!loading && url && (
        <img
          src={url}
          alt={scene.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      )}
      {!loading && !url && (
        <span style={{ fontSize: "11px", color: "#64748b" }}>Sem imagem</span>
      )}
    </div>
  );
}

export default function ScenesManagerModal({
  scenes = [],
  activeSceneId,
  campaignId,
  isGM = false,
  initialTab = "map",
  onCreateScene,
  onUpdateScene,
  onDeleteScene,
  onActivateScene,
  onClose
}) {
  const [activeTab, setActiveTab] = useState(isGM ? initialTab : "map");

  useEffect(() => {
    setActiveTab(isGM ? initialTab : "map");
  }, [initialTab, isGM]);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const [editingSceneId, setEditingSceneId] = useState(null);
  const [name, setName] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [visibleToPlayers, setVisibleToPlayers] = useState(true);
  const [grid, setGrid] = useState(DEFAULT_GRID_CONFIG);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const resetForm = () => {
    setEditingSceneId(null);
    setName("");
    setExternalUrl("");
    setSelectedFile(null);
    setPreviewInfo(null);
    setVisibleToPlayers(true);
    setGrid(DEFAULT_GRID_CONFIG);
    setErrorMsg("");
  };

  const handleSelectEdit = (scene) => {
    setEditingSceneId(scene.id);
    setName(scene.name || "");
    setExternalUrl(scene.mapImage?.externalUrl || "");
    setSelectedFile(null);
    setPreviewInfo(null);
    setVisibleToPlayers(Boolean(scene.visibleToPlayers));
    setGrid({
      ...DEFAULT_GRID_CONFIG,
      ...(scene.grid || {})
    });
    setErrorMsg("");
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setSelectedFile(file);

    try {
      const compressed = await compressImageToWebP(file, "scene");
      setPreviewInfo(compressed);
      if (!name.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setName(cleanName);
      }
    } catch (err) {
      setErrorMsg(err?.message || "Falha ao processar imagem.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      if (editingSceneId) {
        await onUpdateScene(
          editingSceneId,
          {
            name: name.trim(),
            visibleToPlayers,
            grid,
            ...(externalUrl.trim() ? { externalUrl: externalUrl.trim() } : {})
          },
          selectedFile
        );
      } else {
        const createdId = await onCreateScene({
          name: name.trim(),
          file: selectedFile,
          externalUrl: externalUrl.trim(),
          visibleToPlayers,
          grid
        });
        if (createdId && !activeSceneId) {
          await onActivateScene(createdId);
        }
      }
      resetForm();
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao salvar mapa.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleVisibility = async (scene) => {
    await onUpdateScene(scene.id, {
      visibleToPlayers: !scene.visibleToPlayers
    });
  };

  if (activeTab === "map") {
    return (
      <div
        className="cp-modal-overlay"
        onClick={onClose}
        style={{
          background: "rgba(0, 10, 25, 0.78)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px",
          zIndex: 4000
        }}
      >
        {/* Botão de Alternar para Gerenciador de Cenas para o Mestre */}
        {isGM && (
          <button
            type="button"
            className="cp-btn cp-btn-gold"
            style={{
              position: "fixed",
              top: "16px",
              left: "16px",
              zIndex: 60,
              fontSize: "12px",
              padding: "6px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.6)"
            }}
            onClick={(e) => {
              e.stopPropagation();
              setActiveTab("scenes");
            }}
            title="Ir para o gerenciador de cenas do tabuleiro"
          >
            ⚙️ Gerenciar Cenas & Tabuleiro
          </button>
        )}

        {/* Imagem do Mapa Inteira (sem borda extra) */}
        <div
          style={{
            position: "relative",
            width: "min(1000px, 94vw)",
            maxWidth: "1000px",
            aspectRatio: "1000 / 632",
            maxHeight: "92vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            userSelect: "none"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <img
            src="/Mapa%20Campanhaa.jpg"
            alt="Mapa da Campanha"
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
              filter: "drop-shadow(0 12px 32px rgba(0, 0, 0, 0.75))",
              pointerEvents: "none"
            }}
          />

          {/* Botão de Fechar transparente sobre o (X) desenhado na foto */}
          <button
            type="button"
            onClick={onClose}
            title="Fechar Mapa"
            style={{
              position: "absolute",
              top: "0.8%",
              right: "0.8%",
              width: "4.2%",
              height: "6.6%",
              background: "transparent",
              border: "none",
              borderRadius: "50%",
              cursor: "pointer",
              outline: "none",
              padding: 0,
              zIndex: 10
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="cp-window"
        style={{
          width: "min(1080px, 94vw)",
          maxWidth: "1080px",
          height: "min(760px, 88vh)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
            gap: "10px"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "20px", margin: 0 }}>
            GERENCIADOR DE MAPAS & CENAS
          </h2>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="cp-btn cp-btn-epf"
              style={{
                padding: "5px 12px",
                fontSize: "12px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
              onClick={() => setActiveTab("map")}
              title="Ver o mapa da campanha"
            >
              🗺️ Mapa da Campanha
            </button>

            {activeSceneId && (
              <button
                type="button"
                className="cp-btn cp-btn-epf"
                style={{ padding: "5px 12px", fontSize: "12px" }}
                onClick={() => onActivateScene(null)}
              >
                Recolher Mapa da Mesa
              </button>
            )}

            <button
              type="button"
              className="cp-btn cp-btn-orange"
              style={{
                padding: "4px 10px",
                fontSize: "13px",
                minWidth: "32px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center"
              }}
              onClick={onClose}
              title="Fechar"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Corpo dividido: Formulário (Esquerda) + Lista de Mapas (Direita) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "340px 1fr",
            gap: "12px",
            overflow: "hidden",
            flex: 1,
            minHeight: 0
          }}
        >
          {/* Coluna Esquerda: Criar / Editar Mapa */}
          <form
            onSubmit={handleSubmit}
            className="cp-window-inner"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              overflowY: "auto"
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <strong style={{ fontSize: "15px" }}>
                {editingSceneId ? "Editar Mapa" : "Novo Mapa"}
              </strong>
              {editingSceneId && (
                <button
                  type="button"
                  className="cp-btn"
                  style={{ padding: "3px 10px", fontSize: "11px" }}
                  onClick={resetForm}
                >
                  Novo
                </button>
              )}
            </div>

            <input
              type="text"
              className="cp-input"
              placeholder="Nome do Mapa (ex: Taverna, Caverna)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />

            <label
              className="cp-btn"
              style={{ width: "100%", textAlign: "center" }}
            >
              {selectedFile ? "Trocar Arquivo WebP" : "Selecionar Imagem do Mapa"}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />
            </label>

            {previewInfo && (
              <div
                style={{
                  background: "#ffffff",
                  border: "2px solid var(--cp-blue-border)",
                  borderRadius: "10px",
                  padding: "8px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}
              >
                <img
                  src={previewInfo.dataUrl}
                  alt="Preview"
                  style={{
                    width: "100%",
                    height: "110px",
                    objectFit: "cover",
                    borderRadius: "6px"
                  }}
                />
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: "11px",
                    fontWeight: 800
                  }}
                >
                  <span>
                    {previewInfo.widthPx}x{previewInfo.heightPx}px (WebP)
                  </span>
                  <span style={{ color: "var(--cp-green-dark)" }}>
                    {formatBytes(previewInfo.originalSizeBytes)} →{" "}
                    {formatBytes(previewInfo.sizeBytes)}
                  </span>
                </div>
              </div>
            )}

            <input
              type="url"
              className="cp-input"
              placeholder="Ou URL direta da imagem (opcional)"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
            />

            {/* Controles de Grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px"
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={grid.enabled}
                  onChange={(e) =>
                    setGrid((g) => ({ ...g, enabled: e.target.checked }))
                  }
                />
                Exibir Grid
              </label>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                <input
                  type="checkbox"
                  checked={grid.snapToGrid}
                  onChange={(e) =>
                    setGrid((g) => ({ ...g, snapToGrid: e.target.checked }))
                  }
                />
                Snap ao Grid
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "8px"
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800 }}>
                  Célula (px)
                </div>
                <input
                  type="number"
                  className="cp-input"
                  min={20}
                  max={256}
                  value={grid.cellSizePx}
                  onChange={(e) =>
                    setGrid((g) => ({
                      ...g,
                      cellSizePx: Number(e.target.value)
                    }))
                  }
                />
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 800 }}>
                  Offset X
                </div>
                <input
                  type="number"
                  className="cp-input"
                  value={grid.offsetX}
                  onChange={(e) =>
                    setGrid((g) => ({ ...g, offsetX: Number(e.target.value) }))
                  }
                />
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 800 }}>
                  Offset Y
                </div>
                <input
                  type="number"
                  className="cp-input"
                  value={grid.offsetY}
                  onChange={(e) =>
                    setGrid((g) => ({ ...g, offsetY: Number(e.target.value) }))
                  }
                />
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                alignItems: "center"
              }}
            >
              <div>
                <div style={{ fontSize: "11px", fontWeight: 800 }}>
                  Cor do Grid
                </div>
                <input
                  type="color"
                  className="cp-input"
                  style={{ height: "38px", padding: "4px" }}
                  value={grid.color || "#ffffff"}
                  onChange={(e) =>
                    setGrid((g) => ({ ...g, color: e.target.value }))
                  }
                />
              </div>

              <div>
                <div style={{ fontSize: "11px", fontWeight: 800 }}>
                  Opacidade ({Math.round((grid.opacity ?? 0.28) * 100)}%)
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.9"
                  step="0.05"
                  style={{ width: "100%" }}
                  value={grid.opacity ?? 0.28}
                  onChange={(e) =>
                    setGrid((g) => ({
                      ...g,
                      opacity: Number(e.target.value)
                    }))
                  }
                />
              </div>
            </div>

            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: 800,
                cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={visibleToPlayers}
                onChange={(e) => setVisibleToPlayers(e.target.checked)}
              />
              Liberado para Players
            </label>

            {errorMsg && (
              <div
                style={{
                  background: "#ffebee",
                  border: "2px solid #c62828",
                  color: "#b71c1c",
                  borderRadius: "8px",
                  padding: "6px 10px",
                  fontSize: "12px",
                  fontWeight: 700
                }}
              >
                {errorMsg}
              </div>
            )}

            <button
              type="submit"
              className="cp-btn cp-btn-green"
              disabled={submitting}
              style={{ width: "100%", marginTop: "4px" }}
            >
              {submitting
                ? "Salvando..."
                : editingSceneId
                  ? "Salvar Alterações"
                  : "Criar Mapa"}
            </button>
          </form>

          {/* Coluna Direita: Lista de Mapas Cadastrados */}
          <div
            className="cp-window-inner"
            style={{
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}
          >
            {scenes.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 12px",
                  fontWeight: 700,
                  color: "var(--cp-text-muted)"
                }}
              >
                Nenhum mapa cadastrado.
              </div>
            )}

            {scenes.map((scene) => {
              const isActive = activeSceneId === scene.id;
              return (
                <div
                  key={scene.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                    padding: "10px",
                    borderRadius: "12px",
                    border: isActive
                      ? "3px solid var(--cp-yellow-gold)"
                      : "2px solid var(--cp-blue-border)",
                    background: isActive ? "#fff9db" : "#ffffff"
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minWidth: 0
                    }}
                  >
                    <SceneThumbnail scene={scene} campaignId={campaignId} />

                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          flexWrap: "wrap"
                        }}
                      >
                        <strong style={{ fontSize: "15px" }}>
                          {scene.name}
                        </strong>
                        {isActive && (
                          <span className="cp-badge cp-badge-gm">
                            NO TABULEIRO
                          </span>
                        )}
                        <span className="cp-badge cp-badge-player">
                          {scene.visibleToPlayers ? "VISÍVEL" : "OCULTO"}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--cp-text-muted)",
                          fontWeight: 700
                        }}
                      >
                        {scene.mapImage?.widthPx || 1920}x
                        {scene.mapImage?.heightPx || 1080}px • Grid{" "}
                        {scene.grid?.cellSizePx || 64}px
                        {scene.mapImage?.sizeBytes
                          ? ` • ${formatBytes(scene.mapImage.sizeBytes)}`
                          : ""}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexShrink: 0,
                      flexWrap: "wrap",
                      justifyContent: "flex-end"
                    }}
                  >
                    <button
                      type="button"
                      className={`cp-btn ${
                        isActive ? "cp-btn-orange" : "cp-btn-gold"
                      }`}
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() =>
                        onActivateScene(isActive ? null : scene.id)
                      }
                    >
                      {isActive ? "Tirar" : "Ativar"}
                    </button>

                    <button
                      type="button"
                      className="cp-btn"
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() => handleSelectEdit(scene)}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="cp-btn cp-btn-epf"
                      style={{ padding: "5px 10px", fontSize: "11px" }}
                      onClick={() => handleToggleVisibility(scene)}
                    >
                      {scene.visibleToPlayers ? "Ocultar" : "Liberar"}
                    </button>

                    <button
                      type="button"
                      className="cp-btn cp-btn-orange"
                      style={{ padding: "5px 10px", fontSize: "12px" }}
                      onClick={() => onDeleteScene(scene.id)}
                    >
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

