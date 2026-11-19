/**
 * Firebase falso em memória para testes de serviços e hooks v1 sem rede (porta dos stubs de
 * auditoria_refatoracao/validar-regressoes.mjs). Registra todas as escritas em `fakeDb.writes`.
 *
 * Uso num arquivo de teste:
 *   vi.mock("firebase/firestore", async () => (await import("../support/fakeFirebase.js")).firestoreModule);
 *   vi.mock("firebase/database", async () => (await import("../support/fakeFirebase.js")).databaseModule);
 *   vi.mock("../../src/infra/firebase.js", async () => (await import("../support/fakeFirebase.js")).appModule);
 * e `resetFakeDb()` no beforeEach.
 *
 * Testes de serviço contra o emulador (Fase 2 em diante) substituem este módulo nas suítes reescritas.
 */
export const fakeDb = {
  writes: [],
  collections: new Map(),
  rtdb: {},
  snapshotQueries: []
};

export function resetFakeDb() {
  fakeDb.writes.length = 0;
  fakeDb.collections.clear();
  fakeDb.rtdb = {};
  fakeDb.snapshotQueries.length = 0;
}

const pathOf = (refOrQuery) => refOrQuery?.path || refOrQuery?.colRef?.path || "";
const snapshotDocs = (path) =>
  (fakeDb.collections.get(path) || []).map((item) => ({
    id: item.id,
    ref: { kind: "doc", id: item.id, path: `${path}/${item.id}` },
    data: () => item
  }));

const attachConverter = (target, converter = null) => ({
  ...target,
  converter,
  withConverter: (nextConverter) => attachConverter(target, nextConverter)
});

export const firestoreModule = {
  collection: (_db, ...parts) => attachConverter({ kind: "col", path: parts.join("/") }),
  doc: (_db, ...parts) => {
    const path = parts.join("/");
    const id = path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
    return attachConverter({ kind: "doc", id, path });
  },
  where: (field, op, value) => ({ kind: "where", field, op, value }),
  or: (...filters) => ({ kind: "or", filters }),
  query: (colRef, ...constraints) => attachConverter({ kind: "query", colRef, constraints }, colRef?.converter || null),
  serverTimestamp: () => "__SERVER_TIMESTAMP__",
  increment: (n) => ({ __op: "increment", value: n }),
  deleteField: () => ({ __op: "deleteField" }),
  setDoc: async (ref, payload, options) => {
    const serialized = ref?.converter?.toFirestore ? ref.converter.toFirestore(payload) : payload;
    fakeDb.writes.push({ store: "fs", op: "set", path: ref.path, payload: serialized, options });
  },
  updateDoc: async (ref, payload) => {
    fakeDb.writes.push({ store: "fs", op: "update", path: ref.path, payload });
  },
  getDoc: async (ref) => {
    const [colPath, id] = [ref.path.slice(0, ref.path.lastIndexOf("/")), ref.id];
    const item = (fakeDb.collections.get(colPath) || []).find((d) => d.id === id) || null;
    if (item === null) {
      return { id, exists: () => false, data: () => undefined };
    }
    const readData = ref?.converter?.fromFirestore
      ? () => ref.converter.fromFirestore({ id, data: () => item })
      : () => item;
    return { id, exists: () => true, data: readData };
  },
  runTransaction: async (_db, fn) => {
    const tx = {
      get: async (ref) => firestoreModule.getDoc(ref),
      set: (ref, payload) => {
        const serialized = ref?.converter?.toFirestore ? ref.converter.toFirestore(payload) : payload;
        fakeDb.writes.push({ store: "fs", op: "txSet", path: ref.path, payload: serialized });
      },
      update: (ref, payload) => {
        fakeDb.writes.push({ store: "fs", op: "txUpdate", path: ref.path, payload });
      },
      delete: (ref) => {
        fakeDb.writes.push({ store: "fs", op: "txDelete", path: ref.path });
      }
    };
    return await fn(tx);
  },
  getDocs: async (colOrQuery) => ({ docs: snapshotDocs(pathOf(colOrQuery)) }),
  writeBatch: () => {
    const ops = [];
    return {
      set: (ref, payload) => ops.push({ store: "fs", op: "batchSet", path: ref.path, payload }),
      update: (ref, payload) => ops.push({ store: "fs", op: "batchUpdate", path: ref.path, payload }),
      delete: (ref) => ops.push({ store: "fs", op: "batchDelete", path: ref.path }),
      commit: async () => {
        fakeDb.writes.push(...ops);
      }
    };
  },
  onSnapshot: (queryOrRef, onNext) => {
    fakeDb.snapshotQueries.push(queryOrRef);
    const converter = queryOrRef?.converter || queryOrRef?.colRef?.converter || null;
    const docs = snapshotDocs(pathOf(queryOrRef)).map((docSnap) =>
      converter?.fromFirestore
        ? { ...docSnap, data: () => converter.fromFirestore(docSnap) }
        : docSnap
    );
    onNext({ docs, metadata: { fromCache: false } });
    return () => {};
  }
};

