import { defineConfig } from "vitest/config";

// Suítes que precisam dos emuladores de teste: Security Rules (Firestore + RTDB) e scripts operacionais.
// Executadas por `npm run test:rules`, que sobe os emuladores de firebase.test.json
// (projeto demo-cpvtt-test, portas próprias) via `firebase emulators:exec`. Rodam em série:
// cada arquivo limpa ou semeia o mesmo emulador.
export default defineConfig({
  envDir: "tests",
  test: {
    include: ["tests/rules/**/*.test.js", "tests/emulator/**/*.test.js"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 45000,
    hookTimeout: 30000
  }
});
