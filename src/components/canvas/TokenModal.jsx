import { useState } from "react";
import {
  compressImageToWebP,
  formatBytes
} from "../../engines/imageCompressor";

const CP_PENGUIN_COLORS = [
  "#3090f0",
  "#02529c",
  "#e53935",
  "#38c172",
  "#ffcc00",
  "#ff6b2b",
  "#8e24aa",
  "#ec407a",
  "#00bcd4",
  "#1a202c"
];

export default function TokenModal({
  initialToken = null,
  defaultLayer = "tokens",
  playersMap = {},
  isGM,
  onSave,
  onDelete,
  onClose
}) {
  const [name, setName] = useState(initialToken?.name || "");
  const [layer, setLayer] = useState(
    initialToken?.layer || (isGM ? defaultLayer : "tokens")
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [externalUrl, setExternalUrl] = useState(
    initialToken?.externalUrl || ""
  );
  const [sizeInCells, setSizeInCells] = useState(
    initialToken?.sizeInCells || 1
  );
  const [ringColor, setRingColor] = useState(
    initialToken?.ringColor || "#3090f0"
  );
  const [visibleToPlayers, setVisibleToPlayers] = useState(
    initialToken ? initialToken.visibleToPlayers !== false : true
  );
  const [showName, setShowName] = useState(
    initialToken ? initialToken.showName !== false : true
  );
  const [hpCurrent, setHpCurrent] = useState(
    initialToken?.hpCurrent ?? ""
  );
  const [hpMax, setHpMax] = useState(initialToken?.hpMax ?? "");
  const [defense, setDefense] = useState(initialToken?.defense ?? 10);
  const [showBarsToPlayers, setShowBarsToPlayers] = useState(
    initialToken ? initialToken.showBarsToPlayers !== false : true
  );
  const [controlledBy, setControlledBy] = useState(
    Array.isArray(initialToken?.controlledBy)
      ? initialToken.controlledBy
      : ["ALL"]
  );
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const playersList = Object.values(playersMap || {});

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg("");
    setSelectedFile(file);

    try {
      const compressed = await compressImageToWebP(file, "token");
      setPreviewInfo(compressed);
      if (!name.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, "");
        setName(cleanName);
      }
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao comprimir token.");
    }
  };

  const toggleController = (uidOrAll) => {
    if (uidOrAll === "ALL") {
      setControlledBy((prev) => (prev.includes("ALL") ? [] : ["ALL"]));
      return;
    }

    setControlledBy((prev) => {
      const withoutAll = prev.filter((id) => id !== "ALL");
      if (withoutAll.includes(uidOrAll)) {
        return withoutAll.filter((id) => id !== uidOrAll);
      }
      return [...withoutAll, uidOrAll];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setErrorMsg("");
    try {
      await onSave(
        {
          name: name.trim(),
          layer: isGM ? layer : "tokens",
          externalUrl: externalUrl.trim() || null,
          sizeInCells: Number(sizeInCells) || 1,
          ringColor,
          visibleToPlayers,
          showName,
          controlledBy,
          hpCurrent: hpCurrent !== "" ? Number(hpCurrent) : null,
          hpMax: hpMax !== "" ? Number(hpMax) : null,
          defense: defense !== "" ? Number(defense) : 10,
          showBarsToPlayers
        },
        selectedFile
      );
      onClose();
    } catch (err) {
      setErrorMsg(err?.message || "Erro ao salvar token.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cp-modal-overlay" onClick={onClose}>
      <div
        className="cp-window"
        style={{ width: "100%", maxWidth: "460px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <h2 className="cp-title" style={{ fontSize: "20px" }}>
            {initialToken ? "CONFIGURAR TOKEN" : "NOVO TOKEN NO MAPA"}
          </h2>
          <button
            type="button"
            className="cp-btn cp-btn-orange"
            style={{ padding: "4px 12px", fontSize: "13px" }}
            onClick={onClose}
          >
            X
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="cp-window-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            maxHeight: "80vh",
            overflowY: "auto"
          }}
        >
          <input
            type="text"
            className="cp-input"
            placeholder="Nome do Token"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label className="cp-btn" style={{ width: "100%" }}>
            {selectedFile ? "Trocar Imagem WebP" : "Selecionar Imagem do Token"}
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
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "#ffffff",
                padding: "8px",
                borderRadius: "10px",
                border: "2px solid var(--cp-blue-border)"
              }}
            >
              <img
                src={previewInfo.dataUrl}
                alt="Preview"
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `3px solid ${ringColor}`
                }}
              />
              <div style={{ fontSize: "12px", fontWeight: 800 }}>
                <div>
                  {previewInfo.widthPx}x{previewInfo.heightPx}px (WebP)
                </div>
                <div style={{ color: "var(--cp-green-dark)" }}>
                  {formatBytes(previewInfo.originalSizeBytes)} →{" "}
                  {formatBytes(previewInfo.sizeBytes)}
                </div>
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

          {/* Cor do Anel e Tamanho */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px"
            }}
          >
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {CP_PENGUIN_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setRingColor(color)}
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "50%",
                    background: color,
                    border:
                      ringColor === color
                        ? "3px solid #ffffff"
                        : "2px solid #001b3a",
                    boxShadow:
                      ringColor === color ? "0 0 0 2px #001b3a" : "none",
                    cursor: "pointer"
                  }}
                />
              ))}
            </div>

            <select
              className="cp-input"
              style={{ width: "110px" }}
              value={sizeInCells}
              onChange={(e) => setSizeInCells(Number(e.target.value))}
            >
              <option value={1}>1x1</option>
              <option value={2}>2x2</option>
              <option value={3}>3x3</option>
              <option value={4}>4x4</option>
            </select>
          </div>

          {/* Barra de Vida (HP) e Defesa */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px"
            }}
          >
            <input
              type="number"
              className="cp-input"
              placeholder="HP Atual"
              value={hpCurrent}
              onChange={(e) => setHpCurrent(e.target.value)}
            />
            <input
              type="number"
              className="cp-input"
              placeholder="HP Máximo"
              value={hpMax}
              onChange={(e) => setHpMax(e.target.value)}
            />
            <input
              type="number"
              className="cp-input"
              placeholder="Defesa"
              title="Defesa"
              value={defense}
              onChange={(e) => setDefense(e.target.value)}
            />
          </div>

          {isGM && (
            <>
              <select
                className="cp-input"
                value={layer}
                onChange={(e) => setLayer(e.target.value)}
              >
                <option value="tokens">Camada: Tokens (Padrão)</option>
                <option value="objects">Camada: Objetos / Obstáculos</option>
                <option value="map">Camada: Mapa & Fundo</option>
              </select>

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
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={visibleToPlayers}
                    onChange={(e) => setVisibleToPlayers(e.target.checked)}
                  />
                  Visível aos Players
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={(e) => setShowName(e.target.checked)}
                  />
                  Exibir Nome
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "13px",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showBarsToPlayers}
                    onChange={(e) => setShowBarsToPlayers(e.target.checked)}
                  />
                  HP Visível
                </label>
              </div>

              {/* Permissões de Controle do Token */}
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
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={controlledBy.includes("ALL")}
                    onChange={() => toggleController("ALL")}
                  />
                  Todos os Players podem mover
                </label>

                {!controlledBy.includes("ALL") &&
                  playersList.map((p) => (
                    <label
                      key={p.uid}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={controlledBy.includes(p.uid)}
                        onChange={() => toggleController(p.uid)}
                      />
                      {p.displayName}
                    </label>
                  ))}
              </div>
            </>
          )}

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

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            {initialToken && isGM && onDelete && (
              <button
                type="button"
                className="cp-btn cp-btn-orange"
                onClick={async () => {
                  await onDelete(initialToken.id);
                  onClose();
                }}
              >
                Remover
              </button>
            )}

            <button
              type="submit"
              className="cp-btn cp-btn-green"
              disabled={submitting}
              style={{ flex: 1 }}
            >
              {submitting
                ? "Salvando..."
                : initialToken
                  ? "Salvar Token"
                  : "Colocar no Mapa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

