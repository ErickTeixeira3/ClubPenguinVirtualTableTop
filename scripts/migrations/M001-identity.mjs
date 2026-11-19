import { FieldValue } from "firebase-admin/firestore";
import {
  normalizeInvite,
  normalizeInviteEmail,
  toInviteDoc,
  toInviteEmailKey,
  validateInvite
} from "../../src/domain/models/invite.js";
import {
  normalizeMember,
  toMemberDoc,
  validateMember
} from "../../src/domain/models/member.js";
import { validatePlatformAdmin } from "../../src/domain/models/platformAdmin.js";
import { readAllAuthUsers } from "../lib/snapshot.mjs";

const LEGACY_MEMBER_KEYS = [
  "role",
  "email",
  "avatarMediaId",
  "photoURL",
  "avatarRemoved"
];

function extractMemberAvatar(player) {
  if (!player || typeof player !== "object") {
    return { mediaId: null, url: null };
  }
  if (player.avatarRemoved === true) {
    return { mediaId: null, url: null };
  }
  if (player.avatar && typeof player.avatar === "object") {
    const mediaId =
      typeof player.avatar.mediaId === "string" && player.avatar.mediaId.trim()
        ? player.avatar.mediaId.trim()
        : null;
    const url =
      !mediaId &&
      typeof player.avatar.url === "string" &&
      /^https?:\/\/\S+$/i.test(player.avatar.url.trim())
        ? player.avatar.url.trim()
        : null;
    return { mediaId, url };
  }
  if (typeof player.avatarMediaId === "string" && player.avatarMediaId.trim()) {
    return { mediaId: player.avatarMediaId.trim(), url: null };
  }
  if (
    typeof player.photoURL === "string" &&
    /^https?:\/\/\S+$/i.test(player.photoURL.trim())
  ) {
    return { mediaId: null, url: player.photoURL.trim() };
  }
  return { mediaId: null, url: null };
}

function sameAvatar(a, b) {
  return (a?.mediaId ?? null) === (b?.mediaId ?? null) && (a?.url ?? null) === (b?.url ?? null);
}

function needsMemberWrite(existing, target) {
  if (!existing) return true;
  if (existing.uid !== target.uid || existing.campaignId !== target.campaignId) {
    return true;
  }
  if ((existing.displayName || "") !== target.displayName) return true;
  if (!sameAvatar(existing.avatar, target.avatar)) return true;
  if ((existing.activeCharacterId ?? null) !== target.activeCharacterId) return true;
  return LEGACY_MEMBER_KEYS.some((key) => Object.hasOwn(existing, key));
}

function needsInviteWrite(existing, target) {
  if (!existing) return true;
  if (existing.email !== target.email || existing.campaignId !== target.campaignId) {
    return true;
  }
  if ((existing.defaultDisplayName || "") !== target.defaultDisplayName) return true;
  if ((existing.acceptedBy ?? null) !== target.acceptedBy) return true;
  return Object.hasOwn(existing, "role");
}

