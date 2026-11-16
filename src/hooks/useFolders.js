import { useEffect, useState } from "react";
import { collection } from "firebase/firestore";
import { subscribeVisibleCollection } from "../services/visibilityService";
import { db } from "../services/firebase";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

/**
 * Fase 5: assinatura unificada da subcoleção dedicada `campaigns/{campaignId}/folders`
 * (DIRETRIZES §2). Antes, useCharacters e useJournalNotes repetiam o mesmo listener e o mesmo
 * tratamento; agora ambos usam este hook, cada um com o seu domínio.
 *
 * - "character": pastas de Fichas (`folderType === "character"` ou legado sem folderType/noteType);
 * - "journal": pastas do Diário (`folderType === "journal"` ou legado com noteType).
 *
 * Retorna { folders, setFolders } — o setter permite a inserção otimista feita pelos hooks ao criar
 * uma pasta (comportamento preexistente). Pastas com Soft Delete são filtradas.
 * Observação: o modelo de árvore do Diário (caminho com "/") e o de Fichas (parentId) continuam
 * distintos; a unificação do modelo de árvore permanece como evolução futura (D-2).
 */
const DOMAINS = {
  character: {
    accept: (f) => f.folderType === "character" || (!f.folderType && !f.noteType),
    sortKey: (f) => f.name || "",
    errorLabel: "Erro ao carregar pastas de personagens:",
  },
  journal: {
    accept: (f) => f.folderType === "journal" || Boolean(f.noteType),
    sortKey: (f) => f.name || f.title || "",
    errorLabel: "Erro ao carregar pastas do diário:",
  },
};

export function useFolders(domain) {
  const { user } = useAuth();
  const { campaignId, campaign, isRealGM } = useCampaign();
  const [folders, setFolders] = useState([]);

  // Mesmas dependências estáveis dos demais listeners (Fase 3.1 / V-13)
  const listenerUid = user?.uid || null;
  const campaignReady = Boolean(campaign);

  useEffect(() => {
    const cfg = DOMAINS[domain];
    if (!cfg || !listenerUid || !campaignId || !campaignReady) return;

    const foldersCol = collection(db, "campaigns", campaignId, "folders");
    // Fase 6.2 (A5/A7/A8: o dono sempre recebe as próprias pastas).
    const unsubscribe = subscribeVisibleCollection({
      colRef: foldersCol,
      isRealGM,
      uid: listenerUid,
      includeOwned: true,
      onNext: (snapshot) => {
        const list = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...d.data()
          }))
          .filter((f) => !f.isDeleted && cfg.accept(f));
        list.sort((a, b) => cfg.sortKey(a).localeCompare(cfg.sortKey(b)));
        setFolders(list);
      },
      onError: (err) => {
        console.error(cfg.errorLabel, err);
      }
    });

    return () => unsubscribe();
  }, [domain, listenerUid, campaignId, campaignReady, isRealGM]);

  return { folders, setFolders };
}
