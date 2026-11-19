// Snapshot SOMENTE LEITURA (Firestore inteiro, Realtime Database inteiro e usuários do Auth) para
// local-data/snapshots/<rótulo>/. Não grava nada no alvo.
//
//   npm run export:prod -- --target production --confirm-production   (exige autorização do usuário)
//   npm run export:prod -- --target emulator                            (salva o estado do emulador)
//
// Opções: --label <nome> (padrão: data/hora), --out <pasta> (padrão: local-data/snapshots),
//         --config/--project (só emulador).
// A saída contém dados pessoais: fica em local-data/ (no .gitignore). O terminal mostra só contagens.
import path from "node:path";
import { parseArgs } from "node:util";
import { readAllAuthUsers, readAllFirestoreDocuments, summarizeSnapshot, writeSnapshot } from "../lib/snapshot.mjs";
import { TARGET_OPTIONS, connectAdmin, describeTarget, localDataDir, resolveTarget } from "../lib/target.mjs";

const { values } = parseArgs({
  options: { ...TARGET_OPTIONS, label: { type: "string" }, out: { type: "string" } }
});

const target = resolveTarget(values);
const { app, firestore, database, auth } = connectAdmin(target);
const label = values.label || `${new Date().toISOString().replace(/[:.]/g, "-")}-${target.kind}`;
const outDir = path.resolve(values.out || path.join(localDataDir, "snapshots"), label);

console.log(`Lendo ${describeTarget(target)} (somente leitura)...`);
try {
  const documents = await readAllFirestoreDocuments(firestore);
  const database_ = (await database.ref("/").once("value")).val();
  const users = await readAllAuthUsers(auth);
  const counts = summarizeSnapshot({ documents, database: database_, users });
  writeSnapshot(outDir, {
    manifest: { createdAt: new Date().toISOString(), source: target.kind, projectId: target.projectId, counts },
    documents,
    database: database_,
    users
  });
  console.log(JSON.stringify({ snapshot: path.relative(process.cwd(), outDir), counts }, null, 2));
} finally {
  await app.delete();
}
