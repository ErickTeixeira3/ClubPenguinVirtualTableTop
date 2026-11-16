// Suíte consolidada de testes de regressão da Fase 6 (A1–A33 + D-3), somente local.
// Nenhum SDK de rede, credencial ou banco real é usado.
// Executar: node auditoria_refatoracao/validar-regressoes.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const repoRoot = process.cwd();
const results = [];
const writes = [];
const mockCollections = new Map();

function check(id, description, evidence, predicate) {
  assert.ok(predicate, `[${id}] ${description}`);
  results.push({ id, description, passed: true, evidence });
}

// Armazenamento e event emitter em memória para window/document/storage/hooks
function createEventTarget(extra = {}) {
  const listeners = new Map();
  return {
    ...extra,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    dispatchEvent(event) {
      for (const fn of [...(listeners.get(event.type) || [])]) fn(event);
    },
    listenerCount(type) {
      return listeners.get(type)?.size || 0;
    },
  };
}

function createMemoryStorage({ dispatchStorage = false } = {}) {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      const str = String(v);
      map.set(k, str);
      if (dispatchStorage && typeof globalThis.window?.dispatchEvent === "function") {
        globalThis.window.dispatchEvent({ type: "storage", key: k, newValue: str });
      }
    },
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
}

globalThis.localStorage = createMemoryStorage({ dispatchStorage: true });
globalThis.sessionStorage = createMemoryStorage();
globalThis.document = createEventTarget({
  visibilityState: "visible",
  body: { nodeType: 1, tagName: "BODY" },
});
globalThis.window = createEventTarget({
  location: { search: "", origin: "http://localhost", pathname: "/" },
  localStorage: globalThis.localStorage,
  sessionStorage: globalThis.sessionStorage,
  open: () => null,
});

// Avaliador local das expressões de .write de database.rules.json
const rtdbSnapshot = (value) => ({
  exists: () => value !== undefined && value !== null,
  val: () => value ?? null,
  child: (childPath) =>
    rtdbSnapshot(childPath.split("/").reduce((v, k) => v?.[k], value)),
  hasChild: (childPath) => {
    const sub = childPath.split("/").reduce((v, k) => v?.[k], value);
    return sub !== undefined && sub !== null;
  },
});

function isRtdbWriteAllowed(rulesJson, rtdbPath, auth, previous, next, rootValue = {}) {
  const parts = rtdbPath.split("/");
  let node = rulesJson.rules;
  const vars = { auth, root: rtdbSnapshot(rootValue) };
  for (let i = 0; node && i <= parts.length; i++) {
    if (node[".write"]) {
      const suffix = parts.slice(i);
      const nest = (v) => suffix.reduceRight((r, k) => ({ [k]: r }), v);
      const ok = Boolean(
        vm.runInNewContext(node[".write"], {
          ...vars,
          data: rtdbSnapshot(nest(previous)),
          newData: rtdbSnapshot(nest(next)),
        })
      );
      if (ok) return true;
    }
    if (i === parts.length) break;
    const key = Object.hasOwn(node, parts[i])
      ? parts[i]
      : Object.keys(node).find((k) => k.startsWith("$"));
    if (key?.startsWith("$")) vars[key] = parts[i];
    node = node[key];
  }
  return false;
}

// Mini runner de hooks e componentes React 19 sem jsdom
function createReactRunner(reactMod) {
  const internals =
    reactMod.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  function mount(Component, initialProps) {
    let currentProps = initialProps;
    const states = [];
    const refs = [];
    const memos = [];
    const callbacks = [];
    const effects = [];
    let hookIndex = 0;
    let isRendering = false;
    let renderPhaseUpdate = false;
    let unmounted = false;
    let lastElement = null;

    const depsChanged = (prev, next) =>
      !prev ||
      !next ||
      prev.length !== next.length ||
      prev.some((v, i) => !Object.is(v, next[i]));

    function runEffects() {
      if (unmounted) return;
      for (const eff of effects) {
        if (!eff || !eff.shouldRun) continue;
        eff.shouldRun = false;
        if (typeof eff.cleanup === "function") {
          eff.cleanup();
          eff.cleanup = undefined;
        }
        const cleanup = eff.create();
        eff.cleanup = typeof cleanup === "function" ? cleanup : undefined;
      }
    }

    function render() {
      if (unmounted) return lastElement;
      const prevDispatcher = internals.H;
      let loops = 0;
      let setups = [];
      try {
        do {
          renderPhaseUpdate = false;
          isRendering = true;
          hookIndex = 0;
          setups = [];
          internals.H = {
            useState(init) {
              const idx = hookIndex++;
              if (!(idx in states)) {
                states[idx] = typeof init === "function" ? init() : init;
              }
              const setState = (action) => {
                if (unmounted) return;
                const prev = states[idx];
                const next = typeof action === "function" ? action(prev) : action;
                if (Object.is(prev, next)) return;
                states[idx] = next;
                if (isRendering) renderPhaseUpdate = true;
                else render();
              };
              return [states[idx], setState];
            },
            useRef(init) {
              const idx = hookIndex++;
              if (!(idx in refs)) refs[idx] = { current: init };
              return refs[idx];
            },
            useMemo(factory, deps) {
              const idx = hookIndex++;
              const prev = memos[idx];
              if (!prev || depsChanged(prev.deps, deps)) {
                memos[idx] = { value: factory(), deps };
              }
              return memos[idx].value;
            },
            useCallback(fn, deps) {
              const idx = hookIndex++;
              const prev = callbacks[idx];
              if (!prev || depsChanged(prev.deps, deps)) {
                callbacks[idx] = { value: fn, deps };
              }
              return callbacks[idx].value;
            },
            useEffect(create, deps) {
              const idx = hookIndex++;
              setups.push({ idx, create, deps });
            },
            useLayoutEffect(create, deps) {
              const idx = hookIndex++;
              setups.push({ idx, create, deps });
            },
            useContext(ctx) {
              return ctx._currentValue;
            },
          };
          lastElement = Component(currentProps);
          isRendering = false;
        } while (renderPhaseUpdate && ++loops < 25);
      } finally {
        isRendering = false;
        internals.H = prevDispatcher;
      }
      for (const s of setups) {
        const prev = effects[s.idx];
        const changed = !prev || s.deps === undefined || depsChanged(prev.deps, s.deps);
        effects[s.idx] = {
          deps: s.deps,
          create: s.create,
          cleanup: prev?.cleanup,
          shouldRun: changed,
        };
      }
      runEffects();
      return lastElement;
    }

    render();
    return {
      getElement: () => lastElement,
      updateProps(nextProps) {
        currentProps = nextProps;
        return render();
      },
      unmount() {
        unmounted = true;
        for (const eff of effects) {
          if (typeof eff?.cleanup === "function") eff.cleanup();
        }
      },
    };
  }
  return { mount };
}

