import M001Identity from "./M001-identity.mjs";
import M002Audience from "./M002-audience.mjs";
import M003Media from "./M003-media.mjs";
import M004CharactersV2 from "./M004-characters-v2.mjs";
import M005Folders from "./M005-folders.mjs";
import M006NotesV2 from "./M006-notes-v2.mjs";
import M007RtdbV2 from "./M007-rtdb-v2.mjs";
import M008MessagesV2 from "./M008-messages-v2.mjs";

export const MIGRATIONS = [
  M001Identity,
  M002Audience,
  M003Media,
  M004CharactersV2,
  M005Folders,
  M006NotesV2,
  M007RtdbV2,
  M008MessagesV2
];
