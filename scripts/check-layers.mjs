// Verificador de camadas e de pureza (PLANO_REFATORACAO_2.md, Seções 4.1.1, 4.1.2 e 5.1).
//
// Modo relatório (padrão, Fases 0–12): imprime as violações e sai com código 0.
// Modo estrito (`--strict`, a partir da Fase 13): sai com código 1 se houver violação.
// `--json` imprime o relatório em JSON (para registrar contagens).
//
// Regras:
// 1. Dependências entre camadas (Seção 5.1). Arquivos na raiz de `src/` (main.jsx, App.jsx) são a
//    camada de composição `app` e podem importar tudo.
// 2. SDKs (`firebase/*`, `firebase-admin`) só em `services/` e `infra/` (Seção 4.1.1).
// 3. Pureza de `domain/` e `engines/`: sem React, Firebase, `window`, `document`, `localStorage`,
//    `sessionStorage`, `indexedDB`, `Date.now` nem `Math.random` (Seção 4.1.2).
// 4. Arquivos em diretórios fora da arquitetura-alvo (ex.: `utils/`, `constants/`).
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const srcRoot = path.join(repoRoot, "src");
const SOURCE_EXT = /\.(jsx?|mjs)$/;

const KNOWN_LAYERS = ["app", "infra", "domain", "engines", "services", "hooks", "contexts", "components"];

// Camadas que cada camada pode importar (além dela mesma). `components/ui` é parte de `components`.
const ALLOWED_DEPENDENCIES = {
  app: KNOWN_LAYERS,
  components: ["components", "hooks", "contexts", "domain", "engines"],
  hooks: ["hooks", "contexts", "services", "domain", "engines"],
  contexts: ["contexts", "hooks", "services", "domain", "engines"],
  services: ["services", "infra", "domain", "engines"],
  engines: ["engines", "domain"],
  domain: ["domain"],
  infra: ["infra", "domain"]
};

const SDK_ALLOWED_LAYERS = new Set(["services", "infra"]);
const PURE_LAYERS = new Set(["domain", "engines"]);
const isSdkImport = (spec) => spec === "firebase" || spec.startsWith("firebase/") || spec.startsWith("firebase-admin");
const isReactImport = (spec) => spec === "react" || spec.startsWith("react/") || spec.startsWith("react-dom");

const IMPURE_GLOBALS = [
  ["window", /\bwindow\b/],
  ["document", /\bdocument\b/],
  ["localStorage", /\blocalStorage\b/],
  ["sessionStorage", /\bsessionStorage\b/],
  ["indexedDB", /\bindexedDB\b/],
  ["Date.now", /\bDate\s*\.\s*now\b/],
  ["Math.random", /\bMath\s*\.\s*random\b/]
];

function listSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return SOURCE_EXT.test(entry.name) ? [full] : [];
  });
}

// Todos os arquivos de infraestrutura já residem em `src/infra/` desde a Fase 2.
const INFRA_FILES_OUTSIDE_INFRA = new Set();

function layerOf(absPath) {
  if (INFRA_FILES_OUTSIDE_INFRA.has(absPath)) return "infra";
  const rel = path.relative(srcRoot, absPath).split(path.sep);
  if (rel.length === 1) return "app";
  return rel[0];
}

function resolveSourceFile(target) {
  for (const candidate of [target, `${target}.js`, `${target}.jsx`, path.join(target, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return target;
}

/** Remove comentários e literais (string, template) preservando quebras de linha e posições. */
function stripCommentsAndStrings(code) {
  let out = "";
  let i = 0;
  const templateDepth = [];
  const blank = (text) => text.replace(/[^\n]/g, " ");
  while (i < code.length) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "/" && next === "/") {
      const end = code.indexOf("\n", i);
      const stop = end === -1 ? code.length : end;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = code.indexOf("*/", i + 2);
      const stop = end === -1 ? code.length : end + 2;
      out += blank(code.slice(i, stop));
      i = stop;
    } else if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < code.length && code[j] !== ch && code[j] !== "\n") j += code[j] === "\\" ? 2 : 1;
      out += ch + blank(code.slice(i + 1, j)) + ch;
      i = j + 1;
    } else if (ch === "`" || (ch === "}" && templateDepth.at(-1) === 0)) {
      if (ch === "}") templateDepth.pop();
      let j = i + 1;
      while (j < code.length && code[j] !== "`" && !(code[j] === "$" && code[j + 1] === "{")) {
        j += code[j] === "\\" ? 2 : 1;
      }
      out += ch + blank(code.slice(i + 1, j));
      if (code[j] === "$") {
        out += "${";
        templateDepth.push(0);
        i = j + 2;
      } else {
        out += "`";
        i = j + 1;
      }
    } else {
      if (templateDepth.length > 0) {
        if (ch === "{") templateDepth[templateDepth.length - 1] += 1;
        else if (ch === "}") templateDepth[templateDepth.length - 1] -= 1;
      }
      out += ch;
      i += 1;
    }
  }
  return out;
}

