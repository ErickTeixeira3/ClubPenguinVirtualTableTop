import { useEffect, useRef, useState } from "react";

export default function NoteCloneSelect({
  note,
  isGM,
  currentUserId,
  playersList = [],
  onCloneToTarget
}) {
  const [cloneTarget, setCloneTarget] = useState("");
  const [justCloned, setJustCloned] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (!onCloneToTarget || !note?.id) return null;

  const handleCloneAction = async (targetValue) => {
    if (!targetValue) return;

    if (targetValue === "party") {
      await onCloneToTarget(note, {
        targetScope: "party",
        targetOwnerId: currentUserId
      });
    } else if (targetValue === "gm") {
      await onCloneToTarget(note, {
        targetScope: "gm",
        targetOwnerId: currentUserId
      });
    } else if (targetValue === "my_diary") {
      await onCloneToTarget(note, {
        targetScope: "player",
        targetOwnerId: currentUserId
      });
    } else if (targetValue.startsWith("player:")) {
      const targetUid = targetValue.replace("player:", "");
      await onCloneToTarget(note, {
        targetScope: "player",
        targetOwnerId: targetUid
      });
    }

    setCloneTarget("");
    setJustCloned(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setJustCloned(false), 1400);
  };

  return (
    <select
      className="cp-input"
      style={{
        width: "auto",
        height: "26px",
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 800
      }}
      value={cloneTarget}
      onChange={(e) => handleCloneAction(e.target.value)}
    >
      <option value="">{justCloned ? "✓ Clonado!" : "📑 Clonar Card..."}</option>
      {note?.scope !== "player" && (
        <option value="my_diary">→ Para Meu Diário</option>
      )}
      {note?.scope !== "party" && (
        <option value="party">→ Para Diário do Grupo</option>
      )}
      {isGM && note?.scope !== "gm" && (
        <option value="gm">→ Para Diário do Mestre</option>
      )}
      {isGM &&
        playersList.map((p) => (
          <option key={p.uid} value={`player:${p.uid}`}>
            → Para Diário: {p.displayName}
          </option>
        ))}
    </select>
  );
}
