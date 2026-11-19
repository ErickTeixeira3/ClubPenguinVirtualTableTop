// Adversarial Security Rules + Services + Presence tests para a Fase 3 (Apêndice B, blocos B1 e B2).
import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import { deleteApp, initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import {
  connectDatabaseEmulator,
  get as rtdbGet,
  getDatabase,
  ref as rtdbRef,
  set as rtdbSet,
  update as rtdbUpdate
} from "firebase/database";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch
} from "firebase/firestore";
import { deleteApp as deleteAdminApp, initializeApp as initializeAdminApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PRESENCE_KINDS } from "../../src/domain/constants.js";
import { ERROR_CODES } from "../../src/domain/errors.js";
import { toInviteEmailKey } from "../../src/domain/models/invite.js";
import {
  registerWithEmail,
  reloadCurrentUser
} from "../../src/services/authService.js";
import {
  assignGM,
  completePendingGmTransfer,
  createCampaign,
  ensureCampaignSession,
  inviteMember,
  joinWithInvite,
  reconcileMirrors,
  revokeInvite,
  revokeMember
} from "../../src/services/memberService.js";
import {
  buildOnlineUsersMap,
  connectPresence,
  hasSheetConnectionOpen
} from "../../src/services/presenceService.js";

vi.mock("../../src/infra/firebase.js", () => ({
  db: {},
  rtdb: {},
  auth: { currentUser: null },
  DEFAULT_CAMPAIGN_ID: "main-table"
}));

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const CAMPAIGN = "main-table";
let env;

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const ctxAs = (uid, tokenOptions = {}) => env.authenticatedContext(uid, tokenOptions);
const fsAs = (uid, tokenOptions = {}) => ctxAs(uid, tokenOptions).firestore();
const rtAs = (uid, tokenOptions = {}) => ctxAs(uid, tokenOptions).database();
const rt = (suffix) => `vtt_realtime/${CAMPAIGN}/${suffix}`;

async function seedCampaignWithGm(gmUid = "gm_a") {
  await seed(async (ctx) => {
    const adminFs = ctx.firestore();
    const adminRt = ctx.database();
    await setDoc(doc(adminFs, `platformAdmins/${gmUid}`), {
      uid: gmUid,
      createdAt: serverTimestamp()
    });
    await setDoc(doc(adminFs, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      name: "Mesa Secreta",
      gmId: gmUid,
      activeSceneId: null,
      schemaVersion: 2
    });
    await setDoc(doc(adminFs, `campaigns/${CAMPAIGN}/members/${gmUid}`), {
      uid: gmUid,
      campaignId: CAMPAIGN,
      displayName: "Mestre A",
      avatar: { mediaId: null, url: null },
      activeCharacterId: null
    });
    await rtdbSet(rtdbRef(adminRt, `platformAdmins/${gmUid}`), true);
    await rtdbSet(rtdbRef(adminRt, rt("meta")), {
      gmId: gmUid,
      members: { [gmUid]: true }
    });
  });
}

