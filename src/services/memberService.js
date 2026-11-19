import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import {
  get as rtdbGet,
  ref as rtdbRef,
  remove as rtdbRemove,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import { ID_PREFIXES } from "../domain/constants.js";
import { AppError, ERROR_CODES } from "../domain/errors.js";
import {
  DEFAULT_CAMPAIGN_SCHEMA_VERSION,
  normalizeCampaign,
  toCampaignDoc
} from "../domain/models/campaign.js";
import {
  normalizeInvite,
  normalizeInviteEmail,
  toInviteDoc,
  toInviteEmailKey
} from "../domain/models/invite.js";
import { normalizeMember, toMemberDoc } from "../domain/models/member.js";
import { inviteConverter, memberConverter } from "../infra/converters/index.js";
import { db, rtdb } from "../infra/firebase.js";
import {
  campaignDocPath,
  chatStateDocPath,
  inviteDocPath,
  invitesCollectionPath,
  memberDocPath,
  membersCollectionPath,
  platformAdminDocPath
} from "../infra/firestorePaths.js";
import { createId } from "../infra/ids.js";
import {
  campaignRtdbRootPath,
  gmMetaPath,
  inviteMetaPath,
  invitesMetaRootPath,
  memberMetaPath,
  membersMetaRootPath,
  metaRootPath,
  pendingGmMetaPath,
  presenceRootPath
} from "../infra/rtdbPaths.js";
import { assertClientUpToDate } from "./runtimeConfigService.js";

function isPermissionDeniedError(err) {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  return (
    code.includes("permission-denied") ||
    code.includes("permission_denied") ||
    msg.includes("permission_denied") ||
    msg.includes("permission denied")
  );
}

function toSafeHttpUrl(url) {
  return typeof url === "string" &&
    /^https?:\/\//i.test(url) &&
    url.length < 2000
    ? url
    : null;
}

export async function isPlatformAdmin(uid, { firestoreDb = db } = {}) {
  if (!uid) return false;
  const snap = await getDoc(doc(firestoreDb, platformAdminDocPath(uid)));
  return snap.exists();
}

export async function checkCampaignMembership({
  campaignId,
  uid,
  firestoreDb = db
}) {
  if (!campaignId || !uid) {
    return { isMember: false, member: null };
  }
  const ref = doc(firestoreDb, memberDocPath(campaignId, uid)).withConverter(
    memberConverter
  );
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return { isMember: false, member: null };
    }
    return { isMember: true, member: snap.data() };
  } catch (err) {
    if (err?.code === "permission-denied") {
      return { isMember: false, member: null };
    }
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Não foi possível verificar a associação à campanha.",
      { campaignId, uid },
      { cause: err }
    );
  }
}

export async function joinWithInvite({
  campaignId,
  user,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !user?.uid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Usuário e campanha são obrigatórios para entrar."
    );
  }
  if (user.emailVerified !== true) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Verifique seu e-mail antes de entrar na campanha."
    );
  }

  const membership = await checkCampaignMembership({
    campaignId,
    uid: user.uid,
    firestoreDb
  });

  if (membership.isMember) {
    const memberMirrorRef = rtdbRef(
      realtimeDb,
      memberMetaPath(campaignId, user.uid)
    );
    try {
      const mirrorSnap = await rtdbGet(memberMirrorRef);
      if (mirrorSnap.val() === true) {
        return { status: "already_member", member: membership.member };
      }
    } catch (err) {
      if (!isPermissionDeniedError(err)) {
        throw err;
      }
      // Se ainda não tiver leitura no espelho RTDB, tenta gravar o espelho abaixo.
    }
    await rtdbSet(memberMirrorRef, true);
    return { status: "already_member", member: membership.member };
  }

  const emailLower = normalizeInviteEmail(user.email);
  if (!emailLower) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Acesso restrito: conta sem e-mail verificado."
    );
  }

  const inviteRef = doc(
    firestoreDb,
    inviteDocPath(campaignId, emailLower)
  ).withConverter(inviteConverter);

  let inviteSnap;
  try {
    inviteSnap = await getDoc(inviteRef);
  } catch (err) {
    if (err?.code === "permission-denied") {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Acesso restrito: este e-mail não foi convidado para esta campanha.",
        { campaignId },
        { cause: err }
      );
    }
    throw err;
  }

  if (!inviteSnap.exists()) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Acesso restrito: este e-mail não foi convidado para esta campanha.",
      { campaignId }
    );
  }

  const invite = inviteSnap.data();
  if (invite.acceptedBy && invite.acceptedBy !== user.uid) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Este convite já foi utilizado por outra conta.",
      { campaignId }
    );
  }

  const displayName =
    (typeof user.displayName === "string" && user.displayName.trim()) ||
    invite.defaultDisplayName ||
    emailLower.split("@")[0] ||
    "Pinguim";

  const memberEntity = normalizeMember(
    {
      uid: user.uid,
      campaignId,
      displayName,
      avatar: {
        mediaId: null,
        url: toSafeHttpUrl(user.photoURL)
      },
      activeCharacterId: null,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { uid: user.uid, campaignId }
  );

  const batch = writeBatch(firestoreDb);
  batch.set(
    doc(firestoreDb, memberDocPath(campaignId, user.uid)),
    toMemberDoc(memberEntity)
  );
  batch.update(doc(firestoreDb, inviteDocPath(campaignId, emailLower)), {
    acceptedBy: user.uid,
    updatedAt: serverTimestamp()
  });
  await batch.commit();

  await rtdbSet(rtdbRef(realtimeDb, memberMetaPath(campaignId, user.uid)), true);
  return { status: "joined", member: memberEntity };
}