function stripComments(code) {
  return code.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/(^|[^:\\])\/\/.*$/gm, "$1");
}

function extractImports(code) {
  const withoutComments = stripComments(code);
  const specs = [];
  const patterns = [
    /\bimport\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:\*|\{[\s\S]*?\})\s+from\s+["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g
  ];
  for (const re of patterns) {
    for (const match of withoutComments.matchAll(re)) {
      const line = withoutComments.slice(0, match.index).split("\n").length;
      specs.push({ spec: match[1], line });
    }
  }
  return specs;
}

function resolveImportLayer(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  const target = resolveSourceFile(path.resolve(path.dirname(fromFile), spec));
  if (!target.startsWith(srcRoot)) return null;
  return { layer: layerOf(target), target };
}

const violations = [];
const report = (rule, file, line, detail) =>
  violations.push({ rule, file: path.relative(repoRoot, file).split(path.sep).join("/"), line, detail });

const files = listSourceFiles(srcRoot);
for (const file of files) {
  const layer = layerOf(file);
  const code = fs.readFileSync(file, "utf8");

  if (!KNOWN_LAYERS.includes(layer)) {
    report("fora-da-arquitetura", file, 1, `diretório "${layer}/" não existe na arquitetura-alvo`);
  }

  for (const { spec, line } of extractImports(code)) {
    if (isSdkImport(spec) && !SDK_ALLOWED_LAYERS.has(layer)) {
      report("sdk-fora-de-services-infra", file, line, `importa "${spec}"`);
    }
    if (PURE_LAYERS.has(layer) && (isSdkImport(spec) || isReactImport(spec))) {
      report("pureza", file, line, `importa "${spec}"`);
    }
    const resolved = resolveImportLayer(file, spec);
    if (!resolved) continue;
    if (PURE_LAYERS.has(layer) && resolved.layer === "infra") {
      report("pureza", file, line, `importa infra ("${spec}")`);
      continue;
    }
    if (resolved.layer === "infra" && !SDK_ALLOWED_LAYERS.has(layer) && layer !== "app") {
      // Contado só aqui (e não também como violação de camada) para não duplicar a mesma importação.
      report("sdk-fora-de-services-infra", file, line, `importa o adaptador do SDK "${spec}"`);
      continue;
    }
    const allowed = ALLOWED_DEPENDENCIES[layer];
    if (!allowed) continue;
    if (!KNOWN_LAYERS.includes(resolved.layer)) {
      report("camadas", file, line, `${layer} → ${resolved.layer} (fora da arquitetura): "${spec}"`);
    } else if (!allowed.includes(resolved.layer)) {
      report("camadas", file, line, `${layer} → ${resolved.layer}: "${spec}"`);
    }
  }

  if (PURE_LAYERS.has(layer)) {
    const lines = stripCommentsAndStrings(code).split("\n");
    lines.forEach((text, idx) => {
      for (const [name, re] of IMPURE_GLOBALS) {
        if (re.test(text)) report("pureza", file, idx + 1, `usa ${name}`);
      }
    });
  }
}

const RULE_TITLES = {
  camadas: "Dependências entre camadas (Seção 5.1)",
  "sdk-fora-de-services-infra": "SDK fora de services/ e infra/ (Seção 4.1.1)",
  pureza: "Pureza de domain/ e engines/ (Seção 4.1.2)",
  "fora-da-arquitetura": "Arquivos fora da arquitetura-alvo (Seção 5.3)"
};

const strict = process.argv.includes("--strict");
const counts = Object.fromEntries(Object.keys(RULE_TITLES).map((rule) => [rule, 0]));
for (const v of violations) counts[v.rule] += 1;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ filesScanned: files.length, total: violations.length, counts, violations }, null, 2));
} else {
  console.log(`Camadas e pureza — ${files.length} arquivos em src/ (${strict ? "modo estrito" : "modo relatório"})`);
  for (const [rule, title] of Object.entries(RULE_TITLES)) {
    const list = violations.filter((v) => v.rule === rule);
    console.log(`\n${title}: ${list.length}`);
    for (const v of list) console.log(`  ${v.file}:${v.line}  ${v.detail}`);
  }
  console.log(`\nTotal: ${violations.length} violações.`);
}

if (strict && violations.length > 0) process.exitCode = 1;
