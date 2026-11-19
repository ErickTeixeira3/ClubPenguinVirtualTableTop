import { useEffect, useMemo, useReducer, useRef } from "react";
import { Z_LAYERS } from "../../constants/zLayers";
import { RESERVED_FORMULA_KEYS } from "../../domain/constants.js";
import { isReleasedToPlayers } from "../../domain/permissions.js";
import {
  EFFECT_TYPES,
  SKILL_AOE_TYPES,
  SKILL_RANGE_TYPES,
  TRIGGER_TYPES
} from "../../engines/combatEngine";
import { mapCompendiumEntryToCharacterEntry } from "../../engines/compendium";
import { inferAbilityRollKind } from "../../engines/rolls";
import { renderCpFlashIcon } from "../sheets/CpFlashIcons";
import CpIconPicker from "../sheets/CpIconPicker";
import ConfirmDialog from "../ui/ConfirmDialog";
import SavingThrowFields from "../ui/SavingThrowFields";
import WindowModal from "../ui/WindowModal";
import {
  compendiumReducer,
  createInitialCompendiumState
} from "./compendiumReducer";

const ELEMENT_COLORS = [
  { color: "#e53935", label: "Fogo" },
  { color: "#1e88e5", label: "Água" },
  { color: "#00bcd4", label: "Neve" },
  { color: "#fdd835", label: "Ouro" },
  { color: "#6a1b9a", label: "Sombra" },
  { color: "#38c172", label: "Natureza" }
];

const TYPE_LABELS = {
  ability: "HABILIDADE",
  spell: "MAGIA",
  skill: "PERÍCIA",
  item: "ITEM"
};