export async function ensureCampaignSession({
  campaignId,
  user,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  if (!campaignId || !user?.uid) {
    return {
      joined: false,
      isPlatformAdmin: false,
      error: new AppError(ERROR_CODES.PERMISSION_DENIED, "Sessão inválida.")
    };
  }

  try {
    const res = await joinWithInvite({
      campaignId,
      user,
      firestoreDb,
      realtimeDb
    });
    return {
      joined: true,
      status: res.status,
      member: res.member,
      isPlatformAdmin: false,
      error: null
    };
  } catch (err) {
    if (err?.code === ERROR_CODES.PERMISSION_DENIED) {
      let admin = false;
      try {
        admin = await isPlatformAdmin(user.uid, { firestoreDb });
      } catch (adminErr) {
        if (!isPermissionDeniedError(adminErr)) {
          throw adminErr;
        }
      }
      return {
        joined: false,
        status: "denied",
        member: null,
        isPlatformAdmin: admin,
        error: err
      };
    }
    throw err;
  }
}

export async function createCampaign({
  campaignId = null,
  name,
  user,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!user?.uid) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Faça login para criar uma campanha."
    );
  }
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (!cleanName) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Informe o nome da campanha."
    );
  }

  const admin = await isPlatformAdmin(user.uid, { firestoreDb });
  if (!admin) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Apenas administradores da plataforma podem criar campanhas."
    );
  }

  const targetCampaignId =
    typeof campaignId === "string" && campaignId.trim()
      ? campaignId.trim()
      : createId(ID_PREFIXES.CAMPAIGN);

  const campaignEntity = normalizeCampaign(
    {
      id: targetCampaignId,
      campaignId: targetCampaignId,
      name: cleanName,
      gmId: user.uid,
      activeSceneId: null,
      schemaVersion: DEFAULT_CAMPAIGN_SCHEMA_VERSION,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { id: targetCampaignId }
  );

  const displayName =
    (typeof user.displayName === "string" && user.displayName.trim()) ||
    user.email?.split("@")[0] ||
    "Mestre";

  const memberEntity = normalizeMember(
    {
      uid: user.uid,
      campaignId: targetCampaignId,
      displayName,
      avatar: {
        mediaId: null,
        url: toSafeHttpUrl(user.photoURL)
      },
      activeCharacterId: null,
      joinedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { uid: user.uid, campaignId: targetCampaignId }
  );

  const batch = writeBatch(firestoreDb);
  batch.set(
    doc(firestoreDb, campaignDocPath(targetCampaignId)),
    toCampaignDoc(campaignEntity)
  );
  batch.set(
    doc(firestoreDb, memberDocPath(targetCampaignId, user.uid)),
    toMemberDoc(memberEntity)
  );
  batch.set(doc(firestoreDb, chatStateDocPath(targetCampaignId)), {
    campaignId: targetCampaignId,
    lastSeq: 0,
    lastMessageId: null
  });
  try {
    await batch.commit();
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      throw new AppError(
        ERROR_CODES.PERMISSION_DENIED,
        "Não foi possível criar esta campanha. O identificador já pode existir ou exigir permissão de administrador.",
        { campaignId: targetCampaignId },
        { cause: err }
      );
    }
    throw err;
  }

  await rtdbUpdate(rtdbRef(realtimeDb, metaRootPath(targetCampaignId)), {
    gmId: user.uid,
    [`members/${user.uid}`]: true
  });

  return { campaignId: targetCampaignId, gmId: user.uid };
}

