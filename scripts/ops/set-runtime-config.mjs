// Grava appConfig/runtime (minClientVersion e schemaVersion) no Firestore.
// Simulação (dry-run) por padrão; exige --apply para gravar e --confirm-production para produção.
//
//   node scripts/ops/set-runtime-config.mjs --target emulator --apply
//   node scripts/ops/set-runtime-config.mjs --target emulator --min-client-version 2.1.0 --apply
import { parseArgs } from "node:util";
import { FieldValue } from "firebase-admin/firestore";
import { CLIENT_VERSION } from "../../src/domain/constants.js";
import {
  normalizeAppConfig,
  toAppConfigDoc,
  validateAppConfig
} from "../../src/domain/models/appConfig.js";
import { TARGET_OPTIONS, connectAdmin, describeTarget, resolveTarget } from "../lib/target.mjs";

const { values } = parseArgs({
  options: {
    ...TARGET_OPTIONS,
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    "min-client-version": { type: "string", default: CLIENT_VERSION },
    "schema-version": { type: "string", default: "2" }
  }
});

const target = resolveTarget(values);
const shouldApply = Boolean(values.apply) && !values["dry-run"];

const config = normalizeAppConfig({
  id: "runtime",
  minClientVersion: values["min-client-version"],
  schemaVersion: Number(values["schema-version"])
});
const check = validateAppConfig(config);
if (!check.ok) {
  throw new Error(
    `Configuração inválida: ${check.errors.map((e) => e.message).join("; ")}`
  );
}

const payload = {
  ...toAppConfigDoc(config),
  updatedAt: FieldValue.serverTimestamp()
};

const { app, firestore } = connectAdmin(target);
try {
  if (shouldApply) {
    await firestore.doc("appConfig/runtime").set(payload);
  }
  console.log(
    JSON.stringify(
      {
        target: describeTarget(target),
        dryRun: !shouldApply,
        applied: shouldApply,
        path: "appConfig/runtime",
        minClientVersion: config.minClientVersion,
        schemaVersion: config.schemaVersion
      },
      null,
      2
    )
  );
} finally {
  await app.delete();
}
