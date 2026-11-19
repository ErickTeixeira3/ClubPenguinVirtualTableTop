/**
 * Ações contextuais da aba Skills (barra superior da gaveta da Ficha).
 * FUN-08: inclui magias (`type === "spell"`) junto de perícias e habilidades.
 */
export default function SheetSkillsToolbar({
  compendiumEntries,
  handlePullFromCompendium,
  onToggleNewAbility
}) {
  const skillEntries = compendiumEntries.filter(
    (e) => e.type === "skill" || e.type === "ability" || e.type === "spell"
  );
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {skillEntries.length > 0 && (
        <select
          className="cp-input"
          style={{
            width: "160px",
            padding: "2px 6px",
            fontSize: "11px",
            height: "26px"
          }}
          defaultValue=""
          onChange={(e) => {
            const found = compendiumEntries.find((c) => c.id === e.target.value);
            if (found) handlePullFromCompendium(found);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            + Puxar Compêndio...
          </option>
          {skillEntries.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        className="cp-btn cp-btn-green"
        style={{ padding: "3px 10px", fontSize: "11px", height: "26px" }}
        onClick={onToggleNewAbility}
      >
        + Habilidade
      </button>
    </div>
  );
}