export async function inviteMember({
  campaignId,
  email,
  defaultDisplayName = "",
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  const emailLower = normalizeInviteEmail(email);
  const emailKey = toInviteEmailKey(emailLower);
  const cleanName =
    String(defaultDisplayName || "").trim() ||
    emailLower.split("@")[0] ||
    "Pinguim";

  const inviteRef = doc(firestoreDb, inviteDocPath(campaignId, emailLower));
  const existing = await getDoc(inviteRef);
  if (existing.exists() && existing.data()?.acceptedBy) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Este e-mail já pertence a um membro ativo da campanha."
    );
  }

  const inviteEntity = normalizeInvite(
    {
      email: emailLower,
      campaignId,
      defaultDisplayName: cleanName,
      acceptedBy: null,
      createdAt: existing.exists()
        ? existing.data()?.createdAt ?? serverTimestamp()
        : serverTimestamp(),
      updatedAt: serverTimestamp()
    },
    { emailLower, campaignId }
  );

  await setDoc(inviteRef, toInviteDoc(inviteEntity));
  await rtdbSet(rtdbRef(realtimeDb, inviteMetaPath(campaignId, emailKey)), true);

  return { email: emailLower, emailKey, defaultDisplayName: cleanName };
}

export async function revokeMember({
  campaignId,
  targetUid,
  currentGmId = null,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !targetUid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Campanha e UID do membro são obrigatórios."
    );
  }
  if (currentGmId && targetUid === currentGmId) {
    throw new AppError(
      ERROR_CODES.PERMISSION_DENIED,
      "Transfira o papel de Mestre antes de remover este membro."
    );
  }

  const invitesSnap = await getDocs(
    query(
      collection(firestoreDb, invitesCollectionPath(campaignId)),
      where("acceptedBy", "==", targetUid)
    )
  );

  const batch = writeBatch(firestoreDb);
  batch.delete(doc(firestoreDb, memberDocPath(campaignId, targetUid)));

  const emailKeys = [];
  for (const invDoc of invitesSnap.docs) {
    batch.delete(invDoc.ref);
    emailKeys.push(toInviteEmailKey(invDoc.id));
  }
  await batch.commit();

  const rtdbUpdates = {
    [`meta/members/${targetUid}`]: null,
    [`presence/${targetUid}`]: null
  };
  for (const emailKey of emailKeys) {
    rtdbUpdates[`meta/invites/${emailKey}`] = null;
  }
  await rtdbUpdate(
    rtdbRef(realtimeDb, campaignRtdbRootPath(campaignId)),
    rtdbUpdates
  );

  return { uid: targetUid, removedInvites: emailKeys.length };
}

