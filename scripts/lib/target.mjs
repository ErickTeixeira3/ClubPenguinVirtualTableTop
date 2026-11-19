// Resolução do alvo dos scripts operacionais (emulador ou produção) e inicialização do Admin SDK.
// Travas (PLANO_REFATORACAO_2.md, Seções 2.2 e 7.1):
// - `--target` é obrigatório; não existe alvo padrão;
// - produção exige `--confirm-production` e recusa rodar com variáveis de emulador no ambiente;
// - emulador exige projeto `demo-` (o Firebase recusa acesso a recursos reais nesse projeto).
// Credenciais de produção: GOOGLE_APPLICATION_CREDENTIALS (chave fora do repositório) ou ADC.
import fs from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { getFirestore } from "firebase-admin/firestore";

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");
export const localDataDir = path.join(repoRoot, "local-data");

const EMULATOR_ENV_VARS = ["FIRESTORE_EMULATOR_HOST", "FIREBASE_DATABASE_EMULATOR_HOST", "FIREBASE_AUTH_EMULATOR_HOST"];

export const TARGET_OPTIONS = {
  target: { type: "string" },
  "confirm-production": { type: "boolean", default: false },
  config: { type: "string", default: "firebase.json" },
  project: { type: "string" }
};

function readEnvFile(name) {
  const file = path.join(repoRoot, name);
  if (!fs.existsSync(file)) throw new Error(`Arquivo ${name} não encontrado na raiz do projeto.`);
  return parseEnv(fs.readFileSync(file, "utf8"));
}

/**
 * @param {{ target?: string, "confirm-production"?: boolean, config?: string, project?: string }} values
 * Opções de linha de comando (ver TARGET_OPTIONS). `config`/`project` só valem para o emulador
 * (ex.: os testes usam firebase.test.json e demo-cpvtt-test).
 */
export function resolveTarget(values) {
  if (values.target === "emulator") {
    const config = JSON.parse(fs.readFileSync(path.resolve(repoRoot, values.config || "firebase.json"), "utf8"));
    const projectId = values.project || readEnvFile(".env.emulator").VITE_FIREBASE_PROJECT_ID;
    if (!projectId?.startsWith("demo-")) {
      throw new Error(`O emulador só é usado com projeto "demo-" (recebido: "${projectId}").`);
    }
    const { auth, firestore, database } = config.emulators || {};
    if (!auth || !firestore || !database) throw new Error(`${values.config} não tem o bloco "emulators" completo.`);
    const hosts = {
      FIRESTORE_EMULATOR_HOST: `${firestore.host}:${firestore.port}`,
      FIREBASE_DATABASE_EMULATOR_HOST: `${database.host}:${database.port}`,
      FIREBASE_AUTH_EMULATOR_HOST: `${auth.host}:${auth.port}`
    };
    return {
      kind: "emulator",
      projectId,
      databaseURL: `http://${hosts.FIREBASE_DATABASE_EMULATOR_HOST}?ns=${projectId}-default-rtdb`,
      emulatorHosts: hosts
    };
  }

  if (values.target === "production") {
    if (!values["confirm-production"]) {
      throw new Error("Alvo production exige também --confirm-production (e autorização do usuário).");
    }
    const leaked = EMULATOR_ENV_VARS.filter((name) => process.env[name]);
    if (leaked.length > 0) {
      throw new Error(`Alvo production recusado: variáveis de emulador definidas no ambiente (${leaked.join(", ")}).`);
    }
    if (values.config && values.config !== "firebase.json") {
      throw new Error("--config só é aceito com --target emulator.");
    }
    const prodEnv = readEnvFile(".env");
    if (!prodEnv.VITE_FIREBASE_PROJECT_ID || !prodEnv.VITE_FIREBASE_DATABASE_URL) {
      throw new Error(".env sem VITE_FIREBASE_PROJECT_ID ou VITE_FIREBASE_DATABASE_URL.");
    }
    if (values.project && values.project !== prodEnv.VITE_FIREBASE_PROJECT_ID) {
      throw new Error("--project diverge do projeto de produção do .env.");
    }
    return {
      kind: "production",
      projectId: prodEnv.VITE_FIREBASE_PROJECT_ID,
      databaseURL: prodEnv.VITE_FIREBASE_DATABASE_URL
    };
  }

  throw new Error('Informe --target emulator ou --target production (não há alvo padrão).');
}

/** Inicializa um app do Admin SDK isolado para o alvo resolvido. */
export function connectAdmin(target) {
  if (target.kind === "emulator") {
    for (const [name, value] of Object.entries(target.emulatorHosts)) process.env[name] = value;
    // Os emuladores não precisam de credencial. Sem isto, o Admin SDK procura o servidor de metadados
    // do Google Cloud (atraso de ~10 s e aviso no terminal, offline).
    process.env.METADATA_SERVER_DETECTION = "none";
  }
  const app = initializeApp(
    {
      projectId: target.projectId,
      databaseURL: target.databaseURL,
      ...(target.kind === "production" ? { credential: applicationDefault() } : {})
    },
    `cpvtt-${target.kind}-${Date.now()}`
  );
  return {
    app,
    firestore: getFirestore(app),
    database: getDatabase(app),
    auth: getAuth(app)
  };
}

export function describeTarget(target) {
  return target.kind === "emulator" ? `emulador (${target.projectId})` : `PRODUÇÃO (${target.projectId})`;
}
