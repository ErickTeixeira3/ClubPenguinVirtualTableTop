// Formato de snapshot local (local-data/snapshots/<rótulo>/), usado pelo export, pelo seed e pela auditoria.
//   manifest.json  — origem, projeto, data e CONTAGENS (sem dados pessoais);
//   firestore.json — { documents: { "<caminho do documento>": dados codificados } }, todas as subcoleções;
//   database.json  — a árvore inteira do Realtime Database;
//   auth.json      — usuários (uid, e-mail, verificação, provedores); sem hash de senha.
// Tipos do Firestore viram objetos marcados com "__type" para voltarem idênticos no seed.
import fs from "node:fs";
import path from "node:path";
import { GeoPoint, Timestamp } from "firebase-admin/firestore";

const SNAPSHOT_FILES = ["manifest.json", "firestore.json", "database.json", "auth.json"];

export function encodeValue(value) {
  if (value instanceof Timestamp) return { __type: "timestamp", seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { __type: "geopoint", latitude: value.latitude, longitude: value.longitude };
  if (value && typeof value === "object" && typeof value.path === "string" && typeof value.listCollections === "function") {
    return { __type: "reference", path: value.path };
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return { __type: "bytes", base64: Buffer.from(value).toString("base64") };
  if (Array.isArray(value)) return value.map(encodeValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, encodeValue(v)]));
  }
  return value;
}

export function decodeValue(value, firestore) {
  if (Array.isArray(value)) return value.map((v) => decodeValue(v, firestore));
  if (value && typeof value === "object") {
    switch (value.__type) {
      case "timestamp":
        return new Timestamp(value.seconds, value.nanoseconds);
      case "geopoint":
        return new GeoPoint(value.latitude, value.longitude);
      case "reference":
        return firestore.doc(value.path);
      case "bytes":
        return Buffer.from(value.base64, "base64");
      default:
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decodeValue(v, firestore)]));
    }
  }
  return value;
}

/** Lê o Firestore inteiro (todas as coleções e subcoleções), inclusive documentos sem campos que têm filhos. */
export async function readAllFirestoreDocuments(firestore) {
  const documents = {};
  const visitCollection = async (collectionRef) => {
    const refs = await collectionRef.listDocuments();
    for (const ref of refs) {
      const snap = await ref.get();
      if (snap.exists) documents[ref.path] = encodeValue(snap.data());
      for (const sub of await ref.listCollections()) await visitCollection(sub);
    }
  };
  for (const root of await firestore.listCollections()) await visitCollection(root);
  return documents;
}

export async function readAllAuthUsers(auth) {
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const u of page.users) {
      users.push({
        uid: u.uid,
        email: u.email ?? null,
        emailVerified: Boolean(u.emailVerified),
        displayName: u.displayName ?? null,
        photoURL: u.photoURL ?? null,
        disabled: Boolean(u.disabled),
        providerData: u.providerData.map((p) => ({
          providerId: p.providerId,
          uid: p.uid,
          email: p.email ?? null,
          displayName: p.displayName ?? null,
          photoURL: p.photoURL ?? null
        }))
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users.sort((a, b) => a.uid.localeCompare(b.uid));
}

/** Contagens agregadas (sem conteúdo nem dados pessoais) para manifesto e relatórios. */
export function summarizeSnapshot({ documents, database, users }) {
  const byCollection = {};
  for (const docPath of Object.keys(documents)) {
    const segments = docPath.split("/");
    const collectionKey = segments.filter((_, i) => i % 2 === 0).join("/*/");
    byCollection[collectionKey] = (byCollection[collectionKey] || 0) + 1;
  }
  return {
    firestoreDocuments: Object.keys(documents).length,
    firestoreByCollection: Object.fromEntries(Object.entries(byCollection).sort(([a], [b]) => a.localeCompare(b))),
    databaseBytes: Buffer.byteLength(JSON.stringify(database ?? null)),
    authUsers: users.length
  };
}

export function writeSnapshot(dir, { manifest, documents, database, users }) {
  fs.mkdirSync(dir, { recursive: true });
  const write = (name, data) => fs.writeFileSync(path.join(dir, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
  write("firestore.json", { documents });
  write("database.json", database ?? null);
  write("auth.json", { users });
  write("manifest.json", manifest);
}

export function readSnapshot(dir) {
  for (const name of SNAPSHOT_FILES) {
    if (!fs.existsSync(path.join(dir, name))) throw new Error(`Snapshot incompleto: falta ${name} em ${dir}.`);
  }
  const read = (name) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
  return {
    manifest: read("manifest.json"),
    documents: read("firestore.json").documents,
    database: read("database.json"),
    users: read("auth.json").users
  };
}

/** Snapshot mais recente em local-data/snapshots (os rótulos começam pela data ISO). */
export function latestSnapshotDir(snapshotsRoot) {
  if (!fs.existsSync(snapshotsRoot)) return null;
  const dirs = fs
    .readdirSync(snapshotsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(snapshotsRoot, d.name, "manifest.json")))
    .map((d) => d.name)
    .sort();
  return dirs.length > 0 ? path.join(snapshotsRoot, dirs[dirs.length - 1]) : null;
}
