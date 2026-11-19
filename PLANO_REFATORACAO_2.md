# Plano da Refatoração 2 — ClubPenguinVTT

> **Status:** planejado, não iniciado. Todas as decisões do usuário foram confirmadas em 2026-11-16 (Seção 3). Revisado em 2026-11-17 por revisão independente com verificação adversarial: consistência, Firebase, cobertura e executabilidade.
> **Data:** 2026-11-16.
> **Base de código:** commit `abf44e8` (branch `main`, sincronizada com `origin/main`). Este plano ainda não está versionado: entra no primeiro commit da branch `refactor/v2` (Fase 0).
> **Executor:** Claude Opus 5.5, esforço High.
> **Origem:**
> - avaliação consolidada Claude + Codex (2026-11-16);
> - quatro auditorias de leitura por área (tabuleiro; layout, combate e chat; fichas e compêndio; diário, auth, serviços e engines);
> - decisões do usuário registradas na Seção 3.
>
> **Precedência:** até a Fase 15 reescrever o `DIRETRIZES_ARQUITETURA.md`, este documento prevalece sobre ele onde houver conflito. Instruções explícitas do usuário prevalecem sobre este documento.

---

## Sumário

1. [Objetivo](#1-objetivo)
2. [Instruções obrigatórias para o executor](#2-instruções-obrigatórias-para-o-executor)
3. [Decisões](#3-decisões)
4. [Definição de "zero débito"](#4-definição-de-zero-débito-critério-global-de-conclusão)
5. [Arquitetura-alvo](#5-arquitetura-alvo)
6. [Modelo de dados-alvo (schema v2)](#6-modelo-de-dados-alvo-schema-v2)
7. [Estratégia de migração de dados](#7-estratégia-de-migração-de-dados)
8. [Fases](#8-fases)
9. [Catálogo de pendências e rastreabilidade](#9-catálogo-de-pendências-e-rastreabilidade)
10. [Riscos e mitigação](#10-riscos-e-mitigação)
11. [Roteiros de verificação no navegador](#11-roteiros-de-verificação-no-navegador)
12. [Apêndice A — Consultas e índices](#apêndice-a--consultas-e-índices)
13. [Apêndice B — Casos adversariais obrigatórios](#apêndice-b--casos-adversariais-obrigatórios-regras-e-concorrência)

---

## 1. Objetivo

Ao final desta refatoração, **não pode existir nenhum débito técnico ou estrutural, nem no código nem no banco**. Isso significa:

- **Segurança nas regras.** Tudo o que a interface promete (acesso, autoria, visibilidade, anti-spoiler) é garantido nas Security Rules do Firestore e do Realtime Database, e não apenas no navegador.
- **Uma autoridade por dado.** Cada informação tem uma única fonte. Cópias são projeções com versão e reconciliação.
- **Mutações seguras.** Toda mutação concorrente preserva os efeitos de todos os participantes. Operações compostas são idempotentes, e falhas parciais são detectáveis e recuperáveis.
- **Dados de produção no schema v2.** Os dados são migrados uma única vez por scripts versionados e auditados. Nenhum código de compatibilidade com formatos antigos permanece no aplicativo.
- **Uma implementação por regra.** Cada regra de negócio existe em um só lugar. Componentes renderizam e despacham ações; hooks assinam e selecionam; serviços fazem I/O; engines são puros.
- **Comportamento correto e testado.** Todos os bugs do catálogo (Seção 9) estão corrigidos e cobertos por testes, inclusive testes adversariais das regras no emulador.
- **Documentação igual ao código.** O `DIRETRIZES_ARQUITETURA.md` é reescrito para descrever exatamente o estado final.

A arquitetura base **é mantida**: Firestore para dados persistentes, RTDB para estado de alta frequência do tabuleiro, plano Spark com lógica no cliente, e camadas `components → hooks/contexts → services → engines/domain/infra`. **Não** é uma troca de stack.

---

## 2. Instruções obrigatórias para o executor

### 2.1 Fontes e ordem de leitura

Leia antes da Fase 0:
1. este plano, inteiro;
2. `DIRETRIZES_ARQUITETURA.md` (estado v1: princípios e visual);
3. `REGISTRO_REFATORACAO.md`, especialmente a Validação Pós-Fase 3, a Fase 3.1, a Fase 5 §7 e as Fases 6.x;
4. `avaliacao_arquitetura_codigo.md` (auditoria original).

As referências de linha deste plano refletem o commit `abf44e8`. **Reconfirme cada referência antes de editar.** Uma das auditorias citou linhas erradas e foi corrigida aqui, mas outras podem ter se deslocado.

### 2.2 Autorizações (gates)

Estas ações exigem autorização explícita do usuário **na própria conversa**:
- `git commit`, `git push`, criação de PR;
- `firebase deploy` (rules, indexes, hosting);
- **qualquer leitura ou escrita em produção** (Firestore, RTDB ou Auth);
- remover arquivos de documentação;
- instalar dependências.

Uma autorização vale só para o escopo pedido.

- Comece pedindo, no Gate G0 (**no início da Fase 0**, antes de instalar dependências e de ler a produção), uma autorização permanente para commits locais na branch `refactor/v2`. Se negada, peça a cada fase.
- **Todo comando da Firebase CLI contra o projeto** exige `--account`: deploy de regras, índices e hosting, `database:get/set` e `auth:export`. Só uma das contas logadas na CLI tem acesso ao projeto, e ela **não** é a padrão. Pergunte ao usuário qual usar; nunca registre e-mails de conta em arquivos.
- Os gates de cada fase estão na Seção 8. No gate, apresente o que foi feito, as evidências (testes e verificação) e qualquer ponto novo que exija decisão, e aguarde a resposta. As decisões da Seção 3 já foram confirmadas pelo usuário: não as pergunte de novo.

### 2.3 Ambiente

- **Sistema e shells:** Windows 11; PowerShell 5.1 e Git Bash disponíveis. Scripts POSIX vão no Bash; comandos de PowerShell seguem a sintaxe 5.1.
- **Dev server com HMR:** o usuário mantém o Vite rodando (porta 5173) enquanto você edita. Estados intermediários de arquivo quebram a página. **Em edições de várias etapas, escreva primeiro imports e definições e só depois os usos**, ou grave o arquivo inteiro de uma vez. Se o usuário relatar `ReferenceError` com URL `?t=`, compare o horário do HMR com o do arquivo antes de assumir bug: pode bastar recarregar (F5).
- **O dev server de hoje aponta para a PRODUÇÃO.** `npm run dev` é `vite` puro, e o `.env` tem a configuração de produção. Antes da **primeira** edição em `src/` (Fase 0, entregável 4), peça ao usuário para encerrar o `npm run dev` e iniciar o `npm run dev:emu`, e confirme na resposta dele. Nunca edite `src/` com o servidor do usuário apontado para a produção: o HMR executaria o código novo contra os dados reais.
- **Plano Spark:** sem Cloud Functions, sem Storage pago e sem export gerenciado do Firestore. Cotas diárias gratuitas: 50 mil leituras, 20 mil escritas e 20 mil exclusões.
- **Produção:** projeto `clubpenguintabletop`; campanha única `main-table`; poucos dados (cerca de 5 fichas, 3 jogadores, 25 desenhos). Os dados do Mestre são de teste (decisão B1 do usuário).
- **Pendência operacional herdada:** 22 desenhos ainda estão em `fog/{cena}/drawings` e 9 tokens têm `controlledBy` em formato de lista, em 2 cenas nunca abertas pelo Mestre desde o deploy. A migração M007 resolve isso direto no RTDB.

### 2.4 Método por fase

1. Releia a seção da fase e liste os arquivos afetados, reconfirmando as referências. **Se a fase muda algum formato de dados**, liste por busca todos os leitores e escritores do formato antigo. Atualize cada um na própria fase ou registre um adaptador de transição (Seção 7.3).
2. Para engines, domínio e serviços, **escreva os testes primeiro** (caracterização do comportamento a preservar + casos novos).
3. Implemente seguindo a arquitetura-alvo (Seção 5). Não "melhore" fora do escopo da fase.
4. Rode `npm run check` (lint + camadas + testes + build) até ficar verde.
5. Rode o app contra os **emuladores** com o seed migrado até a fase atual e exercite os fluxos alterados. Os roteiros estão na Seção 11.
6. Registre a fase no `REGISTRO_REFATORACAO.md`, seção "REFATORAÇÃO 2":
   - o que foi feito;
   - IDs do catálogo resolvidos, com evidência;
   - decisões e desvios;
   - adaptadores de transição criados (Seção 7.3).
7. Abra o gate da fase.

**Nunca declare um item resolvido sem evidência:** um teste que falhava antes e passa depois, ou uma verificação descrita. Se algo deste plano estiver errado ou for inviável, **pare e pergunte**: não improvise uma alternativa silenciosa.

### 2.5 Fidelidade visual

- Os estilos inline atuais continuam sendo a fonte da verdade visual (Princípio 7 das DIRETRIZES). Ao reescrever componentes, preserve classes, valores de estilo e textos.
- Ao extrair componentes de apresentação, compare o HTML estático antes e depois (`renderToStaticMarkup`, como na Fase 5). Mudanças visuais só valem se vierem de uma decisão registrada.
- **UI limpa:** proibido adicionar textos explicativos em subtítulos ou perto de botões (Princípio 8). Retorno de erro (toast ou diálogo) é permitido.

### 2.6 O que não fazer

- Não introduzir TypeScript, bibliotecas de estado global (Redux, Zustand etc.), Cloud Functions, plano Blaze ou bibliotecas de UI. São permitidas apenas as dependências de desenvolvimento listadas na Fase 0, salvo aprovação do usuário.
- Não finalizar o Modo de Turno (Decisão U1). Apenas isolá-lo.
- Não mover a rolagem de dados para fora do navegador (Decisão U2).
- Não deixar `catch` vazio, `.catch(() => {})`, `onError: () => {}` nem falha registrada só em `console.warn` em fluxos que alteram dados.
- Não deixar código de compatibilidade com formatos antigos no aplicativo depois da Fase 13.

### 2.7 Nível de raciocínio e ultracode por fase

Base: Claude Opus 5.5 com esforço **High**. Nas fases marcadas, suba para **Extra High (xhigh)** e/ou peça **ultracode** (orquestração com vários agentes em paralelo e verificação adversarial).
- **xhigh** compensa onde o erro é sutil e caro: regras de segurança, concorrência, migração de dados reais.
- **Ultracode** compensa onde há muita amplitude (muitos arquivos ou módulos independentes) ou onde uma verificação independente, que tenta quebrar o resultado, aumenta a confiança.
- Ultracode consome bem mais tokens. **Max** não é necessário em nenhuma fase.

| Fase | Esforço | Ultracode | Por quê |
|---|---|---|---|
| 0 — Fundação | High | Não | Configuração e scripts; risco baixo e verificável executando. |
| 1 — Domínio e engines | **xhigh** | **Sim** | Núcleo de que todas as fases dependem. Cerca de 15 engines independentes (paralelizáveis), e a cobertura dos testes de caracterização precisa de verificação adversarial. |
| 2 — Infraestrutura | High | Não | Escopo pequeno; o teste de contenção já prova o essencial. |
| 3 — Identidade e autoridade | **xhigh** | **Sim** | Segurança nos dois bancos e protocolo de transferência do Mestre. Agentes tentando quebrar as regras (blocos B1 e B2) dão a certeza que um único agente não dá. |
| 4 — Visibilidade e mídia | **xhigh** | **Sim** | Regras de leitura, bypass do `ownerId` e mídia; mesma lógica da Fase 3 (blocos B3 e B4). |
| 5 — Fichas e compêndio | High | **Sim** | Muitos componentes reescritos e migração de dados reais. Ultracode pela amplitude e pela caça a regressões, não pela profundidade. |
| 6 — Pastas | **xhigh** | Não | Migração de caminho para ids em dados de produção e atomicidade de subárvores: raciocínio cuidadoso num escopo concentrado. |
| 7 — Diário | High | Não | Escopo delimitado depois das Fases 1 e 6. |
| 8 — Tabuleiro | **xhigh** | **Sim** | A fase mais complexa: decomposição do `BoardViewport`, cascata de regras do RTDB, projeção por `rev`, partição pela névoa e migração do RTDB. |
| 9 — Combate | **xhigh** | **Sim** | Sagas, idempotência, avaliação híbrida, custos de aliados, contador do chat e regras de mensagens: concorrência e falhas parciais. |
| 10 — Chat | **xhigh** | Não | Paginação por `seq`, regras com `get`/`getAfter` e índices; escopo concentrado. |
| 11 — Casca e turno | High | Não | Recomposição protegida pelos testes de caracterização. |
| 12 — Cenas | High | Não | Escopo pequeno. |
| 13 — Legado e qualidade | High | **Sim** | Varredura do código inteiro atrás de débito remanescente, por vários ângulos, até não encontrar mais nada. |
| 14 — Ensaio e cutover | **xhigh** | **Só no ensaio** | O ensaio no emulador ganha com verificação independente. Os passos em produção são executados por um único agente, com autorização a cada passo. |
| 15 — Encerramento | High | **Sim** | Auditoria final contra a Seção 4 por agentes independentes, sem o viés de quem executou. |

**Como pedir:** ajuste o esforço do modelo para Extra High antes das fases marcadas e inclua a palavra **ultracode** na mensagem. Exemplo: "ultracode: leia o PLANO_REFATORACAO_2.md inteiro e execute a Fase 8. Pare no gate." Em ultracode, o agente principal continua responsável por integrar o resultado, rodar `npm run check` e abrir o gate.

**Agentes paralelos que editam arquivos** usam worktrees isoladas, em branches temporárias `refactor/v2-*`, integradas em `refactor/v2` por merge ou cherry-pick, **sem push**. Isso exige que a autorização de commits do Gate G0 cubra também essas branches. Sem essa autorização, os agentes paralelos só leem e verificam, e as edições ficam com o agente principal.

**Emuladores:** os testes usam um `projectId` próprio (ex.: `demo-cpvtt-test`) e um conjunto de portas próprio, separado do `dev:emu` do usuário. Assim nem os testes nem os agentes paralelos limpam ou disputam o emulador em que o usuário está validando a fase.

---

## 3. Decisões

### 3.1 Decisões do usuário (2026-11-16)

| ID | Decisão | Consequência no plano |
|---|---|---|
| **U1** | **Modo de Turno:** será reformulado por completo pelo usuário depois. Não finalizar; deixar fácil de refatorar e expandir. | O Modo de Turno vira um módulo isolado: estado puro, serviço, hook, componente e política de permissão injetável. O comportamento atual fica **congelado**, inclusive os defeitos conhecidos: consumo de orçamento só pelo cliente do Mestre real (o desconto de ação acontece na Visão Player) e `actionsMax: 0` virando 1. Apenas o código comprovadamente morto é removido. O `combatState` sai do documento da campanha. A interface da política nasce na Fase 8, e o módulo é concluído na Fase 11. |
| **U2** | **Rolagens continuam no navegador** ("entre amigos"). | O modelo de confiança é aceito e documentado. Valores rolados não são verificados no servidor. Os efeitos aplicados pelo Mestre (`appliedEffects`) continuam exclusivos dele, e a avaliação de acerto segue a D-DER-3 (SEG-13). |
| **U3** | **A ficha é a verdade universal para PCs, em todos os campos sincronizados:** vida, MP, Defesa, nome, cor e imagem. Mexer em qualquer um deles pelo token, pela interface, tem de atualizar a ficha. | Os tokens de PC viram projeções versionadas da ficha. Alterações feitas pelo token gravam na ficha (transação) e a projeção se propaga a todos os tokens do PC, com reconciliação. Os NPCs continuam com instâncias independentes. Fases 5 e 8. |
| **U4** | **Pastas do Diário por ID** (`parentId`), modelo unificado com o das fichas. | Os dados de produção migram de caminho em texto para hierarquia por ID. Fichas e Diário usam um único motor de árvore. Fase 6. |
| **U5** | **Chat paginado com navegação por número de página**, no topo do chat. Histórico mantido para sempre, sem apagar. Entrar no jogo não carrega tudo. Dá para ir **direto** a uma página antiga (ex.: 20 ou 30) sem carregar as intermediárias. Páginas de **50** mensagens. Abrir páginas antigas gera leituras **só para quem abriu**, nunca multiplicadas pelos jogadores online. Páginas antigas ficam **congeladas**: lidas uma vez, sem listener. | Cada mensagem recebe um número sequencial (`seq`), gerado por um contador na mesma transação que cria a mensagem. Uma página é um intervalo fixo de `seq` e custa só as leituras das mensagens dela. A vista atual fica ao vivo; páginas antigas usam consulta única. Fase 10. |
| **U6** | **Confirmação de exclusão em tudo, exceto token e desenho.** | Inclui ficha, pasta, nota, entrada do compêndio, cena, mensagem do chat, convite ou membro, e os itens internos da ficha: item do inventário, habilidade, perícia, atributo, grupo de rolagem, rolagem fixada e slot da hotbar. No tabuleiro, apagar vários desenhos selecionados e revelar ou esconder uma área de névoa **não** pedem confirmação; os dois botões de "tudo" do Mestre (apagar todos os desenhos da cena, inclusive os dos jogadores, e recobrir o mapa inteiro com névoa) **pedem**. |

### 3.2 Respostas complementares (confirmadas pelo usuário em 2026-11-16)

| ID | Decisão | Onde está incorporada |
|---|---|---|
| **U3a** | Todos os campos sincronizados do PC (vida, MP, Defesa, nome, cor e imagem) seguem a ficha como autoridade. | U3 |
| **U5a** | Página do chat com **50** mensagens (constante única `CHAT_PAGE_SIZE`), navegação por número de página, páginas antigas congeladas e leituras só para quem abriu a página. | U5 |
| **U6a** | Seleção múltipla de desenhos e áreas de névoa: sem confirmação. Botões de "tudo" (apagar todos os desenhos e recobrir o mapa inteiro): com confirmação. | U6 |

### 3.3 Decisões anteriores que permanecem válidas

**Princípios das DIRETRIZES §1** (mantidos):
1. plano Spark com lógica no cliente;
2. arquitetura híbrida Firestore + RTDB;
3. `campaignId` em todo documento do Firestore (validado pelas regras como igual ao caminho), em toda URL e em toda chave de cache. **No RTDB, o `campaignId` vem só do caminho** `vtt_realtime/{campaignId}` e não vai no payload; a M007 remove os `campaignId` e `sceneId` gravados hoje dentro dos nós. A Fase 15 registra esse refinamento nas DIRETRIZES;
4. soft delete no Firestore e hard delete de tokens e desenhos no RTDB;
5. isolamento de autoria;
6. sincronização Ficha↔Token: PC espelhado, instâncias de NPC independentes (refinado por U3);
7. estilos inline como fonte da verdade visual;
8. UI limpa, sem textos explicativos;
9. controle de git e deploy.

**Decisões pontuais.** Os IDs A4, A6, A13, A22 e A25 citados neste plano são da série A1–A33 do `REGISTRO_REFATORACAO.md` (tabela de status da Fase 6), e não das respostas da Seção 3.2.
- **D-2:** ao excluir uma pasta escolhendo "mover itens", o conteúdo vai para a pasta pai, e as subpastas passam **inteiras** para a pasta pai, preservando a hierarquia. O escopo futuro da D-2 é implementado agora (Fase 6).
- **D-3:** só o dono exclui (soft delete) o que é seu; `editableBy` e o escopo `party` concedem apenas edição. O Mestre exclui tudo e é o único que apaga mensagens. Vale na UI, nos serviços e nas regras.
- **D-4 (registro de ações por rodada, virada de rodada confirmada pelo Mestre):** fica como **insumo** para a reformulação do Modo de Turno (U1). Não é implementada agora.
- **A22:** a Defesa da **instância de NPC** em cena é a do token, não a da ficha-matriz. Com a D-DER-4, a classificação de instância passa a ser explícita.
- **A4 (renomear):** quem está em `editableBy` pode renomear e editar pastas, mas não excluí-las.
- **V-12:** quem está em `editableBy` de uma ficha alheia pode colocar o token dela no mapa; vira dono da instância, e o dono da ficha a controla via `controlledBy`.
- **A13:** a sincronização entre janelas tem fallback por `localStorage` (evento `storage`) quando `BroadcastChannel` não existe. É mantido como adaptador de plataforma encapsulado, e não como legado.
- **Restauração de exclusões:** é feita direto no banco, sem UI de lixeira (§9 da auditoria original).

### 3.4 Decisões derivadas por este plano (todas confirmadas pelo usuário em 2026-11-16)

Estas decisões **decorrem** dos requisitos (zero débito, anti-spoiler e segurança) e foram confirmadas pelo usuário. Não pergunte de novo.

| ID | Decisão | Por quê |
|---|---|---|
| **D-DER-1** | Contas por e-mail e senha precisam de **e-mail verificado** (envio do link no cadastro; contas Google já vêm verificadas). Os membros atuais são marcados como verificados pelo script de migração, com autorização. Custo zero: o e-mail de verificação é gratuito no Spark e a checagem nas regras usa o token de login, sem leitura no banco. | Sem verificação, alguém pode criar uma conta com o e-mail de um convidado que ainda não se cadastrou e tomar o convite. |
| **D-DER-2** | **O login passa a ser só por e-mail** (ou Google). Acaba o login por apelido, que hoje traduz o apelido em e-mail por uma lista fixa no código e cai num domínio falso `@clubpenguin.vtt` ([LoginScreen.jsx:51-63](src/components/auth/LoginScreen.jsx#L51-L63)). O campo mantém o visual atual. | Traduzir apelido em e-mail antes do login exige dados públicos com e-mails, o que vaza dados pessoais, ou uma lista fixa no código, o que é débito. |
| **D-DER-3** | **Avaliação de acerto híbrida.** Se quem ataca **pode ler** a Defesa autoritativa do alvo (a ficha, para PC; `tokenSecrets`, para NPC ou token livre que ele controla), o próprio navegador dele avalia na hora, como hoje. Se **não pode** (por exemplo, um monstro do Mestre), o ataque fica "aguardando avaliação" e o **cliente do Mestre** avalia quando estiver online. Não existe botão para "revelar a Defesa" de um NPC. A Defesa e o HP dos NPCs nunca chegam a quem não os pode ler, exceto as barras autorizadas por `showBarsToPlayers`. **Custos de assistências de aliados:** aplicados pelo navegador do dono (ou editor) da ficha aliada quando estiver online, ou pelo Mestre se ele estiver online; vale quem fizer primeiro, sem desconto duplo (idempotência por `opId`). | Anti-spoiler na rede (§9.1 item 8 da auditoria) é incompatível com o atacante ler a Defesa de um alvo que ele não pode ver. E o atacante não tem permissão para gravar na ficha do aliado (INT-13). |
| **D-DER-4** | **PC e NPC só pelo campo `type`.** As fichas do Mestre hoje com `type: "pc"` (2 fichas de teste) migram para `"npc"`, preservando o comportamento atual de matriz (B1). O Mestre escolhe o tipo ao criar uma ficha (padrão `"npc"`). | A regra atual, "dono é o `gmId`", muda de significado quando o Mestre delega o papel: fichas viram matriz ou PC sem ninguém editar. |
| **D-DER-5** | **Fichas compartilhadas com um jogador** aparecem para ele numa seção por dono, só com o que foi compartilhado. As pastas do outro dono só aparecem se também forem compartilhadas. | Hoje pastas compartilhadas não aparecem ao jogador ([CharactersSidebarList.jsx:937](src/components/sheets/CharactersSidebarList.jsx#L937)). |
| **D-DER-6** | **Editor do Diário:** ao navegar para outro card com alterações não salvas, perguntar *Salvar / Descartar / Cancelar*, em vez de salvar em silêncio ([NoteEditorModal.jsx:548-555](src/components/journal/NoteEditorModal.jsx#L548-L555)). | Gravação implícita é um atalho improvisado e contraria a separação entre rascunho e persistência. |
| **D-DER-7** | **Criar campanhas** fica restrito a administradores da plataforma (`platformAdmins/{uid}`, gravado só por script com Admin SDK). Não há e-mails nas regras. | Hoje qualquer conta autenticada cria campanhas (abuso de cota). E-mail fixo nas regras é débito e dá poderes que ignoram a delegação. |
| **D-DER-8** | **Remover um convite ou membro** revoga o acesso na hora, nos dois bancos. Fichas e notas dele continuam no banco, com o mesmo dono, e o Mestre pode transferi-las. | Hoje remover da whitelist não revoga nada ([GMPanelModal.jsx:342](src/components/gm/GMPanelModal.jsx#L342)). |
| **D-DER-9** | **As 13 mensagens antigas com avatar em Base64** têm a imagem movida para documentos da coleção `campaigns/{c}/media` do **Firestore**, que já guarda imagens em Base64 (não é o Firebase Storage, indisponível no Spark). A mensagem passa a apontar para a mídia, sem perda. | Remove o formato legado sem perder dados. |

### 3.5 Fora de escopo (decidido)

- Concluir o Modo de Turno (U1).
- Autoridade de servidor para rolagens (U2).
- Cloud Functions ou plano Blaze.
- UI de lixeira e restauração.
- Migração para TypeScript.
- Novas funcionalidades não listadas aqui.

---

## 4. Definição de "zero débito" (critério global de conclusão)

A refatoração só termina quando **todos** os itens abaixo forem verdadeiros e tiverem evidência registrada (Fase 15).

### 4.1 Código

1. **Nenhum SDK fora de `services/` e `infra/`.** Componentes, hooks, contextos, `domain/` e `engines/` não importam `firebase/*` nem `infra/firebase`. Verificado por regra de lint ou pelo script de camadas.
2. **`domain/` e `engines/` são puros.** Não usam React, Firebase, `window`, `document`, `localStorage`, `sessionStorage`, `indexedDB`, `Date.now` nem `Math.random`; tempo, aleatoriedade e geração de IDs são injetados. Também verificado por lint.
3. **Cada regra de negócio tem uma implementação.** Vale para: tipo de rolagem, normalização de gatilhos e assistências, composição da fórmula de dano, valores padrão de entidades (inclusive `savingThrow`), importação do compêndio, parse de comandos do chat, resolução de identidade do remetente, predicados de permissão, motor de árvore, geometria, matcher de aliases e geração de IDs. Verificado por revisão, com a lista na Fase 15.
4. **Nenhuma heurística por nome ou regex** para classificar dados (ícone por palavra-chave, ataque por título, alvo ou personagem por nome, ícone pelo nome do item). Classificações são metadados explícitos.
5. **Nenhum código de compatibilidade com formatos antigos**, nem migração rodando dentro do aplicativo. A tabela de adaptadores de transição (Seção 7.3) está vazia.
6. **Nenhum `catch` silencioso** em fluxos que alteram dados (lint `no-empty` mais revisão). Falhas chegam ao usuário pelo serviço de notificação.
7. **Responsabilidade única.** Cada módulo descreve sua responsabilidade em uma frase, sem "e". Componentes acima de cerca de 300 linhas exigem justificativa registrada na revisão; não é proibição automática, é um sinal.
8. **Componentes base reaproveitados.** Overlays, botões, diálogos de confirmação e campos de resistência usam `components/ui/`.
9. **Estado sem duplicação.** Não há pares ref + state para o mesmo fato, formulários fragmentados em dezenas de `useState`, nem refs passadas como prop para serem mutadas. Valores de contexto são memorizados.
10. **Nenhum código morto:** exports, props, ramos e estados sem uso.
11. **`npm run check`** passa com 0 erros e **0 avisos** de lint.

### 4.2 Banco

1. Todos os documentos do Firestore e nós do RTDB de produção estão no schema v2 (Seção 6). O script de auditoria do schema reporta **0 violações**.
2. Não sobra nenhum nó ou campo legado. **Firestore:**
   - `players`, `authorizedUsers` e `combatState` no documento da campanha;
   - `visibleToPlayers` em cenas e compêndio;
   - `isFolder` e `migratedToFoldersCollection`, e documentos de pasta duplicados;
   - nas notas: `content`, `aliasesNormalized`, `mentionedNoteIds`, `graphNode` e `imageMediaId`;
   - nas mensagens: `timestampMs`, `rollData`, `skillData`, `icon` no nível raiz, e os campos soltos do remetente (`senderId`, `senderName`, `senderPhotoURL`, `senderAvatarMediaId`, `characterId` e `characterMediaId` no nível raiz);
   - nas cenas: `fogOfWar`, `mapImage.mediaId`, `mapImage.externalUrl` e `mapImage.sizeBytes`;
   - campos planos de alcance e AoE, e `qty`/`quantity` duplicados.

   **RTDB:**
   - `fog/*/drawings` e `fog/*/pings`;
   - `controlledBy` em lista e `visibleToPlayers` nos tokens (substituído por `hidden`);
   - `campaignId` e `sceneId` dentro dos nós (vêm do caminho).
3. Regras e índices publicados são idênticos aos do repositório, e os índices cobrem todas as consultas do aplicativo (Apêndice A).

### 4.3 Testes

1. As suítes de engines e domínio, serviços (contra emulador), regras (Firestore e RTDB no emulador, inclusive todos os casos do Apêndice B), concorrência (dois clientes) e migrações (fixture v1 → v2 → auditoria) passam.
2. Nenhum teste é pulado ou marcado com `.only`.
3. Os roteiros manuais da Seção 11 foram executados com o usuário após o cutover.

### 4.4 Documentação

1. O `DIRETRIZES_ARQUITETURA.md` descreve exatamente o código e os dados finais.
2. O `REGISTRO_REFATORACAO.md` contém o registro da Refatoração 2.
3. O `README.md` explica setup, emuladores, testes, scripts e o roteiro de deploy.

---

## 5. Arquitetura-alvo

### 5.1 Camadas e regras de dependência

```text
components/  →  hooks/, contexts/, domain/, engines/, components/ui/
hooks/       →  services/, domain/, engines/
contexts/    →  services/, domain/, engines/
services/    →  infra/, domain/, engines/
engines/     →  domain/
domain/      →  (nada)
infra/       →  SDKs (firebase/*, APIs do navegador)
```

- Componentes **não** importam `services/` diretamente. Ações chegam por hooks, por exemplo `useCharacterActions()`.
- Garantia: `no-restricted-imports` com `overrides` por diretório no `.oxlintrc.json`. Se o oxlint não suportar o necessário, crie `scripts/check-layers.mjs` e chame-o no `npm run check`.

### 5.2 Padrões de projeto adotados

| Padrão | Onde | Para quê |
|---|---|---|
| **Functional core, imperative shell** | `domain/` e `engines/` puros; `services/` com I/O | Regras testáveis sem Firebase nem DOM |
| **Ports & Adapters** | `infra/` (Firebase, IndexedDB, BroadcastChannel, storage, relógio, IDs) | Isolar plataforma e permitir testes |
| **Serviço por agregado** | `campaignService`, `memberService`, `characterService`, `folderService`, `journalService`, `sceneService`, `compendiumService`, `mediaService`, `chatMessageService`, `tokenService`, `drawingService`, `pingService`, `fogService`, `presenceService`, `turnService`, `combatService`, `refereeService`, `authService`, `profileService` | Um dono para cada escrita |
| **Data Mapper (`withConverter`)** | Um conversor por entidade do Firestore, mais mapeadores do RTDB | Valores padrão e normalização aplicados **uma vez**, na fronteira com o banco |
| **Command** | Métodos de serviço com entrada e saída explícitas | Mutações nomeadas, testáveis e auditáveis |
| **Saga com registro (mensagem como registro da operação)** | Rolagens com custo, dano, resistência | Idempotência por `opId`, recuperação de falhas parciais |
| **Projeção + reconciliação (CQRS-lite)** | Tokens de PC (U3), espelhos `meta/*` no RTDB | Uma autoridade, cópias convergentes |
| **Strategy / Registry** | Renderizadores de mensagem por tipo, ferramentas do tabuleiro, tipos de rolagem | Extensão sem `if/else` gigante |
| **State machine / Reducer** | Ferramentas do tabuleiro, formulários (`useReducer`), rascunho do Diário | Estado coeso e previsível |
| **Policy object** | `domain/permissions` (puro), espelhado nas regras | Mesma regra na UI, nos serviços e nas Security Rules |
| **Observer via hooks** | Assinaturas (`onSnapshot`/`onValue`) só em hooks | Ciclo de vida React controlado |
| **Injeção de dependências** | Relógio, aleatoriedade, IDs e política de turno | Determinismo nos testes; Modo de Turno trocável |

### 5.3 Árvore de diretórios-alvo

```text
src/
├── app/                        # Composição: App.jsx, MainApp.jsx, StandaloneSheetApp.jsx, providers
├── infra/                      # Adaptadores de plataforma (ÚNICO lugar com SDKs)
│   ├── firebase.js             # init + emuladores (VITE_USE_EMULATORS)
│   ├── firestorePaths.js       # caminhos do Firestore
│   ├── rtdbPaths.js            # TODOS os caminhos do RTDB (tokens, hiddenTokens, tokenSecrets, fog, drawings, pings, presence, meta)
│   ├── converters/             # FirestoreDataConverter por entidade (usa domain/models)
│   ├── mediaCache.js           # IndexedDB (conexão única) + memória, chave sempre `${campaignId}:${mediaId}`
│   ├── crossWindowTransport.js # BroadcastChannel + fallback storage-event (A13)
│   ├── browserStorage.js       # acesso seguro, chaves com namespace
│   ├── clock.js / ids.js       # provedores injetáveis de tempo e IDs
│   └── imageCompression.js     # (era engines/imageCompressor.js) Canvas/DOM
├── domain/                     # PURO: entidades, padrões, invariantes, permissões
│   ├── models/                 # campaign, member, invite, character, folder, note, scene, compendiumEntry,
│   │                           # message, media, token, drawing, ping, fog, turnState, imageRef
│   ├── defaults.js             # ÚNICA fonte de valores padrão (inclui savingThrow, ability, item, character)
│   ├── audience.js             # computeAudience + validação de invariantes de visibilidade
│   ├── permissions.js          # canRead/canEdit/canDelete/canAct/canSeeSecret… (espelha as regras)
│   ├── constants.js            # METERS_PER_CELL, ROLL_KINDS, EFFECT_TYPES, TRIGGERS, limites
│   └── errors.js               # AppError tipado (code, message, cause)
├── engines/                    # PURO: algoritmos
│   ├── formula/                # tokenizer, parser, evaluator (erros sinalizados), chaves
│   ├── dice/                   # parser NdX/kh/kl + avaliação com RNG injetado
│   ├── rolls/                  # rollClassifier (estrutural), shortcutResolver (por id), damageComposer
│   ├── combat/                 # effectPipeline, targetResolution (sem nomes), triggers/assists, savingThrow
│   ├── geometry/               # tokenCenter, cone, círculo, distância, rotação, hit-test, bounds de texto
│   ├── fog/                    # isPointRevealed, partição público/oculto
│   ├── folders/                # árvore, descendentes (com visitados), validação de movimento (ciclos)
│   ├── journal/                # texto da nota, matcher de aliases único (com ignoredAliases), grafo por leitor
│   ├── chat/                   # chatCommandParser (/r …)
│   ├── compendium/             # compendiumEntry → entrada da ficha
│   └── turn/                   # estado de turno (comportamento CONGELADO, U1)
├── services/                   # I/O por agregado (lista na Seção 5.2) + notificationService + operationRunner
├── hooks/                      # assinar + selecionar + expor ações (sem SDK)
├── contexts/                   # Auth, Campaign, Members, Presence, TargetSelection, TurnPolicy, CombatActions
└── components/                 # UI por feature + components/ui/ (base)
```

### 5.4 Convenções

- **Erros:** serviços lançam `AppError` com `code`. Hooks de ação capturam e chamam o `notificationService` (toast). Componentes nunca engolem erros.
- **IDs:** `domain/models` define os prefixos; `infra/ids.js` gera, com relógio e aleatoriedade injetáveis. IDs determinísticos onde houver unicidade de negócio, por exemplo a resposta de resistência (Fase 9).
- **Tempo:** ordenação e expiração usam o **tempo do servidor**: `serverTimestamp()` no Firestore; `ServerValue.TIMESTAMP` e `.info/serverTimeOffset` no RTDB. O relógio local nunca decide ordem nem validade.
- **Nomes:** identificadores e arquivos em inglês (como hoje); UI, docs e mensagens de commit em português.
- **Formulários:** um objeto de estado por formulário (`useReducer`), com valores iniciais vindos de `domain/defaults.js`.
- **Assinaturas:** só em hooks; dependências estáveis (ids e flags, nunca objetos inteiros recriados a cada snapshot).

---

## 6. Modelo de dados-alvo (schema v2)

Campos comuns a todos os documentos do Firestore:
- `campaignId`, validado pelas regras como igual ao caminho;
- `createdAt` e `updatedAt` (tempo do servidor);
- nas entidades com soft delete: `isDeleted` (`false` por padrão), `deletedAt` e `deletedBy`.

**`ImageRef`:** `{ mediaId: string|null, url: string|null }`. Tem no máximo um dos dois preenchido; ambos nulos significam "sem imagem". Substitui todas as combinações atuais (`avatarMediaId`, `avatarExternalUrl`, `defaultToken.mediaId/externalUrl`, `photoURL`, `avatarRemoved`, `senderPhotoURL`, `imageMediaId`).

### 6.1 Firestore

| Caminho | Campos principais | Observações |
|---|---|---|
| `platformAdmins/{uid}` | `uid`, `createdAt` | Gravado **só** por script (Admin SDK). Leitura: o próprio usuário. D-DER-7. O mesmo script grava o espelho `platformAdmins/{uid}: true` na raiz do RTDB (Seção 6.2). |
| `appConfig/runtime` | `minClientVersion`, `schemaVersion` | Leitura: autenticados. Escrita: só script (`scripts/ops/set-runtime-config.mjs`). Clientes v2, abertos ou iniciando, com versão menor são obrigados a recarregar (Fase 3). |
| `campaigns/{campaignId}` | `name`, `gmId`, `activeSceneId`, `schemaVersion` | **Sem** `players`, `authorizedUsers`, `authorizedEmails` nem `combatState`. Leitura: membros. Escrita: Mestre. Criação: administrador da plataforma, com `gmId == uid`, no lote de criação descrito na Fase 3 (`createCampaign`). |
| `campaigns/{c}/members/{uid}` | `uid`, `displayName`, `avatar: ImageRef`, `activeCharacterId`, `joinedAt` | **Sem papel gravado**: o Mestre é sempre `campaign.gmId`. Leitura: membros. **Criação:** (a) o próprio usuário com **convite válido** (abaixo); ou (b) o Mestre criando o próprio documento no lote de criação da campanha (`getAfter(campaign).gmId == uid`). Atualização: o próprio (só campos de perfil) ou o Mestre. Exclusão: Mestre. |
| `campaigns/{c}/invites/{emailLower}` | `email`, `defaultDisplayName`, `createdAt`, `acceptedBy` | Leitura: Mestre; o convidado lê o seu. Escrita: Mestre. **Exceção:** o convidado (`email_verified` e `auth.token.email.lower()` igual ao id) só grava `acceptedBy` de `null` para o próprio uid, sem tocar em outros campos, **no mesmo lote** que cria `members/{uid}`. **Convite válido** = `invites/{e-mail do token em minúsculas}` existe, `get(...).acceptedBy == null`, `getAfter(...).acceptedBy == uid` e `email_verified == true`. Removido o convite, a reentrada fica impossível (D-DER-8). |
| `campaigns/{c}/characters/{id}` | Ver 6.1.1 | Leitura conforme a audiência. Edição: dono ou `editableBy` (campos de domínio). Acesso, `type` e `ownerId`: só o Mestre. |
| `campaigns/{c}/folders/{id}` | `domain: "character"|"journal"`, `name` (um segmento, sem "/"), `parentId`, `ownerId`, `scope`* e `noteType`* (*só no Diário), `visibleTo`, `editableBy`, `order` | Modelo único (U4). |
| `campaigns/{c}/notes/{id}` | Ver 6.1.2 | |
| `campaigns/{c}/scenes/{id}` | `name`, `visibleTo`, `mapImage{ image: ImageRef, mimeType: string|null, widthPx, heightPx }`, `grid{ enabled, snapToGrid, cellSizePx (≥ mínimo), offsetX, offsetY, color, opacity }`, `fogDefaults{ enabled, defaultOpaque }` | Sem `visibleToPlayers`: "liberada" significa `"ALL"` em `visibleTo`. `mimeType` vem da mídia e é `null` para URL externa. A migração das cenas é a M010 (Fase 12). |
| `campaigns/{c}/compendium/{id}` | `type`, `name`, `category`, `icon`, `elementColor`, `visibleTo`, `cost{resource, amount}`, fórmulas, `rollKind`, `trigger`, `effectType`, `range`, `aoe`, `savingThrow`, `bonus`, `attributeKey`, `description` | Formato de custo único (aninhado). |
| `campaigns/{c}/messages/{id}` | Ver 6.1.3 | |
| `campaigns/{c}/media/{id}` | `category`, `mimeType`, `widthPx`, `heightPx`, `byteLength`, `dataUrl`, `uploadedBy`, `visibleTo` | **Imutável**, exceto pela ampliação de `visibleTo`: só acrescentar, nunca remover, feita pelo Mestre, por quem enviou ou por um membro que **já está na audiência** da mídia. Quem já lê a mídia poderia reenviá-la, então ampliar não vaza nada novo. O tamanho é validado pelo conteúdo (`dataUrl.size()`). Sem `isDeleted`, sem `chunks`. |
| `campaigns/{c}/state/turn` | `active`, `round`, `activeTurnIndex`, `lockMovementOutsideTurn`, `lockActionsOutsideTurn`, `turnOrder[…]` | U1: módulo isolado. Leitura: membros. Escrita: Mestre (por enquanto). |
| `campaigns/{c}/state/chat` | `lastSeq`, `lastMessageId` | Contador sequencial das mensagens (U5). Incrementado **na mesma escrita atômica** que cria cada mensagem, com `lastMessageId` = id dela. Leitura: membros. Criação: o Mestre, só com `lastSeq == 0`, no lote de criação da campanha; ou o script M008. Atualização: membro, só `lastSeq` (+1) e `lastMessageId`. **Não** é assinado em tempo real: o cliente o lê uma vez ao entrar no chat (página atual), e depois o último `seq` vem das mensagens recebidas pela vista atual. |
| `campaigns/{c}/pendingCosts/{opId}` | `characterId`, `sourceMessageId`, `costs{ mp?, hp? }`, `itemId|null`, `createdBy`, `status: "pending"|"applied"`, `appliedBy`, `appliedAt` | Custos de assistências de aliados (D-DER-3). Criação: membro (`createdBy == uid`, `status == "pending"`). Conclusão (`pending → applied`): o Mestre ou quem pode editar a ficha `characterId`, na mesma transação que desconta da ficha (idempotente por `opId`). Exclusão: Mestre. |

#### 6.1.1 Ficha (`characters`)

```text
type: "pc" | "npc"          // ÚNICO critério de matriz (D-DER-4)
ownerId, folderId|null, visibleTo[], editableBy[]
name, cardColor, level, xp, coins, defense
avatar: ImageRef
token: { image: ImageRef, sizeInCells, showName }
resources: { hp: {current, max}, mp: {current, max} }
attributes: { [key]: { key, label, value, order } }
skills:     { [key]: { key, name, attributeKey, bonus, order } }     // fórmula padrão vem do engine
abilities:  { [id]:  { id, name, icon, elementColor, cost{resource,amount}, hitFormula, effectFormula,
                       trigger, effectType, rollKind, range{type, distanceMeters}, aoe{type, radiusMeters, coneAngleDeg},
                       savingThrow{enabled, dcFormula, attributeKey, effectDescription}, description, order } }
inventory:  { [id]:  { id, name, icon, qty, elementColor, rollFormula, trigger, effectType, rollKind,
                       consumeOnUse, savingThrow{…}, description, order } }
rollGroups: { [id]:  { id, name, order, rolls: { [rollId]: { id, order,
                       source: { type: "ability"|"skill"|"item"|"attribute"|"custom", id|null },
                       overrides: { name?, icon?, color? },
                       custom?: { hitFormula, effectFormula, rollKind, effectType, cost{…}, savingThrow{…} } } } } }
hotbar: { "1".."9": { rollGroupId, rollId } | null }                  // só referência; resolução dinâmica
biography, notes
rev: int                       // incrementado em toda escrita; base das projeções (U3)
recentOps: { [opId]: timestamp }   // registro limitado (ex.: 50) para idempotência; podado na mesma transação
```

- **Coleções internas viram mapas indexados por id**, com `order`. Edições concorrentes em entradas diferentes não se sobrescrevem (INT-02).
- **Chaves de fórmula:** `attributes.*.key` e `skills.*.key` são estáveis, únicas entre atributos e perícias, e não colidem com chaves reservadas (`nivel`, `defesa` e as demais variáveis fixas do motor de fórmulas). Renomear não muda a chave.

#### 6.1.2 Nota (`notes`)

```text
scope: "gm" | "player" | "party", ownerId, visibleTo[], editableBy[]   // consistentes com scope (6.3)
noteType, folderId|null, title, aliases[], ignoredAliases[]
sections: { [id]: { id, title, content, order } }
relatedNoteIds[], linkedCharacterId|null, image: ImageRef
graphPosition: { x, y, pinned }, clonedFromNoteId|null, rev
```

Os campos `content`, `aliasesNormalized` e `mentionedNoteIds` são **derivados em memória**, por leitor, e não são persistidos (INT-09, SEG-11).

#### 6.1.3 Mensagem (`messages`)

```text
type: "text" | "emote" | "skill_ping" | "roll"
seq: int                                                // número sequencial único e crescente (U5); define a página
visibility: "public" | "gm_only", visibleTo[]          // gm_only → [gmId, sender.uid]
sender: { uid, characterId|null, displayName, image: ImageRef }   // retrato no momento do envio
status: "committed" | "pending" | "failed", opId|null  // pending só em sagas (Fase 9)
content (text/emote), emote?{…}, skillPing?{…}
roll?: {
  kind,                         // ROLL_KINDS explícito; nunca inferido por texto
  title, icon, color, rolls[…], costs[…],
  targets: [{ tokenId, sceneId, characterId|null, label }],
  hitEvaluation: { status: "pending"|"done"|"none", results: [{ tokenId, hit, crit, fumble }] },  // sem Defesa numérica
  savingThrowRequest?: { id, targetCharacterId|null, targetTokenId, targetSceneId, dc, attributeKey, effectDescription, sourceName },
  respondsTo?: { messageId, saveId },
  secondary?: { formula, label, effectType, deferred, rolled },
  allyCostOps: [opId…],         // referências a pendingCosts (D-DER-3)
  appliedEffects: { [opId]: { effectType, scaleMode, finalValue, targetTokenId, targetLabel, appliedBy, at } }
}
```

- **Ordenação e paginação por `seq`.** `createdAt` (servidor) fica como registro de data. `timestampMs` deixa de existir.
- **Criação = transação:** lê `state/chat.lastSeq` e grava, numa só escrita atômica, a mensagem com `seq = lastSeq + 1` e o contador com o novo `lastSeq` e `lastMessageId` = id da mensagem.
  - As regras exigem `seq == getAfter(state/chat).lastSeq == get(state/chat).lastSeq + 1` **e** `getAfter(state/chat).lastMessageId == messageId`.
  - Como as regras não distinguem transação de `writeBatch`, essa amarração por id impede duas mensagens com o mesmo `seq` na mesma escrita.
  - Um contador incrementado sem mensagem (por falha ou abuso) só deixa um buraco na numeração; é inofensivo.
- **`hitEvaluation`** (D-DER-3):
  - o remetente pode criá-la como `"done"` quando avaliou no próprio navegador (alvo cuja Defesa ele pode ler; a confiança segue a U2), ou como `"pending"`;
  - depois da criação, só o Mestre altera (`pending → done`).
- **`appliedEffects`** é sempre vazio na criação e só o Mestre grava (SEG-13).

### 6.2 Realtime Database (`vtt_realtime/{campaignId}`)

| Nó | Conteúdo | Leitura | Escrita |
|---|---|---|---|
| `platformAdmins/{uid}` (raiz do RTDB, fora de `vtt_realtime`) | `true` | o próprio usuário | **só** Admin SDK (script). Espelho de `platformAdmins` do Firestore, usado no bootstrap de `meta/gmId` |
| `meta/gmId` | uid | membros | Mestre atual (protocolo de transferência); `pendingGm` concluindo a transferência; **bootstrap:** `!data.exists() && newData.val() === auth.uid && root.child('platformAdmins').child(auth.uid).val() === true` |
| `meta/pendingGm` | uid ou null | membros | Mestre atual |
| `meta/members/{uid}` | `true` | membros | o próprio usuário, com `auth.token.email_verified === true` e `meta/invites/{emailKey}` existente; ou o Mestre |
| `meta/invites/{emailKey}` | `true` | ninguém (só avaliação nas regras) | Mestre. `emailKey` = e-mail em minúsculas com `.` trocado por `,`, calculado pela mesma função de `domain` no cliente e por `auth.token.email.toLowerCase().replace('.', ',')` na regra |
| `presence/{uid}/{connId}` | `{ kind: "main"|"sheet", sheetId|null, connectedAt }` | membros | o próprio usuário |
| `tokens/{sceneId}/{tokenId}` | **público:** `id, kind: "pc"|"npc"|"free", characterId|null, ownerId, controlledBy{uid:true}|{ALL:true}, layer, hidden, label|null, image: ImageRef, x, y, sizeInCells, rotation, ringColor, showName, bars|null, rev, updatedAt, updatedBy` | membros | criar e excluir: Mestre ou dono; posição e rotação: controladores; **campos administrativos** (`controlledBy`, `kind`, `characterId`, `ownerId`, `layer`, `hidden`): só o Mestre; **projeção** (`label`, `image`, `bars`, `ringColor`, `rev`, `updatedAt`, `updatedBy`): Mestre, `ownerId` do token ou uid em `controlledBy` (inclusive `ALL`), com `newData.rev > data.rev`. As regras do RTDB não leem o `editableBy` da ficha |
| `hiddenTokens/{sceneId}/{tokenId}` | mesmo formato do público (inclui `hidden`) | **só o Mestre** | só o Mestre |
| `tokenSecrets/{sceneId}/{tokenId}` | `defense`, `hp{current,max}`, `mp{…}` (autoridade de NPC e token livre), `showBarsToPlayers`, `recentOps{}` | Mestre; dono e controladores **por token** | `.write` **no nó do token** (exceção à regra geral, por causa das transações): (1) Mestre; (2) dono do token, para criar e excluir **junto com o token** na mesma atualização multi-caminho (na criação, o `ownerId` do token novo é verificado por `newData`, não por `root`); (3) controladores, só atualizando nó existente por transação em `hp.current`, `mp.current` e `recentOps`. Em `defense`, `hp.max`, `mp.max` e `showBarsToPlayers`, um `.validate` exige o valor inalterado quando quem escreve não é o Mestre |
| `fog/{sceneId}` | `enabled`, `areas{…}`, `updatedAt` | membros | só o Mestre |
| `drawings/{sceneId}/{id}` | formato validado por `type` (`stroke`, `rect`, `circle`, `text`); `authorId`; `layer` imutável para quem não é Mestre | membros | criar: autor membro; editar e excluir: autor ou Mestre |
| `pings/{sceneId}/{id}` | `{ authorId, kind: "ping"|"snowball", x, y, from?{x,y}, color, createdAt }`. `createdAt` = `ServerValue.TIMESTAMP`, validado `== now`. **Não existe `expiresAt`**: o RTDB não gera "agora + duração", e um valor do cliente poderia ser forjado | membros | criar: autor; excluir: autor, Mestre ou **qualquer membro, se expirado** (`now > createdAt + PING_LIFETIME_MS`; a constante, hoje 2200 ms, fica em `domain/constants` e é repetida na regra, com um teste comparando os dois valores) |

**Regras gerais do RTDB:**
- Não existe mais `.read` em `vtt_realtime/$campaignId`. No RTDB, uma permissão dada num nó acima **não** pode ser revogada mais abaixo; por isso a leitura é concedida nó a nó.
- Escritas por campo usam `.write` nos filhos. O `.write` no `$tokenId` só cobre criação e exclusão. **Exceção:** em `tokenSecrets`, o `.write` fica no nó do token, e as restrições por campo ficam em `.validate`.
- Todo nó tem `.validate` de tipos, campos obrigatórios e domínios.
- `campaignId` e `sceneId` não são gravados dentro dos nós; vêm do caminho (Seção 3.3, princípio 3).

**Partição público/oculto (SEG-06), mantida pelo cliente do Mestre:**
- um token vai para `hiddenTokens` quando `hidden == true` (ocultado pelo Mestre; vale para **qualquer** tipo, inclusive PC; fica oculto também para o dono e os controladores, como hoje), ou quando é NPC/token livre **sem controlador jogador** e está sob a névoa;
- a névoa nunca oculta tokens de PC nem tokens controlados por jogadores;
- o recálculo pela névoa nunca publica um token com `hidden == true`;
- mover entre os nós é sempre uma atualização multi-caminho atômica.

### 6.3 Invariantes (validadas no domínio, nos serviços e, quando possível, nas regras)

1. **Audiência:**
   - o `ownerId` está sempre em `visibleTo` e em `editableBy`;
   - `"ALL"` em `visibleTo` significa público entre membros;
   - o Mestre lê tudo pela regra, sem precisar estar na lista;
   - `scope == "party"` ⇔ `"ALL"` em `visibleTo` e em `editableBy`;
   - `scope == "gm"` ⇒ não há `"ALL"`, e leitura e escrita são **só do Mestre atual** (regra `isGM`), seja quem for o `ownerId`. Na criação, o `ownerId` é o Mestre atual; depois, ele é só registro de autoria. Assim, após `assignGM(B)`, B acessa os recursos `gm` criados por A, e A deixa de acessá-los. Nenhuma regra nem a auditoria compara esse `ownerId` com o `gmId` fora da criação.
2. **`ownerId`:** imutável para quem não é Mestre, **inclusive contra remoção**. Campos de acesso (`visibleTo`, `editableBy`, `scope`, `type`) seguem a matriz de permissão: em fichas, só o Mestre; em notas, o dono ou o Mestre.
3. **Hierarquia:**
   - uma pasta e seu pai são do mesmo `domain`;
   - no domínio `character`, a subárvore inteira tem um único dono;
   - no domínio `journal`, mesma combinação (`scope`, `noteType`) e, no escopo `player`, mesmo dono;
   - sem ciclos; `name` sem "/".
4. **Itens em pastas:** uma ficha ou nota só fica numa pasta compatível (mesmo dono no domínio `character`; mesmos `scope` e `noteType` no Diário).
5. **`ImageRef`:** no máximo um entre `mediaId` e `url`.
6. **Chaves de fórmula:** únicas entre atributos e perícias da ficha e diferentes das reservadas.
7. **Mídia:** uma mídia referenciada por um recurso tem `visibleTo` ⊇ a audiência desse recurso (ampliação antes da publicação).
8. **Projeção de PC:** cada token de PC tem `rev` igual ao `rev` da ficha depois da reconciliação. Uma escrita de projeção com `rev` menor é ignorada.
9. **Unicidade de resposta:** existe no máximo uma resposta por `saveId` (ID determinístico).
10. **Idempotência:** uma operação com `opId` já registrado em `recentOps`, em `appliedEffects` ou em `pendingCosts` com `status == "applied"` não é aplicada de novo.
11. **Sequência do chat:** cada mensagem tem um `seq` único; `seq` nunca é reutilizado nem alterado depois da criação; `state/chat.lastSeq` é sempre ≥ o maior `seq` existente.

### 6.4 Contrato de segurança (resumo; os testes do Apêndice B são normativos)

| Recurso | Ler | Criar | Atualizar | Excluir |
|---|---|---|---|---|
| `campaigns/{c}` | membro | admin da plataforma (`gmId == uid`), no lote de `createCampaign` | Mestre | — (nenhum; só script) |
| `members/{uid}` | membro | o próprio, com convite válido (Seção 6.1); ou o Mestre criando o próprio documento no lote de criação da campanha | o próprio (perfil) ou Mestre | Mestre |
| `invites/*` | Mestre; o convidado lê o seu | Mestre | Mestre; o convidado verificado só grava `acceptedBy` de `null` para o próprio uid, no lote que cria `members/{uid}` | Mestre |
| `characters` | Mestre ou audiência | membro (`ownerId == uid`, `type == "pc"`) ou Mestre | dono ou editor: campos de domínio; Mestre: tudo | Mestre (hard delete); soft delete: dono ou Mestre |
| `folders`, `notes` | Mestre ou audiência; com `scope == "gm"`, só o Mestre | membro, com escopo permitido e `ownerId == uid`; ou Mestre | editor: conteúdo; dono ou Mestre: acesso e soft delete; `ownerId` imutável; com `scope == "gm"`, só o Mestre | Mestre |
| `scenes`, `compendium` | Mestre ou audiência | Mestre | Mestre | Mestre |
| `messages` | Mestre ou audiência. **Regras não filtram:** toda consulta de quem não é Mestre precisa restringir `visibleTo` (Apêndice A) | membro, com `sender.uid == uid`, formato válido, `seq` igual ao contador incrementado na mesma escrita atômica (com `lastMessageId` igual ao id da mensagem) e `appliedEffects` vazio; resposta de resistência só pelo responsável e uma única vez | remetente: `status` `pending → committed|failed`; Mestre: `hitEvaluation` (`pending → done`), `appliedEffects`, soft delete. `seq` nunca muda | Mestre |
| `media` | Mestre ou audiência | membro, com `uploadedBy == uid` e tamanho medido no conteúdo | ampliar `visibleTo` (só acrescentar; `diff().affectedKeys().hasOnly(['visibleTo'])` e a lista nova contém a antiga): Mestre, quem enviou ou membro da audiência atual | — |
| `state/turn` | membro | Mestre | Mestre | Mestre |
| `state/chat` | membro | Mestre, só com `lastSeq == 0`, no lote de criação da campanha; ou script (M008) | membro: só `lastSeq` (+1) e `lastMessageId` | — |
| `pendingCosts` | Mestre; criador; quem pode editar a ficha `characterId` | membro (`createdBy == uid`, `pending`) | `pending → applied`: Mestre ou editor da ficha `characterId` | Mestre |

**Limites das regras do Firestore:** no máximo 10 chamadas `get`/`exists` por requisição de documento único e 20 por transação ou lote. Use `let` e funções para reaproveitar leituras. A verificação de membro é um `exists`; a de Mestre, um `get` da campanha.

### 6.5 Índices

Todo índice composto fica em `firestore.indexes.json`, referenciado no `firebase.json`.

**Atenção:** o emulador do Firestore **não exige** índices. Por isso, a cobertura é verificada por `scripts/check-indexes.mjs`, que compara a lista de consultas declaradas em `infra/queries.manifest.js` com os índices, e confirmada no ensaio da Fase 14. Lista inicial no Apêndice A.

---

## 7. Estratégia de migração de dados

### 7.1 Scripts

Ficam em `scripts/migrations/`, em Node com `firebase-admin`:
- `M001-identity`;
- `M002-audience`;
- `M003-media`;
- `M004-characters-v2`;
- `M005-folders`;
- `M006-notes-v2`;
- `M007-rtdb-v2`;
- `M008-messages-v2`;
- `M009-turn-state`;
- `M010-scenes-v2` (Fase 12);
- `M011-cleanup`, que remove campos e nós legados depois da auditoria.

**Requisitos de cada script:**
- `--target emulator|production` obrigatório, com `production` exigindo também `--confirm-production`;
- `--dry-run` por padrão, que imprime um relatório agregado: contagens, sem conteúdo nem dados pessoais;
- idempotente;
- grava `campaign.schemaVersion` e um log em `local-data/migration-logs/` (no `.gitignore`);
- falha antes de exceder 15 mil escritas no mesmo dia.

**Utilitários:**
- `scripts/migrations/audit-v2.mjs` valida todos os documentos e nós contra `domain/models` e as invariantes da Seção 6.3 e precisa reportar **0 violações**;
- `scripts/ops/export-production.mjs` e `scripts/ops/seed-emulator.mjs` fazem o snapshot de produção para `local-data/` e o carregam no emulador, incluindo os usuários do Auth com os mesmos UIDs;
- `scripts/ops/backup-production.mjs` e `restore-production.mjs` cobrem backup e restauração (Firestore pelo Admin SDK; RTDB por `firebase database:get/set`). **A restauração deixa o Firestore idêntico ao backup**, excluindo também os documentos e coleções criados depois dele: `members`, `invites`, `platformAdmins`, `state/*`, pastas novas, mídias da D-DER-9, `pendingCosts`. O RTDB volta pelo `database:set` do backup completo, e o espelho `platformAdmins` da raiz é removido;
- `scripts/ops/set-runtime-config.mjs` grava `appConfig/runtime` (`minClientVersion`, `schemaVersion`), com `--target`, `--dry-run` e `--confirm-production`. Roda no seed do emulador, no ensaio da Fase 14 e no cutover.

**Credenciais:** o Admin SDK usa `GOOGLE_APPLICATION_CREDENTIALS`, apontando para uma chave de conta de serviço **fora do repositório** (o `.gitignore` já ignora `*service-account*.json`), ou credenciais padrão da aplicação. O usuário fornece a chave. Nunca grave segredos em arquivos do repositório.

### 7.2 Ensaios

**Por fatia:** cada fase que muda o schema roda o seu script no emulador semeado com o snapshot de produção (Fase 0). O app é validado nesse estado misto (fatias v2 e o restante em v1).

**Ensaio geral (Fase 14):** semeia de novo um snapshot fresco, roda M001 → M011, executa a auditoria, todas as suítes e os roteiros manuais com o usuário. **Ensaia também a restauração:** backup → migrações → restauração no emulador, conferindo que o estado voltou exatamente ao snapshot.

### 7.3 Adaptadores de transição

Entre fases, o app precisa continuar funcionando com fatias em v1 e outras em v2. Um adaptador temporário só é permitido se:
1. estiver registrado numa tabela "Adaptadores de transição" no REGISTRO, com arquivo, motivo e **fase de remoção**;
2. tiver um comentário `// TRANSITION(<id>): remover na Fase N`.

A Fase 13 remove todos. O critério 4.1.5 exige a tabela vazia.

**Transições mínimas previstas.** Cada fase que muda um formato precisa deixar o app funcionando no emulador (Seção 2.4, passo 1). No mínimo:

| ID | Cria | Remove | O que garante |
|---|---|---|---|
| T1 | Fase 3 | Fase 11 | Os providers expõem um `playersMap` derivado de `members` para os consumidores ainda v1: identidade do remetente no chat, listas de jogadores e `VTTLayout`. A M001 remove `players` do documento. |
| T2 | Fase 5 | Fase 9 | Os leitores das coleções da ficha que só serão reescritos depois (`DamageRollModal`, `SavingThrowModal`, `rollService`, `combatService`, `QuickActionsHotbar`) passam a usar os seletores de `domain/models/character` **já na Fase 5**. A sincronização token → ficha passa a chamar o `characterService` (com `rev`) já na Fase 5. Sem isso, a M004 (arrays → mapas) quebra gatilhos, assistências e consumíveis. |
| T3 | Fase 5 | Fase 8 | Espelho ficha v2 → token v1. |
| T4 | Fase 8 | Fase 9 | Descontos e efeitos em NPC (ainda no código de combate v1) usam a transação de `tokenSecrets` do `tokenService` já na Fase 8. |
| T5 | Fase 9 | Fase 10 | Um seletor de leitura de mensagem (ordem por `seq`; personagem, nome e imagem por `sender`; dados por `roll`; horário por `createdAt`) usado pelo chat v1 (`useChatRolls`, cards, avatar) até a reescrita da Fase 10. O `useTokenSpeech` usa o mesmo seletor. |

A interface da política de turno (Fase 8) **não** é adaptador: é a interface definitiva. A Fase 11 só troca a fonte dela para `state/turn`.

### 7.4 Cutover em produção

Mudanças incompatíveis de schema são aplicadas **num único cutover**. A sequência numerada, o rollback e as autorizações estão **na Fase 14**, que é a única referência para "passo N".

**Abas v1 abertas no cutover não têm a checagem de `minClientVersion`.** O que as contém é:
- a janela de manutenção, com a confirmação pela presença de que não há ninguém online;
- as regras de manutenção;
- as regras v2, que rejeitam o formato v1.

O `minClientVersion` passa a valer a partir do hosting v2 e protege os deploys seguintes.

A produção não recebe nada antes disso, salvo a leitura do snapshot autorizada no Gate G0.

---

## 8. Fases

São 16 fases, da 0 à 15, executadas **em ordem**: cada uma depende das anteriores. O esforço e o uso de ultracode recomendados para cada fase estão na Seção 2.7.

Cada fase lista os **itens do catálogo** resolvidos (Seção 9). Todas incluem implícitos:
- testes;
- `npm run check` verde;
- registro no REGISTRO;
- adoção de `components/ui/` nos componentes reescritos;
- confirmações de exclusão (U6) para as entidades da fase;
- remoção dos `catch` silenciosos tocados.

### Fase 0 — Fundação e rede de segurança

**Objetivo:** poder refatorar sem tocar a produção e com testes que protejam o comportamento.

**Entregáveis:**
1. **Antes de tudo, peça o Gate G0** (no fim desta fase). Depois crie a branch `refactor/v2` a partir de `main`. Confirme que `HEAD == abf44e8` e que o `git status` não mostra alterações além do próprio `PLANO_REFATORACAO_2.md`, não rastreado, que entra no primeiro commit da branch.
2. Dependências de desenvolvimento, todas com versão fixa no lockfile:
   - `vitest`;
   - `@firebase/rules-unit-testing`;
   - `firebase-admin` (só para scripts);
   - `firebase-tools` (emuladores reprodutíveis);
   - `jsdom` e `@testing-library/react` (hooks e reducers);
   - `@vitest/coverage-v8` (cobertura exigida no aceite da Fase 1).
3. `firebase.json`: bloco `emulators` (auth, firestore, database e UI) e referência a `firestore.indexes.json` (inicialmente vazio). Os testes usam um `projectId` próprio (ex.: `demo-cpvtt-test`) e portas próprias, separados do `dev:emu` (Seção 2.7).
4. **`src/services/firebase.js`** (que só vira `src/infra/firebase.js` na Fase 2) passa a conectar aos emuladores **por padrão** em desenvolvimento (`import.meta.env.DEV`). Desenvolvimento contra a produção só com `VITE_ALLOW_PRODUCTION=true`, num script explícito `dev:prod`; sem essa variável, o app em dev se recusa a inicializar contra a produção.
   - Inclua um `.env.emulator` sem segredos e a exceção `!.env.emulator` no `.gitignore`, que hoje ignora `.env*`. Documente no README.
   - **Antes desta edição**, peça ao usuário para trocar o servidor que está rodando por `dev:emu` (Seção 2.3).
5. Scripts npm:
   - `emulators`;
   - `dev:emu`;
   - `test` (unitários e de serviço);
   - `test:rules`;
   - `check` (lint + camadas + test + test:rules + build);
   - `migrate`;
   - `audit:schema`.
6. **Testes de caracterização** do comportamento que deve ser preservado:
   - motor de fórmulas (casos válidos atuais);
   - parser de dados;
   - detecção de aliases (casos válidos);
   - `computeModifiedEffectValue`;
   - geometria de AoE e régua;
   - estado de turno (comportamento congelado: iniciar, avançar, regredir, encerrar, travas), incluindo o desconto feito pelo cliente do Mestre real: "Mestre na Visão Player rola ação ativa no turno do ator e `actionsRemaining` é descontado"; "Mestre fora da Visão Player rola e nada é descontado"; "movimento descontado só quando o Mestre real arrasta";
   - classificação estrutural de rolagens (sem regex);
   - resolução de atalhos vinculados por id.
7. Regras de camadas e de pureza (Seção 5.1) configuradas em **modo relatório**. Viram erro na Fase 13. Registre a contagem inicial de violações.
8. Snapshot de produção (só leitura, **Gate G0**): exportar para `local-data/` (adicionar `local-data/` ao `.gitignore`) e semear o emulador. Verificar que o app v1 roda contra o emulador com esse seed.
9. Portar para as novas suítes as 20 verificações de `auditoria_refatoracao/validar-regressoes.mjs` que continuarem aplicáveis. O arquivo antigo é removido na Fase 13, com autorização.

**Itens:** PROC-01 (início), PROC-02 (início), PROC-04.

**Aceite:**
- `npm run check` roda (com o relatório de camadas ainda não zerado);
- os emuladores sobem;
- `dev:emu` funciona com o seed;
- a produção não foi alterada.

**Gate G0 (pedir no início da fase, antes do entregável 1):** autorizar:
- (a) commits locais na branch `refactor/v2` e nas branches temporárias de worktree `refactor/v2-*`, sem push;
- (b) instalação das dependências de desenvolvimento;
- (c) leitura de produção para o snapshot, indicando a conta da CLI e a credencial do Admin SDK.

Ao fim da fase, o gate é apenas informativo.

### Fase 1 — Domínio e engines puros

**Objetivo:** criar o núcleo puro que todas as fases seguintes vão usar. O app antigo continua intacto: os novos módulos ainda não estão ligados a ele.

**Entregáveis:**
1. **`domain/models/*`:** forma, `normalize` (aplica `defaults` uma única vez), `validate` (invariantes da Seção 6.3) e `toDoc`/`fromDoc` para cada entidade da Seção 6, incluindo `imageRef`.
2. **`domain/defaults.js`:** fonte única de valores padrão.
   - Unifica as divergências da mesma entidade: MP exibido 10/10 contra 15 no spawn; Defesa `?? 10` contra 12; HP 20/20 contra 25.
   - Unifica a forma padrão de `savingThrow`, hoje copiada em cerca de 10 lugares (`useCharacters`, `useCompendium`, `SheetSkillsTab`, `SheetRollsTab`, `SheetInventoryItemForm`, `CompendiumModal`, hooks de estado).
   - Unifica o cone (9 m contra 6 m), o grupo padrão (`grp_combate` com nomes diferentes) e o HP/MP de token livre.
   - Valores diferentes **para entidades diferentes** podem existir, desde que estejam nomeados aqui.
3. **`domain/audience.js`** (`computeAudience`, `assertAudience`) e **`domain/permissions.js`**: uma única fonte para os predicados que hoje se repetem em `useCharacters` ([:123-148](src/hooks/useCharacters.js#L123-L148)), `CharactersSidebarList` (:20, :221), `journalService` (:46-79) e `combatEngine`.
4. **`engines/formula`** (resolve INT-11):
   - chaves explícitas;
   - colisão entre atributo e perícia proibida;
   - chaves reservadas;
   - variável desconhecida, token inválido ("2x3") e divisão por zero produzem **erro sinalizado** (`{ ok:false, error }`);
   - uma só normalização de chaves, substituindo `normalizeCompactKey` e `normalizeKey`.
5. **`engines/dice`:** gerador de números aleatórios injetado.
6. **`engines/rolls`:**
   - `rollClassifier` estrutural, substituindo as 4 cópias: [SheetSkillsTab.jsx:767-776](src/components/sheets/tabs/SheetSkillsTab.jsx#L767-L776), [:814-823](src/components/sheets/tabs/SheetSkillsTab.jsx#L814-L823), [SheetRollsTab.jsx:328-337](src/components/sheets/tabs/SheetRollsTab.jsx#L328-L337) e `rollService.inferAbilityRollKind`/`effectRollKind`/:341-348. Precisa tratar `MP_HEAL`/`MP_DAMAGE` de forma consistente;
   - `shortcutResolver`, só por id;
   - `damageComposer`, com `critFormula` respeitada e sem `|| "1d6"`.
7. **`engines/combat`:**
   - pipeline de efeitos;
   - `targetResolution` **sem casar por nome** (resolve SEG-08: [combatEngine.js:356-362](src/engines/combatEngine.js#L356-L362) e :230-233);
   - normalização única de gatilhos e assistências (substitui `DamageRollModal` :42-93, `SavingThrowModal` :78-118 e `combatService` :114-119), sem descartar assistências com d20 por regex;
   - CD sem `|| 10` transformando 0 em 10.
8. **`engines/geometry`:** centro do token, cone, círculo, distância, rotação, hit-test e bounds de texto, considerando rotação e unificando os fatores divergentes. Substitui as 3 a 4 cópias em `BoardViewport`, `boardConstants`, `useBoardInteractive` e `combatEngine`, e usa `METERS_PER_CELL` em vez de `/1.5` e `*1.5`.
9. **`engines/fog`:** `isPointRevealed`, que substitui `useFogOfWar` :136-150 e `FogOfWarCanvas` :26-33, e a partição público/oculto.
10. **`engines/folders`:** árvore, descendentes com conjunto de visitados, `validateMove` (ciclos e compatibilidade) e caminho de exibição.
11. **`engines/journal`:**
    - texto da nota a partir de `sections`;
    - **um** matcher de aliases, sem diferença de acento ("Joao" × "João") e respeitando `ignoredAliases`;
    - grafo calculado por leitor, a partir das notas acessíveis, sem menções persistidas.
12. **`engines/chat/chatCommandParser`:** substitui [VTTLayout.jsx:809-851](src/components/layout/VTTLayout.jsx#L809-L851) e [ChatSidebarPanel.jsx:111-145](src/components/chat/ChatSidebarPanel.jsx#L111-L145).
13. **`engines/compendium`:** um mapeamento compêndio → ficha. Substitui [CharacterSheetModal.jsx:191-243](src/components/sheets/CharacterSheetModal.jsx#L191-L243) e [CompendiumModal.jsx:45-113](src/components/compendium/CompendiumModal.jsx#L45-L113), que já divergem.
14. **`engines/turn`:** estado de turno extraído do `combatEngine` **sem mudar o comportamento** (U1). Sai o registro global de hooks (:430-445, :557). Sai a rolagem dentro de `evaluateDcFormula` (:92), que passa a ser uma chamada explícita ao `dice`.
15. **`infra/ids.js` e `domain` (prefixos):** substituem mais de 8 cópias de `${p}_${Date.now()}_${rand}`.

**Itens:** EST-02, EST-05 (parcial), EST-06 (motores), EST-11, INT-11 (motor), MOD-11, SEG-08 (motor), FUN-07 (motor), FUN-28, FUN-31, FUN-32 (motor).

**Aceite:**
- cobertura de ramos ≥ 90% e 0 violações de pureza **nos módulos novos** (`src/domain/**` e `src/engines/*/**`);
- caracterização da Fase 0 verde.

Os engines legados (`src/engines/{combatEngine,diceEngine,formulaEngine,aliasEngine,imageCompressor}.js`) continuam em uso pelo app até as fases que os substituem. Ficam fora dessa verificação, registrados como TRANSITION (Seção 7.3), com remoção na fase que elimina o último uso (no máximo, Fase 13).

**Gate G1:** revisão do modelo de domínio pelo usuário (apresentar o resumo das entidades e dos valores padrão unificados).

### Fase 2 — Infraestrutura e serviços transversais

**Entregáveis:**
1. **`infra/`:**
   - `firebase.js`;
   - `firestorePaths.js`;
   - `rtdbPaths.js` **completo**: elimina as 22 ocorrências de `vtt_realtime/...` fixas em `CampaignContext`, `useBoardInteractive`, `useCharacters`, `useFogOfWar`, `useRealtimeTokens` e `combatService`;
   - `converters/`;
   - `browserStorage.js` (namespaced, seguro);
   - `clock.js`;
   - `imageCompression.js` (movido de `engines/`): compressão **uma única vez** (o resultado é reutilizado na prévia e no envio), falha explícita quando não alcança o limite, `mimeType` real (corrige :88-113 e :112).
2. **`infra/mediaCache.js`:**
   - conexão única com o IndexedDB;
   - **sem** fallback por `mediaId` sem campanha (resolve INT-15: [mediaService.js:83](src/services/mediaService.js#L83), [:180](src/services/mediaService.js#L180));
   - deduplicação de requisições em andamento por chave.
3. **`infra/crossWindowTransport.js`:** `BroadcastChannel` com fallback por evento `storage` (A13), testado. Sem canais ou chaves `"default"`.
4. **`services/notificationService` + `components/ui/Toast`:** retorno de erro e sucesso, sem texto explicativo.
5. **`components/ui/ConfirmDialog`** (genérico). O `ConfirmDeleteModal` de pastas passa a usá-lo.
6. **`services/operationRunner`:** auxiliar de saga.
   - Cria o registro da operação (mensagem `pending` com `opId`).
   - Aplica efeitos de forma idempotente (transações do Firestore e do RTDB com `recentOps`, podado na mesma transação).
   - Confirma o status.
   - Recupera, ao iniciar, as operações `pending` do próprio usuário. Para quem não é Mestre, a consulta inclui `where('visibleTo','array-contains-any',['ALL', uid])`, porque as regras não filtram resultados (Apêndice A).
   - Testado com falhas injetadas entre os passos.
7. **Auxiliares de transação** do Firestore e do RTDB, com teste de contenção usando **dois clientes** no emulador (resolve o caso de MP 10 menos 2 e menos 3 = 5).

A verificação de `appConfig/runtime` fica na Fase 3, junto com o modelo e a regra de leitura desse documento: as regras v1 não têm `match` para ele.

**Itens:** EST-10, INT-15 (cache), INT-20 (infraestrutura), PERF-04 (cache e deduplicação), FUN-27, EST-08 (base), EST-02 (`imageCompression` sai de `engines/`), EST-03 (`crossWindowTransport`, `browserStorage`).

**Aceite:** testes de infraestrutura e de serviço contra o emulador verdes; o teste de contenção prova que efeitos concorrentes são preservados.

**Gate G2:** apenas informativo (sem decisões pendentes).

### Fase 3 — Identidade, membros, autoridade do Mestre e presença

**Objetivo:** "estar logado" passa a ser diferente de "ser membro", com um único contrato de autoridade do Mestre.

**Entregáveis:**
1. **Modelo:** `platformAdmins`, `campaigns` enxuto, `members`, `invites` e `appConfig`; no RTDB, `meta/gmId`, `meta/pendingGm`, `meta/members` e `meta/invites` (Seção 6).
2. **`authService`:**
   - Google;
   - e-mail e senha com verificação (D-DER-1);
   - recuperação de senha para o e-mail real;
   - erros por `code`, sem comparar texto (corrige [AuthContext.jsx:21](src/contexts/AuthContext.jsx#L21));
   - sem espalhar o objeto `User` (:147);
   - **verificação de convite antes de considerar o usuário dentro**, sem criar conta e depois apagar (:118-126);
   - remove `checkIsEmailAuthorized` e `DEFAULT_AUTHORIZED_USERS` ([authorizedUsers.js](src/constants/authorizedUsers.js)).
3. **`memberService`:**
   - **`joinWithInvite`:**
     - lote no Firestore com `members/{uid}` e `invites/{emailLower}.acceptedBy = uid` (exceção da regra de `invites`, Seção 6.1);
     - depois, `meta/members/{uid}` no RTDB;
     - **idempotente:** se `members/{uid}` já existe, pula o lote e só conclui o RTDB.
   - **`invite(email)`:** grava `invites/{emailLower}` e depois `meta/invites/{emailKey}`.
   - **`revokeMember(uid)`** (D-DER-8):
     1. um lote no Firestore apaga `members/{uid}` e o convite dele (`invites` com `acceptedBy == uid`);
     2. logo em seguida, uma atualização multi-caminho no RTDB apaga `meta/members/{uid}` e `meta/invites/{emailKey}`.
     - Com o convite apagado, a reentrada é negada pelas regras.
     - A reconciliação só cobre a falha do passo 2.
     - Remover o convite de alguém que já entrou executa o `revokeMember`; remover um convite pendente apaga `invites` e `meta/invites`.
   - **`createCampaign`** (só administrador da plataforma, D-DER-7):
     - um lote no Firestore com `campaigns/{c}` (`gmId == uid`) e `members/{uid}`;
     - depois, no RTDB, a primeira gravação de `meta/gmId` (regra de bootstrap pelo espelho `platformAdmins`, Seção 6.2) e de `meta/members/{uid}`;
     - a Fase 9 acrescenta `state/chat { lastSeq: 0 }` ao mesmo lote, e a Fase 11 acrescenta `state/turn`.
     - O `CampaignProvider` **deixa de criar campanhas** ao abrir um `campaignId` inexistente (remove CampaignContext.jsx:210-266): campanha inexistente ou sem associação mostra erro e não grava nada.
   - `assignGM` com o **protocolo de transferência**:
     1. o Mestre atual grava `meta/pendingGm = alvo`;
     2. lote no Firestore com `campaign.gmId = alvo`;
     3. o Mestre atual grava `meta/gmId = alvo` e limpa `pendingGm`;
     4. se o passo 3 falhar, o novo Mestre conclui ao iniciar a sessão (regra: `pendingGm == auth.uid`).
     - O protocolo **não** reescreve notas nem pastas `scope: "gm"`: o acesso a elas acompanha o `gmId` (invariante 6.3.1).
   - `reconcileMirrors`, rodado pelo Mestre ao iniciar a sessão: remove do RTDB os `meta/members` e `meta/invites` sem contraparte no Firestore e confere `meta/gmId`.
   - **Corrige a reversão do `assignGM`** ([CampaignContext.jsx:332-358](src/contexts/CampaignContext.jsx#L332-L358)): não existe mais papel na whitelist.
4. **`presenceService`:**
   - `presence/{uid}/{connId}` com `.info/connected` e `onDisconnect` por conexão;
   - online significa ter pelo menos uma conexão;
   - **sem** perfil duplicado na presença;
   - dependências estáveis (uid e campaignId);
   - a ficha destacada **já registra** a sua conexão com `kind: "sheet"` e `sheetId`. A Fase 9 usa isso para decidir qual janela abre o pop-up de resistência.
5. **`profileService`:**
   - nome e `avatar: ImageRef`;
   - "remover foto" significa `{ mediaId:null, url:null }`, sem cair de volta na foto do Google;
   - o avatar pendente do cadastro vai para um `pendingAvatarStore`, isolado por uid e enviado só depois de entrar na campanha (sai do `stringUtils`).
6. **Contextos:**
   - `AuthProvider` (só o estado de autenticação);
   - `CampaignProvider` (documento da campanha; `isGM = campaign.gmId === uid`; Visão Player como **modo de UI**, documentado como não sendo segurança);
   - `MembersProvider`;
   - `PresenceProvider`;
   - todos com valores memorizados;
   - **troca de campanha** reinicia tudo por `key={campaignId}`, e o carregamento é identificado por (uid, campaignId);
   - **adaptador T1** (Seção 7.3): `playersMap` derivado de `members` para os consumidores ainda v1.
7. **`appConfig/runtime`** (veio da Fase 2):
   - modelo e regra de leitura;
   - o cliente assina o documento com `onSnapshot` (1 leitura por sessão, mais as mudanças);
   - no boot, ou quando `minClientVersion` passar a versão do cliente, **exige a recarga**. A recarga passa pela proteção de alterações não salvas e não é um `location.reload()` silencioso; enquanto o usuário não recarrega, as escritas ficam bloqueadas;
   - documento ausente: segue sem restrição e registra um aviso.
8. **UI:**
   - `LoginScreen` dividido em `LoginForm`, `RegisterForm`, `ForgotPasswordForm`, `AuthErrorBanner` e `GoogleSignInButton`, com visual preservado, login por e-mail (D-DER-2) e sem a limpeza de `cp_remember_pwd`;
   - `GMPanelModal` reescrito: convites e membros com confirmação;
   - `PlayerProfileModal` reescrito: `ImageRef`, Mestre vindo do contexto e não de `role` (:85).
9. **Regras v2** de `platformAdmins`, `appConfig`, `campaigns`, `members` e `invites`, e regras do RTDB para `meta`, `presence` e o espelho `platformAdmins`:
   - `isMember` em **todas** as coleções. As demais regras de coleção são endurecidas nas próximas fases, mas a associação já vale aqui;
   - sem e-mail fixo;
   - `email_verified` na criação de `members/{uid}`, na aceitação do convite e em `meta/members/{uid}`.
10. **Migração M001:**
    - `players` → `members`;
    - `authorizedUsers` → `invites`. Os convites de quem já é membro recebem `acceptedBy = uid`; os pendentes ganham `meta/invites/{emailKey}`;
    - seed de `platformAdmins` (uid do Mestre atual) no Firestore **e** no espelho da raiz do RTDB;
    - espelhos `meta/gmId` e `meta/members` do RTDB;
    - marcar como verificados os membros atuais de e-mail e senha (D-DER-1, com autorização);
    - remover `players` e `authorizedUsers`.

**Itens:** SEG-01, SEG-02, SEG-04 (regras de `presence` e `meta`), MOD-01, MOD-02, MOD-06 (membros), MOD-14 (`cp_remember_pwd`), INT-14, INT-15 (troca de campanha), FUN-16, FUN-17, FUN-29, EST-01 (auth, campanha, constants), EST-04 (`LoginScreen`, `GMPanelModal`, `CampaignContext`), PERF-05 (contextos), FUN-19 (convites e membros).

**Testes:** Apêndice B, blocos B1 e B2, mais presença com duas conexões e reconexão.

**Aceite:**
- um não membro não lê nem grava nada nos dois bancos;
- um administrador cria uma campanha completa pelo app;
- a delegação Mestre → jogador → Mestre funciona sem reversão;
- remover um membro corta o acesso na hora, nos dois bancos, e o removido não consegue reentrar;
- fechar a ficha destacada não derruba a presença da mesa.

**Gate G3:** apenas informativo (D-DER-1, D-DER-2, D-DER-7 e D-DER-8 já confirmadas).

### Fase 4 — Visibilidade canônica e mídia

**Entregáveis:**
1. **Audiência canônica** em fichas, pastas, notas, cenas e compêndio:
   - `visibleTo` e `editableBy` (mais `scope` no Diário), sempre gravados via `computeAudience`;
   - **remove `visibleToPlayers`**;
   - compartilhar e revogar acesso ficam simétricos (corrige `journalService` :385-389 contra :416-418).
2. **Consultas:**
   - uma única consulta `array-contains-any ["ALL", uid]` combinada com `isDeleted == false`;
   - **remove** as consultas `or` e o fallback silencioso ([visibilityService.js:58-75](src/services/visibilityService.js#L58-L75)).
3. **Regras de leitura:** `isGM || "ALL" in visibleTo || uid in visibleTo`, mais as invariantes 6.3.1 e 6.3.2. **Exceção:** com `scope == "gm"`, só `isGM` (leitura e escrita), seja quem for o `ownerId`.
4. **Ponto crítico, o bypass do `ownerId`** ([firestore.rules:110-111](firestore.rules#L110-L111), [:131-132](firestore.rules#L131-L132)):
   - `ownerId` passa a ser obrigatório e imutável para quem não é Mestre (`request.resource.data.ownerId == resource.data.ownerId`, exigindo o campo);
   - quem só edita não altera `visibleTo`, `editableBy` nem `scope`.
5. **Mídia:**
   - schema 6.1;
   - regras com `dataUrl.size()`, `uploadedBy == uid`, imutabilidade e ampliação monotônica de `visibleTo` pelo Mestre, por quem enviou ou por membro da audiência atual (Seção 6.4);
   - **sem** `chunks`;
   - leitura conforme a audiência;
   - sem listagem para quem não é Mestre;
   - `mediaService.grantAudience`, chamado **antes** de publicar um recurso. Isso inclui enviar mensagem com `sender.image` e projetar ou criar tokens de PC, que são públicos;
   - remover `deleteMedia` (sem chamadores; mídia é preservada).
6. **Migrações:**
   - **M002:** audiência canônica a partir dos campos atuais. `visibleToPlayers` tem prioridade, como na regra A6. Garante o dono na lista e remove `visibleToPlayers`.
   - **M003:** `byteLength` e `visibleTo` de cada mídia, pela união das audiências de quem a referencia. Varre fichas, notas, cenas, membros, tokens do RTDB e as mensagens Base64 (D-DER-9 fica na M008). Mídia sem referência fica só com o Mestre.

**Itens:** SEG-03, SEG-05, SEG-07, MOD-13 (`visibleToPlayers`), MOD-15, SEG-06 (mídia), PERF-04 (mídia), INT-10 (M002, M003).

**Testes:** Apêndice B, blocos B3 e B4.

**Aceite:** um jogador não lê a mídia de recurso oculto, nem pelo id; um editor não se apropria de nota ou pasta alheia (a sequência do Codex é negada).

**Gate G4:** apenas informativo.

### Fase 5 — Fichas e compêndio

**Entregáveis:**
1. **Ficha v2** (6.1.1):
   - mapas indexados por id;
   - chaves de fórmula estáveis;
   - `ImageRef`;
   - `type` explícito (D-DER-4);
   - `rev` e `recentOps`;
   - `hotbar` por referência, com nome, ícone e cor sobrescritos em `overrides`, sem cópias soltas.
2. **`characterService`, só com comandos atômicos:**
   - criar (a partir de `domain/defaults`) e renomear;
   - atualizar campo, sempre incrementando `rev`;
   - `applyResourceDelta(charId, resource, delta, opId)` e `consumeItem(charId, itemId, opId)`, em transação, relativos, com limite e idempotentes;
   - `addEntry`, `updateEntry` (atualização por caminho de campo), `removeEntry`, `reorder` (lote);
   - `share` e `transfer` (só o Mestre, respeitando a invariante de pastas);
   - `softDelete`;
   - `uploadAvatar`.
   - Elimina as cerca de 30 regravações de arrays inteiros em 9 arquivos e o `rtdbGet` da cena inteira a cada edição ([useCharacters.js:276](src/hooks/useCharacters.js#L276)).
3. **`useCharacters`** vira assinar e selecionar, mais um `useCharacterActions`.
4. **UI da ficha:**
   - `CharacterSheetModal` como casca: sem o ramo morto `activeTab === "main"` (:497) e sem a recolocação de 9 slots duplicada;
   - **abas reescritas com `useReducer`**: um estado por formulário, substituindo os hooks `sheets/state/*` (19 `useState`) e o acoplamento à ordem;
   - `SheetSkillsTab` dividido em `AbilityForm`, `AbilityCard` e `SkillList`;
   - `SheetRollsTab`;
   - `SheetInventoryTab`, com o item inspecionado **derivado** do estado atual por id (corrige INT-18);
   - `SheetAttributesTab`;
   - `PlayerCardLeftPanel`, com editores de moedas e XP unificados;
   - `HotbarSlotModal` e `RollIconModal` usando `WindowModal`;
   - `SheetPermissionsPanel`;
   - confirmações (U6) para item, habilidade, perícia, atributo, grupo, rolagem fixada e slot da hotbar.
5. **Bugs corrigidos:**
   - o filtro do compêndio na aba Skills passa a incluir `spell` ([SheetSkillsToolbar.jsx:13](src/components/sheets/tabs/SheetSkillsToolbar.jsx#L13), [:35](src/components/sheets/tabs/SheetSkillsToolbar.jsx#L35));
   - uma perícia nova só usa atributos que existem na ficha (`useSkillsFormState` :10);
   - a demarcação de área recebe o id correto (SheetRollsTab :625);
   - reordenação para cima **e** para baixo (:650);
   - remoção do estado morto `crSave*` (:77-82, :92-95);
   - remoção da heurística `"arco" → bow` (:274);
   - remoção dos fallbacks planos de alcance e AoE (SheetSkillsTab :91-95; CharacterSheetModal :134-138).
6. **Compêndio:**
   - `compendiumService`;
   - `CompendiumModal` reescrito com reducer;
   - importação pelo engine único;
   - confirmação de exclusão (:704);
   - sem `setTimeout` sem limpeza (:110-112);
   - sem fallback permissivo (:36);
   - "Oculto" coerente com `visibleTo` (:690 contra :166);
   - `useCompendium` sem `onError` vazio (:44).
7. **Ícones:**
   - todo item, habilidade e atalho tem `icon` explícito;
   - `CpFlashIcons` vira um catálogo declarativo (sem adivinhar por palavra-chave: :184-189, :380-386; sem aliases por nome ou id: :222-224);
   - `CpIconPicker` usa as categorias do catálogo (:11-21).
8. **Migração M004:**
   - arrays → mapas;
   - chaves das perícias iguais à normalização atual, para as fórmulas existentes continuarem funcionando, com **relatório de colisões**;
   - atalhos → referências: os vinculados por `sourceId`, os demais viram `custom`;
   - `icon` preenchido **apenas onde está ausente**, com a heurística atual aplicada **uma vez** e registrada, **nunca** sobrescrevendo ícones existentes (corrige o caso "Peixe-espada": [migrationService.js:253-272](src/services/migrationService.js#L253-L272));
   - `ImageRef`;
   - `type` (D-DER-4);
   - remove os campos legados;
   - compêndio v2, com custo aninhado e `rollKind`.
9. **Adaptador de transição:** ficha v2 → token v1 (remoção na Fase 8).

**Itens:** MOD-04, MOD-05, MOD-06 (ficha), MOD-10, MOD-11, MOD-13 (custo do compêndio aninhado), MOD-14 (ficha e compêndio), INT-01 (PC), INT-02, INT-10 (M004), INT-11 (dados), INT-18, FUN-08, FUN-09, FUN-10, FUN-19 (ficha e compêndio), FUN-20, EST-04, EST-05, EST-06 (ícones), EST-07 (formulários), PERF-08.

**Testes:**
- concorrência: duas abas adicionando habilidades diferentes → as duas persistem; descontos 10 − 2 − 3 = 5;
- repetir o mesmo `opId` não muda nada;
- regras: quem só edita não altera `ownerId`, `visibleTo`, `editableBy` nem `type`;
- reducers.

**Aceite:** todos os fluxos da ficha funcionam no emulador com dados M004; HTML estático equivalente nos componentes só de apresentação.

**Gate G5:** apenas informativo (U3a e D-DER-4 já confirmadas).

### Fase 6 — Pastas unificadas (fichas e Diário)

**Entregáveis:**
1. **Modelo de pasta único** (6.1 e invariantes 6.3.3 e 6.3.4).
2. **`folderService`:**
   - criar, renomear, mover (validação de ciclo e compatibilidade);
   - transferir dono, só o Mestre, em **cascata** na subárvore do domínio `character`, com confirmação;
   - excluir em dois modos:
     - `moveToParent`: subpastas inteiras e itens vão para a pasta pai (D-2);
     - `deleteAll`: soft delete do que o usuário pode excluir; o que ele não pode excluir vai para a pasta pai (D-3).
   - Tudo **num único `writeBatch`** de até 450 escritas; acima disso, erro explícito.
   - Sem `.catch(() => {})` (corrige [useCharacters.js:571](src/hooks/useCharacters.js#L571), [:578](src/hooks/useCharacters.js#L578) e journalService :554, :561).
   - Fichas órfãs passam a ser impossíveis (corrige :530).
3. **Árvore de fichas:**
   - `CharactersSidebarList` dividido: `useCharacterTree`, `CharacterTreeView`, `FolderNode`, `CharacterRow`;
   - controlador de arrastar e soltar **com bloqueio de ciclo** e zonas da raiz que aceitam pastas (corrige :244-247, :666-672, :757-760);
   - `CreateEntryModal`, `MoveCharacterModal` (com dono **explícito**, nunca vindo do modal de criação: corrige :580) e `SpawnTokenModal`;
   - mudança de dono por soltar exige confirmação (:240, :246, :670);
   - renomear sincronizado com mudanças remotas (:216);
   - seção de compartilhadas (D-DER-5);
   - sem `canEdit={true}` fixo (:686, :708, :822, :844);
   - sem campanha fixa `"main-table"` (:32);
   - sem o filtro `ownerId === gmUid` (useCharacters :118).
4. **Árvore do Diário:**
   - o mesmo engine;
   - pastas por escopo, dono e tipo (fim das colisões entre escopos, `JournalWorkspace` :47);
   - nomes sem "/" (:707-717);
   - um formulário inline único (:410-460 e :1186-1236);
   - expansão automática ao arrastar sem `setTimeout` mágico (:618), via estado de hover com intenção;
   - soltar sem permissão gera retorno de erro (:656).
5. **Migração M005:**
   - pastas de ficha normalizadas;
   - pastas do Diário recriadas como segmentos por `parentId`, a partir dos caminhos das notas e dos documentos atuais, separadas por escopo e dono;
   - `notes.folder` → `folderId`;
   - remove os documentos legados `isFolder` em `characters` e `notes` (duplicatas já migradas, conferidas antes; exclusão física **pelo script**, com backup).

**Itens:** INT-07, INT-08, INT-10 (M005), MOD-07 (pastas), MOD-14 (`isFolder`), FUN-21, FUN-19 (pastas), EST-04 (árvores).

**Testes:**
- engine: ciclos e subárvores;
- serviço: atomicidade (falha simulada não deixa estado parcial);
- regras: quem não é dono não move nem exclui;
- reproduções do Codex: ciclo A↔B e exclusão entre donos no mesmo caminho, que precisam falhar.

**Aceite:** é impossível criar ciclos pela UI ou pelo serviço; excluir com "mover itens" preserva a subárvore; nada some da árvore.

**Gate G6:** apenas informativo (D-DER-5 já confirmada).

### Fase 7 — Diário

**Entregáveis:**
1. **Nota v2** (6.1.2), sem campos derivados persistidos.
2. **`journalService`:**
   - criar;
   - **salvar o rascunho num lote**: a nota mais as inclusões de alias nas notas de destino, que exigem permissão nelas; sem permissão, o vínculo fica indisponível, com retorno de erro;
   - compartilhar e revogar acesso simétricos;
   - clonar copiando só os campos de origem (corrige :344-345);
   - soft delete (dono ou Mestre);
   - posição no grafo (só editores).
3. **Rascunho (`useNoteDraft`, reducer):**
   - vínculos e negações entram no rascunho e só vão ao banco ao salvar;
   - **negar** adiciona a `ignoredAliases` **desta** nota e não remove o alias do destino (corrige [NoteEditorModal.jsx:403-444](src/components/journal/NoteEditorModal.jsx#L403-L444));
   - navegar com alterações pendentes pergunta antes (D-DER-6).
4. **`NoteEditorModal` dividido:** `NoteMetaFields`, `NoteSectionsEditor`, `NoteInteractiveView`, `NoteSharePanel`, `NoteCloneSelect`, `LinkCardDialog` e `LinkedCardSpan`.
   - "Excluir" só aparece para quem pode excluir, com confirmação (corrige :1426).
   - A revogação de acesso aparece para o dono e para o Mestre, alinhada ao serviço (:1028, :1065).
   - O `parseContentToSections` sai do runtime e vai só para a M006.
   - O caso especial `noteType === "quest"` vira metadado de tipo.
5. **`JournalWorkspace` dividido:** `JournalSidebar`, `FolderTree`, `ScopeTabs`, `InlineFolderForm` e `useJournalDragDrop`.
   - A resolução de escopo e dono vira uma função só (:719-731, :806-818, :1402-1413).
   - O filtro de escopo também (:763-768, :1033-1038).
6. **`JournalGraphWebView`:**
   - zoom com listener `wheel` **não passivo**, via ref (corrige :84-85; reproduzir antes);
   - arrastar nós só com permissão (:321-334);
   - grafo calculado pelo engine por leitor, respeitando `ignoredAliases` (corrige aliasEngine :278-288);
   - os metadados de UI (cores e emojis) saem do engine e vão para `components/journal`.
7. **Migração M006:**
   - `sections` (mapa) a partir de `content` quando necessário, com o parser usado só aqui;
   - remove `content`, `aliasesNormalized` e `mentionedNoteIds`;
   - `graphNode` → `graphPosition`;
   - `imageMediaId` → `image`;
   - `rev`.

**Itens:** INT-09, INT-10 (M006), SEG-11, MOD-06 (`imageMediaId` → `image`), MOD-07, MOD-14 (campos de nota), FUN-11, FUN-12, FUN-28 (UI), FUN-19 (notas), EST-04 (Diário), EST-03 (`journalService`).

**Testes:**
- engine: aliases com e sem acento, negação local, grafo por leitor;
- serviço: cancelar o editor não deixa alteração no destino;
- reprodução do Codex: menção ignorada que reaparecia no grafo agora não aparece.

**Aceite:** os fluxos do Diário funcionam no emulador M006; nenhuma alteração cruza notas sem salvar.

**Gate G7:** apenas informativo (D-DER-6 já confirmada).

### Fase 8 — Tabuleiro (RTDB v2)

**Entregáveis:**
1. **Nós e regras do RTDB v2** (6.2), com `.validate` em tudo:
   - controladores só movem e giram;
   - campos administrativos (`controlledBy`, `kind`, `characterId`, `ownerId`, `layer`, `hidden`) só pelo Mestre (corrige [database.rules.json:9](database.rules.json#L9));
   - projeção do PC só pelo Mestre, pelo dono do token ou por quem está em `controlledBy`, com `rev` estritamente maior (Seção 6.2);
   - `tokenSecrets` com `.write` no nó do token e `.validate` por campo (Seção 6.2);
   - desenhos não trocam de `layer` numa atualização;
   - pings expiram por `createdAt` do servidor + `PING_LIFETIME_MS`.
2. **`tokenService`:**
   - `spawn`: PC como projeção, preservando V-12; NPC e token livre como instância, com `tokenSecrets`;
   - `move` (controladores, com limite de frequência);
   - `updateAdmin` (Mestre);
   - **ajuste rápido de HP:**
     - **PC:** `characterService.applyResourceDelta` e depois projeção (U3);
     - **NPC:** transação em `tokenSecrets` e depois a projeção das barras;
   - `setVisibility`: grava `hidden` e move o token entre `tokens` e `hiddenTokens` na mesma atualização multi-caminho;
   - `remove` (dono ou Mestre, **sem** confirmação, U6), apagando o token e os seus `tokenSecrets` juntos;
   - **projeção de PC por `rev`:**
     - quem grava a ficha projeta na hora, mas só nos tokens do PC que pode gravar pelo predicado da Seção 6.2. O filtro fica no `tokenService`, que nem tenta gravar nos demais;
     - os tokens que o autor não pode gravar (ex.: um editor da ficha que não controla o token) convergem pela reconciliação do Mestre, que roda ao iniciar a sessão, ao ativar uma cena e sempre que detectar divergência;
     - resolve INT-06: remove o `skipTokenSync` de [combatService.js:528](src/services/combatService.js#L528) e o `console.warn` de [useCharacters.js:297-299](src/hooks/useCharacters.js#L297-L299);
   - **partição pela névoa:** o cliente do Mestre recalcula sempre que muda a névoa ou move um NPC, respeitando `hidden` (Seção 6.2).
3. **`drawingService`:**
   - criar, editar, excluir;
   - transformar um grupo numa **única** atualização multi-caminho (corrige INT-19);
   - sem campos duplicados de compatibilidade (`shapeType` duplo, `authorId`/`createdBy`, `timestamp`).
4. **`pingService`:**
   - `createdAt` pelo servidor (`ServerValue.TIMESTAMP`); expiração derivada de `createdAt + PING_LIFETIME_MS` (hoje 2200 ms, em [useBoardInteractive.js:16](src/hooks/useBoardInteractive.js#L16), movida para `domain/constants`);
   - `onDisconnect().remove()` registrado na criação;
   - limpeza de expirados por qualquer membro;
   - renderização com `.info/serverTimeOffset`;
   - sem `setTimeout` na aba emissora (corrige useBoardInteractive :221, :267-269);
   - o tick de 250 ms ([useBoardInteractive.js:161-172](src/hooks/useBoardInteractive.js#L161-L172)) passa a re-renderizar **só** a camada de pings.
5. **`fogService`:** sem caminhos fixos; o limite `w < 8` passa a ser uma constante única.
6. **Hooks:**
   - `useSceneTokens` (público, mais o oculto quando Mestre);
   - `useTokenSecrets`;
   - `useDrawings`;
   - `usePings`;
   - `useFog`;
   - removidos: `useBoardInteractive`, a migração dentro de hook (:63-135) e os exports mortos (`allItems`, `deleteDrawingItems`, `moveStrokes`, :597-608).
7. **`TargetSelectionContext`:**
   - **só IDs**: substitui o `targetSelectionRef`, que guarda cópias de tokens ([VTTLayout.jsx:174-178](src/components/layout/VTTLayout.jsx#L174-L178)), e a API dupla `targetedToken`/`targetedTokens` (BoardViewport :34-36, :180-197);
   - IDs de tokens removidos saem da seleção (corrige :380-391);
   - sincronizado entre janelas.
8. **`BoardViewport` decomposto:**
   - `useBoardCamera`;
   - `useBoardHotkeys`, **um** despachante de teclado com a mesma proteção de campos em foco (corrige :332, :421, :453, :473);
   - máquina de estados de ferramentas (`useBoardTools`, reducer por ferramenta);
   - **interface da política de turno** (`canActorMove(actor, meters)` / `canActorAct(actor, kind)`), criada **nesta fase** em `engines/turn` + `TurnPolicyContext`, com a implementação congelada atual lendo o `combatState` de hoje. O `useTokenDrag` e, na Fase 9, o combate consultam só essa interface. A Fase 11 só troca a fonte para `state/turn`;
   - `useTokenDrag` (consulta a política acima);
   - `useAoeDemarcation` (conjurador explícito, sem "primeiro token": :242);
   - `useSnowballProjectiles` (origem por id do token, sem casar nomes: :504-508);
   - `useTokenSpeech` (balões pelo personagem da mensagem e pelo token, sem casar nomes: :1361-1379). Lê a mensagem por um seletor único (`getSpeechSource(msg)`), que nesta fase entende o formato v1 e na Fase 9 passa ao v2 (`sender.characterId`, `createdAt`);
   - `BoardDrawingsLayer`;
   - `BoardTextEditor`;
   - `BoardHud`;
   - `TokenQuickHpPopup`.
9. **Bugs corrigidos:**
   - editar um texto preserva fonte e cor (:1926-1933 contra :2456-2457 e :760-764);
   - clique em desenho de outra camada (:569-571, :1642, :1793);
   - `setConeAngle` fora do updater (:478-482);
   - checagem morta `maxRangePx > 0` (:304);
   - AoE e régua usam **somente** tokens renderizados (SEG-09; com a partição, nem chegam ao jogador);
   - "Capturar N Alvos" (:2501-2514) e confirmação de AoE sobre token (TokenSprite :77-85): **reproduzir e corrigir**;
   - balões que piscam no carregamento (TokenSpeechBubble :18-31).
10. **`BoardLeftToolbar`:** contexto de ferramentas no lugar de 37 props; `MeasureFlyout`, `DrawFlyout`, `LayerFlyout`, `GmMapFlyout` e `ZoomControls`; estilo de botão de flyout único; `CPButton`; amostras de cor compartilhadas com o `TokenModal`; limites de zoom unificados; trocar de camada deixa de limpar a seleção como efeito colateral na toolbar (:515-517).
11. **`TokenModal`:** reducer, `WindowModal`, sem regras de negócio na UI (:63, :67-73, :88-90, :122, :133).
12. **`TokenSprite`:** dividido em `TokenStatusRing`, `TokenHpBar` e `TokenQuickMenu`; sem checagens mortas (:61, :69, :108); anéis sem duplicação (:114-147 e :150-183); camadas com `Z_LAYERS` locais nomeados.
13. **`BoardMeasurementLayer`:** um componente de linha; cone pelo engine. **`FogOfWarCanvas`:** pelo engine.
14. **`BoardTokensContext`/`Provider`:** removidos (substituídos por `useSceneTokens` e pelos contextos acima).
15. **Confirmações no tabuleiro (U6, U6a):** os botões de "tudo" do Mestre (apagar todos os desenhos da cena e recobrir o mapa inteiro com névoa) pedem confirmação. Apagar um ou vários desenhos selecionados, revelar ou esconder uma área de névoa e excluir tokens **não** pedem.
16. **Migração M007:**
    - desenhos de `fog/{cena}/drawings` → `drawings/`, incluindo as 2 cenas pendentes;
    - `controlledBy` → mapa;
    - `kind` dos tokens;
    - `visibleToPlayers === false` → `hidden: true` (e o token vai para `hiddenTokens`); nos demais tokens, `hidden: false`; remove `visibleToPlayers`;
    - separação público/segredos/oculto;
    - `ImageRef`;
    - campos de desenho unificados;
    - remove `campaignId` e `sceneId` de dentro dos nós (`tokens`, `fog/{cena}` e suas áreas, `drawings`, `pings`, `presence`);
    - remove `fog/*/drawings`, `fog/*/pings` e pings antigos.
17. **Remover o adaptador de transição T3** (ficha v2 → token v1) e criar o **T4** (Seção 7.3).

**Itens:** SEG-04, SEG-06 (tokens), SEG-09, INT-01 (NPC), INT-06, INT-10 (M007), INT-16, INT-17, INT-19, MOD-06 (tokens), MOD-09, MOD-14 (RTDB), FUN-01, FUN-02, FUN-03, FUN-04 (tabuleiro), FUN-14, FUN-15, FUN-22, FUN-23, FUN-31, FUN-32, PERF-05 (contextos do tabuleiro), PERF-06, EST-04 (tabuleiro), EST-07 (refs e estado do tabuleiro), EST-08 (tabuleiro).

**Testes:**
- regras (Apêndice B, bloco B5), inclusive a reprodução do Codex: o controlador concedia controle a outro usuário, o que agora é negado;
- jogador não lê `hiddenTokens` nem `tokenSecrets` alheios;
- projeção: duas escritas fora de ordem convergem pelo `rev`;
- ping expira com a aba fechada.

**Aceite:** o tabuleiro completo funciona no emulador M007; o jogador não recebe tokens ocultos nem números de NPC.

**Gate G8:** apenas informativo (D-DER-3 e U6a já confirmadas).

### Fase 9 — Combate e rolagens

**Entregáveis:**
1. **Mensagem v2** (6.1.3) e **regras de mensagens:**
   - formato validado;
   - **criação sempre por transação com o contador `state/chat`** (`seq = lastSeq + 1`), validada pelas regras com `get`/`getAfter`. Mensagens não podem ser enviadas offline: a falha gera retorno ao usuário. Teste de contenção: vários clientes enviando ao mesmo tempo → `seq` únicos, sem perda (o SDK repete a transação);
   - `appliedEffects` vazio na criação; `hitEvaluation` conforme 6.1.3 e D-DER-3 (SEG-13);
   - transição de `status` só pelo remetente;
   - resposta de resistência com **ID determinístico** (`save_${saveId}`), que só pode ser criada e só pelo responsável. A regra lê a mensagem do pedido e a ficha-alvo: o dono ou editor da ficha, ou o Mestre quando o alvo é NPC ou não tem ficha (resolve SEG-12 e INT-05).
2. **Divisão do `rollService`:**
   - `chatMessageService` (envio dos tipos de mensagem, com uma estrutura base única no lugar das 4 cópias :596-626, :642-671, :684-728, :868-968);
   - `domain/speakerIdentity`;
   - `engines/rolls`.
   - Remove a política de avatar (:15-23), as regex em português (:220-227, :263-269), o `customName` por igualdade (:48-54), o `attackWhenTargeted` (:416-428), o argumento morto `hasTarget` (:840), `deletedBy: "gm"` (:567) e os padrões `forca`/`1d20` duplicados.
3. **`combatService` reescrito com sagas** (`operationRunner`):
   - **Rolagem com custo:** mensagem `pending` (`opId`) → desconto idempotente na autoridade (ficha do PC, ou `tokenSecrets` do NPC) → `committed`. Recuperação de `pending` ao iniciar (resolve INT-03); para quem não é Mestre, a consulta de recuperação inclui `where('visibleTo','array-contains-any',['ALL', uid])` (Apêndice A).
   - **Dano e efeito (Mestre):** `opId` por clique, transação na autoridade, `appliedEffects.{opId}` por caminho de campo (resolve INT-04).
   - **Resistência:** cria a resposta única → custos e consumíveis idempotentes.
4. **Avaliação de acerto híbrida (D-DER-3):**
   - o combate consulta a política de turno (`canActorAct`) criada na Fase 8, no lugar do `evaluateActorAct` direto;
   - `engines/combat` decide, por alvo, se quem ataca **pode ler** a Defesa autoritativa: a ficha, para PC (pela audiência da ficha), ou `tokenSecrets`, para NPC ou token livre que ele controla;
   - se pode ler a Defesa de todos os alvos, o navegador do atacante avalia e cria a mensagem com `hitEvaluation.status: "done"`; caso contrário, cria com `"pending"`;
   - **`refereeService` + `useRefereeLoop`** (cliente do Mestre, só na janela principal): avalia as mensagens `pending` usando a ficha (PC) ou `tokenSecrets` (NPC), grava `hitEvaluation` sem números e processa as pendências ao conectar. É idempotente (só grava se ainda estiver `pending`, em transação).
5. **Custos de assistências de aliados (D-DER-3, resolve INT-13):**
   - quem rola o dano cria um documento `pendingCosts/{opId}` por custo de aliado e referencia os `opId` em `roll.allyCostOps`;
   - `useAllyCostsProcessor` roda no navegador de quem pode editar a ficha aliada (dono ou editor) **e** no do Mestre. Cada um assina só os `pendingCosts` pendentes que pode aplicar;
   - aplicar = uma transação que desconta da ficha (com `recentOps`) e marca o documento `applied`. Vale quem fizer primeiro; o segundo encontra `applied` e não faz nada.
6. **Coordenação da resistência entre janelas:**
   - **remove** todo o protocolo em `localStorage`: reivindicações, TTLs, registro de fichas abertas, `markSavingThrowAnswered` (combatService :625-823) e os timers de 120 ms e 15 s (VTTLayout :494, :524-528);
   - "respondido" passa a ter **uma** fonte: a existência da resposta;
   - a janela que exibe o pop-up é decidida pela **presença por conexão**: se existe uma conexão `kind: "sheet"` com o `sheetId` do alvo, a ficha destacada exibe e a principal não;
   - o botão manual no chat só aparece para o responsável ou o Mestre (corrige RollMessageCard :567-574).
7. **Modais:**
   - `DamageRollModal` e `SavingThrowModal` usando a normalização única do engine, com cabeçalhos e seleções compartilhados;
   - `CombatModals` **sem** cair para o `activeCharacter` (:27-31, :45-51; personagem ausente gera erro explícito) e sem ref mutada como prop (:14, :39-41).
8. **Ping de habilidade:** repassa `trigger` (corrige SkillPingCard :228-251); só rola como o personagem quem pode agir por ele (:229); usa o `shortcutResolver`.
9. **Cards de ataque sem `targetInfo`** passam a mostrar "sem avaliação" e nunca usam o alvo atual de quem vê (RollMessageCard :77-84). A prévia de efeito usa o alvo da mensagem (:196, :208).
10. **Transição T5 (Seção 7.3)** para o chat v1, que só é reescrito na Fase 10:
    - um seletor único de leitura de mensagem, usado por `useChatRolls`, pelos cards, pelo avatar e pelo `getSpeechSource` do tabuleiro;
    - ordem por `seq`; personagem, nome e imagem por `sender`; dados por `roll`; horário por `createdAt`.
    - Sem isso, a M008 quebra o chat e os balões.
11. **`createCampaign`** passa a criar também `state/chat { lastSeq: 0 }` no mesmo lote (Fase 3).
12. **Migração M008:**
   - `seq` atribuído a todas as mensagens existentes pela ordem de `createdAt` (ou `timestampMs`, onde faltar), com desempate determinístico por id; `state/chat.lastSeq` = maior `seq` e `state/chat.lastMessageId` = id da mensagem com esse `seq`;
   - renomeações: `rollData` → `roll`; `skillData` → `skillPing`; `icon` do emote → `emote{…}`; campos soltos do remetente (`senderId`, `senderName`, `senderPhotoURL`, `senderAvatarMediaId`, `characterId`, `characterMediaId`) → `sender{…}`;
   - estrutura `sender`;
   - avatares Base64 das 13 mensagens antigas → documentos da coleção `media` do Firestore (D-DER-9);
   - `createdAt` a partir de `timestampMs` onde faltar;
   - `roll.kind` preenchido uma vez pelo classificador de legado (regex **só no script**, com relatório);
   - `appliedEffects` de array para mapa;
   - `status: "committed"`;
   - `hitEvaluation` sem números;
   - `type: "ability_roll"` → `"roll"`;
   - `isDeleted` preenchido.

**Itens:** SEG-06 (Defesa e HP de NPC fora das mensagens), SEG-12, SEG-13, SEG-08 (UI), INT-01 (orquestração), INT-03, INT-04, INT-05, INT-10 (M008), INT-13, MOD-06 (`sender.image`), MOD-08, MOD-14 (campos de mensagem), FUN-05, FUN-06, FUN-07, EST-03 (`rollService`, `combatService`), EST-05 (dano, gatilhos, respondido), EST-06 (regex de ataque), EST-07 (refs dos modais), PERF-09.

**Testes:**
- regras (Apêndice B, bloco B6);
- sagas com falha injetada em cada passo → recuperação sem cobrança dupla;
- reprodução do Codex, duas submissões de resistência intercaladas → só uma vence;
- Defesa de "Goblin" não liberada por homônimo;
- avaliação híbrida: ataque ao próprio NPC controlado é avaliado na hora com o Mestre offline; ataque a um monstro do Mestre fica `pending` e é avaliado quando o Mestre conecta;
- custo de aliado aplicado uma única vez com o dono do aliado e o Mestre online ao mesmo tempo.

**Aceite:** os fluxos de ataque, dano, resistência e efeitos funcionam no emulador M008, com a janela destacada aberta e fechada.

**Gate G9:** apenas informativo (D-DER-9 já confirmada).

### Fase 10 — Chat

**Entregáveis:**
1. **Paginação por número de página (U5, U5a):**
   - **Páginas com limites fixos por `seq`:** a página *p* contém `seq` de `(p − 1) × CHAT_PAGE_SIZE + 1` até `p × CHAT_PAGE_SIZE`. Os limites nunca mudam quando chegam mensagens novas. A última página é a atual.
   - **Vista atual (ao vivo):**
     - ao entrar, uma leitura única (`getDoc`) de `state/chat.lastSeq` define a página atual: `ceil(lastSeq / CHAT_PAGE_SIZE)`, ou 1 se `lastSeq` for 0;
     - em seguida, um único listener assina as mensagens com `seq` a partir do início dessa página. Ele inclui as novas mensagens da sessão, e a vista avança de página automaticamente quando a atual enche;
     - o total de páginas é o maior valor entre o `lastSeq` lido na entrada e o maior `seq` recebido pelo listener. Assim a numeração é a mesma para todos, mesmo para quem não vê as últimas mensagens (`gm_only`);
     - não há listener no contador nem consulta de contagem.
   - **Ir para a página *p* (congelada):** uma consulta única (`getDocs`) pelo intervalo de `seq` da página. Custa só as leituras das mensagens dela e **só para quem abriu**. Sem listener. Mudanças posteriores nessa página (ex.: efeito aplicado) aparecem ao reabri-la.
   - **Navegação no topo do chat:** anterior, próxima, primeira, atual e campo para digitar o número da página. Sem textos explicativos (Princípio 8).
   - Mensagens excluídas e mensagens fora da audiência são filtradas **no servidor**. Por isso, uma página pode mostrar menos de 50 mensagens; a numeração é a mesma para todos.
   - Ordenação por `seq`. A posição de rolagem é preservada ao trocar de página.
2. **Índices** (Apêndice A) e `scripts/check-indexes.mjs`.
3. **`ChatComposer` único** (dock e barra lateral):
   - `chatCommandParser`;
   - **respeita a visibilidade escolhida** (corrige [VTTLayout.jsx:842-848](src/components/layout/VTTLayout.jsx#L842-L848));
   - `speakAs`, com o personagem nulo quando se fala como jogador (A25);
   - `QuickDiceRoller`.
4. **Registro de renderizadores** (`MESSAGE_RENDERERS` por tipo e `kind`) no lugar dos condicionais.
   - `RollMessageCard` dividido em `useRollCardModel`, `TargetBadges`, `RollLines`, `SaveRequestButton` e `EffectApplyMenu`, este com estado próprio em vez de 8 props.
   - Cabeçalho de mensagem compartilhado (TextCard, EmoteMessageCard :13-40, SkillPingCard :22-67).
   - `MessageAvatar` por `ImageRef`, sem prioridade de campo legado (:14).
5. **Bugs:**
   - `"utility"` deixa de virar `"damage"` (ChatSidebarPanel :53);
   - guardas `isGM`/`isRealGM` coerentes (useChatRolls :94-106);
   - prop morta `targetedTokens` (VTTLayout :1508);
   - pop-ups da dock que reabrem (QuickActionsHotbar :21-31, EmotePickerMenu :7-18): **reproduzir e corrigir**, tratando o botão da dock como parte da área "de dentro";
   - SVG de seta copiado 3 vezes.
6. **Confirmação** da exclusão de mensagem (Mestre).
7. **Remover o adaptador T5** (Seção 7.3): o chat reescrito lê o formato v2 diretamente.

**Itens:** SEG-10, PERF-01, FUN-13, FUN-26, FUN-19 (mensagens), EST-04 (chat), EST-05 (`/r`, cabeçalhos), EST-08 (chat).

**Testes:** com 2.030 mensagens no emulador (41 páginas):
- a entrada lê no máximo uma página (a atual), mais 1 leitura do contador e as mensagens novas;
- ir direto à página 20 lê só as mensagens dela;
- abrir páginas antigas num cliente não gera leituras nos outros clientes conectados;
- mensagem nova aparece na vista atual, e a vista avança ao encher a página;
- soft delete some da vista atual;
- página congelada não muda até ser reaberta;
- mensagens `gm_only` não aparecem para o jogador e a numeração não muda.
- Mais o `check-indexes` verde.

**Aceite:** entrar no jogo e navegar pelo histórico custa só as leituras das páginas abertas, medido pela contagem de leituras no emulador.

**Gate G10:** apenas informativo (U5a já confirmada).

### Fase 11 — Casca da aplicação, janela destacada e Modo de Turno isolado

**Entregáveis:**
1. **Roteamento** em `app/`: `MainApp` e `StandaloneSheetApp` (`?campaignId=&sheetId=`).
   - A janela destacada assina **só** a campanha, os membros, a ficha, o compêndio (importação), os tokens da cena ativa (ator e alvos) e uma consulta estreita de pedidos de resistência dirigidos à ficha. Para quem não é Mestre, essa consulta inclui `where('visibleTo','array-contains-any',['ALL', uid])` (Apêndice A).
   - A presença `kind: "sheet"` já existe desde a Fase 3.
   - **Sem** Diário, chat completo ou cenas.
   - Sem o `DamageRollModal` que nunca abre ali (StandaloneSheetView :34).
2. **`VTTLayout` decomposto:**
   - `AppShell`;
   - `TopBar` (ícones por um componente, sem 8 cópias de marcação);
   - `Dock`;
   - `Sidebar`;
   - `SidebarJournalList`;
   - `CombatActionsProvider` (`useCombatActions`), que remove o personagem ativo escolhido pelo nome do token ou por `characters[0]` (:326-331, :344) e as promessas sem `catch` (:1003-1018, :1125-1143);
   - `SavingThrowCoordinator`.
   - Sem o risco de uso antes da declaração (:221-234).
3. **Modo de Turno isolado (U1):**
   - `engines/turn` (Fase 1);
   - `turnService`;
   - documento `campaigns/{c}/state/turn` (M009 move o `combatState` para lá e o remove da campanha); `createCampaign` passa a criar também `state/turn` no mesmo lote;
   - `useTurnState`;
   - `TurnTracker`;
   - **`TurnPolicyContext`** (interface criada na Fase 8): passa a ler `state/turn`, continua sendo a **única** interface consultada pelo tabuleiro e pelo combate, com a implementação atual congelada;
   - **migra para o `turnService` e a política congelada o desconto de ação e reação** hoje em VTTLayout :437-446. Esse ramo **não** é morto: roda quando o Mestre real está na Visão Player, porque aí `isGM` é falso, `isRealGM` é verdadeiro e o `evaluateActorAct` devolve `budgetField`. O comportamento é preservado e registrado entre os defeitos congelados;
   - a política congelada recebe as duas informações, Mestre real e Visão Player ligada:
     - avaliação de ação e de movimento: "Mestre efetivo" = Mestre real com a Visão Player desligada;
     - desconto de ação: exige Mestre real e `budgetField`;
     - desconto de movimento: só no cliente do Mestre real;
   - documenta, nas DIRETRIZES, os pontos de extensão e os defeitos congelados.
4. **Regras de `state/turn`.**

**Itens:** MOD-03, PERF-03, PERF-05 (`VTTLayout`), FUN-04 (layout), FUN-24, FUN-25, EST-04 (`VTTLayout`, `StandaloneSheetView`), EST-07 (`VTTLayout`), INT-10 (M009).

**Remove o adaptador T1** (Seção 7.3): com o `VTTLayout` decomposto, não sobra consumidor de `playersMap`.

**Testes:**
- caracterização do turno (Fase 0) verde, com o comportamento congelado;
- uma política falsa injetada altera o tabuleiro sem tocar no módulo;
- contagem de assinaturas da janela destacada.

**Aceite:** a janela destacada abre com o mínimo de listeners e exibe os modais de combate; o Modo de Turno funciona como hoje.

**Gate G11:** apenas informativo.

### Fase 12 — Cenas

**Entregáveis:**
1. **`sceneService`:**
   - `grid` validado no serviço e nas regras (`cellSizePx` ≥ mínimo, corrige [useScenes.js:168-172](src/hooks/useScenes.js#L168-L172));
   - URL externa pode ser limpa (:194-206);
   - montagem de `mapImage` única (:116-122 e :187-193);
   - `DEFAULT_GRID_CONFIG` vai para `domain/defaults`.
2. **Ativar uma cena** passa a: liberar a cena, reconciliar as projeções e a partição daquela cena, e só então definir `activeSceneId`.
3. **`ScenesManagerModal` dividido:** `SceneList`, `SceneEditor` e `CampaignMapViewer`, este separado, com a URL do asset por helper (corrige o caminho fixo `"/Mapa%20Campanhaa.jpg"`, :235) e botão de fechar visível no padrão `WindowModal` (corrige :249-267). Usa `WindowModal` e compressão única.
4. **Confirmação** da exclusão de cena (:802).
5. **Leitores da imagem do mapa** passam a usar `mapImage.image`: o sucessor do `BoardViewport` (:50-51), o `CampaignMapViewer`, o `SceneEditor` (no lugar de ScenesManagerModal :12-13 e :102) e `combatService` :366-367. A exibição de `sizeBytes` (ScenesManagerModal :750-751) passa a usar o `byteLength` da mídia.
6. **Migração M010-scenes-v2:**
   - `mapImage.mediaId` e `mapImage.externalUrl` → `mapImage.image: ImageRef`;
   - `mimeType` lido de `media/{mediaId}.mimeType`, ou `null` para URL externa e cena sem imagem;
   - remove `mapImage.sizeBytes`;
   - `fogOfWar{ enabled, defaultOpaque }` → `fogDefaults{ enabled, defaultOpaque }`, removendo `fogOfWar`;
   - garante `grid.cellSizePx` ≥ mínimo.
   - **Não** fica na M002/M003 (Fase 4): até esta fase, os leitores ainda esperam o formato atual.

**Itens:** INT-12, INT-10 (M010), MOD-06 (cenas), FUN-18, FUN-19 (cenas), EST-01 (`useScenes`), EST-04 (`ScenesManagerModal`).

**Aceite:** os fluxos de cena funcionam no emulador com dados M010; uma célula 0 é recusada.

**Gate G12:** apenas informativo.

### Fase 13 — Remoção de legado, qualidade e desempenho

**Entregáveis:**
1. **Remover todos os adaptadores de transição** (a tabela fica vazia).
2. **Remover do aplicativo:**
   - `migrationService` (a migração vive só em scripts);
   - `utils/stringUtils` dividido entre `domain` e `infra`;
   - `constants/authorizedUsers.js`;
   - `services/visibilityService.js`, se tiver ficado vazio;
   - `rtdbPaths` `legacy`;
   - a limpeza de chaves antigas no `useCrossWindowSync` (:7, :113-130);
   - todo campo, formato e ramo legado de MOD-14.
3. **Migração M011-cleanup (preparada; executada no cutover):** remove campos e nós legados que sobrarem, validando antes com o `audit-v2`.
4. **Lint:**
   - regras de camadas e de pureza viram **erro**;
   - `no-empty`;
   - **0 avisos**: os 10 atuais mais os novos.
5. **Desempenho medido** com React Profiler e contagem de leituras:
   - carregamento sob demanda de modais e da janela destacada;
   - medir o bundle antes e depois. Meta: eliminar o aviso de chunk do Vite, ou justificar com medição. Hoje é cerca de 1,41 MB.
   - Registrar antes e depois no REGISTRO.
6. **CSS:**
   - regras CSS não usadas removidas (com comprovação de que nada as referencia);
   - `getAssetUrl` em todos os assets.
7. **Varredura de `components/ui/`:** nenhum overlay ou botão feito à mão sobrando.
8. **Remover `auditoria_refatoracao/`**, já portado na Fase 0, e **perguntar** ao usuário o destino de `HANDOFF_FASE6_CODEX.md` e `avaliacao_arquitetura_codigo.md`. Sugestão: mover para `docs/historico/`.

**Itens:** INT-10 (runtime, M011), MOD-14, PROC-02, PROC-03 (destino dos documentos históricos), PERF-02, PERF-07, EST-01 (lint), EST-03 (`stringUtils`, `migrationService`), EST-08, EST-09.

**Aceite:** os critérios 4.1.1 a 4.1.11 estão verdes.

**Gate G13:** decisão sobre os documentos históricos e revisão do relatório de desempenho.

### Fase 14 — Ensaio geral e cutover em produção

**Ensaio (emulador):**
1. Snapshot fresco de produção (com autorização).
2. Rodar M001 → M011 em sequência, primeiro em modo de simulação e depois aplicando.
3. `audit-v2` com 0 violações.
4. `set-runtime-config` (v2).
5. Todas as suítes.
6. Roteiros manuais (Seção 11) com o usuário, em duas contas: Mestre e jogador.
7. Estimativa de leituras e escritas: precisa ficar dentro das cotas do Spark.
8. **Ensaio da restauração:** backup → migrações → `restore-production` contra o emulador, conferindo que o estado voltou exatamente ao snapshot.

**Cutover** (cada passo irreversível exige autorização explícita no momento):
1. **Janela de manutenção**, combinada com o usuário. Confirmar pela presença que não há jogadores online.
2. **Backup:**
   - Firestore (`backup-production.mjs`);
   - RTDB (`firebase database:get / --account <conta>`);
   - lista de usuários do Auth.
   - Verificar que os arquivos abrem e têm as contagens esperadas.
3. **Regras de manutenção** (negam escritas de clientes). Deploy de `firestore:rules` e `database` com `--account`.
4. **Deploy dos índices** (`firestore:indexes`). Aguardar o status "construído".
5. **Migrações em produção:** simulação → revisão do relatório com o usuário → aplicação → `audit-v2` com 0 violações.
6. **Regras v2.**
7. **Hosting v2** (com `--account`) e `appConfig/runtime` pelo `set-runtime-config`.
8. **Smoke test** com o usuário (Seção 11, roteiro curto).
9. **Reabertura.**

**Rollback:**
- **Falha em qualquer passo antes da reabertura** (inclusive no hosting v2 e no smoke test), com a janela de manutenção ainda ativa. O usuário decide no Gate G14 entre:
  - (i) corrigir para a frente dentro da janela, se a correção for pequena, refazendo o smoke test;
  - (ii) fazer o rollback completo: manter as regras de manutenção, restaurar o backup (`restore-production.mjs`, que deixa o Firestore idêntico ao backup, e `firebase database:set`), publicar as regras **e** o hosting de `abf44e8` e só então reabrir.
- **Falha depois da reabertura:** corrigir para a frente, nunca fazer rollback de dados com usuários ativos.

**Itens:** PERF-02 (migrações aplicadas em produção), INT-10 (execução das migrações em produção).

**Gate G14:** autorização de cada passo do cutover.

### Fase 15 — Documentação e encerramento

1. **Reescrever o `DIRETRIZES_ARQUITETURA.md`:**
   - princípios atualizados;
   - camadas e padrões (Seções 5.1 e 5.2);
   - schema v2 completo;
   - contrato de segurança;
   - invariantes;
   - pastas;
   - chat paginado;
   - sagas e árbitro;
   - projeção U3;
   - Modo de Turno isolado (pontos de extensão e defeitos congelados, com a D-4 como insumo);
   - modelo de confiança U2;
   - design system atual.
2. **`REGISTRO_REFATORACAO.md`:** fechar a seção "REFATORAÇÃO 2" com a tabela de status de **todos** os IDs do catálogo (Seção 9) e as evidências.
3. **`README.md`:** setup, emuladores, testes, scripts, roteiro de deploy e cutover.
4. **Auditoria final contra a Seção 4**, item a item, com evidência. Relatório honesto ao usuário: o que passou, o que não passou e por quê.

**Itens:** MOD-12, PROC-03 (fechamento).

---

## 9. Catálogo de pendências e rastreabilidade

**Origem:** **[C]** Codex · **[CL]** Claude · **[AUD]** auditoria por área · **[R]** registrado como aceito ou futuro no REGISTRO (agora a corrigir) · **[E]** conforme a especificação v1 (lacuna de desenho).

### 9.1 Segurança

| ID | Problema | Referências | Fase |
|---|---|---|---|
| SEG-01 [C][CL][E] | A associação à campanha não existe nas regras. O documento da campanha (com e-mails) é legível por qualquer conta autenticada. Qualquer conta cria campanhas. A conta é criada antes da verificação. E-mails reais estão fixos no código e nas regras. A verificação consulta a campanha padrão. Há I/O num arquivo de constantes. | `firestore.rules:46-49`; `database.rules.json:5`; `authorizedUsers.js:4-41`; `AuthContext.jsx:47-58, 118-126` | 3 |
| SEG-02 [C] | Autoridade do Mestre fragmentada: `assignGM` é revertido pelo papel na whitelist; a exceção por e-mail ignora a delegação; sem `email_verified`; espelho `meta/gmId` sem protocolo de transferência. | `CampaignContext.jsx:332-358, 647-675`; `firestore.rules:9-22`; `database.rules.json:39` | 3 |
| SEG-03 [C] | Um editor remove o `ownerId`, grava o próprio UID e passa a excluir. Editores alteram `visibleTo`, `editableBy` e `scope`. | `firestore.rules:103-134` | 4 |
| SEG-04 [C][CL][R] | No RTDB, quem controla um token altera campos administrativos e concede controle a terceiros. Não há `.validate`. Desenhos trocam de camada. Pings, névoa, presença e `meta` não têm validação de forma. | `database.rules.json:9, 21, 28` | 8 (presença e `meta`: 3) |
| SEG-05 [C][CL] | Mídia: tamanho declarado pelo cliente, `uploadedBy` livre, documento mutável, `chunks` aberto, leitura e listagem amplas. | `firestore.rules:139-155` | 4 |
| SEG-06 [C][CL][R][E] | Tokens ocultos ou sob a névoa e os números de NPCs chegam aos jogadores. A leitura é concedida num nó ancestral do RTDB. | `database.rules.json:5`; `useRealtimeTokens.js:77-80` | 4 (mídia), 8, 9 |
| SEG-07 [C][CL] | Visibilidade com múltiplas fontes e contradições (`ALL` com `false`). Compartilhar e revogar acesso são assimétricos. Consultas `or` com fallback silencioso. | `visibilityService.js:45-86`; `journalService.js:385-418` | 4 |
| SEG-08 [C][AUD] | A Defesa é liberada por nome e o alvo é resolvido por nome. | `combatEngine.js:230-233, 356-362` | 1, 9 |
| SEG-09 [C][AUD] | A prévia de AoE e a régua usam tokens sob a névoa. | `BoardViewport.jsx:273, 1459` | 8 |
| SEG-10 [C][AUD] | O texto da dock ignora a opção de visibilidade. | `VTTLayout.jsx:842-848` | 10 |
| SEG-11 [C][AUD] | `mentionedNoteIds` grava IDs de notas secretas. | `journalService.js:269-281` | 7 |
| SEG-12 [C][AUD] | Um jogador responde à resistência de outro, rola o ping de habilidade de outro, e a defesa cai para o `activeCharacter`. | `RollMessageCard.jsx:567-574`; `VTTLayout.jsx:643-653`; `SkillPingCard.jsx:229`; `CombatModals.jsx:27-31, 45-51` | 9 |
| SEG-13 [CL] | A criação de mensagens não valida o formato: campos que só o Mestre deve gravar (efeitos aplicados) podem ser forjados, e não há ordem garantida pelo servidor. | `firestore.rules:90-94` | 9 |

### 9.2 Integridade

| ID | Problema | Referências | Fase |
|---|---|---|---|
| INT-01 [C][CL] | HP e MP gravados como valor absoluto a partir de um snapshot. | `combatService.js:59-73, 265-311`; `useCharacters.js:640-673` | 5, 8, 9 |
| INT-02 [CL][AUD] | Cerca de 30 regravações de arrays inteiros da ficha em 9 arquivos. | abas da ficha, `CharacterSheetModal`, `CompendiumModal`, `QuickActionsHotbar`, `combatService:156-158` | 5 |
| INT-03 [C][AUD] | Custo descontado antes da mensagem; sem idempotência; uma nova tentativa cobra de novo. | `rollService.js` (cerca de :778); `VTTLayout.jsx:418-422` | 9 |
| INT-04 [AUD] | `rollData` e `appliedEffects` reescritos inteiros. | `rollService.js:549-556`; `combatService.js:319-336` | 9 |
| INT-05 [C][AUD] | Protocolo de resistência entre janelas em `localStorage`, sem exclusão real; "respondido" em 4 lugares; limite de 50 entradas pode descartar pedidos ativos; tempos mágicos. | `combatService.js:625-823`; `VTTLayout.jsx:467-541, 643-741` | 9 |
| INT-06 [C] | Ficha ↔ token sem autoridade, versão nem reconciliação; `skipTokenSync`; falha só em `console.warn`; sincronização só na cena ativa. | `combatService.js:432-530`; `useCharacters.js:150-300` | 8 |
| INT-07 [C][AUD] | Árvore de fichas: ciclos, travessia sem visitados, exclusão não atômica que engole erros, fichas órfãs, troca de dono sem cascata, modal "Mover" com dono errado, arrastar e soltar muda o dono sem aviso, pasta não volta à raiz pela UI, pastas compartilhadas invisíveis, filtro `ownerId === gmUid`, nome em edição desatualizado. | `useCharacters.js:118, 509-612`; `CharactersSidebarList.jsx:216, 240-247, 530, 580, 666-672, 757-760, 937` | 6 |
| INT-08 [C][AUD][R] | Pastas do Diário: a exclusão cruza escopos e donos, achata subpastas, escreve em sequência sem lote e engole erros; caminho como identidade; colisões; nomes com "/"; dois modelos de hierarquia. | `journalService.js:497-593`; `JournalWorkspace.jsx:47, 707-717` | 6 |
| INT-09 [C][AUD] | Editor do Diário: o vínculo grava no destino na hora; negar remove o alias globalmente; falhas ignoradas; o grafo ignora `ignoredAliases`; matchers divergentes; navegar salva em silêncio; o clone copia campos derivados. | `NoteEditorModal.jsx:403-444, 548-555`; `aliasEngine.js:84-86, 165, 278-288`; `journalService.js:344-345` | 7 |
| INT-10 [C][CL][R] | Migração varre tudo a cada sessão; heurística do peixe altera dados válidos; trava só em memória; migrações dentro de hooks; legados pendentes (2 cenas); lotes parciais. | `migrationService.js:253-295, 380-382, 589-591`; `useBoardInteractive.js:63-135`; `useRealtimeTokens.js:82-99`; `CampaignContext.jsx:45-62, 308-330` | 5–9 (scripts), 13 |
| INT-11 [C][AUD] | Fórmulas: colisão entre atributo e perícia, variável desconhecida vale 0, "2x3" vira 2, erro vira 0, normalizações divergentes, variáveis fixas sobrescrevem perícias. | `formulaEngine.js:11-49, 57, 93, 122, 134`; `SheetSkillsTab.jsx:59` | 1, 5 |
| INT-12 [C][AUD] | Cena: `grid` sem validação ao atualizar; a URL externa não pode ser limpa. | `useScenes.js:168-172, 194-206` | 12 |
| INT-13 [CL] | Custos de assistências de aliados não descontados, em silêncio, quando quem rola não edita a ficha do aliado (confirmar por reprodução). | `useCharacters.js:646-647`; `combatService.js:88-165` | 9 |
| INT-14 [CL][C] | Presença registrada por usuário e não por conexão; sem `.info/connected`; efeito depende de `campaignData`; perfil duplicado na presença. | `CampaignContext.jsx:408-467, 552-569` | 3 |
| INT-15 [C] | Troca de campanha sem reinício de estado; carregamento identificado só pelo uid; cache de mídia com fallback sem campanha; chaves `"default"`. | `CampaignContext.jsx:64-99, 154`; `mediaService.js:83, 180`; `useCrossWindowSync.js:148`; `combatService.js:720, 770, 800, 812` | 2, 3 |
| INT-16 [C][AUD] | Pings limpos por timer da aba que os criou; expiração pelo relógio local. | `useBoardInteractive.js:221, 267-269` | 8 |
| INT-17 [C][AUD] | Alvos de tokens apagados continuam selecionados. | `BoardViewport.jsx:380-391` | 8 |
| INT-18 [C][AUD] | O item inspecionado no inventário fica desatualizado. | `SheetInventoryTab.jsx:13, 51, 298-313` | 5 |
| INT-19 [AUD] | Movimentos e rotações de grupo feitos em N escritas separadas. | `useBoardInteractive.js` (transformações) | 8 |
| INT-20 [AUD] | Falhas silenciosas: `catch` e `onError` vazios, promessas sem `catch`. | `useCompendium.js:44`; `CampaignContext.jsx:569, 586`; `useCrossWindowSync.js:39, 52, 127, 142, 215, 227`; `useBoardInteractive.js:52-57, 152-154`; `VTTLayout.jsx:1003-1018, 1125-1143` | 2 e todas |

### 9.3 Modelagem

| ID | Problema | Fase |
|---|---|---|
| MOD-01 | Mapa `players` dentro do documento da campanha. | 3 |
| MOD-02 | `authorizedUsers` como array de objetos; whitelist por e-mail e o resto por uid; papéis duplicados. | 3 |
| MOD-03 | `combatState` no documento da campanha. | 11 |
| MOD-04 | Coleções internas da ficha em arrays, substituídos inteiros a cada edição. | 5 |
| MOD-05 | Chave da perícia derivada do nome. | 5 |
| MOD-06 | Imagens descritas por vários campos combinados. | 3, 5, 7, 8, 9, 12 |
| MOD-07 | Notas: campos derivados persistidos; `graphNode` em vez de `graphPosition`; pasta por caminho; sem `folderId`. | 6, 7 |
| MOD-08 | Mensagens: `timestampMs` do cliente, remetente em campos soltos, Base64 legado, `rollKind` ausente, `appliedEffects` como array, Defesa dentro de `hitEvaluation`, tipo `ability_roll`. | 9 |
| MOD-09 | Tokens: classificação derivada, números públicos, `controlledBy` legado. | 8 |
| MOD-10 | PC ou NPC decidido a partir do `gmId`. | 5 |
| MOD-11 | Valores padrão divergentes para a mesma entidade. | 1, 5 |
| MOD-12 | Documentação diverge do schema. | 15 |
| MOD-13 | `visibleToPlayers` duplicando `visibleTo`; custo plano no compêndio ao criar e aninhado ao atualizar. | 4, 5 |
| MOD-14 | Campos e formatos legados: `qty`/`quantity`; alcance e AoE planos; `authorId`/`createdBy`; `senderId`/`authorId`; `createdAt`/`timestamp`; `shapeType` duplicado; texto `typeof`; traços sem tipo; `attackWhenTargeted`; `sk.attr`; `isFolder`/`migratedToFoldersCollection`; `cp_remember_pwd`; chaves antigas de alvo e AoE; campos antigos de mensagem (`rollData`, `skillData`, remetente solto); `fogOfWar` e `mapImage` antigo das cenas; `visibleToPlayers`, `campaignId` e `sceneId` dentro dos nós do RTDB. | 3, 5–9, 12, 13 |
| MOD-15 | Schema de mídia sem audiência e com tamanho declarado pelo cliente. | 4 |

### 9.4 Funcional

| ID | Problema | Referências | Fase |
|---|---|---|---|
| FUN-01 | Editar um texto no tabuleiro reseta fonte e cor. | `BoardViewport.jsx:760-764, 1926-1933, 2456-2457` | 8 |
| FUN-02 | Clique do Mestre em desenho de outra camada não faz nada. | `:569-571, 1642, 1793` | 8 |
| FUN-03 | `setConeAngle` chamado dentro de um updater. | `:478-482` | 8 |
| FUN-04 | Heurísticas por nome: origem da bola de neve, balões de fala, conjurador da AoE, personagem ativo; o Mestre cai para `characters[0]`. | `BoardViewport.jsx:242, 504-508, 1361-1379`; `VTTLayout.jsx:326-331, 344` | 8, 11 |
| FUN-05 | O ping de habilidade não repassa `trigger`. | `SkillPingCard.jsx:228-251` | 9 |
| FUN-06 | Cards sem `targetInfo` usam o alvo atual de quem vê; a prévia de efeito diverge do alvo da mensagem. | `RollMessageCard.jsx:77-84, 196, 208` | 9 |
| FUN-07 | `critFormula` ignorado; CD `\|\| 10`; `\|\| "1d6"`; regex descarta assistências com d20. | `VTTLayout.jsx:546, 580, 700`; `SavingThrowModal.jsx:133, 142`; `rollService.js:925` | 1, 9 |
| FUN-08 | O filtro do compêndio na aba Skills deixa de fora `spell`. | `SheetSkillsToolbar.jsx:13, 35` | 5 |
| FUN-09 | Perícia nova com atributo inexistente. | `useSkillsFormState.js:10` | 5 |
| FUN-10 | Demarcação de área com o id errado; reordenação só para cima; estado `crSave` morto. | `SheetRollsTab.jsx:77-95, 625, 650` | 5 |
| FUN-11 | O botão de excluir nota aparece para quem só edita; revogação só para o Mestre na UI. | `NoteEditorModal.jsx:1028, 1065, 1426` | 7 |
| FUN-12 | Zoom do grafo (reproduzir); arrastar nós sem permissão. | `JournalGraphWebView.jsx:84-85, 321-334` | 7 |
| FUN-13 | Pop-ups da dock reabrem (reproduzir). | `QuickActionsHotbar.jsx:21-31`; `EmotePickerMenu.jsx:7-18` | 10 |
| FUN-14 | "Capturar N Alvos" (reproduzir). | `BoardViewport.jsx:2501-2514` | 8 |
| FUN-15 | Confirmação de AoE sobre um token (reproduzir). | `TokenSprite.jsx:77-85` | 8 |
| FUN-16 | Recuperação de senha para e-mail falso; erro detectado por texto; objeto `User` espalhado. | `LoginScreen.jsx:51-63, 140`; `AuthContext.jsx:21, 147` | 3 |
| FUN-17 | Remover um usuário não revoga o acesso; sem confirmação. | `GMPanelModal.jsx:342` | 3 |
| FUN-18 | Cenas: botão de fechar invisível, caminho de imagem fixo, exclusão sem confirmação. | `ScenesManagerModal.jsx:235, 249-267, 802` | 12 |
| FUN-19 | Confirmações de exclusão (U6). | todas as entidades | 3, 5, 6, 7, 10, 12 |
| FUN-20 | Compêndio: "Oculto" inconsistente, fallback permissivo, `setTimeout` sem limpeza. | `CompendiumModal.jsx:36, 110-112, 166, 690` | 5 |
| FUN-21 | Árvore: `canEdit` fixo; campanha `"main-table"` fixa. | `CharactersSidebarList.jsx:32, 686, 708, 822, 844` | 6 |
| FUN-22 | Balões de fala piscam ao carregar. | `TokenSpeechBubble.jsx:18-31` | 8 |
| FUN-23 | Quatro listeners de teclado com proteções diferentes. | `BoardViewport.jsx:332, 421, 453, 473` | 8 |
| FUN-24 | Modo de Turno: isolamento (U1). O desconto de ação em VTTLayout :437-446 é alcançável (Visão Player do Mestre) e é **preservado** na política congelada, e não removido. | `VTTLayout.jsx:437-446` | 8, 11 |
| FUN-25 | `DamageRollModal` morto na janela destacada. | `StandaloneSheetView.jsx:34` | 11 |
| FUN-26 | `"utility"` vira `"damage"`; guardas `isGM`/`isRealGM` incoerentes. | `ChatSidebarPanel.jsx:53`; `useChatRolls.js:94-106` | 10 |
| FUN-27 | Compressão de imagem duplicada; compressor devolve resultado acima do limite; `mimeType` fixo. | `TokenModal.jsx:86`; `ScenesManagerModal.jsx:120`; `imageCompressor.js:88-113` | 2 |
| FUN-28 | Matchers de alias divergentes ("Joao" × "João"). | `aliasEngine.js:84-86, 165` | 1, 7 |
| FUN-29 | Perfil decide quem é Mestre pelo campo `role`. | `PlayerProfileModal.jsx:85` | 3 |
| FUN-30 | `cursor: url(...)` ignora `BASE_URL`. **Já resolvido na Refatoração 1** (Fase 4): o CSS usa `var(--cp-snowball-cursor)`, resolvida em runtime com `BASE_URL`. Nada a fazer; só registrar no fechamento. | `App.css:1265-1266` | — |
| FUN-31 | Checagem morta na AoE; `/1.5` mágico. | `BoardViewport.jsx:258-263, 304, 1390` | 1, 8 |
| FUN-32 | Bounding box de texto com fatores divergentes, sem considerar rotação. | `BoardViewport.jsx:670-674`; `boardConstants.js:83-84` | 1, 8 |

### 9.5 Desempenho

| ID | Problema | Fase |
|---|---|---|
| PERF-01 | O chat lê a coleção inteira e ordena pelo relógio do cliente. | 10 |
| PERF-02 | A migração varre tudo a cada sessão. | 13, 14 |
| PERF-03 | A janela destacada monta todas as assinaturas. | 11 |
| PERF-04 | Mídia sem deduplicação de requisições; IndexedDB reaberto a cada acesso. | 2, 4 |
| PERF-05 | Valores de contexto sem memorização. | 3, 8, 11 |
| PERF-06 | Tick de 250 ms re-renderiza o tabuleiro inteiro. | 8 |
| PERF-07 | Bundle de cerca de 1,41 MB sem divisão. | 13 |
| PERF-08 | `rtdbGet` da cena inteira a cada edição de ficha. | 5 |
| PERF-09 | `localStorage` regravado a cada snapshot do chat. | 9 |

### 9.6 Estrutura

| ID | Problema | Fase |
|---|---|---|
| EST-01 | SDK fora de `services` e `infra`: 9 hooks, 2 contextos, `LoginScreen` e `authorizedUsers`. | 3–12, 13 (lint) |
| EST-02 | Engines impuros ou misturados: `combatEngine` (catálogos de UI, geometria, compatibilidade, permissões, registro global, rolagem, `Date.now`/`Math.random`); `diceEngine` (RNG embutido); `imageCompressor` em `engines/`; `aliasEngine` com metadados de UI; `boardConstants` com geometria. | 1, 2 |
| EST-03 | Services misturados: `rollService`, `combatService` (coordenação de janelas), `migrationService` em runtime, `journalService` (modelo por caminho), `stringUtils` (3 assuntos). | 2, 7, 9, 13 |
| EST-04 | Componentes que concentram responsabilidades demais: `BoardViewport`, `VTTLayout`, `CampaignContext`, `NoteEditorModal`, `JournalWorkspace`, `LoginScreen`, `CharactersSidebarList`, `SheetSkillsTab`, `SheetRollsTab`, `RollMessageCard`, `ScenesManagerModal`, `BoardLeftToolbar`, `CharacterSheetModal`, `CompendiumModal`, `DamageRollModal`, `SavingThrowModal`, `TokenModal`, `TokenSprite`, `GMPanelModal`, `QuickActionsHotbar`, `PlayerProfileModal`, `useCharacters`, `useBoardInteractive`. | 3–12 |
| EST-05 | Regras duplicadas que já divergiram (lista na Seção 4.1.3). | 1 e fases de cada área |
| EST-06 | Heurísticas por nome ou regex para ícones, ataques e atalhos. | 1, 5, 9 |
| EST-07 | Estado duplicado: pares ref + state, formulários fragmentados, ref mutada como prop, uso antes da declaração. | 5, 8, 9, 11 |
| EST-08 | `components/ui/` pouco adotado: overlays e botões feitos à mão, marcação repetida. | 2, cada fase, 13 |
| EST-09 | Código morto: exports, props, ramos e argumentos sem uso. | todas, 13 |
| EST-10 | Caminhos do RTDB fixos no código (22 ocorrências). | 2 |
| EST-11 | Geração de IDs duplicada. | 1 |

### 9.7 Processo

| ID | Problema | Fase |
|---|---|---|
| PROC-01 | Sem suíte versionada de regras no emulador; a suíte atual usa mocks; não existe `npm test`. | 0 e todas |
| PROC-02 | Lint com 10 avisos e sem regra de camadas. | 0, 13 |
| PROC-03 | Documentação desatualizada (DIRETRIZES, HANDOFF). | 13, 15 |
| PROC-04 | O desenvolvimento roda direto contra a produção (não há emuladores no fluxo de dev). | 0 |

---

## 10. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| **Atomicidade entre Firestore e RTDB:** transações não atravessam os dois bancos. | Uma autoridade por dado (U3, `tokenSecrets`); projeções com `rev`; sagas com `opId`; reconciliação. **Nunca** depender de escrita dupla síncrona. |
| **Cascata de regras do RTDB:** uma permissão dada num nó acima não pode ser retirada mais abaixo. | Nenhum `.read` ou `.write` amplo em ancestrais; permissões por nó e por campo; testes adversariais (Apêndice B). |
| **Índice ausente em produção:** o emulador não exige índices. | `queries.manifest.js` + `check-indexes.mjs`; índices publicados antes do hosting; smoke test. |
| **Limites de `get()` nas regras.** | Funções com `let`; pior caso por volta de 6 leituras (membro, campanha, contador antes e depois, pedido de resistência e ficha-alvo), abaixo do limite de 20 por transação; teste no emulador cobrindo o pior caso. |
| **Contenção no contador do chat** (U5): toda mensagem passa pela transação em `state/chat`. | Mesa pequena (até cerca de 8 jogadores); o SDK repete a transação em conflito; teste de contenção com vários clientes na Fase 9. Envio offline falha com retorno ao usuário, em vez de ficar na fila. |
| **Cotas do Spark** durante a migração. | Dados pequenos; a simulação reporta contagens; o script aborta acima de 15 mil escritas. |
| **E-mail verificado bloquear jogadores atuais** (D-DER-1). | A M001 marca os membros atuais como verificados, com autorização; comunicar ao usuário antes do cutover. |
| **Abas antigas gravando formato v1 depois do cutover.** | Abas v1 não têm a checagem de `minClientVersion`. Elas são contidas pela janela de manutenção (confirmada pela presença), pelas regras de manutenção durante a migração e pelas regras v2, que validam o formato. O `minClientVersion` protege os deploys seguintes. |
| **O dev server do usuário apontado para a produção.** | Emuladores por padrão em dev; produção só com `VITE_ALLOW_PRODUCTION=true`; o usuário troca para `dev:emu` antes da primeira edição em `src/` (Seção 2.3, Fase 0). |
| **Regressão visual nas reescritas.** | Comparação de HTML estático nos componentes de apresentação; roteiro visual com o usuário por fase. |
| **HMR quebrando a página** durante a edição. | Imports antes dos usos; arquivo inteiro de uma vez. |
| **Mestre offline** (D-DER-3). | Só ataques contra alvos cuja Defesa o atacante não pode ler ficam "aguardando avaliação"; os demais são avaliados na hora. O Mestre processa as pendências ao conectar. Custos de aliados também podem ser aplicados pelo dono do aliado. |
| **Contexto longo do executor.** | Fases autocontidas; reler a seção da fase no início; registrar estado no REGISTRO a cada fase. |
| **Chave de conta de serviço.** | Fora do repositório; `.gitignore`; nunca registrar o caminho em arquivos versionados. |

---

## 11. Roteiros de verificação no navegador

Executar com o usuário. Fases 3 a 12 no emulador; Fase 14 em produção, em versão curta. Usar duas contas (Mestre e jogador) e uma janela de ficha destacada.

1. **Acesso:**
   - uma conta não convidada é recusada e não lê nada;
   - convite → cadastro com verificação → entrada;
   - delegar o papel de Mestre e devolver, sem reversão;
   - remover um membro → acesso cortado na hora e nova entrada recusada;
   - um administrador cria uma campanha nova pelo app e envia a primeira mensagem.
2. **Presença:** abrir e fechar a ficha destacada → o jogador continua online; derrubar a rede e voltar → reaparece.
3. **Visibilidade:**
   - cena, compêndio e nota ocultos não aparecem ao jogador;
   - a mídia de um recurso oculto não carrega pelo id;
   - token oculto e NPC sob a névoa não aparecem, nem na prévia de AoE ou na régua.
4. **Fichas:**
   - editar a mesma ficha em duas abas, em entradas diferentes → as duas persistem;
   - descontos simultâneos de MP somam;
   - ajustar a vida pelo token → a ficha e todos os tokens do PC são atualizados;
   - excluir itens internos pede confirmação.
5. **Pastas:**
   - tentar soltar uma pasta numa filha é bloqueado;
   - mover pasta para a raiz;
   - excluir com "mover itens" preserva as subpastas;
   - mesmo caminho em escopos diferentes não colide;
   - transferir dono pede confirmação e se aplica em cascata.
6. **Diário:**
   - vincular e cancelar → o destino não muda;
   - negar → afeta só a nota atual e o grafo respeita;
   - navegar com alterações pendentes → pergunta;
   - "Excluir" só para o dono ou o Mestre.
7. **Combate:**
   - com o Mestre offline: ataque a um NPC que o jogador controla é avaliado na hora; ataque a um monstro do Mestre fica "aguardando avaliação" e é avaliado quando o Mestre entra;
   - dano aplicado uma vez por clique, mesmo com a rede instável;
   - resistência respondida uma só vez, com a ficha destacada aberta ou fechada;
   - outro jogador não consegue responder por você;
   - assistência de aliado desconta do aliado uma única vez (com o dono do aliado e o Mestre online ao mesmo tempo).
8. **Chat:**
   - entrar carrega só a página atual;
   - ir direto a uma página antiga (ex.: 20) mostra as mensagens dela sem carregar as intermediárias;
   - abrir páginas antigas não aumenta as leituras dos outros jogadores;
   - uma mensagem secreta digitada na dock permanece secreta;
   - pop-ups da dock abrem e fecham pelo botão.
9. **Tabuleiro:**
   - editar texto preserva o estilo;
   - pings somem mesmo com a aba de quem criou fechada;
   - "apagar todos os desenhos" e "recobrir o mapa inteiro" pedem confirmação;
   - apagar vários desenhos selecionados, mexer em uma área de névoa e excluir token não pedem.
10. **Modo de Turno:** iniciar, avançar, regredir e encerrar funcionam como antes (comportamento congelado).

---

## Apêndice A — Consultas e índices

Lista **inicial**. A lista final sai do `infra/queries.manifest.js`, e cada consulta composta precisa de um índice.

| Consulta | Campos do índice |
|---|---|
| Mensagens (jogador): vista atual e páginas por intervalo de `seq` | `visibleTo` (array-contains) · `isDeleted` · `seq` |
| Mensagens (Mestre): vista atual e páginas por intervalo de `seq` | `isDeleted` · `seq` |
| Avaliações pendentes (Mestre) | `roll.hitEvaluation.status` · `seq` |
| Recuperação de sagas (próprias), qualquer usuário | `visibleTo` (array-contains) · `sender.uid` · `status` · `seq`. O remetente sempre está em `visibleTo` (`"ALL"` ou `[gmId, sender.uid]`), então a mesma consulta serve a todos |
| Pedidos de resistência para uma ficha (janela destacada, jogador) | `visibleTo` (array-contains) · `isDeleted` · `roll.savingThrowRequest.targetCharacterId` · `seq` |
| Pedidos de resistência para uma ficha (janela destacada, Mestre) | `isDeleted` · `roll.savingThrowRequest.targetCharacterId` · `seq` |
| Custos de aliados pendentes (dono ou editor da ficha) | `characterId` · `status` |
| Custos de aliados pendentes (Mestre) | `status` (campo único; índice automático) |
| Fichas, notas, pastas, cenas e compêndio (jogador) | `visibleTo` (array-contains) · `isDeleted` |

`array-contains-any` usa a configuração `array-contains` do índice. Valide no ensaio da Fase 14.

---

## Apêndice B — Casos adversariais obrigatórios (regras e concorrência)

Escrever com `@firebase/rules-unit-testing` (Firestore + RTDB) e com dois clientes no emulador. **Todos devem passar.**

**B1 — Identidade e associação à campanha**
1. Conta autenticada não membro: negada a leitura da campanha, de `members`, `characters`, `notes`, `media` e de todos os nós do RTDB; negada a criação de ficha, mensagem, mídia, desenho e ping (reprodução do Codex).
2. Conta com e-mail não verificado e convite válido: não cria `members/{uid}` **nem** `meta/members/{uid}`.
3. Conta verificada sem convite: não cria `members/{uid}` nem `meta/members/{uid}`.
4. Membro tenta criar uma campanha sem ser administrador da plataforma: negado.
5. Membro grava `members/{outroUid}` ou altera `campaign.gmId`: negado.
6. Convite: o convidado altera outro campo do convite, grava `acceptedBy` com outro uid, aceita um convite de outro e-mail ou um já aceito: negado. Lote legítimo do `joinWithInvite` (e-mail verificado, convite pendente): permitido.
7. Convite removido antes do aceite: o convidado não cria `members/{uid}` nem `meta/members/{uid}`.
8. Bootstrap: o administrador cria a campanha completa (campanha, membro, `state/chat` com `lastSeq` 0, `meta/gmId`, `meta/members`) e envia a primeira mensagem com `seq` 1. Quem não é administrador não reivindica `meta/gmId` de uma campanha nova. Ninguém cria `state/chat` com `lastSeq` diferente de 0.

**B2 — Autoridade do Mestre**
1. Depois de `assignGM(B)`, o Mestre antigo A não tem poderes de Mestre em nenhuma regra (não existe exceção por e-mail).
2. Recarregar a sessão de A não reverte o `gmId`.
3. Protocolo de transferência interrompido depois do passo 2: B conclui o espelho `meta/gmId` ao iniciar; um terceiro não consegue gravar `meta/gmId`.
4. Membro removido: perde o acesso no Firestore e no RTDB **na hora**, assim que o `revokeMember` termina. Com o convite apagado, não consegue recriar `members/{uid}` nem `meta/members/{uid}`, nem pelo fluxo de entrada. Teste à parte: com falha simulada no passo do RTDB, o `reconcileMirrors` do Mestre remove os espelhos órfãos ao iniciar a sessão.
5. Depois de `assignGM(B)`: B lê e edita uma nota `scope: "gm"` criada por A (permitido); A lê ou edita essa nota (negado).

**B3 — Propriedade e audiência**
1. Sequência do Codex em nota e em pasta (editor remove o `ownerId` → grava o próprio UID → soft delete): **todos os passos negados**.
2. Editor altera `visibleTo`, `editableBy` ou `scope` de recurso alheio: negado. O dono altera os próprios: permitido, com invariantes.
3. Escopo `party` sem `"ALL"` em `visibleTo`: negado.
4. Dono fora de `visibleTo`: negado.
5. Quem não é Mestre altera `type`, `ownerId` ou o acesso de uma ficha: negado.

**B4 — Mídia**
1. `dataUrl` acima do limite com `byteLength` declarado pequeno: negado.
2. `uploadedBy` diferente do uid: negado.
3. Alterar `dataUrl` (ou qualquer campo além de `visibleTo`) de uma mídia existente: negado. Reduzir `visibleTo`: negado. Ampliar `visibleTo` sem ser o Mestre, quem enviou nem membro da audiência atual: negado. Membro da audiência atual (ex.: o dono de uma ficha cujo retrato foi enviado pelo Mestre) amplia para `ALL` antes de uma mensagem pública: permitido.
4. Jogador lê pelo id uma mídia fora da sua audiência: negado. Lista a coleção: negado.
5. Qualquer escrita em `chunks`: negada.

**B5 — Tabuleiro (RTDB)**
1. Controlador altera `controlledBy` (inclusive para `ALL`), `kind`, `characterId`, `ownerId`, `layer` ou `hidden`: negado. Controlador move e gira: permitido.
2. Reprodução do Codex: controlador concede controle a um terceiro, que passa a mover o token: **negado** no primeiro passo.
3. Jogador lê `hiddenTokens/{cena}` ou `tokenSecrets` de token que não controla: negado.
4. Autor altera a `layer` de um desenho seu (não sendo Mestre): negado. Edita desenho alheio: negado.
5. Ping expirado (`now > createdAt + PING_LIFETIME_MS`): qualquer membro remove. Ping não expirado de outro: negado. Ping com `createdAt` diferente do tempo do servidor: negado. O valor da constante na regra é igual ao de `domain/constants`.
6. Escritas com tipos inválidos (`x` como string, campos obrigatórios ausentes): negadas por `.validate`.
7. Jogador grava em `fog/`: negado.
8. `tokenSecrets`:
   - controlador que não é Mestre faz transação em `hp.current`, `mp.current` ou `recentOps`: permitido;
   - controlador altera `defense`, `hp.max`, `mp.max` ou `showBarsToPlayers`: negado;
   - dono cria um token livre com os segredos numa única atualização: permitido; exclui token e segredos juntos: permitido;
   - terceiro cria ou apaga segredos: negado.
9. Projeção de PC: membro que não é Mestre, nem dono, nem controlador grava `label`, `image`, `bars`, `ringColor` ou `rev`: negado. Controlador grava a projeção com `rev` menor ou igual ao atual: negado.

**B6 — Mensagens e combate**
1. Jogador cria mensagem com `appliedEffects` preenchido: negado. Jogador altera `hitEvaluation` depois da criação: negado (só o Mestre, `pending → done`).
2. Resposta de resistência por quem não é responsável pela ficha-alvo: negada. Resposta duplicada (mesmo `saveId`): a segunda é negada (reprodução do Codex com submissões intercaladas).
3. Remetente muda o `status` de `committed` para `pending`, ou altera campos que não são `status`: negado.
4. Jogador faz soft delete de mensagem: negado (D-3).
5. Contador e `seq`:
   - mensagem criada sem incrementar `state/chat` na mesma escrita atômica, com `seq` diferente de `lastSeq + 1` ou com `lastMessageId` diferente do id dela: negada;
   - duas mensagens com o mesmo `seq` num único lote ou transação com um só incremento: negado;
   - atualizar `state/chat` com salto maior que 1 ou para trás: negado;
   - alterar o `seq` de uma mensagem existente: negado.
6. `pendingCosts`: marcar como `applied` sem poder editar a ficha `characterId` (e sem ser Mestre): negado. Voltar de `applied` para `pending`: negado.
7. Consultas de jogador: a recuperação das próprias sagas e os pedidos de resistência da janela destacada, **com** o filtro de `visibleTo`: aceitas. As mesmas consultas sem o filtro: negadas.

**B7 — Concorrência e idempotência (dois clientes)**
1. MP 10, descontos 2 e 3 simultâneos → 5 (reprodução do Codex). Mesmo teste para HP de NPC em `tokenSecrets`.
2. Repetir o mesmo `opId` (custo, efeito, consumível): o estado não muda.
3. Adição simultânea de entradas diferentes na ficha: as duas persistem.
4. Saga com falha injetada depois do desconto → a recuperação conclui sem cobrar de novo.
5. Duas escritas de projeção fora de ordem → o token converge para o `rev` maior.
6. Mover a pasta A para a sua filha B, pelo serviço → negado; nenhum estado parcial (reprodução do Codex).
7. Excluir a pasta "X" do dono 1, com uma pasta "X" do dono 2 no mesmo caminho → nada do dono 2 é alterado (reprodução do Codex).
8. Vários clientes enviando mensagens ao mesmo tempo → todos os `seq` são únicos e nenhuma mensagem se perde.
9. Custo de aliado com o dono do aliado e o Mestre aplicando ao mesmo tempo → descontado uma única vez.

chave adm node em "C:\Users\erick\.secrets\clubpenguintabletop-firebase-adminsdk-fbsvc-fb8f189e39.json"