// Servidor de desenvolvimento contra a PRODUÇÃO (uso explícito e excepcional).
// Define VITE_ALLOW_PRODUCTION=true só neste processo; `npm run dev`/`dev:emu` nunca o definem.
// Executar: npm run dev:prod
import { createServer } from "vite";

process.env.VITE_ALLOW_PRODUCTION = "true";

console.warn(
  "\n[dev:prod] ATENÇÃO: este servidor lê e grava nos dados REAIS da produção. " +
    "Para desenvolver, use `npm run dev:emu`.\n"
);

const server = await createServer({ mode: "development" });
await server.listen();
server.printUrls();
server.bindCLIShortcuts({ print: true });