export default {
  id: "M001-identity",
  description:
    "Migra players -> members, authorizedUsers -> invites, seed platformAdmins, espelhos meta/* no RTDB e verifica e-mails dos membros atuais.",

  async plan({ firestore, database, auth }) {
    const operations = [];
    const summary = {
      campaignsProcessed: 0,
      campaignsCleaned: 0,
      membersWritten: 0,
      invitesWritten: 0,
      pendingInvitesMirrored: 0,
      platformAdminsSeeded: 0,
      platformAdminsRtdbMirrored: 0,
      authUsersToVerify: 0,
      rtdbMetaUpdates: 0
    };

    const authUsers = auth ? await readAllAuthUsers(auth) : [];
    const authByUid = new Map(authUsers.map((u) => [u.uid, u]));

    const fsAdminsSnap = await firestore.collection("platformAdmins").get();
    const knownFsAdmins = new Set(fsAdminsSnap.docs.map((d) => d.id));
    const rtdbAdmins = (await database.ref("platformAdmins").once("value")).val() || {};
    const plannedVerifyUids = new Set();

    const campaignsSnap = await firestore.collection("campaigns").get();
    for (const campDoc of campaignsSnap.docs) {
      summary.campaignsProcessed += 1;
      const campaignId = campDoc.id;
      const campData = campDoc.data() || {};

      const [membersSnap, invitesSnap, rtdbMetaSnap] = await Promise.all([
        campDoc.ref.collection("members").get(),
        campDoc.ref.collection("invites").get(),
        database.ref(`vtt_realtime/${campaignId}/meta`).once("value")
      ]);

      const existingMembers = new Map(membersSnap.docs.map((d) => [d.id, d.data() || {}]));
      const existingInvites = new Map(invitesSnap.docs.map((d) => [d.id, d.data() || {}]));
      const rtdbMeta = rtdbMetaSnap.val() || {};

      const emailToMemberUid = new Map();
      const memberUids = new Set(existingMembers.keys());

      for (const [uid, existingMember] of existingMembers.entries()) {
        const authUser = authByUid.get(uid);
        const emailLower = normalizeInviteEmail(authUser?.email || existingMember.email || "");
        if (emailLower) {
          emailToMemberUid.set(emailLower, uid);
        }
      }

      const gmUid = typeof campData.gmId === "string" ? campData.gmId.trim() : "";

      const rawPlayers =
        campData.players && typeof campData.players === "object" && !Array.isArray(campData.players)
          ? campData.players
          : {};

      const candidateMemberUids = new Set([
        ...existingMembers.keys(),
        ...Object.keys(rawPlayers)
      ]);
      if (gmUid) {
        candidateMemberUids.add(gmUid);
      }

      for (const uid of candidateMemberUids) {
        if (!uid) continue;
        const player = rawPlayers[uid] || existingMembers.get(uid) || {};
        memberUids.add(uid);
        const authUser = authByUid.get(uid);
        const emailLower = normalizeInviteEmail(player?.email || authUser?.email || "");
        if (emailLower) {
          emailToMemberUid.set(emailLower, uid);
        }

        const existing = existingMembers.get(uid) || null;
        const displayName =
          (typeof player?.displayName === "string" && player.displayName.trim()) ||
          (typeof existing?.displayName === "string" && existing.displayName.trim()) ||
          (typeof authUser?.displayName === "string" && authUser.displayName.trim()) ||
          (emailLower ? emailLower.split("@")[0] : "") ||
          "Pinguim";

        const memberEntity = normalizeMember(
          {
            uid,
            campaignId,
            displayName,
            avatar: extractMemberAvatar(player),
            activeCharacterId: player?.activeCharacterId ?? existing?.activeCharacterId ?? null,
            joinedAt:
              player?.joinedAt ??
              existing?.joinedAt ??
              FieldValue.serverTimestamp(),
            createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          { uid, campaignId }
        );

        const check = validateMember(memberEntity);
        if (!check.ok) {
          throw new Error(
            `M001-identity: membro inválido (${campaignId}/${uid}): ${check.errors.map((e) => e.message).join("; ")}`
          );
        }

        if (needsMemberWrite(existing, memberEntity)) {
          operations.push({
            kind: "fs.set",
            path: `campaigns/${campaignId}/members/${uid}`,
            data: toMemberDoc(memberEntity)
          });
          summary.membersWritten += 1;
        }
      }

      for (const uid of memberUids) {
        const authUser = authByUid.get(uid);
        if (authUser && !authUser.emailVerified && !plannedVerifyUids.has(uid)) {
          plannedVerifyUids.add(uid);
          operations.push({
            kind: "auth.verifyEmail",
            path: `auth/${uid}`,
            uid
          });
          summary.authUsersToVerify += 1;
        }
      }

      const desiredPendingInviteKeys = new Set();
      const authorizedUsersList = Array.isArray(campData.authorizedUsers)
        ? campData.authorizedUsers
        : campData.authorizedUsers && typeof campData.authorizedUsers === "object"
          ? Object.values(campData.authorizedUsers)
          : [];
      const rawAuthorizedUsers = [
        ...authorizedUsersList,
        ...(Array.isArray(campData.authorizedEmails) ? campData.authorizedEmails : [])
      ];

      const seenInviteEmails = new Set();
      for (const entry of rawAuthorizedUsers) {
        const rawEmail = typeof entry === "string" ? entry : entry?.email;
        const emailLower = normalizeInviteEmail(rawEmail);
        if (!emailLower || seenInviteEmails.has(emailLower)) continue;
        seenInviteEmails.add(emailLower);

        const emailKey = toInviteEmailKey(emailLower);
        const existingInv = existingInvites.get(emailLower) || null;
        const acceptedBy =
          emailToMemberUid.get(emailLower) ?? existingInv?.acceptedBy ?? null;
        const defaultDisplayName =
          (typeof entry === "object" &&
            typeof entry?.defaultDisplayName === "string" &&
            entry.defaultDisplayName.trim()) ||
          existingInv?.defaultDisplayName ||
          emailLower.split("@")[0] ||
          "Pinguim";

        const inviteEntity = normalizeInvite(
          {
            email: emailLower,
            campaignId,
            defaultDisplayName,
            acceptedBy,
            createdAt: existingInv?.createdAt ?? FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
          },
          { emailLower, campaignId }
        );

        const invCheck = validateInvite(inviteEntity);
        if (!invCheck.ok) {
          throw new Error(
            `M001-identity: convite inválido (${campaignId}/${emailLower}): ${invCheck.errors.map((e) => e.message).join("; ")}`
          );
        }

        if (needsInviteWrite(existingInv, inviteEntity)) {
          operations.push({
            kind: "fs.set",
            path: `campaigns/${campaignId}/invites/${emailLower}`,
            data: toInviteDoc(inviteEntity)
          });
          summary.invitesWritten += 1;
        }

        if (acceptedBy === null) {
          desiredPendingInviteKeys.add(emailKey);
        }
      }

      for (const [emailLower, existingInv] of existingInvites.entries()) {
        if (!existingInv.acceptedBy) {
          desiredPendingInviteKeys.add(toInviteEmailKey(emailLower));
        }
      }

      summary.pendingInvitesMirrored += desiredPendingInviteKeys.size;

      if (gmUid) {
        const adminCheck = validatePlatformAdmin(
          { uid: gmUid, createdAt: null },
          { docId: gmUid }
        );
        if (!adminCheck.ok) {
          throw new Error(
            `M001-identity: gmId inválido em campaigns/${campaignId}.`
          );
        }

        if (!knownFsAdmins.has(gmUid)) {
          knownFsAdmins.add(gmUid);
          operations.push({
            kind: "fs.set",
            path: `platformAdmins/${gmUid}`,
            data: {
              uid: gmUid,
              createdAt: FieldValue.serverTimestamp()
            }
          });
          summary.platformAdminsSeeded += 1;
        }

        if (rtdbAdmins[gmUid] !== true) {
          rtdbAdmins[gmUid] = true;
          operations.push({
            kind: "rtdb.set",
            path: `platformAdmins/${gmUid}`,
            data: true
          });
          summary.platformAdminsRtdbMirrored += 1;
        }
      }

      const metaUpdates = {};
      if (gmUid && rtdbMeta.gmId !== gmUid) {
        metaUpdates.gmId = gmUid;
      }

      const rtdbMembers =
        rtdbMeta.members && typeof rtdbMeta.members === "object"
          ? rtdbMeta.members
          : {};
      for (const uid of memberUids) {
        if (rtdbMembers[uid] !== true) {
          metaUpdates[`members/${uid}`] = true;
        }
      }
      for (const existingUid of Object.keys(rtdbMembers)) {
        if (!memberUids.has(existingUid)) {
          metaUpdates[`members/${existingUid}`] = null;
        }
      }

      const rtdbInvites =
        rtdbMeta.invites && typeof rtdbMeta.invites === "object"
          ? rtdbMeta.invites
          : {};
      for (const emailKey of desiredPendingInviteKeys) {
        if (rtdbInvites[emailKey] !== true) {
          metaUpdates[`invites/${emailKey}`] = true;
        }
      }
      for (const existingKey of Object.keys(rtdbInvites)) {
        if (!desiredPendingInviteKeys.has(existingKey)) {
          metaUpdates[`invites/${existingKey}`] = null;
        }
      }

      if (Object.keys(metaUpdates).length > 0) {
        operations.push({
          kind: "rtdb.update",
          path: `vtt_realtime/${campaignId}/meta`,
          data: metaUpdates
        });
        summary.rtdbMetaUpdates += 1;
      }

      const campUpdates = {};
      if (Object.hasOwn(campData, "players")) {
        campUpdates.players = FieldValue.delete();
      }
      if (Object.hasOwn(campData, "authorizedUsers")) {
        campUpdates.authorizedUsers = FieldValue.delete();
      }
      if (Object.hasOwn(campData, "authorizedEmails")) {
        campUpdates.authorizedEmails = FieldValue.delete();
      }
      if (campData.campaignId !== campaignId) {
        campUpdates.campaignId = campaignId;
      }
      if (typeof campData.schemaVersion !== "number" || campData.schemaVersion < 2) {
        campUpdates.schemaVersion = 2;
      }

      if (Object.keys(campUpdates).length > 0) {
        campUpdates.updatedAt = FieldValue.serverTimestamp();
        operations.push({
          kind: "fs.update",
          path: `campaigns/${campaignId}`,
          data: campUpdates
        });
        summary.campaignsCleaned += 1;
      }
    }

    return { operations, summary };
  }
};
