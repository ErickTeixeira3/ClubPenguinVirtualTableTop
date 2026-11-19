import { useCallback, useEffect, useMemo, useRef } from "react";
import { canDeleteResource, canEditResource } from "../domain/permissions.js";
import {
  addEntry,
  applyResourceDelta,
  consumeItem,
  createCharacter as createCharacterService,
  pullCompendiumEntry as pullCompendiumEntryService,
  removeEntry,
  renameCharacter as renameCharacterService,
  reorderEntries,
  setCharacterImageUrl as setCharacterImageUrlService,
  setHotbarSlot,
  shareCharacter as shareCharacterService,
  softDeleteCharacter,
  transferCharacter as transferCharacterService,
  updateCharacterFields,
  updateEntry,
  uploadCharacterImage as uploadCharacterImageService
} from "../services/characterService.js";
import { notifyError } from "../services/notificationService.js";
import { projectCharacterToSceneTokens } from "../services/tokenService.js";
import { useAuth } from "../contexts/AuthContext";
import { useCampaign } from "../contexts/CampaignContext";

function mergeProjectedCharacter(target, updates = {}, nextRev = null) {
  if (!target) return null;
  const merged = {
    ...target,
    resources: {
      ...(target.resources || {}),
      hp: target.resources?.hp ? { ...target.resources.hp } : undefined,
      mp: target.resources?.mp ? { ...target.resources.mp } : undefined
    },
    avatar: target.avatar ? { ...target.avatar } : { mediaId: null, url: null },
    token: {
      ...(target.token || {}),
      image: target.token?.image
        ? { ...target.token.image }
        : { mediaId: null, url: null }
    }
  };

  for (const [key, val] of Object.entries(updates || {})) {
    if (key === "name" || key === "cardColor" || key === "type") {
      merged[key] = val;
    } else if (key === "avatar" && val && typeof val === "object") {
      merged.avatar = { ...merged.avatar, ...val };
    } else if (key === "avatar.mediaId") {
      merged.avatar.mediaId = val;
    } else if (key === "avatar.url") {
      merged.avatar.url = val;
    } else if (key === "token" && val && typeof val === "object") {
      merged.token = { ...merged.token, ...val };
    } else if (key === "token.image" && val && typeof val === "object") {
      merged.token.image = { ...merged.token.image, ...val };
    } else if (key === "token.showName") {
      merged.token.showName = val;
    } else if (key === "token.sizeInCells") {
      merged.token.sizeInCells = val;
    } else if (key === "resources.hp" && val && typeof val === "object") {
      merged.resources.hp = { ...val };
    } else if (key === "resources.hp.current") {
      merged.resources.hp = { ...(merged.resources.hp || { max: val }), current: val };
    } else if (key === "resources.hp.max") {
      merged.resources.hp = { ...(merged.resources.hp || { current: val }), max: val };
    } else if (key === "resources.mp" && val && typeof val === "object") {
      merged.resources.mp = { ...val };
    } else if (key === "resources.mp.current") {
      merged.resources.mp = { ...(merged.resources.mp || { max: val }), current: val };
    } else if (key === "resources.mp.max") {
      merged.resources.mp = { ...(merged.resources.mp || { current: val }), max: val };
    }
  }

  const baseRev = Number.isInteger(target.rev) ? target.rev : 0;
  merged.rev =
    typeof nextRev === "number" && Number.isInteger(nextRev) && nextRev > baseRev
      ? nextRev
      : baseRev + 1;
  return merged;
}

function partitionBoardTokens(boardTokens) {
  if (Array.isArray(boardTokens)) {
    const publicTokens = [];
    const hiddenTokens = [];
    for (const tok of boardTokens) {
      if (!tok) continue;
      if (tok.inHiddenBucket === true || tok.hidden === true) {
        hiddenTokens.push(tok);
      } else {
        publicTokens.push(tok);
      }
    }
    return { publicTokens, hiddenTokens };
  }
  if (boardTokens && typeof boardTokens === "object") {
    return {
      publicTokens: Array.isArray(boardTokens.publicTokens)
        ? boardTokens.publicTokens
        : null,
      hiddenTokens: Array.isArray(boardTokens.hiddenTokens)
        ? boardTokens.hiddenTokens
        : null
    };
  }
  return { publicTokens: null, hiddenTokens: null };
}

