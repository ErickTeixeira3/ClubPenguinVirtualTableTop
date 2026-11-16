import { renderCpFlashIcon } from "../sheets/CpFlashIcons";

/**
 * Balão de fala/emote Club Penguin (apenas apresentação).
 * Visual definido pelas classes `.cp-speech-bubble-*` em src/App.css; a ponta é um SVG
 * com preenchimento branco e bordas cinza (#545454). O tempo de exibição/fade fica com
 * quem usa (ex.: TokenSpeechBubble no tabuleiro).
 */
export default function CpSpeechBubble({
  text = "",
  icon = null,
  isFadingOut = false,
  bottomOffset = 12,
  iconSize = 34,
}) {
  return (
    <div
      className={`cp-speech-bubble-wrapper ${isFadingOut ? "cp-bubble-fade-out" : ""}`}
      style={{
        bottom: `calc(100% + ${bottomOffset}px)`,
      }}
    >
      <div className={`cp-speech-bubble-body ${icon ? "cp-speech-bubble-icon-body" : ""}`}>
        {icon ? (
          <div className="cp-speech-bubble-icon-inner">{renderCpFlashIcon(icon, iconSize)}</div>
        ) : (
          text
        )}
      </div>
      <div className="cp-speech-bubble-tail">
        <svg
          width="18"
          height="12"
          viewBox="0 0 18 12"
          style={{
            display: "block",
            overflow: "visible",
            position: "relative",
            top: "-1.5px",
          }}
        >
          {/* Preenchimento branco para mesclar sem borda com a base do balão */}
          <polygon points="1,-2 17,-2 9,11" fill="#ffffff" />
          {/* Bordas cinzas laterais da ponta do balão */}
          <polyline
            points="1,0 9,11 17,0"
            fill="none"
            stroke="#545454"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
