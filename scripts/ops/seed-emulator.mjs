// Carrega um snapshot local no EMULADOR, substituindo todo o estado dele (Firestore, RTDB e Auth).
// Nunca roda contra a produção.
//
//   npm run seed:emu                         (snapshot mais recente de local-data/snapshots)
//   npm run seed:emu -- --snapshot <pasta>
//
// Usuários: mesmos UIDs, e-mails e provedores. Contas de e-mail/senha recebem a senha local de
// desenvolvimento (--password, padrão "pinguim123"); contas Google aparecem na tela de login do
// emulador. Opções --config/--project selecionam outro emulador (os testes usam firebase.test.json).
import path from "node:path";
import { parseArgs } from "node:util";
import { decodeValue, latestSnapshotDir, readSnapshot, summarizeSnapshot } from "../lib/snapshot.mjs";
import { TARGET_OPTIONS, connectAdmin, describeTarget, localDataDir, resolveTarget } from "../lib/target.mjs";

const DEFAULT_DEV_PASSWORD = "pinguim123";
const BATCH_LIMIT = 400;

const { values } = parseArgs({
  options: {
    config: TARGET_OPTIONS.config,
    project: TARGET_OPTIONS.project,
    snapshot: { type: "string" },
    password: { type: "string", default: DEFAULT_DEV_PASSWORD }
  }
});

const target = resolveTarget({ ...values, target: "emulator" });
const snapshotDir = values.snapshot ? path.resolve(values.snapshot) : latestSnapshotDir(path.join(localDataDir, "snapshots"));
if (!snapshotDir) throw new Error("Nenhum snapshot em local-data/snapshots. Rode `npm run export:prod` ou informe --snapshot.");

const snapshot = readSnapshot(snapshotDir);
const { app, firestore, database, auth } = connectAdmin(target);

async function clearEmulator() {
  const { FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST } = target.emulatorHosts;
  const responses = await Promise.all([
    fetch(`http://${FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/${target.projectId}/databases/(default)/documents`, {
      method: "DELETE"
    }),
    fetch(`http://${FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${target.projectId}/accounts`, { method: "DELETE" })
  ]);
  for (const res of responses) {
    if (!res.ok) throw new Error(`Falha ao limpar o emulador: HTTP ${res.status} em ${res.url}`);
  }
  await database.ref("/").set(null);
}

async function seedFirestore() {
  const entries = Object.entries(snapshot.documents);
  for (let i = 0; i < entries.length; i += BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const [docPath, data] of entries.slice(i, i + BATCH_LIMIT)) {
      batch.set(firestore.doc(docPath), decodeValue(data, firestore));
    }
    await batch.commit();
  }
}

async function seedAuth() {
  if (snapshot.users.length === 0) return;
  const records = snapshot.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? undefined,
    emailVerified: u.emailVerified,
    displayName: u.displayName ?? undefined,
    photoURL: u.photoURL ?? undefined,
    disabled: u.disabled,
    providerData: u.providerData
      .filter((p) => p.providerId !== "password")
      .map((p) => ({
        providerId: p.providerId,
        uid: p.uid,
        email: p.email ?? undefined,
        displayName: p.displayName ?? undefined,
        photoURL: p.photoURL ?? undefined
      }))
  }));
  const result = await auth.importUsers(records);
  if (result.failureCount > 0) {
    throw new Error(`Falha ao importar ${result.failureCount} usuário(s): ${result.errors.map((e) => e.error.message).join("; ")}`);
  }
  for (const u of snapshot.users) {
    if (u.providerData.some((p) => p.providerId === "password")) {
      await auth.updateUser(u.uid, { password: values.password });
    }
  }
}

console.log(`Semeando ${describeTarget(target)} com ${path.relative(process.cwd(), snapshotDir)}...`);
try {
  await clearEmulator();
  await seedFirestore();
  await database.ref("/").set(snapshot.database ?? null);
  await seedAuth();
  console.log(JSON.stringify({ seeded: summarizeSnapshot(snapshot) }, null, 2));
} finally {
  await app.delete();
}
