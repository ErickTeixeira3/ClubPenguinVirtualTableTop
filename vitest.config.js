import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Suítes unitárias, de caracterização e de regressão (sem emulador): `npm run test`.
// As suítes que precisam de emulador (tests/rules, tests/emulator) ficam em vitest.rules.config.js
// (`npm run test:rules`).
export default defineConfig({
  plugins: [react()],
  // Nenhum arquivo .env é carregado nos testes: o .env da raiz tem a configuração de PRODUÇÃO.
  // A pasta `tests/` não contém arquivos .env.
  envDir: "tests",
  test: {
    include: ["tests/**/*.test.{js,jsx}"],
    exclude: ["tests/rules/**", "tests/emulator/**", "**/node_modules/**"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      reporter: ["text-summary", "html"],
      reportsDirectory: "coverage"
    }
  }
});
