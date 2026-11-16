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
  activeCharacter,
  handleExecuteDamageRoll,
  handleExecuteSavingThrow
}) {
  return (
    <>
        {/* Janela de Rolagem de Dano (Normal / Crítico / Extra / Gatilho) */}
        <DamageRollModal
          open={Boolean(damageModalMsg)}
          onClose={() => setDamageModalMsg(null)}
          attackMessage={damageModalMsg}
          character={
            (damageModalMsg?.characterId &&
              allCharacters.find((c) => c.id === damageModalMsg.characterId)) ||
            activeCharacter
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
          defenderCharacter={
            (activeSavingThrowReq?.targetCharacterId &&
              allCharacters.find(
                (c) => c.id === activeSavingThrowReq.targetCharacterId
              )) ||
            activeCharacter
          }
          onExecuteSavingThrow={handleExecuteSavingThrow}
        />
    </>
  );
}