function findElements(node, predicate, acc = []) {
  if (node == null || typeof node !== "object") return acc;
  if (Array.isArray(node)) {
    for (const child of node) findElements(child, predicate, acc);
    return acc;
  }
  if (predicate(node)) acc.push(node);
  if (node.props?.children !== undefined) findElements(node.props.children, predicate, acc);
  if (node.children !== undefined) findElements(node.children, predicate, acc);
  return acc;
}

function collectText(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object") return collectText(node.props?.children ?? node.children);
  return "";
}

globalThis.__REGRESS_CTX__ = {
  user: { uid: "gm1", email: "gm@example.invalid" },
  campaignId: "main-table",
  campaign: { id: "main-table", gmId: "gm1", players: {} },
  isGM: true,
  isRealGM: true,
  items: [],
  folders: [],
  writes,
  mockCollections,
  rtdbStore: {},
  onSnapshotQueries: [],
};

const vite = await createServer({
  root: repoRoot,
  configFile: false,
  logLevel: "error",
  server: { middlewareMode: true, hmr: false },
  ssr: {
    external: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    noExternal: ["firebase", /^firebase\//],
  },
  plugins: [
    {
      name: "offline-regression-stubs",
      enforce: "pre",
      resolveId(source) {
        if (source === "firebase/firestore") return "\0stub-fs";
        if (source === "firebase/database") return "\0stub-rtdb";
        if (source === "firebase/auth") return "\0stub-auth";
        if (
          source === "./firebase" ||
          source === "../services/firebase" ||
          source === "../../services/firebase" ||
          source.endsWith("/services/firebase") ||
          source.endsWith("/services/firebase.js")
        ) {
          return "\0stub-fb-app";
        }
        if (source === "../contexts/AuthContext" || source === "../../contexts/AuthContext") {
          return "\0stub-ctx-auth";
        }
        if (source === "../contexts/CampaignContext" || source === "../../contexts/CampaignContext") {
          return "\0stub-ctx-camp";
        }
        if (source === "./useFolders" || source === "../hooks/useFolders") return "\0stub-folders";
        if (source === "../services/mediaService" || source === "./mediaService") return "\0stub-media";
        if (source === "../../hooks/useMediaUrl" || source.endsWith("/useMediaUrl")) return "\0stub-media-url";
        return null;
      },
      load(id) {
        if (id === "\0stub-fs") {
          return `
            const ctx = () => globalThis.__REGRESS_CTX__;
            export function collection(_db, ...parts) { return { kind: "col", path: parts.join("/") }; }
            export function doc(_db, ...parts) { return { kind: "doc", id: parts[parts.length - 1], path: parts.join("/") }; }
            export function where(field, op, value) { return { kind: "where", field, op, value }; }
            export function or(...filters) { return { kind: "or", filters }; }
            export function query(colRef, ...constraints) { return { kind: "query", colRef, constraints }; }
            export function serverTimestamp() { return "__SERVER_TIMESTAMP__"; }
            export async function setDoc(refObj, payload) {
              ctx().writes.push({ store: "fs", op: "set", path: refObj.path, payload });
            }
            export async function updateDoc(refObj, payload) {
              ctx().writes.push({ store: "fs", op: "update", path: refObj.path, payload });
            }
            export async function deleteDoc(refObj) {
              ctx().writes.push({ store: "fs", op: "delete", path: refObj.path });
            }
            export async function getDocs(colOrQuery) {
              const p = colOrQuery.path || colOrQuery.colRef?.path || "";
              const list = ctx().mockCollections.get(p) || [];
              return {
                docs: list.map((item) => ({
                  id: item.id,
                  ref: { kind: "doc", id: item.id, path: p + "/" + item.id },
                  data: () => item,
                })),
              };
            }
            export function writeBatch() {
              const ops = [];
              return {
                update(refObj, payload) { ops.push({ store: "fs", op: "batchUpdate", path: refObj.path, payload }); },
                set(refObj, payload) { ops.push({ store: "fs", op: "batchSet", path: refObj.path, payload }); },
                async commit() { ctx().writes.push(...ops); },
              };
            }
            export function onSnapshot(q, onNext) {
              ctx().onSnapshotQueries.push(q);
              const p = q.colRef?.path || q.path || "";
              const docs = (ctx().mockCollections.get(p) || []).map((item) => ({
                id: item.id,
                data: () => item,
              }));
              onNext({ docs, metadata: { fromCache: false } });
              return () => {};
            }
          `;
        }
        if (id === "\0stub-rtdb") {
          return `
            const ctx = () => globalThis.__REGRESS_CTX__;
            export function ref(_rtdb, p) { return { path: p }; }
            export function serverTimestamp() { return "__RTDB_TS__"; }
            export async function set(refObj, payload) {
              ctx().writes.push({ store: "rtdb", op: "set", path: refObj.path, payload });
              ctx().rtdbStore[refObj.path] = payload;
            }
            export async function update(refObj, payload) {
              ctx().writes.push({ store: "rtdb", op: "update", path: refObj.path, payload });
              ctx().rtdbStore[refObj.path] = { ...(ctx().rtdbStore[refObj.path] || {}), ...payload };
            }
            export async function remove(refObj) {
              ctx().writes.push({ store: "rtdb", op: "remove", path: refObj.path });
              delete ctx().rtdbStore[refObj.path];
            }
            export async function get(refObj) {
              const val = ctx().rtdbStore[refObj.path] ?? null;
              return { exists: () => val !== null, val: () => val };
            }
            export function onValue(refObj, onNext) {
              const val = ctx().rtdbStore[refObj.path] ?? null;
              onNext({ exists: () => val !== null, val: () => val });
              return () => {};
            }
            export function onDisconnect() { return { remove: async () => {} }; }
          `;
        }
        if (id === "\0stub-auth") {
          return `export class GoogleAuthProvider {}`;
        }
        if (id === "\0stub-fb-app") {
          return `
            export const DEFAULT_CAMPAIGN_ID = "main-table";
            export const db = {};
            export const rtdb = {};
            export const auth = { currentUser: null };
            export const googleProvider = {};
          `;
        }
        if (id === "\0stub-ctx-auth") {
          return `export function useAuth() { return { user: globalThis.__REGRESS_CTX__.user }; }`;
        }
        if (id === "\0stub-ctx-camp") {
          return `
            export function useCampaign() {
              const s = globalThis.__REGRESS_CTX__;
              return {
                campaignId: s.campaignId,
                campaign: s.campaign,
                isGM: s.isGM,
                isRealGM: s.isRealGM,
                setActiveScene: async () => {},
              };
            }
          `;
        }
        if (id === "\0stub-folders") {
          return `
            export function useFolders() {
              return {
                folders: globalThis.__REGRESS_CTX__.folders,
                setFolders: (fn) => {
                  const prev = globalThis.__REGRESS_CTX__.folders;
                  globalThis.__REGRESS_CTX__.folders = typeof fn === "function" ? fn(prev) : fn;
                },
              };
            }
          `;
        }
        if (id === "\0stub-media") {
          return `export async function uploadCompressedMedia() { return { mediaId: "med_stub" }; }`;
        }
        if (id === "\0stub-media-url") {
          return `export function useMediaUrl(_id, ext) { return { url: ext || null, loading: false }; }`;
        }
        return null;
      },
    },
  ],
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  const { mount } = createReactRunner(React);

  const rtdbPaths = await vite.ssrLoadModule("/src/services/rtdbPaths.js");
  const visibilitySvc = await vite.ssrLoadModule("/src/services/visibilityService.js");
  const combatEngine = await vite.ssrLoadModule("/src/engines/combatEngine.js");
  const combatSvc = await vite.ssrLoadModule("/src/services/combatService.js");
  const rollSvc = await vite.ssrLoadModule("/src/services/rollService.js");
  const journalSvc = await vite.ssrLoadModule("/src/services/journalService.js");
  const migrationSvc = await vite.ssrLoadModule("/src/services/migrationService.js");
  const strUtils = await vite.ssrLoadModule("/src/utils/stringUtils.js");
  const { useCharacters } = await vite.ssrLoadModule("/src/hooks/useCharacters.js");
  const { useScenes } = await vite.ssrLoadModule("/src/hooks/useScenes.js");
  const { useCrossWindowSync } = await vite.ssrLoadModule("/src/hooks/useCrossWindowSync.js");
  const { useRealtimeTokens } = await vite.ssrLoadModule("/src/hooks/useRealtimeTokens.js");
  const { useDebouncedCallback } = await vite.ssrLoadModule("/src/hooks/useDebouncedCallback.js");
  const DebouncedField = (await vite.ssrLoadModule("/src/components/ui/DebouncedField.jsx")).default;
  const CharactersSidebarList = (await vite.ssrLoadModule("/src/components/sheets/CharactersSidebarList.jsx")).default;
  const SheetRollsTab = (await vite.ssrLoadModule("/src/components/sheets/tabs/SheetRollsTab.jsx")).default;
  const RollMessageCard = (await vite.ssrLoadModule("/src/components/chat/RollMessageCard.jsx")).default;
  const SheetAttributesTab = (await vite.ssrLoadModule("/src/components/sheets/tabs/SheetAttributesTab.jsx")).default;
  const NoteEditorModal = (await vite.ssrLoadModule("/src/components/journal/NoteEditorModal.jsx")).default;

  const rtdbRules = JSON.parse(fs.readFileSync(path.resolve(repoRoot, "database.rules.json"), "utf8"));
  const fsRulesText = fs.readFileSync(path.resolve(repoRoot, "firestore.rules"), "utf8");

  // ------------------------------------------------------------------
  // 6.1 & 6.7 — RTDB paths + Rules (A1, A2, A3, A4, A32, A33, D-3)
  // ------------------------------------------------------------------
  check(
    "A1-A3",
    "RTDB layout split ativo com caminhos unificados e rules permitindo pings/drawings do autor",
    { layout: rtdbPaths.RTDB_LAYOUT, drawings: rtdbPaths.drawingsPath("c", "s"), pings: rtdbPaths.pingsPath("c", "s") },
    rtdbPaths.RTDB_LAYOUT === "split" &&
      rtdbPaths.IS_SPLIT_RTDB_LAYOUT === true &&
      rtdbPaths.drawingsPath("main-table", "s1") === "vtt_realtime/main-table/drawings/s1" &&
      rtdbPaths.pingsPath("main-table", "s1") === "vtt_realtime/main-table/pings/s1" &&
      isRtdbWriteAllowed(
        rtdbRules,
        "vtt_realtime/main-table/pings/s1/p1",
        { uid: "player1", token: { email: "p1@example.invalid" } },
        null,
        { authorId: "player1", senderId: "player1", x: 1, y: 2 }
      ) &&
      isRtdbWriteAllowed(
        rtdbRules,
        "vtt_realtime/main-table/drawings/s1/d1",
        { uid: "player1", token: { email: "p1@example.invalid" } },
        null,
        { authorId: "player1", layer: "tokens", points: [0, 0] }
      )
  );

  writes.length = 0;
  globalThis.__REGRESS_CTX__.user = { uid: "player1" };
  globalThis.__REGRESS_CTX__.isGM = false;
  globalThis.__REGRESS_CTX__.isRealGM = false;
  globalThis.__REGRESS_CTX__.campaign = { id: "main-table", gmId: "gm1" };
  const mountedCharsP1 = mount(() => useCharacters(), {});
  await mountedCharsP1.getElement().createFolder({ name: "Pasta Jogador" });
  const folderWrite = writes.find((w) => w.path.includes("/folders/"));
  mountedCharsP1.unmount();

  check(
    "A4",
    "createFolder grava scope='player' e firestore.rules permite renomeação por editableBy mantendo D-3",
    { scope: folderWrite?.payload?.scope },
    folderWrite?.payload?.scope === "player" &&
      fsRulesText.includes("request.auth.uid in resource.data.editableBy") &&
      fsRulesText.includes("(!touchesSoftDeleteFields() || isResourceOwner())")
  );

  // ------------------------------------------------------------------
  // 6.2 — Visibilidade e Permissões (A5–A11)
  // ------------------------------------------------------------------
  const mergedTransfer = visibilitySvc.applyOwnerAndGmAudience(
    { ownerId: "player2" },
    { ownerId: "gm1", visibleTo: ["gm1"], editableBy: ["gm1"] },
    "gm1"
  );
  const removedAll = visibilitySvc.applyOwnerAndGmAudience(
    { visibleTo: [] },
    { ownerId: "player1", visibleTo: ["ALL"], editableBy: ["player1"] },
    "gm1"
  );
  check(
    "A7-A8",
    "Transferência inclui novo dono em visibleTo/editableBy e remover ALL mantém Mestre e dono",
    { mergedTransfer, removedAll },
    mergedTransfer.visibleTo.includes("player2") &&
      mergedTransfer.visibleTo.includes("gm1") &&
      mergedTransfer.editableBy.includes("player2") &&
      removedAll.visibleTo.includes("player1") &&
      removedAll.visibleTo.includes("gm1")
  );

  writes.length = 0;
  const partyNote = { id: "n1", ownerId: "player1", scope: "party", visibleTo: ["ALL"] };
  await journalSvc.revokeJournalNoteAccess({
    campaignId: "main-table",
    campaign: { gmId: "gm1" },
    user: { uid: "player1" },
    isGM: false,
    isRealGM: false,
    note: partyNote,
    noteId: partyNote.id,
    target: "party",
  });
  const revokeWrite = writes.find((w) => w.path.endsWith("/notes/n1"));
  check(
    "A9",
    "Revogar ALL de card preserva [Mestre, dono] em visibleTo",
    revokeWrite?.payload,
    revokeWrite?.payload?.scope === "player" &&
      revokeWrite?.payload?.visibleTo?.includes("player1") &&
      revokeWrite?.payload?.visibleTo?.includes("gm1")
  );

  // A5 + A6 + A8 via migrationService.runCampaignMigrations
  writes.length = 0;
  mockCollections.set("campaigns/main-table/characters", [
    { id: "c_leg", ownerId: "player1", visibleTo: [], rollGroups: [], hotbar: [] },
  ]);
  mockCollections.set("campaigns/main-table/notes", [
    { id: "n_leg", ownerId: "player1", scope: "player", visibleTo: [] },
  ]);
  mockCollections.set("campaigns/main-table/folders", [
    { id: "f_leg", ownerId: "player1", scope: "player", folderType: "character", visibleTo: [] },
  ]);
  mockCollections.set("campaigns/main-table/scenes", [
    { id: "s_div", visibleToPlayers: true, visibleTo: ["gm1"] },
  ]);
  mockCollections.set("campaigns/main-table/compendium", [
    { id: "cp_div", visibleToPlayers: false, visibleTo: ["ALL"] },
  ]);
  mockCollections.set("campaigns/main-table/messages", []);
  await migrationSvc.runCampaignMigrations({ campaignId: "main-table", gmUid: "gm1" });
  const sceneMig = writes.find((w) => w.path.endsWith("/scenes/s_div"))?.payload;
  const compMig = writes.find((w) => w.path.endsWith("/compendium/cp_div"))?.payload;
  const charMig = writes.find((w) => w.path.endsWith("/characters/c_leg"))?.payload;
  check(
    "A5-A6",
    "Migração repara visibleTo vazio em fichas/pastas/notas e alinha cenas/compêndio a visibleToPlayers",
    { sceneMig, compMig, charMig },
    sceneMig?.visibleTo?.includes("ALL") &&
      !compMig?.visibleTo?.includes("ALL") &&
      compMig?.visibleTo?.includes("gm1") &&
      charMig?.visibleTo?.includes("player1") &&
      charMig?.visibleTo?.includes("gm1")
  );

  // A10: Visão Player do GM oculta mapa secreto mesmo com uid do GM em visibleTo
  mockCollections.set("campaigns/main-table/scenes", [
    { id: "s_priv", name: "Covil Secreto", visibleToPlayers: false, visibleTo: ["gm1"] },
    { id: "s_pub", name: "Praça", visibleToPlayers: true, visibleTo: ["ALL"] },
  ]);
  globalThis.__REGRESS_CTX__.user = { uid: "gm1" };
  globalThis.__REGRESS_CTX__.isRealGM = true;
  globalThis.__REGRESS_CTX__.isGM = false; // Visão Player ativa
  const mountedScenes = mount(() => useScenes(), {});
  const scenesVis = mountedScenes.getElement().scenes;
  mountedScenes.unmount();
  check(
    "A10",
    "Visão Player do Mestre real oculta cena secreta com visibleToPlayers=false",
    scenesVis.map((s) => s.id),
    scenesVis.length === 1 && scenesVis[0].id === "s_pub"
  );

  // A11: lista lateral do jogador mostra própria e compartilhada por uid/editableBy, exclui ficha alheia só com ALL
  const sidebarHtml = renderToStaticMarkup(
    React.createElement(CharactersSidebarList, {
      campaignId: "main-table",
      isGM: false,
      currentUser: { uid: "player1" },
      gmId: "gm1",
      playersMap: { gm1: { uid: "gm1", displayName: "GM" }, player1: { uid: "player1", displayName: "P1" }, player2: { uid: "player2", displayName: "P2" } },
      characters: [
        { id: "c_own", name: "Ficha Propria", ownerId: "player1", visibleTo: ["ALL"] },
        { id: "c_shared", name: "Ficha Compartilhada", ownerId: "player2", visibleTo: ["player1", "player2", "gm1"] },
        { id: "c_all_other", name: "Ficha Alheia ALL", ownerId: "player2", visibleTo: ["ALL"] },
      ],
      folders: [],
      canEditCharacter: (c) => c.ownerId === "player1",
      onOpenSheet: () => {},
    })
  );
  check(
    "A11",
    "CharactersSidebarList exibe fichas próprias/compartilhadas e oculta ficha alheia apenas com ALL",
    { hasOwn: sidebarHtml.includes("Ficha Propria"), hasShared: sidebarHtml.includes("Ficha Compartilhada"), hasOther: sidebarHtml.includes("Ficha Alheia ALL") },
    sidebarHtml.includes("Ficha Propria") &&
      sidebarHtml.includes("Ficha Compartilhada") &&
      !sidebarHtml.includes("Ficha Alheia ALL")
  );

  // ------------------------------------------------------------------
  // 6.3 — Alvos e Atalhos (A12–A19)
  // ------------------------------------------------------------------
  // A12 + A13: BroadcastChannel ausente usa localStorage + evento storage mantendo múltiplos alvos entre 2 janelas
  const origBroadcast = globalThis.BroadcastChannel;
  globalThis.BroadcastChannel = undefined;
  let win2Targets = [];
  let win1Sync = null;
  const mountedWin1 = mount(
    () => {
      win1Sync = useCrossWindowSync({
        campaignId: "main-table",
        targetedTokens: [{ id: "t1" }, { id: "t2" }, { id: "t3" }],
        onTargetsReceived: () => {},
      });
      return null;
    },
    {}
  );
  const mountedWin2 = mount(
    () =>
      useCrossWindowSync({
        campaignId: "main-table",
        targetedTokens: [],
        onTargetsReceived: ({ targetedTokens }) => {
          win2Targets = targetedTokens;
        },
      }),
    {}
  );
  win1Sync.broadcastTargets([{ id: "t1" }, { id: "t2" }, { id: "t3" }]);
  const syncedThree = win2Targets.map((t) => t.id).join(",");
  win1Sync.broadcastTargets([{ id: "t1" }, { id: "t3" }]);
  const syncedTwo = win2Targets.map((t) => t.id).join(",");
  mountedWin2.unmount();
  mountedWin1.unmount();
  globalThis.BroadcastChannel = origBroadcast;
  check(
    "A12-A13",
    "useCrossWindowSync sincroniza múltiplos alvos e redução via fallback localStorage/storage",
    { syncedThree, syncedTwo },
    syncedThree === "t1,t2,t3" && syncedTwo === "t1,t3"
  );

  // A14: /r da dock (rollKind: check) com alvos preserva targetInfo sem comparar Defesa
  writes.length = 0;
  const dockRoll = await rollSvc.executeChatRollMessage({
    campaignId: "main-table",
    campaign: { gmId: "gm1" },
    user: { uid: "player1" },
    title: "Rolagem (/r)",
    primaryFormula: "1d20 + 2",
    primaryLabel: "Resultado",
    rollKind: combatEngine.ROLL_KINDS.CHECK,
    targetedTokens: [{ id: "t1", defense: 12, sceneId: "s1" }, { id: "t2", defense: 18, sceneId: "s1" }],
  });
  check(
    "A14",
    "/r com alvos anexa targetInfo mantendo isAttackRoll=false e isHit=null",
    { targetCount: dockRoll.rollData.targetInfo?.targetCount, isHit: dockRoll.rollData.targetInfo?.isHit },
    dockRoll.rollData.targetInfo?.targetCount === 2 &&
      dockRoll.rollData.targetInfo?.isAttackRoll === false &&
      dockRoll.rollData.targetInfo?.isHit === null
  );

  // A15 + A18 + A19: ataque custom só acerto, nome de perícia salvo e rollId na Hotbar
  const disparoResolved = rollSvc.resolveDynamicRollEntry(
    { id: "r_disp", name: "Disparo", hitFormula: "1d20 + 5", effectFormula: "", attackWhenTargeted: true },
    { id: "c1", abilities: [], skills: [], inventory: [], attributes: [] }
  );
  const hotbarDisp = rollSvc.buildHotbarSlotFromRoll(disparoResolved);
  const reResolvedHotbar = rollSvc.resolveHotbarSlot(
    { rollId: "r_disp", name: "Disparo", sourceType: "custom" },
    { id: "c1", rollGroups: [{ id: "g1", rolls: [{ id: "r_disp", name: "Disparo", hitFormula: "1d20+5" }] }] }
  );
  const skillRenamed = rollSvc.resolveDynamicRollEntry(
    { id: "r_lut", name: "Perícia Luta", sourceType: "skill", sourceId: "sk_luta" },
    { skills: [{ id: "sk_luta", name: "Combate Corpo a Corpo", attribute: "forca", bonus: 3 }] }
  );
  const rollsTabHtml = renderToStaticMarkup(
    React.createElement(SheetRollsTab, {
      canEdit: true,
      selectedGroupId: null,
      setSelectedGroupId: () => {},
      rollGroups: [],
      skills: [],
      abilities: [],
      character: { id: "c1", rollGroups: [], attributes: [], abilities: [], skills: [], inventory: [], hotbar: [hotbarDisp] },
      triggerRoll: () => {},
      handleDemarcateArea: () => {},
      onUpdateCharacter: () => {},
      pinToRollGroup: () => {},
      rollsForm: {
        newGroupName: "",
        setNewGroupName: () => {},
        setNewCustomRollOpen: () => {},
        importFromSheetOpen: false,
        setImportFromSheetOpen: () => {},
        newCustomRollOpen: true,
        crName: "",
        setCrName: () => {},
        setShowRollIconPicker: () => {},
        crIcon: "sword",
        showRollIconPicker: false,
        setCrIcon: () => {},
        crColor: "#02529c",
        setCrColor: () => {},
        crHit: "1d20",
        setCrHit: () => {},
        crEffect: "",
        setCrEffect: () => {},
        crCostRes: "mp",
        setCrCostRes: () => {},
        crCostAmt: 0,
        setCrCostAmt: () => {},
        crEffectType: "damage",
        setCrEffectType: () => {},
        crRollKind: "attack",
        setCrRollKind: () => {},
        setEditingRollIconTarget: () => {},
        setHotbarModalRoll: () => {},
        crSaveEnabled: false,
        crSaveDc: "12",
        crSaveAttr: "vigor",
        crSaveDesc: "",
        setCrSaveEnabled: () => {},
        setCrSaveDc: () => {},
        setCrSaveAttr: () => {},
        setCrSaveDesc: () => {},
      },
    })
  );
  check(
    "A15-A18-A19",
    "Seletor Ataque/Teste em SheetRollsTab, nome 'Perícia Luta' preservado e rollId preservado em resolveHotbarSlot",
    { attackWhenTargeted: disparoResolved.attackWhenTargeted, skillName: skillRenamed.name, rollId: reResolvedHotbar.rollId },
    hotbarDisp.rollKind === null &&
      reResolvedHotbar.rollId === "r_disp" &&
      skillRenamed.name === "Perícia Luta" &&
      rollsTabHtml.includes("Ataque") &&
      rollsTabHtml.includes("Teste")
  );

  // A16 + A17: atalho homônimo com fórmula própria e ícone de atributo via runCampaignMigrations
  writes.length = 0;
  mockCollections.set("campaigns/main-table/characters", [
    {
      id: "c_mig16",
      ownerId: "player1",
      visibleTo: ["player1", "gm1"],
      abilities: [{ id: "ab1", name: "Rajada", hitFormula: "1d20 + 2", effectFormula: "1d6", effectType: "damage" }],
      attributes: [{ key: "forca", label: "Força", value: 2 }],
      rollGroups: [
        {
          id: "grp1",
          rolls: [
            { id: "r1", name: "Rajada", hitFormula: "2d20kh1 + 5", effectFormula: "2d6", icon: "star" },
            { id: "r2", name: "Teste Força", sourceType: "attribute", sourceId: "forca", icon: "heart" },
          ],
        },
      ],
      hotbar: [],
    },
  ]);
  await migrationSvc.runCampaignMigrations({ campaignId: "main-table", gmUid: "gm_mig_diff" });
  const char16Patch = writes.find((w) => w.path.endsWith("/characters/c_mig16"))?.payload;
  const fixedRajada = char16Patch?.rollGroups?.[0]?.rolls?.[0];
  const fixedAttrIcon = char16Patch?.rollGroups?.[0]?.rolls?.[1];
  check(
    "A16-A17",
    "Atalho legado com fórmula divergente permanece custom e atalho de atributo preserva ícone personalizado",
    { rajadaSource: fixedRajada?.sourceType, attrCustomIcon: fixedAttrIcon?.customIcon },
    fixedRajada?.sourceType === "custom" && fixedAttrIcon?.customIcon === true
  );

  // ------------------------------------------------------------------
  // 6.4 — Combate (A20–A23)
  // ------------------------------------------------------------------
  localStorage.clear();
  const win2Claim = combatSvc.tryClaimSavingThrowModal("main-table", "save_x", "w2", { priority: 2 });
  const win1Claim = combatSvc.tryClaimSavingThrowModal("main-table", "save_x", "w1", { priority: 1 });
  const submit1 = combatSvc.tryBeginSavingThrowSubmission("main-table", "save_x", "w2");
  const submit2 = combatSvc.tryBeginSavingThrowSubmission("main-table", "save_x", "w1");
  combatSvc.markSavingThrowAnswered("main-table", "save_x", "w2");
  const cardAnsweredHtml = renderToStaticMarkup(
    React.createElement(RollMessageCard, {
      msg: {
        id: "m1",
        senderId: "gm1",
        senderName: "GM",
        rollData: {
          title: "Sopro",
          savingThrowRequest: { id: "save_x", dc: 14, attribute: "vigor" },
          rolls: [{ label: "Dano", total: 10 }],
        },
      },
      isGM: false,
      user: { uid: "player1" },
      characters: [{ id: "c1", ownerId: "player1" }],
      allCharacters: [{ id: "c1", ownerId: "player1" }],
      messages: [
        {
          id: "m_resp",
          rollData: {
            respondedToSaveId: "save_x",
            savingThrowOutcome: { passed: true, total: 16, dc: 14 },
            rolls: [{ total: 16 }],
          },
        },
      ],
    })
  );
  check(
    "A20",
    "Coordenação entre janelas impede abertura/submissão duplicada de Teste de Resistência",
    { win2Claim, win1Claim, submit1, submit2 },
    win2Claim.claimed === true &&
      win1Claim.claimed === false &&
      submit1.allowed === true &&
      submit2.allowed === false &&
      combatSvc.isSavingThrowAnswered("main-table", "save_x") &&
      cardAnsweredHtml.includes("disabled")
  );

  writes.length = 0;
  const npcMsg = await rollSvc.executeChatRollMessage({
    campaignId: "main-table",
    campaign: { gmId: "gm1" },
    user: { uid: "gm1" },
    character: { id: "npc_1", name: "Guarda", type: "npc", ownerId: "gm1", resources: { mp: { current: 15, max: 15 } } },
    title: "Habilidade NPC",
    primaryFormula: "1d20",
    primaryLabel: "Acerto",
    rollKind: combatEngine.ROLL_KINDS.ATTACK,
    costResource: "mp",
    costAmount: 3,
    onDeductResource: async () =>
      combatSvc.deductActorResources({
        campaignId: "main-table",
        campaign: { gmId: "gm1" },
        character: { id: "npc_1", type: "npc", ownerId: "gm1", resources: { mp: { current: 15, max: 15 } } },
        costs: { mp: 3 },
        actorToken: null,
        updateCharacterResource: async () => {},
      }),
  });
  check(
    "A21",
    "Matriz NPC sem token selecionado não desconta nem grava costPaid falso no card",
    { costPaid: npcMsg.rollData.costPaid },
    npcMsg.rollData.costPaid === null
  );

  const npcTargetRes = combatEngine.resolveTokenTargetData({
    targetedToken: { id: "tok_npc", characterId: "npc_1", characterType: "npc", isGmToken: true, defense: 18 },
    allCharacters: [{ id: "npc_1", type: "npc", defense: 12 }],
  });
  check(
    "A22",
    "Defesa do token é autoritativa para instâncias de NPC em cena",
    { resolvedDefense: npcTargetRes.defense },
    npcTargetRes.defense === 18
  );

  const offTurn = combatEngine.evaluateActorAct(
    combatEngine.normalizeCombatState({
      active: true,
      turnOrder: [{ characterId: "other", actionsRemaining: 1 }, { characterId: "pc1", actionsRemaining: 1 }],
    }),
    { id: "pc1", attributes: [] },
    "active",
    { isGM: false }
  );
  const invTabSource = fs.readFileSync(path.resolve(repoRoot, "src/components/sheets/tabs/SheetInventoryTab.jsx"), "utf8");
  check(
    "A23",
    "Modo de Turno bloqueia ação fora da vez e SheetInventoryTab só consome quando triggerRoll é aceito",
    { allowed: offTurn.allowed, awaitsRollAccepted: invTabSource.includes("rollAccepted !== false") },
    offTurn.allowed === false && invTabSource.includes("rollAccepted !== false")
  );

  // ------------------------------------------------------------------
  // 6.5 — Avatares e Perfil (A24–A27)
  // ------------------------------------------------------------------
  const charUrlId = rollSvc.resolveSpeakerIdentity({
    character: { id: "c1", name: "Pinguim URL", avatarExternalUrl: "https://example.invalid/p.png" },
    user: { uid: "player1" },
  });
  const playerSpeakId = rollSvc.resolveSpeakerIdentity({
    character: null,
    user: { uid: "player1", photoURL: "https://example.invalid/google.png" },
    playersMap: { player1: { uid: "player1", avatarMediaId: "med_p1", photoURL: null, avatarRemoved: true } },
  });
  sessionStorage.clear();
  strUtils.savePendingAvatarDataUrl("uid_a", "data:image/webp;base64,QUJD");
  const crossUserRead = strUtils.readPendingAvatarDataUrl("uid_b");
  const ctxSrc = fs.readFileSync(path.resolve(repoRoot, "src/contexts/CampaignContext.jsx"), "utf8");
  check(
    "A24-A27",
    "Avatar externo na ficha, identidade de jogador, bloqueio pós-remoção Google e isolamento de pending avatar por uid",
    { charPhoto: charUrlId.senderPhotoURL, playerPhoto: playerSpeakId.photoURL, playerMed: playerSpeakId.senderAvatarMediaId, crossUserRead },
    charUrlId.senderPhotoURL === "https://example.invalid/p.png" &&
      playerSpeakId.characterId === null &&
      playerSpeakId.senderAvatarMediaId === "med_p1" &&
      playerSpeakId.photoURL === null &&
      ctxSrc.includes('authProfileUpdates.photoURL = ""') &&
      crossUserRead === null
  );

  // ------------------------------------------------------------------
  // 6.6 — Debounce e Diário (A28–A31)
  // ------------------------------------------------------------------
  const mountedField28 = mount(DebouncedField, { type: "number", value: 1, delay: 20, onCommit: () => {} });
  mountedField28.getElement().props.onChange({ target: { value: "0" } });
  mountedField28.getElement().props.onBlur();
  await Promise.resolve();
  const realignedVal = mountedField28.getElement().props.value;
  mountedField28.updateProps({ type: "number", value: 30, delay: 40, onCommit: () => { throw new Error("should-cancel"); } });
  mountedField28.getElement().props.onChange({ target: { value: "2" } });
  mountedField28.updateProps({ type: "number", value: 20, delay: 40, onCommit: () => { throw new Error("should-cancel"); } });
  await wait(70);
  const valAfterCancel = mountedField28.getElement().props.value;
  mountedField28.unmount();

  const flushedEvents = [];
  let debHostApi = null;
  const mountedDeb = mount(() => { debHostApi = useDebouncedCallback((v) => flushedEvents.push(v), 5000); return null; }, {});
  debHostApi.run("p1");
  globalThis.window.dispatchEvent({ type: "pagehide" });
  debHostApi.run("b1");
  globalThis.window.dispatchEvent({ type: "beforeunload" });
  mountedDeb.unmount();

  writes.length = 0;
  await combatSvc.syncTokenUpdatesToCharacter({
    token: { id: "t1", characterId: "c1" },
    updatedFields: { hpCurrent: 18 },
    allCharacters: [{ id: "c1", ownerId: "player1", type: "pc", resources: { hp: { current: 30, max: 30 } } }],
    campaign: { gmId: "gm1" },
    canEditCharacter: () => true,
    updateCharacter: async (_cid, patch) => writes.push({ store: "dotcheck", patch }),
  });
  const dotPatch = writes.find((w) => w.store === "dotcheck")?.patch;
  const tabEl = SheetAttributesTab({
    canEdit: true,
    hp: { current: 30, max: 30, label: "Vida" },
    mp: { current: 10, max: 10, label: "Energia" },
    character: { id: "c1", resources: { hp: { current: 30, max: 30 } }, attributes: [] },
    onUpdateCharacter: async (_cid, patch) => writes.push({ store: "tabdot", patch }),
    cardBgColor: "#fff",
    tokenUrl: null,
    onUploadCharacterImage: () => {},
    onSpawnTokenOnMap: () => {},
    attributes: [],
    triggerRoll: () => {},
    pinToRollGroup: () => {},
    newAttrLabel: "",
    setNewAttrLabel: () => {},
  });
  const hpFields = findElements(tabEl, (el) => el.type === DebouncedField);
  await hpFields[1].props.onCommit("40");
  const tabDotPatch = writes.find((w) => w.store === "tabdot")?.patch;

  check(
    "A28-A30",
    "DebouncedField realinha draft após commit, cancela timer em alteração externa, dá flush em pagehide/beforeunload e usa dot-paths",
    { realignedVal, valAfterCancel, flushedEvents, dotPatch, tabDotPatch },
    realignedVal === 1 &&
      valAfterCancel === 20 &&
      flushedEvents.join(",") === "p1,b1" &&
      dotPatch?.["resources.hp.current"] === 18 &&
      tabDotPatch?.["resources.hp.max"] === 40
  );

  // A31: updateJournalNote retorna { ok: false } e NoteEditorModal fica em somente leitura + exibe erro
  const roNote = { id: "n_ro", ownerId: "gm1", scope: "player", visibleTo: ["gm1", "player1"], editableBy: ["gm1"], title: "Secreto", sections: [{ id: "s1", title: "A", content: "B" }] };
  const updDenied = await journalSvc.updateJournalNote({
    campaignId: "main-table",
    campaign: { gmId: "gm1" },
    user: { uid: "player1" },
    isGM: false,
    existingNote: roNote,
    noteId: roNote.id,
    updates: { title: "Alterado" },
  });
  let modalClosed = 0;
  const mountedNote = mount(NoteEditorModal, {
    note: roNote,
    isGM: true,
    currentUserId: "gm1",
    playersList: [],
    accessibleNotes: [roNote],
    accessibleFolders: [],
    characters: [],
    onSave: async () => ({ ok: false, error: "Erro no servidor" }),
    onClose: () => { modalClosed++; },
  });
  const formEl = findElements(mountedNote.getElement(), (el) => el.type === "form")[0];
  await formEl.props.onSubmit({ preventDefault() {} });
  const alertEl = findElements(mountedNote.getElement(), (el) => el.props?.role === "alert")[0];
  mountedNote.unmount();

  const mountedRoNote = mount(NoteEditorModal, {
    note: roNote,
    isGM: false,
    currentUserId: "player1",
    playersList: [],
    accessibleNotes: [roNote],
    accessibleFolders: [],
    characters: [],
    onSave: async () => ({ ok: true }),
    onClose: () => {},
  });
  const roButtons = findElements(mountedRoNote.getElement(), (el) => el.type === "button").map((b) => collectText(b).trim());
  mountedRoNote.unmount();

  check(
    "A31",
    "updateJournalNote sinaliza erro de permissão e NoteEditorModal bloqueia edição/mantém aberto em falha",
    { updDenied, modalClosed, alertText: collectText(alertEl), hasFechar: roButtons.includes("Fechar") },
    updDenied?.ok === false &&
      updDenied?.reason === "permission-denied" &&
      modalClosed === 0 &&
      collectText(alertEl).includes("Erro no servidor") &&
      roButtons.includes("Fechar") &&
      !roButtons.some((t) => t.includes("Salvar Card"))
  );

  // ------------------------------------------------------------------
  // 6.7 — A32 e A33 (rules + mapa controlledBy + migração)
  // ------------------------------------------------------------------
  const playerAuth = { uid: "player_delegated", token: { email: "p@example.invalid" } };
  const emailGmAuth = { uid: "gm_email", token: { email: "erickteixeiractt@gmail.com" } };
  check(
    "A32",
    "Jogador comum não cria meta/gmId; Mestre por e-mail delega e gm_delegated herda autoridade no RTDB",
    {},
    !isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/meta/gmId", playerAuth, null, "player_delegated") &&
      isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/meta/gmId", emailGmAuth, null, "player_delegated") &&
      isRtdbWriteAllowed(
        rtdbRules,
        "vtt_realtime/main-table/fog/s1",
        playerAuth,
        null,
        { enabled: true },
        { vtt_realtime: { "main-table": { meta: { gmId: "player_delegated" } } } }
      )
  );

  const mapToken = {
    ownerId: "owner1",
    layer: "tokens",
    x: 0,
    controlledBy: { u0: true, u1: true, u2: true, u3: true, u4: true, u5: true, u9: true, bad: false },
  };
  writes.length = 0;
  globalThis.__REGRESS_CTX__.rtdbStore["vtt_realtime/main-table/tokens/s1"] = {
    tok_leg: { id: "tok_leg", ownerId: "owner1", layer: "tokens", controlledBy: ["u0", "u1", "u2", "u3", "u4", "u5"] },
  };
  globalThis.__REGRESS_CTX__.user = { uid: "gm1" };
  globalThis.__REGRESS_CTX__.isGM = true;
  globalThis.__REGRESS_CTX__.isRealGM = true;
  const mountedToks = mount(() => useRealtimeTokens("s1"), {});
  const migratedUpdate = writes.find(
    (w) => w.store === "rtdb" && w.path === "vtt_realtime/main-table/tokens/s1/tok_leg"
  )?.payload;
  const spawnedTok = await combatSvc.spawnCharacterTokenToScene({
    campaignId: "main-table",
    campaign: { gmId: "gm1" },
    user: { uid: "owner1" },
    isGM: false,
    canEditCharacter: () => true,
    activeScene: { id: "s1" },
    char: { id: "pc1", ownerId: "owner1", type: "pc", name: "Herói" },
  });
  mountedToks.unmount();

  check(
    "A33",
    "RTDB aceita mapa controlledBy com 6º/10º controlador, nega false/estranho e migra arrays legados",
    { migratedControlledBy: migratedUpdate?.controlledBy, spawnedControlledBy: spawnedTok?.controlledBy },
    isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/tokens/s1/t1", { uid: "u5", token: {} }, mapToken, { ...mapToken, x: 64 }) &&
      isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/tokens/s1/t1", { uid: "u9", token: {} }, mapToken, { ...mapToken, x: 128 }) &&
      !isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/tokens/s1/t1", { uid: "bad", token: {} }, mapToken, { ...mapToken, x: 0 }) &&
      !isRtdbWriteAllowed(rtdbRules, "vtt_realtime/main-table/tokens/s1/t1", { uid: "stranger", token: {} }, mapToken, { ...mapToken, x: 0 }) &&
      migratedUpdate?.controlledBy?.u5 === true &&
      spawnedTok?.controlledBy?.gm1 === true &&
      spawnedTok?.controlledBy?.owner1 === true
  );

  fs.writeFileSync(
    path.resolve(repoRoot, "auditoria_refatoracao/resultados.json"),
    JSON.stringify(results, null, 2) + "\n",
    "utf8"
  );
  console.log(`REGRESSÃO FASE 6: ${results.length}/${results.length} verificações aprovadas (A1–A33 + D-3).`);
  for (const r of results) console.log(`- [${r.id}] ${r.description}`);
} finally {
  await vite.close();
}
