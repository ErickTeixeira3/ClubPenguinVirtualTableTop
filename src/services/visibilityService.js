import { onSnapshot, query, where } from "firebase/firestore";
import { computeAudience } from "../domain/audience.js";
import { isReleasedToPlayers } from "../domain/permissions.js";

/**
 * Fase 4 — Regras canônicas de visibilidade (`visibleTo`, `editableBy`, `scope`).
 * Sem fallback para `visibleToPlayers`, sem leitura por `ownerId` ou `scope == 'party'` fora de `visibleTo`,
 * e sem `or(...)` nas consultas.
 */

/** Garante a audiência canônica do dono (e do Mestre apenas em `scope === 'gm'`). */
export function withRequiredAudience(
  list,
  { gmUid = null, ownerId = null, scope = null } = {}
) {
  const { visibleTo } = computeAudience({
    ownerId: ownerId || (scope == null ? gmUid : null),
    scope,
    gmId: gmUid,
    visibleTo: list
  });
  return visibleTo;
}

/**
 * Aplica audiência canônica via `computeAudience` quando uma atualização altera
 * `ownerId`, `visibleTo`, `editableBy` ou `scope`.
 */
export function applyOwnerAndGmAudience(updates = {}, target = null, gmUid = null) {
  const touchesAudience = ["ownerId", "visibleTo", "editableBy", "scope"].some(
    (key) => updates[key] !== undefined
  );
  if (!touchesAudience) return { ...updates };

  const ownerId = updates.ownerId !== undefined ? updates.ownerId : target?.ownerId;
  const scope = updates.scope !== undefined ? updates.scope : target?.scope;
  const rawVisibleTo =
    updates.visibleTo !== undefined ? updates.visibleTo : target?.visibleTo;
  const rawEditableBy =
    updates.editableBy !== undefined ? updates.editableBy : target?.editableBy;

  const audience = computeAudience({
    ownerId,
    scope,
    visibleTo: rawVisibleTo,
    editableBy: rawEditableBy,
    gmId: gmUid
  });

  return {
    ...updates,
    visibleTo: audience.visibleTo,
    editableBy: audience.editableBy
  };
}

/**
 * Consulta canônica única para não-Mestre:
 * `visibleTo array-contains-any ["ALL", uid]` combinado com `isDeleted == false`.
 */
export function buildPlayerVisibilityQuery(colRef, uid) {
  const safeUid = typeof uid === "string" && uid.trim() ? uid.trim() : null;
  const keys = Array.from(new Set(["ALL", safeUid].filter(Boolean)));
  return query(
    colRef,
    where("visibleTo", "array-contains-any", keys),
    where("isDeleted", "==", false)
  );
}

/**
 * Listener canônico de coleção com visibilidade por usuário.
 * Sem `or(...)` nem fallback silencioso.
 */
export function subscribeVisibleCollection({
  colRef,
  isRealGM,
  uid,
  onNext,
  onError
}) {
  const q = isRealGM
    ? query(colRef, where("isDeleted", "==", false))
    : buildPlayerVisibilityQuery(colRef, uid);
  return onSnapshot(q, onNext, onError);
}

/**
 * Verifica se o documento está visível para jogadores a partir exclusivamente de `visibleTo`
 * (e `scope !== 'gm'`). Reexportado de `domain/permissions.js`.
 */
export { isReleasedToPlayers };