async function seedMember(uid, displayName = uid) {
  await seed(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/members/${uid}`), {
      uid,
      campaignId: CAMPAIGN,
      displayName,
      avatar: { mediaId: null, url: null },
      activeCharacterId: null
    });
    await rtdbSet(rtdbRef(ctx.database(), rt(`meta/members/${uid}`)), true);
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cpvtt-test",
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
    },
    database: {
      rules: fs.readFileSync(path.join(repoRoot, "database.rules.json"), "utf8")
    }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
});

describe("B1 — Identidade e associação à campanha", () => {
  it("B1.1: conta autenticada não membro não lê nem cria nada no Firestore ou RTDB", async () => {
    await seedCampaignWithGm("gm_a");
    await seed(async (ctx) => {
      const f = ctx.firestore();
      const r = ctx.database();
      await setDoc(doc(f, `campaigns/${CAMPAIGN}/characters/c1`), {
        name: "Ficha",
        ownerId: "gm_a",
        visibleTo: ["ALL"]
      });
      await setDoc(doc(f, `campaigns/${CAMPAIGN}/notes/n1`), {
        title: "Nota",
        ownerId: "gm_a",
        scope: "party",
        visibleTo: ["ALL"]
      });
      await setDoc(doc(f, `campaigns/${CAMPAIGN}/media/m1`), {
        uploadedBy: "gm_a",
        sizeBytes: 100
      });
      await rtdbSet(rtdbRef(r, rt("tokens/s1/t1")), { ownerId: "gm_a", layer: "tokens", x: 10 });
    });

    const strangerFs = fsAs("stranger", { email: "stranger@example.com", email_verified: true });
    const strangerRt = rtAs("stranger", { email: "stranger@example.com", email_verified: true });

    await assertFails(getDoc(doc(strangerFs, "platformAdmins/gm_a")));
    await assertFails(getDoc(doc(strangerFs, `campaigns/${CAMPAIGN}`)));
    await assertFails(getDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/members/gm_a`)));
    await assertFails(getDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/characters/c1`)));
    await assertFails(getDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/notes/n1`)));
    await assertFails(getDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/media/m1`)));

    await assertFails(
      setDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/characters/c_bad`), { ownerId: "stranger" })
    );
    await assertFails(
      setDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/messages/msg_bad`), { senderId: "stranger" })
    );
    await assertFails(
      setDoc(doc(strangerFs, `campaigns/${CAMPAIGN}/media/med_bad`), { sizeBytes: 100 })
    );

    await assertFails(rtdbGet(rtdbRef(strangerRt, "platformAdmins/gm_a")));
    await assertFails(rtdbGet(rtdbRef(strangerRt, rt("meta/gmId"))));
    await assertFails(rtdbGet(rtdbRef(strangerRt, rt("meta/members"))));
    await assertFails(rtdbGet(rtdbRef(strangerRt, rt("tokens/s1"))));
    await assertFails(rtdbGet(rtdbRef(strangerRt, rt("presence"))));
    await assertFails(
      rtdbSet(rtdbRef(strangerRt, rt("drawings/s1/d1")), { authorId: "stranger", layer: "tokens" })
    );
    await assertFails(
      rtdbSet(rtdbRef(strangerRt, rt("pings/s1/p1")), { authorId: "stranger" })
    );

    // Sem autenticação nem appConfig/runtime lê
    const unauthFs = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(unauthFs, "appConfig/runtime")));
    await assertSucceeds(getDoc(doc(strangerFs, "appConfig/runtime")));
  });

  it("B1.2 e B1.3: e-mail não verificado com convite ou e-mail verificado sem convite são bloqueados", async () => {
    await seedCampaignWithGm("gm_a");
    await inviteMember({
      campaignId: CAMPAIGN,
      email: "unverified@example.com",
      defaultDisplayName: "Sem Verif",
      firestoreDb: fsAs("gm_a"),
      realtimeDb: rtAs("gm_a")
    });

    const unverifiedFs = fsAs("u_unver", {
      email: "unverified@example.com",
      email_verified: false
    });
    const unverifiedRt = rtAs("u_unver", {
      email: "unverified@example.com",
      email_verified: false
    });

    const batch = writeBatch(unverifiedFs);
    batch.set(doc(unverifiedFs, `campaigns/${CAMPAIGN}/members/u_unver`), {
      uid: "u_unver",
      campaignId: CAMPAIGN,
      displayName: "Sem Verif",
      avatar: { mediaId: null, url: null }
    });
    batch.update(doc(unverifiedFs, `campaigns/${CAMPAIGN}/invites/unverified@example.com`), {
      acceptedBy: "u_unver"
    });
    await assertFails(batch.commit());
    await assertFails(rtdbSet(rtdbRef(unverifiedRt, rt("meta/members/u_unver")), true));

    await expect(
      joinWithInvite({
        campaignId: CAMPAIGN,
        user: { uid: "u_unver", email: "unverified@example.com", emailVerified: false },
        firestoreDb: unverifiedFs,
        realtimeDb: unverifiedRt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    // Verificado mas sem convite
    const noInviteFs = fsAs("u_noinv", {
      email: "nobody@example.com",
      email_verified: true
    });
    const noInviteRt = rtAs("u_noinv", {
      email: "nobody@example.com",
      email_verified: true
    });
    await assertFails(
      setDoc(doc(noInviteFs, `campaigns/${CAMPAIGN}/members/u_noinv`), {
        uid: "u_noinv",
        campaignId: CAMPAIGN,
        displayName: "Intruso",
        avatar: { mediaId: null, url: null }
      })
    );
    await assertFails(rtdbSet(rtdbRef(noInviteRt, rt("meta/members/u_noinv")), true));
    await expect(
      joinWithInvite({
        campaignId: CAMPAIGN,
        user: { uid: "u_noinv", email: "nobody@example.com", emailVerified: true },
        firestoreDb: noInviteFs,
        realtimeDb: noInviteRt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });
  });

  it("B1.4 e B1.5: membro não cria campanha sem ser platformAdmin e não altera gmId nem grava members/{outro}", async () => {
    await seedCampaignWithGm("gm_a");
    await seedMember("p1", "Jogador 1");

    const p1Fs = fsAs("p1", { email: "p1@example.com", email_verified: true });
    const p1Rt = rtAs("p1", { email: "p1@example.com", email_verified: true });

    await expect(
      createCampaign({
        campaignId: "camp_pirata",
        name: "Pirata",
        user: { uid: "p1", email: "p1@example.com", emailVerified: true },
        firestoreDb: p1Fs,
        realtimeDb: p1Rt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    const pirataBatch = writeBatch(p1Fs);
    pirataBatch.set(doc(p1Fs, "campaigns/camp_pirata"), {
      campaignId: "camp_pirata",
      name: "Pirata",
      gmId: "p1"
    });
    pirataBatch.set(doc(p1Fs, "campaigns/camp_pirata/members/p1"), {
      uid: "p1",
      campaignId: "camp_pirata",
      displayName: "P1",
      avatar: { mediaId: null, url: null }
    });
    await assertFails(pirataBatch.commit());

    await assertFails(
      setDoc(doc(p1Fs, `campaigns/${CAMPAIGN}/members/p2`), {
        uid: "p2",
        campaignId: CAMPAIGN,
        displayName: "Forjado",
        avatar: { mediaId: null, url: null }
      })
    );
    await assertFails(updateDoc(doc(p1Fs, `campaigns/${CAMPAIGN}`), { gmId: "p1" }));
    await assertFails(setDoc(doc(p1Fs, "platformAdmins/p1"), { uid: "p1" }));
  });

  it("B1.6 e B1.7: manipulação de convite é negada; joinWithInvite legítimo (incluindo e-mail com múltiplos pontos) e remoção prévia funcionam", async () => {
    await seedCampaignWithGm("gm_a");
    const gmFs = fsAs("gm_a");
    const gmRt = rtAs("gm_a");

    const aliceEmail = "first.last@sub.example.com";
    const bobEmail = "bob@example.com";
    const carolEmail = "carol@example.com";

    await inviteMember({
      campaignId: CAMPAIGN,
      email: aliceEmail,
      defaultDisplayName: "Alice",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    await inviteMember({
      campaignId: CAMPAIGN,
      email: bobEmail,
      defaultDisplayName: "Bob",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    await inviteMember({
      campaignId: CAMPAIGN,
      email: carolEmail,
      defaultDisplayName: "Carol",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });

    const aliceFs = fsAs("u_alice", { email: aliceEmail, email_verified: true });
    const aliceRt = rtAs("u_alice", { email: aliceEmail, email_verified: true });

    // 1) Alterar outro campo do convite
    const badFieldBatch = writeBatch(aliceFs);
    badFieldBatch.set(doc(aliceFs, `campaigns/${CAMPAIGN}/members/u_alice`), {
      uid: "u_alice",
      campaignId: CAMPAIGN,
      displayName: "Alice",
      avatar: { mediaId: null, url: null }
    });
    badFieldBatch.update(doc(aliceFs, `campaigns/${CAMPAIGN}/invites/${aliceEmail}`), {
      acceptedBy: "u_alice",
      defaultDisplayName: "Hackeado"
    });
    await assertFails(badFieldBatch.commit());

    // 2) Gravar acceptedBy com outro UID
    const badUidBatch = writeBatch(aliceFs);
    badUidBatch.set(doc(aliceFs, `campaigns/${CAMPAIGN}/members/u_alice`), {
      uid: "u_alice",
      campaignId: CAMPAIGN,
      displayName: "Alice",
      avatar: { mediaId: null, url: null }
    });
    badUidBatch.update(doc(aliceFs, `campaigns/${CAMPAIGN}/invites/${aliceEmail}`), {
      acceptedBy: "u_other"
    });
    await assertFails(badUidBatch.commit());

    // 3) Aceitar convite de outro e-mail (bobEmail)
    const wrongEmailBatch = writeBatch(aliceFs);
    wrongEmailBatch.set(doc(aliceFs, `campaigns/${CAMPAIGN}/members/u_alice`), {
      uid: "u_alice",
      campaignId: CAMPAIGN,
      displayName: "Alice",
      avatar: { mediaId: null, url: null }
    });
    wrongEmailBatch.update(doc(aliceFs, `campaigns/${CAMPAIGN}/invites/${bobEmail}`), {
      acceptedBy: "u_alice"
    });
    await assertFails(wrongEmailBatch.commit());

    // 4) Fluxo legítimo via joinWithInvite (inclusive com múltiplos pontos no e-mail -> toInviteEmailKey)
    const joined = await joinWithInvite({
      campaignId: CAMPAIGN,
      user: { uid: "u_alice", email: aliceEmail, emailVerified: true, displayName: "Alice" },
      firestoreDb: aliceFs,
      realtimeDb: aliceRt
    });
    expect(joined.status).toBe("joined");
    expect((await rtdbGet(rtdbRef(aliceRt, rt("meta/members/u_alice")))).val()).toBe(true);

    // 5) Idempotência ao chamar novamente
    const second = await joinWithInvite({
      campaignId: CAMPAIGN,
      user: { uid: "u_alice", email: aliceEmail, emailVerified: true },
      firestoreDb: aliceFs,
      realtimeDb: aliceRt
    });
    expect(second.status).toBe("already_member");

    // 6) Convite já aceito não pode ser aceito por outra conta
    const imposterFs = fsAs("u_imposter", { email: aliceEmail, email_verified: true });
    const replayBatch = writeBatch(imposterFs);
    replayBatch.set(doc(imposterFs, `campaigns/${CAMPAIGN}/members/u_imposter`), {
      uid: "u_imposter",
      campaignId: CAMPAIGN,
      displayName: "Impostor",
      avatar: { mediaId: null, url: null }
    });
    replayBatch.update(doc(imposterFs, `campaigns/${CAMPAIGN}/invites/${aliceEmail}`), {
      acceptedBy: "u_imposter"
    });
    await assertFails(replayBatch.commit());

    // 7) B1.7: Convite removido antes do aceite impede entrada
    await revokeInvite({
      campaignId: CAMPAIGN,
      email: carolEmail,
      currentGmId: "gm_a",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    const carolFs = fsAs("u_carol", { email: carolEmail, email_verified: true });
    const carolRt = rtAs("u_carol", { email: carolEmail, email_verified: true });
    await expect(
      joinWithInvite({
        campaignId: CAMPAIGN,
        user: { uid: "u_carol", email: carolEmail, emailVerified: true },
        firestoreDb: carolFs,
        realtimeDb: carolRt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });
    await assertFails(rtdbSet(rtdbRef(carolRt, rt("meta/members/u_carol")), true));
  });

  it("B1.8: bootstrap por platformAdmin cria campanha completa, state/chat lastSeq=0 e bloqueia usurpação", async () => {
    const newCampId = "camp_nova";
    await seed(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "platformAdmins/admin1"), {
        uid: "admin1",
        createdAt: serverTimestamp()
      });
      await rtdbSet(rtdbRef(ctx.database(), "platformAdmins/admin1"), true);
    });

    const nonAdminRt = rtAs("common_user", { email: "c@example.com", email_verified: true });
    await assertFails(rtdbSet(rtdbRef(nonAdminRt, `vtt_realtime/${newCampId}/meta/gmId`), "common_user"));

    const adminFs = fsAs("admin1", { email: "admin1@example.com", email_verified: true });
    const adminRt = rtAs("admin1", { email: "admin1@example.com", email_verified: true });

    // state/chat com lastSeq != 0 deve ser negado mesmo para platformAdmin
    const badBoot = writeBatch(adminFs);
    badBoot.set(doc(adminFs, `campaigns/${newCampId}`), {
      campaignId: newCampId,
      name: "Nova",
      gmId: "admin1",
      activeSceneId: null,
      schemaVersion: 2
    });
    badBoot.set(doc(adminFs, `campaigns/${newCampId}/members/admin1`), {
      uid: "admin1",
      campaignId: newCampId,
      displayName: "Admin",
      avatar: { mediaId: null, url: null }
    });
    badBoot.set(doc(adminFs, `campaigns/${newCampId}/state/chat`), {
      campaignId: newCampId,
      lastSeq: 5,
      lastMessageId: null
    });
    await assertFails(badBoot.commit());

    // createCampaign pelo app cria campanha + member + meta/gmId + meta/members
    const created = await createCampaign({
      campaignId: newCampId,
      name: "Operação Iceberg",
      user: { uid: "admin1", email: "admin1@example.com", emailVerified: true, displayName: "Admin" },
      firestoreDb: adminFs,
      realtimeDb: adminRt
    });
    expect(created).toEqual({ campaignId: newCampId, gmId: "admin1" });

    // O Mestre inicializa state/chat com lastSeq = 0 e o contador avança junto com a mensagem.
    await assertSucceeds(
      setDoc(doc(adminFs, `campaigns/${newCampId}/state/chat`), {
        campaignId: newCampId,
        lastSeq: 0,
        lastMessageId: null
      })
    );
    const msgBatch = writeBatch(adminFs);
    msgBatch.set(doc(adminFs, `campaigns/${newCampId}/messages/m1`), {
      campaignId: newCampId,
      seq: 1,
      type: "text",
      senderId: "admin1",
      visibleTo: ["ALL"],
      content: "Bem-vindos",
      isDeleted: false
    });
    msgBatch.update(doc(adminFs, `campaigns/${newCampId}/state/chat`), {
      lastSeq: 1,
      lastMessageId: "m1"
    });
    await assertSucceeds(msgBatch.commit());
  });
});

describe("B2 — Autoridade do Mestre e revogação", () => {
  it("B2.1, B2.2 e B2.5: assignGM(B) remove poderes do Mestre antigo A, não reverte e acompanha notas scope='gm'", async () => {
    await seedCampaignWithGm("gm_a");
    await seedMember("player_b", "Jogador B");

    const gmAFs = fsAs("gm_a", { email: "gma@example.com", email_verified: true });
    const gmARt = rtAs("gm_a", { email: "gma@example.com", email_verified: true });
    const playerBFs = fsAs("player_b", { email: "b@example.com", email_verified: true });
    const playerBRt = rtAs("player_b", { email: "b@example.com", email_verified: true });

    // A cria nota restrita ao Mestre (scope: 'gm')
    await assertSucceeds(
      setDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`), {
        title: "Segredo da Campanha",
        ownerId: "gm_a",
        scope: "gm",
        visibleTo: ["gm_a"],
        editableBy: ["gm_a"],
        isDeleted: false
      })
    );
    await assertFails(getDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`)));

    // B2.5: B lê e edita nota e pasta scope='gm'; A deixa de ler e editar; jogador não escala scope de pasta para 'gm'
    await assertSucceeds(
      setDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/folders/f_gm`), {
        name: "Pasta Secreta",
        folderType: "journal",
        scope: "gm",
        ownerId: "gm_a",
        visibleTo: ["gm_a"],
        editableBy: ["gm_a"],
        isDeleted: false
      })
    );
    await assertSucceeds(
      setDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/folders/f_p1`), {
        name: "Pasta P1",
        folderType: "journal",
        scope: "player",
        ownerId: "player_b",
        visibleTo: ["gm_a", "player_b"],
        editableBy: ["gm_a", "player_b"],
        isDeleted: false
      })
    );
    await assertFails(
      updateDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/folders/f_p1`), { scope: "gm" })
    );

    // Delega de A -> B
    await assignGM({
      campaignId: CAMPAIGN,
      currentGmId: "gm_a",
      targetUid: "player_b",
      firestoreDb: gmAFs,
      realtimeDb: gmARt
    });

    // B2.1: A perde imediatamente autoridade nos dois bancos (sem exceção por e-mail)
    await assertFails(updateDoc(doc(gmAFs, `campaigns/${CAMPAIGN}`), { gmId: "gm_a" }));
    await assertFails(rtdbSet(rtdbRef(playerBRt, rt("meta/gmId")), null));
    await assertFails(rtdbSet(rtdbRef(playerBRt, rt("meta/members/player_b")), null));
    await assertFails(
      setDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/scenes/s_hack`), {
        name: "Hack",
        visibleToPlayers: true,
        visibleTo: ["ALL"]
      })
    );
    await assertFails(rtdbSet(rtdbRef(gmARt, rt("fog/s1")), { enabled: true }));
    await assertFails(rtdbSet(rtdbRef(gmARt, rt("meta/gmId")), "gm_a"));

    // B2.5: B lê e edita nota e pasta scope='gm'; A deixa de ler e editar
    const noteAsB = await assertSucceeds(
      getDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`))
    );
    expect(noteAsB.data().title).toBe("Segredo da Campanha");
    await assertSucceeds(
      updateDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`), {
        title: "Segredo Atualizado por B"
      })
    );
    await assertSucceeds(getDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/folders/f_gm`)));
    await assertSucceeds(
      updateDoc(doc(playerBFs, `campaigns/${CAMPAIGN}/folders/f_gm`), { name: "Pasta B" })
    );
    await assertFails(getDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`)));
    await assertFails(
      updateDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/notes/secret_gm_note`), { title: "Reversão" })
    );
    await assertFails(getDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/folders/f_gm`)));
    await assertFails(
      updateDoc(doc(gmAFs, `campaigns/${CAMPAIGN}/folders/f_gm`), { name: "Reversão" })
    );

    // B2.2: Recarregar sessão de A mantém gmId = player_b
    const reloadA = await ensureCampaignSession({
      campaignId: CAMPAIGN,
      user: { uid: "gm_a", email: "gma@example.com", emailVerified: true },
      firestoreDb: gmFsSafeRead(gmAFs),
      realtimeDb: gmARt
    });
    expect(reloadA.joined).toBe(true);
    const campAfter = (await getDoc(doc(playerBFs, `campaigns/${CAMPAIGN}`))).data();
    expect(campAfter.gmId).toBe("player_b");

    // B também consegue delegar de volta para A
    await assignGM({
      campaignId: CAMPAIGN,
      currentGmId: "player_b",
      targetUid: "gm_a",
      firestoreDb: playerBFs,
      realtimeDb: playerBRt
    });
    expect((await getDoc(doc(gmAFs, `campaigns/${CAMPAIGN}`))).data().gmId).toBe("gm_a");
  });

  it("B2.3: protocolo interrompido após passo 2 — B conclui meta/gmId ao iniciar e terceiro é negado", async () => {
    await seedCampaignWithGm("gm_a");
    await seedMember("player_b", "B");
    await seedMember("player_c", "C");

    const gmAFs = fsAs("gm_a");
    const gmARt = rtAs("gm_a");
    const playerBRt = rtAs("player_b");
    const playerCRt = rtAs("player_c");

    // Simula passos 1 e 2 completados e falha antes do passo 3
    await assertSucceeds(rtdbSet(rtdbRef(gmARt, rt("meta/pendingGm")), "player_b"));
    await assertSucceeds(
      updateDoc(doc(gmAFs, `campaigns/${CAMPAIGN}`), { gmId: "player_b" })
    );

    // Terceiro (player_c) não pode reivindicar meta/gmId nem limpar pendingGm
    await assertFails(rtdbSet(rtdbRef(playerCRt, rt("meta/gmId")), "player_c"));
    await assertFails(rtdbSet(rtdbRef(playerCRt, rt("meta/pendingGm")), null));

    // Novo Mestre B conclui no boot
    const completed = await completePendingGmTransfer({
      campaignId: CAMPAIGN,
      uid: "player_b",
      campaignGmId: "player_b",
      realtimeDb: playerBRt
    });
    expect(completed).toBe(true);
    expect((await rtdbGet(rtdbRef(playerBRt, rt("meta/gmId")))).val()).toBe("player_b");
    expect((await rtdbGet(rtdbRef(playerBRt, rt("meta/pendingGm")))).exists()).toBe(false);
  });

  it("B2.4: revokeMember corta acesso na hora nos dois bancos e bloqueia reentrada; reconcileMirrors limpa órfãos", async () => {
    await seedCampaignWithGm("gm_a");
    const gmFs = fsAs("gm_a");
    const gmRt = rtAs("gm_a");

    await inviteMember({
      campaignId: CAMPAIGN,
      email: "bob@example.com",
      defaultDisplayName: "Bob",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });

    const bobFs = fsAs("u_bob", { email: "bob@example.com", email_verified: true });
    const bobRt = rtAs("u_bob", { email: "bob@example.com", email_verified: true });
    await joinWithInvite({
      campaignId: CAMPAIGN,
      user: { uid: "u_bob", email: "bob@example.com", emailVerified: true },
      firestoreDb: bobFs,
      realtimeDb: bobRt
    });

    // Enquanto membro, lê campanha e escreve presença
    await assertSucceeds(getDoc(doc(bobFs, `campaigns/${CAMPAIGN}`)));
    await assertSucceeds(rtdbGet(rtdbRef(bobRt, rt("meta/gmId"))));
    await assertSucceeds(
      rtdbSet(rtdbRef(bobRt, rt("presence/u_bob/conn_bob")), {
        kind: PRESENCE_KINDS.MAIN,
        connectedAt: 500
      })
    );
    // Mestre não pode forjar presença de outro membro, apenas remover na revogação/reconciliação
    await assertFails(
      rtdbSet(rtdbRef(gmRt, rt("presence/u_bob/conn_spoof")), {
        kind: PRESENCE_KINDS.MAIN,
        connectedAt: 501
      })
    );

    // Revogação pelo Mestre
    const rev = await revokeMember({
      campaignId: CAMPAIGN,
      targetUid: "u_bob",
      currentGmId: "gm_a",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    expect(rev).toEqual({ uid: "u_bob", removedInvites: 1 });
    expect((await rtdbGet(rtdbRef(gmRt, rt("presence/u_bob")))).exists()).toBe(false);

    // Corte imediato nos dois bancos + bloqueio de reentrada
    await assertFails(getDoc(doc(bobFs, `campaigns/${CAMPAIGN}`)));
    await assertFails(rtdbGet(rtdbRef(bobRt, rt("meta/gmId"))));
    await assertFails(rtdbSet(rtdbRef(bobRt, rt("meta/members/u_bob")), true));
    await expect(
      joinWithInvite({
        campaignId: CAMPAIGN,
        user: { uid: "u_bob", email: "bob@example.com", emailVerified: true },
        firestoreDb: bobFs,
        realtimeDb: bobRt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.PERMISSION_DENIED });

    // Teste à parte: falha no passo do RTDB deixa espelhos órfãos; reconcileMirrors limpa
    await inviteMember({
      campaignId: CAMPAIGN,
      email: "stale.invite@example.com",
      defaultDisplayName: "Stale",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    await seed(async (ctx) => {
      // Espelho órfão no RTDB (sem member correspondente nem invite válido em stale2)
      await rtdbSet(rtdbRef(ctx.database(), rt("meta/members/u_orphan")), true);
      await rtdbSet(rtdbRef(ctx.database(), rt("presence/u_orphan/conn_1")), {
        kind: PRESENCE_KINDS.MAIN,
        connectedAt: 10
      });
      await rtdbSet(rtdbRef(ctx.database(), rt(`meta/invites/${toInviteEmailKey("orphan.email@example.com")}`)), true);
    });

    const reconciled = await reconcileMirrors({
      campaignId: CAMPAIGN,
      currentUid: "gm_a",
      campaignGmId: "gm_a",
      firestoreDb: gmFs,
      realtimeDb: gmRt
    });
    expect(reconciled.changed).toBe(true);
    expect((await rtdbGet(rtdbRef(gmRt, rt("meta/members/u_orphan")))).exists()).toBe(false);
    expect((await rtdbGet(rtdbRef(gmRt, rt("presence/u_orphan")))).exists()).toBe(false);
    expect((await rtdbGet(rtdbRef(gmRt, rt("meta/members/gm_a")))).val()).toBe(true);

    // Convite legítimo ainda pendente continua permitido para novo usuário entrar no RTDB
    const staleKey = toInviteEmailKey("stale.invite@example.com");
    await seed(async (ctx) => {
      // Confere que o espelho órfão sumiu e o convite válido permaneceu
      const metaSnap = await rtdbGet(rtdbRef(ctx.database(), rt("meta/invites")));
      const invitesVal = metaSnap.val() || {};
      expect(invitesVal[toInviteEmailKey("orphan.email@example.com")]).toBeUndefined();
      expect(invitesVal[staleKey]).toBe(true);
    });
  });
});

describe("Presença (RTDB + duas conexões)", () => {
  it("mantém o usuário online ao fechar a janela de ficha (sheet) e valida formato em presence/{uid}/{connId}", async () => {
    await seedCampaignWithGm("gm_a");
    await seedMember("player_1", "Pinguim 1");

    const p1Rt = rtAs("player_1", { email: "p1@example.com", email_verified: true });
    const p2MemberKey = "player_2";
    await seedMember(p2MemberKey, "Pinguim 2");
    const p2Rt = rtAs(p2MemberKey, { email: "p2@example.com", email_verified: true });

    // Rejeita formatos inválidos por .validate
    await assertFails(
      rtdbSet(rtdbRef(p1Rt, rt("presence/player_1/c_bad")), {
        kind: "main",
        sheetId: "char_1",
        connectedAt: 100
      })
    );
    await assertFails(
      rtdbSet(rtdbRef(p1Rt, rt("presence/player_1/c_bad2")), {
        kind: "sheet",
        connectedAt: 100
      })
    );
    await assertFails(
      rtdbSet(rtdbRef(p1Rt, rt("presence/player_1/c_bad3")), {
        kind: "main",
        connectedAt: 100,
        displayName: "Não permitido"
      })
    );
    // Outro UID não escreve na presença de player_1
    await assertFails(
      rtdbSet(rtdbRef(p2Rt, rt("presence/player_1/c_other")), {
        kind: "main",
        connectedAt: 100
      })
    );

    // Duas conexões válidas via regras + serviço
    await assertSucceeds(
      rtdbSet(rtdbRef(p1Rt, rt("presence/player_1/conn_main")), {
        kind: PRESENCE_KINDS.MAIN,
        connectedAt: 1000
      })
    );
    await assertSucceeds(
      rtdbSet(rtdbRef(p1Rt, rt("presence/player_1/conn_sheet")), {
        kind: PRESENCE_KINDS.SHEET,
        sheetId: "char_p1",
        connectedAt: 1001
      })
    );

    const bothSnap = (await rtdbGet(rtdbRef(p2Rt, rt("presence")))).val();
    expect(hasSheetConnectionOpen(bothSnap, "player_1", "char_p1")).toBe(true);
    let onlineMap = buildOnlineUsersMap({
      presenceByUid: bothSnap,
      playersMap: { player_1: { uid: "player_1", displayName: "Pinguim 1" } }
    });
    expect(onlineMap.player_1.online).toBe(true);

    // Fecha a ficha destacada mantendo a janela principal conectada
    await assertSucceeds(rtdbUpdate(rtdbRef(p1Rt, rt("presence/player_1")), { conn_sheet: null }));
    const mainOnlySnap = (await rtdbGet(rtdbRef(p2Rt, rt("presence")))).val();
    expect(hasSheetConnectionOpen(mainOnlySnap, "player_1", "char_p1")).toBe(false);
    onlineMap = buildOnlineUsersMap({
      presenceByUid: mainOnlySnap,
      playersMap: { player_1: { uid: "player_1", displayName: "Pinguim 1" } }
    });
    expect(onlineMap.player_1.online).toBe(true);

    // Também valida o fluxo real com .info/connected via connectPresence
    let connectedFlag = false;
    const stop = connectPresence({
      campaignId: CAMPAIGN,
      uid: "player_1",
      connId: "conn_live",
      kind: PRESENCE_KINDS.SHEET,
      sheetId: "char_live",
      realtimeDb: p1Rt,
      onConnectionChange: (val) => {
        connectedFlag = val;
      }
    });

    await vi.waitFor(() => expect(connectedFlag).toBe(true), { timeout: 5000 });
    const liveVal = (await rtdbGet(rtdbRef(p2Rt, rt("presence/player_1/conn_live")))).val();
    expect(liveVal).toMatchObject({ kind: "sheet", sheetId: "char_live" });
    expect(typeof liveVal.connectedAt).toBe("number");

    stop();
    await vi.waitFor(async () => {
      const gone = await rtdbGet(rtdbRef(p2Rt, rt("presence/player_1/conn_live")));
      expect(gone.exists()).toBe(false);
    }, { timeout: 5000 });
  });
});

function gmFsSafeRead(fsInstance) {
  return fsInstance;
}

describe("Integração Auth Emulator + reloadCurrentUser + assignGM concorrente", () => {
  it("cadastro -> verificação de e-mail -> reloadCurrentUser com refresh de token -> joinWithInvite real funciona", async () => {
    await seedCampaignWithGm("gm_a");
    await inviteMember({
      campaignId: CAMPAIGN,
      email: "invitee.real@example.com",
      defaultDisplayName: "Convidado Real",
      firestoreDb: fsAs("gm_a"),
      realtimeDb: rtAs("gm_a")
    });

    const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
    const [fsHost, fsPortRaw] = String(process.env.FIRESTORE_EMULATOR_HOST).split(":");
    const dbHostUrl = String(process.env.FIREBASE_DATABASE_EMULATOR_HOST);
    const adminApp = initializeAdminApp({ projectId: "demo-cpvtt-test" }, "phase3-rules-admin");
    const clientApp = initializeApp(
      {
        apiKey: "fake-api-key",
        projectId: "demo-cpvtt-test",
        databaseURL: `http://${dbHostUrl}?ns=demo-cpvtt-test`
      },
      "phase3-rules-client"
    );

    try {
      const clientAuth = getAuth(clientApp);
      connectAuthEmulator(clientAuth, `http://${authHost}`, { disableWarnings: true });
      const clientFs = getFirestore(clientApp);
      connectFirestoreEmulator(clientFs, fsHost, Number(fsPortRaw));
      const clientRt = getDatabase(clientApp);
      const [dbHost, dbPortRaw] = dbHostUrl.replace(/^https?:\/\//, "").split(":");
      connectDatabaseEmulator(clientRt, dbHost, Number(dbPortRaw));

      const created = await registerWithEmail({
        email: "invitee.real@example.com",
        password: "password123",
        displayName: "Convidado Real",
        authInstance: clientAuth
      });
      expect(created.emailVerified).toBe(false);

      await getAdminAuth(adminApp).updateUser(created.uid, { emailVerified: true });
      const reloaded = await reloadCurrentUser({ authInstance: clientAuth });
      expect(reloaded.emailVerified).toBe(true);

      const joined = await joinWithInvite({
        campaignId: CAMPAIGN,
        user: reloaded,
        firestoreDb: clientFs,
        realtimeDb: clientRt
      });
      expect(joined.status).toBe("joined");
      await clientAuth.signOut();
      await getAdminAuth(adminApp).deleteUser(created.uid);
    } finally {
      await deleteApp(clientApp);
      await deleteAdminApp(adminApp);
    }
  });

  it("assignGM não falha se targetUid concluir meta/gmId antes do Passo 3 do antigo Mestre", async () => {
    await seedCampaignWithGm("gm_a");
    await seedMember("player_b", "B");

    const gmAFs = fsAs("gm_a");
    const gmARt = rtAs("gm_a");
    const playerBFs = fsAs("player_b");
    const playerBRt = rtAs("player_b");

    // Rejeita não membro antes de gravar pendingGm
    await expect(
      assignGM({
        campaignId: CAMPAIGN,
        currentGmId: "gm_a",
        targetUid: "not_a_member",
        firestoreDb: gmAFs,
        realtimeDb: gmARt
      })
    ).rejects.toMatchObject({ code: ERROR_CODES.NOT_FOUND });
    expect((await rtdbGet(rtdbRef(gmARt, rt("meta/pendingGm")))).exists()).toBe(false);

    // Simula B online recebendo snapshot do Firestore e concluindo Passo 4 em paralelo ao Passo 3 de A
    let bTransferPromise = null;
    const unsub = onSnapshot(doc(playerBFs, `campaigns/${CAMPAIGN}`), (snap) => {
      if (snap.data()?.gmId === "player_b" && !bTransferPromise) {
        bTransferPromise = completePendingGmTransfer({
          campaignId: CAMPAIGN,
          uid: "player_b",
          campaignGmId: "player_b",
          realtimeDb: playerBRt
        });
      }
    });

    try {
      await expect(
        assignGM({
          campaignId: CAMPAIGN,
          currentGmId: "gm_a",
          targetUid: "player_b",
          firestoreDb: gmAFs,
          realtimeDb: gmARt
        })
      ).resolves.toEqual({ gmId: "player_b" });
      if (bTransferPromise) await bTransferPromise;
    } finally {
      unsub();
    }

    expect((await rtdbGet(rtdbRef(playerBRt, rt("meta/gmId")))).val()).toBe("player_b");
    expect((await rtdbGet(rtdbRef(playerBRt, rt("meta/pendingGm")))).exists()).toBe(false);
  });
});
