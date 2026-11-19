// Auditoria do schema v2 (PLANO_REFATORACAO_2.md, Seções 4.2 e 7.1): valida todos os documentos e nós
// contra os validadores registrados e reporta violações agregadas (sem conteúdo nem dados pessoais).
//
//   npm run audit:schema -- --snapshot <pasta>                        (offline, sobre um snapshot local)
//   npm run audit:schema -- --target emulator
//   npm run audit:schema -- --target production --confirm-production  (só leitura; exige autorização)
//
// Códigos de saída: 0 = 0 violações; 1 = há violações; 2 = auditoria inconclusiva (nenhum validador).
// Os validadores vêm de src/domain/models a partir da Fase 1 e são registrados em lib/auditValidators.mjs.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { AUDIT_VALIDATORS } from "./lib/auditValidators.mjs";
import { readAllFirestoreDocuments, readSnapshot } from "../lib/snapshot.mjs";
import { TARGET_OPTIONS, connectAdmin, describeTarget, resolveTarget } from "../lib/target.mjs";

export function evaluateAuditData(data, validators = AUDIT_VALIDATORS) {
  const violations = [];
  for (const validator of validators) {
    for (const violation of validator.check(data)) {
      violations.push({ validator: validator.id, ...violation });
    }
  }

  const byValidator = {};
  for (const v of violations) {
    byValidator[v.validator] = (byValidator[v.validator] || 0) + 1;
  }

  const report = {
    source: data.source || "memory",
    documents: Object.keys(data.documents || {}).length,
    validators: validators.length,
    violations: violations.length,
    byValidator,
    // Só caminhos e códigos, nunca valores.
    samples: violations.slice(0, 50).map(({ validator, path: p, code }) => ({
      validator,
      path: p,
      code
    }))
  };

  const exitCode =
    validators.length === 0 ? 2 : violations.length > 0 ? 1 : 0;

  return { report, exitCode };
}

async function loadData(values) {
  if (values.snapshot) {
    const { documents, database } = readSnapshot(path.resolve(values.snapshot));
    return { source: `snapshot ${values.snapshot}`, documents, database };
  }
  const target = resolveTarget(values);
  const { app, firestore, database } = connectAdmin(target);
  try {
    return {
      source: describeTarget(target),
      documents: await readAllFirestoreDocuments(firestore),
      database: (await database.ref("/").once("value")).val()
    };
  } finally {
    await app.delete();
  }
}

const isCliEntry =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCliEntry) {
  const { values } = parseArgs({
    options: { ...TARGET_OPTIONS, snapshot: { type: "string" } }
  });
  const data = await loadData(values);
  const { report, exitCode } = evaluateAuditData(data, AUDIT_VALIDATORS);
  console.log(JSON.stringify(report, null, 2));
  if (exitCode === 2) {
    console.error(
      "Auditoria INCONCLUSIVA: nenhum validador registrado (os modelos de domain/models chegam na Fase 1)."
    );
  }
  process.exitCode = exitCode;
}
