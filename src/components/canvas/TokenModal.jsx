import { useReducer } from "react";
import { TOKEN_KINDS } from "../../domain/constants.js";
import { DEFAULT_FREE_TOKEN_DEFENSE } from "../../domain/defaults.js";
import { toControlledByMap } from "../../domain/permissions.js";
import { useTokenImageCompression } from "../../hooks/useTokenImageCompression.js";
import CPButton from "../ui/CPButton.jsx";
import WindowModal from "../ui/WindowModal.jsx";
import { TOKEN_RING_COLORS } from "./boardConstants.js";
import ColorSwatchGrid from "./ColorSwatchGrid.jsx";
import {
  createInitialTokenModalState,
  tokenModalReducer
} from "./tokenModalState.js";

export default function TokenModal({
  initialToken = null,
  initialSecret = null,
  linkedCharacter = null,
  defaultLayer = "tokens",
  playersMap = {},
  isGM = false,
  canDelete = isGM,
  onSave,
  onDelete,
  onClose
}) {
  const [state, dispatch] = useReducer(
    tokenModalReducer,
    { initialToken, initialSecret, linkedCharacter, defaultLayer, isGM },
    createInitialTokenModalState
  );
  const { compressing, compressFile } = useTokenImageCompression();

  const playersList = Object.values(playersMap || {});
  const isEditing = Boolean(initialToken);
  const isPcToken = initialToken?.kind === TOKEN_KINDS.PC;
  const canEditStats = isGM || !isEditing || isPcToken;

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressFile(file);
    if (!compressed) return;
    const cleanName = file.name.replace(/\.[^/.]+$/, "");
    dispatch({ type: "SET_IMAGE", compressed, fallbackName: cleanName });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.label.trim()) return;

    dispatch({ type: "SUBMIT_START" });
    try {
      const hp =
        state.hpCurrent !== "" || state.hpMax !== ""
          ? {
              current: Math.max(0, Number(state.hpCurrent !== "" ? state.hpCurrent : state.hpMax) || 0),
              max: Math.max(0, Number(state.hpMax !== "" ? state.hpMax : state.hpCurrent) || 0)
            }
          : null;
      const mp =
        state.mpCurrent !== "" || state.mpMax !== ""
          ? {
              current: Math.max(0, Number(state.mpCurrent !== "" ? state.mpCurrent : state.mpMax) || 0),
              max: Math.max(0, Number(state.mpMax !== "" ? state.mpMax : state.mpCurrent) || 0)
            }
          : null;

      await onSave(
        {
          label: state.label.trim(),
          layer: isGM ? state.layer : "tokens",
          externalUrl: state.externalUrl.trim() || null,
          imageCleared: Boolean(state.imageCleared),
          sizeInCells: Number(state.sizeInCells) || 1,
          ringColor: state.ringColor,
          hidden: isGM ? Boolean(state.hidden) : false,
          showName: Boolean(state.showName),
          controlledBy: toControlledByMap(state.controlledBy),
          hp,
          mp,
          defense:
            state.defense !== "" ? Math.max(0, Number(state.defense) || 0) : DEFAULT_FREE_TOKEN_DEFENSE,
          showBarsToPlayers: Boolean(state.showBarsToPlayers)
        },
        state.compressedImage
      );
      dispatch({ type: "SUBMIT_DONE" });
      onClose();
    } catch (err) {
      dispatch({
        type: "SUBMIT_ERROR",
        message: err?.message || "Erro ao salvar token."
      });
    }
  };

  return (
    <WindowModal variant="cp" maxWidth="460px" onClose={onClose}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <h2 className="cp-title" style={{ fontSize: "20px", margin: 0 }}>
          {isEditing ? "CONFIGURAR TOKEN" : "NOVO TOKEN NO MAPA"}
        </h2>
        <CPButton
          variant="orange"
          style={{ padding: "4px 12px", fontSize: "13px" }}
          onClick={onClose}
        >
          X
        </CPButton>
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
          value={state.label}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "label", value: e.target.value })
          }
          required
        />

        <label className="cp-btn" style={{ width: "100%" }}>
          {compressing
            ? "Comprimindo..."
            : state.compressedImage
              ? "Trocar Imagem WebP"
              : "Selecionar Imagem do Token"}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
        </label>

        {state.compressedImage && (
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
              src={state.compressedImage.dataUrl}
              alt="Preview"
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                objectFit: "cover",
                border: `3px solid ${state.ringColor}`
              }}
            />
            <div style={{ fontSize: "12px", fontWeight: 800 }}>
              <div>
                {state.compressedImage.widthPx}x{state.compressedImage.heightPx}px (WebP)
              </div>
              <div style={{ color: "var(--cp-green-dark)" }}>
                {state.compressedImage.formattedSize}
              </div>
            </div>
          </div>
        )}

        <input
          type="url"
          className="cp-input"
          placeholder="Ou URL direta da imagem (opcional)"
          value={state.externalUrl}
          onChange={(e) =>
            dispatch({ type: "SET_FIELD", field: "externalUrl", value: e.target.value })
          }
        />

        {(state.hasExistingImage || state.compressedImage || state.externalUrl.trim()) &&
          !state.imageCleared && (
            <CPButton
              type="button"
              variant="orange"
              style={{ padding: "4px 10px", fontSize: "12px" }}
              onClick={() => dispatch({ type: "CLEAR_IMAGE" })}
            >
              Remover Imagem
            </CPButton>
          )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px"
          }}
        >
          <ColorSwatchGrid
            colors={TOKEN_RING_COLORS}
            selectedColor={state.ringColor}
            onSelect={(color) =>
              dispatch({ type: "SET_FIELD", field: "ringColor", value: color })
            }
            shape="circle"
            size={24}
            keyPrefix="ring"
            ariaLabelPrefix="Cor do anel"
          />

          <select
            className="cp-input"
            style={{ width: "110px" }}
            value={state.sizeInCells}
            onChange={(e) =>
              dispatch({
                type: "SET_FIELD",
                field: "sizeInCells",
                value: Number(e.target.value)
              })
            }
          >
            <option value={1}>1x1</option>
            <option value={2}>2x2</option>
            <option value={3}>3x3</option>
            <option value={4}>4x4</option>
          </select>
        </div>

        {canEditStats && (
          <>
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
                value={state.hpCurrent}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "hpCurrent", value: e.target.value })
                }
              />
              <input
                type="number"
                className="cp-input"
                placeholder="HP Máximo"
                value={state.hpMax}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "hpMax", value: e.target.value })
                }
              />
              <input
                type="number"
                className="cp-input"
                placeholder="Defesa"
                title="Defesa"
                value={state.defense}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "defense", value: e.target.value })
                }
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px"
              }}
            >
              <input
                type="number"
                className="cp-input"
                placeholder="MP Atual"
                value={state.mpCurrent}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "mpCurrent", value: e.target.value })
                }
              />
              <input
                type="number"
                className="cp-input"
                placeholder="MP Máximo"
                value={state.mpMax}
                onChange={(e) =>
                  dispatch({ type: "SET_FIELD", field: "mpMax", value: e.target.value })
                }
              />
            </div>
          </>
        )}

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
            checked={state.showName}
            onChange={(e) =>
              dispatch({ type: "SET_FIELD", field: "showName", value: e.target.checked })
            }
          />
          Exibir Nome
        </label>

        {isGM && (
          <>
            <select
              className="cp-input"
              value={state.layer}
              onChange={(e) =>
                dispatch({ type: "SET_FIELD", field: "layer", value: e.target.value })
              }
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
                  checked={!state.hidden}
                  onChange={(e) =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "hidden",
                      value: !e.target.checked
                    })
                  }
                />
                Visível aos Players
              </label>

              {!isPcToken && (
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
                    checked={state.showBarsToPlayers}
                    onChange={(e) =>
                      dispatch({
                        type: "SET_FIELD",
                        field: "showBarsToPlayers",
                        value: e.target.checked
                      })
                    }
                  />
                  HP Visível
                </label>
              )}
            </div>

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
                  checked={state.controlledBy.includes("ALL")}
                  onChange={() =>
                    dispatch({ type: "TOGGLE_CONTROLLER", uidOrAll: "ALL" })
                  }
                />
                Todos os Players podem mover
              </label>

              {!state.controlledBy.includes("ALL") &&
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
                      checked={state.controlledBy.includes(p.uid)}
                      onChange={() =>
                        dispatch({ type: "TOGGLE_CONTROLLER", uidOrAll: p.uid })
                      }
                    />
                    {p.displayName}
                  </label>
                ))}
            </div>
          </>
        )}

        {state.errorMsg && (
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
            {state.errorMsg}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          {isEditing && canDelete && onDelete && (
            <CPButton
              variant="orange"
              onClick={async () => {
                await onDelete(initialToken);
                onClose();
              }}
            >
              Remover
            </CPButton>
          )}

          <CPButton
            type="submit"
            variant="green"
            disabled={state.submitting || compressing}
            style={{ flex: 1 }}
          >
            {state.submitting
              ? "Salvando..."
              : isEditing
                ? "Salvar Token"
                : "Colocar no Mapa"}
          </CPButton>
        </div>
      </form>
    </WindowModal>
  );
}
