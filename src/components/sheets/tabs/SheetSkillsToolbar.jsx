/**
 * Fase 5: ações contextuais da aba Skills (barra superior da gaveta da Ficha),
 * extraídas de CharacterSheetModal.jsx com JSX inalterado.
 */
export default function SheetSkillsToolbar({
  compendiumEntries,
  handlePullFromCompendium,
  skillsForm
}) {
  const { resetAbilityForm, newAbilityOpen, setNewAbilityOpen } = skillsForm;
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {compendiumEntries.filter((e) => e.type === "skill" || e.type === "ability").length > 0 && (
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
            const found = compendiumEntries.find(
              (c) => c.id === e.target.value
            );
            if (found) handlePullFromCompendium(found);
            e.target.value = "";
          }}
        >
          <option value="" disabled>
            + Puxar Compêndio...
          </option>
          {compendiumEntries
            .filter((e) => e.type === "skill" || e.type === "ability")
            .map((entry) => (
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
        onClick={() => {
          if (newAbilityOpen) {
            setNewAbilityOpen(false);
            resetAbilityForm();
          } else {
            resetAbilityForm();
            setNewAbilityOpen(true);
          }
        }}
      >
        + Habilidade
      </button>
    </div>
  );
}