const rtdbSnapshot = (value, key = null) => ({
  key,
  exists: () => value !== null && value !== undefined,
  val: () => value ?? null
});

export const databaseModule = {
  ref: (_rtdb, path) => {
    const key = typeof path === "string" && path.includes("/") ? path.slice(path.lastIndexOf("/") + 1) : path;
    return { path, key };
  },
  serverTimestamp: () => ({ ".sv": "timestamp" }),
  set: async (ref, payload) => {
    fakeDb.writes.push({ store: "rtdb", op: "set", path: ref.path, payload });
    fakeDb.rtdb[ref.path] = payload;
  },
  update: async (ref, payload) => {
    fakeDb.writes.push({ store: "rtdb", op: "update", path: ref.path, payload });
    const current = fakeDb.rtdb[ref.path];
    if (current && typeof current === "object" && !Array.isArray(current)) {
      fakeDb.rtdb[ref.path] = { ...current, ...payload };
    } else {
      fakeDb.rtdb[ref.path] = { ...payload };
    }
    for (const [relKey, val] of Object.entries(payload || {})) {
      if (relKey.includes("/")) {
        const fullChildPath = `${ref.path}/${relKey}`;
        if (val === null) {
          delete fakeDb.rtdb[fullChildPath];
        } else {
          fakeDb.rtdb[fullChildPath] = val;
        }
      }
    }
  },
  remove: async (ref) => {
    fakeDb.writes.push({ store: "rtdb", op: "remove", path: ref.path });
    delete fakeDb.rtdb[ref.path];
  },
  get: async (ref) => rtdbSnapshot(fakeDb.rtdb[ref.path], ref.key),
  onValue: (ref, onNext) => {
    onNext(rtdbSnapshot(fakeDb.rtdb[ref.path], ref.key));
    return () => {};
  },
  runTransaction: async (ref, updateFn) => {
    const currentVal = fakeDb.rtdb[ref.path] ?? null;
    const nextVal = updateFn(currentVal === null ? null : structuredClone(currentVal));
    if (nextVal === undefined) {
      return { committed: false, snapshot: rtdbSnapshot(currentVal, ref.key) };
    }
    fakeDb.writes.push({ store: "rtdb", op: "tx", path: ref.path, payload: nextVal });
    if (nextVal === null) {
      delete fakeDb.rtdb[ref.path];
    } else {
      fakeDb.rtdb[ref.path] = nextVal;
    }
    return { committed: true, snapshot: rtdbSnapshot(nextVal, ref.key) };
  },
  onDisconnect: (ref) => ({
    remove: async () => {
      fakeDb.writes.push({ store: "rtdb", op: "onDisconnectRemove", path: ref?.path || "" });
    },
    set: async (payload) => {
      fakeDb.writes.push({ store: "rtdb", op: "onDisconnectSet", path: ref?.path || "", payload });
    }
  })
};

export const appModule = {
  DEFAULT_CAMPAIGN_ID: "main-table",
  db: {},
  rtdb: {},
  auth: { currentUser: null },
  googleProvider: {}
};
