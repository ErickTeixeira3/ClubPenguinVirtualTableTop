import DamageRollModal from "./DamageRollModal";
import SavingThrowModal from "./SavingThrowModal";

/**
 * Fase 5: modais de combate (Rolagem de Dano e Teste de Resistência), extraídos de VTTLayout.jsx
 * com JSX inalterado. Renderizados na mesa principal e também na janela destacada da ficha
 * (StandaloneSheetView), que antes detectava o pedido de resistência mas não exibia o modal.
 */
export default function CombatModals({
  damageModalMsg,
  setDamageModalMsg,
  activeSavingThrowReq,
  setActiveSavingThrowReq,
  dismissedSaveIdsRef,
  allCharacters,
  handleExecuteDamageRoll,
  handleExecuteSavingThrow
}) {
  const damageCharacterId =
    damageModalMsg?.sender?.characterId || damageModalMsg?.characterId || null;
  const damageCharacter = damageCharacterId
    ? allCharacters.find((character) => character.id === damageCharacterId) || null
    : null;
  const defenderCharacterId = activeSavingThrowReq?.targetCharacterId || null;
  const defenderCharacter = defenderCharacterId
    ? allCharacters.find((character) => character.id === defenderCharacterId) || null
    : null;

  return (
    <>
        {/* Janela de Rolagem de Dano (Normal / Crítico / Extra / Gatilho) */}
        <DamageRollModal
          open={Boolean(damageModalMsg)}
          onClose={() => setDamageModalMsg(null)}
          attackMessage={damageModalMsg}
          character={damageCharacter}
          characterResolutionError={
            damageModalMsg && !damageCharacter
              ? "A ficha que originou esta rolagem não está disponível."
              : null
          }
          onExecuteDamageRoll={handleExecuteDamageRoll}
        />

        {/* Pop-up de Teste de Resistência para o Alvo */}
        <SavingThrowModal
          open={Boolean(activeSavingThrowReq)}
          onClose={() => {
            if (activeSavingThrowReq?.id) {
              dismissedSaveIdsRef.current.add(activeSavingThrowReq.id);
            }
            setActiveSavingThrowReq(null);
          }}
          savingThrowRequest={activeSavingThrowReq}
          defenderCharacter={defenderCharacter}
          characterResolutionError={
            activeSavingThrowReq && !defenderCharacter
              ? "A ficha responsável por esta resistência não está disponível."
              : null
          }
          onExecuteSavingThrow={handleExecuteSavingThrow}
        />
    </>
  );
}