export default function CompendiumModal({
  entries,
  isGM,
  characters = [],
  activeCharacter = null,
  canEditCharacter,
  onUpdateCharacter,
  onAddCharacterEntry = null,
  onPullCompendiumEntry = null,
  onCreateEntry,
  onUpdateEntry,
  onDeleteEntry,
  onClose
}) {
  const userCharacters = useMemo(() => {
    if (!characters) return [];
    if (isGM) return characters;
    return characters.filter((c) => Boolean(canEditCharacter?.(c)));
  }, [characters, isGM, canEditCharacter]);

  const [state, dispatch] = useReducer(
    compendiumReducer,
    activeCharacter?.id || userCharacters[0]?.id || "",
    createInitialCompendiumState
  );

  const feedbackTimersRef = useRef(new Map());
  useEffect(() => {
    const timers = feedbackTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
  }, []);

  const { filterType, search, selectedTargetCharId, addedFeedback, confirmDeleteEntry, form } = state;

  const setFormField = (field, value) =>
    dispatch({ type: "SET_FORM_FIELD", field, value });

  const handleAddToCharacter = async (entry) => {
    const targetChar =
      userCharacters.find((c) => c.id === selectedTargetCharId) ||
      activeCharacter ||
      userCharacters[0];
    if (!targetChar) return;

    try {
      if (onPullCompendiumEntry) {
        await onPullCompendiumEntry(targetChar.id, entry);
      } else {
        const existingAttrs = Array.isArray(targetChar.attributes)
          ? targetChar.attributes.map((a) => a.key)
          : Object.keys(targetChar.attributes || {});
        const existingSkills = Array.isArray(targetChar.skills)
          ? targetChar.skills.map((s) => s.key || s.id)
          : Object.keys(targetChar.skills || {});

        const orderCount =
          entry.type === "item"
            ? Array.isArray(targetChar.inventory)
              ? targetChar.inventory.length
              : Object.keys(targetChar.inventory || {}).length
            : entry.type === "skill"
              ? existingSkills.length
              : Array.isArray(targetChar.abilities)
                ? targetChar.abilities.length
                : Object.keys(targetChar.abilities || {}).length;

        const mapped = mapCompendiumEntryToCharacterEntry(entry, {
          createId: (prefix) =>
            `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          existingKeys: [...existingAttrs, ...existingSkills, ...RESERVED_FORMULA_KEYS],
          existingOrder: orderCount
        });

        if (onAddCharacterEntry) {
          await onAddCharacterEntry(targetChar.id, mapped.collection, {
            ...mapped.entry,
            allowFallbackAttribute: true
          });
        } else if (onUpdateCharacter) {
          await onUpdateCharacter(targetChar.id, {
            [`${mapped.collection}.${mapped.entryKey}`]: mapped.entry
          });
        }
      }

      const existingTimer = feedbackTimersRef.current.get(entry.id);
      if (existingTimer) clearTimeout(existingTimer);
      dispatch({ type: "SET_ADDED_FEEDBACK", entryId: entry.id, active: true });
      const nextTimer = setTimeout(() => {
        feedbackTimersRef.current.delete(entry.id);
        dispatch({ type: "SET_ADDED_FEEDBACK", entryId: entry.id, active: false });
      }, 2000);
      feedbackTimersRef.current.set(entry.id, nextTimer);
    } catch {
      // Erro já notificado pelo hook
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !isGM) return;

    const hitFormula = form.hitFormula.trim();
    const effectFormula = form.effectFormula.trim();
    const rollKind =
      form.type === "skill"
        ? "check"
        : inferAbilityRollKind({
            hitFormula,
            effectFormula,
            effectType: form.effectType
          });

    const payload = {
      name: form.name.trim(),
      type: form.type,
      category: form.category.trim(),
      icon: form.icon || "sword",
      elementColor: form.elementColor,
      cost: {
        resource: form.costResource,
        amount: Math.max(0, Number(form.costAmount) || 0)
      },
      hitFormula,
      effectFormula,
      rollKind,
      trigger: form.trigger,
      effectType: form.effectType,
      range: {
        type: form.rangeType,
        distanceMeters:
          form.rangeType === "ranged"
            ? Math.max(0, Number(form.rangeMeters) || 0)
            : 0
      },
      aoe: {
        type: form.aoeType,
        radiusMeters:
          form.aoeType !== "single"
            ? Math.max(1, Number(form.aoeRadiusMeters) || 1)
            : 0,
        coneAngleDeg:
          form.aoeType === "cone"
            ? Number(form.aoeConeAngleDeg) === 60
              ? 60
              : 45
            : 45
      },
      savingThrow: {
        enabled: Boolean(form.saveEnabled),
        dcFormula: form.saveDcFormula.trim() || "12",
        attributeKey: form.saveAttributeKey || "resistencia",
        effectDescription: form.saveEffectDesc.trim()
      },
      bonus: Number(form.bonus) || 0,
      attributeKey: form.attributeKey || "forca",
      description: form.description.trim(),
      isPublic: form.isPublic
    };

    try {
      if (form.editingId) {
        await onUpdateEntry(form.editingId, payload);
      } else {
        await onCreateEntry(payload);
      }
      dispatch({ type: "RESET_FORM" });
    } catch (err) {
      dispatch({
        type: "SET_FORM_ERROR",
        error: err?.message || "Erro ao salvar item do compêndio."
      });
    }
  };

  const filteredEntries = (entries || []).filter((e) => {
    if (filterType !== "ALL" && e.type !== filterType) return false;
    if (
      search.trim() &&
      !(e.name || "").toLowerCase().includes(search.trim().toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <WindowModal
      variant="cp"
      onClose={onClose}
      maxWidth={isGM ? "920px" : "680px"}
      panelStyle={{ maxHeight: "90vh", overflow: "hidden" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <h2 className="cp-title" style={{ fontSize: "22px" }}>
          LIVRO DO MESTRE & COMPÊNDIO CARD-JITSU
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: isGM ? "320px 1fr" : "1fr",
          gap: "12px",
          overflow: "hidden",
          flex: 1
        }}
      >
        {isGM && (
          <form
            onSubmit={handleSubmit}
            className="cp-window-inner"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              overflowY: "auto"
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}
            >
              <strong style={{ fontSize: "14px" }}>
                {form.editingId ? "Editar Card" : "Novo Card do Sistema"}
              </strong>
              {form.editingId && (
                <button
                  type="button"
                  className="cp-btn"
                  style={{ padding: "2px 8px", fontSize: "11px" }}
                  onClick={() => dispatch({ type: "RESET_FORM" })}
                >
                  Novo
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => setFormField("showIconPicker", !form.showIconPicker)}
                title="Escolher Ícone"
                style={{
                  width: "36px",
                  height: "32px",
                  background: "#ffffff",
                  border: "1.5px solid #7a8c9e",
                  borderRadius: "8px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  flexShrink: 0
                }}
              >
                {renderCpFlashIcon(form.icon, 24)}
              </button>
              <input
                type="text"
                className="cp-input"
                placeholder="Nome (ex: Bola de Fogo, Espada)"
                value={form.name}
                onChange={(e) => setFormField("name", e.target.value)}
                required
                style={{ flex: 1 }}
              />
            </div>

            {form.showIconPicker && (
              <CpIconPicker
                selectedIconId={form.icon}
                onSelectIcon={(ic) => {
                  setFormField("icon", ic);
                  setFormField("showIconPicker", false);
                }}
                onClose={() => setFormField("showIconPicker", false)}
              />
            )}

            <select
              className="cp-input"
              value={form.type}
              onChange={(e) => setFormField("type", e.target.value)}
            >
              <option value="ability">Habilidade</option>
              <option value="spell">Magia / Técnica</option>
              <option value="skill">Perícia</option>
              <option value="item">Item / Equipamento</option>
            </select>

            <div style={{ display: "flex", gap: "6px" }}>
              {ELEMENT_COLORS.map((el) => (
                <button
                  key={el.color}
                  type="button"
                  onClick={() => setFormField("elementColor", el.color)}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    background: el.color,
                    border:
                      form.elementColor === el.color
                        ? "3px solid #001b3a"
                        : "1.5px solid #ffffff",
                    cursor: "pointer"
                  }}
                />
              ))}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "6px"
              }}
            >
              <select
                className="cp-input"
                value={form.costResource}
                onChange={(e) => setFormField("costResource", e.target.value)}
              >
                <option value="mp">Custo MP</option>
                <option value="hp">Custo HP</option>
              </select>
              <input
                type="number"
                className="cp-input"
                min={0}
                placeholder="Valor Custo"
                value={form.costAmount}
                onChange={(e) => setFormField("costAmount", e.target.value)}
              />
            </div>

            {form.type === "skill" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: "6px" }}>
                <input
                  type="text"
                  className="cp-input"
                  placeholder="Chave do Atributo (ex: forca)"
                  value={form.attributeKey}
                  onChange={(e) => setFormField("attributeKey", e.target.value)}
                />
                <input
                  type="number"
                  className="cp-input"
                  placeholder="Bônus"
                  value={form.bonus}
                  onChange={(e) => setFormField("bonus", e.target.value)}
                />
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="cp-input"
                  placeholder="Fórmula Principal (ex: 1d20 + @forca)"
                  value={form.hitFormula}
                  onChange={(e) => setFormField("hitFormula", e.target.value)}
                />

                <input
                  type="text"
                  className="cp-input"
                  placeholder="Fórmula Dano/Efeito (ex: 2d6 + @forca)"
                  value={form.effectFormula}
                  onChange={(e) => setFormField("effectFormula", e.target.value)}
                />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  <select
                    className="cp-input"
                    value={form.trigger}
                    onChange={(e) => setFormField("trigger", e.target.value)}
                    style={{ fontSize: "11px" }}
                  >
                    {TRIGGER_TYPES.map((tr) => (
                      <option key={tr.id} value={tr.id}>
                        {tr.label}
                      </option>
                    ))}
                  </select>
                  <select
                    className="cp-input"
                    value={form.effectType}
                    onChange={(e) => setFormField("effectType", e.target.value)}
                    style={{ fontSize: "11px" }}
                  >
                    {EFFECT_TYPES.map((et) => (
                      <option key={et.id} value={et.id}>
                        {et.label}
                      </option>
                    ))}
                  </select>
                </div>

                {(form.type === "ability" || form.type === "spell") && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="cp-input"
                        value={form.rangeType}
                        onChange={(e) => setFormField("rangeType", e.target.value)}
                        style={{ fontSize: "11px", flex: 1 }}
                      >
                        {SKILL_RANGE_TYPES.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.label}
                          </option>
                        ))}
                      </select>
                      {form.rangeType === "ranged" && (
                        <input
                          type="number"
                          className="cp-input"
                          min={0}
                          value={form.rangeMeters}
                          onChange={(e) => setFormField("rangeMeters", e.target.value)}
                          style={{ width: "52px", fontSize: "11px" }}
                          title="Alcance em metros"
                        />
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "4px" }}>
                      <select
                        className="cp-input"
                        value={form.aoeType}
                        onChange={(e) => setFormField("aoeType", e.target.value)}
                        style={{ fontSize: "11px", flex: 1 }}
                      >
                        {SKILL_AOE_TYPES.map((at) => (
                          <option key={at.id} value={at.id}>
                            {at.label}
                          </option>
                        ))}
                      </select>
                      {form.aoeType !== "single" && (
                        <input
                          type="number"
                          className="cp-input"
                          min={1}
                          value={form.aoeRadiusMeters}
                          onChange={(e) => setFormField("aoeRadiusMeters", e.target.value)}
                          style={{ width: "52px", fontSize: "11px" }}
                          title="Raio/Tamanho em metros"
                        />
                      )}
                    </div>
                  </div>
                )}

                <SavingThrowFields
                  layout="grid"
                  enabled={form.saveEnabled}
                  onEnabledChange={(val) => setFormField("saveEnabled", val)}
                  dcFormula={form.saveDcFormula}
                  onDcFormulaChange={(val) => setFormField("saveDcFormula", val)}
                  attributeKey={form.saveAttributeKey}
                  onAttributeKeyChange={(val) => setFormField("saveAttributeKey", val)}
                  effectDescription={form.saveEffectDesc}
                  onEffectDescriptionChange={(val) => setFormField("saveEffectDesc", val)}
                  toggleLabel="Exige Teste de Resistência"
                  dcPlaceholder="CD (ex: 14 ou 10+@forca)"
                  effectPlaceholder="Efeito na falha (ex: Derrubado)"
                />
              </>
            )}

            <textarea
              className="cp-input"
              rows={3}
              placeholder="Descrição / Regras"
              value={form.description}
              onChange={(e) => setFormField("description", e.target.value)}
            />

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
                checked={form.isPublic}
                onChange={(e) => setFormField("isPublic", e.target.checked)}
              />
              Liberado para os Players
            </label>

            {form.formError && (
              <div role="alert" style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c" }}>
                {form.formError}
              </div>
            )}

            <button
              type="submit"
              className="cp-btn cp-btn-green"
              style={{ width: "100%" }}
            >
              {form.editingId ? "Salvar Card" : "Adicionar ao Compêndio"}
            </button>
          </form>
        )}

        <div
          className="cp-window-inner"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            overflowY: "auto"
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {["ALL", "ability", "spell", "skill", "item"].map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cp-btn ${filterType === cat ? "cp-btn-gold" : ""}`}
                style={{ padding: "4px 10px", fontSize: "12px" }}
                onClick={() => dispatch({ type: "SET_FILTER_TYPE", value: cat })}
              >
                {cat === "ALL" ? "Todos" : TYPE_LABELS[cat] || "CARD"}
              </button>
            ))}

            <input
              type="text"
              className="cp-input"
              style={{ flex: 1, minWidth: "140px", padding: "5px 10px" }}
              placeholder="Buscar no compêndio..."
              value={search}
              onChange={(e) => dispatch({ type: "SET_SEARCH", value: e.target.value })}
            />
          </div>

          {userCharacters.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                fontWeight: 800,
                color: "#001b3a",
                marginBottom: "8px",
                background: "#f8fafc",
                padding: "4px 8px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1"
              }}
            >
              <span>Ficha de Destino:</span>
              <select
                className="cp-input"
                style={{ padding: "2px 6px", fontSize: "11px" }}
                value={selectedTargetCharId}
                onChange={(e) =>
                  dispatch({ type: "SET_TARGET_CHAR", value: e.target.value })
                }
              >
                {userCharacters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "10px"
            }}
          >
            {filteredEntries.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "#ffffff",
                  border: `4px solid ${item.elementColor || "#3090f0"}`,
                  borderRadius: "14px",
                  padding: "10px",
                  boxShadow: "0 4px 0 #001b3a",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "6px"
                }}
              >
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      {renderCpFlashIcon(item.icon || "sword", 20)}
                      <span
                        style={{
                          background: item.elementColor || "#3090f0",
                          color: "#ffffff",
                          fontFamily: "var(--font-display)",
                          fontSize: "10px",
                          padding: "2px 7px",
                          borderRadius: "999px"
                        }}
                      >
                        {TYPE_LABELS[item.type] || "CARD"}
                      </span>
                    </div>

                    {item.cost?.amount > 0 && (
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: 800,
                          color: "#02529c"
                        }}
                      >
                        {item.cost.amount}{" "}
                        {(item.cost.resource || "mp").toUpperCase()}
                      </span>
                    )}
                  </div>

                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "15px",
                      marginTop: "4px"
                    }}
                  >
                    {item.name}
                  </div>

                  {item.hitFormula && (
                    <div
                      style={{
                        fontFamily: "var(--font-epf)",
                        fontSize: "12px",
                        color: "#013567"
                      }}
                    >
                      Rolagem: {item.hitFormula}
                    </div>
                  )}

                  {item.effectFormula && (
                    <div
                      style={{
                        fontFamily: "var(--font-epf)",
                        fontSize: "12px",
                        color: "#b71c1c"
                      }}
                    >
                      Efeito: {item.effectFormula}
                    </div>
                  )}

                  {item.description && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--cp-text-muted)",
                        marginTop: "4px"
                      }}
                    >
                      {item.description}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "4px",
                    marginTop: "6px",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap"
                  }}
                >
                  {userCharacters.length > 0 && (
                    <button
                      type="button"
                      className={`cp-btn ${addedFeedback[item.id] ? "cp-btn-green" : "cp-btn-gold"}`}
                      style={{ padding: "3px 8px", fontSize: "10px" }}
                      onClick={() => handleAddToCharacter(item)}
                      title="Adicionar habilidade à sua ficha"
                    >
                      {addedFeedback[item.id] ? "✓ Adicionado!" : "+ Na Ficha"}
                    </button>
                  )}

                  {isGM && (
                    <div
                      style={{
                        display: "flex",
                        gap: "4px",
                        marginLeft: "auto"
                      }}
                    >
                      <button
                        type="button"
                        className="cp-btn cp-btn-epf"
                        style={{ padding: "3px 8px", fontSize: "10px" }}
                        onClick={async () => {
                          try {
                            await onUpdateEntry(item.id, {
                              isPublic: !isReleasedToPlayers(item)
                            });
                          } catch {
                            // Erro já notificado pelo hook
                          }
                        }}
                      >
                        {isReleasedToPlayers(item) ? "Visível" : "Oculto"}
                      </button>
                      <button
                        type="button"
                        className="cp-btn"
                        style={{ padding: "3px 8px", fontSize: "10px" }}
                        onClick={() => dispatch({ type: "START_EDIT", entry: item })}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="cp-btn cp-btn-orange"
                        style={{ padding: "3px 8px", fontSize: "10px" }}
                        onClick={() =>
                          dispatch({
                            type: "SET_CONFIRM_DELETE",
                            entry: { id: item.id, name: item.name }
                          })
                        }
                      >
                        X
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmDeleteEntry && (
        <ConfirmDialog
          title="Excluir item do compêndio?"
          question={`Remover "${confirmDeleteEntry.name}" do compêndio?`}
          confirmLabel="Excluir"
          onConfirm={async () => {
            const entryId = confirmDeleteEntry.id;
            dispatch({ type: "SET_CONFIRM_DELETE", entry: null });
            try {
              await onDeleteEntry(entryId);
            } catch {
              // Erro já notificado pelo hook
            }
          }}
          onCancel={() => dispatch({ type: "SET_CONFIRM_DELETE", entry: null })}
          zIndex={Z_LAYERS.modalNested}
        />
      )}
    </WindowModal>
  );
}
