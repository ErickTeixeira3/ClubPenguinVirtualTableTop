import { useEffect, useRef } from "react";
import { CP_FLASH_ICONS } from "../sheets/CpFlashIcons";

export default function EmotePickerMenu({ onSelectEmote, onClose }) {
  const containerRef = useRef(null);

  // Fecha ao clicar fora do componente
  useEffect(() => {
    const handlePointerDownOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handlePointerDownOutside);
    return () => {
      document.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={containerRef}
      className="cp-emote-popup"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="cp-emote-scroll-container">
        <div className="cp-emote-grid">
          {CP_FLASH_ICONS.map((emote) => (
            <button
              key={emote.id}
              type="button"
              className="cp-emote-slot"
              onClick={() => onSelectEmote(emote)}
              title={emote.label}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none"
                }}
              >
                {emote.render(30)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Seta indicadora apontando para o botão da dock */}
      <div className="cp-hotbar-arrow">
        <svg width="18" height="10" viewBox="0 0 18 10" style={{ display: "block" }}>
          <polygon points="1,-2 17,-2 9,10" fill="#ffffff" />
          <polyline
            points="1,0 9,10 17,0"
            fill="none"
            stroke="#001b3a"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}