export function useCharacterActions({
  rawCharacters = [],
  rawFolders = [],
  boardTokens = null,
  onOptimisticInsert = null
} = {}) {
  const { user } = useAuth();
  const { campaignId, campaign, isGM, isRealGM } = useCampaign();
  const pendingRollGroupsRef = useRef(new Map());

  const { publicTokens, hiddenTokens } = useMemo(
    () => partitionBoardTokens(boardTokens),
    [boardTokens]
  );

  const syncCharacterProjection = useCallback(
    (projectedCharacter) =>
      projectCharacterToSceneTokens({
        campaignId,
        sceneId: campaign?.activeSceneId,
        character: projectedCharacter,
        publicTokens,
        hiddenTokens,
        user,
        isGM: typeof isRealGM === "boolean" ? isRealGM : isGM
      }),
    [
      campaignId,
      campaign?.activeSceneId,
      publicTokens,
      hiddenTokens,
      user,
      isRealGM,
      isGM
    ]
  );

  useEffect(() => {
    pendingRollGroupsRef.current.clear();
  }, [campaignId]);

  useEffect(() => {
    if (pendingRollGroupsRef.current.size === 0) return;
    for (const [cacheKey] of pendingRollGroupsRef.current.entries()) {
      const sepIdx = cacheKey.indexOf(":");
      if (sepIdx === -1) continue;
      const cId = cacheKey.slice(0, sepIdx);
      const gId = cacheKey.slice(sepIdx + 1);
      const found = rawCharacters.find((c) => c.id === cId);
      if (!found || found.rollGroups?.[gId]) {
        pendingRollGroupsRef.current.delete(cacheKey);
      }
    }
  }, [rawCharacters]);

  const withPendingRollGroups = useCallback((charId, target) => {
    if (!target) return target;
    const prefix = `${charId}:`;
    let mergedRollGroups = null;
    for (const [cacheKey, cachedGroup] of pendingRollGroupsRef.current.entries()) {
      if (!cacheKey.startsWith(prefix)) continue;
      const gId = cacheKey.slice(prefix.length);
      if (target.rollGroups?.[gId]) {
        pendingRollGroupsRef.current.delete(cacheKey);
      } else {
        if (!mergedRollGroups) {
          mergedRollGroups = {
            ...(target.rollGroups && !Array.isArray(target.rollGroups)
              ? target.rollGroups
              : {})
          };
        }
        mergedRollGroups[gId] = cachedGroup;
      }
    }
    return mergedRollGroups
      ? { ...target, rollGroups: mergedRollGroups }
      : target;
  }, []);

  const findCharacter = useCallback(
    (charId) => rawCharacters.find((c) => c.id === charId) || null,
    [rawCharacters]
  );

  const canEdit = useCallback(
    (character) =>
      canEditResource(character, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const canDelete = useCallback(
    (character) =>
      canDeleteResource(character, { uid: user?.uid, isGM }),
    [user?.uid, isGM]
  );

  const runWithNotice = useCallback(async (fn) => {
    try {
      return await fn();
    } catch (err) {
      notifyError(err);
      throw err;
    }
  }, []);

  const createCharacter = useCallback(
    (params = {}) =>
      runWithNotice(async () => {
        if (!user || !campaignId) return null;
        const created = await createCharacterService({
          campaignId,
          user,
          isGM,
          gmId: campaign?.gmId || null,
          ...params
        });
        onOptimisticInsert?.(created);
        return created.id;
      }),
    [runWithNotice, user, campaignId, isGM, campaign?.gmId, onOptimisticInsert]
  );

  const renameCharacter = useCallback(
    (charId, name) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const result = await renameCharacterService({ campaignId, charId, name });
        await syncCharacterProjection(
          mergeProjectedCharacter(target, { name: result.name })
        );
        return result;
      }),
    [runWithNotice, findCharacter, canEdit, campaignId, syncCharacterProjection]
  );

  const updateCharacter = useCallback(
    (charId, updates = {}) =>
      runWithNotice(async () => {
        if (!user || !campaignId || !charId) return null;
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const payload = await updateCharacterFields({
          campaignId,
          charId,
          updates,
          currentChar: target,
          isGM,
          gmId: campaign?.gmId || null
        });
        await syncCharacterProjection(mergeProjectedCharacter(target, updates));
        return payload;
      }),
    [
      runWithNotice,
      user,
      campaignId,
      findCharacter,
      canEdit,
      isGM,
      campaign?.gmId,
      syncCharacterProjection
    ]
  );

  const applyCharacterResourceDelta = useCallback(
    (charId, resourceKey, delta, { opId = null } = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const res = await applyResourceDelta({
          campaignId,
          charId,
          resourceKey,
          delta,
          opId
        });
        const nextValue = res?.value ?? res?.nextValue;
        if (nextValue !== undefined && nextValue !== null) {
          await syncCharacterProjection(
            mergeProjectedCharacter(
              target,
              { [`resources.${resourceKey}.current`]: nextValue },
              res?.rev
            )
          );
        }
        return res;
      }),
    [runWithNotice, findCharacter, canEdit, campaignId, syncCharacterProjection]
  );

  const updateCharacterResource = useCallback(
    (charId, resourceKey, nextCurrent, options = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const cleanCurrent = Math.max(0, Number(nextCurrent) || 0);
        if (!target.resources?.[resourceKey]) {
          return await updateCharacter(
            charId,
            {
              [`resources.${resourceKey}`]: {
                current: cleanCurrent,
                max: Math.max(cleanCurrent, 10)
              }
            },
            options
          );
        }
        const currentVal = Number(target.resources[resourceKey]?.current ?? 0);
        const delta = cleanCurrent - currentVal;
        return await applyCharacterResourceDelta(charId, resourceKey, delta, options);
      }),
    [runWithNotice, findCharacter, canEdit, updateCharacter, applyCharacterResourceDelta]
  );

  const consumeCharacterItem = useCallback(
    (charId, itemId, amount = 1, opId = null) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        return await consumeItem({
          campaignId,
          charId,
          itemId,
          amount,
          opId
        });
      }),
    [runWithNotice, findCharacter, canEdit, campaignId]
  );

  const addCharacterEntry = useCallback(
    (charId, collectionName, entry, { rollGroupId = null } = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;

        const effectiveChar =
          collectionName === "rolls" || collectionName === "rollGroups"
            ? withPendingRollGroups(charId, target)
            : target;

        const res = await addEntry({
          campaignId,
          charId,
          collectionName,
          entry,
          currentChar: effectiveChar,
          rollGroupId
        });

        if (collectionName === "rollGroups" && res?.key && res?.entry) {
          pendingRollGroupsRef.current.set(`${charId}:${res.key}`, res.entry);
        } else if (
          collectionName === "rolls" &&
          rollGroupId &&
          res?.key &&
          res?.entry
        ) {
          const cacheKey = `${charId}:${rollGroupId}`;
          const cachedGroup = pendingRollGroupsRef.current.get(cacheKey);
          if (cachedGroup) {
            pendingRollGroupsRef.current.set(cacheKey, {
              ...cachedGroup,
              rolls: {
                ...(cachedGroup.rolls || {}),
                [res.key]: res.entry
              }
            });
          }
        }

        return res;
      }),
    [runWithNotice, findCharacter, canEdit, withPendingRollGroups, campaignId]
  );

  const updateCharacterEntry = useCallback(
    (charId, collectionName, entryKey, patch, { rollGroupId = null } = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const effectiveChar =
          collectionName === "rolls" || collectionName === "rollGroups"
            ? withPendingRollGroups(charId, target)
            : target;
        const res = await updateEntry({
          campaignId,
          charId,
          collectionName,
          entryKey,
          patch,
          currentChar: effectiveChar,
          rollGroupId
        });
        if (collectionName === "rollGroups" && entryKey && res?.entry) {
          const cacheKey = `${charId}:${entryKey}`;
          const cachedGroup = pendingRollGroupsRef.current.get(cacheKey);
          if (cachedGroup) {
            pendingRollGroupsRef.current.set(cacheKey, {
              ...cachedGroup,
              ...res.entry,
              rolls: cachedGroup.rolls || res.entry.rolls || {}
            });
          }
        } else if (
          collectionName === "rolls" &&
          rollGroupId &&
          entryKey &&
          res?.entry
        ) {
          const cacheKey = `${charId}:${rollGroupId}`;
          const cachedGroup = pendingRollGroupsRef.current.get(cacheKey);
          if (cachedGroup) {
            pendingRollGroupsRef.current.set(cacheKey, {
              ...cachedGroup,
              rolls: {
                ...(cachedGroup.rolls || {}),
                [entryKey]: res.entry
              }
            });
          }
        }
        return res;
      }),
    [runWithNotice, findCharacter, canEdit, withPendingRollGroups, campaignId]
  );

  const removeCharacterEntry = useCallback(
    (charId, collectionName, entryKey, { rollGroupId = null } = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        if (collectionName === "rollGroups" && entryKey) {
          pendingRollGroupsRef.current.delete(`${charId}:${entryKey}`);
        } else if (collectionName === "rolls" && rollGroupId && entryKey) {
          const cacheKey = `${charId}:${rollGroupId}`;
          const cachedGroup = pendingRollGroupsRef.current.get(cacheKey);
          if (cachedGroup?.rolls && Object.hasOwn(cachedGroup.rolls, entryKey)) {
            const nextRolls = { ...cachedGroup.rolls };
            delete nextRolls[entryKey];
            pendingRollGroupsRef.current.set(cacheKey, {
              ...cachedGroup,
              rolls: nextRolls
            });
          }
        }
        return await removeEntry({
          campaignId,
          charId,
          collectionName,
          entryKey,
          rollGroupId
        });
      }),
    [runWithNotice, findCharacter, canEdit, campaignId]
  );

  const reorderCharacterEntries = useCallback(
    (charId, collectionName, orderedKeys, { rollGroupId = null } = {}) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        return await reorderEntries({
          campaignId,
          charId,
          collectionName,
          orderedKeys,
          rollGroupId
        });
      }),
    [runWithNotice, findCharacter, canEdit, campaignId]
  );

  const setCharacterHotbarSlot = useCallback(
    (charId, slotKey, value) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        return await setHotbarSlot({
          campaignId,
          charId,
          slotKey,
          value,
          currentChar: withPendingRollGroups(charId, target)
        });
      }),
    [runWithNotice, findCharacter, canEdit, withPendingRollGroups, campaignId]
  );

  const shareCharacter = useCallback(
    (charId, { visibleTo, editableBy }) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target) return null;
        return await shareCharacterService({
          campaignId,
          charId,
          visibleTo,
          editableBy,
          gmId: campaign?.gmId || null,
          isGM,
          currentChar: target
        });
      }),
    [runWithNotice, findCharacter, campaignId, campaign?.gmId, isGM]
  );

  const transferCharacter = useCallback(
    (charId, newOwnerId) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target) return null;
        const folder = rawFolders.find((f) => f.id === target.folderId) || null;
        return await transferCharacterService({
          campaignId,
          charId,
          newOwnerId,
          gmId: campaign?.gmId || null,
          isGM,
          currentChar: target,
          currentFolder: folder
        });
      }),
    [runWithNotice, findCharacter, rawFolders, campaignId, campaign?.gmId, isGM]
  );

  const uploadCharacterImage = useCallback(
    (charId, file, targetField = "avatar") =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const uploaded = await uploadCharacterImageService({
          campaignId,
          charId,
          file,
          targetField,
          user,
          currentChar: target
        });
        await syncCharacterProjection(
          mergeProjectedCharacter(target, { [uploaded.field]: uploaded.imageRef })
        );
        return uploaded.mediaId;
      }),
    [runWithNotice, findCharacter, canEdit, campaignId, user, syncCharacterProjection]
  );

  const setCharacterImageUrl = useCallback(
    (charId, targetField = "avatar", url = null) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        const res = await setCharacterImageUrlService({
          campaignId,
          charId,
          targetField,
          url
        });
        await syncCharacterProjection(
          mergeProjectedCharacter(target, { [res.field]: res.imageRef })
        );
        return res;
      }),
    [runWithNotice, findCharacter, canEdit, campaignId, syncCharacterProjection]
  );

  const deleteCharacter = useCallback(
    (charId) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canDelete(target)) return null;
        return await softDeleteCharacter({
          campaignId,
          charId,
          uid: user?.uid
        });
      }),
    [runWithNotice, findCharacter, canDelete, campaignId, user?.uid]
  );

  const pullCompendiumEntry = useCallback(
    (charId, compendiumEntry) =>
      runWithNotice(async () => {
        const target = findCharacter(charId);
        if (!target || !canEdit(target)) return null;
        return await pullCompendiumEntryService({
          campaignId,
          charId,
          compendiumEntry,
          currentChar: target
        });
      }),
    [runWithNotice, findCharacter, canEdit, campaignId]
  );

  return {
    createCharacter,
    renameCharacter,
    updateCharacter,
    updateCharacterResource,
    applyCharacterResourceDelta,
    consumeCharacterItem,
    addCharacterEntry,
    updateCharacterEntry,
    removeCharacterEntry,
    reorderCharacterEntries,
    setCharacterHotbarSlot,
    shareCharacter,
    transferCharacter,
    uploadCharacterImage,
    setCharacterImageUrl,
    deleteCharacter,
    pullCompendiumEntry
  };
}
