export default function NoteSectionsEditor({
  sections = [],
  canEdit = false,
  onUpdateTitle,
  onUpdateContent,
  onMoveSection,
  onDeleteSection,
  onAddSection,
  onCaptureSelection
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        flex: 1,
        overflowY: "auto",
        paddingRight: "2px"
      }}
    >
      {sections.map((sec, index) => (
        <div
          key={sec.id || index}
          style={{
            background: "#f8fafc",
            border: "1.5px solid #001b3a",
            borderRadius: "8px",
            padding: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px"
            }}
          >
            <input
              type="text"
              className="cp-input"
              placeholder="Título do Bloco (ex: RESUMO, ATO 1...)"
              value={sec.title || ""}
              disabled={!canEdit}
              onChange={(e) => onUpdateTitle(sec.id, e.target.value)}
              style={{
                height: "28px",
                padding: "2px 8px",
                fontSize: "11px",
                fontWeight: 800,
                flex: 1
              }}
            />

            {canEdit && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <button
                  type="button"
                  className="cp-btn"
                  style={{
                    padding: "2px 6px",
                    fontSize: "10px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center",
                    opacity: index === 0 ? 0.4 : 1,
                    cursor: index === 0 ? "not-allowed" : "pointer"
                  }}
                  disabled={index === 0}
                  onClick={() => onMoveSection(index, -1)}
                  title="Mover para cima"
                >
                  ▲
                </button>

                <button
                  type="button"
                  className="cp-btn"
                  style={{
                    padding: "2px 6px",
                    fontSize: "10px",
                    height: "26px",
                    display: "inline-flex",
                    alignItems: "center",
                    opacity: index === sections.length - 1 ? 0.4 : 1,
                    cursor:
                      index === sections.length - 1 ? "not-allowed" : "pointer"
                  }}
                  disabled={index === sections.length - 1}
                  onClick={() => onMoveSection(index, 1)}
                  title="Mover para baixo"
                >
                  ▼
                </button>

                {sections.length > 1 && (
                  <button
                    type="button"
                    className="cp-btn cp-btn-orange"
                    style={{
                      padding: "2px 6px",
                      fontSize: "10px",
                      height: "26px",
                      display: "inline-flex",
                      alignItems: "center"
                    }}
                    onClick={() => onDeleteSection(sec.id)}
                    title="Remover este bloco"
                  >
                    ✕
                  </button>
                )}
              </div>
            )}
          </div>

          <textarea
            className="cp-input"
            style={{
              minHeight: "100px",
              resize: "vertical",
              lineHeight: 1.5,
              fontSize: "12px",
              padding: "6px 8px"
            }}
            placeholder="Conteúdo deste bloco..."
            value={sec.content || ""}
            disabled={!canEdit}
            onSelect={onCaptureSelection}
            onChange={(e) => onUpdateContent(sec.id, e.target.value)}
          />
        </div>
      ))}

      {canEdit && (
        <button
          type="button"
          className="cp-btn cp-btn-epf"
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            height: "28px",
            alignSelf: "flex-start",
            display: "inline-flex",
            alignItems: "center",
            fontWeight: 800
          }}
          onClick={onAddSection}
        >
          + Adicionar Bloco
        </button>
      )}
    </div>
  );
}
