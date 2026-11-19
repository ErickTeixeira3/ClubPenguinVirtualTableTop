# Club Penguin VTT

Mesa virtual (VTT) em React + Vite sobre Firebase (plano Spark): Firestore para dados persistentes, Realtime Database para o tabuleiro e Firebase Auth.

> Em refatoração: o plano está em `PLANO_REFATORACAO_2.md` e o andamento, em `REGISTRO_REFATORACAO.md`. Este README é reescrito por completo na Fase 15.

## Requisitos

- Node.js 24.12 ou mais novo (`@firebase/rules-unit-testing` declara `>=24.12`).
- Java 21 ou mais novo (emuladores do Firestore e do Realtime Database).
- `npm install` instala tudo o que é preciso, inclusive a Firebase CLI (`firebase-tools`) usada pelos scripts.

## Desenvolvimento local (emuladores)

O app em desenvolvimento usa os **Emuladores do Firebase por padrão**. A configuração fica em `.env.emulator`, que é versionado e não tem segredos: projeto `demo-cpvtt` e chaves fictícias. O Firebase recusa qualquer acesso a recursos reais num projeto `demo-`.

Em dois terminais:

```bash
npm run emulators   # Auth :9099, Firestore :8085, Realtime Database :9000, interface em http://127.0.0.1:4000
npm run dev:emu     # app em http://localhost:5173 (`npm run dev` é o mesmo comando)
```

Os emuladores começam vazios. Para trabalhar com uma cópia dos dados:

```bash
npm run seed:emu                          # carrega o snapshot mais recente de local-data/snapshots/
npm run seed:emu -- --snapshot <pasta>    # ou um snapshot específico
```

O seed substitui todo o estado do emulador e mantém os mesmos UIDs.
- Contas de e-mail e senha entram com a senha local `pinguim123` (troque com `--password`).
- Contas Google aparecem na tela de login simulada do emulador.

### Contra a produção (excepcional)

```bash
npm run dev:prod
```

Só esse script libera a produção (`VITE_ALLOW_PRODUCTION=true`) e usa o `.env`, que não é versionado. Fora dele, o app em desenvolvimento **recusa iniciar** com uma configuração que não seja de emulador. O build de produção (`npm run build`) não é afetado.

## Testes e verificação

| Comando | O que faz |
|---|---|
| `npm run test` | Testes unitários, de caracterização e de regressão (Vitest, sem emulador). |
| `npm run test:coverage` | O mesmo, com cobertura (relatório em `coverage/`). |
| `npm run test:rules` | Security Rules (Firestore e RTDB) e scripts operacionais. Sobe emuladores próprios (`firebase.test.json`, projeto `demo-cpvtt-test`, portas 19099/18085/19000), separados dos de desenvolvimento. |
| `npm run lint` | `oxlint`. |
| `npm run lint:layers` | Regras de camadas e de pureza (`scripts/check-layers.mjs`). Em modo relatório até a Fase 13; `--strict` falha se houver violação. |
| `npm run check` | lint + camadas + test + test:rules + build. |

Organização de `tests/`:
- `characterization/`: comportamento atual que a refatoração preserva;
- `regression/`: verificações portadas de `auditoria_refatoracao/`;
- `tooling/`: ambiente de desenvolvimento e scripts;
- `rules/` e `emulator/`: suítes que exigem emulador;
- `support/`: utilitários compartilhados.

## Dados: snapshot, migrações e auditoria

Todos os scripts exigem `--target emulator` ou `--target production`; não há alvo padrão.
- **Produção** exige também `--confirm-production`, autorização explícita do usuário e uma credencial do Admin SDK: `GOOGLE_APPLICATION_CREDENTIALS` apontando para uma chave **fora do repositório**, ou ADC (`gcloud auth application-default login`).
- Os scripts recusam a produção se houver variáveis de emulador no ambiente.

| Comando | O que faz |
|---|---|
| `npm run export:prod -- --target production --confirm-production` | Snapshot **somente leitura** (Firestore, RTDB e usuários do Auth) em `local-data/snapshots/`. Com `--target emulator`, salva o estado do emulador. |
| `npm run seed:emu` | Carrega um snapshot no emulador (ver acima). |
| `npm run migrate -- --target emulator [--apply] [--only <id>]` | Migrações de `scripts/migrations/registry.mjs`. Por padrão só simula; aborta antes de passar de 15 mil escritas no dia; registra logs em `local-data/migration-logs/`. |
| `npm run audit:schema -- --snapshot <pasta>` (ou `--target …`) | Auditoria do schema v2. Código 0 = sem violações; 1 = com violações; 2 = inconclusiva (nenhum validador registrado). |

`local-data/` está no `.gitignore`: os snapshots têm dados pessoais.

## Deploy

Todo comando da Firebase CLI contra o projeto real exige `--account <conta>`. `firebase.json` agora referencia `firestore.indexes.json`, então um `firebase deploy` completo também publica os índices. Prefira deploys com `--only`.
