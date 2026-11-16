/**
 * Fase 5: ações contextuais da aba Inventário (barra superior da gaveta da Ficha),
 * extraídas de CharacterSheetModal.jsx com JSX inalterado.
 */
export default function SheetInventoryToolbar({
  compendiumEntries,
  handlePullFromCompendium,
  itemForm
}) {
  const { setNewItemOpen } = itemForm;
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {compendiumEntries.filter((e) => e.type === "item").length > 0 && (
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
            .filter((e) => e.type === "item")
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
        onClick={() => setNewItemOpen((p) => !p)}
      >
        + Novo Item
      </button>
    </div>
  );
}
