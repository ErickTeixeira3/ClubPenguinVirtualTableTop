import * as appConfigModel from "./appConfig.js";
import * as campaignModel from "./campaign.js";
import * as characterModel from "./character.js";
import * as chatStateModel from "./chatState.js";
import * as compendiumEntryModel from "./compendiumEntry.js";
import * as drawingModel from "./drawing.js";
import * as fogModel from "./fog.js";
import * as folderModel from "./folder.js";
import * as imageRefModel from "./imageRef.js";
import * as inviteModel from "./invite.js";
import * as mediaModel from "./media.js";
import * as memberModel from "./member.js";
import * as messageModel from "./message.js";
import * as noteModel from "./note.js";
import * as pendingCostModel from "./pendingCost.js";
import * as pingModel from "./ping.js";
import * as platformAdminModel from "./platformAdmin.js";
import * as presenceModel from "./presence.js";
import * as sceneModel from "./scene.js";
import * as tokenModel from "./token.js";
import * as turnStateModel from "./turnState.js";

export const MODEL_NAMES = Object.freeze([
  "imageRef",
  "campaign",
  "member",
  "invite",
  "character",
  "folder",
  "note",
  "scene",
  "compendiumEntry",
  "message",
  "media",
  "turnState",
  "chatState",
  "pendingCost",
  "token",
  "drawing",
  "ping",
  "fog",
  "presence",
  "appConfig",
  "platformAdmin"
]);

export {
  appConfigModel,
  campaignModel,
  characterModel,
  chatStateModel,
  compendiumEntryModel,
  drawingModel,
  fogModel,
  folderModel,
  imageRefModel,
  inviteModel,
  mediaModel,
  memberModel,
  messageModel,
  noteModel,
  pendingCostModel,
  pingModel,
  platformAdminModel,
  presenceModel,
  sceneModel,
  tokenModel,
  turnStateModel
};

export {
  EMPTY_IMAGE_REF,
  normalizeImageRef,
  validateImageRef,
  toImageRefDoc,
  fromImageRefDoc
} from "./imageRef.js";

export {
  DEFAULT_CAMPAIGN_SCHEMA_VERSION,
  normalizeCampaign,
  validateCampaign,
  toCampaignDoc,
  fromCampaignDoc
} from "./campaign.js";

export {
  normalizeMember,
  validateMember,
  toMemberDoc,
  fromMemberDoc
} from "./member.js";

export {
  normalizeInviteEmail,
  toInviteEmailKey,
  normalizeInvite,
  validateInvite,
  toInviteDoc,
  fromInviteDoc
} from "./invite.js";

export {
  normalizeFormulaKey,
  normalizeCharacterAttributes,
  normalizeCharacterSkills,
  normalizeCharacter,
  validateCharacter,
  toCharacterDoc,
  fromCharacterDoc
} from "./character.js";

export {
  LEGACY_FOLDER_KEYS,
  normalizeFolder,
  validateFolder,
  toFolderDoc,
  fromFolderDoc
} from "./folder.js";

export {
  LEGACY_NOTE_KEYS,
  normalizeNote,
  validateNote,
  toNoteDoc,
  fromNoteDoc
} from "./note.js";

export {
  normalizeScene,
  validateScene,
  toSceneDoc,
  fromSceneDoc
} from "./scene.js";

export {
  normalizeCompendiumEntry,
  validateCompendiumEntry,
  toCompendiumEntryDoc,
  fromCompendiumEntryDoc
} from "./compendiumEntry.js";

export {
  normalizeMessage,
  validateMessage,
  toMessageDoc,
  fromMessageDoc
} from "./message.js";

export {
  normalizeMedia,
  validateMedia,
  expandMediaVisibleTo,
  validateMediaAudienceExpansion,
  hasRequiredMediaAudience,
  toMediaDoc,
  fromMediaDoc
} from "./media.js";

export {
  normalizeCombatant,
  normalizeTurnState,
  validateTurnState,
  toTurnStateDoc,
  fromTurnStateDoc
} from "./turnState.js";

export {
  normalizeChatState,
  validateChatState,
  toChatStateDoc,
  fromChatStateDoc
} from "./chatState.js";

export {
  normalizePendingCost,
  validatePendingCost,
  toPendingCostDoc,
  fromPendingCostDoc
} from "./pendingCost.js";

export {
  parseSemver,
  compareSemver,
  isClientVersionOutdated,
  normalizeAppConfig,
  validateAppConfig,
  toAppConfigDoc,
  fromAppConfigDoc
} from "./appConfig.js";

export {
  normalizePlatformAdmin,
  validatePlatformAdmin,
  toPlatformAdminDoc,
  fromPlatformAdminDoc
} from "./platformAdmin.js";

export {
  LEGACY_TOKEN_KEYS,
  normalizeToken,
  validateToken,
  normalizeTokenSecret,
  validateTokenSecret,
  projectPublicBars,
  resolveCharacterTokenImage,
  buildPcProjectionFromCharacter,
  splitTokenDoc,
  combineToken,
  toTokenDoc,
  fromTokenDoc,
  toTokenSecretDoc,
  fromTokenSecretDoc
} from "./token.js";

export {
  LEGACY_DRAWING_KEYS,
  normalizeDrawing,
  validateDrawing,
  toDrawingDoc,
  fromDrawingDoc
} from "./drawing.js";

export {
  LEGACY_PING_KEYS,
  normalizePing,
  validatePing,
  isPingExpired,
  toPingDoc,
  fromPingDoc
} from "./ping.js";

export {
  LEGACY_FOG_KEYS,
  normalizeFogArea,
  validateFogArea,
  normalizeFog,
  validateFog,
  getOrderedFogAreas,
  toFogDoc,
  fromFogDoc
} from "./fog.js";

export {
  normalizePresence,
  validatePresence,
  toPresenceDoc,
  fromPresenceDoc
} from "./presence.js";
