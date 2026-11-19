/**
 * Ações contextuais da aba Inventário (barra superior da gaveta da Ficha).
 */
export default function SheetInventoryToolbar({
  compendiumEntries,
  handlePullFromCompendium,
  onToggleNewItem
}) {
  const items = compendiumEntries.filter((e) => e.type === "item");
  return (
    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
      {items.length > 0 && (
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
          {items.map((entry) => (
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
        onClick={onToggleNewItem}
      >
        + Novo Item
      </button>
    </div>
  );
}
