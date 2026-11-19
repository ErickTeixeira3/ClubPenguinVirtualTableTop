// Executa as migrações de dados registradas em registry.mjs.
//
//   npm run migrate -- --target emulator                    (simulação: só relatório)
//   npm run migrate -- --target emulator --apply            (aplica)
//   npm run migrate -- --target production --confirm-production [--apply]   (exige autorização do usuário)
//   … --only M001-identity                                  (uma migração)
import path from "node:path";
import { parseArgs } from "node:util";
import { runMigrations } from "./lib/runner.mjs";
import { MIGRATIONS } from "./registry.mjs";
import { TARGET_OPTIONS, connectAdmin, describeTarget, localDataDir, resolveTarget } from "../lib/target.mjs";

const { values } = parseArgs({
  options: { ...TARGET_OPTIONS, apply: { type: "boolean", default: false }, only: { type: "string" } }
});

const target = resolveTarget(values);
const selected = values.only ? MIGRATIONS.filter((m) => m.id === values.only) : MIGRATIONS;
if (values.only && selected.length === 0) throw new Error(`Migração "${values.only}" não registrada.`);

if (selected.length === 0) {
  console.log("Nenhuma migração registrada em scripts/migrations/registry.mjs.");
} else {
  const connection = connectAdmin(target);
  console.log(`${values.apply ? "Aplicando" : "Simulando"} ${selected.length} migração(ões) em ${describeTarget(target)}...`);
  try {
    const results = await runMigrations({
      migrations: selected,
      connection,
      target,
      apply: values.apply,
      logDir: path.join(localDataDir, "migration-logs")
    });
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await connection.app.delete();
  }
}
