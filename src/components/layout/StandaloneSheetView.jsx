import CharacterSheetModal from "../sheets/CharacterSheetModal";
import CombatModals from "../combat/CombatModals";

/**
 * Fase 5: visão da janela destacada da ficha (`?campaignId=&sheetId=`).
 * Renderiza a Ficha em modo janela E os modais de combate. Antes da Fase 5 o VTTLayout retornava
 * apenas a Ficha neste modo, então um pedido de Teste de Resistência detectado na janela destacada
 * abria o estado do modal, mas o SavingThrowModal nunca aparecia (bug registrado na auditoria §2.1).
 */
export default function StandaloneSheetView({ character, sheetProps, combatModalsProps }) {
  if (!character) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <div className="cp-window">
          <h2 className="cp-title" style={{ padding: "12px 24px" }}>
            CARREGANDO FICHA...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <>
      <CharacterSheetModal character={character} {...sheetProps} isStandaloneWindow={true} />
      <CombatModals {...combatModalsProps} />
    </>
  );
}
