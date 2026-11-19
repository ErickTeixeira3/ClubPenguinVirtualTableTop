// Executor das migrações de dados (PLANO_REFATORACAO_2.md, Seção 7.1).
//
// Contrato de uma migração (um arquivo em scripts/migrations/, registrado em registry.mjs):
//   export default {
//     id: "M001-identity",
//     description: "…",
//     async plan({ firestore, database, target }) {
//       return { operations: [...], summary: { …contagens, sem dados pessoais… } };
//     }
//   }
// `plan` só lê; a idempotência vem dele: rodar de novo depois de aplicar planeja 0 operações.
// O plano inclui a gravação de `campaigns/{c}.schemaVersion` quando a migração conclui uma versão.
// Operações: { kind: "fs.set" | "fs.update" | "fs.delete", path, data? }
//            { kind: "rtdb.update", path, data }   (atualização multi-caminho relativa a `path`)
//            { kind: "rtdb.set" | "rtdb.remove", path, data? }
//
// Garantias do executor:
// - simulação (dry-run) por padrão; só grava com `apply: true`;
// - antes de gravar, aborta se as escritas do dia (registro local por alvo e projeto) mais as planejadas
//   passarem do limite diário (15 mil; cota gratuita do Spark: 20 mil);
// - Firestore em lotes de até 450 operações; cada migração é registrada em local-data/migration-logs/.
import fs from "node:fs";
import path from "node:path";

export const DAILY_WRITE_LIMIT = 15000;
const FIRESTORE_BATCH_LIMIT = 450;
const FIRESTORE_KINDS = new Set(["fs.set", "fs.update", "fs.delete"]);
const RTDB_KINDS = new Set(["rtdb.update", "rtdb.set", "rtdb.remove"]);
const AUTH_KINDS = new Set(["auth.verifyEmail"]);

/** Escritas cobradas de uma operação (rtdb.update conta uma por caminho atualizado). */
export function countWrites(operation) {
  if (operation.kind === "rtdb.update") return Math.max(1, Object.keys(operation.data || {}).length);
  return 1;
}

function validateOperation(op, migrationId) {
  if (!FIRESTORE_KINDS.has(op.kind) && !RTDB_KINDS.has(op.kind) && !AUTH_KINDS.has(op.kind)) {
    throw new Error(`${migrationId}: operação desconhecida "${op.kind}".`);
  }
  if (typeof op.path !== "string" || !op.path) throw new Error(`${migrationId}: operação sem caminho.`);
  if (op.kind === "auth.verifyEmail" && (typeof op.uid !== "string" || !op.uid)) {
    throw new Error(`${migrationId}: operação auth.verifyEmail sem uid.`);
  }
}

function ledgerKey(target, now) {
  return `${target.kind}:${target.projectId}:${now.toISOString().slice(0, 10)}`;
}

function readLedger(file) {
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

async function applyOperations({ firestore, database, auth }, operations) {
  const fsOps = operations.filter((op) => FIRESTORE_KINDS.has(op.kind));
  for (let i = 0; i < fsOps.length; i += FIRESTORE_BATCH_LIMIT) {
    const batch = firestore.batch();
    for (const op of fsOps.slice(i, i + FIRESTORE_BATCH_LIMIT)) {
      const ref = firestore.doc(op.path);
      if (op.kind === "fs.set") batch.set(ref, op.data);
      else if (op.kind === "fs.update") batch.update(ref, op.data);
      else batch.delete(ref);
    }
    await batch.commit();
  }
  for (const op of operations.filter((o) => RTDB_KINDS.has(o.kind))) {
    const ref = database.ref(op.path);
    if (op.kind === "rtdb.update") await ref.update(op.data);
    else if (op.kind === "rtdb.set") await ref.set(op.data);
    else await ref.remove();
  }
  for (const op of operations.filter((o) => AUTH_KINDS.has(o.kind))) {
    if (op.kind === "auth.verifyEmail") {
      await auth.updateUser(op.uid, { emailVerified: true });
    }
  }
}

/**
 * Executa (ou simula) as migrações em ordem.
 * @returns {Promise<Array<{ id, planned, writes, applied, summary }>>}
 */
export async function runMigrations({
  migrations,
  connection,
  target,
  apply = false,
  logDir,
  dailyWriteLimit = DAILY_WRITE_LIMIT,
  now = () => new Date(),
  log = console.log
}) {
  const results = [];
  const ledgerFile = path.join(logDir, "write-ledger.json");

  for (const migration of migrations) {
    const { operations = [], summary = {} } = await migration.plan({ ...connection, target });
    operations.forEach((op) => validateOperation(op, migration.id));
    const writes = operations.reduce((sum, op) => sum + countWrites(op), 0);
    const result = { id: migration.id, planned: operations.length, writes, applied: false, summary };

    if (apply && operations.length > 0) {
      const ledger = readLedger(ledgerFile);
      const key = ledgerKey(target, now());
      const usedToday = ledger[key] || 0;
      if (usedToday + writes > dailyWriteLimit) {
        throw new Error(
          `${migration.id}: ${writes} escritas planejadas + ${usedToday} já feitas hoje passam do limite diário de ${dailyWriteLimit}. Nada foi gravado.`
        );
      }
      await applyOperations(connection, operations);
      fs.mkdirSync(logDir, { recursive: true });
      fs.writeFileSync(ledgerFile, `${JSON.stringify({ ...ledger, [key]: usedToday + writes }, null, 2)}\n`, "utf8");
      result.applied = true;
    }

    if (apply) {
      fs.mkdirSync(logDir, { recursive: true });
      const stamp = now().toISOString().replace(/[:.]/g, "-");
      fs.writeFileSync(
        path.join(logDir, `${stamp}-${migration.id}-${target.kind}.json`),
        `${JSON.stringify({ ...result, target: { kind: target.kind, projectId: target.projectId } }, null, 2)}\n`,
        "utf8"
      );
    }
    log(`${migration.id}: ${operations.length} operações, ${writes} escritas${apply ? (result.applied ? " — aplicada" : " — nada a aplicar") : " (simulação)"}`);
    results.push(result);
  }
  return results;
}
