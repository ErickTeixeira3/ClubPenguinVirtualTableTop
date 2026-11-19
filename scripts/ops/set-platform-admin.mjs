// Concede (ou remove com --remove) papel de administrador da plataforma (platformAdmins/{uid})
// no Firestore e no espelho da raiz do RTDB (D-DER-7).
// Simulação (dry-run) por padrão; exige --apply para gravar.
//
//   node scripts/ops/set-platform-admin.mjs --target emulator --uid <uid> --apply
import { parseArgs } from "node:util";
import { FieldValue } from "firebase-admin/firestore";
import { validatePlatformAdmin } from "../../src/domain/models/platformAdmin.js";
import { TARGET_OPTIONS, connectAdmin, describeTarget, resolveTarget } from "../lib/target.mjs";

const { values } = parseArgs({
  options: {
    ...TARGET_OPTIONS,
    uid: { type: "string" },
    apply: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
    remove: { type: "boolean", default: false }
  }
});

const target = resolveTarget(values);
const uid = String(values.uid || "").trim();
const check = validatePlatformAdmin({ uid, createdAt: null }, { docId: uid });
if (!check.ok) {
  throw new Error(`UID inválido: ${check.errors.map((e) => e.message).join("; ")}`);
}

const shouldApply = Boolean(values.apply) && !values["dry-run"];
const removing = Boolean(values.remove);

const { app, firestore, database } = connectAdmin(target);
try {
  if (shouldApply) {
    if (removing) {
      await Promise.all([
        firestore.doc(`platformAdmins/${uid}`).delete(),
        database.ref(`platformAdmins/${uid}`).remove()
      ]);
    } else {
      await Promise.all([
        firestore.doc(`platformAdmins/${uid}`).set({
          uid,
          createdAt: FieldValue.serverTimestamp()
        }),
        database.ref(`platformAdmins/${uid}`).set(true)
      ]);
    }
  }
  console.log(
    JSON.stringify(
      {
        target: describeTarget(target),
        dryRun: !shouldApply,
        applied: shouldApply,
        action: removing ? "remove" : "grant",
        uid
      },
      null,
      2
    )
  );
} finally {
  database.goOffline();
  await app.delete();
}
