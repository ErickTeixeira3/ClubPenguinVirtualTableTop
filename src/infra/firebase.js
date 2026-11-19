import { initializeApp } from "firebase/app";
import { connectFirestoreEmulator, initializeFirestore } from "firebase/firestore";
import { connectDatabaseEmulator, getDatabase } from "firebase/database";
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from "firebase/auth";

export const DEFAULT_CAMPAIGN_ID = "main-table";

const env = import.meta.env;

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
};

/**
 * Refatoração 2, Fase 0 (PROC-04): em desenvolvimento o app usa os Emuladores por padrão
 * (`npm run dev:emu`, configuração em `.env.emulator`). Desenvolver contra a produção exige
 * `VITE_ALLOW_PRODUCTION=true`, definido apenas pelo script explícito `npm run dev:prod`.
 * O build de produção (`import.meta.env.DEV === false`) não é afetado.
 */
const useEmulators = env.DEV && env.VITE_ALLOW_PRODUCTION !== "true";

function readEmulatorTarget() {
  const host = env.VITE_EMULATOR_HOST;
  const ports = {
    auth: Number(env.VITE_EMULATOR_AUTH_PORT),
    firestore: Number(env.VITE_EMULATOR_FIRESTORE_PORT),
    database: Number(env.VITE_EMULATOR_DATABASE_PORT)
  };
  const isDemoProject = String(firebaseConfig.projectId || "").startsWith("demo-");
  const hasPorts = Object.values(ports).every((p) => Number.isInteger(p) && p > 0);
  if (!host || !hasPorts || !isDemoProject) {
    throw new Error(
      "Desenvolvimento recusado: sem a configuração dos emuladores (projeto demo- e portas). " +
        "Use `npm run dev:emu` (emuladores) ou, para usar a produção de forma explícita, `npm run dev:prod`."
    );
  }
  return { host, ports };
}

const emulatorTarget = useEmulators ? readEmulatorTarget() : null;

const app = initializeApp(firebaseConfig);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

if (emulatorTarget) {
  const { host, ports } = emulatorTarget;
  connectAuthEmulator(auth, `http://${host}:${ports.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, ports.firestore);
  connectDatabaseEmulator(rtdb, host, ports.database);
}
