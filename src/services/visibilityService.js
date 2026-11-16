import { onSnapshot, or, query, where } from "firebase/firestore";

/**
 * Fase 6.2 — regras únicas de visibilidade (`visibleTo`) para leitura e gravação.
 *
 * Princípios:
 * - o dono e o Mestre sempre fazem parte da audiência de um documento (nunca lista vazia);
 * - o jogador sempre enxerga os documentos de que é dono, mesmo com `visibleTo` defasado;
 * - em cenas e compêndio, `visibleToPlayers` (booleano) é a fonte da verdade quando existe.
 */

/** Acrescenta Mestre e dono à lista, sem duplicatas e sem valores vazios. */
export function withRequiredAudience(list, { gmUid = null, ownerId = null } = {}) {
  const base = Array.isArray(list) ? list.filter(Boolean) : [];
  return Array.from(new Set([...base, gmUid, ownerId].filter(Boolean)));
}

/**
 * Aplica a audiência mínima numa atualização de ficha ou pasta feita pelo Mestre.
 * Quando a atualização mexe em `ownerId`, `visibleTo` ou `editableBy`, as duas listas passam a
 * conter o Mestre e o dono (o novo, em caso de transferência). Sem isso, a ficha ou pasta
 * transferida some para o novo dono, e desmarcar "Visível a Todos" pode deixar a lista vazia.
 * Atualizações que não mexem nesses campos voltam inalteradas (cópia).
 */
export function applyOwnerAndGmAudience(updates = {}, target = null, gmUid = null) {
  const touchesAudience = ["ownerId", "visibleTo", "editableBy"].some((key) => updates[key] !== undefined);
  if (!touchesAudience) return { ...updates };
  const audience = {
    gmUid,
    ownerId: updates.ownerId !== undefined ? updates.ownerId : target?.ownerId,
  };
  return {
    ...updates,
    visibleTo: withRequiredAudience(updates.visibleTo !== undefined ? updates.visibleTo : target?.visibleTo, audience),
    editableBy: withRequiredAudience(updates.editableBy !== undefined ? updates.editableBy : target?.editableBy, audience),
  };
}

/**
 * Consulta de leitura para quem não é o Mestre real.
 * - `includeOwned`: também traz os documentos cujo `ownerId` é o usuário;
 * - `includePublicFlag`: também traz os documentos com `visibleToPlayers == true`.
 * As duas regras (publicadas e locais) aceitam estas consultas `or` (testado no emulador na 6.2).
 */
export function buildPlayerVisibilityQuery(colRef, uid, { includeOwned = false, includePublicFlag = false } = {}) {
  const byAudience = where("visibleTo", "array-contains-any", ["ALL", uid]);
  const extra = [];
  if (includeOwned) extra.push(where("ownerId", "==", uid));
  if (includePublicFlag) extra.push(where("visibleToPlayers", "==", true));
  return extra.length > 0 ? query(colRef, or(byAudience, ...extra)) : query(colRef, byAudience);
}

/**
 * Listener de uma coleção com visibilidade por usuário.
 * O Mestre real lê a coleção inteira. Para os demais, usa a consulta `or`; se o servidor a recusar,
 * volta para a consulta simples por `visibleTo` (comportamento anterior à 6.2).
 */
export function subscribeVisibleCollection({ colRef, isRealGM, uid, includeOwned = false, includePublicFlag = false, onNext, onError }) {
  if (isRealGM) return onSnapshot(query(colRef), onNext, onError);

  let active = true;
  let unsubscribe = onSnapshot(
    buildPlayerVisibilityQuery(colRef, uid, { includeOwned, includePublicFlag }),
    onNext,
    (err) => {
      if (!active) return;
      console.warn("Consulta de visibilidade ampliada recusada; usando apenas visibleTo:", err?.code || err);
      unsubscribe = onSnapshot(buildPlayerVisibilityQuery(colRef, uid), onNext, onError);
    }
  );
  return () => {
    active = false;
    unsubscribe();
  };
}

/**
 * Cenas e compêndio: o item está liberado aos jogadores?
 * `viewerUid` deve ser `null` quando o Mestre real usa a "Visão Player" (o UID dele está em todo `visibleTo`).
 */
export function isReleasedToPlayers(item, viewerUid = null) {
  if (!item) return false;
  if (typeof item.visibleToPlayers === "boolean") return item.visibleToPlayers;
  const vis = Array.isArray(item.visibleTo) ? item.visibleTo : [];
  return vis.includes("ALL") || Boolean(viewerUid && vis.includes(viewerUid));
}