export async function revokeInvite({
  campaignId,
  email,
  currentGmId = null,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  const emailLower = normalizeInviteEmail(email);
  const emailKey = toInviteEmailKey(emailLower);
  const inviteRef = doc(firestoreDb, inviteDocPath(campaignId, emailLower));
  const inviteSnap = await getDoc(inviteRef);

  if (inviteSnap.exists() && inviteSnap.data()?.acceptedBy) {
    return revokeMember({
      campaignId,
      targetUid: inviteSnap.data().acceptedBy,
      currentGmId,
      firestoreDb,
      realtimeDb
    });
  }

  await deleteDoc(inviteRef);
  await rtdbRemove(rtdbRef(realtimeDb, inviteMetaPath(campaignId, emailKey)));
  return { email: emailLower, emailKey, revokedMember: false };
}

export async function assignGM({
  campaignId,
  currentGmId,
  targetUid,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  assertClientUpToDate();
  if (!campaignId || !targetUid) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Campanha e membro alvo são obrigatórios."
    );
  }
  if (targetUid === currentGmId) {
    return { gmId: targetUid };
  }

  const targetMembership = await checkCampaignMembership({
    campaignId,
    uid: targetUid,
    firestoreDb
  });
  if (!targetMembership.isMember) {
    throw new AppError(
      ERROR_CODES.NOT_FOUND,
      "O usuário selecionado não é membro desta campanha."
    );
  }

  const pendingRef = rtdbRef(realtimeDb, pendingGmMetaPath(campaignId));
  await rtdbSet(pendingRef, targetUid);

  try {
    await updateDoc(doc(firestoreDb, campaignDocPath(campaignId)), {
      gmId: targetUid,
      updatedAt: serverTimestamp()
    });
  } catch (err) {
    try {
      await rtdbSet(pendingRef, null);
    } catch (rollbackErr) {
      throw new AppError(
        ERROR_CODES.INVALID_STATE,
        err?.message || "Falha ao transferir o Mestre e limpar pendência no RTDB.",
        { campaignId, targetUid, rollbackError: rollbackErr },
        { cause: err }
      );
    }
    throw err;
  }

  try {
    await rtdbUpdate(rtdbRef(realtimeDb, metaRootPath(campaignId)), {
      gmId: targetUid,
      pendingGm: null
    });
  } catch (err) {
    if (isPermissionDeniedError(err)) {
      const currentRtdbGmSnap = await rtdbGet(
        rtdbRef(realtimeDb, gmMetaPath(campaignId))
      );
      if (currentRtdbGmSnap.val() === targetUid) {
        return { gmId: targetUid };
      }
    }
    throw err;
  }

  return { gmId: targetUid };
}

export async function completePendingGmTransfer({
  campaignId,
  uid,
  campaignGmId,
  realtimeDb = rtdb
}) {
  if (!campaignId || !uid || campaignGmId !== uid) {
    return false;
  }
  const [gmSnap, pendingSnap] = await Promise.all([
    rtdbGet(rtdbRef(realtimeDb, gmMetaPath(campaignId))),
    rtdbGet(rtdbRef(realtimeDb, pendingGmMetaPath(campaignId)))
  ]);
  if (gmSnap.val() !== uid && pendingSnap.val() === uid) {
    await rtdbUpdate(rtdbRef(realtimeDb, metaRootPath(campaignId)), {
      gmId: uid,
      pendingGm: null
    });
    return true;
  }
  return false;
}

