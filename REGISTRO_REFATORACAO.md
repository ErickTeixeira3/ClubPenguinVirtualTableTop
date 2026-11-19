# Registro de Refatoração e Arquitetura — ClubPenguinVTT

Este documento registra formalmente, fase por fase, **todas as decisões arquiteturais e de negócio, alterações de estrutura de arquivos, contratos de funções, modelos de dados, padrões visuais (CSS) e regras de segurança** executados durante a refatoração do **ClubPenguinVTT**.

> [!IMPORTANT]
> **Escopo deste Registro Atual: Fases 0, 1, 2 e 3 (Concluídas e Documentadas Integralmente)**
> Este arquivo documenta integralmente a **Fase 0** (Auditoria Pré-Refatoração, Consolidação das Regras de Negócio e Reescrita do [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md)), a **Fase 1** (Saneamento de Dados, Segurança de Auth, Multi-Campanha `campaignId`, Soft Delete, Migração para `folders` e Remoção de Hacks de Runtime), a **Fase 2** (Desacoplamento RTDB, Remoção da Borracha Parcial, Autoria Estrita, Sync Bidirecional Ficha↔Token e Security Rules Locais) e a **Fase 3** (Limpeza de `engines/`, Criação de `services/` de Domínio, Sync Multi-Janela via `BroadcastChannel`, Atalhos Dinâmicos e Base Estrutural do Modo de Turno).
> Ao final do arquivo estão também a **Validação Pós-Fase 3**, a **Fase 3.1** (correção dos defeitos V-01 a V-22 e das decisões D-2/D-3), a **Fase 4** (Design System) e a **Fase 5** (decomposição dos God Components, `StandaloneSheetView`, `BoardTokensContext`, `useFolders` e debounce), todas executadas em 2026-11-13.

### Índice Geral de Fases

| Fase | Escopo | Status neste Registro |
| :--- | :--- | :--- |
| **Fase 0** | Auditoria técnica completa + Consolidação de 11 decisões de negócio/arquitetura + Reescrita integral de [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md) | **Documentada integralmente abaixo** |
| **Fase 1** | Saneamento de dados, Multi-Campanha (`campaignId`), Soft Delete (`isDeleted`), prompt de pastas, Auth e avatares em `media` | **Documentada integralmente abaixo** |
| **Fase 2** | Desacoplamento RTDB (`drawings`/`pings`), remoção da borracha, autoria estrita, sync Ficha↔Token e Security Rules | **Documentada integralmente abaixo** |
| **Fase 3** | Limpeza de `engines/`, criação de `services/` de domínio, `BroadcastChannel`, atalhos dinâmicos e base do Modo de Turno | **Documentada integralmente abaixo** |
| **Validação Pós-Fase 3** | Auditoria linha a linha do código contra este registro (Fases 1–3), errata, bugs identificados e plano de correção (Fase 3.1) | **Documentada ao final deste arquivo** |
| **Fase 3.1** | Correção dos defeitos V-01 a V-22, decisões D-2/D-3 no código e nas rules, errata de código e documentação (Diretrizes) | **Documentada ao final deste arquivo (após a Validação)** |
| **Fase 4** | Design System (`src/components/ui/`), variáveis `--z-*` e atualização de CSS subordinada aos estilos inline | **Documentada ao final deste arquivo (após a Fase 3.1)** |
| **Fase 5** | Decomposição dos *God Components* (SRP), `StandaloneSheetView` e otimização de performance (Debounce 400ms) | **Documentada ao final deste arquivo (após a Fase 4)** |
| **Auditoria de Regressões + Fase 6** | Perdas funcionais em relação ao commit `711451e` (auditoria cruzada Claude × Codex) e plano de correção das perdas não planejadas (6.0–6.8) | **Documentadas ao final deste arquivo (após a Fase 5), concluída (6.0–6.8; A1–A33 + decisões A22 e A4)** |

---

# FASE 0 — Auditoria Técnica, Consolidação de Decisões e Atualização das Diretrizes

## 1. Resumo Executivo da Fase 0

- **O que foi executado na Fase 0**:
  1. Auditoria completa pré-Fase 0 de **37 arquivos** do repositório (~25.500 linhas de código) confrontando o sistema real com o `DIRETRIZES_ARQUITETURA.md` original (MVP de 656 linhas).
  2. Rodadas de alinhamento e confirmação explícita de regras de negócio com o usuário (combate, Ficha vs. Token, autoria, borracha, atalhos, Falsa Exclusão, Kanban vs. Explorer/Teia, Modo de Turno, Multi-Campanha `campaignId` e prioridade visual do CSS inline).
  3. Produção do relatório de auditoria [avaliacao_arquitetura_codigo.md](file:///C:/Users/erick/.gemini/antigravity/brain/b9975ef9-b274-4d88-975d-5c78cceb2c38/avaliacao_arquitetura_codigo.md) (376 linhas).
  4. **Reescrita integral** de [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md), expandindo-o de **656 linhas (estado MVP desatualizado)** para **912 linhas (arquitetura consolidada e plano de refatoração)**.
- **Arquivos modificados/criados no workspace na Fase 0**:
  - Modificado (reescrito integralmente): [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md) (linhas 1–912).
  - Artefato de apoio (fora do workspace do código): [avaliacao_arquitetura_codigo.md](file:///C:/Users/erick/.gemini/antigravity/brain/b9975ef9-b274-4d88-975d-5c78cceb2c38/avaliacao_arquitetura_codigo.md) (linhas 1–376).
  - **Nenhum arquivo em `src/`, `firestore.rules` ou `database.rules.json` foi alterado na Fase 0** — o escopo da Fase 0 foi exclusivamente documental, normativo e estrutural.

---

## 2. Diagnóstico de Origem (O que motivou a Fase 0)

Durante a inspeção que precedeu a Fase 0, foram catalogados os seguintes desvios estruturais e dívidas técnicas no código original:

1. **Concentração em *God Components* (~60% do sistema em 7 arquivos)**:
   - `CharacterSheetModal.jsx` (4.073 linhas, 38 `useState`), `BoardViewport.jsx` (3.791 linhas, 23 props), `NoteEditorModal.jsx` (1.588 linhas), `VTTLayout.jsx` (1.545 linhas), `ChatSidebarPanel.jsx` (1.537 linhas), `JournalWorkspace.jsx` (1.426 linhas), `LoginScreen.jsx` (1.360 linhas), `App.css` (1.355 linhas), `CharactersSidebarList.jsx` (1.206 linhas) e `ScenesManagerModal.jsx` (813 linhas).
2. **Camadas arquiteturais ausentes ou contaminadas**:
   - Pasta planejada `src/components/ui/` inexistente; apenas `firebase.js` e `mediaService.js` existiam em `src/services/`; hooks acumulavam acesso direto ao Firebase + regras de negócio + migrações em runtime; `combatEngine.js` acessava `localStorage` diretamente (contaminando `src/engines/`).
3. **Falhas críticas de dados e segurança**:
   - Função `canSeeResource` declarada em `firestore.rules` mas nunca invocada (leitura aberta via `allow read: if isSignedIn();`); tautologia `isGM(campaignId) || isSignedIn()` em `campaigns`; RTDB totalmente aberto (`.write: "auth != null"`).
   - Pastas polimórficas (`isFolder: true`) salvas dentro de `characters` e `notes` usando modelos incompatíveis (ID em fichas vs. caminho com `/` em notas) enquanto a subcoleção `folders` permanecia vazia.
   - Ausência do campo `campaignId` nos payloads JSON, URLs de pop-out (`?sheetId=...`) e chaves de cache `IndexedDB`.
   - `VTTLayout.jsx` montando listeners duplicados e retornando antes dos modais de combate em modo `?sheetId=...` (impedindo `DamageRollModal` e `SavingThrowModal` de aparecerem na janela destacada).
   - Senha em `localStorage` via `btoa(password)`; avatares Base64 injetados diretamente em `campaign.players`, `presence` e `auth.currentUser.photoURL` (causando falha em `registerWithEmail` quando havia foto).
   - Exclusão de entidades sem limpeza de órfãos e sem política de Soft Delete.
   - Tempestade de escritas (`updateDoc` a cada tecla digitada em `CharacterSheetModal.jsx`).
4. **Lista de "Puxadinhas" (Ajustes Ad-Hoc identificados)**:
   - `drawings` e `pings` escondidos dentro de `vtt_realtime/{campaignId}/fog/{sceneId}` fazendo `useFogOfWar` baixar tudo a cada risco ou ping.
   - Lógica hardcoded do "Peixe Fluffy" replicada em 6 lugares (inclusive dentro do `onSnapshot` de `useCharacters.js`).
   - Mutação filho → pai via `boardSyncRef` (`onTokensSync`), comunicação entre janelas via `localStorage` e 4 variáveis paralelas de alvo (`targetedToken`, `targetedTokens`, `targetedTokenRef`, `targetedTokensRef`).
   - Detecção de ataque via Regex de palavras em português no título em vez de `rollKind`.
   - Código morto da Borracha Parcial (`erasePortionAt` e `sliceStrokeByEraser`) sem botão na UI.
5. **Violações de DRY e SOLID**:
   - Consumo de custos/consumíveis duplicado (`handleExecuteDamageRoll` vs `handleExecuteSavingThrow`), resolução de identidade repetida 7 vezes, normalização NFD em 4 arquivos, `getNoteTypeIcon` duplicado em 2 arquivos, `SavingThrowFields` repetido 4 vezes, balão de emote duplicado, `BASE_URL` repetido em 3 arquivos; mais de 100 `else if` em `CpFlashIcons.jsx` e condicionais monolíticas de cards no chat.

---

## 3. Todas as Decisões Consolidadas e Como Foram Registradas na Fase 0

Cada decisão abaixo foi confirmada explicitamente antes da atualização do [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md) e convertida em regra normativa na Fase 0:

| # | Decisão Aprovada | Regra Estabelecida na Fase 0 | Onde foi registrada no `DIRETRIZES_ARQUITETURA.md` |
| :-: | :--- | :--- | :--- |
| **1** | **Plano Firebase Spark (Custo Zero / Client-Driven)** | Toda lógica de RPG, dados, combate, compressão WebP, fragmentação `chunks` (>700KB) e remoção de fundo por *Flood-Fill* roda no navegador do cliente, protegida por Security Rules. Proibido depender de Cloud Functions ou Firebase Storage pagos. | Seção 1 (#1) e Seção 4 (#1–3) |
| **2** | **Arquitetura Híbrida + Isolamento no RTDB** | **Firestore** para dados persistentes e filtráveis por permissão; **RTDB** para baixa latência/alta frequência em **5 nós irmãos separados**: `tokens`, `fog`, `drawings`, `pings` e `presence`. Retira `drawings` e `pings` de dentro de `fog/` para eliminar re-renders e tráfego cruzado em `useFogOfWar`. | Seção 1 (#2) e Seção 3.2 |
| **3** | **Preparação Nativa Multi-Campanha (`campaignId` Universal)** | Todos os documentos Firestore e nós RTDB devem incluir `"campaignId"` explicitamente no **próprio payload JSON** (mesmo operando na `"main-table"`). Parâmetros de URL (`?campaignId=...&sheetId=...`), canais `BroadcastChannel` e chaves `IndexedDB` (`${campaignId}:${mediaId}`) devem escopar por campanha. | Seção 1 (#3) e todos os JSON Schemas da Seção 3 |
| **4** | **Política de "Falsa Exclusão" (Soft Delete vs. Hard Delete)** | **Firestore** (`characters`, `folders`, `notes`, `scenes`, `compendium`, `messages`): exclusões na UI **nunca** usam `deleteDoc`; gravam `isDeleted: true`, `deletedAt: serverTimestamp()`, `deletedBy: uid` e **preservam `media/{mediaId}`** para restauração direta no banco (sem tela de lixeira na UI). **Pastas**: antes de ocultar, modal pergunta se **(a) oculta os itens internos** ou **(b) move os itens internos para a raiz**. **RTDB** (`tokens`, `drawings`): exclusão permanente (`remove()`). | Seção 1 (#4) e Schemas da Seção 3.1 |
| **5** | **Isolamento Estrito de Autoria** | Jogadores autenticados só podem criar, mover, editar e excluir seus próprios desenhos (`authorId === auth.uid`), seus próprios tokens e suas próprias fichas (`ownerId === auth.uid` ou `editableBy`). O Mestre (`gmId` / `GM_EMAIL`) possui permissão global. | Seção 1 (#5) e Seção 8 |
| **6** | **Sincronização Ficha ↔ Token (Player vs. Mestre)** | **Fichas de Players (`ownerId !== gmId`)**: Ficha e Token são tratados como a mesma entidade (sincronização bidirecional automática de `hp`, `mp`, `defense`, `name`, `cardColor`, avatar). **Fichas do Mestre (`ownerId === gmId` ou `type === "npc"`)**: Ficha funciona como matriz/template; cada token instanciado no mapa mantém vida (`hpCurrent`/`hpMax`) e recursos 100% individuais sem alterar a ficha-matriz. | Seção 1 (#6) e Seção 5.2 (#4) |
| **7** | **Remoção Definitiva da Borracha Parcial** | A função órfã `erasePortionAt` e helpers geométricos (`sliceStrokeByEraser`, flush timers de borracha) devem ser removidos definitivamente do código em vez de serem expostos na interface. | Seção 9 (#2) *(decisão registrada no plano diretor e em `avaliacao_arquitetura_codigo.md` Seção 9.1 #3)* |
| **8** | **Atalhos Dinâmicos (`rollGroups` e `hotbar`)** | Itens fixados em `rollGroups` e nos 9 slots de `hotbar` armazenam vínculo referencial (`sourceType`: `"ability"`, `"skill"` ou `"item"` + `sourceId`), buscando fórmula, custo, alcance, AoE e CD atualizados na fonte original da ficha em tempo real. | Seção 3.1.C (nota de vínculo dinâmico) e Seção 9 (#3) |
| **9** | **Fim da Visão Kanban no Diário** | A Visão Kanban (`kanbanStatus` e sintaxe legada de link por pipe `[[noteId ...]]`) foi oficialmente descontinuada na documentação e substituída por **Menu Explorer em Árvore (Categorias → Pastas/Subpastas com Drag & Drop) + Editor em Blocos (`sections`) + Aliases Interativos com `ignoredAliases` + Visão de Teia (`JournalGraphWebView`)**. | Seção 3.1.G e Seção 6 |
| **10** | **Especificação do Futuro "Modo de Turno" (`combatState`)** | Mantido e expandido na arquitetura o objeto `campaign.combatState` para futura implementação de ordem de iniciativa (`turnOrder`), controle de rodada (`round`), travamento de movimento e ações fora do turno, desconto de deslocamento em metros no grid e orçamento de ações/reações por turno. | Seção 3.1.A e Seção 5.3 |
| **11** | **CSS Inline como Fonte da Verdade Visual + UI Limpa + Git/Deploy** | Os estilos inline atuais (`style={{ ... }}`) definem a aparência oficial do sistema e têm prioridade absoluta sobre definições antigas de `index.css` e `App.css`. Proibido incluir textos explicativos em subtítulos/botões (regras ficam no código). Proibido `git commit` ou `firebase deploy` sem autorização explícita. | Seção 1 (#7, #8, #9) e Seção 7 |

---

## 4. Evolução Estrutural do `DIRETRIZES_ARQUITETURA.md` (Antes → Depois)

| Aspecto / Seção | Versão Antiga (`HEAD` — 656 linhas) | Nova Versão Fase 0 (912 linhas) | O que mudou na prática |
| :--- | :--- | :--- | :--- |
| **Seção 1 (Princípios)** | 4 princípios básicos (Spark, Híbrido, UI limpa, Git/Deploy). | **9 princípios inegociáveis** (L7–L33). | Adicionou `campaignId` universal, Soft Delete vs. Hard Delete + prompt de pasta, isolamento de autoria, regra Player vs. GM em Ficha↔Token e prioridade dos estilos inline. |
| **Seção 2 (Pastas `src/`)** | 23 arquivos MVP; citava `useCharacterSheet.js`; faltavam `layout/`, `combat/`, `scenes/`, `constants/`, `combatEngine.js`, `useBoardInteractive.js`, `useScenes.js`, `useCompendium.js`, `useMediaUrl.js`. | **Arquitetura modular completa em camadas com 51 módulos mapeados** (L40–L133). | Incorporou todos os módulos reais novos e planejou a decomposição completa de God Components, `services/`, `utils/`, hooks desacoplados e `components/ui/`. |
| **Seção 3 (Schemas JSON)** | Schemas parciais MVP (`attributes`/`skills` como objeto, `notes` com Kanban, `folders` ausente, `media` sem chunks, RTDB com apenas 3 nós e sem `campaignId`). | **8 coleções Firestore + 5 nós RTDB completos** (L137–L648). | Adicionou `campaignId`, `visibleTo`, `isDeleted`/`deletedAt`/`deletedBy`, coleção dedicada `folders`, vídeos/áudio em `scenes`, arrays e combate/AoE/hotbar em `characters`, chunks em `media`, e separou `drawings` e `pings` no RTDB. |
| **Seção 4 (Mídia)** | Presets básicos `WebP`, limpeza física por `deleteMedia`, chave simples `IndexedDB`. | **Pipeline WebP + Chunks + Flood-Fill + Cache escopado por campanha** (L652–L662). | Documentou remoção automática de fundo de tokens por *Flood-Fill* offscreen, proibição de Base64 fora de `media/` e cache `${campaignId}:${mediaId}`. |
| **Seção 5 (Motor/Combate)** | Apenas sintaxe básica de fórmulas/dados (`formulaEngine` + `diceEngine`) e fluxo simples de clique. | **Sistema de Combate Tático, Tabuleiro Interativo e Modo de Turno** (L666–L703). | Documentou multi-alvo + `BroadcastChannel`, Hotbar 9 slots + projéteis de bola de neve, Régua/AoE (`1 célula = 1,5m`, círculo e cone `45°`/`60°`), fluxo de 3 etapas (Acerto → Dano diferido/Gatilhos/Assistências → Save CD), aplicação GM e futura mecânica de `combatState`. |
| **Seção 6 (Diários)** | 5 tipos, `cloneNoteToTarget`, `aliasesNormalized`, sintaxe legada de link por pipe `[[noteId ...]]` e **Visão Kanban**. | **Explorer em Árvore, Editor em Blocos e Visão de Teia** (L706–L717). | Removeu Kanban e sintaxe `[[...]]`; documentou árvore recursiva, blocos `sections`, `ignoredAliases`, portal popover `LinkedCardSpan`, compartilhamento granular e filtro de vizinhança no grafo EPF. |
| **Seção 7 (Design System/CSS)** | Referências visuais antigas, paleta `:root` antiga, tipografia e anatomia genérica de botões/janelas. | **Padrões Visuais por Módulo extraídos dos Inlines + Escala `z-index`** (L721–L753). | Substituiu o CSS teórico pela descrição fiel dos inlines reais (`LoginScreen`, `CharacterSheetModal`, `CharactersSidebarList`, `JournalWorkspace` + `JournalGraphWebView`) e definiu **10 tokens semânticos `--z-*`**. |
| **Seção 8 (Segurança)** | Rascunho antigo de `firestore.rules` (sem `folders`, `media/chunks`, Soft Delete ou `campaign.players`) + RTDB resumido (tokens ocultos, movimento, fog). | **Rules completas Firestore + RTDB alinhadas ao `visibleTo` e autoria** (L757–L886). | Explicitou regra do `array-contains-any` nas queries, incluiu `folders`, `chunks`, `isDeleted` / delete restrito ao GM, autoria em `drawings` e `pings`. *(Ver Seção 9 deste registro para pontos que precisam de ajuste fino na Fase 2).* |
| **Seção 9 (Roadmap)** | Roadmap original de construção inicial do VTT (Fases 1 a 6). | **Plano Diretor de Refatoração e Evolução em 5 Fases** (L890–L912). | Substituiu o roadmap de criação pelo roadmap de refatoração segura (*bottom-up*, sem quebra de listeners no Firestore). |

---

## 5. Estrutura Completa de Arquivos e Funções Documentada na Fase 0 (`src/`)

A Fase 0 formalizou a arquitetura em 4 camadas unidirecionais: **Views/UI (`components/`) → Hooks/Contexts (`hooks/`, `contexts/`) → Services de Domínio (`services/`) → Engines Puros (`engines/`) / Infra Firebase (`services/firebase.js`)**.

### 5.1. Constantes, Contextos e Utilitários Base
- `src/assets/` — Fontes locais e recursos estáticos de build.
- `src/constants/authorizedUsers.js` — Whitelist inicial de e-mails autorizados, constante/papel do Mestre (`GM_EMAIL`) e helpers de verificação de autorização.
- `src/contexts/AuthContext.jsx` — Autenticação Firebase (Google Popup + E-mail/Senha), perfil do usuário autenticado e validação contra a whitelist.
- `src/contexts/CampaignContext.jsx` — Estado da campanha ativa (`campaignId`), cena ativa (`activeSceneId`), mapa `players`, resolução `isRealGM`/`isGM` e presença no RTDB.
- `src/contexts/BoardTokensContext.jsx` *(planejado na arquitetura-alvo para Fase 5)* — Provedor compartilhado de tokens da cena ativa e alvos selecionados para eliminar mutação filho→pai via `ref` (`boardSyncRef`).
- `src/utils/stringUtils.js` *(planejado na arquitetura-alvo para Fase 3)* — Normalização NFD sem acentos, sanitização de chaves para o Firestore e helpers de formatação.

### 5.2. Camada `src/engines/` (Motores 100% Puros)
Regra estabelecida na Fase 0: **proibida qualquer dependência de React, Firebase SDK ou `localStorage` dentro de `engines/`**.
- `src/engines/aliasEngine.js` — Normalização de texto, parser anti-spoiler de aliases restrito aos cards visíveis ao usuário (respeitando `ignoredAliases`) e construção de nós/arestas da Teia.
- `src/engines/combatEngine.js` — Constantes táticas (`SKILL_RANGE_TYPES`, `SKILL_AOE_TYPES`, `EFFECT_TYPES`), avaliação de acerto vs. Defesa, resolução de fórmula de CD, geometria de alcance/AoE (círculo e cone `45°`/`60°`) e regras puras de turno *(na Fase 3 terá os acessos a `localStorage` removidos)*.
- `src/engines/diceEngine.js` — RNG criptográfico via `window.crypto` e parser de dados (`NdX`, `NdXkhY`, `NdXklY`).
- `src/engines/formulaEngine.js` — Resolução de variáveis `@forca`, `@pericia`, etc. contra a ficha e avaliador aritmético seguro (`+`, `-`, `*`, `/`, `floor()`, `ceil()`).
- `src/engines/imageCompressor.js` — Compressão e redimensionamento adaptativo client-side para WebP via Canvas respeitando proporção e tetos de tamanho.

### 5.3. Camada `src/services/` (Orquestração e Persistência)
- `src/services/firebase.js` — Inicialização do Firebase Auth, Cloud Firestore (`db`), Realtime Database (`rtdb`) e `DEFAULT_CAMPAIGN_ID = "main-table"`.
- `src/services/mediaService.js` — Persistência em `campaigns/{campaignId}/media/{mediaId}` com fragmentação automática em `chunks/{chunkIndex}` para mídias `> 700 KB` e cache persistente local em `IndexedDB` escopado por `${campaignId}:${mediaId}`.
- `src/services/migrationService.js` *(novo na arquitetura)* — Rotina idempotente executada pelo Mestre para saneamento/backfill de dados legados (`campaignId`, `isDeleted`, `visibleTo`, pastas em `folders/{folderId}`, ícone `"fluffy_fish"`).
- `src/services/combatService.js` *(planejado para Fase 3)* — Dedução unificada de custos/itens consumíveis (`consumeCombatCosts`), sincronização Ficha↔Token (PC vs. NPC), seletores de turno e aplicação de dano/cura.
- `src/services/rollService.js` *(planejado para Fase 3)* — Orquestração de rolagens (ataque, dano diferido, teste de resistência, ping) e resolução centralizada de identidade do remetente (`resolveSpeakerIdentity`).
- `src/services/journalService.js` *(planejado para Fase 3)* — Clonagem (`cloneNoteToTarget`), compartilhamento granular, operações em árvore de pastas e exclusão lógica (*Soft Delete*).

### 5.4. Camada `src/hooks/` (Adaptadores Reativos)
- **Existentes mapeados e redefinidos na Fase 0**:
  - `useCharacters.js` — Assinatura de fichas filtradas por visibilidade/`isDeleted` e CRUD (previsto receber *debounce* na Fase 5 e validação de autoria na Fase 2).
  - `useJournalNotes.js` — Leitura/escrita reativa de cards do Diário com filtro anti-spoiler e pastas.
  - `useCompendium.js` — Catálogo global de habilidades, perícias e itens do Mestre.
  - `useChatRolls.js` — Histórico de mensagens/rolagens do chat e disparo de ações.
  - `useScenes.js` — Gerenciamento de cenas, mapas em imagem/vídeo e áudio ambiente.
  - `useMediaUrl.js` — Resolução reativa de `mediaId` (`IndexedDB` → Firestore + `chunks`) ou URL externa.
  - `useRealtimeTokens.js` — Sincronização em tempo real de tokens da cena ativa via RTDB.
  - `useFogOfWar.js` — Sincronização **exclusiva** da máscara de Névoa de Guerra no RTDB (desacoplada de desenhos e pings).
  - `useBoardInteractive.js` — Sincronização de desenhos vetoriais (`drawings`) e pings (`pings`) em nós dedicados do RTDB (sem o código morto da borracha).
- **Novos hooks especificados na arquitetura-alvo (para Fases 3–5)**:
  - `useFolders.js` — Gerenciamento unificado de pastas e subpastas (`characters` e `notes`) usando a subcoleção `folders/{folderId}`.
  - `useCrossWindowSync.js` — Sincronização entre janela principal e janela destacada (`?campaignId=&sheetId=`) via `BroadcastChannel` (substituindo `localStorage`).
  - `useBoardCamera.js` — Controle de Pan, Zoom e conversão de coordenadas tela ↔ mundo (extraído de `BoardViewport.jsx`).
  - `useSnowballProjectiles.js` — Animação física de projéteis de bola de neve entre atacante e alvo(s).
  - `useDebouncedCallback.js` — Debounce de 400ms e *flush* imediato em `onBlur` para inputs da ficha e notas.

### 5.5. Camada `src/components/` (Views e Decomposição Alvo por Domínio)
- **`auth/`**: `LoginScreen.jsx` (Modo Login com Post-it inclinado + Modo Criar Pinguim em 2 colunas + Recuperação de Senha).
- **`layout/`**: `VTTLayout.jsx` (shell principal), `QuickActionsHotbar.jsx` (9 slots `1–9` com resolução dinâmica), `EmotePickerMenu.jsx`, `PlayerProfileModal.jsx` (avatar salvo via `mediaService`), além de `StandaloneSheetView.jsx` *(planejado para Fase 5: entrypoint leve para `?campaignId=&sheetId=` incluindo `DamageRollModal` e `SavingThrowModal`)*.
- **`canvas/`**: `BoardViewport.jsx`, `FogOfWarCanvas.jsx`, `TokenSprite.jsx` (Flood-Fill anti-aliasing + anel + barras HP/MP), `TokenSpeechBubble.jsx`, `TokenModal.jsx`; mais subcomponentes planejados para Fase 5: `BoardDrawingsLayer.jsx`, `BoardMeasurementLayer.jsx`, `BoardLeftToolbar.jsx` e `TokenQuickHpPopup.jsx`.
- **`combat/`**: `DamageRollModal.jsx` (gatilhos `on_hit`/`on_crit`, itens, assistências de aliados, multiplicador crítico) e `SavingThrowModal.jsx` (teste de resistência automático com reações `on_save`/`reaction`).
- **`chat/`**: `ChatSidebarPanel.jsx`; mais subcomponentes Strategy planejados para Fase 5: `RollMessageCard.jsx`, `SkillPingCard.jsx` e `EmoteMessageCard.jsx`.
- **`sheets/`**: `CharacterSheetModal.jsx`, `CharactersSidebarList.jsx`, `CpFlashIcons.jsx` (catálogo declarativo WebP + `CpIconPicker`); mais decomposição em `PlayerCardLeftPanel.jsx` e `tabs/` (`SheetInventoryTab.jsx`, `SheetAttributesTab.jsx`, `SheetSkillsTab.jsx`, `SheetNotesTab.jsx`, `SheetRollsTab.jsx`).
- **`journal/`**: `JournalWorkspace.jsx` (Explorer em árvore + filtros de escopo), `JournalGraphWebView.jsx` (Visor EPF interativo com isolamento de vizinhança), `NoteEditorModal.jsx` (blocos `sections` + aliases interativos + compartilhamento/clonagem).
- **`compendium/`**: `CompendiumModal.jsx`.
- **`scenes/`**: `ScenesManagerModal.jsx` (mapas imagem/vídeo, áudio ambiente, grid, névoa).
- **`gm/`**: `GMPanelModal.jsx`.
- **`ui/` *(planejado para Fase 4)* **: `WindowModal.jsx`, `CPButton.jsx`, `CpSpeechBubble.jsx`, `SavingThrowFields.jsx`, `ConfirmDeleteModal.jsx`.

---

## 6. Estrutura de Dados Completa Especificada na Fase 0

### 6.1. Regras Transversais de Modelagem (Firestore)
Toda entidade persistente no Cloud Firestore sob `campaigns/{campaignId}/...` passou a exigir 3 campos padrão:
1. `"campaignId": string` — identificador explícito da campanha dentro do documento (preparação para `collectionGroup`, exportação e multi-campanha).
2. `"visibleTo": string[]` — lista normalizada usada pelas queries `array-contains-any` e pela função `canSeeResource`: contém `["ALL"]` para público ou `[gmUid, ownerId, ...sharedUids]` para restrito.
3. `"isDeleted": boolean` (+ `"deletedAt": Timestamp | null`, `"deletedBy": string | null`) — suporte ao *Soft Delete*.

### 6.2. Coleções do Cloud Firestore

#### A. `campaigns/{campaignId}`
Define permissões da mesa, lista branca, perfis de jogadores, cena ativa e estado do **Modo de Turno**.
- **Campos**: `id`, `campaignId`, `name`, `gmId`, `gmEmail`, `authorizedEmails: string[]`, `authorizedUsers: { [emailSanitizado]: { email, role, defaultDisplayName, uid } }`, `players: { [uid]: { uid, displayName, email, role, avatarMediaId, photoURL, activeCharacterId, lastSeen } }`, `activeSceneId`, `combatState`, `updatedAt`.
- **Estrutura de `combatState`** *(para o futuro Modo de Turno)*:
  - `active: boolean`, `round: number`, `activeTurnIndex: number`, `lockMovementOutsideTurn: boolean`, `lockActionsOutsideTurn: boolean`
  - `turnOrder: Array<{ combatantId, tokenId, characterId, ownerId, name, initiative, movementBudgetMeters, movementUsedMeters, actionsMax, actionsRemaining, reactionsMax, reactionsRemaining }>`

#### B. `campaigns/{campaignId}/scenes/{sceneId}`
- **Campos**: `id`, `campaignId`, `name`, `visibleToPlayers: boolean`, `visibleTo: string[]`, `mapImage: { mediaId, externalUrl, mimeType, widthPx, heightPx }`, `ambientAudio: { mediaId, externalUrl, name, volume, loop, isPlaying }`, `grid: { enabled, snapToGrid, cellSizePx, color, opacity }`, `fogOfWar: { enabled, defaultOpaque, color }`, `isDeleted`, `deletedAt`, `deletedBy`, `createdAt`, `updatedAt`.
- **Evolução documentada**: suporte a mapas em vídeo (`video/mp4`, `video/webm`), trilha sonora/áudio ambiente por cena (`ambientAudio`) e cor da névoa (`fogOfWar.color`).

#### C. `campaigns/{campaignId}/characters/{characterId}`
- **Campos gerais**: `id`, `campaignId`, `name`, `type` (`"pc" | "npc"`), `ownerId`, `folderId`, `visibleTo`, `editableBy`, `cardColor`, `level`, `xp`, `coins`, `defense`, `avatarMediaId`, `avatarExternalUrl`, `defaultToken: { mediaId, externalUrl, sizeInCells, showName }`, `biography`, `notes`, `isDeleted`, `deletedAt`, `deletedBy`, `createdAt`, `updatedAt`.
- **`resources`**: `{ hp: { label, current, max, color }, mp: { label, current, max, color } }`.
- **`attributes`** *(alterado de Objeto para Array na documentação)*: `Array<{ key, label, value }>`.
- **`skills`** *(alterado de Objeto para Array na documentação)*: `Array<{ id, name, attribute, bonus, formula }>`.
- **`abilities`**: `Array<{ id, name, elementColor, icon, cost: { resource, amount }, hitFormula, effectFormula, trigger, effectType, range: { type, distanceMeters }, aoe: { type, radiusMeters, coneAngleDeg }, savingThrow: { enabled, dcFormula, attribute, effectDescription }, description }>`.
- **`inventory`**: `Array<{ id, name, qty, icon, elementColor, rollFormula, trigger, effectType, consumeOnUse, savingThrow, description }>`.
- **`rollGroups`**: `Array<{ id, name, rolls: Array<{ id, sourceType, sourceId, name, color, icon, hitFormula, effectFormula, effectType, savingThrow, costResource, costAmount }> }>`.
- **`hotbar`**: Array fixo de 9 posições (`{ rollId, sourceType, sourceId, name, icon, color } | null`).

#### D. `campaigns/{campaignId}/folders/{folderId}` *(Nova subcoleção formalizada)*
- **Objetivo**: Eliminar o polimorfismo (`isFolder: true`) dentro de `characters` e `notes`, unificando árvores de Fichas e Diários.
- **Campos**: `id`, `campaignId`, `domain` (`"characters" | "notes"`), `name`, `parentId`, `path`, `noteType`, `scope`, `ownerId`, `visibleTo`, `editableBy`, `isDeleted`, `deletedAt`, `deletedBy`, `createdAt`, `updatedAt`.

#### E. `campaigns/{campaignId}/compendium/{entryId}`
- **Campos**: `id`, `campaignId`, `type` (`"ability" | "spell" | "skill" | "item"`), `name`, `category`, `icon`, `elementColor`, `visibleToPlayers`, `visibleTo`, `cost: { resource, amount }`, `hitFormula`, `effectFormula`, `trigger`, `effectType`, `savingThrow: { enabled, dcFormula, attribute, effectDescription }`, `description`, `isDeleted`, `deletedAt`, `deletedBy`, `updatedAt`.

#### F. `campaigns/{campaignId}/messages/{messageId}`
- **Campos**: `id`, `campaignId`, `senderId`, `senderName`, `senderAvatarMediaId`, `senderAvatarUrl`, `characterId`, `type` (`"text" | "emote" | "skill_ping" | "roll" | "saving_throw_request"`), `visibility` (`"public" | "gm_only" | "self"`), `visibleTo`, `content`, `rollData`, `isDeleted`, `createdAt`.
- **Estrutura de `rollData`**: `title`, `rollKind` (`"attack" | "damage" | "heal" | "saving_throw" | "check"`), `categoryColor`, `icon`, `costPaid`, `deferSecondaryDamage`, `damageRolled`, `secondaryFormula`, `secondaryLabel`, `effectType`, `savingThrow` (`enabled`, `dcFormula`, `dcResolved`, `attribute`, `effectDescription`), `targets[]` (`tokenId`, `characterId`, `name`, `defense`, `ownerId`), `hitEvaluation` (`attackTotal`, `isCrit`, `isFumble`, `anyHit`, `allHit`, `results[]`), `rolls[]`, `appliedTargets`.

#### G. `campaigns/{campaignId}/notes/{noteId}`
- **Campos**: `id`, `campaignId`, `scope` (`"gm" | "player" | "party"`), `ownerId`, `visibleTo`, `editableBy`, `clonedFromNoteId`, `noteType` (`"character" | "lore" | "location" | "event" | "quest"`), `folder`, `folderId`, `linkedCharacterSheetId`, `title`, `aliases: string[]`, `ignoredAliases: string[]`, `imageMediaId`, `sections: Array<{ id, title, content }>`, `content`, `relatedNoteIds: string[]`, `graphPosition: { x, y }`, `isDeleted`, `deletedAt`, `deletedBy`, `createdAt`, `updatedAt`.
- **Mudança chave**: removidos `kanbanStatus` e sintaxe `[[noteId|Texto]]`; adicionados blocos `sections`, `ignoredAliases`, `folder`/`folderId` e `graphPosition`.

#### H. `campaigns/{campaignId}/media/{mediaId}` e Subcoleção `chunks/{chunkIndex}`
- **Campos**: `id`, `campaignId`, `category` (`"scene" | "token" | "avatar"`), `mimeType`, `widthPx`, `heightPx`, `sizeBytes`, `isChunked: boolean`, `chunkCount: number`, `dataUrl`, `uploadedBy`, `createdAt`.
- **Regra de fragmentação**: arquivos até `700 KB` ficam inteiros em `dataUrl`; arquivos maiores (vídeos MP4/WebM, áudios MP3/OGG, GIFs/mapas pesados) são fatiados em documentos de `700 KB` na subcoleção `chunks/{chunkIndex}`.

### 6.3. Estrutura no Firebase Realtime Database (`vtt_realtime/{campaignId}`)
Separada em **5 nós irmãos independentes** na raiz da campanha para impedir que gravações em desenhos ou pings disparem listeners de fog ou tokens:
1. **`tokens/{sceneId}/{tokenId}`**: `id`, `campaignId`, `sceneId`, `characterId`, `ownerId`, `isGmToken`, `name`, `mediaId`, `externalUrl`, `x`, `y`, `size`, `hpCurrent`, `hpMax`, `mpCurrent`, `mpMax`, `defense`, `ringColor`, `showName`, `visibleToPlayers`, `updatedAt`.
2. **`fog/{sceneId}`**: `campaignId`, `strokes` *(no código real existente: `enabled` e `areas`)*, `updatedAt` — **sem `drawings` e sem `pings` aninhados**.
3. **`drawings/{sceneId}/{drawingId}`** *(novo nó irmão dedicado)*: `id`, `campaignId`, `sceneId`, `type` (`"stroke" | "rect" | "circle" | "text"`), `authorId`, `authorName`, `color`, `size`, `rotation`, `points`, `createdAt`.
4. **`pings/{sceneId}/{pingId}`** *(novo nó irmão dedicado)*: `id`, `campaignId`, `x`, `y`, `color`, `authorId`, `authorName`, `createdAt`.
5. **`presence/{uid}`**: `uid`, `campaignId`, `online`, `displayName`, `avatarMediaId`, `role`, `lastSeen`.

---

## 7. Pipeline de Mídia, Combate, Diários e Design System (CSS) Documentados

1. **Compressão WebP e Sprites (`DIRETRIZES_ARQUITETURA.md` Seção 4)**:
   - **Mapas (`scene`)**: máx. `2560px`, qualidade inicial `0.82` adaptativa até caber em `700 KB`.
   - **Tokens (`token`)**: máx. `384x384px`, WebP com canal alfa (`<= 120 KB`), mais **remoção automática de fundo sólido por Flood-Fill** a partir das 4 bordas em Canvas offscreen com suavização *anti-aliasing* e cache em memória (`TokenSprite.jsx`).
   - **Avatares (`avatar`)**: máx. `512x512px`, WebP (`<= 200 KB`), obrigatoriamente salvos em `media/{mediaId}` (proibido gravar Base64 em `campaigns`, `presence` ou `auth.currentUser.photoURL`).
   - **Cache local**: `IndexedDB` usando chave escopada `${campaignId}:${mediaId}`.

2. **Regras de Combate e Futuro Modo de Turno (`DIRETRIZES_ARQUITETURA.md` Seção 5)**:
   - Escala oficial do tabuleiro: **1 célula = 1,5m**.
   - Seleção multi-alvo sincronizada com `?campaignId=&sheetId=` via `BroadcastChannel`.
   - Hotbar de 9 slots (teclas `1–9`) com animação de projétil de bola de neve até o(s) alvo(s).
   - Fluxo de combate em 3 etapas (`attack` c/ `deferSecondaryDamage: true` e `hitEvaluation` → `DamageRollModal` deduzindo MP/HP/itens consumíveis de atacante e aliados → `SavingThrowModal` automático ao alvo com reações `on_save`/`reaction`).
   - Controle de Modo de Turno (`combatState.active === true`): trava arraste e ações fora do turno, converte distância percorrida em metros para abater de `movementBudgetMeters`, e abate ações (`actionsRemaining`) ou reações (`reactionsRemaining`).

3. **Design System e Hierarquia CSS (`DIRETRIZES_ARQUITETURA.md` Seção 7)**:
   - **Regra absoluta**: Estilos inline (`style={{ ... }}`) atuais prevalecem sobre definições antigas de `index.css` e `App.css`.
   - **4 Padrões Visuais formalizados a partir dos inlines**:
     - `LoginScreen.jsx`: fundo radial `#004b94` → `#001f44`, card azul `#0589de` → `#005098` (`border-radius: 28px`), bordas `#000c24`, Post-it `rotate(-6deg)` `#fff275` → `#f0cd17`; tela de cadastro em 2 colunas (`max-width: 920px`, `#0072cb`), moldura circular `230x230px` e balão `"Seu Pinguim necessita de um nome!"`.
     - `CharacterSheetModal.jsx`: Player Card esquerdo com gradiente dinâmico `character.cardColor`, notch triplo superior, badge `"⭐ NÍVEL X"`, moldura quadrada de avatar, rodapé de Moedas (`coin.webp`) e XP (`stamp_book.png`) + 10 cores; gaveta direita clara com barra contextual e dock inferior cápsula (`cp-inv-bottom-dock`).
     - `CharactersSidebarList.jsx`: fundo `#ffffff`, botões `"+ Personagem"` e `"+ Pasta"`, seção raiz do Mestre + seções recolhíveis por jogador, subpastas indentadas com `border-left: 2px solid #e2e8f0` e indicador online verde/laranja.
     - `JournalWorkspace.jsx` + `JournalGraphWebView.jsx`: sidebar escura `width: 290px` (`linear-gradient(180deg, #0b1d33 0%, #071322 100%)`) + Visor EPF `#07131e` com grade radial ciano, arestas `#00f0ff` (vínculos diretos) e `#ffcc00` tracejado (aliases).
   - **Escala Oficial de Camadas (`:root` `z-index`)**:
     - `--z-board-canvas: 1`
     - `--z-workspace-journal: 12`
     - `--z-board-ui: 20`
     - `--z-hud-bars: 40`
     - `--z-hud-popovers: 120`
     - `--z-modal-base: 1000`
     - `--z-modal-nested: 1250`
     - `--z-modal-combat: 3500`
     - `--z-modal-note-editor: 5000`
     - `--z-portal-tooltip: 9000`

---

## 8. Modelo de Security Rules Documentado na Fase 0 (`DIRETRIZES_ARQUITETURA.md` Seção 8)

- **Regra de Alinhamento Query ↔ Rule**: No Firestore, `where("visibleTo", "array-contains-any", ["ALL", currentUser.uid])` para usuários não-GM, evitando falhas `Missing or insufficient permissions` quando `canSeeResource` estiver ativa.
- **`firestore.rules` especificadas na Seção 8.1**:
  - `isGM(campaignId)`: autenticado e (`email == 'erick.silva1006@gmail.com'` ou `gmId == request.auth.uid`).
  - `canSeeResource(campaignId, resourceData)`: GM ou `visibleToPlayers == true` ou `ownerId == uid` ou `senderId == uid` ou `'ALL' in visibleTo` ou `uid in visibleTo`.
  - Leitura protegida via `canSeeResource` em `scenes`, `characters`, `folders`, `compendium`, `messages` e `notes` (com `|| scope == 'party'`).
  - `allow delete`: restrito a `isGM(campaignId)` em `characters`, `folders`, `messages`, `notes` (exclusões na UI usam Soft Delete via `update` com `isDeleted: true`).
  - Adição de regra explícita para `media/{mediaId}/chunks/{chunkId}`.
- **`database.rules.json` especificadas na Seção 8.2**:
  - `tokens/$sceneId/$tokenId`: leitura para autenticados; escrita apenas para Mestre ou dono do token.
  - `fog/$sceneId`: leitura para autenticados; escrita exclusiva do Mestre.
  - `drawings/$sceneId/$drawingId`: leitura para autenticados; criação com `newData.child('authorId').val() == auth.uid`; edição/exclusão apenas ao autor (`data.child('authorId').val() == auth.uid`) ou Mestre.
  - `pings/$sceneId/$pingId`: leitura e escrita para autenticados.
  - `presence/$uid`: leitura para autenticados; escrita apenas quando `$uid === auth.uid`.

---

## 9. Observações e Ressalvas Técnicas Deixadas pela Fase 0 (Pontos de Atenção)

Ao confrontar o texto produzido na Fase 0 ([DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md)) com o código pré-existente, permanecem **4 pontos de atenção nominais** registrados aqui para não causar divergência nas Fases 1–5:

1. **Nome do banco `IndexedDB`**: a auditoria e o código usavam `"cpvtt_media_cache"`, enquanto a Seção 4 (#2) de [DIRETRIZES_ARQUITETURA.md](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/DIRETRIZES_ARQUITETURA.md#L659) citou `"clubpenguin_vtt_cache"`. Manter `"cpvtt_media_cache"` evita invalidar cache já salvo nos navegadores dos jogadores.
2. **Nomenclatura de campos em Schemas ilustrativos vs. runtime**:
   - Em `folders`: a Seção 3.1.D ilustrou `domain: "notes"`, enquanto o runtime pode usar `folderType` (`"character" | "journal"`).
   - Em `rtdb/tokens`: a Seção 3.2 ilustrou `size`, enquanto o runtime usa `sizeInCells`, `controlledBy` e `layer`.
   - Em `rtdb/fog`: a Seção 3.2 ilustrou `strokes: [...]`, enquanto o runtime usa `enabled` e `areas: { areaId: ... }`.
   - Em `scenes.grid`: a Seção 3.1.B omitiu `offsetX`/`offsetY` presentes no runtime; em `notes`: Seção 3.1.G ilustrou `graphPosition` onde o código usava `graphNode`.
3. **Refinamentos necessários nas `firestore.rules` da Seção 8.1 antes de ativar em produção**:
   - O rascunho da Seção 8.1 deixou `allow create, delete: if isSignedIn()` em `campaigns/{campaignId}`, `allow update: if isSignedIn()` em `messages/{messageId}`, e `affectedKeys().hasOnly(['players', 'updatedAt'])` sem validar a chave exata `request.auth.uid` dentro de `players` — esses pontos devem ser endurecidos na execução da Fase 2.
4. **Ordem de Dependência Crítica Estabelecida para as Próximas Fases**:
   - **Fase 1 antes da Fase 2**: normalizar documentos legados (`campaignId`, `isDeleted: false`, `visibleTo`, pastas em `folders`) **antes** de ativar `where("visibleTo", "array-contains-any", ...)` e `canSeeResource` nas rules, prevenindo falhas de permissão no Firestore.
   - **Fases 3 e 4 antes da Fase 5**: construir `services/` e `components/ui/` (*bottom-up*) antes de fatiar `CharacterSheetModal.jsx` e `BoardViewport.jsx`, evitando reescrever subcomponentes duas vezes.


---

# FASE 1 — Saneamento de Dados, Segurança de Auth, Multi-Campanha (`campaignId`), Soft Delete e Migração Idempotente

## 1. Resumo Executivo da Fase 1

- **Objetivo da Fase 1**: Executar a base segura de saneamento de dados e segurança antes de restringir queries e Security Rules na Fase 2, cobrindo:
  1. Infraestrutura multi-campanha (`campaignId` dinâmico + carimbo universal em Firestore, RTDB, URLs pop-out e `IndexedDB`).
  2. Remoção de senha em Base64 do `localStorage` e proteção de `updateProfile` do Firebase Auth contra Base64.
  3. Pipeline de avatares de usuário armazenados em `campaigns/{campaignId}/media/{mediaId}` (`avatarMediaId`), eliminando Base64 de `campaigns/{campaignId}` e de `presence/{uid}`.
  4. Criação do serviço idempotente `migrationService.js` (normalização de `campaignId`, `isDeleted`, `visibleTo`, migração de pastas legadas para `campaigns/{campaignId}/folders` e correção definitiva do ícone `"fluffy_fish"` no banco).
  5. Eliminação das *"puxadinhas"* hardcoded do *"Peixe Fluffy"* em tempo de execução.
  6. Política de **Falsa Exclusão (Soft Delete)** no Firestore (`isDeleted: true`, `deletedAt`, `deletedBy`) + modal de decisão ao excluir pastas de Personagens e Diários.
- **Volume de alterações realizadas na Fase 1**: **20 arquivos no workspace** (**1 arquivo criado** + **19 arquivos modificados**).
- **Nenhum arquivo em `firestore.rules` ou `database.rules.json` foi alterado na Fase 1** (preparação intencional pré-Fase 2).

### Mapa Completo de Arquivos Criados e Modificados na Fase 1

| Camada | Arquivo | Ação | O que foi implementado na Fase 1 |
| :--- | :--- | :---: | :--- |
| **`services/`** | [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js) | **Criado** | Rotina idempotente `runCampaignMigrations({ campaignId, gmUid })` + helper `isLegacyFishItem`. *(Obs.: na Fase 1 usava `setDoc`/`updateDoc` sequenciais; a conversão para `writeBatch` ocorreu depois na Fase 2).* |
| **`services/`** | [mediaService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/mediaService.js) | **Modificado** | Chave composta `${campaignId}:${mediaId}` no cache (`memoryCache` + `IndexedDB`), nova função `uploadDataUrlMedia`, `campaignId` + `isDeleted: false` no upload e `deleteMedia` convertido para Soft Delete. |
| **`contexts/`** | [AuthContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/AuthContext.jsx) | **Modificado** | Proteção em `registerWithEmail` para não enviar DataURL Base64 ao `updateProfile` do Firebase Auth e estacionar a foto pendente em `sessionStorage` (`cp_pending_avatar_dataurl`). |
| **`contexts/`** | [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx) | **Modificado** | Resolução dinâmica de `campaignId` (`?campaignId=` e `localStorage`), `switchCampaign`, migração/upload de avatares para `media/{mediaId}`, cache reativo `resolvedAvatars`, `activeTurnIndex: 0` em `combatState`, `campaignId` no RTDB `presence`, e disparo automático de `runCampaignMigrations` para o Mestre. |
| **`hooks/`** | [useMediaUrl.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useMediaUrl.js) | **Modificado** | Alinhamento do estado interno `resolvedState.key` e das chamadas `getCachedMediaSync(mediaId, campaignId)` à chave escopada `${campaignId}:${mediaId}`. |
| **`hooks/`** | [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js) | **Modificado** | Listener paralelo na subcoleção `folders`, remoção do hack *"Peixe Fluffy"* do `onSnapshot`, `campaignId` + `isDeleted: false`, `deleteCharacter` e `deleteFolder(folderId, { deleteContents })` com Soft Delete, preservação de mídias em `media/`. |
| **`hooks/`** | [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js) | **Modificado** | Listener paralelo na subcoleção `folders`, suporte a `visibleTo` em `accessibleFolders`, `campaignId` + `isDeleted: false` em `createNote`/`updateNote`/`cloneNoteToTarget`, `deleteNote` e `deleteFolder(..., { deleteContents })` com Soft Delete, preservação de `imageMediaId`. |
| **`hooks/`** | [useScenes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useScenes.js) | **Modificado** | Filtro `!s.isDeleted`, `campaignId`, `isDeleted: false`, geração/atualização de `visibleTo` nas cenas (`createScene`, `updateScene`, `activateSceneForTable`), Soft Delete em `deleteScene` e preservação das mídias antigas de mapa. |
| **`hooks/`** | [useCompendium.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCompendium.js) | **Modificado** | Filtro `!e.isDeleted`, `campaignId`, `isDeleted: false`, geração/sincronização de `visibleTo` com `visibleToPlayers` e Soft Delete em `deleteEntry`. |
| **`hooks/`** | [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js) | **Modificado** | Filtro `!m.isDeleted`, inclusão de `campaignId` e `isDeleted: false` em todos os tipos de mensagem (`emote`, `text`, `skill_ping`, `ability_roll`/rolagens) e conversão de `deleteMessage` para Soft Delete. |
| **`hooks/`** | [useRealtimeTokens.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useRealtimeTokens.js) | **Modificado** | Inclusão explícita de `campaignId` e `sceneId` nos payloads gravados no RTDB em `addToken` e `updateToken`. |
| **`hooks/`** | [useFogOfWar.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useFogOfWar.js) | **Modificado** | Inclusão explícita de `campaignId` e `sceneId` em `toggleFogEnabled`, `addFogArea` e `resetFogCoverAll`. |
| **`hooks/`** | [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js) | **Modificado** | Inclusão explícita de `campaignId` e `sceneId` em `triggerPing`, `addStroke`, `addShape` e `addTextItem`, além de `authorId: user.uid` junto a `createdBy` nos 3 tipos de desenho. |
| **`components/auth/`** | [LoginScreen.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/auth/LoginScreen.jsx) | **Modificado** | Remoção completa de `rememberPassword`, da leitura/escrita Base64 em `cp_remember_pwd` e do checkbox *"Lembrar da minha senha"*, mantendo limpeza preventiva da chave legada. |
| **`components/layout/`** | [PlayerProfileModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/PlayerProfileModal.jsx) | **Modificado** | Resolução do avatar via `useMediaUrl(myPlayerProfile?.avatarMediaId, ..., campaignId)` e estado explícito `photoRemoved` para limpar `avatarMediaId` ao clicar em *"Remover"*. |
| **`components/layout/`** | [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx) | **Modificado** | Na Fase 1: adição de `campaignId` e `sceneId: targetSceneId` no `rtdbSet` de `handleSpawnCharacterToken`. *(A trava `isGmTemplate` no mesmo arquivo pertence à Fase 2).* |
| **`components/sheets/`** | [CpFlashIcons.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CpFlashIcons.jsx) | **Modificado** | Remoção dos condicionais hardcoded para *"peixe"/"fluffy"* dentro de `renderCpFlashIcon` e remoção das chaves duplicadas no final de `LEGACY_ALIASES`. |
| **`components/sheets/`** | [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx) | **Modificado** | Remoção dos 4 hacks *"Peixe Fluffy"* em runtime (`resolveItemIcon`, `handlePullFromCompendium`, `handleAddItem`, `onChange`) e inclusão de `campaignId` na URL do pop-out (`?campaignId=...&sheetId=...`). |
| **`components/sheets/`** | [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx) | **Modificado** | Inclusão de `campaignId` na URL do pop-out (`CharacterRow`) e criação do modal de confirmação de exclusão de pastas (`folderToDelete` + `handleRequestDeleteFolder`). |
| **`components/journal/`** | [JournalWorkspace.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/JournalWorkspace.jsx) | **Modificado** | Criação do modal de confirmação de exclusão de pastas do Diário (`folderToDelete` + `handleRequestDeleteFolder`), permitindo mover cards para a raiz ou aplicar Soft Delete em cascata. |

> [!NOTE]
> O arquivo [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx) possui diff não comitado no repositório relativo ao deslocamento de `measureStats`/`tokensInsideMeasure`, mas **não foi alterado durante a Fase 1** (essa diferença já existia antes do início da Fase 0).

---

## 2. Decisões e Diretrizes Executadas na Fase 1

| # | Frente de Trabalho | Decisão Aplicada na Implementação da Fase 1 |
| :-: | :--- | :--- |
| **1** | **Compatibilidade sem quebrar o banco ativo** | Antes de restringir listeners com `where("visibleTo", "array-contains-any", ...)` e Security Rules na Fase 2, todos os hooks e a migração normalizaram `campaignId`, `isDeleted` e `visibleTo` preservando retrocompatibilidade temporária nas leituras (incluindo fallback no `IndexedDB` e leitura dual de pastas em `folders` + docs legados não migrados). |
| **2** | **Preservação integral de mídia em `media/`** | Em consonância com a política de Falsa Exclusão e restauração direta pelo banco, **nenhuma alteração ou exclusão de personagem, nota ou cena apaga sua mídia antiga** (`deleteMedia` deixou de ser chamado pelos hooks e passou a fazer apenas `isDeleted: true` em `mediaService.js`). |
| **3** | **Soft Delete também para mensagens e mídias** | Além de `characters`, `folders`, `notes`, `scenes` e `compendium`, a Fase 1 converteu também `deleteMessage` (`useChatRolls.js`) e `deleteMedia` (`mediaService.js`) para `updateDoc({ isDeleted: true, ... })` em vez de `deleteDoc`. |
| **4** | **Compatibilidade do campo identificador de pasta** | Na coleção dedicada `campaigns/{campaignId}/folders/{folderId}`, a Fase 1 gravou `folderType` (`"character"` ou `"journal"`) junto de `isFolder: true` para manter compatibilidade imediata com os componentes de árvore existentes antes da decomposição de UI das fases seguintes. |
| **5** | **Fluxo seguro de avatar no cadastro** | Como no instante de `createUserWithEmailAndPassword` a campanha e a mídia do usuário ainda dependem do contexto autenticado, optou-se por transferir a DataURL comprimida do avatar recém-cadastrado via `sessionStorage` (`cp_pending_avatar_dataurl`) para que o `CampaignProvider` conclua o upload em `campaigns/{campaignId}/media/{mediaId}` logo após a montagem. |

---

## 3. Detalhamento Tópico a Tópico do que Foi Implementado

### Tópico 1 — Multi-Campanha (`campaignId` Universal) e Janelas Destacadas

1. **Resolução dinâmica e troca de campanha em [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx)**:
   - Criada a função `resolveInitialCampaignId()`, substituindo a antiga constante fixa `const campaignId = DEFAULT_CAMPAIGN_ID`:
     1. Lê `new URLSearchParams(window.location.search).get("campaignId")?.trim()`.
     2. Se ausente na URL, lê `localStorage.getItem("cp_active_campaign_id")?.trim()`.
     3. Como fallback final, retorna `DEFAULT_CAMPAIGN_ID` (`"main-table"`).
   - Transformado `campaignId` em estado React (`const [campaignId, setCampaignIdState] = useState(resolveInitialCampaignId)`) e exposta no `CampaignContext.Provider` a função `switchCampaign(nextCampaignId)`, que normaliza a string, atualiza o estado e persiste em `localStorage.setItem("cp_active_campaign_id", cleanId)`.
   - Na inicialização automática de nova campanha (`initialCampaign`), adicionados `"campaignId"` na raiz e `activeTurnIndex: 0` dentro de `combatState` (`{ active: false, round: 1, activeTurnIndex: 0, turnOrder: [] }`).
   - No listener `onSnapshot` de `campaigns/{campaignId}`, adicionada verificação `data.campaignId !== campaignId` em `needsPlayerSync` para realizar *backfill* automático de `updates.campaignId = campaignId`.
   - No efeito de presença do RTDB (`vtt_realtime/{campaignId}/presence/{uid}`) e em `updatePlayerProfile`, o payload gravado passou a conter `"campaignId"` explicitamente.

2. **Marcação explícita de `campaignId` em todas as coleções Firestore e nós RTDB**:
   - **Firestore**:
     - `scenes`: `createScene` e `updateScene` em [useScenes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useScenes.js).
     - `characters`: `createCharacter`, `createFolder` e `updateFolder` em [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js).
     - `notes`: `createNote`, `updateNote` e `cloneNoteToTarget` em [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js).
     - `folders`: `createFolder` em `useCharacters.js` e `useJournalNotes.js`, além do backfill em `migrationService.js`.
     - `compendium`: `createEntry` e `updateEntry` em [useCompendium.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCompendium.js).
     - `messages`: `sendEmoteMessage`, `sendTextMessage`, `sendSkillPing` e `executeRoll` em [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js).
     - `media`: `uploadCompressedMedia` e `uploadDataUrlMedia` em [mediaService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/mediaService.js).
   - **Realtime Database (RTDB)** — inclusão de `campaignId` e `sceneId`:
     - `tokens`: `addToken` e `updateToken` em [useRealtimeTokens.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useRealtimeTokens.js), mais `handleSpawnCharacterToken` em [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx).
     - `fog`: `toggleFogEnabled`, `addFogArea` e `resetFogCoverAll` em [useFogOfWar.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useFogOfWar.js).
     - `drawings` e `pings`: `triggerPing`, `addStroke`, `addShape` e `addTextItem` em [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js).

3. **URL de Pop-out com Escopo de Campanha (`?campaignId=...&sheetId=...`)**:
   - Atualizado `handlePopoutWindow` em [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx) e `handleOpenNewWindow` dentro de `CharacterRow` em [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx).
   - Ambas as janelas destacadas agora geram `?campaignId=${encodeURIComponent(cid)}&sheetId=${encodeURIComponent(character.id)}` usando `const cid = campaignId || character?.campaignId || "main-table"`, permitindo que o `CampaignProvider` da nova janela abra exatamente a campanha correta via `resolveInitialCampaignId()`.

---

### Tópico 2 — Segurança de Autenticação (`LoginScreen.jsx` e `AuthContext.jsx`)

1. **Remoção do armazenamento de senha em [LoginScreen.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/auth/LoginScreen.jsx)**:
   - Removido o estado `rememberPassword`.
   - No `useEffect` de montagem, removida a leitura de `localStorage.getItem("cp_remember_pwd")` com `atob(savedPwd)` e adicionada remoção ativa `localStorage.removeItem("cp_remember_pwd")` para limpar credenciais antigas de sessões anteriores.
   - Em `handleLoginSubmit`, removida a gravação `localStorage.setItem("cp_remember_pwd", btoa(password))`, mantendo a limpeza `localStorage.removeItem("cp_remember_pwd")` e preservando apenas `"cp_remember_penguin"` quando `rememberMe` está marcado.
   - Removido da interface o checkbox *"Lembrar da minha senha"*, mantendo intacto *"Lembrar de mim neste computador"*.

2. **Proteção do `updateProfile` contra Base64 em [AuthContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/AuthContext.jsx)**:
   - Em `registerWithEmail(email, password, displayName, photoURL = null)`, adicionada validação explícita:
     - `isDataUrlPhoto`: `typeof photoURL === "string" && photoURL.startsWith("data:")`.
     - `isHttpPhoto`: `typeof photoURL === "string" && /^https?:\/\//i.test(photoURL) && photoURL.length < 2000`.
   - Quando o usuário envia uma foto no formulário de cadastro (`isDataUrlPhoto`), a DataURL comprimida WebP é salva temporariamente em `sessionStorage.setItem("cp_pending_avatar_dataurl", photoURL)` e **não** é enviada ao `updateProfile(result.user, ...)` (evitando o erro de limite de tamanho do campo `photoURL` no Firebase Auth).
   - O `updateProfile` só recebe `displayName` e, quando válido, `photoURL` exclusivamente HTTP curto (`isHttpPhoto`).

---

### Tópico 3 — Pipeline de Avatares em `media/{mediaId}` e Cache `IndexedDB` Multi-Campanha

1. **Escopo por campanha no cache e upload direto de DataURL em [mediaService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/mediaService.js) e [useMediaUrl.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useMediaUrl.js)**:
   - Mantido o nome do banco local `IDB_NAME = "cpvtt_media_cache"` e store `IDB_STORE = "media"`, evitando perda de cache já armazenado nos navegadores.
   - Adicionado helper `getCacheKey(campaignId, mediaId)` que gera `${campaignId || DEFAULT_CAMPAIGN_ID}:${mediaId}`.
   - `getFromIndexedDB(cacheKey, fallbackKey = null)` consulta primeiro pela chave prefixada `cacheKey` e faz fallback transparente para `fallbackKey` (`mediaId` legado sem prefixo).
   - `saveToIndexedDB(cacheKey, dataUrl)`, `getCachedMediaSync(mediaId, campaignId)` e `getMediaDataUrl(mediaId, campaignId)` passaram a gravar e ler pelo `cacheKey` escopado por campanha (mantendo espelhamento em `memoryCache` por `mediaId` para lookups síncronos legados).
   - Criada e exportada a função `uploadDataUrlMedia({ dataUrl, category = "avatar", campaignId = DEFAULT_CAMPAIGN_ID, uploadedBy = "system", widthPx = 256, heightPx = 256, mimeType = "image/webp" })`: calcula `sizeBytes = Math.round((dataUrl.length * 3) / 4)`, gera `mediaId`, grava o documento em `campaigns/{campaignId}/media/{mediaId}` com `campaignId` e `isDeleted: false`, e aquece `memoryCache` + `IndexedDB`.
   - `useMediaUrl(mediaId, externalUrl, campaignId)` passou a usar `cacheKey = ${campaignId}:${mediaId}` tanto em `getCachedMediaSync(mediaId, campaignId)` quanto na comparação de `resolvedState.key === cacheKey`.

2. **Resolução reativa e migração de avatares em [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx) e [PlayerProfileModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/PlayerProfileModal.jsx)**:
   - **Migração automática de entrada**: tanto na criação da campanha (`initialCampaign`) quanto no `onSnapshot` da campanha existente, o provider lê `sessionStorage.getItem("cp_pending_avatar_dataurl")` ou detecta strings `data:...` herdadas em `existingPlayer.photoURL`. Encontrando Base64, faz upload via `uploadDataUrlMedia(..., category: "avatar")`, grava `avatarMediaId` em `players.{uid}` e define `photoURL: null` no documento da campanha (limpando em seguida `cp_pending_avatar_dataurl` do `sessionStorage`).
   - **Cache de avatares na sessão (`resolvedAvatars`)**: um `useEffect` varre todos os `avatarMediaId` presentes em `campaignData.players` e `onlineUsersData`, resolvendo via `getCachedMediaSync`/`getMediaDataUrl` e alimentando os `useMemo` de `campaign` (players enriquecidos com `photoURL`) e `onlineUsers` para que avatares, chat e listas exibam imagens sem armazenar Base64 no documento `campaigns/{campaignId}` nem em `presence/{uid}`.
   - **RTDB `presence/{uid}` limpo**: passou a gravar `{ uid, campaignId, displayName, avatarMediaId, photoURL: safePhotoURL, role, online, updatedAt }`, onde `safePhotoURL` bloqueia qualquer string iniciada com `"data:"`.
   - **`updatePlayerProfile({ displayName, photoURL, avatarMediaId })`**:
     - Se receber `photoURL === null` ou `""`, limpa ambos (`finalAvatarMediaId = null`, `finalPhotoURL = null`).
     - Se receber `photoURL` iniciando com `"data:"`, envia via `uploadDataUrlMedia`, atualiza `finalAvatarMediaId`, zera `finalPhotoURL = null` no Firestore/RTDB e popula `resolvedAvatars` imediatamente.
     - No `updateProfile(auth.currentUser, ...)`, envia somente `displayName` e, quando aplicável, URLs HTTP menores que 2000 caracteres.
   - **[PlayerProfileModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/PlayerProfileModal.jsx)**: passou a resolver `resolvedAvatarUrl` via `useMediaUrl(photoRemoved ? null : myPlayerProfile?.avatarMediaId, ..., campaignId)` e ganhou o estado booleano `photoRemoved`, permitindo que o botão `"Remover"` envie `{ photoURL: null, avatarMediaId: null }`.

---

### Tópico 4 — Serviço de Migração Idempotente (`migrationService.js`) e Subcoleção Dedicada `folders`

1. **Estrutura e contrato do [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js) (versão entregue na Fase 1)**:
   - Exporta `async function runCampaignMigrations({ campaignId = DEFAULT_CAMPAIGN_ID, gmUid })` e define localmente:
     - `migratedCampaignsSession = new Set()` — guarda chaves `${campaignId}:${gmUid}` para impedir reexecução redundante dentro da mesma sessão.
     - `isLegacyFishItem(item)` — detecta itens cujo `name`/`id` contenha `"peixe"`, `"fish"` ou `"fluffy"` e cujo `icon` esteja vazio ou igual a `"meat"`, `"carne"`, `"fish"` ou `"sword"`.
   - Executado em segundo plano dentro do `onSnapshot` de `campaigns/{campaignId}` em [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx) sempre que `expectedRole === "gm" || data.gmId === currentUid`.
   - **Fluxo de 6 etapas da rotina**:
     1. **`characters`**:
        - Pastas legadas (`data.isFolder && !data.migratedToFoldersCollection`): copia para `campaigns/{campaignId}/folders/{d.id}` via `setDoc(..., { merge: true })` com `{ id: d.id, campaignId, folderType: "character", name, parentId, ownerId, visibleTo, isDeleted, createdAt, updatedAt }` e marca o documento legado em `characters` com `{ campaignId, isDeleted: Boolean(data.isDeleted), migratedToFoldersCollection: true }`.
        - Fichas: garante `campaignId`, `isDeleted: false` (se não boolean), `visibleTo` (`[gmUid, ownerId]` quando `type === "npc"` ou `["ALL"]` para PCs) e substitui no array `inventory` qualquer item positivo em `isLegacyFishItem(it)` para `icon: "fluffy_fish"`.
     2. **`notes`**:
        - Pastas legadas (`data.isFolder && !data.migratedToFoldersCollection`): copia para `campaigns/{campaignId}/folders/{d.id}` com `folderType: "journal"`, `noteType: data.noteType || "lore"`, `scope`, `ownerId`, `visibleTo` calculado por `scope` (`"party"` → `["ALL"]`; `"gm"` → `[gmUid]`; `"player"` → `[gmUid, ownerId]`) e marca `migratedToFoldersCollection: true` no doc antigo em `notes`.
        - Notas: normaliza `campaignId`, `isDeleted: false` e `visibleTo` combinando `gmUid`, `ownerId` e `sharedWithPlayerIds` conforme o `scope`.
     3. **`folders`**: normaliza `campaignId`, `isDeleted: false`, `folderType` (`data.noteType ? "journal" : "character"`) e `visibleTo` caso ausentes.
     4. **`scenes`**: normaliza `campaignId`, `isDeleted: false` e `visibleTo` (`data.visibleToPlayers ? ["ALL"] : [gmUid]`).
     5. **`compendium`**: normaliza `campaignId`, `isDeleted: false`, `visibleTo` (`data.visibleToPlayers ? ["ALL"] : [gmUid]`) e corrige `icon = "fluffy_fish"` via `isLegacyFishItem(data)`.
     6. **`messages`**: normaliza `campaignId`, `isDeleted: false` e `visibleTo` (`data.visibility === "gm_only" ? [gmUid, senderId] : ["ALL"]`).
   - *(Observação de histórico: na versão original da Fase 1, todas as escritas usavam `setDoc`/`updateDoc` sequenciais dentro dos loops; a otimização para `writeBatch` em blocos de até 400 operações foi implementada posteriormente durante a Fase 2).*

2. **Transição para a coleção dedicada `folders` nos hooks**:
   - **Em [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js)**:
     - Passou a manter dois estados (`rawItems` da coleção `characters` e `dedicatedFolders` da subcoleção `folders`), filtrando itens de pasta em `folders` por `!f.isDeleted && (f.folderType === "character" || (!f.folderType && !f.noteType))` e excluindo da escuta de `characters` documentos com `isDeleted` ou `migratedToFoldersCollection`.
     - `rawFolders` faz merge determinístico via `Map` (`id` como chave) entre pastas legadas ainda não migradas e `dedicatedFolders`.
     - `createFolder` agora grava em `campaigns/{campaignId}/folders/{folderId}` com `folderType: "character"`, `campaignId`, `isFolder: true` e `isDeleted: false`, atualizando `setDedicatedFolders`.
     - `updateFolder` e `deleteFolder` detectam se o `folderId` ainda reside em `characters` (legado) ou em `folders` (dedicada) e aplicam o update/soft-delete no destino correspondente.
   - **Em [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js)**:
     - Implementa a mesma assinatura dupla (`notes` + `folders` filtrando `folderType === "journal" || Boolean(f.noteType)`) e merge em `rawFolders` via `Map`.
     - `createFolder` passou a gravar em `campaigns/{campaignId}/folders/{folderId}` com `folderType: "journal"`, `campaignId`, `isFolder: true`, `isDeleted: false` e permissões derivadas de `buildPermissionsForScope`.
     - `accessibleFolders` passou a verificar também `visibleTo` (`vis.includes("ALL") || vis.includes(uid)`), além de `scope === "party"` e `scope === "player" && ownerId === uid`.

---

### Tópico 5 — Remoção Definitiva dos Hacks *"Peixe Fluffy"* em Runtime

Com a correção persistida diretamente no banco pelo `migrationService.js`, todos os desvios *hardcoded* de tempo de execução foram eliminados em 3 arquivos:

1. **[useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js)**: removido todo o bloco dentro do `onSnapshot` que reescrevia `data.inventory` procurando `"peixe"`, `"fish"` ou `"fluffy"`.
2. **[CpFlashIcons.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CpFlashIcons.jsx)**:
   - Simplificado `renderCpFlashIcon(iconOrId, size)` removendo a inspeção de `name`/`id` quando `iconOrId` é objeto e o bloco `if (s === "peixe" || ...)` por string, passando a consultar diretamente `CP_FLASH_ICONS` e `LEGACY_ALIASES`.
   - Removidas também 4 chaves duplicadas no final de `LEGACY_ALIASES` (`fish`, `peixe`, `peixe fresco`, `inv_peixe`) que haviam sido apontadas pelo `oxlint`, preservando as entradas originais das linhas 209–212.
3. **[CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx)**:
   - Simplificado `resolveItemIcon(item)` para `if (!item) return "sword"; if (typeof item === "string") return item; return item.icon || item.name || "sword";`.
   - Removida a detecção `isFish` em `handlePullFromCompendium`, em `handleAddItem` e no handler `onChange` do input de nome ao cadastrar item.

---

### Tópico 6 — Política de "Falsa Exclusão" (*Soft Delete*) e Modal de Exclusão de Pastas

1. **Substituição de `deleteDoc` e `deleteMedia` por Soft Delete**:
   - Padrão gravado no Firestore nas operações de exclusão: `{ isDeleted: true, deletedAt: serverTimestamp(), deletedBy: user.uid }` *(em `useCompendium` e `useChatRolls`, com fallback `user?.uid || "gm"`; em `mediaService.deleteMedia`, `{ isDeleted: true, deletedAt: serverTimestamp() }`)*.
   - Todos os hooks passaram a filtrar `!doc.isDeleted` no processamento do `onSnapshot` para ocultar imediatamente os registros sem removê-los do banco:
     - `useCharacters.js` → `deleteCharacter` (não chama mais `deleteMedia` para avatar/token nem remove mídia antiga em `uploadCharacterImage`).
     - `useJournalNotes.js` → `deleteNote` (não remove `imageMediaId` antigo em `updateNote`).
     - `useScenes.js` → `deleteScene` (desativa `activeSceneId` se necessário e grava `isDeleted: true` via `updateDoc`; removida limpeza de `mapImage.mediaId` em `updateScene` e `deleteScene`).
     - `useCompendium.js` → `deleteEntry`.
     - `useChatRolls.js` → `deleteMessage`.
     - `mediaService.js` → `deleteMedia`.

2. **Fluxo interativo e opções na exclusão de pastas**:
   - **Backend nos hooks**:
     - `deleteFolder(folderId, options = { deleteContents: false })` em [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js): coleta recursivamente a pasta e subpastas (`collectFolderIds`), localiza fichas em `allFolderIds`, e se `deleteContents === true` marca `isDeleted: true` em cada ficha afetada; se `deleteContents === false`, move `folderId` para `folderTarget.parentId || null`. Em seguida marca `isDeleted: true` em cada pasta/subpasta (em `folders` e/ou `characters`).
     - `deleteFolder(folderId, folderPath, noteType, options = { deleteContents: false })` em [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js): localiza subpastas pelo prefixo `cleanTargetPath` e cards pertencentes à pasta ou subpastas; se `deleteContents === true`, marca `isDeleted: true` nos cards afetados; caso contrário, atualiza `folder` para `parentPath`. Em seguida aplica Soft Delete nas pastas alvo em `folders` e/ou `notes`.
   - **Modais de confirmação na UI**:
     - [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx): estado `folderToDelete`, função `handleRequestDeleteFolder(folderId)` conectada a todas as instâncias de `FolderItem`, e modal (`zIndex: 1000`) com a pergunta *"Deseja excluir também as fichas desta pasta?"* e 3 ações: *"Não, mover fichas para a raiz"* (`{ deleteContents: false }`), *"Sim, excluir pasta e fichas"* (`{ deleteContents: true }`) e *"Cancelar"*.
     - [JournalWorkspace.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/JournalWorkspace.jsx): estado `folderToDelete`, função `handleRequestDeleteFolder(folderId, fullPath, typeKey)` passada ao `FolderTreeNode`, e modal (`zIndex: 2500`) com a pergunta *"Deseja excluir também os cards desta pasta?"* e 3 ações: *"Não, mover cards para a raiz"* (`{ deleteContents: false }`), *"Sim, excluir pasta e cards"* (`{ deleteContents: true }`) e *"Cancelar"*.

---

### Tópico 7 — Normalização Preventiva de `visibleTo` e `authorId` (Preparação Direta para Fase 2)

- **[useScenes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useScenes.js)**:
  - `createScene` passou a gravar `visibleTo: isVisible ? ["ALL"] : [gmUid]` e `isDeleted: false`.
  - `updateScene` sincroniza `visibleTo` automaticamente sempre que `updates.visibleToPlayers !== undefined`.
  - `activateSceneForTable` passou a atualizar `visibleTo: ["ALL"]` ao publicar a cena para os jogadores.
- **[useCompendium.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCompendium.js)**:
  - `createEntry` passou a gravar `visibleTo: isVisible ? ["ALL"] : [gmUid]` e `isDeleted: false`.
  - `updateEntry` sincroniza `visibleTo` automaticamente sempre que `updates?.visibleToPlayers !== undefined`.
- **[useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js)**:
  - `addStroke`, `addShape` e `addTextItem` passaram a gravar `authorId: user.uid` junto de `createdBy: user.uid`, deixando novos desenhos prontos para a validação de autoria estrita no código e em `database.rules.json` na Fase 2.

---

## 4. Validação e Verificações na Entrega da Fase 1

1. **`npm run build` (após a correção final em `CpFlashIcons.jsx`)**: **aprovado** (código de saída `0`, `✓ 79 modules transformed`, `dist/index.html 0.79 kB`, `dist/assets/index-Dz-EzhxH.css 27.20 kB`, `dist/assets/index-DVHxZ4S2.js 1,347.35 kB`, `✓ built in 1.04s`).
2. **`npm run lint` (`oxlint`)**: executado antes do último ajuste em `CpFlashIcons.jsx`, finalizando com **0 erros** e **20 avisos** (`Found 20 warnings and 0 errors. Finished in 757ms on 45 files`). Um dos avisos apontados (`Duplicate key 'fish'` em `CpFlashIcons.jsx:209`) foi corrigido logo em seguida, mas `npm run lint` não chegou a ser reexecutado após essa última edição (ficando apenas validado por `npm run build`), e os avisos pré-existentes em outros arquivos permaneceram intocados para as fases seguintes.
3. **Banco em produção**: a migração (`migrationService.js`) não havia sido executada contra o banco real dentro da Fase 1 — seu disparo efetivo ocorreu na abertura posterior da mesa como Mestre reportada pelo usuário na transição para a Fase 2.

---

## 5. Fronteira Fase 1 → Fase 2 (Estado Deixado ao Fim da Fase 1)

1. **Divergências pontuais anotadas na entrega da Fase 1**:
   - `migrationService.js` usava `updateDoc`/`setDoc` sequenciais por documento em vez de `writeBatch` em lotes *(ajustado posteriormente no início da Fase 2)*.
   - As queries Firestore de `useCharacters`, `useJournalNotes`, `useScenes`, `useCompendium` e `useChatRolls` ainda permaneciam sem `where("visibleTo", "array-contains-any", ...)` e as regras em `firestore.rules` e `database.rules.json` permaneceram intactas aguardando a Fase 2.
2. **Itens explicitamente deixados para a Fase 2+**:
   - Desacoplamento de `drawings` e `pings` para fora de `vtt_realtime/{campaignId}/fog/{sceneId}` + migração única de desenhos existentes no caminho antigo.
   - Remoção definitiva da borracha parcial (`sliceStrokeByEraser`, `erasePortionAt`, `flushPendingUpdates` e buffer).
   - Isolamento estrito de autoria nos hooks de desenhos/tokens/fichas e UI.
   - Sincronização bidirecional Ficha ↔ Token apenas para Players vs. vida/recursos independentes por instância para tokens de Mestre/NPC.
   - Ativação local de `firestore.rules` e `database.rules.json` + ajuste das queries `visibleTo`.


---

# FASE 2 — Isolamento, Sincronização Ficha↔Token e Security Rules Locais

> [!NOTE]
> **Separação Explícita de Autoria na Fase 2**
> Conforme solicitado, esta seção preserva a separação exata entre:
> - **Parte A (Base Inicial — Opus e Argon)**: as 2 intervenções pontuais realizadas antes da interrupção por limite de tokens.
> - **Parte B (Desenvolvimento e Conclusão da Fase 2)**: toda a conclusão implementada após a retomada até a validação final (`npm run lint` e `npm run build`), mantendo o deploy (`firebase deploy`) bloqueado por regra até autorização explícita.

## 1. Decisões Confirmadas Antes da Execução da Fase 2

Antes e durante a execução da Fase 2, foram seguidas as 4 diretrizes acordadas com o usuário:

| # | Tópico | Decisão Confirmada | Impacto no Código / Operação |
| :--- | :--- | :--- | :--- |
| **1** | **Migração de desenhos RTDB** | Copiar/migrar automaticamente **uma única vez** quando o Mestre carregar a cena | Evita perda dos desenhos legados em `vtt_realtime/{campaignId}/fog/{sceneId}/drawings` ao mover para o nó dedicado |
| **2** | **Execução prévia da Fase 1** | Mesa iniciada pelo usuário como Mestre após a Fase 1 | Os dados da campanha ativa já passaram uma vez pelo backfill da Fase 1 em [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js) |
| **3** | **Publicação de Security Rules** | **Não publicar ainda** (`firebase deploy` vetado) | [firestore.rules](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/firestore.rules) e [database.rules.json](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/database.rules.json) atualizados apenas localmente |
| **4** | **Ajuste de divergências da Fase 1** | Corrigir a escrita unitária de migração para lotes | Motivo direto da refatoração para `writeBatch` em [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js) |

---

## Parte A — Base Inicial Executada por Opus e Argon (Antes da Retomada)

### Resumo do Escopo Recebido (Pré-Retomada)

- **Escopo recebido no ponto de parada**: apenas **2 arquivos** modificados para a Fase 2 ([VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx) e [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js)), com o restante do workspace intacto em relação ao fim da Fase 1 (além do diff pré-existente de `measureStats` em [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx)).

### Tópico A.1 — Otimização em Lote (`writeBatch`) em [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js)

- **Responsável**: Argon.
- **Arquivo**: [migrationService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/migrationService.js) (323 linhas).
- **Implementação**:
  - **Imports** (linhas 1–7): removidos `setDoc` e `updateDoc`; adicionado `writeBatch` de `firebase/firestore`.
  - **Constante de teto de lote** (linha 11): `const MAX_BATCH_OPS = 400;` (abaixo do teto de 500 operações por `WriteBatch` do Firestore).
  - **Helpers internos em `runCampaignMigrations`** (linhas 44–65):
    - `flushIfFull()`: quando `opCount >= MAX_BATCH_OPS`, executa `await batch.commit()`, recria `batch = writeBatch(db)` e zera `opCount`.
    - `queueSet(ref, data, options)` e `queueUpdate(ref, data)`: enfileiram operações no `batch`, incrementam `opCount` e disparam `await flushIfFull()`.
  - **Blocos convertidos para fila em lote**: `characters` (linhas 81, 97, 135), `notes` (linhas 159, 176, 216), `folders` (linha 244), `scenes` (linha 265), `compendium` (linha 289) e `messages` (linha 312), com `if (opCount > 0) { await batch.commit(); }` ao final (linhas 316–318).

### Tópico A.2 — Trava Inicial de Matriz/Template GM vs. Token em `handleApplyCombatEffect` ([VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx))

- **Responsável**: Opus.
- **Trecho original implementado**: `handleApplyCombatEffect` em [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx).
- **Regra aplicada**:
  1. Detecção `isGmTemplate = Boolean(targetChar && (targetChar.type === "npc" || targetChar.ownerId === campaign?.gmId) && (liveToken || targetTokenId))`.
  2. Somente atualizava `updateCharacterResource(...)` quando `!isGmTemplate`.
  3. Quando `resKey === "hp"` com token ativo, aplicava `hpCurrent` no nó RTDB `vtt_realtime/${campaignId}/tokens/${effectiveSceneId}/${effectiveTokenId}`.
- **Estado deixado na transição Parte A → Parte B**: o bloco RTDB em `handleApplyCombatEffect` cobria inicialmente apenas `hp`; todos os demais itens da Fase 2 (RTDB `drawings`/`pings`, fog isolado, remoção da borracha, autoria estrita em hooks/UI, sync Ficha↔Token completo para PCs, queries `visibleTo` e Security Rules locais) permaneceram pendentes até a Parte B.

---

## Parte B — Desenvolvimento e Conclusão Completa da Fase 2

### 1. Inventário de Arquivos Desenvolvidos/Atualizados na Parte B

| Arquivo | Frente Atendida na Parte B | Link Direto |
| :--- | :--- | :--- |
| `useFogOfWar.js` | Escuta desacoplada somente em `enabled` e `areas` de `fog/{sceneId}` | [useFogOfWar.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useFogOfWar.js) |
| `useBoardInteractive.js` | Nós RTDB `drawings`/`pings`, migração única legada, remoção da borracha, `canEditDrawing` e escritas granulares | [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js) |
| `useRealtimeTokens.js` | `canControlToken`/`canDeleteToken`, proteção de `!isGM`, whitelist de campos, `defense`/`mpCurrent`/`mpMax`/`ownerId`/`isGmToken` | [useRealtimeTokens.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useRealtimeTokens.js) |
| `TokenModal.jsx` | Campos `mpCurrent`/`mpMax`, controle de `canDelete`, acesso de `showName` fora de bloco exclusivo do GM | [TokenModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/TokenModal.jsx) |
| `useCharacters.js` | Query `visibleTo`, espera por `campaign`, travas `canEditCharacter`/`canEditFolder`, sync Ficha (PC) → Token RTDB | [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js) |
| `VTTLayout.jsx` | Generalização HP/MP em `handleApplyCombatEffect`, `mpCurrent`/`mpMax`/`isGmToken` no spawn e `handleSyncTokenToCharacter` | [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx) |
| `BoardViewport.jsx` | Autoria estrita em desenhos/marquee/texto/tokens, sync Token→Ficha, limpeza de comentário de borracha | [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx) |
| `CharactersSidebarList.jsx` | Propagação e enforcement de `canEditCharacter` e `canEdit` nas pastas e linhas de personagem | [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx) |
| `useJournalNotes.js` | Query `visibleTo`, espera por `campaign`, helpers `canEditNote`/`canEditFolder` e travas contra escopo `"gm"` por player | [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js) |
| `useCompendium.js` | Alinhamento da query de jogador para `where("visibleTo", "array-contains-any", ["ALL", user.uid])` | [useCompendium.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCompendium.js) |
| `useScenes.js` | Alinhamento da query de jogador para `where("visibleTo", "array-contains-any", ["ALL", user.uid])` | [useScenes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useScenes.js) |
| `useChatRolls.js` | Alinhamento da query de mensagens para `where("visibleTo", "array-contains-any", ["ALL", user.uid])` e espera por `campaign` | [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js) |
| `firestore.rules` | Atualização local com `canSeeResource`, regra estrita de `campaigns`, subcoleção `chunks` e travas de escrita | [firestore.rules](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/firestore.rules) |
| `database.rules.json` | Atualização local para nós `tokens`, `fog`, `drawings`, `pings` e `presence` com regras por `$id` | [database.rules.json](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/database.rules.json) |

---

### 2. Detalhamento Tópico a Tópico (Desenvolvimento da Parte B)

#### Tópico B.1 — Desacoplamento RTDB (`drawings` e `pings`), Migração Única e Fog Isolado
- **Isolamento do Fog em [useFogOfWar.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useFogOfWar.js)**:
  - Substituída a assinatura no nó pai `vtt_realtime/${campaignId}/fog/${sceneId}` por **dois listeners independentes** em `vtt_realtime/${campaignId}/fog/${sceneId}/enabled` e `vtt_realtime/${campaignId}/fog/${sceneId}/areas`.
  - Estado consolidado `fogDataState` passa a armazenar `{ sceneKey, enabled, areas }`, isolando o fog de qualquer dado residual sob `fog/${sceneId}`.
- **Desacoplamento e Migração Única em [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js)**:
  - Desenhos (`strokes`, `shapes`, `textItems`) migrados de `fog/${sceneId}/drawings` para `vtt_realtime/${campaignId}/drawings/${sceneId}`.
  - Pings migrados de `fog/${sceneId}/pings` para `vtt_realtime/${campaignId}/pings/${sceneId}`, passando a incluir `authorId`, `authorName` e `createdAt` (junto de `senderId`, `senderName`, `timestamp`) e limpeza via `rtdbRemove(pingRef)`.
  - **Migração automática única (Mestre)**: controlado por `migratedScenesRef = useRef(new Set())` por `campaignId:sceneId` quando `isRealGM === true`. Lê `fog/${sceneId}/drawings` via `rtdbGet`, preserva chaves ausentes em `drawings/${sceneId}` preenchendo `id`, `campaignId`, `sceneId` e `authorId: itemVal.authorId || itemVal.createdBy || user.uid`, grava via `rtdbUpdate(targetDrawingsRef, updates)` e limpa `fog/${sceneId}/drawings` e `fog/${sceneId}/pings` via `rtdbRemove`.

#### Tópico B.2 — Remoção Completa da Borracha Parcial
- Em [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js):
  - Removidas a função utilitária exportada `sliceStrokeByEraser`, as refs `pendingRtdbUpdatesRef` e `rtdbFlushTimerRef` e as funções `flushPendingUpdates`, `scheduleFlushUpdates` e `erasePortionAt` (bem como suas exposições no retorno do hook).
- Em [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx):
  - Atualizado o comentário residual de filtro da camada ativa removendo `/borracha`.

#### Tópico B.3 — Autoria Estrita e Travas de Permissão (Hooks + UI)
1. **Desenhos em [useBoardInteractive.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useBoardInteractive.js) e [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx)**:
   - Implementado `canEditDrawing(item)`: permite `isGM || (item.authorId || item.createdBy) === user.uid`.
   - `updateTextItem`: valida `canEditDrawing` e remove campos imutáveis (`id`, `campaignId`, `sceneId`, `layer`, `authorId`, `authorName`, `createdBy`, `createdAt`) quando `!isGM`.
   - `deleteDrawingItems`, `moveDrawingItems` e `rotateDrawingItems`: filtram itens por `canEditDrawing` e executam operações **granulares por item (`$drawingId`)** com `Promise.all(...)` (`rtdbRemove` / `rtdbUpdate` direto no nó do item), compatíveis com as regras RTDB de jogador sem escrita no nó pai `drawings/${sceneId}`.
   - Em [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx): clique em desenho (`handleItemClick`), caixa de seleção em lote (`selectionBox`), `pointerEvents`/`cursor`/`onMouseDown` de formas/traços/textos e `onDoubleClick` em textos agora respeitam `canEditDrawing`.
2. **Tokens em [useRealtimeTokens.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useRealtimeTokens.js), [TokenModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/TokenModal.jsx) e [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx)**:
   - `canControlToken(token)` passa a contemplar `token.ownerId === user.uid` além de `isGM` e `controlledBy`; criado `canDeleteToken(token)` (`isGM || token.ownerId === user.uid`).
   - `addToken` força para `!isGM`: `layer = "tokens"`, `ownerId = user.uid`, `visibleToPlayers = true`, `controlledBy = [campaign?.gmId, user.uid]` e grava `defense`, `mpCurrent`, `mpMax`, `characterType`, `showName` e `isGmToken`.
   - `moveTokenRealtime` e `updateToken` validam `canControlToken`; quando `!isGM`, `updateToken` remove `controlledBy`, `ownerId`, `layer`, `visibleToPlayers`, `characterId`, `characterType` e `isGmToken` antes do `rtdbUpdate`, retornando o `payload` salvo.
   - `removeToken` valida `canDeleteToken` (substituindo a trava antiga `isRealGM` que impedia dono de apagar seu próprio token).
   - No `BoardViewport.jsx`: `handleStartTokenDrag` aborta quando `initialPositions` fica vazio; `handleQuickAdjustHp`, `handleQuickToggleTokenName`, atalho `Delete/Backspace` e botão `Deletar Selecionados` verificam `canControlToken` / `canDeleteToken`; `<TokenModal>` recebe `canDelete={canDeleteToken(editingToken)}` e `onDelete` condicional.
3. **Fichas e Pastas em [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js) e [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx)**:
   - Adicionado `canEditFolder`; `createCharacter` impede `!isGM` de forjar `ownerId` ou `type: "npc"` (`effectiveType = isGM ? type : "pc"`).
   - `createFolder` impede `!isGM` de definir outro `ownerId`.
   - `updateCharacter`, `updateCharacterResource`, `uploadCharacterImage` e `updateFolder` exigem `canEditCharacter` / `canEditFolder`, e quando `!isGM` removem `ownerId`, `visibleTo`, `editableBy`, `isDeleted`, `campaignId` (e `type` / `isFolder` / `folderType`). Em `deleteFolder`, personagens afetados são filtrados por `canEditCharacter`.
   - [CharactersSidebarList.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharactersSidebarList.jsx) passa a receber e usar `canEditCharacter`, restringindo `+Mapa`, `📁` (mover), arraste e ações de pasta (`+👤`, `+📁`, `✏️`, `✕`) conforme `isGM || canEdit`.
4. **Diários em [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js)**:
   - Adicionados `canEditNote` e `canEditFolder` (negando notas/pastas de `scope === "gm"` para não-GM).
   - `createNote`, `createFolder` e `cloneNoteToTarget` convertem `scope === "gm"` para `"player"` e fixam `ownerId = user.uid` quando `!isGM`.
   - `updateNote`, `updateNodePosition`, `shareNoteWithTarget`, `deleteNote` e `deleteFolder` validam permissão antes de executar mutações no Firestore e impedem alteração de campos protegidos por `!isGM`.

#### Tópico B.4 — Sincronização Bidirecional Completa Ficha ↔ Token (PC) e Isolamento GM/NPC
- **Regra de separação PC vs. Matriz GM/NPC**:
  - **Tokens de Mestre / NPC** (`type === "npc"` ou `ownerId === campaign?.gmId`, marcado também no token via `isGmToken: true`): o spawn copia valores iniciais (`name`, `defense`, `hp`, `mp`, `ringColor`, imagem, `showName`, `sizeInCells`). Após o spawn, ajustes no mapa/combate alteram **somente** a instância RTDB daquele token, e edições na ficha-matriz nunca sobrescrevem tokens ativos no mapa.
  - **Personagens de Jogador (PC)** (`!isGmTemplate`): mantêm espelho bidirecional entre Ficha (Firestore) e tokens vinculados (`tok.characterId === char.id && !tok.isGmToken`) na cena ativa (`campaign.activeSceneId`).
- **Sentido Ficha → Token RTDB ([useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js))**:
  - Criado o helper interno `syncCharacterToActiveSceneTokens(targetChar, updates)`, chamado automaticamente em `updateCharacter` (a menos que `{ skipTokenSync: true }`), cobrindo edição direta na ficha, gasto/ganho de recursos (`updateCharacterResource`, inclusive via rolagens/efeitos) e upload de avatar/token (`uploadCharacterImage`), funcionando inclusive em janela destacada (`?sheetId=...`).
  - Campos espelhados no token RTDB (atualizados individualmente por `$tokenId`): `name`, `defense`, `ringColor` (`cardColor`), `hpCurrent`/`hpMax` (`resources.hp`), `mpCurrent`/`mpMax` (`resources.mp`), `mediaId`/`externalUrl`, `showName` e `sizeInCells`.
- **Sentido Combate / Chat ([VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx))**:
  - `handleApplyCombatEffect`: estendido além da Parte A do Opus para cobrir tanto `hp` (`hpCurrent`/`hpMax`) quanto `mp` (`mpCurrent`/`mpMax`) nos tokens RTDB (e usar `skipTokenSync: true` quando `updateCharacterResource` já vai atualizar o mesmo token na cena ativa).
  - `handleSpawnCharacterToken`: passou a verificar `!isGM && !canEditCharacter(char)` e incluir `isGmToken`, `mpCurrent` e `mpMax` no payload inicial do token.
- **Sentido Tabuleiro → Ficha Firestore ([BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx), [TokenModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/TokenModal.jsx), [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx))**:
  - Criado `handleSyncTokenToCharacter(token, updatedFields)` em [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx) (propagado para `<BoardViewport onSyncTokenToCharacter={...} />`), que ignora tokens sem `characterId`, tokens sem permissão de edição (`!canEditCharacter`) ou templates GM/NPC (`isGmTemplate`), e atualiza Firestore com `{ skipTokenSync: true }` para `name`, `defense`, `cardColor`, `resources.hp`, `resources.mp` e `defaultToken` (`showName`, `sizeInCells`, `mediaId`, `externalUrl`, `ringColor`).
  - Integrado em `handleSaveTokenModal`, `handleQuickAdjustHp` e `handleQuickToggleTokenName` em [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx), além dos inputs `MP Atual` e `MP Máximo` adicionados ao [TokenModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/TokenModal.jsx).

#### Tópico B.5 — Alinhamento das Queries `visibleTo` no Cliente e Atualização Local das Security Rules
- **Queries Firestore para não-GM (`!isRealGM`) aguardando carregamento de `campaign`**:
  - Aplicado `where("visibleTo", "array-contains-any", ["ALL", user.uid])` nas queries dos listeners em:
    - [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js) (`characters` e `folders`).
    - [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js) (`notes` e `folders`).
    - [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js) (`messages`).
    - [useScenes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useScenes.js) (`scenes` — substituindo o filtro legado por `visibleToPlayers`).
    - [useCompendium.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCompendium.js) (`compendium` — substituindo o filtro legado por `visibleToPlayers`).
  - Nenhuma dessas 6 coleções usa `.orderBy(...)` no Firestore (ordenação mantida em memória JS), dispensando índices compostos manuais.
- **[firestore.rules](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/firestore.rules) (local, sem deploy)**:
  - `isAuthorizedGMByEmail()` alinhado ao e-mail real do Mestre configurado em [authorizedUsers.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/constants/authorizedUsers.js) (`erickteixeiractt@gmail.com`).
  - Helper `canSeeResource(campaignId, resourceData)` ativado para `allow read` em `scenes`, `compendium`, `messages`, `characters`, `notes` e `folders`, iniciando com `'visibleTo' in resourceData && ('ALL' in resourceData.visibleTo || request.auth.uid in resourceData.visibleTo)` (após `isGM`) e checando propriedades opcionais com operador `in` para compatibilidade estrita com validação estática de queries CEL no Firestore.
  - Em `campaigns/{campaignId}`: `allow create` restrito ao GM autorizado ou criador `gmId == request.auth.uid`; `allow update` não-GM restrito exclusivamente às chaves `['players', 'updatedAt']` alterando apenas `players[request.auth.uid]`.
  - Em `characters/{characterId}`: updates por não-GM impedidos de alterar `ownerId`, `visibleTo`, `editableBy`, `type` e `campaignId`.
  - Em `folders/{folderId}`: tratamento seguro `(!('scope' in ...) || scope in ['player', 'party'])` para acomodar tanto pastas de personagens (sem `scope`) quanto de diários.
  - Em `media/{mediaId}/chunks/{chunkIndex}`: adicionada regra de leitura e escrita controlada pelo Mestre ou `uploadedBy` do documento pai.
- **[database.rules.json](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/database.rules.json) (local, sem deploy)**:
  - `tokens/$sceneId/$tokenId`: criação não-GM exige `ownerId === auth.uid` e `layer === 'tokens'`; exclusão exige GM ou `ownerId === auth.uid`; atualização exige GM, `ownerId === auth.uid` ou presença em `controlledBy/0..4` (`'ALL'` ou `auth.uid`) com preservação de `ownerId`/`layer`.
  - `fog/$sceneId`: `.write` exclusivo do GM (`auth.token.email === 'erickteixeiractt@gmail.com'`).
  - `drawings/$sceneId/$drawingId`: `.write` por GM ou autor (`authorId`/`createdBy === auth.uid`, criação por player restrita a `layer === 'tokens'`).
  - `pings/$sceneId/$pingId`: `.write` por GM ou autor (`authorId`/`senderId === auth.uid`) para criação e auto-limpeza.
  - `presence/$uid`: mantido `.write` restrito a `auth.uid === $uid`.

---

### 3. Validação Final Executada Após Conclusão da Fase 2

- **`database.rules.json`**: validado com `JSON.parse` via Node.js (`database.rules.json OK`).
- **Lint (`npm run lint` / `oxlint`)**: executado após todas as edições finais — **0 erros** (`18 warnings` pré-existentes no projeto, `561ms`, `45 files`, `104 rules`).
- **Build (`npm run build` / `vite build`)**: executado após todas as edições finais — build concluído com sucesso (`79 modules transformed`, `built in 884ms`, geração de `dist/index.html`, `dist/assets/index-Dz-EzhxH.css` e bundle JS `1,357.50 kB`).
- **Publicação / Git**: **nenhum `firebase deploy` e nenhum `git commit` foram executados**, conforme regras do usuário.

---

## Fronteira Fase 2 → Fase 3 (Próximos Passos Planejados)

Com a Fase 2 concluída localmente, os próximos marcos no roteiro de refatoração são:
1. Revisão/autorização explícita do usuário para `firebase deploy --only firestore:rules,database` quando desejar ativar as Security Rules nos servidores Firebase.
2. **Fase 3**: extração/limpeza de `engines/` para `services/`, `BroadcastChannel` para sincronização multi-janela sem depender só de round-trip em nuvem, atalhos dinâmicos e base do Modo de Turno.

---

# FASE 3 — Arquitetura em Camadas (`utils/`, `services/`), Sync Multi-Janela (`BroadcastChannel`), Atalhos Dinâmicos e Base do Modo de Turno

## 1. Resumo Executivo da Fase 3

A **Fase 3** separou definitivamente regras de cálculo puras (`src/engines/`), orquestração com Firebase (`src/services/`), normalização compartilhada (`src/utils/`) e estado reativo/UI (`src/hooks/`, `src/contexts/`, `src/components/`), além de eliminar o acoplamento a `localStorage` para alvos/AoE multi-janela e estabelecer a infraestrutura estrutural do Modo de Turno (`combatState`).

### Inventário Completo de Arquivos da Fase 3

#### Arquivos Criados (5)
1. [stringUtils.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/utils/stringUtils.js) — utilitários puros de normalização unicode/chaves e resolução de URLs estáticas.
2. [useCrossWindowSync.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCrossWindowSync.js) — sincronização instantânea multi-janela via `BroadcastChannel`.
3. [combatService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/combatService.js) — serviço de domínio para custos, efeitos Ficha↔Token, tokens em cena e persistência de `combatState`.
4. [rollService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/rollService.js) — serviço de domínio para identidade de emissor, classificação explícita `rollKind`, resolução dinâmica de atalhos e envio de rolagens/mensagens.
5. [journalService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/journalService.js) — serviço de domínio para permissões, CRUD, clonagem, compartilhamento e pastas de Diários.

#### Arquivos Modificados (16)
1. [aliasEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/aliasEngine.js)
2. [formulaEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/formulaEngine.js)
3. [combatEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/combatEngine.js)
4. [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx)
5. [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js)
6. [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js)
7. [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js)
8. [CpFlashIcons.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CpFlashIcons.jsx)
9. [JournalWorkspace.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/JournalWorkspace.jsx)
10. [NoteEditorModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/NoteEditorModal.jsx)
11. [SavingThrowModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/combat/SavingThrowModal.jsx)
12. [QuickActionsHotbar.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/QuickActionsHotbar.jsx)
13. [ChatSidebarPanel.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/chat/ChatSidebarPanel.jsx)
14. [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx)
15. [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx)
16. [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx)

*(Total: **21 arquivos** — 5 criados e 16 modificados; nenhuma Security Rule ou arquivo de deploy alterado.)*

---

## 2. Utilitários Compartilhados e Limpezas DRY / OCP

### 2.1 [stringUtils.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/utils/stringUtils.js)
Criado módulo único com 5 helpers puros:
- `stripAccents(str)`: remove diacríticos via `.normalize("NFD").replace(/[\u0300-\u036f]/g, "")`.
- `normalizeText(str)`: normalização com espaços colapsados e lowercase para busca/aliases.
- `normalizeKey(str)`: identificador alfanumérico + `_` (`a-z0-9_`).
- `normalizeCompactKey(str)`: identificador compacto sem separadores (`a-z0-9`).
- `getAssetUrl(assetPath)`: centraliza resolução de `import.meta.env.BASE_URL` para caminhos públicos (`emotes/`, `icones/`, `map-icon.png`, etc.).

**Adoção transversal**:
- [aliasEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/aliasEngine.js): `normalizeAliasText` passou a delegar para `normalizeText`.
- [formulaEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/formulaEngine.js): passou a importar `normalizeKey` diretamente de `stringUtils.js`.
- [SavingThrowModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/combat/SavingThrowModal.jsx) e [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx): substituídos blocos inline de `.normalize("NFD")...` por `normalizeKey` / `normalizeCompactKey`.
- [CpFlashIcons.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CpFlashIcons.jsx), [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx) e [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx): eliminadas leituras diretas repetidas de `BASE_URL` e rotas literais `/icones/*`, `/emotes/*`, `/map-icon.png` em favor de `getAssetUrl(...)`.

### 2.2 Fonte Única de Metadados de Notas ([aliasEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/aliasEngine.js))
- Adicionada propriedade `icon` em cada item de `NOTE_TYPES` (`quest: "🎯"`, `location: "📍"`, `character: "🐧"`, `lore: "📜"`, `event: "⚡"`) e fallback `"📄"` em `getNoteTypeMeta`.
- Exportada função única `getNoteTypeIcon(noteType)`.
- Removidas as funções `switch` duplicadas em [JournalWorkspace.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/JournalWorkspace.jsx) e [NoteEditorModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/journal/NoteEditorModal.jsx).

### 2.3 Catálogo Declarativo OCP em [CpFlashIcons.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CpFlashIcons.jsx)
- Substituída a cadeia imperativa extensa de condicionais `else if` em `renderCpFlashIcon` por metadados declarativos `keywords` (incluindo termos compostos como `["vermelho", "cartao"]`, `["amarelo", "cartao"]` e regras combinadas) e `matchPriority` diretamente nos objetos de `CP_FLASH_ICONS`.
- Implementados `SORTED_ICON_KEYWORD_ENTRIES` e `matchesDeclarativeKeyword(text, rule)` mantendo retrocompatibilidade integral com `LEGACY_ALIASES` e emojis UTF-8.

---

## 3. Blindagem das `engines/` e Sincronização Multi-Janela via `BroadcastChannel`

- **[combatEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/combatEngine.js)**: removidas todas as 5 funções de Web Storage (`getTargetStorageKey`, `saveStoredTargetedTokens`, `loadStoredTargetedTokens`, `saveStoredTargetedToken`, `loadStoredTargetedToken`), deixando a engine 100% pura e livre de I/O de browser.
- **[useCrossWindowSync.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCrossWindowSync.js)**:
  - Utiliza `BroadcastChannel("cp_vtt_sync_v1_${campaignId}")` com `windowIdRef` exclusivo por janela para evitar eco.
  - Realiza handshake automático na montagem: a janela destacada (`?campaignId=...&sheetId=...`) dispara `REQUEST_SYNC`, recebendo `SYNC_STATE` com `{ targetedTokenIds, targetedTokens, aoeDemarcateConfig }` da janela principal, e propaga alterações incrementais via `TARGETS_UPDATED` e `AOE_DEMARCATE_UPDATED`.
  - Executa limpeza única das chaves legadas `cp_vtt_targeted_tokens_*`, `cp_vtt_targeted_token_*` e `cp_vtt_aoe_demarcate_*` do `localStorage`.
  - Degrada com segurança caso `BroadcastChannel` esteja indisponível.
- **Estado Único de Alvos em [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx)**:
  - Consolidadas as 4 estruturas redundantes anteriores (`targetedTokens`, `targetedTokensRef`, `targetedToken`, `targetedTokenRef`) em um único estado estrutural `targetSelection = { tokenIds: [], tokensById: {} }` + uma ref `targetSelectionRef` atualizada em `useEffect` (compatível com React Compiler / `oxlint`), derivando `targetedTokens` e `targetedToken` sem estado paralelo.
  - Removidos todos os `window.addEventListener("storage", ...)` e leituras/escritas manuais de `localStorage` em [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx), [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx) e [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx).

---

## 4. Nova Camada `src/services/` e Simplificação de Hooks/Componentes

### 4.1 [combatService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/combatService.js)
Centraliza mutações e regras operacionais de combate antes replicadas no `VTTLayout.jsx`:
- `consumeCombatCosts({ character, itemsToConsume, updateCharacterResource, updateCharacter })`: ponto único para descontar MP/HP de habilidades (gatilhos e assistências de resistência) e baixar quantidade (`qty`) de itens consumíveis.
- `applyCombatEffectToTarget(...)`: aplica dano/cura/PE no alvo sincronizando Firestore (apenas PCs com `skipTokenSync`) e RTDB (`vtt_realtime/{campaignId}/tokens/{sceneId}/{tokenId}`), preservando o isolamento de matrizes NPC do Mestre.
- `spawnCharacterTokenToScene(...)` e `syncTokenUpdatesToCharacter(...)`: criação de token em cena e sincronização reversa Token → Ficha (PC).
- Orquestração de turnos no Firestore: `persistCombatState`, `startTurnCombat`, `stopTurnCombat`, `advanceCampaignTurn`, `regressCampaignTurn`, `consumeCampaignTurnMovement`, `consumeCampaignTurnAction`.

### 4.2 [rollService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/rollService.js)
- `resolveSpeakerIdentity(...)`: ponto único para resolver nome, avatar (`resolvedAvatarUrl`, `avatarMediaId`, `playerProfile`), `characterId` e `characterMediaId`, utilizado por `rollService`, `ChatSidebarPanel.jsx` e `VTTLayout.jsx`.
- `classifyRollKind(...)` e `isAttackRollMessage(...)`: priorizam o campo estrutural explícito `rollKind` (`ROLL_KINDS`) e `damageConfig`/`targetInfo.isAttackRoll`, restringindo expressões regulares apenas à retrocompatibilidade de mensagens antigas persistidas antes da Fase 3.
- `resolveDynamicRollEntry(entry, character)` e `resolveHotbarSlot(slot, character)`: resolvem referências vivas em duas camadas (`hotbar -> rollGroups -> habilidade/perícia/item/atributo` da ficha), respeitando `customIcon`.
- `buildVisibilityAudience`, `sendEmoteChatMessage`, `sendTextChatMessage`, `sendSkillPingChatMessage`, `executeChatRollMessage`: extraem toda escrita Firestore de `useChatRolls.js`, mantendo [useChatRolls.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useChatRolls.js) como hook fino de assinatura em tempo real + bindings de contexto.

### 4.3 [journalService.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/services/journalService.js)
- Concentra `buildJournalPermissions`, `canUserEditJournalNote`, `canUserEditJournalFolder`, `filterAccessibleJournalItems`, `createJournalNote`, `updateJournalNote`, `updateJournalNodePosition`, `cloneJournalNoteToTarget`, `shareJournalNoteWithTarget`, `revokeJournalNoteAccess`, `softDeleteJournalNote`, `createJournalFolder` e `softDeleteJournalFolder`.
- [useJournalNotes.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useJournalNotes.js) foi reduzido a listeners `onSnapshot` (`notes` e `folders`), filtragem reativa e delegação direta ao serviço.

---

## 5. Metadado Explícito `rollKind` e Atalhos Dinâmicos (`rollGroups`, `hotbar` e Teclas `1–9`)

- Em [CharacterSheetModal.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/sheets/CharacterSheetModal.jsx) e [useCharacters.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/hooks/useCharacters.js):
  - Atalhos fixados via `pinToRollGroup` (habilidades, perícias, itens e atributos) passam a gravar `sourceType` (`"ability" | "skill" | "item" | "attribute" | "custom"`), `sourceId`, `rollKind`, `customIcon`, `aoe`, `range` e `trigger`.
  - Cards da aba **Rolagens & Ações** resolvem dinamicamente seus dados via `resolveDynamicRollEntry(r, character)`, exibindo também o botão `🎯` de Demarcar Área diretamente nos atalhos de habilidades com `aoe.type !== "single"`.
  - Corrigido o bug em que `CharacterSheetModal.jsx` e `QuickActionsHotbar.jsx` enviavam `rollKind: "attack"` fixo para qualquer rolagem de `rollGroups`/hotbar (inclusive Iniciativa e testes de perícia).
  - Edição manual do ícone de uma rolagem marca `customIcon: true`, preservando o ícone customizado mesmo quando a entidade fonte é atualizada.
- Em [QuickActionsHotbar.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/QuickActionsHotbar.jsx):
  - Os 9 slots utilizam `resolveHotbarSlot(slot, character)` em tempo real e exibem índice `1..9`.
  - Listener de teclado (`1–9` para acionar slot e `Escape` para fechar) ativo **apenas enquanto a barra de ações rápidas está aberta** e fora de campos editáveis (`INPUT`/`TEXTAREA`/`SELECT`/`isContentEditable`), evitando conflito com as teclas `1/2/3` exclusivas da ferramenta régua em [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx).
- Em [ChatSidebarPanel.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/chat/ChatSidebarPanel.jsx):
  - Identidade delegada para `resolveSpeakerIdentity`, detecção de ataque delegada para `isAttackRollMessage`, e `/r`, dados rápidos (`1dX`) e `skill_ping` emitindo `rollKind` explícito.

---

## 6. Base Estrutural do Modo de Turno (`combatState`)

- **Schema normalizado em [combatEngine.js](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/engines/combatEngine.js)**:
  - `METERS_PER_CELL = 1.5`, `DEFAULT_MOVEMENT_BUDGET_METERS = 9`.
  - `DEFAULT_COMBAT_STATE = { active: false, round: 1, activeTurnIndex: 0, lockMovementOutsideTurn: true, lockActionsOutsideTurn: true, turnOrder: [] }`.
  - Cada item de `turnOrder` normaliza `{ combatantId, tokenId, characterId, ownerId, name, initiative, movementBudgetMeters, movementUsedMeters, actionsMax, actionsRemaining, reactionsMax, reactionsRemaining }`.
- **Seletores e transições puras**:
  - `normalizeCombatant`, `normalizeCombatState`, `getActiveCombatant`, `findCombatantByActor`, `isActorTurn`, `computeMoveDistanceMeters`, `evaluateActorMove`, `canActorMove`, `evaluateActorAct`, `canActorAct`.
  - `createCombatantEntry`, `sortTurnOrder`, `advanceTurnInState`, `regressTurnInState`, `consumeMovementInState`, `consumeActionInState`.
- **Integração na Mesa**:
  - [CampaignContext.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/contexts/CampaignContext.jsx): inicializa `combatState: DEFAULT_COMBAT_STATE` na criação de campanha, normaliza `campaign.combatState` na leitura em tempo real e expõe `{ combatState, updateCombatState }` no contexto.
  - [BoardViewport.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/canvas/BoardViewport.jsx): ao iniciar arraste e ao soltar token na camada `"tokens"` com `combatState?.active`, calcula distância real em metros (`computeMoveDistanceMeters`) e valida `evaluateActorMove`; se negado para jogador, impede a movimentação no RTDB e exibe aviso pontual de bloqueio; quando permitido, dispara `onConsumeTurnMovement`.
  - [VTTLayout.jsx](file:///c:/Users/erick/OneDrive%20-%20e-Digital%20Fullcommerce/.Downloads/erick%20-%20pessoal/BibliotecaKotlin/ClubPenguinVTT/src/components/layout/VTTLayout.jsx):
    - Valida ações em `handleExecuteSheetRoll` via `evaluateActorAct`, bloqueando ações fora do turno ou sem orçamento disponível (`actionBlockNotice`) e contabilizando consumo de ação/reação via `consumeCampaignTurnAction` apenas no cliente do Mestre real (`isRealGM`), respeitando integralmente o `firestore.rules` (onde somente o GM altera `campaigns/{campaignId}.combatState`).
    - Renderiza gatilho `⚔️ Turnos` para o GM iniciar o combate a partir dos tokens em cena e, durante `combatState.active`, barra compacta de rodada/turno ativo/metros restantes + controles `◀`, `▶`, `■`.

---

## 7. Validação Final Executada Após Conclusão da Fase 3

- **Varredura estática em `src/`**: confirmada ausência de chamadas legadas a `saveStoredTargetedTokens`/`loadStoredTargetedTokens`/`getTargetStorageKey`, remoção de escritas diretas de alvo/AoE em `localStorage` fora da limpeza única em `useCrossWindowSync.js`, ausência de `import.meta.env.BASE_URL` fora de `stringUtils.js` e ausência de rotas hardcoded `/icones/` ou `/map-icon.png` em JSX.
- **Lint (`npm run lint` / `oxlint`)**: executado após a edição final — **0 erros** e redução para **10 warnings** pré-existentes (`50 files`, `104 rules`, `537ms`), sem nenhum warning nos arquivos criados ou refatorados na Fase 3.
- **Build (`npm run build` / `vite build`)**: executado após a edição final — build concluído com sucesso (`84 modules transformed`, `built in 941ms`, saída em `dist/index.html` `0.79 kB`, `dist/assets/index-Dz-EzhxH.css` `27.20 kB`, `dist/assets/index-BWZ-OC3x.js` `1,376.94 kB`).
- **Publicação / Git**: **nenhum `firebase deploy` e nenhum `git commit` foram executados**, conforme regras do usuário.

---

## Fronteira Fase 3 → Fase 4 (Próximos Passos Planejados)

1. Revisão e eventual autorização explícita do usuário para `firebase deploy --only firestore:rules,database` caso deseje publicar as Security Rules pendentes desde a Fase 2.
2. **Fase 4**: camada de UI padronizada (`src/components/ui/`), formalização da escala `--z-*` no CSS e ajuste das regras CSS globais subordinadas aos estilos inline dos modais/componentes.

---

# VALIDAÇÃO PÓS-FASE 3: Conferência do Que Foi Feito (Fases 1–3) vs. Este Registro

> [!IMPORTANT]
> **Natureza e critério desta seção**
> - Registro **adicional** de validação. As seções das Fases 0–3 acima foram preservadas como escritas. Onde houver divergência, **esta seção descreve o estado real do código** em 2026-11-13.
> - **Critério de inclusão**: só entram divergências e defeitos **no que já foi feito** (código das Fases 1–3 e o que este registro afirma ter sido feito).
> - **Foi excluído** todo item já identificado em [avaliacao_arquitetura_codigo.md](avaliacao_arquitetura_codigo.md), já planejado para as Fases 4 e 5, já previsto como escopo futuro nas [DIRETRIZES_ARQUITETURA.md](DIRETRIZES_ARQUITETURA.md) ou que está conforme a especificação aprovada. Os itens descartados e o motivo de cada um estão na Seção 5, para rastreabilidade.

## 1. Escopo, Método e Verificações

- **Data**: 2026-11-13. Base de comparação: *working tree* atual vs. `git diff HEAD` (commit `711451e`).
- **Método**: cada afirmação concreta das Fases 1, 2 e 3 (funções, campos, chaves de storage, caminhos RTDB, regras, números de linha e validações) foi confrontada com o código.
  - Foram 6 frentes de verificação paralelas, cobrindo Fase 1 (Tópicos 1–3 e 7), Fase 1 (Tópicos 4–6) + Fase 2 A.1, Fase 2 B.1–B.4, Fase 2 B.5, Fase 3 (utils/engines/sync/turno) e Fase 3 (services/rollKind/hotbar).
  - Depois, cada achado foi confrontado com a auditoria, as Diretrizes e os planos das Fases 4 e 5.
  - Os itens marcados com ✔ foram conferidos manualmente no código.
- **Nenhum arquivo de código, regra ou configuração foi alterado nesta validação.**

| Verificação reexecutada | Resultado | Bate com o registro? |
| :--- | :--- | :---: |
| `npm run lint` (`oxlint`) | 0 erros, 10 warnings | ✅ |
| `vite build` (saída em diretório temporário, sem tocar `dist/`) | Concluído (aviso de *chunk* > 500 kB) | ✅ |
| `JSON.parse(database.rules.json)` | JSON válido | ✅ |
| "Nenhum warning nos arquivos da Fase 3" (L835) | Há warnings em arquivos modificados pela fase: `SavingThrowModal.jsx:23`, `CampaignContext.jsx:653`, `VTTLayout.jsx:227`, `BoardViewport.jsx:432,458,724,785`. A maioria é anterior à fase. | ⚠️ |

**Veredito**: a grande maioria do que as Fases 1–3 registram está implementada (parte foi movida depois para `services/`, o que é legítimo). As divergências reais estão nas Seções 3 e 4.

---

## 2. Decisões do Usuário Registradas Nesta Validação

| # | Decisão | Efeito sobre o registrado / código atual |
| :-: | :--- | :--- |
| **D-1** | **Nenhum `git commit` e nenhum `firebase deploy` (incluindo Security Rules) até a conclusão de toda a refatoração.** | Rules permanecem apenas locais. |
| **D-2** | **Exclusão de pasta: os itens internos vão para a pasta pai** (não para a raiz). As **subpastas** também devem ir inteiras para a pasta pai, mantendo a hierarquia, mas isso será feito **no futuro**. | Substitui a opção "(b) mover os itens internos para a raiz" do Princípio 4 das Diretrizes e da Fase 1. O código já move os itens para o pai (`useCharacters.js:529-546`; `journalService.js:479-503`), mas os **textos dos modais** ainda dizem "mover para a raiz" (`CharactersSidebarList.jsx`, `JournalWorkspace.jsx`) e as Diretrizes também. Hoje as subpastas são ocultadas e o conteúdo delas vai para o pai; a preservação das subpastas é escopo futuro e **não é tratada como defeito**. |
| **D-3** | **Cada jogador só pode excluir (Soft Delete) o que é seu. O Mestre pode excluir tudo e é o único que apaga mensagens do chat.** | O código está conforme em fichas (`deleteCharacter`, dono ou GM: `useCharacters.js:693`), pastas de fichas (`useCharacters.js:513`), notas (`softDeleteJournalNote`, dono ou GM: `journalService.js:373`) e mensagens (botão só para o GM em `ChatSidebarPanel.jsx`; rule de `update` em `messages` só do GM em `firestore.rules:79`). Divergências: **V-22** (pastas do diário) e o botão ✕ de ficha visível para quem não é dono (ver V-16). |
| **D-4** | **Especificação do Modo de Turno**: registro **temporário** das ações tomadas por cada jogador, **apagado na virada de RODADA** (não ao fim do turno do jogador). Uma rodada termina quando todos já agiram uma vez, e **a virada de rodada exige confirmação do Mestre**. | Complementa a Seção 5.3 das Diretrizes (escopo futuro). A base atual da Fase 3 diverge dessa especificação: `advanceTurnInState` zera o orçamento do próximo combatente a cada turno e incrementa `round` automaticamente ao dar a volta, sem confirmação (`combatEngine.js:~824-829`). Deve ser adequado quando o Modo de Turno for implementado. **Não é tratado como bug desta validação.** |

---

## 3. Errata: Afirmações do Registro (e Diretrizes) que Não Correspondem ao Código

| Ref. | O que foi registrado | Estado real |
| :--- | :--- | :--- |
| Fase 0 §6.2.H e §7; Diretrizes Princípio 2 e §3.1.H; auditoria §9.2 | `mediaService.js` fragmenta mídias > 700 KB em `media/{mediaId}/chunks/{index}` (`isChunked`, `chunkCount`). | **Não existe fragmentação em chunks** em `src/`, nem no `HEAD`. Cada mídia é um único documento; a rule exige `sizeBytes < 800000`. A regra `media/{mediaId}/chunks/{chunkIndex}` (`firestore.rules:126-134`) não é usada por nenhum código. ✔ |
| Fase 1, L301 ("carimbo universal") | `campaignId` em toda criação/atualização. | Presente em todos os *creates* e *updates* principais listados. Ausente em updates parciais e *soft deletes*: `deleteScene`, `activateSceneForTable`, `updateCharacter`, `deleteCharacter`, `deleteFolder`, `updateJournalNodePosition`, share/revoke, `deleteEntry`, `updateMessageRollData`, `deleteMessage`, `moveTokenRealtime` e `updateTextItem`. Os documentos já estão carimbados, então hoje é inofensivo. |
| Fase 1 Tópicos 4 e 6 | `createFolder` usa `buildPermissionsForScope`; `canEditFolder` no hook de diários. | O código foi movido para `journalService` (`createJournalFolder`, `buildJournalPermissions`). `canEditFolder` virou `canUserEditJournalFolder`, interno ao serviço e não exportado pelo hook. |
| Fase 1 Tópico 5 | Aliases de peixe em L209–212; `renderCpFlashIcon` consulta diretamente o catálogo. | Os aliases estão em `CpFlashIcons.jsx:218-221`. O ramo de objeto faz *fallback* `icon \|\| name \|\| title`. Item sem ícone com "peixe" no nome **ainda vira `fluffy_fish` em runtime**, agora por `keywords` declarativas (`CpFlashIcons.jsx:115`), não por hack. |
| Fase 1 Tópico 6 | Exclusão de pasta do diário trata cards e depois pastas. | Ordem invertida: primeiro as pastas, depois os cards (`journalService.js:425-507`). |
| Fase 2 B.4, L652 | `applyCombatEffectToTarget` atualiza `hpCurrent`/`hpMax` e `mpCurrent`/`mpMax`. | Grava **só o valor atual**; o máximo é apenas lido. |
| Fase 2 B.5 vs. especificação das Diretrizes §8.1 (que a Fase 2 deveria implementar) | `delete` restrito ao GM em `characters`, `folders` e `notes`; `update` de `messages` liberado a autenticados. | `characters`: o dono pode fazer *hard delete* (`firestore.rules:65-66`). `notes`: idem (`:99-100`). `folders`: `delete` liberado para dono, `editableBy` e pastas `party` (`:110-116`). `messages`: `update` só do GM (`:79`), o que endurece o ponto de Fase 0 §9 #3 e está conforme a D-3. A UI nunca usa *hard delete*, mas as rules de `characters`/`notes`/`folders` não restringem a alteração de `isDeleted` ao dono ou GM, como exige a D-3. |
| Fase 2 B.5, L673 | `media/chunks` com leitura e escrita controladas pelo Mestre ou pelo `uploadedBy` do documento pai. | `read` e `create` estão liberados a qualquer autenticado (`firestore.rules:127-128`), conforme a especificação das Diretrizes §8.1. Só `update`/`delete` são restritos. |
| Fase 2 B.5 | `canSeeResource` conforme Diretrizes §8.1 (com ramo `senderId`). | Ramo `senderId` removido; adicionado `scope == 'party'` para todas as coleções (`firestore.rules:22-31`). Não afeta mensagens, porque `visibleTo` sempre inclui o remetente. |
| Fase 3 §2.3, L760 | "Retrocompatibilidade integral" do catálogo de ícones. | Num teste com 291 entradas, 7 resultados mudaram, todos correções: "flecha"/"machado" iam para *teapot* e agora vão para *bow*/*axe*; as gemas iam para *campfire*/*snowball* e agora vão para *firegem*/*snowgem*. |
| Fase 3 §3, L769–770 | Só a janela destacada envia `REQUEST_SYNC`; limpeza "única" das chaves legadas. | Toda janela envia `REQUEST_SYNC` ao montar (`useCrossWindowSync.js:138`). A limpeza roda a cada montagem ou troca de campanha e não remove as chaves com sufixo `_default`. |
| Fase 3 §4.1 | Orquestração de turnos via `persistCombatState`. | `persistCombatState` só é chamado por `CampaignContext.updateCombatState`, que não é usado em lugar nenhum. O `VTTLayout` chama os serviços de turno direto. |
| Fase 3 §4.2, L788 | `resolveSpeakerIdentity` é o ponto único de identidade. | Parcial: ainda há resolução manual em `VTTLayout.jsx:230-234` (`currentDisplayName`, usado como `senderName` de reserva) e em `useBoardInteractive.js:222` (`getAuthorName` ignora `myPlayerProfile`). |
| Fase 3 §4.2, L789 | Regex de ataque restrita a mensagens legadas. | O *fallback* vale para qualquer mensagem sem `rollKind` válido, inclusive novas. O ramo `hasTarget && /d20/ → ATTACK` (`rollService.js:128`) é novo. Ver V-03. |
| Fase 3 §4.2, L791 | `useChatRolls.js` reduzido a hook fino, sem escrita direta. | **Ainda grava no Firestore**: `updateDoc` em `updateMessageRollData` e `deleteMessage` (`useChatRolls.js:94-114`). ✔ |
| Fase 3 §5, L804 e L810 | `/r`, dados rápidos e hotbar emitem `rollKind` explícito. | O `"attack"` fixo foi removido ✅. Porém `ROLL_KINDS.CUSTOM` e `ROLL_KINDS.SAVE` **não existem** (`combatEngine.js:96-105`) e valem `undefined`. ✔ Ver V-03. |
| Fase 3 §5, L808 | Teclado da hotbar "evitando conflito com as teclas 1/2/3 da régua". | O conflito persiste. ✔ Ver V-10. |
| Fase 3 §6, L825 e L827 | O movimento permitido dispara `onConsumeTurnMovement`; o cliente do Mestre real contabiliza ação/reação via `consumeCampaignTurnAction`. | Para jogador a prop é `null` (`VTTLayout.jsx:953`), então o movimento dele não é descontado. O desconto de ação nunca executa: `evaluateActorAct` devolve `budgetField: null` quando `isGM`, e a chamada exige `isRealGM && budgetField` (`combatEngine.js:716-724`; `VTTLayout.jsx:320-328`). ✔ **Registrado apenas como divergência de texto**: o mecanismo completo do Modo de Turno é escopo futuro (Diretrizes §5.3) e seguirá a decisão D-4. |
| Diretrizes §8.1 (L777) | E-mail do GM nas rules de exemplo. | O código e as rules usam o e-mail atual de `authorizedUsers.js`; as Diretrizes mantêm o antigo. |

---

## 4. Defeitos no Que Foi Feito (Não Previstos em Nenhum Documento)

Legenda: ✔ = conferido manualmente. Todos com **status Pendente** na data desta validação.

> [!NOTE]
> O status atualizado de cada item (Corrigido / Adiado / Descartado) está na seção **FASE 3.1**, ao final deste arquivo. As tabelas abaixo foram preservadas como escritas na validação.

### 4.1 Severidade Alta

| ID | Fase de origem | Onde | Defeito e cenário |
| :---: | :---: | :--- | :--- |
| **V-01** ✔ | Fase 1 (Tópico 3) | `CampaignContext.jsx:578-594` (`assignGM`) | Monta `players` a partir de `campaign.players`, o objeto enriquecido cujo `photoURL` já é a DataURL resolvida, e grava o mapa inteiro no Firestore. Trocar o GM grava Base64 de todos os jogadores em `campaigns/{id}`; no snapshot seguinte cada cliente refaz o upload e gera mídia duplicada. Contradiz o Tópico 3. **Correção**: usar `campaignData.players`. |
| **V-02** ✔ | Fase 1 (Tópico 3) | `PlayerProfileModal.jsx:15-17` + `CampaignContext.jsx:455-457` | O estado inicial `photoURL` vem do perfil enriquecido (Base64). (a) Renomear e salvar reenvia a DataURL, criando **um novo doc em `media/` a cada save**. (b) Se o avatar ainda não estava resolvido ao abrir o modal, salvar envia `photoURL: null` e **zera `avatarMediaId`**. **Correção**: separar a foto atual (`avatarMediaId`) da foto nova, que só existe quando o usuário escolhe um arquivo. |
| **V-03** ✔ | Fase 3 (§5) | `ChatSidebarPanel.jsx:171,196`; `VTTLayout.jsx:599`; `QuickActionsHotbar.jsx:67`; `CharacterSheetModal.jsx:3878`; `rollService.js:128` | `ROLL_KINDS.CUSTOM` e `ROLL_KINDS.SAVE` não existem. `/r 1d20+5` ou dado rápido d20 **com alvo selecionado** cai no ramo `hasTarget && d20` e é classificado como **ATAQUE contra a Defesa**. O `/r` da dock, sem alvos, vira CHECK, o que é inconsistente. Com `SAVE` indefinido, o rótulo "Resistência" nunca aparece. |
| **V-04** ✔ | Fase 2 (B.4) / Fase 3 (§4.1) | `combatService.js:123-126` | `boardTokens.find(t => t.id === targetTokenId \|\| t.characterId === targetCharId)` devolve o primeiro que casar com qualquer condição. Com vários tokens do mesmo NPC, o dano ou a cura pode cair no token errado. Viola o Princípio 6 ("múltiplos inimigos idênticos... sem alterar os demais tokens"). **Correção**: buscar primeiro por `id`. |
| **V-05** | Fase 3 (§4.1) | `combatService.js:69-73` (`consumeCombatCosts`), chamado em `VTTLayout.jsx:396,485` | Desconta MP/HP com `updateCharacterResource` também para fichas-matriz de NPC/GM: um goblin que usa habilidade gasta MP da **ficha-matriz**, não do token. Viola o Princípio 6. |

### 4.2 Severidade Média

| ID | Fase de origem | Onde | Defeito e cenário |
| :---: | :---: | :--- | :--- |
| **V-06** ✔ | Fase 2 (B.1) | `useBoardInteractive.js:63-84` | A migração única de desenhos (`fog/{sceneId}/drawings` → `drawings/{sceneId}`) marca a cena como migrada **antes** de concluir o trabalho assíncrono, e o cleanup seta `cancelled = true`. Com `<StrictMode>` (`main.jsx:7`) **nunca roda em dev**. Em produção, uma troca rápida de cena ou de `isRealGM` durante o `await` aborta a migração sem nova tentativa na sessão. |
| **V-07** | Fase 1 (Tópico 4) | `migrationService.js:83-94, 160-173` | As pastas legadas copiadas para `folders` **perdem `editableBy`** (e também `isFolder`/`title`). Pastas de diário `party` (antes `editableBy: ["ALL"]`) deixam de ser editáveis por jogadores não-donos (`journalService.js:55-62`); o mesmo vale para edição concedida em pastas de personagem. |
| **V-08** | Fase 3 (§4.2) | `ChatSidebarPanel.jsx:174,183,199`; `VTTLayout.jsx:602,615,637`; `rollService.js:37-40,65-68` | Os chamadores passam `photoURL` de tela (DataURL resolvida) como `senderPhotoURL`, em vez do valor calculado por `resolveSpeakerIdentity`. Resultado: **Base64 gravado em cada mensagem**. A integração do serviço da Fase 3 não foi concluída. |
| **V-09** | Fase 3 (§5) | `CharacterSheetModal.jsx:798-805, 854-884`; `QuickActionsHotbar.jsx:129-154` | (a) `handleDeleteRollGroup` não limpa os slots da hotbar, e o slot órfão continua rolando a cópia antiga da fórmula. (b) `handleAssignRollToHotbar` e `handleAssignRoll` duplicam a cópia de fórmula/custo com padrões divergentes. (c) `isLinkedMissing` é calculado e nunca exibido. (d) `rollGroups` fixados antes da Fase 3 (sem `sourceType`/`sourceId`) não foram migrados e continuam como cópias por valor. O vínculo dinâmico da Fase 3 só vale para atalhos novos. |
| **V-10** ✔ | Fase 3 (§5) | `QuickActionsHotbar.jsx:98-127`; `BoardViewport.jsx:539-577` | `e.stopPropagation()` não isola listeners no mesmo `window`. Com a hotbar aberta e a régua ativa, as teclas 1/2/3 acionam o slot **e** mudam a forma da régua. Esc fecha a hotbar e cancela a mira ao mesmo tempo. |
| **V-11** | Fase 3 (§4.2 / §5) | `CharacterSheetModal.jsx:818`; `rollService.js:115`; `ChatSidebarPanel.jsx:565` | Rolagem personalizada só de acerto herda `effectType: "damage"` e é classificada como DAMAGE. `skill_ping` de cura sem acerto sai com `rollKind: DAMAGE`. `sk.rollKind` nunca existe no `skillData`. |
| **V-12** | Fase 2 (B.4) + rules | `combatService.js:308` vs. `database.rules.json:9` | Quem está em `editableBy` (não é dono) e faz spawn grava `ownerId = char.ownerId`. A rule de criação exige `ownerId === auth.uid`, então a escrita é negada e o erro não é tratado. |
| **V-13** | Fase 2 (B.5) | `useCharacters.js:99`; `useJournalNotes.js:88`; `useChatRolls.js:52`; `useScenes.js:68`; `useCompendium.js:45`; `CampaignContext.jsx:101-121` | Os listeners passaram a depender do objeto `campaign`, recriado a cada snapshot da campanha ou mudança de avatares. Cada atualização de `combatState`/`players` derruba e reabre 7 listeners (leituras extras e *flicker*). **Correção**: depender de `Boolean(campaign)` e dos campos realmente usados. |

### 4.3 Severidade Baixa

| ID | Fase de origem | Onde | Defeito |
| :---: | :---: | :--- | :--- |
| **V-14** | Fase 2 (B.4) | `combatService.js:169-214` | PC com mais de um token na cena ativa: o efeito de combate atualiza a ficha com `skipTokenSync` e só o token atingido; os demais tokens do mesmo PC ficam defasados. |
| **V-15** | Fase 1 (Tópico 3) | `CampaignContext.jsx:278-309`; `AuthContext.jsx:123-129` | Avatar pendente: o callback assíncrono do `onSnapshot` pode rodar duas vezes durante o upload (duplicação). Se o upload falha, `cp_pending_avatar_dataurl` não é limpo e é retentado a cada snapshot. |
| **V-16** | Fase 2 (B.3) | `CharactersSidebarList.jsx:40, 375-386, 916`; `useCharacters.js:693` | O registro afirma que o arraste foi restringido, mas `CharacterRow` continua sempre `draggable` (só o hook bloqueia). O botão ✕ de ficha aparece para quem está em `editableBy`, mas `deleteCharacter` (corretamente, pela D-3) exige dono, então o clique falha sem aviso. O `canEdit` de pasta é recalculado inline em vez de usar `canEditFolder`, e a linha 916 ignora `editableBy`. |
| **V-17** | Fase 2 (B.3) | `useRealtimeTokens.js:135-141`; `combatService.js:155-160` | Um jogador pode passar `isGmToken: true`/`characterType: "npc"` em `addToken`, desligando o sync daquele token. `applyCombatEffectToTarget` não considera `liveToken.isGmToken`, ao contrário de `syncTokenUpdatesToCharacter`. |
| **V-18** | Fase 2 (B.3) | `journalService.js:189` | Jogador pode alternar `scope` entre `party` e `player` em `updateJournalNote` enquanto `visibleTo` é removido do payload, deixando `scope` inconsistente com `visibleTo`. |
| **V-19** | Fase 3 (§5) | `CharacterSheetModal.jsx:478`; `rollService.js:302` | Atributo fixado em grupo de rolagem recebe o ícone "sword" em vez de "clover". |
| **V-20** | Fase 2 (B.5) | `database.rules.json:9,15,21,28`; `firestore.rules:14-20`; `CampaignContext.jsx:149` | O RTDB reconhece o GM **só pelo e-mail**; o Firestore aceita e-mail ou `gmId`; o cliente usa `gmId`. Um GM definido via `gmId` (`assignGM`) não consegue editar a névoa, criar tokens em outras camadas ou de outro dono, nem apagar desenhos alheios. |
| **V-21** | Fase 1 + Fase 2 (rules) | `CampaignContext.jsx:316-353`; `firestore.rules:37-41` | Se o doc da campanha ainda não tem `campaignId`/`authorizedUsers`, o sync do jogador inclui esses campos no mesmo `updateDoc` de `players.{uid}`. A rule (que só permite `players`/`updatedAt`) nega o update inteiro em silêncio, e o jogador não é registrado até o GM fazer o backfill. Transitório. |
| **V-22** ✔ | Fase 2 (B.3) | `journalService.js:55-62` (`canUserEditJournalFolder`), usado em `softDeleteJournalFolder` (`journalService.js:~458`) | A permissão de excluir pasta do diário aceita `editableBy`, e pastas `party` são criadas com `editableBy: ["ALL"]` (`journalService.js:33`). Assim, **qualquer jogador exclui pastas do Grupo criadas por outro**, contrariando a D-3. Antes da Fase 2 não havia checagem nenhuma; a checagem adicionada não restringe ao dono. Fichas e notas usam corretamente "dono ou GM". |

---

## 5. Itens Avaliados e Descartados (Já Previstos ou Conforme Especificação)

| Item observado no código | Motivo do descarte |
| :--- | :--- |
| Modo de Turno: ação não descontada, movimento de jogador não descontado, arraste múltiplo grava só o último consumo, casamento por `characterId`, combate iniciado sem tokens, `actionsMax = 0` vira 1, regressão de turno sem devolver orçamento | Mecanismo completo é **escopo futuro** (Diretrizes §5.3, "Arquitetura do Futuro Modo de Turno"); a Fase 3 previa só estrutura e seletores. Especificação definida na **D-4**. Divergência de texto registrada na Errata. |
| `startTurnCombat` lê `boardSyncRef.current.tokens` | `boardSyncRef` será eliminado na Fase 5 (`BoardTokensContext`, auditoria §4.5). |
| Exclusão de pasta do diário casa por caminho e atinge outros escopos; escritas sequenciais sem `writeBatch`; itens órfãos; ausência de proteção contra ciclos | Modelo por caminho e `for...of` sem `writeBatch` já identificados na auditoria §3.3.1. Unificação de pastas prevista no `useFolders.js` (Registro Fase 0 §5.4). |
| Subpastas são ocultadas e o conteúdo delas vai para a pasta pai, em vez de as subpastas serem movidas inteiras | Escopo futuro por decisão do usuário (D-2). |
| Leitura de `campaigns`, `media` e `chunks` liberada a qualquer autenticado; leitura de `tokens` no RTDB liberada a autenticados | Conforme especificação aprovada nas Diretrizes §8.1 e §8.2. |
| `rollData` de mensagens pode ser forjado pelo cliente | Consequência do Princípio 1 (lógica no cliente, plano Spark). |
| `switchCampaign` sem uso e sem reset de estado | Multi-campanha é preparação (Princípio 3), sem seleção de campanha prevista na UI. |
| `deleteMedia` sem chamadores; `getMediaDataUrl` não filtra `isDeleted` | Consequência do Princípio 4 (mídia preservada para restauração). |
| Hooks acessando o SDK Firebase direto (`useCharacters`, `useScenes`, `useCompendium`, `useFogOfWar`, `useRealtimeTokens`, `CampaignContext`) | Já identificado na auditoria §6 (DIP); a Fase 3 não afirmou tê-los migrado. |
| Exports usados só internamente nos serviços | Não é defeito; organização prevista na decomposição da Fase 5. |
| `cursor: url('/icones/...')` em `App.css:1265` ignora `BASE_URL` | Revisão de CSS prevista na Fase 4; a afirmação da Fase 3 era restrita a JSX. |
| `imageCompressor.js` usa `document` em `engines/` | Previsto em `engines/` pelas Diretrizes §2 ("via Canvas"); a regra de pureza proíbe React, Firebase SDK e `localStorage`. |
| Sync Ficha→Token não alcança tokens de outras cenas | Princípio 6 limita o sync à cena ativa. |
| Jogador em `controlledBy` altera campos do token no RTDB; `update` de `drawings` não preserva `layer` | Rules implementadas conforme o registrado na Fase 2 B.5. |
| `migrationService` faz leitura completa a cada sessão do GM; mensagens legadas `self` sem `visibleTo` | Comportamento documentado na Fase 1; caso legado improvável (`visibleTo` já era gravado). |
| Comentário desatualizado em `useFogOfWar.js:122` | Cosmético. |

---

## 6. Plano de Correção: Fase 3.1 (Antes da Fase 4)

Todos os itens com **status Pendente**. Sem commit e sem deploy (D-1).

| Bloco | Tema | Itens |
| :---: | :--- | :--- |
| **A** | Base64 fora de `media/` | V-01, V-02, V-08, V-15 |
| **B** | Combate, rolagens e sync Ficha↔Token | V-03, V-04, V-05, V-11, V-12, V-14, V-17 |
| **C** | Pastas, exclusão e permissões | Textos dos modais conforme D-2; exclusão só do próprio dono conforme D-3 (V-22, V-16, e rules restringindo `isDeleted` ao dono ou GM); V-07, V-18 |
| **D** | Atalhos, hotbar e teclado | V-09, V-10, V-19 |
| **E** | RTDB, rules locais e listeners | V-06, V-13, V-20, V-21 |
| **F** | Documentação | Corrigir a Errata (Seção 3) nas Diretrizes e no registro: chunks inexistentes, e-mail do GM, `useChatRolls`, `ROLL_KINDS`; registrar D-2, D-3 e D-4 nas Diretrizes |

**Critério de conclusão da Fase 3.1**: cada item marcado como Corrigido, Adiado (com fase de destino) ou Descartado (com justificativa); `npm run lint` sem erros; `vite build` concluído.

---

## Fronteira Validação Pós-Fase 3 → Fase 3.1

- O estado de referência do código passa a ser o descrito nesta seção.
- **Próximo passo**: executar a Fase 3.1 (Seção 6) e só depois avançar para a Fase 4 (Design System).

---

# FASE 3.1 — Correção dos Defeitos da Validação Pós-Fase 3 (V-01 a V-22), Decisões D-2/D-3 e Errata

## 1. Resumo Executivo da Fase 3.1

- **Data**: 2026-11-13.
- **Objetivo**: executar o plano da Validação Pós-Fase 3 (Seção 6): corrigir os 22 defeitos V-01 a V-22, aplicar as decisões D-2 e D-3 no código e nas rules locais, corrigir a errata de código e atualizar a documentação (Bloco F).
- **Base de comparação**: antes da primeira edição, uma cópia do *working tree* (`src/`, `firestore.rules`, `database.rules.json`, `DIRETRIZES_ARQUITETURA.md`) foi salva fora do repositório (diretório temporário da sessão). Todas as contagens de linhas desta seção são **Fase 3.1 vs. essa cópia**, e não vs. `HEAD`.
- **Sem `git commit` e sem `firebase deploy`** (D-1). As rules foram alteradas e validadas **apenas localmente**.
- **Resultado**: todos os itens V-01 a V-22 estão **Corrigidos**. As limitações remanescentes de cada correção estão na Seção 6.

### 1.1 Inventário de arquivos alterados (23 arquivos, nenhum criado)

| Arquivo | Linhas (+/−) | Itens atendidos |
| :--- | :---: | :--- |
| `src/contexts/CampaignContext.jsx` | +167 / −103 | V-01, V-02, V-15, V-20, V-21 |
| `src/components/layout/PlayerProfileModal.jsx` | +25 / −12 | V-02 |
| `src/services/rollService.js` | +170 / −24 | V-03, V-05, V-08, V-09b, V-11, V-19, errata `useChatRolls` |
| `src/components/chat/ChatSidebarPanel.jsx` | +27 / −11 | V-03, V-08, V-11 |
| `src/components/layout/VTTLayout.jsx` | +76 / −20 | V-03, V-05, V-08, V-12, V-16, errata `resolveSpeakerIdentity` |
| `src/components/layout/QuickActionsHotbar.jsx` | +35 / −55 | V-03, V-09b, V-09c, V-10 |
| `src/components/sheets/CharacterSheetModal.jsx` | +27 / −57 | V-03, V-09a, V-09b, V-09c, V-11, V-19 |
| `src/services/combatService.js` | +132 / −42 | V-04, V-05, V-12, V-14, V-17 |
| `src/hooks/useRealtimeTokens.js` | +14 / −5 | V-17 |
| `src/services/migrationService.js` | +134 / −2 | V-07, V-09d |
| `src/hooks/useBoardInteractive.js` | +21 / −13 | V-06, errata `resolveSpeakerIdentity` |
| `src/hooks/useCharacters.js` | +32 / −7 | V-13, D-3 |
| `src/hooks/useJournalNotes.js` | +10 / −4 | V-13, V-18 |
| `src/hooks/useChatRolls.js` | +18 / −26 | V-13, errata `useChatRolls` |
| `src/hooks/useScenes.js` | +8 / −3 | V-13 |
| `src/hooks/useCompendium.js` | +8 / −3 | V-13 |
| `src/hooks/useCrossWindowSync.js` | +11 / −4 | errata limpeza de chaves legadas |
| `src/services/journalService.js` | +67 / −3 | V-18, V-22, D-3 |
| `src/components/journal/JournalWorkspace.jsx` | +15 / −2 | V-22, D-2 |
| `src/components/sheets/CharactersSidebarList.jsx` | +42 / −20 | V-16, D-2 |
| `firestore.rules` | +24 / −8 | D-3 |
| `database.rules.json` | +10 / −4 | V-20 |
| `DIRETRIZES_ARQUITETURA.md` | +34 / −15 | Bloco F (errata + D-2, D-3, D-4) |

*Todos os pontos alterados no código estão marcados com comentários `Fase 3.1 (V-xx)` para rastreabilidade.*

---

## 2. Bloco A — Base64 fora de `media/`

### V-01 — `assignGM` gravava Base64 de todos os jogadores ([CampaignContext.jsx](src/contexts/CampaignContext.jsx))
- **Antes**: montava `players` a partir de `campaign.players` (objeto enriquecido, `photoURL` = DataURL resolvida) e regravava o mapa inteiro.
- **Agora**: grava apenas `players.{uid}.role` por caminho pontilhado, iterando `campaignData.players` (dados brutos do Firestore). Nenhum outro campo de jogador é regravado. A função passou a exigir `campaignData` e `targetUid`.
- Também espelha o novo `gmId` no RTDB (ver V-20).

### V-02 — Perfil do jogador reenviava a foto atual ou zerava o avatar ([PlayerProfileModal.jsx](src/components/layout/PlayerProfileModal.jsx) + `updatePlayerProfile`)
- **Modal**: o estado `photoURL` (inicializado com a DataURL enriquecida) foi substituído por `newPhotoDataUrl`, que só existe quando o usuário escolhe um arquivo. A foto atual é exibida via `useMediaUrl(avatarMediaId)` ou, sem `avatarMediaId`, por uma URL HTTP externa (`currentExternalPhoto`). O salvamento tem 3 caminhos explícitos: remover (`photoURL: null, avatarMediaId: null`), foto nova (`photoURL: <DataURL nova>`) ou **só renomear** (`{ displayName }`, sem campo de foto).
- **`updatePlayerProfile`**: parte sempre de `campaignData.players[uid]` (bruto). Só altera `avatarMediaId`/`photoURL` quando há ação explícita (remover, DataURL nova, URL HTTP ou `avatarMediaId` informado). Renomear grava apenas `displayName` + `updatedAt`. Se o upload da foto nova falhar, lança erro (`"Não foi possível enviar a nova foto."`), exibido pelo modal, em vez de gravar estado inconsistente.

### V-08 — Base64 gravado em cada mensagem ([rollService.js](src/services/rollService.js), [ChatSidebarPanel.jsx](src/components/chat/ChatSidebarPanel.jsx), [VTTLayout.jsx](src/components/layout/VTTLayout.jsx))
- Nova função `toPersistablePhotoUrl(url)`: só aceita URL HTTP(S) com menos de 2000 caracteres; qualquer outro valor (inclusive DataURL) vira `null`.
- `resolveSpeakerIdentity` agora separa:
  - `photoURL`: para exibição imediata na UI (pode ser DataURL);
  - `senderPhotoURL`: valor persistível (passa por `toPersistablePhotoUrl`);
  - `senderAvatarMediaId`: referência da foto do **jogador** em `media/` (só em mensagens sem personagem).
- Os 4 tipos de mensagem (`emote`, `text`, `skill_ping`, `ability_roll`) gravam `senderAvatarMediaId`.
- Chamadores corrigidos para passar `senderPhotoURL: identity.senderPhotoURL` (3 em `ChatSidebarPanel.jsx`, 3 em `VTTLayout.jsx`). Mesmo que um chamador passe uma DataURL, o serviço a descarta.
- `MessageAvatar` (chat) resolve a foto por `characterMediaId` (mensagem de personagem) ou `senderAvatarMediaId` (mensagem de jogador), com prioridade para `senderPhotoURL` quando existir.

### V-15 — Upload duplicado e retentativa infinita do avatar pendente ([CampaignContext.jsx](src/contexts/CampaignContext.jsx))
- Novos helpers no módulo: `readPendingAvatarDataUrl`, `clearPendingAvatarDataUrl` e `migrateAvatarOnce`.
- `migrateAvatarOnce` usa `avatarMigrationAttemptsRef` (um `Set` por `${campaignId}:${uid}`) e executa **no máximo uma tentativa por sessão**, mesmo que o `onSnapshot` dispare várias vezes durante o upload. No `finally`, a chave `cp_pending_avatar_dataurl` é sempre removida do `sessionStorage`; em falha, registra `console.warn` e não retenta a cada snapshot.
- Usado tanto na criação da campanha quanto na migração de `photoURL` legado com `data:`.

---

## 3. Bloco B — Combate, Rolagens e Sync Ficha↔Token

### V-03 — `ROLL_KINDS.CUSTOM`/`SAVE` inexistentes e `/r` com alvo virando ataque
- `ROLL_KINDS.CUSTOM` substituído por `ROLL_KINDS.CHECK` em `/r` e dados rápidos (`ChatSidebarPanel.jsx`, 2 pontos) e no `/r` da dock (`VTTLayout.jsx`). Rolagem livre agora é sempre teste, com ou sem alvo.
- `ROLL_KINDS.SAVE` eliminado: o rótulo "Resistência" passou a comparar com `ROLL_KINDS.SAVING_THROW` dentro do novo `buildShortcutRollParams` (usado pela aba Rolagens e pela Hotbar).
- `classifyRollKind`: removido o ramo `d20 + alvo selecionado => ATAQUE` (criado na Fase 3) e o parâmetro `hasTarget`. O fallback por rótulo ("Acerto", "Ataque", etc.) continua apenas para entradas sem `rollKind`.
- Varredura final: nenhuma referência a `ROLL_KINDS.CUSTOM` ou `ROLL_KINDS.SAVE` em `src/`.

### V-04 — Dano/cura no token errado com vários NPCs iguais ([combatService.js](src/services/combatService.js) `applyCombatEffectToTarget`)
- Com id de token no alvo, busca **somente pelo id exato** (no tabuleiro, no alvo selecionado ou no token selecionado).
- Sem id de token, só usa `characterId` se houver **um único** token daquela ficha no tabuleiro. Com vários, não escolhe nenhum.

### V-05 — Custos de NPC/GM descontados da ficha-matriz ([combatService.js](src/services/combatService.js), [VTTLayout.jsx](src/components/layout/VTTLayout.jsx), [rollService.js](src/services/rollService.js))
- Novo `isGmTemplateCharacter(character, campaign, token)`: regra única de matriz (`token.isGmToken`, `type === "npc"` ou dono = `gmId`). Reaproveitado em `applyCombatEffectToTarget`, `spawnCharacterTokenToScene` e `syncTokenUpdatesToCharacter`.
- Novo `deductActorResources(...)`:
  - **PC**: desconta na ficha (`updateCharacterResource`), e o sync Ficha→Token espelha nos tokens.
  - **Matriz GM/NPC**: desconta **apenas no token RTDB** que está agindo (`mpCurrent`/`hpCurrent`). Sem token identificável, não desconta nada; a ficha-matriz nunca é alterada.
- `consumeCombatCosts` agora soma os custos de MP/HP e chama `deductActorResources`. Novos parâmetros: `campaignId`, `campaign`, `user`, `actorToken`, `sceneId`. A baixa de itens consumíveis continua no inventário da ficha (tokens não têm inventário).
- Custo da habilidade principal: `executeChatRollMessage` passa a chamar `onDeductResource(charId, resKey, nextVal, { amount })`. Em `handleExecuteSheetRoll`, o `VTTLayout` envolve esse callback com `deductActorResources`.
- `VTTLayout` ganhou `resolveActorToken(character, preferredTokenId)`, que escolhe o token pela seguinte ordem: id preferido (no teste de resistência, `savingThrowRequest.targetTokenId`), token selecionado no tabuleiro da mesma ficha, ou token único da ficha.

### V-11 — Classificação errada de rolagens personalizadas e `skill_ping`
- Novos `effectRollKind(effectType)` e `inferAbilityRollKind({ hitFormula, effectFormula, effectType, isSkill })` no `rollService`. O ramo de habilidade de `resolveDynamicRollEntry` passou a usar `inferAbilityRollKind`, com o mesmo resultado de antes.
- **Rolagem personalizada só de acerto**: o formulário passou a gravar `effectType: null` quando não há fórmula de efeito. Para atalhos já gravados, `resolveDynamicRollEntry` ignora o `effectType: "damage"` padrão quando não há `effectFormula`, e a rolagem vira CHECK em vez de DAMAGE.
- **`skill_ping`**: removido o `sk.rollKind` (que nunca existe). Perícia (`skillData.attribute`) sem efeito vira CHECK; só efeito segue o `effectType` (cura vira HEAL).

### V-12 — Spawn negado para quem está em `editableBy` ([combatService.js](src/services/combatService.js) `spawnCharacterTokenToScene`)
- Quem não é Mestre grava `ownerId = user.uid` (exigência da rule de criação). `controlledBy` passa a incluir o Mestre, o dono da ficha e quem fez o spawn.
- `handleSpawnCharacterToken` (VTTLayout) trata a falha: `console.warn` + aviso temporário "Não foi possível colocar o token no mapa." (mesmo mecanismo do `actionBlockNotice`).

### V-14 — Outros tokens do mesmo PC ficavam defasados
- Em `applyCombatEffectToTarget`, PC (não matriz) atualiza a ficha **sem** `skipTokenSync`. O `syncCharacterToActiveSceneTokens` (useCharacters) espelha o valor em **todos** os tokens do PC na cena ativa da mesa.
- A escrita direta no token passou a ocorrer apenas para matriz GM/NPC ou para token de PC fora da cena ativa (`tokensSyncedFromSheet`).

### V-17 — Jogador podia marcar seu token como matriz ([useRealtimeTokens.js](src/hooks/useRealtimeTokens.js), [combatService.js](src/services/combatService.js))
- `addToken`: para quem não é Mestre, `isGmToken` é sempre `false` e `characterType: "npc"` vira `"pc"`.
- `applyCombatEffectToTarget` passou a considerar `liveToken.isGmToken` (via `isGmTemplateCharacter`), igual a `syncTokenUpdatesToCharacter`.

---

## 4. Bloco C — Pastas, Exclusão e Permissões (D-2, D-3)

### D-2 — Textos dos modais
- `CharactersSidebarList.jsx`: "Não, mover fichas para a raiz" → **"Não, mover fichas para a pasta pai"**.
- `JournalWorkspace.jsx`: "Não, mover cards para a raiz" → **"Não, mover cards para a pasta pai"**.
- O comportamento (mover para o pai) já existia. A preservação das subpastas continua escopo futuro (D-2).

### D-3 — Exclusão só pelo dono (UI, hooks/serviços e rules)
- **Fichas** ([useCharacters.js](src/hooks/useCharacters.js)): novos `canDeleteCharacter` e `canDeleteFolder` (Mestre ou `ownerId`), exportados pelo hook e usados em `deleteCharacter` e `deleteFolder`. Em `deleteFolder` com "excluir conteúdo", fichas de outros donos (acesso via `editableBy`) **não são ocultadas**: vão para a pasta pai.
- **Diário** ([journalService.js](src/services/journalService.js)): novos `canUserDeleteJournalNote` e `canUserDeleteJournalFolder` (Mestre ou dono; nunca `scope: "gm"` para jogador). `softDeleteJournalNote` usa o novo helper.
- **Rules** ([firestore.rules](firestore.rules)):
  - novas funções `touchesSoftDeleteFields()` (o diff toca `isDeleted`/`deletedAt`/`deletedBy`) e `isResourceOwner()`;
  - `characters`, `notes` e `folders`: o `update` de quem não é Mestre exige `(!touchesSoftDeleteFields() || isResourceOwner())`;
  - `allow delete` (exclusão física) passou a ser **somente do Mestre** nas três coleções, como especificado nas Diretrizes §8.1. Em `folders`, a antiga regra conjunta `allow update, delete` foi separada.
  - `messages` não mudou (`update`/`delete` só do Mestre, conforme D-3).

### V-22 — Qualquer jogador excluía pastas do Grupo
- `softDeleteJournalFolder`: localiza o documento da pasta-alvo (por id ou caminho). Se existir e o usuário não puder excluí-lo, **retorna sem alterar nada** (nem pastas, nem cards). Subpastas de outros donos são puladas. Pastas implícitas (sem documento, derivadas só do caminho dos cards) seguem para a etapa de cards, com permissão checada card a card.
- `JournalWorkspace.jsx`: o botão ✕ de pasta só aparece quando `canDeleteFolderNode` permite (dono ou Mestre; pasta implícita sempre).

### V-16 — Permissões na lista de fichas ([CharactersSidebarList.jsx](src/components/sheets/CharactersSidebarList.jsx), [VTTLayout.jsx](src/components/layout/VTTLayout.jsx))
- `CharacterRow`: novo `canManage` (Mestre ou dono). Arrastar (`draggable`), mover (📁) e excluir (✕) exigem `canManage`; "+Mapa" continua com `canEdit`.
- `FolderItem`: novo `canManageFolder` (Mestre ou dono) para arrastar e para o ✕. Criar dentro e renomear continuam com `canEdit`. `canEdit` de subpastas e das pastas na visão do jogador agora usa `canEditFolder` do hook (antes era calculado inline, e a visão do jogador ignorava `editableBy`).
- **Divergência adicional encontrada e corrigida**: o `VTTLayout` **não passava** `canEditCharacter` para `CharactersSidebarList` (o componente caía no fallback `ownerId`). Agora passa `canEditCharacter` e `canEditFolder` (`canEditCharacterFolder`).

### V-18 — Escopo de nota inconsistente com `visibleTo` ([journalService.js](src/services/journalService.js) `updateJournalNote`)
- Só o dono do card (ou o Mestre) pode trocar `scope`.
- Ao trocar o escopo sem `visibleTo` explícito, `visibleTo`/`editableBy` são recalculados por `buildJournalPermissions`. Na volta para `player`, os compartilhamentos individuais existentes (UIDs em `visibleTo`, exceto `"ALL"`) são preservados.
- `updateJournalNote` recebeu `campaign` (para o `gmId`); `useJournalNotes` passou a enviá-lo.

### V-07 — Pastas legadas migradas sem `editableBy` ([migrationService.js](src/services/migrationService.js))
- Novo `defaultFolderEditableBy` (espelha `createFolder` das fichas e `buildJournalPermissions` do diário).
- Cópia de pasta legada (fichas e diário) passa a gravar `isFolder: true`, `editableBy` (do documento legado ou padrão) e, no diário, `title`.
- **Reparo de pastas já migradas**: a normalização da coleção `folders` grava `editableBy` quando ausente (do documento legado em `characters`/`notes`, mapeado por id em `legacyFolderDocsById`, ou o padrão), além de `isFolder: true` e `title` (diário).

---

## 5. Blocos D e E — Atalhos, Teclado, RTDB, Rules e Listeners

### V-09 — Atalhos e Hotbar
- **(a)** `handleDeleteRollGroup` limpa os slots da Hotbar cujo `rollId` pertencia ao grupo excluído (gravados juntos no mesmo `onUpdateCharacter`).
- **(b)** Montagem única no `rollService`: `buildHotbarSlotFromRoll` (usado por `handleAssignRollToHotbar` na ficha e `handleAssignRoll` na barra rápida) e `buildShortcutRollParams` (execução na aba Rolagens e na Hotbar). Os padrões divergentes foram unificados no comportamento da ficha: `hitFormula ?? "1d20"` e `effectType` só com fórmula de efeito.
- **(c)** `isLinkedMissing` agora é exibido: ⚠️ (com tooltip "Origem removida da ficha") no card da aba Rolagens; ⚠️ no slot da Hotbar e no tooltip do slot.
- **(d)** Migração dos atalhos legados (`migrateLegacyShortcuts` + `linkLegacyRollEntry`, executados pelo Mestre em `runCampaignMigrations`): rolagens sem `sourceType` são vinculadas por nome normalizado, nesta prioridade: habilidade, perícia (`nome` ou `Perícia nome`), item, atributo (`Teste rótulo`). Sem correspondência, viram `sourceType: "custom"` (idempotente). `customIcon` vira `true` quando o ícone salvo difere do ícone da fonte. Slots da Hotbar sem `sourceType` herdam o vínculo da rolagem do grupo (`rollId`) ou são vinculados por nome.

### V-10 — Teclas 1/2/3 e Esc acionando Hotbar e tabuleiro ao mesmo tempo ([QuickActionsHotbar.jsx](src/components/layout/QuickActionsHotbar.jsx))
- O listener da barra passou para a **fase de captura** do `window` (`addEventListener(..., true)`). Quando consome a tecla (dígito de slot preenchido ou Esc), chama `stopPropagation()`, e os listeners de bolha do `BoardViewport` (régua 1/2/3, Esc da mira) não a recebem.
- Com a barra aberta, Esc fecha só a barra; um segundo Esc cancela a mira. Dígito de slot vazio continua chegando à régua.

### V-19 — Ícone de atributo fixado
- `pinToRollGroup`: o ícone padrão é `"clover"` para `sourceType: "attribute"` (antes era `"sword"`).
- `resolveDynamicRollEntry` (atributo): usa sempre `"clover"`, salvo `customIcon`. Isso também corrige atalhos já gravados com `"sword"`.

### V-06 — Migração única de desenhos não concluía ([useBoardInteractive.js](src/hooks/useBoardInteractive.js))
- A cena só entra em `migratedScenesRef` **depois do sucesso**. Novo `migratingScenesRef` evita execução concorrente.
- Removido o `cancelled` do cleanup: a migração é idempotente e não altera estado React, então roda até o fim mesmo com `<StrictMode>`, troca de cena ou de `isRealGM`. Em falha, sai do conjunto "em andamento" e pode ser retentada numa próxima montagem.

### V-13 — Listeners reabertos a cada snapshot da campanha
- Em `useCharacters`, `useJournalNotes`, `useChatRolls`, `useScenes` e `useCompendium`: o efeito dos listeners depende de `[listenerUid, campaignId, campaignReady, isRealGM]`, com `listenerUid = user?.uid` e `campaignReady = Boolean(campaign)`, e não mais do objeto `campaign`. As queries usam `listenerUid`. A alteração foi aplicada por script, que verificou que nenhuma referência a `user`/`campaign` ficou dentro dos efeitos.

### V-20 — RTDB reconhecia o Mestre só pelo e-mail ([database.rules.json](database.rules.json), [CampaignContext.jsx](src/contexts/CampaignContext.jsx))
- Novo nó `vtt_realtime/{campaignId}/meta/gmId`:
  - `.write`: e-mail do Mestre **ou** `data.val() === auth.uid` (o próprio gmId já espelhado);
  - `.validate`: `newData.isString()`.
- Em `tokens`, `fog`, `drawings` e `pings`, o teste de Mestre virou `(e-mail do Mestre || root.../meta/gmId === auth.uid)` (4 ocorrências).
- Cliente: novo efeito no `CampaignProvider` que, quando `isRealGM`, grava `meta/gmId = user.uid`; `assignGM` grava `meta/gmId = targetUid`.

### V-21 — Registro do jogador negado em silêncio ([CampaignContext.jsx](src/contexts/CampaignContext.jsx))
- O backfill da raiz da campanha (`campaignId`, `authorizedUsers`, `gmId`) passou a ser feito **somente pelo Mestre** (`isCampaignGM`), em escrita separada.
- O jogador grava apenas `players.{uid}` + `updatedAt`, o único caminho que a rule permite a ele. A ausência de `campaignId`/`authorizedUsers` deixou de disparar o sync do jogador. Falhas passam a gerar `console.warn` em vez de `catch` vazio.

---

## 6. Errata de Código, Documentação (Bloco F) e Status Consolidado

### 6.1 Errata da Validação: o que foi corrigido no código

| Item da Errata (Validação §3) | Ação na Fase 3.1 |
| :--- | :--- |
| `useChatRolls.js` ainda gravava no Firestore | **Corrigido**: novas `updateChatMessageRollData` e `softDeleteChatMessage` no `rollService`; o hook só delega. Não restam imports de `doc`/`updateDoc`/`serverTimestamp` no hook. |
| `ROLL_KINDS.CUSTOM`/`SAVE` inexistentes | **Corrigido** (V-03). |
| `resolveSpeakerIdentity` parcial | **Corrigido**: `currentDisplayName` (`VTTLayout`) e `getAuthorName` (`useBoardInteractive`, agora com `myPlayerProfile`) passam pelo serviço. |
| Limpeza de chaves legadas do `localStorage` | **Corrigido**: roda uma vez por sessão e campanha (`legacyKeysCleanedForCampaigns`) e remove também os sufixos `_default`. |
| `campaignId` ausente em updates parciais/soft deletes | **Parcial**: incluído em `deleteCharacter`, soft delete de fichas em `deleteFolder`, `softDeleteJournalNote`, soft delete de cards em `softDeleteJournalFolder`, `updateChatMessageRollData` e `softDeleteChatMessage`. Os demais (`deleteScene`, `activateSceneForTable`, `updateCharacter`, soft delete de pastas, `updateJournalNodePosition`, share/revoke, `deleteEntry`, `moveTokenRealtime`, `updateTextItem`) **não foram alterados**: os documentos já estão carimbados e a Validação classificou o caso como inofensivo. |
| Toda janela envia `REQUEST_SYNC` | **Mantido** (comportamento aceito): qualquer janela nova pede o estado atual e qualquer janela com alvos responde. Apenas o texto do registro estava impreciso. |
| `persistCombatState` só usado por `updateCombatState` (sem uso) | **Mantido**: pertence ao Modo de Turno (escopo futuro, D-4). |
| Demais itens (chunks, e-mail do GM, `applyCombatEffectToTarget` grava só o atual, ícone de peixe por `keywords`, ordem da exclusão de pastas, `canSeeResource`, `media/chunks`, catálogo de ícones) | Divergências de **texto**, sem defeito. Corrigidas nas Diretrizes (6.2) ou mantidas como estão na Errata da Validação. |

### 6.2 Documentação ([DIRETRIZES_ARQUITETURA.md](DIRETRIZES_ARQUITETURA.md))
- **Princípio 2**: "Repositório de Mídia fragmentada" passou a "Repositório de Mídia em documento único por arquivo".
- **Princípio 4**: opção (b) passou para "mover os itens internos para a **pasta pai**" (D-2), com a preservação de subpastas marcada como escopo futuro. Novo item **"Quem pode excluir" (D-3)**.
- **§2 (árvore)**: removidas as menções a chunks em `mediaService.js` e `useMediaUrl.js`.
- **§3.1.H**: reescrita sem chunks (documento único, `sizeBytes < 800000`), com nota de errata. O JSON de exemplo perdeu `isChunked`/`chunkCount` e ganhou `isDeleted`.
- **§3.1.F**: exemplo de mensagem com `senderAvatarMediaId`, `senderPhotoURL` e `characterMediaId`, mais a lista válida de `rollKind`.
- **§4**: nome do banco IndexedDB corrigido para `cpvtt_media_cache` (ressalva #1 da Fase 0).
- **§5.3**: especificação **D-4** (registro temporário de ações, limpo na virada de rodada, com confirmação do Mestre).
- **§8.1**: e-mail do Mestre corrigido para `erickteixeiractt@gmail.com`, mais nota com os pontos da versão vigente (D-3, `messages`, `canSeeResource`).
- **§8.2**: reconhecimento do Mestre via `meta/gmId`; `tokens` e `pings` descritos conforme as rules vigentes.
- **§9 (Fase 1)**: "mover itens para a raiz" passou a "pasta pai — D-2".

### 6.3 Status consolidado dos itens da Validação

| Item | Status | Observação / limitação remanescente |
| :---: | :---: | :--- |
| V-01 | Corrigido | — |
| V-02 | Corrigido | — |
| V-03 | Corrigido | Rolagem livre com alvo não avalia acerto contra a Defesa (é CHECK por definição). |
| V-04 | Corrigido | Sem id de token e com vários tokens da mesma ficha, o efeito não é aplicado em token nenhum (antes caía no primeiro). |
| V-05 | Corrigido | Matriz GM/NPC sem token identificável (janela destacada, vários tokens sem seleção) **não desconta** custo. Consumíveis continuam no inventário da ficha-matriz. |
| V-06 | Corrigido | — |
| V-07 | Corrigido | O reparo roda na próxima sessão do Mestre (`runCampaignMigrations`). |
| V-08 | Corrigido | Mensagens antigas que já gravaram Base64 permanecem no banco (não há limpeza retroativa) e continuam exibindo a foto. |
| V-09 | Corrigido (a–d) | (d) roda na próxima sessão do Mestre. O vínculo é por nome: com nomes repetidos entre tipos, vale a prioridade habilidade > perícia > item > atributo. |
| V-10 | Corrigido | — |
| V-11 | Corrigido | — |
| V-12 | Corrigido | Quem faz o spawn via `editableBy` vira dono da instância; o dono da ficha controla o token (`controlledBy`), mas não o exclui (a rule de delete exige `ownerId`). |
| V-13 | Corrigido | — |
| V-14 | Corrigido | O sync Ficha→Token alcança só a cena ativa da mesa (Princípio 6). |
| V-15 | Corrigido | Em falha de upload, a foto pendente do cadastro é descartada; o jogador pode reenviá-la pelo Perfil. |
| V-16 | Corrigido | Inclui a divergência extra (`canEditCharacter` não era passado à lista). |
| V-17 | Corrigido | — |
| V-18 | Corrigido | — |
| V-19 | Corrigido | — |
| V-20 | Corrigido (local) | Só vale após o deploy das rules (bloqueado por D-1) e após o Mestre abrir a mesa ou executar `assignGM`, que grava `meta/gmId`. |
| V-21 | Corrigido | — |
| V-22 | Corrigido | Subpastas de outros donos dentro de uma pasta excluída não são ocultadas; com o modelo por caminho do diário, continuam visíveis. A unificação de pastas segue planejada (`useFolders.js`). |
| D-2 (textos) | Corrigido | Preservação de subpastas: escopo futuro. |
| D-3 (código + rules) | Corrigido (local) | Rules sem deploy (D-1). |
| D-4 | Documentado | Implementação no Modo de Turno (escopo futuro). |
| Bloco F | Concluído | Ver 6.2. |

---

## 7. Validação Executada na Entrega da Fase 3.1

| Verificação | Resultado |
| :--- | :--- |
| `npx oxlint` | **0 erros, 10 warnings**. São os mesmos 10 avisos pré-existentes da Validação (`SavingThrowModal.jsx:23`, `CampaignContext.jsx` *only-export-components*, `VTTLayout.jsx` `Date.now`, `BoardViewport.jsx` ×4, `LoginScreen.jsx`, `ScenesManagerModal.jsx`, `AuthContext.jsx`), apenas com números de linha deslocados. Nenhum warning novo. |
| `vite build` (saída em diretório temporário, sem tocar em `dist/`) | Concluído: `84 modules transformed`, CSS `27.20 kB`, JS `1,383.56 kB` (aviso de *chunk* > 500 kB, pré-existente). |
| `JSON.parse(database.rules.json)` | JSON válido. |
| Compilação das rules nos **emuladores locais** (Firebase CLI 15.34.2, projeto `demo-cpvtt-rules`, `firebase.json` temporário fora do repositório) | `firestore.rules` → **HTTP 200** no endpoint `emulator/v1/projects/...:securityRules`. Controle negativo com uma rule propositalmente quebrada → HTTP 400 (`Error compiling rules`), o que confirma que o endpoint valida. `database.rules.json` → **HTTP 200 `{"status":"ok"}`** em `/.settings/rules.json`. |
| Varreduras estáticas | Nenhum `ROLL_KINDS.CUSTOM`/`SAVE` em `src/`. `useChatRolls.js` sem `updateDoc`. Nenhum chamador passa `photoURL` de tela como `senderPhotoURL`. |

**Não executado (registrado por fidelidade):**
- Teste manual da aplicação no navegador.
- Testes unitários de rules (`@firebase/rules-unit-testing` não está instalado). As rules foram **compiladas**, mas o comportamento de D-3/V-20 não foi exercitado com requisições autenticadas.
- Execução da `runCampaignMigrations` (V-07/V-09d) contra o banco real: ocorre na próxima sessão do Mestre.
- `git commit` e `firebase deploy` (D-1).

---

## Fronteira Fase 3.1 → Fase 4

- O estado de referência do código passa a ser o descrito nesta seção.
- **Pendências herdadas (não bloqueiam a Fase 4)**: deploy das rules (D-1, só ao fim da refatoração), testes manuais no navegador dos fluxos alterados (perfil/avatar, chat, hotbar + régua, combate com NPCs repetidos, exclusão de pastas por jogador) e Modo de Turno conforme D-4 (escopo futuro).
- **Próximo passo**: Fase 4 (Design System em `src/components/ui/`, tokens `--z-*` e CSS subordinado aos estilos inline).

---

# FASE 4 — Design System (`src/components/ui/`), Escala `--z-*` e CSS Subordinado aos Inlines

## 1. Resumo Executivo da Fase 4

- **Data**: 2026-11-13.
- **Especificação seguida**:
  - [DIRETRIZES_ARQUITETURA.md](DIRETRIZES_ARQUITETURA.md) §2 (árvore `ui/`), §7.2 (escala oficial `--z-*`) e §9 item 4 (fonte da verdade);
  - auditoria §8, "Fase 4";
  - Princípio 7 (estilos inline prevalecem; **zero regressão visual**).
- **Base de comparação**: cópia do *working tree* ao fim da Fase 3.1, salva fora do repositório antes da primeira edição. As contagens abaixo são **Fase 4 vs. essa cópia**.
- **Sem `git commit` e sem `firebase deploy`** (D-1). Nenhuma Security Rule ou serviço/hook de dados foi alterado.
- **Entregas**:
  1. 5 componentes base em `src/components/ui/` e as referências `Z_LAYERS`;
  2. adoção desses componentes nos pontos duplicados;
  3. escala `--z-*` declarada e aplicada às camadas globais;
  4. cursor da mira resolvido com `BASE_URL`;
  5. Diretrizes atualizadas.
- **Fidelidade visual comprovada**: comparação do HTML estático (`renderToStaticMarkup`) do markup original × componentes novos em **19 casos: 19 idênticos**. Ver Seção 6.

### 1.1 Inventário

**Arquivos criados (6)**

| Arquivo | Linhas | Conteúdo |
| :--- | :---: | :--- |
| `src/components/ui/WindowModal.jsx` | 84 | Overlay + painel (variantes `"light"` e `"cp"`), `zIndex` padrão `Z_LAYERS.modalBase`, portal opcional |
| `src/components/ui/CPButton.jsx` | 33 | `<button>` com `cp-btn` + variante (`gold`, `green`, `orange`, `epf`) |
| `src/components/ui/ConfirmDeleteModal.jsx` | 56 | Confirmação de exclusão de pasta (mover para a pasta pai / excluir / cancelar) |
| `src/components/ui/SavingThrowFields.jsx` | 144 | Campos de Teste de Resistência, layouts `"inline"` e `"grid"` |
| `src/components/ui/CpSpeechBubble.jsx` | 57 | Apresentação do balão de fala/emote |
| `src/constants/zLayers.js` | 18 | `Z_LAYERS` (referências `var(--z-*)` para JSX) |

**Arquivos modificados (13)**

| Arquivo | Linhas (+/−) | O que mudou |
| :--- | :---: | :--- |
| `src/index.css` | +19 / −0 | Tokens `--z-*` (§7.2) e `--cp-snowball-cursor` no `:root` |
| `src/App.css` | +10 / −9 | 8 camadas globais passam a usar tokens; cursor da mira via `var(--cp-snowball-cursor)` |
| `src/components/sheets/CharactersSidebarList.jsx` | +24 / −167 | 3 modais com `WindowModal`; exclusão de pasta com `ConfirmDeleteModal` |
| `src/components/journal/JournalWorkspace.jsx` | +38 / −89 | Exclusão de pasta com `ConfirmDeleteModal`; raiz com `Z_LAYERS.workspaceJournal` |
| `src/components/sheets/CharacterSheetModal.jsx` | +37 / −83 | 2 blocos de resistência com `SavingThrowFields`; 2 submodais com `Z_LAYERS.modalNested` |
| `src/components/compendium/CompendiumModal.jsx` | +17 / −61 | Bloco de resistência com `SavingThrowFields` (layout `"grid"`) |
| `src/components/combat/DamageRollModal.jsx` | +9 / −11 | Invólucro com `WindowModal` (`"cp"`, `Z_LAYERS.modalCombat`) |
| `src/components/combat/SavingThrowModal.jsx` | +9 / −11 | Idem |
| `src/components/canvas/TokenSpeechBubble.jsx` | +9 / −44 | Usa `CpSpeechBubble`; mantém só o controle de tempo/fade |
| `src/components/journal/NoteEditorModal.jsx` | +4 / −3 | Editor, submodal de vínculo e tooltip em portal com tokens |
| `src/components/scenes/ScenesManagerModal.jsx` | +4 / −1 | Visor de mapa: `calc(var(--z-modal-base) + 1)` |
| `src/components/layout/VTTLayout.jsx` | +10 / −1 | `--cp-snowball-cursor` (URL via `getAssetUrl`) no `.vtt-shell` |
| `DIRETRIZES_ARQUITETURA.md` | +25 / −7 | §2 (árvore), §7.2 (regras de uso) e nova §7.3 (componentes base) |

*Os pontos alterados no código estão marcados com comentários `Fase 4`.*

---

## 2. Componentes Base (`src/components/ui/`)

| Componente | Origem (markup inline substituído) | API | Onde foi adotado |
| :--- | :--- | :--- | :--- |
| **`WindowModal`** | Overlay + painel branco repetidos 4× na Árvore de Fichas e 1× no Diário; overlay `.cp-modal-overlay` + `.cp-window` dos 2 modais de combate | `variant` (`"light"`/`"cp"`), `onClose`, `zIndex`, `maxWidth`, `overlayStyle`, `panelStyle`, `portal` | `CharactersSidebarList` (criar, mover, colocar token no mapa), `ConfirmDeleteModal`, `DamageRollModal`, `SavingThrowModal` |
| **`CPButton`** | Botões `className="cp-btn cp-btn-*"` | `variant`, `className`, `type = "button"`, demais props repassadas | `ConfirmDeleteModal` |
| **`ConfirmDeleteModal`** | Modais de exclusão de pasta (Fichas e Diário), que diferiam só em z-index, largura, opacidade do overlay e sombra | `title`, `question`, `moveLabel`, `deleteLabel`, `onMove`, `onDelete`, `onCancel`, `zIndex`, `maxWidth`, `overlayBackground`, `panelShadow` | `CharactersSidebarList`, `JournalWorkspace` |
| **`SavingThrowFields`** | 3 cópias: Ficha/Novo Item, Ficha/Nova-Editar Habilidade, Compêndio | `layout`, `enabled`/`dcFormula`/`attribute`/`effectDescription` + handlers, `toggleLabel`, placeholders, `dcWidth`, `effectMinWidth` | `CharacterSheetModal` (2×), `CompendiumModal` |
| **`CpSpeechBubble`** | Apresentação do `TokenSpeechBubble` | `text`, `icon`, `isFadingOut`, `bottomOffset`, `iconSize` | `TokenSpeechBubble` (a `key` por bolha continua remontando o balão a cada fala) |

Decisões de implementação:
- Os componentes guardam os valores visuais **copiados literalmente** dos inlines. No `WindowModal` "light", até a ordem das propriedades replica o original, para o HTML ser idêntico.
- `WindowModal` **não** usa portal por padrão: os modais continuam renderizados no mesmo lugar do DOM e no mesmo contexto de empilhamento de antes. O `portal` existe como opção (Diretrizes §2: "com portal").
- O import `SAVE_ATTRIBUTES` ficou sem uso em `CharacterSheetModal.jsx` e `CompendiumModal.jsx` e foi removido.

---

## 3. Escala Oficial de Camadas (`--z-*`)

### 3.1 Declaração
- Os 10 tokens da §7.2 foram declarados em `:root` (`src/index.css`) com os valores exatos da especificação: `board-canvas 1`, `workspace-journal 12`, `board-ui 20`, `hud-bars 40`, `hud-popovers 120`, `modal-base 1000`, `modal-nested 1250`, `modal-combat 3500`, `modal-note-editor 5000`, `portal-tooltip 9000`.
- `src/constants/zLayers.js` expõe `Z_LAYERS` (strings `var(--z-*)`) para estilos inline.

### 3.2 Análise de contextos de empilhamento (antes de migrar)
Os valores foram inventariados (40 `zIndex` inline com valor numérico, além de 7 ocorrências em parâmetros/expressões do tabuleiro, e 15 `z-index` no `App.css`) e cada um foi classificado em **global** (disputa a ordem no contexto raiz) ou **local** (dentro de um elemento que já cria contexto). Contextos locais identificados:
- **Superfície transformada do tabuleiro** (`BoardViewport`, `transform: translate/scale`): grade (4), AoE (18), régua (23), rótulo de medida (24), editor de texto (35), projétil (25) e ping (22).
- **Workspace do Diário** (raiz com `position: relative` + `zIndex`): `aside` (15), botão (20) e o confirm de pasta (era 2500).
- **Dock** (`.vtt-dock`): Hotbar e Emotes (120) só ordenam dentro do dock.
- **Toolbar lateral** (`.vtt-left-toolbar`): flyouts (30).
- **Overlay de cada modal**: botão do visor de mapa (60), submodal de vínculo do editor de notas (6000).
- **Sidebar** (item de grid com `z-index`): os 4 modais da Árvore de Fichas (1000).
- O `.vtt-stage` **não** cria contexto, e topbar/sidebar ocupam áreas de grid separadas do palco (que tem `overflow: hidden`).

### 3.3 Migração aplicada (camadas globais)

| Elemento | Antes | Depois | Efeito na ordem visível |
| :--- | :---: | :--- | :--- |
| `.vtt-topbar` | 30 | `var(--z-hud-bars)` (40) | Nenhum: não se sobrepõe aos filhos do palco; o HUD do tabuleiro (47–49) continua acima |
| `.vtt-sidebar` | 25 | `var(--z-hud-bars)` | Nenhum (área de grid própria) |
| `.vtt-dock` | 25 | `var(--z-hud-bars)` | Nenhum: não há elemento global entre 25 e 40 na região do dock |
| `.cp-dock-map-trigger` | 25 | `var(--z-hud-bars)` | Nenhum: mesmo valor do dock e mesma ordem DOM |
| `.vtt-left-toolbar` | 26 | `var(--z-board-ui)` (20) | Nenhum: os elementos com z entre 20 e 26 estão dentro da superfície transformada (contexto local) ou não se sobrepõem à toolbar |
| `.cp-modal-overlay` | 100 | `var(--z-modal-base)` (1000) | Nenhum: não existe camada global entre 100 e 1000 |
| `.cp-hotbar-popup`, `.cp-emote-popup` | 120 | `var(--z-hud-popovers)` (120) | Nenhum (mesmo valor) |
| Raiz do `JournalWorkspace` | 12 | `Z_LAYERS.workspaceJournal` (12) | Nenhum (mesmo valor) |
| Exclusão de pasta do Diário (local) | 2500 | `Z_LAYERS.modalNested` (1250) | Nenhum: dentro do workspace continua acima de 15/20 |
| Árvore de Fichas, 4 modais (local à sidebar) | 1000 | `Z_LAYERS.modalBase` (1000) | Nenhum (mesmo valor) |
| Submodais da Ficha (Hotbar / Ícone da rolagem) | 1200 / 1250 | `Z_LAYERS.modalNested` (ambos) | Nenhum: com ambos abertos, o de ícone vem depois no DOM e continua por cima |
| `DamageRollModal` / `SavingThrowModal` | 1400 / 1450 | `Z_LAYERS.modalCombat` (ambos) | Entre si, nenhum (SavingThrow vem depois no DOM). **Mudança intencional**: agora ficam **acima do visor de mapa** (ver abaixo) |
| Visor de mapa (`ScenesManagerModal`, aba "map") | 4000 | `calc(var(--z-modal-base) + 1)` | Continua acima de Ficha/Compêndio/Painel GM (`+1` preserva a ordem anterior, pois esses vêm depois no DOM); passa a ficar **abaixo dos modais de combate** |
| Editor de notas (portal) | 5000 | `Z_LAYERS.modalNoteEditor` (5000) | Nenhum (mesmo valor) |
| Submodal de vínculo do editor (local) | 6000 | `Z_LAYERS.modalNoteEditor` | Nenhum (dentro do overlay do editor) |
| Tooltip `LinkedCardSpan` (portal) | 999999 | `Z_LAYERS.portalTooltip` (9000) | Nenhum: 9000 continua acima de qualquer camada global (máximo 5000) |

**Única mudança de ordem visível (intencional, conforme §7.2)**: com o visor de mapa aberto, um teste de resistência ou rolagem de dano agora aparece **por cima** do mapa (antes ficava atrás: 1400 < 4000).

**Mantidos numéricos (locais, documentados na §7.2)**: camadas internas do tabuleiro, `TokenSprite`, `FogOfWarCanvas`, `JournalGraphWebView` (5), `LoginScreen` (2/3), seletor de ícones da ficha (70/150), botão e imagem do visor de mapa (60/10), `aside`/botão do Diário (15/20), HUD do palco no `VTTLayout` (28/30/47/49), HUD do tabuleiro (25/48), e em CSS: flyouts (30), ping (22), projétil (25), *notch* (5), menu de abas da ficha (50), balão (60) e *hover* de emote (2).

---

## 4. CSS Subordinado aos Inlines

- **Cursor da mira da bola de neve** (pendência registrada na Validação, Seção 5): `App.css` usava `url('/icones/iconeMiraBolaDeNeve.png')` fixo, ignorando `BASE_URL`. Agora a regra usa `cursor: var(--cp-snowball-cursor) !important`. O `VTTLayout` define a variável no `.vtt-shell` com `getAssetUrl("icones/iconeMiraBolaDeNeve.png")` e o `:root` tem fallback `crosshair`. Com o `base` atual do Vite (`/`), a URL final é a mesma de antes.
- **Tokens**: seção 7 (camadas) e seção 8 (cursor) no `:root` de `index.css`.
- **Mantido sem alteração (com motivo)**:
  - `html, body, #root { overflow: hidden; user-select: none }` (auditoria §7.3): o VTT depende disso, e a `LoginScreen` já trata a própria rolagem no inline. Mudar o global teria risco de regressão no tabuleiro.
  - As classes `.cp-btn*`, `.cp-modal-overlay`, `.cp-window` e `.cp-speech-bubble-*` já correspondem ao que os inlines usam. Os componentes novos as reutilizam sem alterar valores.
- **Não feito**: não foi feita uma reconciliação classe a classe de todo o `App.css` (1.355 linhas) contra todos os inlines. A Fase 4 tratou as classes usadas pelos componentes base, as camadas e o cursor. As demais divergências inline × classe continuam com o inline prevalecendo (Princípio 7) e serão absorvidas quando cada God Component for decomposto (Fase 5).

---

## 5. Itens da Auditoria Avaliados e Não Executados (com motivo)

| Item (auditoria §8 Fase 4 / §5) | Motivo |
| :--- | :--- |
| `CPInput.jsx` | Não consta na árvore `ui/` das Diretrizes (fonte da verdade); `.cp-input` continua como classe global. |
| `CpIconPicker.jsx` em `ui/` | Hoje é uma função interna de `CharacterSheetModal.jsx`, usada só ali. As Diretrizes §2 a colocam em `CpFlashIcons.jsx`; a mudança acontece na decomposição da ficha (Fase 5). |
| Balão de emote duplicado no chat (`EmoteMessageCard`, auditoria §5) | **Não existe** no código atual nem no `HEAD`: o chat renderiza emotes como card simples, sem balão. O `CpSpeechBubble` foi extraído e é usado pelo tabuleiro. |
| Troca de todos os `className="cp-btn ..."` (~170 botões) por `CPButton` | Seria uma reescrita em massa dos God Components. Pela ordem *bottom-up* (auditoria §8), a adoção acontece na decomposição da Fase 5. |
| Migração de **todos** os `zIndex` para tokens | Os valores locais não disputam a ordem global; trocá-los não traz ganho e aumenta o risco. Ver 3.3. |

**Observação** (fora do escopo e sem alteração): `CharacterSheetModal` mantém os estados `crSaveEnabled`/`crSaveDc`/`crSaveAttr`/`crSaveDesc` da "Rolagem Personalizada", mas não há campos de resistência na UI desse formulário, então `savingThrow.enabled` sai sempre `false` nesse fluxo. Não foi criada UI nova (Princípio 8 e escopo da fase).

---

## 6. Validação Executada na Entrega da Fase 4

| Verificação | Resultado |
| :--- | :--- |
| `npx oxlint` | **0 erros, 10 warnings**, os mesmos 10 avisos pré-existentes (só linhas deslocadas). Nenhum warning nos arquivos novos. |
| `vite build` (saída em diretório temporário) | Concluído: `90 modules transformed`, CSS `27.55 kB`, JS `1,382.97 kB`. |
| **Equivalência de HTML** (`react-dom/server` `renderToStaticMarkup` via `vite.ssrLoadModule`; harness temporário em `node_modules/.cache`, apagado ao final) | **19/19 idênticos**: `WindowModal` "light" (340px e 320px); `ConfirmDeleteModal` Fichas e Diário; `WindowModal` "cp" (1400 e 1450); `SavingThrowFields` inline Item/Habilidade e grid Compêndio, cada um ligado e desligado (6 casos); `CpSpeechBubble` texto e ícone com fade; `CPButton` nas 5 variantes. Nos casos com camada, o original foi comparado passando o mesmo `zIndex` numérico; a troca pelo token é a única diferença intencional (Seção 3.3). |
| Varredura | Restou um único `zIndex` numérico ≥ 100 (`CharacterSheetModal`, 150, dropdown local do seletor de ícone). |

**Não executado (registrado por fidelidade):** teste manual no navegador (exige login na campanha). Os comportamentos de clique (fechar no overlay, `stopPropagation` no painel, ações dos botões) foram revisados no código, mas não exercitados em runtime. Sem `git commit` e sem `firebase deploy` (D-1).

---

## Fronteira Fase 4 → Fase 5

- O estado de referência do código passa a ser o descrito nesta seção.
- **Pendências herdadas**: testes manuais no navegador dos fluxos alterados na 3.1 e na 4 (em especial modais da Árvore de Fichas, exclusão de pastas, combate com o visor de mapa aberto e mira da bola de neve), deploy das rules (D-1, no fim da refatoração) e Modo de Turno (D-4, escopo futuro).
- **Próximo passo**: Fase 5. Inclui:
  - *debounce* de 400ms com *flush* no `onBlur`;
  - decomposição de `CharacterSheetModal`, `BoardViewport`, `VTTLayout` e `ChatSidebarPanel`;
  - `StandaloneSheetView` com os modais de combate;
  - `BoardTokensContext` no lugar do `boardSyncRef`;
  - `useFolders`;
  - adoção progressiva de `CPButton`/`WindowModal` nos subcomponentes e `CpIconPicker` em `CpFlashIcons.jsx`.

---

# FASE 5 — Decomposição dos God Components, `StandaloneSheetView`, `BoardTokensContext`, `useFolders` e Debounce

## 1. Resumo Executivo da Fase 5

- **Data**: 2026-11-13. A execução foi interrompida uma vez por limite de tokens (durante a decomposição do chat) e retomada a partir do estado do *working tree*; nada foi perdido nem refeito.
- **Especificação seguida**: Diretrizes §2 (árvore-alvo) e §9 item 5; auditoria §8 "Fase 5" (debounce, decomposição de `CharacterSheetModal`, `BoardViewport`, `VTTLayout` e `ChatSidebarPanel`, `BoardTokensContext`, `StandaloneSheetView`).
- **Base de comparação**: cópia do *working tree* ao fim da Fase 4, salva fora do repositório antes da primeira edição. As contagens são **Fase 5 vs. essa cópia**.
- **Sem `git commit` e sem `firebase deploy`** (D-1). Nenhuma Security Rule ou serviço foi alterado.
- **Princípio adotado**: decomposição **mecânica e verificável**. O JSX e os handlers foram movidos sem reescrita, e a equivalência foi comprovada por HTML renderizado (Seção 6). As mudanças de comportamento desta fase são só as intencionais da Seção 5.

### 1.1 Tamanho dos God Components

| Arquivo | Antes | Depois |
| :--- | :---: | :---: |
| `CharacterSheetModal.jsx` | 4.068 | **754** |
| `BoardViewport.jsx` | 3.889 | **2.833** |
| `ChatSidebarPanel.jsx` | 1.537 | **436** |
| `VTTLayout.jsx` | 1.583 | 1.551 |
| `useCharacters.js` / `useJournalNotes.js` | 744 / 262 | 717 / 233 |

### 1.2 Arquivos criados (36)

| Área | Arquivos (linhas) |
| :--- | :--- |
| Ficha (`sheets/`) | `PlayerCardLeftPanel.jsx` (307), `CpIconPicker.jsx` (121), `CpSheetBadges.jsx` (77), `sheetConstants.js` (29) |
| Abas (`sheets/tabs/`) | `SheetAttributesTab.jsx` (548), `SheetInventoryTab.jsx` (393), `SheetInventoryItemForm.jsx` (218), `SheetInventoryToolbar.jsx` (54), `SheetSkillsTab.jsx` (1.036), `SheetSkillsToolbar.jsx` (62), `SheetNotesTab.jsx` (55), `SheetRollsTab.jsx` (654) |
| Estado da ficha (`sheets/state/`) | `usePlayerCardEditState.js` (23), `useSkillsFormState.js` (106), `useInventoryItemFormState.js` (53), `useRollsFormState.js` (65) |
| Chat (`chat/`) | `RollMessageCard.jsx` (822), `SkillPingCard.jsx` (275), `EmoteMessageCard.jsx` (56), `MessageAvatar.jsx` (50) |
| Tabuleiro (`canvas/`) | `BoardLeftToolbar.jsx` (785), `BoardMeasurementLayer.jsx` (174), `BoardAoeTemplateLayer.jsx` (92), `BoardPingsLayer.jsx` (48), `boardConstants.js` (105) |
| Combate / layout | `combat/CombatModals.jsx` (56), `layout/StandaloneSheetView.jsx` (37) |
| Contextos | `contexts/BoardTokensContext.js` (16), `contexts/BoardTokensProvider.jsx` (9) |
| Hooks / UI | `hooks/useFolders.js` (72), `hooks/useDebouncedCallback.js` (50), `ui/DebouncedField.jsx` (49) |

**Arquivos modificados**: `CharacterSheetModal.jsx`, `BoardViewport.jsx`, `ChatSidebarPanel.jsx`, `VTTLayout.jsx`, `useCharacters.js`, `useJournalNotes.js` e `DIRETRIZES_ARQUITETURA.md` (árvore da §2).

---

## 2. Ficha (`CharacterSheetModal`) — 4.068 → 754 linhas

1. **Auxiliares de módulo** (conteúdo inalterado):
   - `CpIconPicker` foi para arquivo próprio. As Diretrizes previam colocá-lo em `CpFlashIcons.jsx`, mas isso misturaria componente com exports de dados e geraria o aviso `only-export-components`; a árvore foi atualizada.
   - `CpCoinIcon`, `CpStampIcon` e `CpMemberBadge` foram para `CpSheetBadges.jsx`.
   - `CARD_COLORS`, `TABS` e `resolveItemIcon` foram para `sheetConstants.js`.
2. **Componentes extraídos**:
   - `PlayerCardLeftPanel`;
   - as 5 abas da Diretrizes §2 (`SheetInventoryTab`, `SheetAttributesTab`, `SheetSkillsTab`, `SheetNotesTab`, `SheetRollsTab`);
   - 3 peças contextuais que ficavam em outra posição do DOM: `SheetInventoryItemForm` e as barras `SheetInventoryToolbar` e `SheetSkillsToolbar`.
   - A condição de aba (`activeTab === ...`) ficou no pai; cada aba só recebe o que usa.
3. **Handlers exclusivos de uma aba foram movidos para dentro dela**, sem alteração. Exemplos:
   - Atributos: `handleUpdateResource`, `handleAddAttribute`, `hpPercent`…
   - Inventário: `handleAdjustItemQty`, `scrollInventory`, `inventoryScrollRef`…
   - Skills: `handleAddAbility`, `handlePing`…
   - Rolagens: `handleDeleteRollGroup`, `handleMoveRollOrder`…
   - Player Card: `handlePopoutWindow`, `coins`, `xp`.
   - Handlers compartilhados (`triggerRoll`, `pinToRollGroup`, `handleDemarcateArea`, `handlePullFromCompendium`) continuam no pai.
4. **Estado agrupado por domínio** em `sheets/state/` (`usePlayerCardEditState`, `useSkillsFormState`, `useInventoryItemFormState`, `useRollsFormState`).
   - Os hooks continuam sendo **chamados pela ficha, na mesma posição e ordem dos `useState` originais**. Assim os formulários **não são perdidos ao trocar de aba**, exatamente como antes.
   - As abas recebem um único objeto (`skillsForm`, `itemForm`, `rollsForm`, `cardEdit`) em vez de dezenas de props.
   - `resetAbilityForm` foi movido para dentro do `useSkillsFormState`.

## 3. Chat, Tabuleiro e Layout

- **`ChatSidebarPanel`** (1.537 → 436): cada ramo do `map` de mensagens virou um card, com suas variáveis locais movidas junto:
  - `EmoteMessageCard`;
  - `SkillPingCard`;
  - `RollMessageCard` (ataque, dano, cura, resistência, efeitos aplicados e calculadora do Mestre).
  - O `MessageAvatar` foi para arquivo próprio. O ramo de texto simples continua no painel.
- **`BoardViewport`** (3.889 → 2.833):
  - `BoardLeftToolbar` (barra lateral inteira, 733 linhas de JSX);
  - `BoardMeasurementLayer` (régua linha/cone/círculo);
  - `BoardAoeTemplateLayer` (template de AoE);
  - `BoardPingsLayer` (pings e bolas de neve em voo);
  - `DRAW_COLORS`, `LAYER_META` e a geometria pura (`pointsToSvgPath`, `rotatePoint`, `doesStrokeIntersectRect`) foram para `boardConstants.js`.
- **`BoardTokensContext`** (auditoria §4.5):
  - O `VTTLayout` passou a assinar os tokens da cena ativa (`useRealtimeTokens(activeScene?.id)`) e os entrega ao `BoardViewport` pelo `BoardTokensProvider`. O `BoardViewport` lê com `useBoardTokens()`.
  - **Removidos** o `boardSyncRef` e a prop `onTokensSync`.
  - Os 6 pontos do `VTTLayout` que liam `boardSyncRef.current` (`resolveActorToken`, custos de combate, aplicação de efeito, início do Modo de Turno) usam o valor reativo.
- **`StandaloneSheetView` + `CombatModals`** (auditoria §2.1, bug):
  - Os modais `DamageRollModal` e `SavingThrowModal` foram extraídos para `CombatModals`, usado pela mesa e pela janela destacada.
  - Antes, na janela `?sheetId=`, um pedido de Teste de Resistência era detectado mas o modal **nunca aparecia**. Agora o `StandaloneSheetView` renderiza a ficha **e** os modais de combate.
- **`useFolders`**:
  - O listener da subcoleção `folders`, duplicado em `useCharacters` e `useJournalNotes`, virou um hook único por domínio (`"character"` / `"journal"`), com os mesmos filtros, ordenação e dependências estáveis (V-13).
  - O SDK do Firestore já compartilhava a escuta de consultas idênticas, então o ganho é de código, não de leituras.

## 4. Debounce (auditoria §3.3.6)

- **`useDebouncedCallback`** (`run`/`flush`/`cancel`): agenda a gravação para 400ms depois da última chamada e executa a pendência ao desmontar.
- **`ui/DebouncedField`**: campo com rascunho local que grava após 400ms sem digitação, faz *flush* no `onBlur` e aceita atualizações externas (outro jogador, sync Token→Ficha) quando não há edição pendente. Repassa as props na mesma ordem, então o HTML é idêntico ao do campo original.
- **Campos convertidos (10)**:
  - nome do pinguim (Player Card);
  - História & Origem e Anotações (aba Notas);
  - HP atual/máx., MP atual/máx., Defesa, Nível e valor de cada Atributo (aba Atributos).
  - Antes cada tecla gerava um `updateDoc` e um snapshot para todos.

## 5. Mudanças de Comportamento (intencionais)

1. **Gravação dos 10 campos acima**: passou a ocorrer depois de 400ms sem digitar, ao sair do campo ou ao fechar a ficha (antes, a cada tecla).
   - Ressalva: se dois atributos diferentes forem editados com menos de 400ms entre si, cada um grava o array `attributes` com base no snapshot mais recente. O risco de sobreposição já existia por tecla; com o *latency compensation* do Firestore a janela é curta.
2. **Janela destacada**: agora exibe os modais de Teste de Resistência e de Dano (correção do bug).
3. **Tokens da cena ativa**:
   - São assinados pelo `VTTLayout` mesmo quando o tabuleiro não está visível e também na janela destacada. Antes, os dados de combate usavam o último valor que o tabuleiro tinha enviado, que podia estar desatualizado.
   - Consequência positiva: na janela destacada, `resolveActorToken` passa a encontrar o token de um NPC com instância única, o que reduz a limitação registrada no V-05.
   - Custo: um listener de tokens a mais na janela destacada.

## 6. Validação Executada

| Verificação | Resultado |
| :--- | :--- |
| `npx oxlint` | **0 erros, 10 warnings**: os mesmos 10 avisos pré-existentes, só com linhas deslocadas. |
| **Lint estrito** (`no-undef`, `react/jsx-no-undef`, `no-unused-vars`; config temporária fora do repo) | **0 erros em `src/`**. Era 0 no baseline, e esta foi a rede de segurança de cada extração: variável faltando no componente extraído = erro; prop sobrando = erro. |
| `vite build` (saída temporária) | Concluído: `122 modules transformed`, JS `1,393.48 kB`. |
| **Equivalência de HTML** (`renderToStaticMarkup` via `vite.ssrLoadModule`, baseline × código novo) | **131/131 idênticos**. Detalhe abaixo. |

Casos da equivalência de HTML:
- **Ficha: 105 casos.**
  - 48 combinações de aba (6) × `canEdit` × `isGM` × janela destacada.
  - 56 cenários com estados internos forçados: formulário de novo item, seletor de ícone, inspetor, nova/editar habilidade com AoE e CD, perícia, nova rolagem, importação, modal da Hotbar, modal de ícone, edição de moedas/XP, menu de abas, permissões e tela cheia.
  - 1 diagnóstico confirmando que os estados forçados foram de fato aplicados.
  - Os estados foram forçados por um *shim* de React que fixa o valor do *n*-ésimo `useState`. Os hooks de estado preservam a ordem original, então os índices valem para o baseline e para o código novo.
- **Chat: 10 casos.** Texto, emote, skill_ping, ataque com alvo e pedido de resistência, dano com efeitos aplicados, resultado de resistência, rolagem livre, cura e mensagem secreta; como Mestre e como jogador; com o menu de aplicar efeito aberto em 3 tipos de mensagem.
- **Tabuleiro: 16 casos.** Com e sem cena, com e sem AoE, mira ligada/desligada, Mestre e jogador. Este harness também confirma que a troca do `boardSyncRef` pelo contexto não altera o HTML.

**Infraestrutura do harness**: diretório temporário `.eq-cache/` na raiz do projeto, apagado ao fim de cada execução; mocks de `useAuth`/`useCampaign`; *shim* de React.

**Não executado (registrado por fidelidade):**
- Teste manual no navegador (exige login).
- Teste de runtime do debounce (timers, *flush* no `onBlur`/desmontagem): não há ambiente DOM de testes instalado. A lógica foi revisada no código.
- O harness compara HTML **estático**: handlers de clique não são exercitados. A cobertura deles vem do lint estrito e de terem sido movidos sem alteração.

## 7. Planejado e Não Executado nesta Fase (com motivo)

| Item (Diretrizes §2 / auditoria §8) | Situação |
| :--- | :--- |
| `useBoardCamera.js` e `useSnowballProjectiles.js` | Não criados. Exigem extrair **lógica** (pan/zoom, conversão de coordenadas, animação) entrelaçada com eventos de mouse do `BoardViewport`, sem a verificação por HTML usada nos blocos de JSX. Marcados como "planejado, não criado" na árvore das Diretrizes. |
| `BoardDrawingsLayer.jsx` e `TokenQuickHpPopup.jsx` | Não criados. Os desenhos são renderizados por funções internas (`renderShapeSvgLayer` / `renderStrokeSvgLayer` / `renderTextLayer`) chamadas em 3 camadas, e o popup rápido de HP está acoplado ao estado de seleção do tabuleiro. HUD superior do tabuleiro também mantido. |
| `StandaloneSheetView` "enxuto" (assinar só o necessário) | **Parcial**: o bug dos modais foi corrigido, mas a janela destacada ainda passa pelos hooks do `VTTLayout` (inclui o listener do Diário). O enxugamento exige extrair as ações de combate do `VTTLayout` para um hook compartilhado e rotear no `App.jsx`. |
| Adoção de `CPButton`/`WindowModal` nos novos subcomponentes | Não feita: o JSX foi movido **sem alteração** para garantir equivalência comprovada. A troca pode ser feita agora em arquivos pequenos e isolados. |
| `QuickDiceRoller.jsx` (só na auditoria) | Não consta na árvore das Diretrizes; o rolador rápido continua no `ChatSidebarPanel` (436 linhas). |
| Unificação do **modelo** de pastas (Diário por caminho "/" × Fichas por `parentId`) | Fora do escopo do `useFolders`, que unificou a assinatura. Segue como evolução futura junto com a D-2 (preservação de subpastas). |

## Fronteira Fase 5 → Encerramento da Refatoração

- **As fases 0–5 do plano diretor foram executadas.** Os itens da Seção 7 ficam como pendências explícitas.
- **Antes de `git commit` / `firebase deploy`** (D-1, só com autorização):
  1. testes manuais no navegador dos fluxos alterados nas Fases 3.1–5;
  2. testes das rules (D-3, V-20) no emulador com usuários autenticados;
  3. deploy das rules seguido de uma sessão do Mestre, para gravar `meta/gmId` e rodar as migrações V-07/V-09d.



---

# AUDITORIA DE REGRESSÕES E FASE 6 — Correção das Perdas Não Planejadas

## 1. Origem

- **Data**: 2026-11-13. Depois da Fase 5, o usuário relatou perdas funcionais em relação ao commit `711451e` (a `main` do GitHub, ainda sem os commits da refatoração). Exemplo relatado: a bola de neve não gera mais ping.
- **Auditorias**: duas auditorias independentes compararam o HEAD com o *working tree*: uma desta sessão (4 frentes: tabuleiro, ficha, chat/combate e auth/diário/cenas) e uma do Codex (com 17 reproduções em `auditoria_refatoracao/validar-regressoes.mjs`). As listas foram consolidadas e classificadas pelo usuário em:
  - **perdas não planejadas** (33 itens, A1–A33): defeitos a corrigir nesta Fase 6;
  - **perdas planejadas** (17 itens, B1–B17): consequências de decisões registradas (D-3, V-03, V-05, V-09, V-10, V-12, V-17, Princípio 6, Fases 1–4), que serão mantidas, ajustadas ou revertidas por decisão do usuário.

## 2. Perdas Não Planejadas (A1–A33)

| Grupo | Itens |
| :--- | :--- |
| Regras publicadas | A1 pings/bola de neve; A2 criar e editar desenhos; A3 desenhos antigos invisíveis; A4 jogador não cria pasta de ficha (e quem está em `editableBy` não renomeia) |
| Visibilidade (`visibleTo`) | A5 legado sem `visibleTo`; A6 divergência com `visibleToPlayers`; A7 transferência de ficha/pasta; A8 dono fora do `visibleTo`; A9 revogar compartilhamento esconde o card do dono; A10 "Visão Player" mostra ocultos; A11 jogador vê fichas de todos e "+ No Mapa" falha em silêncio |
| Alvos e atalhos | A12 janela destacada recebe 1 alvo; A13 sem fallback para `BroadcastChannel`; A14 `/r` da dock sem alvo; A15 ataque personalizado só de acerto virou teste; A16 atalho vinculado por nome troca a fórmula; A17 ícone de atributo perdido; A18 nome de atalho de perícia; A19 "Remover" da Hotbar |
| Combate | A20 resistência em duas janelas (cobrança dupla); A21 custo exibido sem desconto; A22 Defesa de NPC oculto; A23 consumível gasto com ação bloqueada |
| Avatares e perfil | A24 avatar por URL externa; A25 foto do personagem ao falar como jogador; A26 "Remover foto" (Google); A27 foto de cadastro recusado vaza para outra conta |
| Debounce e diário | A28 campo mostra valor diferente do salvo; A29 perda das últimas teclas ao fechar; A30 dano sobrescrito durante digitação (suspeita); A31 editor do diário fecha sem salvar |
| Regras novas (para o deploy) | A32 primeira gravação de `meta/gmId`; A33 `controlledBy` limitado às posições 0–4 |

## 3. Plano da Fase 6

| Subfase | Escopo | Itens |
| :---: | :--- | :--- |
| **6.0** | Verificar regras publicadas e estado dos dados (somente leitura) | — |
| **6.1** | Compatibilidade com as regras publicadas | A1–A4 |
| **6.2** | Visibilidade e permissões de leitura | A5–A11 |
| **6.3** | Alvos e atalhos de rolagem | A12–A19 |
| **6.4** | Combate | A20–A23 |
| **6.5** | Avatares e perfil | A24–A27 |
| **6.6** | Debounce e diário | A28–A31 |
| **6.7** | Regras do deploy final e troca do layout do RTDB | A32, A33, A4 (`editableBy`) |
| **6.8** | Validação final, testes de regressão e registro | todos |

**Princípio**: com o deploy bloqueado (D-1), o código volta a funcionar com as regras publicadas (modo de compatibilidade). O formato novo de banco só entra no deploy final (6.7).

## 4. Fase 6.0 — Verificação do Ambiente (concluída, 2026-11-13)

**Método**: somente leituras no projeto `clubpenguintabletop` (Firebase CLI e cliente interno da `firebase-tools`, apenas GET). Nenhuma gravação no Firebase e nenhuma alteração de código. Os scripts imprimiram só contagens agregadas (sem nomes, e-mails ou conteúdo) e ficaram fora do repositório.

### 4.1 Regras publicadas
- **Realtime Database**: idênticas às do commit `711451e`. Só liberam escrita em `tokens/`, `fog/` e `presence/`.
- **Firestore**: idênticas às do commit `711451e` (ruleset publicado em 2026-11-10T20:04:35Z).
- **Consequência**: A1–A4 confirmados em produção.
- **CLI**: das 3 contas logadas, só 1 tem acesso ao projeto, e ela não é a padrão. O deploy (6.7) precisará de `--account`.

### 4.2 Estado dos dados (campanha `main-table`, única existente)

| Verificação | Resultado | Efeito no plano |
| :--- | :--- | :--- |
| Desenhos | 25 desenhos intactos em 3 cenas, em `fog/{cena}/drawings`. Os nós `drawings/`, `pings/` e `meta/` não existem. | Nada se perdeu. A migração nunca gravou. A 6.1 não precisa de reparo de dados. |
| Migração de atalhos e pastas (Fase 3.1) | Já rodou: 11 atalhos e 5 slots da Hotbar com vínculo; pastas com `editableBy`. | Nenhum atalho de habilidade com fórmula diferente da origem (A16 não estragou dados de habilidade). Perícias, itens e ícones de atributo (A17) não verificados. |
| `visibleTo` em fichas, notas, pastas, cenas, compêndio e mensagens | Nenhum documento sem o campo, vazio, sem o dono ou divergente de `visibleToPlayers`. A cena ativa está visível aos jogadores. | A5–A9 não afetam os dados atuais. As correções da 6.2 são preventivas. |
| Fichas | 5 fichas, todas com `["ALL"]`; 2 são PCs cujo dono é o Mestre. | A11 é real. A decisão B1 (PC do Mestre tratado como matriz) afeta 2 fichas. |
| Jogadores | 3 jogadores: 2 com foto por link externo, 0 com foto em `media/`. 13 mensagens antigas com foto em Base64. | A26 atinge 2 jogadores. As mensagens antigas continuam exibindo a foto. |
| Pastas de ficha | 2 pastas sem `scope`. | O dono continua editando. Não precisam de reparo. |
| **Modo de Turno** | **Ativo** na campanha (rodada 1, 3 combatentes, movimento e ações travados fora do turno). | O site publicado ignora; o código atual bloqueia jogadores fora da vez. O Mestre deve encerrar pelo botão ■ antes dos testes no navegador. Não foi alterado nesta verificação. |

### 4.3 Decisão do usuário sobre B1 (2026-11-13)
- **Pergunta**: as 2 fichas de PC do Mestre continuam tratadas como matriz, ou o critério passa a ser apenas `type === "npc"`?
- **Resposta do usuário**: "tudo que é do mestre hoje é só teste, nada é real ainda".
- **Decisão registrada**: o B1 segue como planejado (Princípio 6 sem alteração de critério) e não há reparo de dados para as fichas do Mestre. Os dados atuais do Mestre são de teste.

## 5. Fase 6.1 — Compatibilidade com as Regras Publicadas (concluída, 2026-11-13)

**Objetivo**: fazer o código atual funcionar com as regras que estão no ar (as do commit `711451e`), sem deploy (D-1). Itens A1–A4.

### 5.1 Causa
Na Fase 2/3.1, desenhos e pings passaram de `fog/{cena}/drawings` e `fog/{cena}/pings` para nós irmãos (`drawings/{cena}`, `pings/{cena}`), e o gmId passou a ser espelhado em `meta/gmId`. As regras publicadas do Realtime Database não têm esses nós, então toda gravação neles é negada. Resultado: pings e bola de neve sem efeito (A1), desenhos não criados nem editados (A2) e desenhos antigos invisíveis, porque o código passou a ler do nó novo e vazio (A3). No Firestore, a regra publicada de `folders` exige `scope` em pasta criada por jogador, e o código não gravava o campo (A4).

### 5.2 Alterações

| Arquivo | Mudança |
| :--- | :--- |
| `src/services/rtdbPaths.js` (**novo**) | Ponto único dos caminhos do RTDB. Constante `RTDB_LAYOUT = "legacy"` e funções `drawingsPath`, `pingsPath` e `gmMetaPath`. No layout `"legacy"`, desenhos e pings ficam em `fog/{cena}/drawings` e `fog/{cena}/pings` (formato do `711451e`). O layout `"split"` (nós irmãos e `meta/gmId`) só deve ser ligado junto com o deploy das regras novas (6.7). |
| `src/hooks/useBoardInteractive.js` | Os 2 listeners (desenhos e pings), o destino da migração e as 8 gravações por item (ping, traço, forma, texto ×2 e item por id ×3: apagar, mover e girar) passaram a usar `drawingsPath`/`pingsPath`. A migração automática `fog/…/drawings → drawings/…` agora começa com `if (!IS_SPLIT_RTDB_LAYOUT) return;`: no layout legacy, `fog/{cena}/drawings` é o local oficial e nada é movido. |
| `src/contexts/CampaignContext.jsx` | O espelhamento de `meta/gmId` (efeito ao abrir a campanha e `assignGM`) só roda no layout split. Antes, cada abertura pelo Mestre gerava uma escrita negada. |
| `src/hooks/useCharacters.js` | `createFolder` grava `scope: "player"` nas pastas de ficha (A4, parte da criação). |

Os arquivos originais ficaram em backup fora do repositório (scratchpad da sessão, `backups/pre-6.1/`).

### 5.3 O que não foi feito nesta subfase (e por quê)
- **A4, parte da renomeação**: quem está em `editableBy` sem ser dono continua sem poder renomear pasta. A regra publicada só aceita o dono ou o Mestre; resolver exige mudar regra, então fica para a 6.7.
- **Reparo de dados**: desnecessário. A Fase 6.0 mostrou os 25 desenhos intactos em `fog/{cena}/drawings` e os nós novos inexistentes.
- **`database.rules.json` local**: não foi alterado. Nas regras locais novas, `fog/` só aceita escrita do Mestre. Por isso, **o layout legacy não funciona com as regras locais novas**. A troca para `RTDB_LAYOUT = "split"` e o deploy dessas regras precisam acontecer juntos na 6.7 (incluindo decidir se a migração de desenhos roda antes ou depois do deploy).

### 5.4 Validação

**Emulador com as regras publicadas** (cópias exatas das regras em produção; projeto demo isolado, sem contato com produção). Usuário simulado: jogador autenticado que não é o Mestre.

| Teste | Esperado | Resultado |
| :--- | :---: | :---: |
| [sanidade] escrita sem autenticação em `tokens/` | negado | 401 ✔ |
| Ping em `fog/{cena}/pings`: criar / remover | permitido | 200 / 200 ✔ |
| Desenho em `fog/{cena}/drawings`: criar traço / mover / apagar | permitido | 200 / 200 / 200 ✔ |
| Leitura de `fog/{cena}` | permitido | 200 ✔ |
| [controle] desenho em `drawings/{cena}` (layout anterior à 6.1) | negado | 401 ✔ |
| [controle] ping em `pings/{cena}` (layout anterior à 6.1) | negado | 401 ✔ |
| [controle] `meta/gmId` | negado | 401 ✔ |
| Pasta de ficha com `scope: "player"` (código da 6.1) | permitido | 200 ✔ |
| [controle] pasta de ficha sem `scope` (código anterior à 6.1) | negado | 403 ✔ |

**Resumo: 12/12.** Nota de método: o emulador do RTDB trata um token no cabeçalho `Authorization: Bearer` como acesso administrativo e ignora as regras (os controles passavam indevidamente). O teste válido envia o token pelo parâmetro `?auth=`, e a linha de sanidade comprova que as regras estavam ativas.

**Outras verificações**
- Nenhum caminho literal de `drawings/`, `pings/` ou `meta/` fora de `rtdbPaths.js` (só restam as origens da migração, que não roda no layout legacy).
- `useFogOfWar` grava só com `update` (mescla) em `fog/{cena}`, então não apaga os desenhos e pings guardados no mesmo nó.
- `oxlint` padrão: 0 erros e 10 avisos (mesma linha de base da Fase 5). `oxlint` estrito: 0 erros. `vite build`: ok.
- **Não testado no navegador** contra produção. Antes do teste manual, o Mestre deve encerrar o Modo de Turno ativo (botão ■; ver 4.2), senão jogadores fora da vez ficam bloqueados por outro motivo.

### 5.5 Resultado esperado em produção (com o código local rodando contra o Firebase publicado)
A1 (pings e bola de neve), A2 (criar e editar desenhos) e A3 (desenhos antigos visíveis) voltam a funcionar. Jogadores voltam a criar pastas de ficha (A4, criação). Deixa de existir a escrita negada de `meta/gmId` a cada abertura de campanha pelo Mestre.

### 5.6 Incidente pós-6.1: `IS_SPLIT_RTDB_LAYOUT is not defined` no navegador (2026-11-13)
- **Sintoma relatado pelo usuário**: ao rodar o app, `Uncaught ReferenceError: IS_SPLIT_RTDB_LAYOUT is not defined` em `CampaignContext.jsx?t=1794594187640`, derrubando o `<CampaignProvider>`.
- **Causa**: o servidor de desenvolvimento (Vite, porta 5173) estava rodando durante a 6.1. A edição do `CampaignContext.jsx` foi feita em passos, e o uso de `IS_SPLIT_RTDB_LAYOUT` foi gravado cerca de 1 s antes da linha de import. O hot-reload capturou essa versão intermediária (`?t=1794594187640` = 15:23:07; a última gravação do arquivo foi às 15:23:08). O efeito quebrou na montagem, o React desmontou a árvore e a página ficou presa nesse estado.
- **Diagnóstico**:
  - o arquivo no disco já tinha o import (linha 31);
  - o módulo servido pelo Vite (com e sem o `?t` antigo) já contém `import { IS_SPLIT_RTDB_LAYOUT, gmMetaPath } from "/src/services/rtdbPaths.js"`;
  - o lint estrito (`no-undef`) e o build passavam, porque analisam a versão final;
  - um carregamento headless do app (Edge `--headless`, contra o servidor em execução) chegou à tela de login sem nenhum erro no console.
- **Correção**: nenhuma mudança de código foi necessária. Basta recarregar a página por completo (F5 ou Ctrl+Shift+R) para sair do estado quebrado do hot-reload.
- **Prevenção adotada**: com o servidor de desenvolvimento ligado, gravar os imports antes dos usos (ou o arquivo inteiro de uma vez), para que nenhuma versão intermediária referencie um identificador ainda não importado.

## 6. Fase 6.2 — Visibilidade e Permissões de Leitura (concluída, 2026-11-13)

**Objetivo**: corrigir A5–A11. A 6.0 mostrou que os dados atuais não têm documentos quebrados, então estas correções são preventivas (código e migração), sem reparo manual de dados.

### 6.1 Causa comum
A partir da Fase 1/3.1, o jogador passou a ler fichas, pastas, cards, cenas e compêndio com uma consulta só por `visibleTo` (`array-contains-any ["ALL", uid]`). No commit `711451e`, a leitura não dependia de `visibleTo` estar correto. Assim, qualquer documento com `visibleTo` defasado (sem o dono, vazio, ou diferente de `visibleToPlayers`) some para quem deveria vê-lo, ou aparece para quem não deveria.

### 6.2 Alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/services/visibilityService.js` (**novo**) | Regras únicas de visibilidade: `withRequiredAudience` (Mestre e dono sempre na lista; nunca vazia), `applyOwnerAndGmAudience` (aplica isso a uma atualização do Mestre que mexe em `ownerId`, `visibleTo` ou `editableBy`), `buildPlayerVisibilityQuery` e `subscribeVisibleCollection` (listener do jogador), `isReleasedToPlayers` (cenas e compêndio). | base |
| `useCharacters`, `useFolders`, `useJournalNotes` | O listener do jogador passou a usar a consulta `or(visibleTo contém ["ALL", uid], ownerId == uid)`: o dono sempre recebe os próprios documentos, mesmo com `visibleTo` defasado. O Mestre real continua lendo a coleção inteira. | A5, A7, A8, A9 |
| `useScenes`, `useCompendium` | Listener do jogador com `or(visibleTo contém ["ALL", uid], visibleToPlayers == true)`. Filtro do cliente via `isReleasedToPlayers`: `visibleToPlayers` (quando booleano) decide; na "Visão Player" do Mestre real, o UID dele não conta como liberação. | A5, A6, A10 |
| `useCharacters` (`updateCharacter`, `updateFolder`) | Gravações do Mestre que mexem em dono ou permissões passam por `applyOwnerAndGmAudience`: na transferência (mover para a seção de um jogador), o novo dono entra em `visibleTo` e `editableBy`; desmarcar "Visível a Todos" ou o próprio dono nunca tira o dono nem o Mestre. O dono anterior não é removido (mesmo comportamento do `711451e`). | A7, A8 |
| `journalService.revokeJournalNoteAccess` (+ `useJournalNotes` passa `campaign`) | Fora do escopo `gm`, a revogação mantém Mestre e dono em `visibleTo`. Antes, revogar o Grupo de um card `["ALL"]` gravava `[]`. `editableBy` não foi alterado (igual ao `711451e`). | A9 |
| `migrationService` | (1) Só marca a migração como feita quando ela termina; após falha, tenta de novo na próxima atualização da campanha, com intervalo mínimo de 60 s (A5). (2) Cenas e compêndio: recalcula `visibleTo` a partir de `visibleToPlayers` sempre que divergir, não só quando falta (A6). (3) Fichas, cards (fora do escopo `gm`) e pastas (fora do escopo `gm`): acrescenta Mestre e dono quando faltam (A8). | A5, A6, A8 |
| `CharactersSidebarList` (visão do jogador) | Como no `711451e`, o jogador lista só as próprias fichas, agora somadas às compartilhadas com ele individualmente (uid em `visibleTo` ou `editableBy`). Fichas só "Visíveis a Todos" deixam de aparecer na lista dele. | A11 |
| `SheetAttributesTab` e `VTTLayout.handleSpawnCharacterToken` | O botão "+ No Mapa" da ficha só aparece para quem pode editar a ficha (a lista lateral já fazia isso). Se a ação chegar sem permissão, mostra aviso em vez de falhar em silêncio. | A11 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.2/`.

### 6.3 Validação

**1. Consulta `or` aceita pelas regras (emulador).** Antes de alterar o código, testei as consultas `or(visibleTo, ownerId)` e `or(visibleTo, visibleToPlayers)` com o SDK, como jogador, tanto com as regras **publicadas** quanto com as regras **locais novas**. Nos dois casos, `getDocs` e `onSnapshot` foram aceitos e retornaram exatamente os documentos esperados.

**2. Harness da 6.2: 29/29 com as regras publicadas e 29/29 com as regras locais novas.** Os módulos reais (`migrationService`, `journalService`, `visibilityService`, `CharactersSidebarList`) foram carregados pelo Vite, com `services/firebase.js` substituído por um stub ligado ao emulador (Mestre e jogador simulados). O harness roda numa pasta temporária do projeto (`.tmp-harness-6x`), apagada ao final.

| Grupo | O que foi verificado |
| :--- | :--- |
| Funções puras (9) | Audiência nunca vazia; transferência inclui o novo dono (A7); desmarcar "Visível a Todos" de ficha `["ALL"]` mantém Mestre e dono (A8); `visibleToPlayers` vence `visibleTo` nos dois sentidos (A6); "Visão Player" esconde item com `visibleTo [gm]` (A10), com controle mostrando que o critério anterior o exibiria. |
| Migração (9) | Ficha `["ALL"]` e ficha sem `visibleTo` ganham Mestre e dono; cena/compêndio divergentes corrigidos nos dois sentidos; card vazio e card sem dono reparados; card do escopo `gm` intocado; pasta sem dono reparada. |
| Leitura pelo jogador (5) | [controle] a consulta anterior não traz a ficha transferida só por `ownerId`; o listener novo traz a ficha transferida e até a de `visibleTo` defasado; cena liberada só pela flag chega e a oculta não; o jogador recebe os próprios cards e não o do Mestre. |
| Diário (2) | Revogar o Grupo grava `[Mestre, dono]` e escopo `player`; revogar um jogador individual remove só ele. |
| Lista do jogador (4) | Renderização real do componente: mostra a própria ficha, a compartilhada via `visibleTo` e a editável via `editableBy`; não mostra a ficha alheia só "Visível a Todos". |

Nota de método: o primeiro retorno de um listener pode vir do cache local do SDK. O harness espera o retorno do servidor (`metadata.fromCache === false`). Na primeira rodada, isso causou 1 falso negativo (28/29).

**3. Estáticas**: `oxlint` estrito com 0 erros; `oxlint` padrão com 0 erros e 10 avisos (linha de base); `vite build` ok.

### 6.4 Riscos e pendências
- **Consulta `or` em produção**: validada no emulador, mas ainda não no Firestore real. Se o servidor recusar, `subscribeVisibleCollection` registra um aviso no console e volta para a consulta simples por `visibleTo`, ou seja, para o comportamento anterior à 6.2. A migração (itens 2 e 3) continua corrigindo os dados.
- **Site publicado**: enquanto o site do `711451e` estiver no ar, o Mestre pode alternar a visibilidade de uma cena por ele, que grava só `visibleToPlayers`. O filtro novo e a consulta `or` já tratam esse caso, e a migração alinha `visibleTo` na próxima abertura pelo Mestre no código novo.
- **Não testado no navegador.** Roteiro manual: transferir uma ficha privada para um jogador; desmarcar "Visível a Todos" de uma ficha antiga; revogar o Grupo de um card; ligar a "Visão Player" com uma cena oculta.

## 7. Fase 6.3 — Alvos e Atalhos de Rolagem (concluída, 2026-11-13)

**Objetivo**: corrigir A12–A19 sem reverter V-03/V-11 (perícias e atributos continuam sem comparar Defesa).

### 7.1 Diagnóstico prévio em produção (somente leitura)
Antes das alterações, uma leitura de `campaigns/main-table/characters` mostrou:
- `7` documentos ativos (`2` pastas + `5` fichas) e `10` `rollGroups`;
- `11` atalhos ao todo (`10` `custom`, `1` `ability`, `0` de perícia/item/atributo);
- `divergentFormula: []`, `attributeIcons: []`, `skillNameDiffs: []`;
- **`customRollsWithoutRollKind: 5`** (confirmando A15 em produção);
- `hotbar`: `5` slots ocupados (`1` `ability`, `4` `custom`), `0` sem `rollId` e `0` com fórmula divergente.

### 7.2 Causas e alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/components/canvas/BoardViewport.jsx` | Centralização em `emitTargets(list)` (chama `onTargetedTokensChange` quando presente e só recorre a `onTargetedTokenChange` na ausência) nos 6 pontos de atualização; ajuste de dependências do efeito de sincronização de `tokens`/`sceneId`. | A12 |
| `src/components/layout/VTTLayout.jsx` | `setTargetedToken` move/adiciona o alvo sem descartar os demais (`null` limpa); `handleExecuteSheetRoll` resolve os alvos antes e trata rolagens personalizadas legadas só-acerto (`attackWhenTargeted`) com alvo como `ROLL_KINDS.ATTACK` / `"Acerto"`; `handleDockChatSubmit` roteia `/r` por `handleExecuteSheetRoll` mantendo `ROLL_KINDS.CHECK`. | A12, A14, A15 |
| `src/hooks/useCrossWindowSync.js` | `openCrossWindowTransport` com fallback via `localStorage` (`cp_vtt_sync_v1_packet_...`) + evento `storage` com `nonce` quando `BroadcastChannel` estiver indisponível. | A13 |
| `src/services/rollService.js` | Adicionados `isCustomAttributeShortcutIcon` e `resolveLinkedShortcutName`; `resolveDynamicRollEntry` preserva nome personalizado, ícones personalizados de atributo e `attackWhenTargeted` para rolagens personalizadas legadas só de acerto; `buildShortcutRollParams` repassa `attackWhenTargeted`; `buildHotbarSlotFromRoll` grava `customName` e mantém `rollKind: null` quando `attackWhenTargeted`; `resolveHotbarSlot` preserva `rollId: slot.rollId`. | A15, A17, A18, A19 |
| `src/services/migrationService.js` | Adicionados helpers de normalização/comparação de fórmulas (`normalizeFormula`, `sameFormula`, `matchesSourceFormula`, `findSourceByRef`, `repairMigratedRollEntry`); `linkLegacyRollEntry` só vincula quando nome e fórmula coincidem com a origem (senão mantém `"custom"`) e preserva ícones personalizados de atributo; `migrateLegacyShortcuts` repara atalhos já mal-vinculados (`rollKind == null && typeof customName !== "boolean"` e fórmula divergente) em `rollGroups` e `hotbar`, e marca `customIcon: true` em atalhos de atributo quando necessário. | A16, A17 |
| `src/components/sheets/CharacterSheetModal.jsx` | `pinToRollGroup` grava `customName: Boolean(rollEntry.customName)`; modal da Hotbar compara `Boolean(rawSlot?.rollId) && rawSlot.rollId === hotbarModalRoll.id`. | A18, A19 |
| `src/components/sheets/tabs/SheetSkillsTab.jsx` | Fixar `"Perícia ${sk.name}"` em `rollGroups` passa `customName: true`. | A18 |
| `src/components/sheets/state/useRollsFormState.js` e `src/components/sheets/tabs/SheetRollsTab.jsx` | Adicionado `crRollKind` (`"attack" \| "check"`, padrão `"attack"`) com `<select>` exibido quando `!crEffect.trim()`, salvo em rolagens sem efeito e resetado no submit. | A15 |
| `src/engines/combatEngine.js` | Correção descoberta durante o harness da 6.3: `buildTargetInfo` agora mantém `isHit: null` (em vez de `false`) quando `!isAttackRoll` ou quando não há comparação de ataque mesmo com mais de 1 alvo. | A14 / A15 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.3/`.

### 7.3 Validação

**1. Harness da 6.3 (`test-6.3.mjs`) nos emuladores do Firebase (`firestore` + `database`, projeto `demo-cpvtt-6x`): 12/12 passaram.**
- `A16` (4 casos): atalho legado homônimo mantém fórmula própria como `custom`; atalho já vinculado com fórmula divergente (`rollKind == null && typeof customName !== "boolean"`) é reparado para `custom`; atalho legitimamente vinculado (com `rollKind`) acompanha edição da origem; atalho legado com fórmula igual vincula normalmente.
- `A17`: ícone personalizado em atalho de atributo preservado na migração e reparado na `hotbar`.
- `A18` (2 casos): `"Perícia Luta"` vinculada mantém o nome salvo e resiste à renomeação da origem; atalho com `customName === false` acompanha renomeação da origem.
- `A19`: `resolveHotbarSlot` preserva `rollId` e `CharacterSheetModal.jsx` compara pelo `rollId` do slot salvo (`isThisRoll`), renderizando `"Disparo"` em `SheetRollsTab`.
- `A15`: `"Disparo"` com 3 alvos vira `ATTACK` e calcula `isHit` por alvo (`buildHotbarSlotFromRoll` mantém `rollKind: null` para preservar `attackWhenTargeted`); perícia mantém `CHECK` com `isAttackRoll: false` e `isHit: null`; `SheetRollsTab` renderiza seletor `"Ataque"`/`"Teste"` sem efeito.
- `A12 + A13`: `useCrossWindowSync` sincroniza 3 alvos (e redução para 2 alvos) via fallback `localStorage`/`storage` sem `BroadcastChannel`; `BoardViewport.emitTargets` dispara apenas `onTargetedTokensChange`.
- `A14`: `/r` da dock roteia via `handleExecuteSheetRoll` com `ROLL_KINDS.CHECK`, anexa 3 alvos e mantém `isAttackRoll: false` e `isHit: null`.

**2. Estáticas (após a última edição da 6.3)**: `npx oxlint src` com `0` erros e `10` avisos (mesma linha de base); `oxlint` estrito com `0` erros e `8` avisos; `vite build` ok (`124` módulos transformados).

### 7.4 Pendências para validação manual no navegador
- Selecionar 3 alvos numa área (ou com Ctrl/T), abrir a ficha destacada e executar `"Disparo"`, uma perícia (`"Luta"`) e `/r` da barra inferior; conferir 3 pílulas de alvo no card do chat e resultado `"Acerto"` apenas no ataque personalizado / habilidades de ataque.

## 8. Fase 6.4 — Combate (A20, A21, A23 concluídas; A22 pendente de decisão, 2026-11-13)

**Objetivo**: corrigir A20, A21 e A23, mantendo **A22** suspenso para decisão do usuário entre `(a)` Defesa do token autoritativa vs `(b)` oferecer propagação ao editar a Defesa da ficha-matriz.

### 8.1 Causas e alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/services/combatService.js` | Adicionados helpers de coordenação entre janelas em `localStorage` (`registerOpenStandaloneSheet`, `unregisterOpenStandaloneSheet`, `hasOpenStandaloneSheet`, `tryClaimSavingThrowModal`, `tryBeginSavingThrowSubmission`, `rollbackSavingThrowSubmission`, `markSavingThrowAnswered`, `isSavingThrowAnswered`). `consumeCombatCosts` passou a refletir `deductActorResources(...).deducted` em `mpChanged`/`hpChanged`. | A20, A21 |
| `src/hooks/useCrossWindowSync.js` | Passou a expor `windowId` estável (`useState(createWindowId)`), eventos `SAVE_MODAL_CLAIMED` e `SAVE_MODAL_ANSWERED` e emissores `broadcastSaveClaimed` / `broadcastSaveAnswered` sobre o mesmo transporte (`BroadcastChannel` + fallback `localStorage`). | A20 |
| `src/services/rollService.js` | `executeChatRollMessage` passou a inspecionar o retorno de `onDeductResource`: só preenche `costPaid` quando o desconto realmente ocorreu (`deducted === true`, mantendo compatibilidade caso o callback retorne `undefined`). | A21 |
| `src/components/layout/VTTLayout.jsx` | (1) `handleExecuteSheetRoll` retorna explicitamente `false` quando bloqueado por turno/ação (`!actCheck.allowed`) ou sem mensagem enviada, retorna `true` ao concluir e devolve `return await deductActorResources(...)` em `onDeductResource`. (2) Efeito de Teste de Resistência fecha `activeSavingThrowReq` assim que `respondedToSaveId` aparece em `messages`, dá prioridade à janela destacada da ficha alvo (com atraso de `120 ms` apenas quando há ficha destacada correspondente aberta) e reivindica `saveId` antes de abrir. (3) `handleExecuteSavingThrow` trava submissão via `inFlightSaveIdsRef` + `messages` + `tryBeginSavingThrowSubmission` (com `rollbackSavingThrowSubmission` em erro e `markSavingThrowAnswered` + `broadcastSaveAnswered` ao concluir). (4) `handleOpenSavingThrowModal` impede reabrir pedido já respondido. | A20, A21, A23 |
| `src/components/chat/RollMessageCard.jsx` | Botão de Teste de Resistência desabilitado (`disabled={Boolean(saveResponseMsg)}`) após resposta registrada. | A20 |
| `src/components/sheets/CharacterSheetModal.jsx` e `src/components/sheets/tabs/SheetInventoryTab.jsx` | `triggerRoll` retorna a `Promise` de `onExecuteRoll`; o botão `Usar` do inventário aguarda `await triggerRoll(...)` protegido por `usingItemRef` e só reduz `qty` (`handleAdjustItemQty(..., -1)`) se `rollAccepted !== false`. | A23 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.4/`.

### 8.2 Validação

**1. Harness da 6.4 (`test-6.4.mjs`) nos emuladores do Firebase (`firestore` + `database`, projeto `demo-cpvtt-6x`): 5/5 passaram (código de saída 0).**
- `A21` (2 casos): matriz de NPC sem token selecionado mantém MP intacto no Firestore e grava `costPaid: null` no chat (`consumeCombatCosts` retorna `mpChanged: false`); NPC com token no RTDB desconta apenas `mpCurrent` no token (`15 -> 12`) mantendo a matriz em `15` e grava `-3 MP`; PC desconta no Firestore (`10 -> 8`) e grava `-2 MP`; `VTTLayout.jsx` repassa o retorno de `deductActorResources`.
- `A20` (2 casos): coordenação exclusiva entre ficha destacada (`priority: 2`) e janela principal (`priority: 1`) impede abertura simultânea; tentativa paralela de envio entre as duas janelas (`Promise.all`) permite apenas 1 cobrança; `rollbackSavingThrowSubmission` libera em falha e `markSavingThrowAnswered` bloqueia reenvio/reabertura; `useCrossWindowSync` entrega `SAVE_MODAL_ANSWERED` à outra janela e `RollMessageCard` renderiza botão `disabled` quando respondido.
- `A23`: usando o handler real de `SheetInventoryTab.jsx` combinado a `evaluateActorAct` em turno de outro combatente, consumível não é gasto (`qty` permanece `2`, `0` rolagens); na vez do ator, executa 1 rolagem e reduz `qty` para `1`.

**2. Estáticas (após a última edição da 6.4)**: `npx oxlint src` com `0` erros e `10` avisos (linha de base); `oxlint` estrito com `0` erros e `8` avisos; `vite build` ok (`124` módulos transformados, `5,09 s`).

### 8.3 Pendência (A22) e roteiro no navegador
- **A22**: decisão pendente do usuário sobre Defesa de NPC oculto ao jogador (`(a)` manter Defesa do token e documentar vs `(b)` oferecer propagação ao editar a Defesa da ficha-matriz).
- **Navegador**: com a ficha destacada aberta e um ataque exigindo Teste de Resistência, confirmar que apenas a ficha destacada exibe o pop-up (ou que responder fecha imediatamente na outra janela) com uma única cobrança; rolar habilidade de NPC sem token selecionado e checar ausência de `-X MP` no card; tentar usar poção consumível fora do turno no Modo de Turno.

## 9. Fase 6.5 — Avatares e Perfil (concluída, 2026-11-13)

**Objetivo**: corrigir A24, A25, A26 e A27 (avatares externos na ficha no chat, identidade `"Eu (Jogador)"` ao rolar/falar, remoção definitiva da foto Google no perfil e limpeza/isolamento de `cp_pending_avatar_dataurl`).

### 9.1 Causas e alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/services/rollService.js` | (1) Adicionado helper `isPlayerAvatarRemoved(playerRecord)` (verdadeiro com `avatarRemoved === true` ou `photoURL === null` explícito sem `avatarMediaId`). (2) No ramo `!character` de `resolveSpeakerIdentity`, o fallback para `user?.photoURL` só ocorre quando `!isPlayerAvatarRemoved(playerProfile)`. (3) No ramo `character` de `resolveSpeakerIdentity`, `persistedPhotoUrl` deixou de descartar `externalPhoto` quando `character.id` existe — agora usa `character.avatarMediaId` quando há upload, senão preserva `character.avatarExternalUrl` (ou `externalPhoto` via `toPersistablePhotoUrl`). | A24, A26 |
| `src/components/chat/MessageAvatar.jsx` | Passado `msg.senderPhotoURL || null` como URL externa ao chamar `useMediaUrl(...)`. | A24 |
| `src/components/chat/ChatSidebarPanel.jsx` | Em `/r` (`/roll`) e em `handleQuickDie`, `character` passou a ser `speakAs === "player" ? null : currentIdentity.character || activeCharacter`, evitando cair para `activeCharacter` quando o usuário seleciona `"Eu (Jogador)"`. | A25 |
| `src/contexts/CampaignContext.jsx` | (1) Passou a reutilizar `readPendingAvatarDataUrl(currentUid)` / `clearPendingAvatarDataUrl()` de `src/utils/stringUtils.js` e `isPlayerAvatarRemoved` em `onlineUsers`, sincronização de `existingPlayer` e presença RTDB (`rawPhotoURL`). (2) Em `updatePlayerProfile`, grava `players.${uid}.avatarRemoved` (`true` quando foto foi removida, `false` ao definir nova foto) no Firestore e `avatarRemoved` na presença RTDB, e passa `photoURL: ""` ao `updateProfile(auth.currentUser, ...)` quando `photoChanged && !finalPhotoURL`. | A26, A27 |
| `src/components/layout/PlayerProfileModal.jsx` | `currentExternalPhoto` ignora `user?.photoURL` quando `isPlayerAvatarRemoved(myPlayerProfile)` é verdadeiro. | A26 |
| `src/utils/stringUtils.js` | Centralizados `PENDING_AVATAR_KEY`, `clearPendingAvatarDataUrl`, `savePendingAvatarDataUrl(uid, dataUrl)` (armazena `{ uid, dataUrl }`) e `readPendingAvatarDataUrl(expectedUid)` (descarta e limpa chave de outro UID). | A27 |
| `src/contexts/AuthContext.jsx` | Passou a limpar `cp_pending_avatar_dataurl` com `clearPendingAvatarDataUrl()` em `logout()`, no `onAuthStateChanged` sem usuário ou com e-mail não autorizado, e no início/falha/rejeição `!isAuth` de `loginWithGoogle`, `loginWithEmail` e `registerWithEmail`; após aprovação de `!isAuth` no cadastro, persiste `{ uid, dataUrl }` via `savePendingAvatarDataUrl`. | A27 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.5/`.

### 9.2 Validação

**1. Harness da 6.5 (`test-6.5.mjs`) nos emuladores do Firebase (`firestore` + `database`, projeto `demo-cpvtt-6x`): 4/4 passaram (código de saída 0).**
- `A24`: ficha com `avatarExternalUrl` persiste `senderPhotoURL` nas mensagens de rolagem e texto no Firestore e renderiza `<img src="...">` via `MessageAvatar`; `data:` legado continua sanitizado para `null`.
- `A25`: rolagem executada como jogador (`character: null`) preserva `characterId: null`, `characterMediaId: null` e `senderAvatarMediaId` do jogador; `ChatSidebarPanel` renderiza `<option value="player">` com a identidade do jogador sem fallback indevido para `activeCharacter`.
- `A26`: execução real de `updatePlayerProfile` contra Firestore e RTDB emulados grava `photoURL: null`, `avatarMediaId: null`, `avatarRemoved: true` e envia `{ photoURL: "" }` a `updateProfile`; `PlayerProfileModal` renderizado com `user.photoURL` do Google + perfil removido não exibe a URL do Google; `resolveSpeakerIdentity` mantém `photoURL: null`.
- `A27`: `savePendingAvatarDataUrl` + `readPendingAvatarDataUrl` isolam dados por `uid` e removem a entrada quando outro usuário autentica; verificado uso de `clearPendingAvatarDataUrl()` em todos os fluxos de `AuthContext.jsx`.

**2. Estáticas (após a última edição em `src/` da 6.5)**: `npx oxlint src` com `0` erros e `10` avisos (mesma linha de base); `oxlint` estrito com `0` erros e `8` avisos; `vite build` ok (`124` módulos transformados, `1,09 s`).

### 9.3 Roteiro no navegador
- Configurar URL externa `https://...` na ficha e enviar falas/rolagens confirmando o avatar no chat; alternar o seletor do chat para o jogador (com ficha ativa) e testar `/r 1d20` e dado rápido; remover a foto de uma conta Google no modal de perfil e recarregar a página confirmando que a foto do Google não retorna; tentar cadastrar foto em e-mail não autorizado e, sem sair da aba, entrar com outra conta verificando `sessionStorage`.

## 10. Fase 6.6 — Debounce e Diário (concluída, 2026-11-13)

**Objetivo**: corrigir A28, A29, A30 e A31 (realinhamento do rascunho em `DebouncedField`, flush antes do fechamento/ocultamento de aba em `useDebouncedCallback`, prevenção de sobrescrita concorrente em recursos/campos debounced e bloqueio/erro explícito em `NoteEditorModal` sem permissão).

### 10.1 Causas e alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/components/ui/DebouncedField.jsx` | Passou a acompanhar `mountedRef`, `isDirtyRef`, `editBaseExternalRef`, `latestExternalRef` e `commitSeqRef`. Após concluir `onCommit` (promessa resolvida/rejeitada ou microtask quando síncrono), realinha `draft` para `latestExternalRef.current` quando o banco normaliza/mantém/rejeita o valor sem alterar a prop `value`. No `useEffect([externalValue, cancel])`, quando `isDirtyRef.current && externalValue !== editBaseExternalRef.current`, cancela o timer pendente (`cancel()`) para impedir sobrescrita por alteração concorrente. | A28, A30 |
| `src/hooks/useDebouncedCallback.js` | Adicionados listeners em `window` (`pagehide`, `beforeunload`) e `document` (`visibilitychange` quando `visibilityState === "hidden"`) chamando `flush()` antes de fechar ou ocultar a aba/janela destacada, complementando o flush no unmount. | A29 |
| `src/components/sheets/tabs/SheetAttributesTab.jsx` | `handleUpdateResource` e `handleUpdateAttrValue` passaram a retornar a Promise de `onUpdateCharacter`; `handleUpdateResource` passou a gravar via dot-path ``resources.${resKey}.${field}`` quando o recurso já existe. | A28, A30 |
| `src/hooks/useCharacters.js` | `updateCharacterResource` passou a gravar ``resources.${resourceKey}.current`` via dot-path quando o recurso já existe; `syncCharacterToActiveSceneTokens` passou a ler também atualizações por dot-path (``resources.hp.current``, ``resources.hp.max``, ``resources.mp.current``, ``resources.mp.max``) para sincronizar o token no RTDB. | A30 |
| `src/services/combatService.js` | `syncTokenUpdatesToCharacter` passou a gravar via dot-path ``resources.${resKey}.current`` / ``resources.${resKey}.max`` quando `char.resources?.[resKey]` já existe, evitando sobrescrever o subcampo irmão em edições simultâneas. | A30 |
| `src/services/journalService.js` | `updateJournalNote` passou a retornar objetos explícitos `{ ok: false, reason, error }` (em vez de `undefined`) quando entrada é inválida ou `!canUserEditJournalNote`, e `{ ok: true, noteId }` após atualizar no Firestore. | A31 |
| `src/components/journal/JournalWorkspace.jsx` | `handleSaveNote` passou a retornar `await onUpdateNote(...)` e `await onCreateNote(...)` para propagar `{ ok, error }` até o modal. | A31 |
| `src/components/journal/NoteEditorModal.jsx` | Adicionados `canEdit` (via `canUserEditJournalNote`), estado `saveError` com alerta dinâmico (`role="alert"`), retorno booleano em `handleSubmitInternal`, bloqueio de `handleSubmit` sem fechar o modal quando `!ok`, e bloqueio de `handleNavigateToCard` se o auto-save falhar. Em modo somente leitura (`!canEdit`), inputs/selects/textareas de edição ficam `disabled`, botões de edição/exclusão/adição/reordenação de blocos e `Salvar Card` ficam ocultos, o rótulo de imagem recebe cursor `not-allowed` e o botão final exibe `Fechar`. | A31 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.6/`.

### 10.2 Validação

**1. Harness da 6.6 (`test-6.6.mjs`) nos emuladores do Firebase (`firestore` + `database`, projeto `demo-cpvtt-6x`): 4/4 passaram (código de saída 0).**
- `A28`: `DebouncedField` realinha `draft` para `0` após normalização síncrona (`"-5"`), após Promise resolvida mantendo `0` (`""`) e após Promise rejeitada (`"99"` -> `15`); `SheetAttributesTab` retorna Promises em `handleUpdateResource` e `handleUpdateAttrValue`.
- `A29`: `useDebouncedCallback` executa `flush()` imediatamente nos eventos `pagehide`, `beforeunload`, `visibilitychange` (`hidden`, não em `visible`) e ao desmontar, limpando listeners ao final.
- `A30`: alteração externa (`30 -> 20`) enquanto `DebouncedField` tem rascunho sujo `"2"` cancela o timer pendente sem disparar `onCommit`; em Firestore + RTDB emulados, `syncTokenUpdatesToCharacter` gravando `hp.current = 18` combinado com `handleUpdateResource("hp", "max", "40")` de snapshot antigo mantém `hp.current === 18` e `hp.max === 40` e atualiza o token no RTDB; `updateCharacterResource` preserva `hp.max === 40` e sincroniza `hpCurrent = 12` no token.
- `A31`: `updateJournalNote` retorna `{ ok: false, reason: "permission-denied", error }` para jogador sem permissão mantendo o card inalterado no Firestore, e `{ ok: true, noteId }` para o Mestre; `NoteEditorModal` em somente leitura mantém campos desabilitados, oculta controles de edição/exclusão/reordenação, exibe `"CARD DO DIÁRIO"` e `"Fechar"`, exibe `role="alert"` em tentativa inválida e não fecha o modal quando `onSave` retorna `{ ok: false, error }` ou lança erro.

**2. Estáticas (após a última edição em `src/` da 6.6)**: `npx oxlint src` com `0` erros e `10` avisos (mesma linha de base); `oxlint` estrito com `0` erros e `8` avisos; `vite build` ok (`124` módulos transformados, `1,19 s`).

### 10.3 Roteiro no navegador
- Na ficha de personagem, digitar `"-5"` ou apagar o valor de um campo numérico e sair do campo verificando que o rascunho volta ao valor persistido; digitar na biografia e fechar a janela destacada antes de 400ms confirmando que a alteração foi salva; com Mestre e jogador na mesma ficha, o Mestre aplicar dano no token enquanto o jogador altera `Vida Máx` verificando que ambos os subcampos permanecem íntegros; abrir um card compartilhado somente leitura como jogador confirmando interface travada e feedback sem fechar em erro simulado.

## 11. Fase 6.7 — Regras do Deploy, A22, A32, A33 e Layout Split (concluída, 2026-11-16)

**Objetivo**: aplicar as decisões do usuário para **A22** e **A4 (renomeação)**, corrigir **A32** e **A33**, validar as Security Rules autenticadas nos emuladores e ativar `RTDB_LAYOUT = "split"` junto ao deploy final.

### 11.1 Decisões registradas do usuário (2026-11-16)
- **A22 (Defesa de NPC oculto / instâncias em cena)**: **Manter a Defesa do token como autoritativa para instâncias em cena e documentar** — preserva a independência de instâncias de NPC no tabuleiro (equivalente a `hpCurrent`/`hpMax`), com resolução consistente entre Mestre e jogadores.
- **A4 (renomeação de pastas por `editableBy`)**: **Sim — manter `editableBy` podendo renomear/editar pastas nas regras locais**, preservando a exclusão por Soft Delete (`isDeleted`/`deletedAt`/`deletedBy`) exclusiva do dono ou do Mestre pela decisão D-3.

### 11.2 Causas e alterações

| Arquivo | Mudança | Itens |
| :--- | :--- | :--- |
| `src/engines/combatEngine.js` | (1) Exportados helpers `normalizeControlledByList`, `toControlledByMap` e `hasControlledByAccess` (aceitando formato mapa `{ uid: true }`, array legado e objeto numérico esparso do RTDB). (2) `resolveTokenTargetData` passa a priorizar `targetedToken.defense` quando o alvo é instância de NPC/Mestre (`isGmToken` ou `type === "npc"`), mantendo prioridade da ficha apenas para PCs; normaliza `controlledBy` via `normalizeControlledByList`. (3) `canUserSeeTargetDefense` passa a usar `hasControlledByAccess`. | A22, A33 |
| `src/services/combatService.js` | `spawnCharacterTokenToScene` passa a gravar `controlledBy` como mapa `{ [uid]: true }` via `toControlledByMap`. | A33 |
| `src/hooks/useRealtimeTokens.js` | `canControlToken` usa `hasControlledByAccess`; `addToken` e `updateToken` (Mestre) gravam `controlledBy` como mapa `{ [uid]: true }`; adicionado `useEffect` de migração idempotente única por token/cena (quando `IS_SPLIT_RTDB_LAYOUT && isRealGM`) convertendo arrays legados no RTDB para `{ [uid]: true }`. | A33 |
| `src/components/canvas/TokenModal.jsx` | Inicializa estado com `normalizeControlledByList` e envia `controlledBy: toControlledByMap(controlledBy)` ao salvar. | A33 |
| `src/components/layout/VTTLayout.jsx` | Verificação de controle de token selecionado (`isControlled`) passa a usar `hasControlledByAccess` (+ verificação direta de `ownerId`). | A33 |
| `src/contexts/CampaignContext.jsx` | Calculado `isAuthorizedGmByEmail` a partir de `DEFAULT_AUTHORIZED_USERS`; o espelho `gmMetaPath(campaignId)` no RTDB roda quando `(isRealGM || isAuthorizedGmByEmail) && campaignData?.gmId` (gravando `campaignData.gmId` mesmo após delegação), e `assignGM` protege execução para `(isRealGM || isAuthorizedGmByEmail)` mantendo gravação de `meta/gmId`. | A32 |
| `database.rules.json` | Regra de atualização de `tokens/$sceneId/$tokenId/.write` substituída de checagem posicional `controlledBy/0..4` para verificação de mapa: `data.child('controlledBy').child('ALL').val() === true \|\| data.child('controlledBy').child(auth.uid).val() === true`. Mantida proteção de `meta/gmId` contra sequestro por não-GM (`auth.token.email === 'erickteixeiractt@gmail.com' \|\| data.val() === auth.uid`). | A32, A33 |
| `firestore.rules` | Em `isAuthorizedGMByEmail()` / `isGM()`, adicionadas guardas `'email' in request.auth.token` e `'gmId' in ...data`; em `/folders/{folderId}` `allow update`, mantida permissão para `editableBy` (A4 rename) + proteção contra alteração de `ownerId` por não-GM + trava D-3 (`!touchesSoftDeleteFields() \|\| isResourceOwner()`). | A4, D-3 |
| `src/services/rtdbPaths.js` | `RTDB_LAYOUT` alterado de `"legacy"` para `"split"` (reativando nós `drawings/`, `pings/`, `meta/gmId`, migração `fog/.../drawings -> drawings/...` e migração de `controlledBy`). | A1–A3, A32, A33 |
| `DIRETRIZES_ARQUITETURA.md` | Documentada na §1 item 6 a decisão A22 sobre Defesa autoritativa do token para instâncias de NPC/Mestre em cena. | A22 |

Backups dos arquivos originais: scratchpad da sessão, `backups/pre-6.7/`.

### 11.3 Validação nos emuladores (regras autenticadas + layout split)
- **Harness `test-6.7.mjs` (`firestore` + `database` emulados com `firestore.rules` e `database.rules.json` reais e `RTDB_LAYOUT = "split"`): 6/6 passaram (código de saída 0).**
  1. Sanidade `auth != null`: leituras/escritas anônimas negadas no Firestore e no RTDB (`401`).
  2. Firestore D-3 + A4 rename: `editableBy` renomeia `/folders/{folderId}`, mas não aplica `isDeleted: true` nem altera `ownerId`; em `characters` e `notes`, editor edita mas não exclui; dono exclui via Soft Delete; exclusão física somente pelo Mestre.
  3. Consultas `or` da 6.2: jogador lê ficha própria com `visibleTo: []` e cena pública com `visibleToPlayers: true`, sem receber documentos secretos do Mestre.
  4. A32: jogador comum recebe `401` ao tentar inicializar `meta/gmId`; Mestre por e-mail grava `meta/gmId = "gm_delegated"`; `gm_delegated` passa a escrever em `fog/`.
  5. A33: `database.rules.json` aceita mapa `controlledBy` com 6º (`u5_extra`) e 10º (`u9_extra`) controladores em `PATCH`, nega `false` e estranho (`401`), e aceita criações/edições de autor em `drawings/` e `pings/`.
  6. Integração real `split`: `resolveTokenTargetData` mantém Defesa do token NPC (`18` vs `12` da ficha), `spawnCharacterTokenToScene` grava mapa `{ uid: true }`, e `useRealtimeTokens` + `useBoardInteractive` migram token com array de 6 posições e desenho legado de `fog/.../drawings` para `drawings/...`.

## 12. Fase 6.8 — Consolidação, Validação Final e Tabela A1–A33 (concluída, 2026-11-16)

### 12.1 Consolidação de testes e limpeza
- `auditoria_refatoracao/validar-regressoes.mjs` foi convertido na suíte consolidada local (sem rede/credenciais) cobrindo **A1–A33 + D-3** via módulos reais (`vite.ssrLoadModule`) + avaliador de `database.rules.json`, gerando `auditoria_refatoracao/resultados.json` com **20/20 verificações aprovadas**.
- Diretório temporário `.tmp-harness-6x/` removido após a validação final nos emuladores.

### 12.2 Tabela de Status Final — Itens A1–A33

| Item | Descrição resumida | Status | Subfase | Evidência / Motivo |
| :---: | :--- | :---: | :---: | :--- |
| **A1** | Pings e bola de neve no mapa | **Corrigido** | 6.1 / 6.7 | Caminho via `pingsPath`; regras novas `pings/` publicadas e layout `split` ativo. |
| **A2** | Criar e editar desenhos no tabuleiro | **Corrigido** | 6.1 / 6.7 | Caminho via `drawingsPath`; regras novas `drawings/` publicadas e validadas (`401`/`200`). |
| **A3** | Desenhos antigos em `fog/.../drawings` | **Corrigido** | 6.1 / 6.7 | Preservados na 6.1 (`legacy`) e migrados ao nó `drawings/` em `split` pelo Mestre. |
| **A4** | Jogador cria pasta de ficha e `editableBy` renomeia | **Corrigido** | 6.1 / 6.7 | `createFolder` grava `scope: "player"`; `folders` permite `editableBy` renomear mantendo D-3. |
| **A5** | Documentos legados sem `visibleTo` | **Corrigido** | 6.2 | Query `or(..., ownerId/visibleToPlayers)` + retentativa de migração (`migrationService`). |
| **A6** | Divergência `visibleTo` vs `visibleToPlayers` | **Corrigido** | 6.2 | `isReleasedToPlayers` prioriza booleano; migração alinha `visibleTo`. |
| **A7** | Transferência de ficha/pasta | **Corrigido** | 6.2 | `applyOwnerAndGmAudience` inclui novo dono em `visibleTo` e `editableBy`. |
| **A8** | Dono removido de `visibleTo` | **Corrigido** | 6.2 | `withRequiredAudience` e migração garantem `[gmUid, ownerId]` na audiência. |
| **A9** | Revogar Grupo esconde card do dono | **Corrigido** | 6.2 | `revokeJournalNoteAccess` preserva `[gmUid, ownerId]` fora do escopo `gm`. |
| **A10** | "Visão Player" exibia itens ocultos | **Corrigido** | 6.2 | Em "Visão Player", UID do Mestre real não conta como liberação em cenas/compêndio. |
| **A11** | Lista do jogador via todos com `["ALL"]` / "+ No Mapa" mudo | **Corrigido** | 6.2 | `CharactersSidebarList` filtra por dono/compartilhamento individual; "+ No Mapa" restrito a quem edita. |
| **A12** | Janela destacada recebia só 1º alvo | **Corrigido** | 6.3 | Emissão unificada em `emitTargets(list)` + preservação de lista em `setTargetedToken`. |
| **A13** | Sem fallback para `BroadcastChannel` | **Corrigido** | 6.3 | `openCrossWindowTransport` usa fallback por `localStorage` + evento `storage`. |
| **A14** | `/r` da dock perdeu alvos selecionados | **Corrigido** | 6.3 | `/r` roteado por `handleExecuteSheetRoll` anexando alvos sem comparar Defesa. |
| **A15** | Ataque personalizado só de acerto virou teste | **Corrigido** | 6.3 | `attackWhenTargeted` + seletor explícito `"Ataque"`/`"Teste"` em `SheetRollsTab`. |
| **A16** | Atalho vinculado por nome trocou fórmula | **Corrigido** | 6.3 | Só vincula se fórmula coincidir; repara atalhos mal-vinculados para `custom`. |
| **A17** | Atalho de atributo perdeu ícone personalizado | **Corrigido** | 6.3 | `isCustomAttributeShortcutIcon` marca `customIcon: true` na migração e reparo. |
| **A18** | `"Perícia Luta"` renomeado para `"Luta"` | **Corrigido** | 6.3 | `resolveLinkedShortcutName` + `customName: true` preservam o nome salvo. |
| **A19** | Hotbar na ficha não exibia `"Remover"` | **Corrigido** | 6.3 | `resolveHotbarSlot` preserva `rollId` do slot salvo para comparação no modal. |
| **A20** | Resistência em 2 janelas com cobrança dupla | **Corrigido** | 6.4 | Coordenação/prioridade por `saveId` em `localStorage` + `BroadcastChannel` + fechamento cruzado. |
| **A21** | Card mostrava custo não descontado (NPC sem token) | **Corrigido** | 6.4 | `executeChatRollMessage` só grava `costPaid` quando `onDeductResource` confirma desconto. |
| **A22** | Defesa de NPC oculto vs ficha-matriz | **Corrigido / Decidido** | 6.7 | Decisão do usuário: Defesa do token é autoritativa em cena; `resolveTokenTargetData` unificado e documentado nas Diretrizes. |
| **A23** | Consumível gasto fora do turno quando ação bloqueada | **Corrigido** | 6.4 | `SheetInventoryTab` aguarda `await triggerRoll(...) !== false` antes de reduzir `qty`. |
| **A24** | Avatar externo na ficha não aparecia no chat | **Corrigido** | 6.5 | `resolveSpeakerIdentity` preserva `avatarExternalUrl` em `senderPhotoURL`; `MessageAvatar` usa fallback externo. |
| **A25** | Foto de personagem ao falar/rolar como jogador | **Corrigido** | 6.5 | `ChatSidebarPanel` passa `character: null` em `/r` e dado rápido quando `speakAs === "player"`. |
| **A26** | "Remover foto" restaurava foto do Google | **Corrigido** | 6.5 | Flag `avatarRemoved` no Firestore/RTDB + limpeza de `photoURL: ""` no Firebase Auth + guardas na UI. |
| **A27** | `cp_pending_avatar_dataurl` vazava entre contas | **Corrigido** | 6.5 | Isolado por `{ uid, dataUrl }` em `stringUtils` e limpo em logout/falha/rejeição no `AuthContext`. |
| **A28** | Campo debounced mantinha rascunho divergente | **Corrigido** | 6.6 | `DebouncedField` realinha `draft` para valor salvo após normalização/rejeição; handlers retornam Promise. |
| **A29** | Perda das últimas teclas ao fechar aba/janela | **Corrigido** | 6.6 | `useDebouncedCallback` executa `flush()` em `pagehide`, `beforeunload`, `visibilitychange` (`hidden`) e unmount. |
| **A30** | Dano/alteração externa sobrescrita em digitação | **Corrigido** | 6.6 | `DebouncedField` cancela timer pendente em mudança externa; `resources.*` gravam por dot-path. |
| **A31** | Editor do diário fechava sem salvar sem permissão | **Corrigido** | 6.6 | `updateJournalNote` retorna `{ ok: false, error }`; `NoteEditorModal` bloqueia controles em somente leitura e exibe erro sem fechar. |
| **A32** | Primeira gravação de `meta/gmId` sem espelho inicial | **Corrigido** | 6.7 | `CampaignContext` garante espelhamento de `campaignData.gmId` pelo Mestre autorizado (carga e `assignGM`), mantendo `database.rules.json` protegida contra sequestro. |
| **A33** | `controlledBy` limitado às posições `0–4` | **Corrigido** | 6.7 | Migrado código de leitura/escrita e tokens legados para mapa `{ [uid]: true }` + validação por chave nas RTDB rules. |

- **Perdas planejadas (`B1–B17`)**: decisões arquiteturais registradas nas Fases 1–4 (`D-3`, `V-03`, `V-05`, `V-09`, `V-10`, `V-12`, `V-17`, Princípio 6 e ajustes visuais/estrutura) permanecem válidas, incluindo decisão de **B1** (`§4.3`) e ajuste explícito de **A22** / **A4 rename** (`§11.1`).

### 12.3 Roteiro de verificação pós-deploy no navegador
1. Como Mestre (`erickteixeiractt@gmail.com`), abrir cada cena da campanha após o deploy para concluir a migração automática `fog/{cena}/drawings -> drawings/{cena}` e `controlledBy` -> mapa `{ uid: true }`, encerrar o Modo de Turno (botão `■`) caso ativo, e verificar os 25 desenhos nas 3 cenas e `meta/gmId` no RTDB.
2. Em sessão dupla (Mestre + Jogador, aba principal + ficha destacada), validar: pings e desenhos de jogador em `drawings/`/`pings/`, movimentação em token compartilhado com 6+ controladores, exclusão D-3 vs renomeação de pasta via `editableBy`, consultas `or` sem fallback no console, ataque a NPC usando Defesa do token (A22), Teste de Resistência único sem cobrança dupla, avatar externo + remoção de foto Google, flush ao fechar aba destacada e card somente leitura no Diário.

## 13. Revisão Pós-6.8 e Ajuste do A20 (2026-11-16)

### 13.1 Revisão do trabalho das Fases 6.3 a 6.8 (pedido do usuário)
Verificações independentes (consultas ao Firebase de produção somente leitura, só com contagens agregadas):

| Verificação | Resultado |
| :--- | :--- |
| Site publicado × código | O Hosting publicado em 2026-11-16 12:31 UTC serve `assets/index-CxmFyjdF.js`, o mesmo arquivo gerado por um build novo do commit `5ce68c0`. |
| Regras publicadas × locais | Firestore (ruleset de 2026-11-16 12:30 UTC) e Realtime Database idênticos a `firestore.rules` e `database.rules.json`. |
| Estáticas | `oxlint` padrão com 0 erros e 10 avisos; estrito com 0 erros e 8 avisos; `vite build` ok. |
| Suíte `auditoria_refatoracao/validar-regressoes.mjs` | 20/20. |
| Teste independente das regras do RTDB publicadas (emulador, token do jogador via `?auth=`) | **18/18**. O jogador cria, move e apaga os próprios desenhos e pings; desenho alheio, camada do mapa, `fog/` e `meta/gmId` são negados; mapa `controlledBy` funciona (inclusive com 6 controladores e com `ALL`); o Mestre delegado por `meta/gmId` escreve em `fog/`; o sequestro de `meta/gmId` é negado. |
| Revisão de código (A20, A23, A30, A33, migração de desenhos) | Sem defeito funcional. Única melhoria: a renovação do registro da ficha destacada no A20 (13.2). |

**Estado real dos dados em produção (corrige a tabela 12.2 nos itens A3 e A33)**:
- os 25 desenhos estão íntegros: **3** já migrados para `drawings/` na cena ativa e **22** ainda em `fog/{cena}/drawings` em **2 cenas que o Mestre não abriu** desde o deploy;
- **9 tokens** dessas 2 cenas ainda têm `controlledBy` no formato antigo (lista). As regras novas negam o movimento deles ao jogador até a migração.
- **Ação pendente**: a migração (desenhos e `controlledBy`) só roda quando o Mestre real abre a cena, e não há pré-visualização de cena. O Mestre precisa **ativar** cada uma das 2 cenas. Atenção: ativar uma cena também a libera aos jogadores (`useScenes`). Faça isso sem jogadores online e oculte a cena de novo, se necessário.
- O Modo de Turno está desligado e `meta/gmId` existe.

### 13.2 Ajuste do A20 (renovação do registro da ficha destacada)
- **Correção de diagnóstico**: na revisão, a primeira leitura indicou que a janela principal não tratava `SAVE_MODAL_CLAIMED`. Isso estava errado: `VTTLayout` trata `onSaveClaimReceived` e fecha o pop-up local quando uma janela de prioridade maior ou igual assume o pedido.
- **Problema real (menor)**: `registerOpenStandaloneSheet` só gravava na abertura da ficha destacada, e o registro expira em `OPEN_SHEET_TTL_MS` (30 min). Depois disso, a janela principal deixava de ceder a vez (o atraso de 120 ms) e podia abrir o pop-up por um instante antes de a ficha destacada assumir. Não havia cobrança dupla: a trava `tryBeginSavingThrowSubmission` continuava valendo.
- **Alteração**: `src/components/layout/VTTLayout.jsx`. O efeito que registra a ficha destacada passou a renovar o registro a cada 5 minutos (`setInterval`) e limpa o intervalo ao desmontar.
- **Validação**: `oxlint` padrão com 0 erros e 10 avisos; estrito com 0 erros e 8 avisos; suíte 20/20; `npm run build` ok.

### 13.3 Commit e deploy
- **Autorização**: o usuário autorizou explicitamente, em 2026-11-16, o commit e o deploy desta correção ("faça a correção, commite e faça deploy").
- **Escopo do deploy**: só Hosting (`firebase deploy --only hosting`). As regras não mudaram em relação às publicadas.

---

# REFATORAÇÃO 2

Plano: `PLANO_REFATORACAO_2.md`. Cada fase registra o que foi feito, os IDs do catálogo (Seção 9) com evidência, as decisões e os desvios, e os adaptadores de transição.

## Adaptadores de transição (Seção 7.3)

| ID | Arquivo | Motivo | Criado na | Remover na |
| :--- | :--- | :--- | :--- | :--- |
| T-ENG-3 | `src/engines/diceEngine.js` | Engine legado de dados (`window`, `Math.random`) mantido em uso até a migração das rolagens para `src/engines/dice/`. | Fase 1 (TRANSITION) | Fase 9 |
| T-ENG-4 | `src/engines/formulaEngine.js` | Engine legado de fórmulas mantido em uso até a migração de fichas/rolagens para `src/engines/formula/`. | Fase 1 (TRANSITION) | Fase 9 |
| T-ENG-5 | `src/engines/combatEngine.js` | Engine legado de combate/turno (`Date.now`, `Math.random`, registro global) mantido até a substituição dos consumidores para `src/engines/{combat,turn}/`. | Fase 1 (TRANSITION) | Fase 11 (máx. Fase 13) |
| T-INFRA-3 | `src/components/scenes/ScenesManagerModal.jsx` | Importação direta de `infra/imageCompression.js` até a reescrita de cenas. | Fase 2 (TRANSITION) | Fase 12 |
| T-INFRA-5 | `src/infra/rtdbPaths.js` | Constantes `RTDB_LAYOUT`/`IS_SPLIT_RTDB_LAYOUT` e caminhos `legacyDrawingsPath`/`legacyPingsPath` mantidos até limpeza final. | Fase 2 (TRANSITION) | Fase 13 |
| T1 | `src/services/memberService.js`, `src/contexts/MembersProvider.jsx`, `src/contexts/PresenceProvider.jsx`, `src/services/presenceService.js`, `src/components/layout/VTTLayout.jsx`, `src/components/chat/ChatSidebarPanel.jsx`, `src/hooks/useChatRolls.js` | Adaptador de `members` + `presence` para `playersMap` / `onlineUsers` nos consumidores ainda v1. | Fase 3 (TRANSITION) | Fase 11 |
| T-TURN-1 | `src/services/campaignService.js` | Preserva `raw.combatState` no documento assinado para manter o `CampaignContext` compatível até a extração para `state/turn` (`M009`). | Fase 3 (TRANSITION) | Fase 11 |

## Fase 0 — Fundação e rede de segurança (2026-11-17)

### Instruções do usuário para esta fase
- **Sem commits e sem branch:** o usuário dispensou o Gate G0 (a). Nada foi commitado e a branch `refactor/v2` não foi criada. O trabalho está na árvore de trabalho da `main`, com `HEAD == abf44e8`.
- **Sem `npm run dev` por enquanto:** confirmado, antes da edição em `src/`, que nada escutava na porta 5173.
- **Dependências:** a instalação foi autorizada pelo próprio pedido da fase (Gate G0 (b)).

### O que foi feito

**1. Dependências de desenvolvimento** (versões exatas no `package.json` e no lockfile):
- `vitest` 5.1.0 e `@vitest/coverage-v8` 5.1.0;
- `@firebase/rules-unit-testing` 6.0.0;
- `firebase-admin` 14.5.1;
- `firebase-tools` 15.36.0;
- `jsdom` 29.1.1;
- `@testing-library/react` 16.3.3 e `@testing-library/dom` 10.4.2.

Nenhuma dependência existente mudou de versão no lockfile (conferido pacote a pacote contra `abf44e8`).

**2. Emuladores.**
- `firebase.json` ganhou:
  - o bloco `emulators`: Auth 9099, Firestore 8085 (websocket 9160), Database 9000, Hub 4400, Logging 4500 e interface em 4000;
  - a referência a `firestore.indexes.json` (vazio).
- `firebase.test.json` usa as mesmas regras, com portas próprias (19099, 18085/19160, 19000, 14400, 14500) e sem interface. O projeto de teste é `demo-cpvtt-test`.

**3. App em desenvolvimento contra os emuladores por padrão** (`src/services/firebase.js`):
- Com `import.meta.env.DEV` e sem `VITE_ALLOW_PRODUCTION=true`, o app conecta Auth, Firestore e RTDB aos emuladores.
- Ele recusa iniciar ("Desenvolvimento recusado…") se a configuração não for de um projeto `demo-` com as portas definidas.
- `.env.emulator` é versionado e não tem segredos; a exceção `!.env.emulator` foi adicionada ao `.gitignore`.
- `npm run dev:prod` (`scripts/dev/dev-prod.mjs`) é a única forma de liberar a produção em desenvolvimento.
- O build de produção não muda.

**4. Scripts npm:**
- novos, pedidos pelo plano: `emulators`, `dev:emu`, `test`, `test:rules`, `check`, `migrate`, `audit:schema`;
- novos, adicionais: `dev:prod`, `lint:layers`, `seed:emu`, `export:prod`, `test:coverage`;
- alterado: `dev` passou a chamar `dev:emu`.

**5. Testes de caracterização** (`tests/characterization/`, 126 testes):

| Área | Arquivo | Testes |
| :--- | :--- | :--- |
| Dados | `dice.test.js` | 8 |
| Fórmulas, só casos válidos | `formula.test.js` | 12 |
| Aliases, só casos em que os dois matchers concordam | `aliases.test.js` | 12 |
| `computeModifiedEffectValue` | `effects.test.js` | 12 |
| Geometria de AoE e régua | `geometry.test.js` | 17 |
| Modo de Turno congelado | `turn.test.js` | 31 |
| Classificação estrutural e atalhos por id | `rolls.test.js` | 34 |

- **Turno:** inclui os três cenários do plano (Mestre na Visão Player desconta, Mestre fora dela não desconta, movimento só pelo Mestre real) e o defeito congelado `actionsMax: 0 → 1`.
- **Lógica que ainda vive dentro de componentes** (desconto do turno no `VTTLayout` e no `BoardViewport`, régua e prévia de AoE, as 3 cópias da classificação nas abas da ficha):
  - o teste reproduz a expressão e a fixa por **source pin** (`tests/support/sourcePin.js`);
  - se o código mudar, o pin falha e o teste tem de migrar para a função extraída.
- **Inconsistência registrada para a Fase 1:** `effectRollKind("mp_damage")` devolve DAMAGE, enquanto `classifyRollKind({ effectType: "mp_damage" })` devolve MP_DAMAGE.

**6. Camadas e pureza em modo relatório** (`scripts/check-layers.mjs`, `npm run lint:layers`; `--strict` vira erro na Fase 13).
- `src/services/firebase.js` já conta como `infra` (vira `infra/firebase.js` na Fase 2). Importá-lo fora de services/infra conta como uso de SDK, sem contar duas vezes a mesma importação.
- **Contagem inicial: 72 violações.**

| Regra | Violações |
| :--- | :--- |
| Dependências entre camadas (5.1) | 33 |
| SDK ou adaptador do SDK fora de services/infra (4.1.1) | 30 |
| Pureza de domain/engines (4.1.2): `combatEngine` (`Date.now`, `Math.random`), `diceEngine` (`window` ×2, `Math.random`), `imageCompressor` (`document`) | 6 |
| Arquivos fora da arquitetura (`constants/` ×2, `utils/` ×1) | 3 |

**7. Snapshot e seed** (`scripts/ops/`, `scripts/lib/`):
- `export-production.mjs` é **somente leitura**. Exporta o Firestore inteiro (com subcoleções e tipos codificados), o RTDB inteiro e os usuários do Auth (sem hash de senha) para `local-data/snapshots/`. No terminal mostra só contagens.
- `seed-emulator.mjs` substitui todo o estado do emulador:
  - mantém os mesmos UIDs;
  - contas de senha recebem a senha local `pinguim123`;
  - contas Google aparecem na tela de login do emulador.
- Travas: `--target` obrigatório; produção exige `--confirm-production` e é recusada se houver variáveis de emulador no ambiente; o emulador exige projeto `demo-`. `local-data/` foi adicionado ao `.gitignore`.

**8. Migrações e auditoria** (`scripts/migrations/`):
- **Executor:** contrato `plan()` só de leitura e idempotente; simulação por padrão; limite diário de 15 mil escritas, com registro local por alvo, projeto e dia, verificado **antes** de gravar; lotes de 450; logs em `local-data/migration-logs/`.
- **`registry.mjs`:** vazio (a M001 chega na Fase 3).
- **`audit-v2.mjs`:** sem validadores registrados, termina com **código 2 (inconclusiva)** e nunca reporta "0 violações" enganoso. Os validadores entram a partir da Fase 1.

**9. Porte de `auditoria_refatoracao/validar-regressoes.mjs`** (20 verificações; o arquivo antigo continua no lugar e é removido na Fase 13, com autorização):
- **Portadas (17, algumas só na parte que continua valendo no v2):**
  - testes de unidade e de componente em `tests/regression/` (28 testes): A1-A3 (caminhos), A7-A8, A9, A10, A11, A12-A13, A14, A15 (seletor Ataque/Teste), A18-A19, A21, A22, A23, A24-A27, A28-A30, A31, A33 (spawn);
  - testes de **regras no emulador** em `tests/rules/v1-regression.test.js` (9 testes, no lugar da avaliação por `vm` e da busca de texto do script original): A1-A3, A4/D-3, A32 e A33.
- **Não portadas por deixarem de valer:**
  - A5-A6 e A16-A17: migração dentro do app, que sai na Fase 13;
  - A20: protocolo de resistência em `localStorage`, que sai na Fase 9;
  - parte A15 de "A15-A18-A19" (`attackWhenTargeted`, que sai na Fase 9);
  - a exceção por e-mail fixo em A32 (sai na Fase 3);
  - o modo "legacy" de caminhos do RTDB;
  - a exigência de o Mestre estar em `visibleTo` (A7-A9; no v2 o Mestre lê pela regra).
- **Correção encontrada no porte:** o A21 original passava `costResource`/`costAmount`, que `executeChatRollMessage` ignora. A verificação passava sem nunca exercitar o desconto. O porte passa `cost` e acrescenta um controle positivo (um PC desconta e registra `costPaid`).
- A11 é revisitado na Fase 6 (D-DER-5).

**10. Testes dos próprios scripts e do ambiente:**
- `tests/tooling/dev-environment.test.js` (8 testes): a trava do `firebase.js`, a coerência de portas entre `.env.emulator`, `firebase.json` e `firebase.test.json`, e o verificador de camadas;
- `tests/emulator/ops-scripts.test.js` (10 testes, no emulador de teste): travas de alvo, ida e volta snapshot → seed → export **idêntica** (timestamps com nanossegundos, referências, conta Google e conta de senha), login com a senha local mantendo o UID, auditoria inconclusiva, e o executor (simulação, aborto pelo limite antes de gravar, aplicação, registro do dia, idempotência).

### Evidências
- `npm run check`: código de saída 0.

| Etapa | Resultado |
| :--- | :--- |
| `oxlint` | 0 erros, **10 avisos**, todos os pré-existentes em `src/`; nenhum em `scripts/` ou `tests/` |
| Camadas | relatório com 72 violações |
| `test` | 13 arquivos, **162** testes |
| `test:rules` | 2 arquivos, **19** testes, nos emuladores de teste |
| `build` | ok; mantém o aviso de chunk acima de 500 kB (PERF-07, Fase 13) |

- **`dev:emu` com seed:**
  - emuladores de desenvolvimento no ar, semeados com um snapshot **sintético** pelo `seed:emu`;
  - Vite em modo `emulator` (porta 5180, para não ocupar a 5173), aberto num Chrome headless pelo DevTools Protocol;
  - login com a conta semeada: a campanha semeada carregou como Mestre, com **0 erros ou avisos no console**;
  - processos encerrados depois.
- **Produção:** nada foi lido nem gravado. Nenhum comando usou o projeto real; o `.env` de produção só foi lido para listar os nomes das chaves.

### IDs do catálogo
- **PROC-01 (início):** suíte versionada no emulador (`npm run test:rules`), `npm test` e caracterização. Continua aberto, como previsto: as suítes v2 do Apêndice B entram nas Fases 3, 4, 8 e 9.
- **PROC-02 (início):** regras de camadas em modo relatório, com a contagem acima. O lint segue com 10 avisos; zera na Fase 13.
- **PROC-04 (resolvido, exceto o seed real):** o desenvolvimento usa os emuladores por padrão e recusa a produção sem `dev:prod`. Coberto por `tests/tooling/dev-environment.test.js` e verificado no navegador.

### Decisões e desvios
- **Node 24.11.0 instalado contra `>=24.12` do `@firebase/rules-unit-testing` 6.0.0.** É a única versão compatível com `firebase@13`. O npm só avisa (EBADENGINE) e as suítes passam. **Recomendação:** atualizar o Node para 24.15 ou mais novo, o que também permite o `jsdom` atual (30+). `jsdom` ficou em 29.1.1, a última compatível com Node 24.11.
- **`@testing-library/dom`:** fora da lista do plano, mas é dependência obrigatória (*peer*) do `@testing-library/react`.
- **Portas:** o Firestore saiu do padrão 8080, ocupado por um Apache (`httpd`), e o websocket saiu de 9150. A 9150 está ocupada por um **emulador do Firestore órfão** de uma sessão anterior (projeto `demo-cpvtt-audit`, portas 9150 e 18081), que foi deixado como estava.
- **`firebase deploy` completo** agora também publica `firestore.indexes.json` (vazio). Deploys devem usar `--only` (anotado no README).
- **Para a Fase 1:** os módulos novos de `src/domain` e `src/engines` precisam importar com extensão explícita (`.js`). Sem isso, `scripts/migrations` (Node puro) não consegue importá-los para os validadores e as migrações.

### Entregável 8 — snapshot de produção (Gate G0 (c), concluído em 2026-11-17)
- **Autorização e credencial:** o usuário autorizou a leitura e forneceu uma chave de conta de serviço do Admin SDK, guardada **fora do repositório** (em `.secrets` no perfil do usuário). O caminho não é versionado. A credencial foi passada por `GOOGLE_APPLICATION_CREDENTIALS` só no comando. O `gcloud` não está instalado; o `--account` da CLI não foi necessário, porque o export usa só o Admin SDK.
- **Comando** (somente leitura): `npm run export:prod -- --target production --confirm-production`, gravando em `local-data/snapshots/2026-11-17T12-55-15-040Z-production/`. Contagens:

| Coleção | Documentos |
| :--- | :--- |
| `campaigns` | 1 |
| `characters` | 7 (2 são documentos legados `isFolder`) |
| `compendium` | 1 |
| `folders` | 3 |
| `media` | 5 |
| `messages` | 114 |
| `notes` | 14 (1 legado `isFolder`) |
| `scenes` | 3 |
| **Total Firestore** | **148** |
| RTDB | 18.505 bytes |
| Auth | 3 usuários: 2 Google (inclusive o Mestre) e 1 de e-mail e senha |

- **Seed** (`npm run seed:emu`): os 148 documentos, o RTDB e as 3 contas foram carregados no emulador `demo-cpvtt`.
- **App v1 contra o seed real** (Vite em modo `emulator` na porta 5180, Chrome headless pelo DevTools Protocol):
  - **Mestre** (com senha definida **só no emulador**, porque em produção ele entra com Google): 5 fichas, 13 notas e mapa ativo com tokens, imagens de `media`, desenhos e névoa;
  - **Jogador** (conta de senha, com a senha local do seed): 3 notas do grupo e mapa ativo;
  - números estáveis por 15 s nos dois papéis, com **0 erros ou avisos no console**;
  - a primeira captura, feita 2,5 s após o primeiro login com o Vite recém-aberto, saiu antes do fim do carregamento; a repetição com espera confirmou os números acima.
- **Atenção para as próximas fases:** o login do Mestre real executa a migração v1 dentro do app (`migrationService`), que altera o estado do emulador. Para voltar ao estado exato da produção, rode `npm run seed:emu` de novo.
- **Produção:** só leitura. Nenhuma escrita.

**Aceite da Fase 0:** todos os critérios foram atendidos.
- `npm run check` roda, com o relatório de camadas ainda não zerado;
- os emuladores sobem;
- o `dev:emu` funciona com o seed real;
- a produção não foi alterada.

---

## Fase 1 — Domínio e engines puros (2026-11-18)

### Instruções do usuário para esta fase
- Executar a Fase 1 completa (todos os 15 entregáveis) e parar no **Gate G1** para revisão do modelo de domínio e dos valores padrão unificados.
- Sem commits e sem deploy (diretriz global e instrução do projeto).
- Padronizar os valores padrão já existentes em `src/domain/defaults.js` com helpers puros de fábrica/cálculo para facilitar futuras alterações nas fórmulas de cálculo.
- Devido ao estouro de cota no subagente `teamwork`, os testes finais, a consolidação de documentação e a validação final foram concluídos diretamente sem `teamwork`.

### O que foi feito

**1. Fundação de domínio e contratos (`src/domain/`):**
- `src/domain/constants.js`: constantes puras do domínio (`METERS_PER_CELL = 1.5`, `PING_LIFETIME_MS = 2200`, `DEFAULT_MOVEMENT_BUDGET_METERS = 9`, `MIN_GRID_CELL_SIZE_PX = 8`, `DEFAULT_CELL_SIZE_PX = 64`, `DEFAULT_MAP_DIMENSIONS`, `CHAT_PAGE_SIZE`, `RECENT_OPS_LIMIT`), enumerações congeladas (`ROLL_KINDS`, `EFFECT_TYPES`, `EFFECT_TYPE_META`, `TRIGGER_TYPES`, `SKILL_RANGE_TYPES`, `SKILL_AOE_TYPES`, `NOTE_TYPES`, `CHARACTER_TYPES`, `TOKEN_KINDS`, `FOLDER_DOMAINS`, `NOTE_SCOPES`, `DRAWING_TYPES`, `PING_KINDS`, `LAYER_NAMES`, `COMPENDIUM_TYPES`, `MESSAGE_TYPES`, `MESSAGE_VISIBILITY`, `MESSAGE_STATUS`, `HIT_EVALUATION_STATUS`, `PENDING_COST_STATUS`, `PRESENCE_KINDS`, `RESOURCE_KEYS`, `ROLL_SOURCE_TYPES`), atributos base (`DEFAULT_ATTRIBUTES`, `SAVE_ATTRIBUTES`), `RESERVED_FORMULA_KEYS` e `ID_PREFIXES` / `VALID_ID_PREFIXES`.
- `src/domain/errors.js`: `ERROR_CODES`, `AppError`, `validationOk()`, `validationFail()`.
- `src/domain/defaults.js`: fonte única de valores padrão e funções puras de fábrica (`createDefaultCharacterResources`, `calculateDefaultCharacterDefense`, `createDefaultAttributesMap`, `createDefaultHotbar`, `createDefaultSavingThrow`, `createDefaultRange`, `createDefaultAoe`, `createDefaultAbilityCost`, `createDefaultRollGroup`, `createDefaultCharacterDefaults`, `createDefaultTokenDefaults`, `createDefaultSceneDefaults`, `createDefaultCompendiumDefaults`), unificando:
  - Personagem: HP `25/25`, MP `15/15`, Defesa `12`, deslocamento `9` m, atributos iniciais `2`.
  - Token livre: Defesa `10`, `hp: null`, `mp: null`, `showBarsToPlayers: true`.
  - Salvaguarda (`savingThrow`): `{ enabled: false, dcFormula: "12", attributeKey: "resistencia", effectDescription: "" }`.
  - Alcance (`range`): `{ type: "ranged", distanceMeters: 9 }`.
  - AoE (`aoe`): `{ type: "single", radiusMeters: 6, coneAngleDeg: 45 }`.
  - Custo de habilidade (`cost`): `{ resource: "mp", amount: 0 }`.
  - Grupo de rolagens padrão: id `grp_combate`, nome `"Ações de Combate"`.
  - Grade (`cellSizePx: 64`, `color: "#ffffff"`, `opacity: 0.28`) e Névoa (`enabled: false`, `defaultOpaque: false`).
- `src/domain/audience.js`: `computeAudience` e `assertAudience` como fonte única de cálculo e invariante de audiência.
- `src/domain/permissions.js`: predicados únicos de permissão e visibilidade (`normalizeControlledByList`, `toControlledByMap`, `hasControlledByAccess`, `canReadResource`, `canEditResource`, `canDeleteResource`, `canManageResourceAccess`, `canControlToken`, `canEditDrawing`, `canSeeSecret`, `canSeeTargetOutcome`, `isUserResponsibleForSavingThrow`).

**2. Modelos de domínio (`src/domain/models/` — 21 entidades + barrel `index.js`):**
- `imageRef.js`, `campaign.js`, `member.js`, `invite.js`, `character.js`, `folder.js`, `note.js`, `scene.js`, `compendiumEntry.js`, `message.js`, `media.js`, `turnState.js`, `chatState.js`, `pendingCost.js`, `token.js`, `drawing.js`, `ping.js`, `fog.js`, `presence.js`, `appConfig.js`, `platformAdmin.js` e `index.js`.
- Cada entidade implementa `normalize*` (aplicando defaults uma única vez), `validate*` (invariantes da Seção 6.3) e `to*Doc` / `from*Doc`, além de `splitTokenDoc` / `combineToken` / `projectPublicBars` em `token.js` e expansão de audiência em `media.js`.

**3. Infraestrutura de IDs (`src/infra/ids.js`):**
- `createId(prefix, { now, random })` validando `ID_PREFIXES` com injeção opcional de relógio/RNG e `createDeterministicSaveId(msgId)`.

**4. Engines puros (`src/engines/*/` — 11 pacotes, todos sem acesso a SDK/DOM/globais):**
- `src/engines/formula/` (`normalize.js`, `variables.js`, `parser.js`, `evaluator.js`, `index.js`): normalização única (`normalizeFormulaKey`, `stripAccents`), chaves explícitas, bloqueio de colisão entre atributo e perícia, chaves reservadas (`RESERVED_FORMULA_KEYS`), erros sinalizados `{ ok: false, error }` para variável desconhecida, token inválido (ex.: `"2x3"`) e divisão por zero (INT-11).
- `src/engines/dice/` (`dice.js`, `index.js`): `rollSingleDie` e `evaluateDiceToken` com RNG injetado.
- `src/engines/rolls/` (`rollClassifier.js`, `shortcutResolver.js`, `damageComposer.js`, `index.js`): classificação estrutural consistente incluindo `MP_HEAL`/`MP_DAMAGE`; resolução de atalhos exclusivamente por id; composição de dano respeitando `critFormula` sem fallback `|| "1d6"`.
- `src/engines/combat/` (`effectPipeline.js`, `targetResolution.js`, `triggersAndAssists.js`, `savingThrow.js`, `index.js`): pipeline de efeitos, resolução de alvo exclusivamente por id sem casar por nome (SEG-08), normalização única de gatilhos e assistências sem descartar d20 por regex, e `evaluateDcFormula` / `evaluateSavingThrowOutcome` preservando CD `0` sem `|| 10`.
- `src/engines/geometry/` (`coords.js`, `aoe.js`, `hitTest.js`, `textBounds.js`, `index.js`): centro/raio de token, cone, círculo, distância/régua com `METERS_PER_CELL`, hit-test de desenhos e `getTextBounds` considerando rotação.
- `src/engines/fog/` (`fog.js`, `index.js`): `isPointRevealed` e `partitionTokensByFog` (público/oculto).
- `src/engines/folders/` (`folders.js`, `index.js`): `buildFolderTree`, `collectDescendantFolderIds` com conjunto de visitados, `validateFolderMove` (ciclos e compatibilidade), `validateFolderName`, `validateItemFolderPlacement` e `getFolderDisplayPath`.
- `src/engines/journal/` (`sections.js`, `aliasMatcher.js`, `graph.js`, `index.js`): extração de texto a partir de `sections`, matcher único insensível a acentos respeitando `ignoredAliases` e grafo por leitor sem menções persistidas.
- `src/engines/chat/` (`chatCommandParser.js`, `index.js`): `parseChatInput` único para `/r` e `/roll`.
- `src/engines/compendium/` (`compendiumMapper.js`, `index.js`): `mapCompendiumEntryToCharacterEntry`, `normalizeSkillKey` e `resolveUniqueSkillKey` unificados.
- `src/engines/turn/` (`turnState.js`, `index.js`): máquina de turno pura extraída do `combatEngine` com comportamento U1 preservado (incluindo `actionsMax: 0 → 1`), sem registro global de hooks e sem rolagem embutida em `evaluateDcFormula`.

**5. Testes unitários (`tests/unit/` — 39 arquivos):**
- Cobertura de unidade para `domain/*`, todos os 21 modelos, `infra/ids.js`, todos os 11 pacotes em `engines/*/` e carregamento dos barrels em ESM (`tests/unit/engines/barrels.test.js`).

### Evidências
- **App v1 intacto:** nenhum arquivo legado do aplicativo em funcionamento foi modificado nesta fase; os 5 engines legados permanecem ativos apenas para o v1 e registrados acima como `TRANSITION` (`T-ENG-1` a `T-ENG-5`).
- **Suíte de testes e cobertura dos módulos novos** (`npx vitest run --coverage --coverage.include="src/domain/**" --coverage.include="src/engines/*/**" --coverage.include="src/infra/ids.js" --coverage.reporter=text`):
  - **52 arquivos de teste, 442 testes passaram** (39 suítes unitárias da Fase 1 + 13 suítes de caracterização/regressão/tooling da Fase 0).
  - **Cobertura consolidada nos módulos novos:** `98.71%` Stmts | `94.79%` Branch | `100%` Funcs | `98.70%` Lines.
  - Por pacote: `domain` (`100%` branch), `domain/models` (`92.71%` branch), `engines/chat` (`100%`), `engines/combat` (`94.41%`), `engines/compendium` (`95.93%`), `engines/dice` (`100%`), `engines/fog` (`100%`), `engines/folders` (`91.28%`), `engines/formula` (`96.70%`), `engines/geometry` (`100%`), `engines/journal` (`97.54%`), `engines/rolls` (`97.93%`), `engines/turn` (`100%`), `infra/ids.js` (`100%`).
- **Camadas e pureza (`npm run lint:layers`):** 152 arquivos analisados; **0 violações** de camada ou pureza em `src/domain/**`, `src/engines/*/**` e `src/infra/ids.js` (mantidas apenas as 72 violações pré-existentes no código legado v1).
- **Importação direta em Node ESM:** todos os módulos de domínio, engines puros e `src/infra/ids.js` utilizam extensões `.js` explícitas para consumo futuro pelos scripts de migração/auditoria.

### IDs do catálogo
- **EST-02:** núcleos puros isolados em `src/domain/**`, `src/engines/*/**` e `src/infra/ids.js` com 0 violações de pureza; engines legados isolados sob controle `TRANSITION` (`T-ENG-1` a `T-ENG-5`).
- **EST-05 (parcial):** lógica duplicada consolidada nos novos módulos puros (`audience`, `permissions`, `savingThrow`, `rollClassifier`, `triggersAndAssists`, `geometry`, `fog`, `chatCommandParser`, `compendiumMapper`); remoção nos componentes/serviços ocorre nas fases seguintes.
- **EST-06 (motores):** `rollClassifier` estrutural sem heurística textual/regex para classificar rolagem.
- **EST-11:** geração de IDs centralizada em `src/infra/ids.js` + `ID_PREFIXES` em `src/domain/constants.js`.
- **INT-11 (motor):** `src/engines/formula/` resolve normalização única, chaves explícitas, bloqueio de colisão atributo/perícia, chaves reservadas e erro sinalizado `{ ok: false, error }` para variável desconhecida, token inválido e divisão por zero.
- **MOD-11:** `src/domain/defaults.js` unifica os valores padrão por entidade (ficha, token livre, savingThrow, AoE, alcance, grupo de rolagens, grade e névoa).
- **SEG-08 (motor):** `src/engines/combat/targetResolution.js` resolve alvos exclusivamente por identificador, sem casar por nome.
- **FUN-07 (motor):** `damageComposer`, `triggersAndAssists` e `savingThrow` respeitam `critFormula`, não usam fallback `|| "1d6"` nem `|| 10` sobre `0`, e não descartam assistências com d20 por regex.
- **FUN-28:** `src/engines/journal/aliasMatcher.js` implementa matcher único insensível a acentos respeitando `ignoredAliases`.
- **FUN-31 (motor):** `src/engines/geometry/` unifica métricas com `METERS_PER_CELL`, raio de token e cálculos de círculo/cone.
- **FUN-32 (motor):** `src/engines/geometry/textBounds.js` calcula bounds de texto considerando rotação.

### Decisões e desvios
- **`AUDIT_VALIDATORS` mantido vazio na Fase 1:** `scripts/migrations/lib/auditValidators.mjs` permanece com `[]` porque os dados no emulador/snapshot ainda estão no formato v1 e o teste `tests/emulator/ops-scripts.test.js` verifica que `audit-v2.mjs` retorna código `2` (inconclusiva) sem validadores; os validadores de schema v2 entram nas fases de migração (Fase 3+).
- **Extensões `.js` explícitas:** mantidas em todas as importações relativas de `src/domain/**`, `src/engines/*/**` e `src/infra/ids.js` para compatibilidade direta com Node ESM sem bundler.
- **Extensibilidade dos cálculos padrão:** defaults em `src/domain/defaults.js` foram organizados com funções puras (`calculateDefaultCharacterDefense`, `createDefaultCharacterResources`, etc.) conforme orientação do usuário para facilitar a futura refatoração do sistema de cálculos.

**Aceite da Fase 1 (pendente Gate G1):**
- cobertura de ramos >= 90% (`94.79%` global, >= 90% por pacote) e 0 violações de pureza nos módulos novos;
- caracterização da Fase 0 e suíte completa verdes após a última edição.

---

## Fase 2 — Infraestrutura e serviços transversais (2026-11-18)

### Instruções do usuário e regras aplicadas
- Executar a Fase 2 completa (entregáveis 1 a 7, suítes de infraestrutura/serviço/contenção e registro) e parar no **Gate G2** informativo.
- Sem commits e sem deploy (regra global do usuário).
- `firestore.rules` e `database.rules.json` (ainda v1 na Fase 2) mantidos intactos até suas fases (`messages` na Fase 9).

### O que foi feito

**1. Camada de infraestrutura (`src/infra/`):**
- `src/infra/firebase.js` (movido de `src/services/firebase.js`): atualizados os 19 arquivos em `src/` e 8 em `tests/`, além do `INFRA_FILES_OUTSIDE_INFRA` em `scripts/check-layers.mjs`.
- `src/infra/firestorePaths.js`: caminhos canônicos de documentos e coleções v2 (`platformAdmins`, `appConfig/runtime`, `campaigns`, `members`, `invites`, `characters`, `folders`, `notes`, `scenes`, `compendium`, `messages`, `media`, `state/turn`, `state/chat`, `pendingCosts`) com validação de segmentos.
- `src/infra/rtdbPaths.js` (movido e expandido de `src/services/rtdbPaths.js`): cobre todos os nós do RTDB (`platformAdmins`, `meta/*`, `presence/*`, `tokens/*`, `hiddenTokens/*`, `tokenSecrets/*`, `fog/*`, `drawings/*`, `pings/*`, `.info/*`) e substitui todas as **22 ocorrências** fixas de `vtt_realtime/...` nos 6 consumidores (`CampaignContext.jsx`, `useBoardInteractive.js`, `useCharacters.js`, `useFogOfWar.js`, `useRealtimeTokens.js`, `combatService.js`).
- `src/infra/converters/` (`firestoreConverters.js`, `rtdbMappers.js`, `index.js`): `FirestoreDataConverter` para as 15 entidades do Firestore e mapeadores do RTDB para os 7 nós (`token`, `tokenSecret`, `drawing`, `ping`, `fog`, `fogArea`, `presence`), preservando sentinelas `serverTimestamp()` / `ServerValue.TIMESTAMP`.
- `src/infra/browserStorage.js` e `src/infra/clock.js`: armazenamento com namespace e rejeição de chaves `"default"`, e provedor de relógio injetável + `computeServerTime`.
- `src/infra/imageCompression.js` (movido de `src/engines/imageCompressor.js`, removendo `T-ENG-1`): extrai o `mimeType` real do `dataUrl`, falha explicitamente com `AppError(OUT_OF_RANGE)` quando excede `preset.maxBytes` após o loop adaptativo e reutiliza resultados já comprimidos sem recomprimir em Canvas. `TokenModal.jsx`, `ScenesManagerModal.jsx` e `mediaService.uploadCompressedMedia` passaram a reaproveitar a prévia comprimida.
- `src/infra/mediaCache.js` e `src/services/mediaService.js`: conexão única reutilizada no IndexedDB (`cpvtt_media_cache`), chave estrita `${campaignId}:${mediaId}` sem fallback sem campanha, e deduplicação de leituras concorrentes por chave (`inFlight`).
- `src/infra/crossWindowTransport.js` e `src/hooks/useCrossWindowSync.js`: extração do adaptador `BroadcastChannel` + fallback `localStorage`/`storage` (A13), bloqueio de canal `"default"`, geração de IDs por `createId(ID_PREFIXES.WINDOW)` e propagação de falhas via `onTransportError`.
- `src/infra/transactions.js`: `pruneRecentOps` (limite `RECENT_OPS_LIMIT = 50`), transações idempotentes `runFirestoreIdempotentTransaction` / `applyFirestoreResourceDelta` (incrementando `rev` e podando `recentOps` na mesma transação) e `runRtdbIdempotentTransaction` / `applyRtdbResourceDelta` (suportando formatos v1 e v2 e tratando a passagem especulativa `null` do SDK do RTDB).

**2. Serviços transversais e UI base (`src/services/`, `src/hooks/`, `src/components/ui/`):**
- `src/services/notificationService.js`, `src/hooks/useNotifications.js` e `src/components/ui/Toast.jsx`: fila reativa de notificações e toast respeitando `components → hooks → services`.
- `src/components/ui/ConfirmDialog.jsx` e `src/components/ui/ConfirmDeleteModal.jsx`: diálogo genérico baseado em `WindowModal` + `CPButton`; `ConfirmDeleteModal` passou a delegar para `ConfirmDialog` preservando HTML estático idêntico (`renderToStaticMarkup`).
- `src/services/operationRunner.js`: auxiliar de sagas (`createPendingOperationMessage`, `commitOperationStatus`, `runSagaOperation`, `buildPendingOperationsQuery`, `recoverPendingOperations`), incluindo `where("visibleTo", "array-contains-any", ["ALL", uid])` obrigatório para não-GM na recuperação.

**3. Novas suítes de testes (Fase 2):**
- Unitários (`tests/unit/infra/` e `tests/unit/services/` — 36 novos testes em 8 arquivos): `paths.test.js`, `converters.test.js`, `clock-and-storage.test.js`, `crossWindowTransport.test.js`, `imageCompression.test.js`, `mediaCache.test.js`, `notification-and-ui.test.jsx`, `operationRunner.test.js`.
- Emuladores (`tests/emulator/phase2-transactions-saga.test.js` — 4 testes contra `demo-cpvtt-test`): contenção simultânea com 2 clientes autenticados (`player1` e `player2`) no Firestore (`MP 10 - 2 - 3 = 5`, `rev = 2`) e no RTDB (`MP 10 - 2 - 3 = 5`), repetição idempotente de `opId`, poda de `recentOps` em 50 entradas nos dois bancos, consulta de recuperação não-GM aceita apenas com filtro `visibleTo` pelas `firestore.rules` reais e ciclo completo de saga com falhas injetadas sem cobrança dupla.

### Evidências
- `npm run check`: código de saída `0`.

| Etapa | Resultado |
| :--- | :--- |
| `oxlint` | `0` erros, `10` avisos (apenas os pré-existentes; `0` avisos nos arquivos novos) |
| Camadas (`lint:layers`) | `166` arquivos analisados; `0` violações em `src/infra/**`, `src/services/**` e `Toast.jsx`; pureza caiu de `6` para `5` (`imageCompressor.js` removido de `engines/`). Relatório total `83` (`34` camadas [+1 `Toast.jsx`→`constants/zLayers`], `41` `sdk-fora-de-services-infra` [+11 transitórios `T-INFRA-1..4`], `5` pureza, `3` fora da arquitetura) |
| `test` | `60` arquivos, `478` testes aprovados |
| `test:rules` | `3` arquivos, `23` testes aprovados nos emuladores de teste (`phase2-transactions-saga` 4, `ops-scripts` 10, `v1-regression` 9) |
| `build` | `vite build` ok (`132` módulos transformados; mantém aviso de chunk > 500 kB tratado em `PERF-07` na Fase 13) |

### IDs do catálogo
- **EST-10:** `src/infra/rtdbPaths.js` elimina todas as 22 ocorrências literais de `vtt_realtime/...` nos 6 arquivos consumidores (comprovado por scan em `tests/unit/infra/paths.test.js`).
- **INT-15 (cache e transporte):** `src/infra/mediaCache.js` exige `campaignId` explícito sem fallback por `mediaId` e rejeita `"default"`, e `src/infra/crossWindowTransport.js` / `useCrossWindowSync.js` bloqueiam canais `"default"` (coberto por `mediaCache.test.js` e `crossWindowTransport.test.js`). *(A parte de troca de campanha no `CampaignContext` permanece prevista para a Fase 3).*
- **INT-20 (infraestrutura):** removidos `catch` silenciosos em `mediaCache.js`, `browserStorage.js`, `crossWindowTransport.js`, `useCrossWindowSync.js`, `mediaService.js` e `operationRunner.js`, com erros propagados por `AppError`, `onError`/`onTransportError` ou `notificationService`.
- **PERF-04 (cache e deduplicação):** `mediaCache.js` mantém conexão única com IndexedDB (`openCalls === 1`) e deduplica chamadas concorrentes pela chave `${campaignId}:${mediaId}` (coberto por `mediaCache.test.js`).
- **FUN-27:** `src/infra/imageCompression.js` extrai o `mimeType` real do `dataUrl`, falha com `AppError(OUT_OF_RANGE)` acima de `maxBytes` e reutiliza resultados já comprimidos em `TokenModal.jsx`, `ScenesManagerModal.jsx` e `mediaService.uploadCompressedMedia` (coberto por `imageCompression.test.js`).
- **EST-08 (base):** criados `Toast.jsx` (via `useNotifications` + `notificationService`) e `ConfirmDialog.jsx`, com `ConfirmDeleteModal.jsx` migrado para `ConfirmDialog` mantendo HTML estático idêntico (`notification-and-ui.test.jsx`).
- **EST-02 (`imageCompressor`):** `src/engines/imageCompressor.js` movido para `src/infra/imageCompression.js` e removido de `engines/` (violações de pureza reduzidas de `6` para `5`).
- **EST-03 (`crossWindowTransport`, `browserStorage`):** transporte multi-janela e armazenamento local encapsulados em `src/infra/`.

### Decisões e desvios
- **Consulta e regras v1 de `messages` na Fase 2:** em `firestore.rules` v1, a criação de mensagens exige `senderId` (campo legado proibido no modelo v2) e a atualização exige `isGM(campaignId)` (a regra de transição `status` pelo remetente entra na Fase 9). Conforme revisão do plano (Opção 1), `firestore.rules` não foi alterado na Fase 2; no teste `phase2-transactions-saga.test.js`, a consulta de recuperação de não-GM (`buildPendingOperationsQuery` com `visibleTo`) é validada diretamente contra `firestore.rules` real, enquanto o ciclo completo de criação/recuperação de mensagens v2 usa `withSecurityRulesDisabled`.
- **Extensões `.js` explícitas:** mantidas nos imports relativos de `src/infra/**` e `src/services/operationRunner.js` / `notificationService.js` / `mediaService.js` para compatibilidade com Node ESM.
- **Adaptadores de transição:** `T-ENG-1` removido; registradas as importações transitórias de `infra/` pelos componentes/hooks v1 (`T-INFRA-1` a `T-INFRA-4`), flags legadas de layout em `rtdbPaths.js` (`T-INFRA-5`) e `deleteMedia` (`T-SERV-1`) até suas respectivas fases de remoção.

**Aceite da Fase 2:** todos os critérios atendidos (`npm run check` verde; contenção de dois clientes no Firestore e no RTDB e recuperação de sagas comprovadas nos emuladores). **Gate G2:** informativo.

---

## Fase 3 — Identidade, membros, autoridade do Mestre e presença (2026-11-18)

### Instruções do usuário para esta fase
- **Gate G3 (apenas informativo):** D-DER-1, D-DER-2, D-DER-7 e D-DER-8 já confirmadas. Sem commits, sem deploy e sem tocar na produção sem autorização explícita.
- **UI sem textos explicativos:** sem subtítulos ou parágrafos instrutivos antes de botões; lógica de negócio encapsulada nos serviços/regras.

### O que foi feito
- **Domínio e infra de apoio:**
  - `src/domain/constants.js` (`CLIENT_VERSION = "2.0.0"`), `src/domain/errors.js` (`CLIENT_OUTDATED`, `NOT_FOUND`, `INVALID_STATE`), `src/domain/models/appConfig.js` + `src/domain/models/index.js` (`parseSemver`, `compareSemver`, `isClientVersionOutdated`).
  - `src/infra/pendingAvatarStore.js` (armazenamento em `sessionStorage` via `createNamespacedStorage` isolado por UID, exigindo `expectedUid` explícito em `read`) em substituição às funções antes em `src/utils/stringUtils.js`.
  - Removido `src/constants/authorizedUsers.js` (`DEFAULT_AUTHORIZED_USERS` e `checkIsEmailAuthorized`).
- **Security Rules v2 de identidade, membros, autoridade e presença:**
  - `firestore.rules`: removidos `isAuthorizedGMByEmail()` e o e-mail fixo do Mestre; adicionados `hasVerifiedEmail()`, `authEmailLower()`, `isPlatformAdmin()` e `isMember(campaignId)`; `isGM(campaignId)` agora exige associação (`isMember(campaignId) && campaign.gmId == uid`); `isValidImageRef` limita o tamanho de `url` (`< 2048`); adicionadas regras para `platformAdmins/{uid}`, `appConfig/runtime`, `campaigns/{c}` (criação só por `platformAdmin` em lote com `members/{uid}`, sem `players`/`authorizedUsers`/`authorizedEmails`), `members/{uid}`, `invites/{emailLower}` (exige `emailLower == emailLower.lower()` na criação/atualização pelo Mestre, leitura do convidado verificado e exceção transacional para marcar `acceptedBy = uid` junto com `members/{uid}`) e `state/chat` (bootstrap `lastSeq == 0` e incremento `+1` ligado a `messages/{lastMessageId}`); `canSeeResource`, `notes` e `folders` restringem `scope == 'gm'` exclusivamente ao `isGM(campaignId)` (B2.5, impedindo também escalonamento de `scope` para `'gm'` por não-GM em `folders`); todas as coleções existentes (`scenes`, `characters`, `compendium`, `messages`, `notes`, `folders`, `media`, `chunks`) passaram a exigir `isMember(campaignId)`.
  - `database.rules.json`: removido `.read: "auth != null"` da raiz da campanha e removido e-mail fixo do Mestre; adicionados `platformAdmins/$uid` (`.read: auth.uid === $uid`, `.write: false`), leitura e escrita por nó restritas a `meta/members/$uid === true` (com trava impedindo auto-remoção do próprio Mestre em `meta/members/$uid`), `meta/invites` com `.read: false` e `.write` do Mestre, protocolo de delegação via `meta/pendingGm` + `meta/gmId` (exigindo `newData.exists()` em `meta/gmId`), bootstrap de `meta/gmId`/`meta/members/$uid` para `platformAdmins`, remoção de `presence/$uid` liberada exclusivamente para limpeza do Mestre (`!newData.exists()`) e validação estrita de `presence/$uid/$connId` (`kind: "main" | "sheet"`, `sheetId` opcional para `sheet`, `connectedAt` numérico e `$other: { ".validate": false }`).
- **Camada de serviços (`src/services/`):**
  - `src/services/runtimeConfigService.js`: assina `appConfig/runtime`, registra apenas `console.warn` quando ausente, mantém `clientVersionBlocked` e `assertClientUpToDate()`, registra guardas de alterações pendentes e executa `performProtectedReload`.
  - `src/services/authService.js`: login Google, login por e-mail normalizado e reset por e-mail (D-DER-2), cadastro com envio de verificação sem excluir contas (D-DER-1), `toAuthUser` sem espalhar `User`, `formatAuthError` exclusivamente por `code`, `resendVerificationEmail`, `reloadCurrentUser` (com `getIdToken(true)` quando `emailVerified` passa a `true` para atualizar a claim `email_verified` nas regras), `logout` desconectando presença ativa e garantindo `signOut` em `try/finally` além de limpar avatar pendente.
  - `src/services/campaignService.js`: resolução/persistência de `campaignId` ativo, assinatura de `campaigns/{c}` preservando `combatState` (`T-TURN-1`), `updateCampaignName`, `setActiveScene` e reexportação de `DEFAULT_CAMPAIGN_ID`.
  - `src/services/memberService.js`: `isPlatformAdmin`, `checkCampaignMembership`, `joinWithInvite` idempotente, `ensureCampaignSession`, `createCampaign` (com tradução de `permission-denied`), `inviteMember`, `revokeMember` (corte atômico em `meta/members`, `meta/invites` e `presence/{uid}` no RTDB além do Firestore), `revokeInvite`, protocolo `assignGM` em 4 passos (validando associação do alvo antes de gravar `pendingGm`, sem engolir falha no rollback do Passo 2 e tolerando `PERMISSION_DENIED` no Passo 3 quando o Passo 4 concluiu antes) + `completePendingGmTransfer`, `reconcileMirrors` (também limpando `presence/{uid}` órfã e evitando escrita redundante), detecção unificada de erros de permissão Firestore/RTDB, assinaturas `subscribeMembers`/`subscribeInvites` e adaptador `T1` `buildPlayersMapFromMembers`.
  - `src/services/profileService.js`: `compressAvatarFile`, `updateMemberProfile` (`ImageRef`, `{ mediaId: null, url: null }` limpando `photoURL` no Auth sem cair de volta na foto do Google) e `migratePendingAvatar`.
  - `src/services/presenceService.js`: `presence/{uid}/{connId}` com `.info/connected`, `onDisconnect().remove()`, serialização de remoções pendentes (`pendingRemovals`), proteção contra montagem/desmontagem dupla em `StrictMode` (`written` + registro completo de `stop`), suporte a `kind: "main"` e `kind: "sheet"` (`?sheetId=`), desconexão em massa no logout, `subscribePresence` e `buildOnlineUsersMap`/`hasSheetConnectionOpen`.
  - `src/services/mediaService.js` e `src/services/operationRunner.js`: proteção `assertClientUpToDate()` nas gravações de mídia e mensagens/status de operações.
- **Contextos, hooks e UI:**
  - `AuthContext.jsx` (com captura de erro em `logout`), `RuntimeConfigContext.js` (incluindo `useOptionalRuntimeConfig`) / `RuntimeConfigProvider.jsx`, `CampaignContext.jsx` (sem autocriação de campanha, sem role de whitelist, redefinindo `viewAsPlayer` e cache de reconciliação ao perder o cargo de Mestre), `MembersContext.js`/`MembersProvider.jsx` e `PresenceContext.js`/`PresenceProvider.jsx` com valores memorizados.
  - `DebouncedField.jsx` integrado ao guarda de alterações não salvas via `useOptionalRuntimeConfig()`.
  - Consumidores `T1` atualizados para `useMembers()` / `usePresence()` (`VTTLayout.jsx`, `ChatSidebarPanel.jsx`, `useChatRolls.js`, `useBoardInteractive.js`) mantendo compatibilidade para a UI v1.
  - `useAvatarCompression.js` criado para eliminar importação de `infra/` na camada de componentes.
  - `WindowModal.jsx` ganhou `variant="epf"` e `closeOnOverlayClick`.
  - `LoginScreen.jsx` dividido em `AuthErrorBanner.jsx`, `GoogleSignInButton.jsx`, `LoginForm.jsx`, `RegisterForm.jsx` e `ForgotPasswordForm.jsx` (sem `@clubpenguin.vtt` nem `cp_remember_pwd`), mais `VerifyEmailScreen.jsx` (exibindo feedback quando o e-mail ainda não foi verificado).
  - `GMPanelModal.jsx` e `PlayerProfileModal.jsx` reescritos usando serviços, `WindowModal`, `CPButton`, `ConfirmDialog`, `ImageRef` e `isRealGM` do contexto (sem seletor de `role`, preservando mensagem real de falha no processamento de avatar).
  - `App.jsx` atualizado com chave de sessão `user.uid:campaignId`, `RuntimeReloadGate` com confirmação de descarte de alterações não salvas, `zIndex` válido (`Z_LAYERS.portalTooltip`) e proteção contra duplo clique/unmount, `VerifyEmailScreen`, `CreateCampaignCard` (com botão de nova tentativa `onRetry`) para `platformAdmins` e `AccessDeniedScreen`.
- **Migração M001 e scripts operacionais:**
  - `scripts/migrations/lib/runner.mjs` estendido com operação `auth.verifyEmail` (`apply` chama `auth.updateUser(op.uid, { emailVerified: true })`).
  - `scripts/migrations/M001-identity.mjs` registrado em `scripts/migrations/registry.mjs`: migra `players -> members`, `authorizedUsers/authorizedEmails -> invites` (suportando mapa ou array, deduplicando e-mails normalizados), semeia `platformAdmins/{gmId}` no Firestore e RTDB, espelha `meta/gmId`, `meta/members` (removendo chaves órfãs no RTDB) e `meta/invites` pendentes, verifica e-mails de membros existentes no Auth e remove campos legados inclusive de `members/{uid}` pré-existentes de forma idempotente.
  - `scripts/ops/set-runtime-config.mjs` e `scripts/ops/set-platform-admin.mjs` criados com `--dry-run` padrão e `--apply` explícito.
- **Testes adicionados/ajustados:**
  - Unitários e UI: `appConfigSemver.test.js`, `pendingAvatarStore.test.js`, `authService.test.js`, `memberService.test.js`, `presenceService.test.js`, `profileAndCampaignService.test.js`, `runtimeConfigService.test.js`, `phase3-ui.test.jsx`, `phase3-app-gate.test.jsx`, `runtimeReloadDebounced.test.jsx`.
  - Emulador/Regras: `tests/rules/phase3-identity-gm.test.js` (Apêndice B blocos B1 e B2, presença em duas conexões, Auth Emulator + `reloadCurrentUser` + `assignGM` concorrente + limpeza de `presence` na revogação) e `tests/emulator/phase3-m001-migration.test.js`.
  - Testes existentes ajustados apenas em fixtures/pinagens de arquivos extraídos na Fase 3 sem enfraquecer asserções: `rolls-combat.test.jsx` (`pendingAvatarStore` + `profileService`), `v1-regression.test.js` e `phase2-transactions-saga.test.js` (seed explícito de `members` / `meta/members`).

### Verificações executadas
| Check | Resultado observado |
| :--- | :--- |
| `oxlint` | `0` erros, `9` avisos (`281` arquivos; `0` avisos nos arquivos novos/refatorados exceto o aviso pré-existente `only-export-components` em `AuthContext.jsx` e `CampaignContext.jsx`) |
| `lint:layers` | `185` arquivos analisados; `65` violações totais (`83 → 65`: removidos `authorizedUsers.js`, `T-INFRA-1`, `CampaignContext.jsx → infra/firebase`, e imports diretos de `infra/` em `LoginScreen.jsx` e `PlayerProfileModal.jsx`) |
| `npm run test` | `70` arquivos, `515` testes aprovados |
| `npm run test:rules` | `5` arquivos, `41` testes aprovados (`phase3-identity-gm` `11`, `phase3-m001-migration` `7`, `ops-scripts` `10`, `phase2-transactions-saga` `4`, `v1-regression` `9`) |
| `npm run build` | `vite build` ok (`183` módulos transformados em `2.62s`) |

### IDs do catálogo resolvidos na fase
- **SEG-01 / SEG-02 / SEG-04 (`meta` e `presence`):** `firestore.rules` e `database.rules.json` removem e-mail fixo, removem `.read: "auth != null"` da campanha, exigem `isMember`/`email_verified` e validam `presence/$uid/$connId` por conexão.
- **MOD-01 / MOD-02 / MOD-06 (`members`) / MOD-14:** identidade migrada para `members`, `invites` e `platformAdmins`; login exclusivamente por e-mail sem `@clubpenguin.vtt` nem limpeza de `cp_remember_pwd`; autoridade do Mestre única via `campaign.gmId`/`meta/gmId`.
- **FUN-16 / FUN-17 / FUN-19 / FUN-29:** verificação de e-mail sem exclusão de conta no cadastro, gestão de convites/membros com revogação imediata e confirmação, e perfil via `ImageRef` + `pendingAvatarStore` isolado por UID.
- **INT-14 / INT-15 / PERF-05:** `appConfig/runtime` com recarga protegida por guardas e bloqueio de escritas; `App.jsx` remonta os provedores da sessão por `${user.uid}:${campaignId}`; contextos de auth, runtime, campanha, membros e presença com valores memorizados.
- **EST-01 / EST-04:** removidos `constants/authorizedUsers.js` e `T-INFRA-1`; extraídos serviços para auth, campanha, membros, perfil, presença e runtime; reescritos `LoginScreen`, `VerifyEmailScreen`, `GMPanelModal`, `PlayerProfileModal` e `CampaignContext`.

### Decisões e desvios
- **Preservação transitória de `combatState` (`T-TURN-1`):** `campaigns.combatState` permanece permitido em atualizações de `campaigns/{c}` (bloqueado em criações novas) e preservado por `campaignService.subscribeCampaign` até a Fase 11 (`M009`), quando migra para `state/turn`.
- **`meta/invites` no RTDB com `.read: false` e limpeza por `reconcileMirrors`:** mantido `.read: false` em `vtt_realtime/$campaignId/meta/invites` (Seção 6.2); `reconcileMirrors` sobrescreve `meta/invites` inteiro a partir dos convites pendentes no Firestore sob a regra de escrita do Mestre em `meta/invites`, eliminando convites órfãos no RTDB sem exigir leitura do nó.
- **`vitest.rules.config.js` `testTimeout: 45000`:** elevado de `20000` para `45000` exclusivamente para acomodar a latência de spawn duplo de processos Node carregando `firebase-admin` em `ops-scripts.test.js` no ambiente Windows/OneDrive sem enfraquecer asserções.
- **Uso de `globalThis.sessionStorage` e `DEFAULT_CAMPAIGN_ID` via serviço:** `pendingAvatarStore.js` aceita fallback em `globalThis.sessionStorage` para testes em Node; `campaignService.js` reexporta `DEFAULT_CAMPAIGN_ID` para eliminar a última importação direta de `infra/firebase.js` em `CampaignContext.jsx`.

**Aceite da Fase 3:** todos os critérios atendidos (`npm run check` verde; blocos B1 e B2, presença em duas conexões e `M001-identity` idempotente comprovados nos emuladores). **Gate G3:** informativo.

