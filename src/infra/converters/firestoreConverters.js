import {
  fromAppConfigDoc,
  fromCampaignDoc,
  fromCharacterDoc,
  fromChatStateDoc,
  fromCompendiumEntryDoc,
  fromFolderDoc,
  fromInviteDoc,
  fromMediaDoc,
  fromMemberDoc,
  fromMessageDoc,
  fromNoteDoc,
  fromPendingCostDoc,
  fromPlatformAdminDoc,
  fromSceneDoc,
  fromTurnStateDoc,
  toAppConfigDoc,
  toCampaignDoc,
  toCharacterDoc,
  toChatStateDoc,
  toCompendiumEntryDoc,
  toFolderDoc,
  toInviteDoc,
  toMediaDoc,
  toMemberDoc,
  toMessageDoc,
  toNoteDoc,
  toPendingCostDoc,
  toPlatformAdminDoc,
  toSceneDoc,
  toTurnStateDoc
} from "../../domain/models/index.js";

function stripUndefinedDeep(value) {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : stripUndefinedDeep(item)));
  }
  if (value !== null && typeof value === "object") {
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (v !== undefined) {
        clean[k] = stripUndefinedDeep(v);
      }
    }
    return clean;
  }
  return value;
}

function resolveCampaignIdFromSnapshot(snapshot, raw) {
  if (typeof raw?.campaignId === "string" && raw.campaignId.trim()) {
    return raw.campaignId.trim();
  }
  const ref = snapshot?.ref;
  const parent = ref?.parent;
  const grandParent = parent?.parent;
  const rootParent = grandParent?.parent;
  if (parent?.id === "campaigns" && typeof ref?.id === "string") {
    return ref.id;
  }
  if (rootParent?.id === "campaigns" && typeof grandParent?.id === "string") {
    return grandParent.id;
  }
  return undefined;
}

export function createFirestoreConverter({ modelName, toDoc, fromDoc, includeIdInFromDoc = true }) {
  return Object.freeze({
    modelName,
    toFirestore(entity) {
      return stripUndefinedDeep(toDoc(entity ?? {}));
    },
    fromFirestore(snapshot, options) {
      const raw = snapshot?.data ? snapshot.data(options) || {} : snapshot || {};
      const id = snapshot?.id ?? raw.id ?? null;
      const campaignId = resolveCampaignIdFromSnapshot(snapshot, raw);
      const input =
        campaignId && !raw.campaignId
          ? { ...raw, campaignId }
          : raw;
      return includeIdInFromDoc
        ? fromDoc(input, id, campaignId ? { id, campaignId } : { id })
        : fromDoc(input);
    }
  });
}

export const campaignConverter = createFirestoreConverter({
  modelName: "campaign",
  toDoc: toCampaignDoc,
  fromDoc: fromCampaignDoc
});

export const memberConverter = createFirestoreConverter({
  modelName: "member",
  toDoc: toMemberDoc,
  fromDoc: fromMemberDoc
});

export const inviteConverter = createFirestoreConverter({
  modelName: "invite",
  toDoc: toInviteDoc,
  fromDoc: fromInviteDoc
});

export const characterConverter = createFirestoreConverter({
  modelName: "character",
  toDoc: toCharacterDoc,
  fromDoc: fromCharacterDoc
});

export const folderConverter = createFirestoreConverter({
  modelName: "folder",
  toDoc: toFolderDoc,
  fromDoc: fromFolderDoc
});

export const noteConverter = createFirestoreConverter({
  modelName: "note",
  toDoc: toNoteDoc,
  fromDoc: fromNoteDoc
});

export const sceneConverter = createFirestoreConverter({
  modelName: "scene",
  toDoc: toSceneDoc,
  fromDoc: fromSceneDoc
});

export const compendiumEntryConverter = createFirestoreConverter({
  modelName: "compendiumEntry",
  toDoc: toCompendiumEntryDoc,
  fromDoc: fromCompendiumEntryDoc
});

export const messageConverter = createFirestoreConverter({
  modelName: "message",
  toDoc: toMessageDoc,
  fromDoc: fromMessageDoc
});

export const mediaConverter = createFirestoreConverter({
  modelName: "media",
  toDoc: toMediaDoc,
  fromDoc: fromMediaDoc
});

export const turnStateConverter = createFirestoreConverter({
  modelName: "turnState",
  toDoc: toTurnStateDoc,
  fromDoc: fromTurnStateDoc,
  includeIdInFromDoc: false
});

export const chatStateConverter = createFirestoreConverter({
  modelName: "chatState",
  toDoc: toChatStateDoc,
  fromDoc: fromChatStateDoc,
  includeIdInFromDoc: false
});

export const pendingCostConverter = createFirestoreConverter({
  modelName: "pendingCost",
  toDoc: toPendingCostDoc,
  fromDoc: fromPendingCostDoc
});

export const appConfigConverter = createFirestoreConverter({
  modelName: "appConfig",
  toDoc: toAppConfigDoc,
  fromDoc: fromAppConfigDoc
});

export const platformAdminConverter = createFirestoreConverter({
  modelName: "platformAdmin",
  toDoc: toPlatformAdminDoc,
  fromDoc: fromPlatformAdminDoc
});

export const FIRESTORE_CONVERTERS = Object.freeze({
  campaign: campaignConverter,
  member: memberConverter,
  invite: inviteConverter,
  character: characterConverter,
  folder: folderConverter,
  note: noteConverter,
  scene: sceneConverter,
  compendiumEntry: compendiumEntryConverter,
  message: messageConverter,
  media: mediaConverter,
  turnState: turnStateConverter,
  chatState: chatStateConverter,
  pendingCost: pendingCostConverter,
  appConfig: appConfigConverter,
  platformAdmin: platformAdminConverter
});
