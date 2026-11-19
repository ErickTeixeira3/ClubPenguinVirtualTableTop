// Fase 0 (PROC-04): o app em desenvolvimento usa os emuladores por padrão e recusa a produção
// sem VITE_ALLOW_PRODUCTION=true; as configurações de emulador (dev e testes) são coerentes.
import { execFileSync } from "node:child_process";
import { parseEnv } from "node:util";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readRepoFile } from "../support/sourcePin.js";

const sdk = vi.hoisted(() => ({ calls: [] }));

vi.mock("firebase/app", () => ({ initializeApp: (config) => ({ config }) }));
vi.mock("firebase/firestore", () => ({
  initializeFirestore: () => ({ kind: "firestore" }),
  connectFirestoreEmulator: (_db, host, port) => sdk.calls.push(["firestore", host, port])
}));
vi.mock("firebase/database", () => ({
  getDatabase: () => ({ kind: "database" }),
  connectDatabaseEmulator: (_db, host, port) => sdk.calls.push(["database", host, port])
}));
vi.mock("firebase/auth", () => ({
  getAuth: () => ({ kind: "auth" }),
  GoogleAuthProvider: class {},
  connectAuthEmulator: (_auth, url) => sdk.calls.push(["auth", url])
}));

const emulatorEnv = parseEnv(readRepoFile(".env.emulator"));
const firebaseJson = JSON.parse(readRepoFile("firebase.json"));
const firebaseTestJson = JSON.parse(readRepoFile("firebase.test.json"));

const productionLikeEnv = {
  VITE_FIREBASE_API_KEY: "real-key",
  VITE_FIREBASE_PROJECT_ID: "clubpenguintabletop",
  VITE_FIREBASE_DATABASE_URL: "https://clubpenguintabletop-default-rtdb.firebaseio.com"
};

function stubEnv(vars) {
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
}

async function loadFirebaseModule() {
  vi.resetModules();
  return import("../../src/infra/firebase.js");
}

beforeEach(() => {
  sdk.calls.length = 0;
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("src/infra/firebase.js", () => {
  it("em desenvolvimento com .env.emulator conecta os três serviços aos emuladores", async () => {
    stubEnv({ ...emulatorEnv, DEV: true });
    await loadFirebaseModule();
    expect(sdk.calls).toEqual([
      ["auth", `http://127.0.0.1:${firebaseJson.emulators.auth.port}`],
      ["firestore", "127.0.0.1", firebaseJson.emulators.firestore.port],
      ["database", "127.0.0.1", firebaseJson.emulators.database.port]
    ]);
  });

  it("em desenvolvimento com a configuração de produção e sem a liberação explícita, recusa iniciar", async () => {
    stubEnv({ ...productionLikeEnv, DEV: true, VITE_ALLOW_PRODUCTION: "" });
    await expect(loadFirebaseModule()).rejects.toThrow(/Desenvolvimento recusado/);
    expect(sdk.calls).toEqual([]);
  });

  it("projeto que não é demo- é recusado mesmo com portas de emulador", async () => {
    stubEnv({ ...emulatorEnv, VITE_FIREBASE_PROJECT_ID: "clubpenguintabletop", DEV: true });
    await expect(loadFirebaseModule()).rejects.toThrow(/Desenvolvimento recusado/);
  });

  it("dev:prod (VITE_ALLOW_PRODUCTION=true) e o build de produção não conectam emuladores", async () => {
    stubEnv({ ...productionLikeEnv, DEV: true, VITE_ALLOW_PRODUCTION: "true" });
    await loadFirebaseModule();
    expect(sdk.calls).toEqual([]);

    vi.unstubAllEnvs();
    stubEnv({ ...productionLikeEnv, DEV: false, PROD: true });
    await loadFirebaseModule();
    expect(sdk.calls).toEqual([]);
  });
});

describe("configuração dos emuladores", () => {
  it(".env.emulator usa um projeto demo- e as portas do firebase.json", () => {
    expect(emulatorEnv.VITE_FIREBASE_PROJECT_ID).toMatch(/^demo-/);
    expect(emulatorEnv.VITE_FIREBASE_DATABASE_URL).toBe(
      `https://${emulatorEnv.VITE_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`
    );
    expect(Number(emulatorEnv.VITE_EMULATOR_AUTH_PORT)).toBe(firebaseJson.emulators.auth.port);
    expect(Number(emulatorEnv.VITE_EMULATOR_FIRESTORE_PORT)).toBe(firebaseJson.emulators.firestore.port);
    expect(Number(emulatorEnv.VITE_EMULATOR_DATABASE_PORT)).toBe(firebaseJson.emulators.database.port);
    expect(emulatorEnv.VITE_EMULATOR_HOST).toBe(firebaseJson.emulators.auth.host);
  });

  it("o projeto do npm run emulators é o mesmo do .env.emulator", () => {
    const pkg = JSON.parse(readRepoFile("package.json"));
    expect(pkg.scripts.emulators).toContain(`--project ${emulatorEnv.VITE_FIREBASE_PROJECT_ID}`);
    expect(pkg.scripts["test:rules"]).toContain("--config firebase.test.json --project demo-cpvtt-test");
  });

  it("os emuladores de teste não compartilham nenhuma porta com os de desenvolvimento", () => {
    const ports = (cfg) =>
      Object.values(cfg.emulators).flatMap((e) => (typeof e === "object" ? [e.port, e.websocketPort] : [])).filter(Boolean);
    const devPorts = new Set(ports(firebaseJson));
    expect(ports(firebaseTestJson).filter((p) => devPorts.has(p))).toEqual([]);
    expect(firebaseTestJson.firestore).toEqual(firebaseJson.firestore);
    expect(firebaseTestJson.database).toEqual(firebaseJson.database);
  });
});

describe("scripts/check-layers.mjs", () => {
  it("relata as violações conhecidas do código v1 sem falhar no modo relatório", () => {
    const script = path.resolve(import.meta.dirname, "..", "..", "scripts", "check-layers.mjs");
    const report = JSON.parse(execFileSync(process.execPath, [script, "--json"], { encoding: "utf8" }));
    const has = (rule, file, detail) =>
      report.violations.some((v) => v.rule === rule && v.file === file && v.detail.includes(detail));
    expect(has("pureza", "src/engines/diceEngine.js", "window")).toBe(true);
    expect(has("pureza", "src/engines/diceEngine.js", "Math.random")).toBe(true);
    expect(has("sdk-fora-de-services-infra", "src/hooks/useScenes.js", "firebase/firestore")).toBe(true);
    expect(has("sdk-fora-de-services-infra", "src/hooks/useScenes.js", "../infra/firebase.js")).toBe(true);
    expect(has("camadas", "src/components/chat/RollMessageCard.jsx", "components → services")).toBe(false);
    expect(has("fora-da-arquitetura", "src/utils/stringUtils.js", "utils/")).toBe(true);
    expect(report.violations.some((v) => v.file === "src/services/rollService.js" && v.rule !== "camadas")).toBe(false);
    expect(report.total).toBe(report.violations.length);
  });
});