export async function reconcileMirrors({
  campaignId,
  currentUid,
  campaignGmId,
  firestoreDb = db,
  realtimeDb = rtdb
}) {
  if (!campaignId || !currentUid || campaignGmId !== currentUid) {
    return { changed: false, updatedKeys: [] };
  }

  await completePendingGmTransfer({
    campaignId,
    uid: currentUid,
    campaignGmId,
    realtimeDb
  });

  const [
    membersSnap,
    invitesSnap,
    rtdbMembersSnap,
    rtdbInvitesSnap,
    rtdbGmSnap,
    rtdbPendingSnap,
    rtdbPresenceSnap
  ] = await Promise.all([
    getDocs(collection(firestoreDb, membersCollectionPath(campaignId))),
    getDocs(collection(firestoreDb, invitesCollectionPath(campaignId))),
    rtdbGet(rtdbRef(realtimeDb, membersMetaRootPath(campaignId))),
    rtdbGet(rtdbRef(realtimeDb, invitesMetaRootPath(campaignId))).catch((err) => {
      if (isPermissionDeniedError(err)) return { val: () => null };
      throw err;
    }),
    rtdbGet(rtdbRef(realtimeDb, gmMetaPath(campaignId))),
    rtdbGet(rtdbRef(realtimeDb, pendingGmMetaPath(campaignId))),
    rtdbGet(rtdbRef(realtimeDb, presenceRootPath(campaignId)))
  ]);

  const rootUpdates = {};
  const firestoreMemberIds = new Set(membersSnap.docs.map((d) => d.id));
  const rtdbMembers = rtdbMembersSnap.val() || {};

  for (const uid of Object.keys(rtdbMembers)) {
    if (!firestoreMemberIds.has(uid)) {
      rootUpdates[`meta/members/${uid}`] = null;
    }
  }
  for (const uid of firestoreMemberIds) {
    if (rtdbMembers[uid] !== true) {
      rootUpdates[`meta/members/${uid}`] = true;
    }
  }

  const rtdbPresence = rtdbPresenceSnap.val() || {};
  for (const uid of Object.keys(rtdbPresence)) {
    if (!firestoreMemberIds.has(uid)) {
      rootUpdates[`presence/${uid}`] = null;
    }
  }

  const pendingInvitesMap = {};
  for (const invDoc of invitesSnap.docs) {
    const data = invDoc.data();
    if (!data?.acceptedBy) {
      pendingInvitesMap[toInviteEmailKey(invDoc.id)] = true;
    }
  }
  const rtdbInvites = rtdbInvitesSnap?.val?.();
  if (rtdbInvites && typeof rtdbInvites === "object") {
    for (const existingKey of Object.keys(rtdbInvites)) {
      if (!Object.hasOwn(pendingInvitesMap, existingKey)) {
        rootUpdates[`meta/invites/${existingKey}`] = null;
      }
    }
    for (const key of Object.keys(pendingInvitesMap)) {
      if (rtdbInvites[key] !== true) {
        rootUpdates[`meta/invites/${key}`] = true;
      }
    }
  } else {
    // meta/invites tem `.read: false` nas regras para clientes autenticados: sincroniza somente se houver convites ou para garantir ausência
    const currentInvitesTarget =
      Object.keys(pendingInvitesMap).length > 0 ? pendingInvitesMap : null;
    if (currentInvitesTarget !== null) {
      rootUpdates["meta/invites"] = currentInvitesTarget;
    } else {
      rootUpdates["meta/invites"] = null;
    }
  }

  if (rtdbGmSnap.val() !== campaignGmId) {
    rootUpdates["meta/gmId"] = campaignGmId;
  }
  if (rtdbPendingSnap.val() && rtdbGmSnap.val() === campaignGmId) {
    rootUpdates["meta/pendingGm"] = null;
  }

  if (Object.keys(rootUpdates).length === 0) {
    return { changed: false, updatedKeys: [] };
  }

  await rtdbUpdate(
    rtdbRef(realtimeDb, campaignRtdbRootPath(campaignId)),
    rootUpdates
  );

  return { changed: true, updatedKeys: Object.keys(rootUpdates) };
}

export function subscribeMembers({
  campaignId,
  firestoreDb = db,
  onData,
  onError
}) {
  const colRef = collection(
    firestoreDb,
    membersCollectionPath(campaignId)
  ).withConverter(memberConverter);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data());
      onData?.(list);
    },
    (err) => {
      onError?.(err);
    }
  );
}

export function subscribeInvites({
  campaignId,
  firestoreDb = db,
  onData,
  onError
}) {
  const colRef = collection(
    firestoreDb,
    invitesCollectionPath(campaignId)
  ).withConverter(inviteConverter);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list = snapshot.docs.map((d) => d.data());
      onData?.(list);
    },
    (err) => {
      onError?.(err);
    }
  );
}

// TRANSITION(T1): adaptador de members -> playersMap para consumidores ainda v1 (remover na Fase 11)
export function buildPlayersMapFromMembers(
  members = [],
  gmId = null,
  resolvedAvatars = {}
) {
  const map = {};
  for (const member of members) {
    if (!member?.uid) continue;
    const avatarMediaId = member.avatar?.mediaId || null;
    const externalUrl = member.avatar?.url || null;
    const resolvedMediaUrl = avatarMediaId
      ? resolvedAvatars[avatarMediaId] || null
      : null;
    const photoURL = resolvedMediaUrl || externalUrl || null;
    const avatarRemoved = !avatarMediaId && !externalUrl;
    map[member.uid] = {
      uid: member.uid,
      displayName: member.displayName || "Pinguim",
      avatar: member.avatar || { mediaId: null, url: null },
      avatarMediaId,
      photoURL,
      avatarRemoved,
      activeCharacterId: member.activeCharacterId ?? null,
      joinedAt: member.joinedAt ?? null,
      role: gmId && member.uid === gmId ? "gm" : "player"
    };
  }
  return map;
}
