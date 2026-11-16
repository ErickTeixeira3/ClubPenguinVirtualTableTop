# Handoff — Finalizar a Fase 6 (6.3 a 6.8)

Destinatário: agente Codex que vai continuar a refatoração. Escrito em 2026-11-13, ao fim da Fase 6.2.

## 0. Leia antes de tudo
1. `REGISTRO_REFATORACAO.md`, a partir de **"AUDITORIA DE REGRESSÕES E FASE 6"** (final do arquivo). Ali estão a lista A1–A33 (perdas não planejadas), B1–B17 (planejadas) e o que já foi feito em 6.0, 6.1 e 6.2.
2. `auditoria_refatoracao/validar-regressoes.mjs` e `resultados.json`: suas próprias 17 reproduções de regressão.
3. `DIRETRIZES_ARQUITETURA.md`.

## 1. Regras obrigatórias (decisões do usuário)
- **Proibido** `git commit`, `git push` e `firebase deploy` (inclusive de regras) até o fim de toda a refatoração (decisão D-1). O deploy só acontece na 6.7, **com autorização explícita do usuário**.
- **Proibido** gravar no Firebase de produção (`clubpenguintabletop`) sem autorização. Leituras e diagnósticos podem ser feitos. Testes de escrita vão no emulador.
- **Registre tudo** o que fizer, com fidelidade, no `REGISTRO_REFATORACAO.md`, em uma seção nova por subfase (siga o formato das seções 5 e 6 da auditoria: causa, tabela de alterações, o que não foi feito e por quê, validação com números, riscos). Atualize a linha do índice (topo do arquivo), que hoje diz "6.0, 6.1 e 6.2 concluídas".
- O usuário fala português; responda e registre em português.
- Não exponha e-mails nem dados pessoais em saídas, logs ou scripts. Mascare se precisar mostrar.
- Ao validar, só aponte defeitos no trabalho já feito, depois de cruzar com a auditoria, as diretrizes e as fases planejadas.
- **O usuário mantém `npm run dev` (Vite, porta 5173) rodando enquanto você edita.** Grave imports e definições **antes** dos usos (ou o arquivo inteiro de uma vez). Uma versão intermediária sem import já derrubou a página (ver seção 5.6 do registro).
- B1 decidido: as fichas do Mestre são de teste. O critério de matriz (Princípio 6) **não muda** e não há reparo de dados para elas.

## 2. Estado atual (o que já está pronto)
- **6.0**: as regras publicadas (Firestore e RTDB) são as do commit `711451e`. Os dados de produção estão íntegros. O **Modo de Turno está ativo** na campanha `main-table`: o Mestre deve encerrá-lo (botão ■) antes de testes no navegador.
- **6.1**: `src/services/rtdbPaths.js` com `RTDB_LAYOUT = "legacy"`. Desenhos e pings ficam em `fog/{cena}/drawings|pings`; `meta/gmId` não é gravado; pastas de ficha gravam `scope: "player"`.
- **6.2**: `src/services/visibilityService.js`. O listener do jogador usa consultas `or` (dono sempre vê o que é seu; cenas e compêndio também pela flag `visibleToPlayers`). Há regra de audiência mínima (Mestre e dono) nas gravações, reparos na migração, lista de fichas do jogador como no `711451e` e "+ No Mapa" só para quem pode editar.
- Linha de base estática: `npx oxlint src` com **0 erros e 10 avisos**; lint estrito com **0 erros**; `npx vite build` ok. Mantenha esses números.

## 3. Ferramentas de validação já usadas (reaproveite)
- **Lint estrito**: crie um `.oxlintrc` temporário **fora do repositório** com o conteúdo abaixo e rode `npx oxlint -c <arquivo> src`:
  `{"plugins":["react","oxc"],"env":{"browser":true,"es2024":true},"globals":{"import":"readonly"},"rules":{"no-undef":"error","react/jsx-no-undef":"error","no-unused-vars":"error"}}`
- **Emulador** (`firebase emulators:exec --only firestore,database --project demo-<algo> "node script"`), num diretório fora do repo, com `firebase.json` próprio e cópia das regras a testar.
  - Usuário simulado no **Firestore** pelo SDK: `connectFirestoreEmulator(db, host, port, { mockUserToken: { user_id: "player1" } })`. Para semear dados como admin pela REST, use `Authorization: Bearer owner`.
  - No **RTDB**, o token do usuário vai em `?auth=<jwt sem assinatura>`, **não** no cabeçalho `Authorization: Bearer` (o emulador trata o Bearer como admin e ignora as regras). Inclua sempre um teste de sanidade: escrita sem auth deve ser negada.
  - Para carregar as regras no RTDB do emulador: `PUT /.settings/rules.json?ns=<projeto>-default-rtdb` com `Bearer owner`. No Git Bash, use `MSYS_NO_PATHCONV=1`.
  - Portas podem ficar presas entre execuções (processo `java.exe`). Troque as portas no `firebase.json` ou encerre o processo.
  - Listeners: o primeiro snapshot pode vir do cache local. Espere `snapshot.metadata.fromCache === false`.
- **Harness com módulos reais**: Vite `createServer({ root: projeto, configFile: false, server: { middlewareMode: true } })` + `ssrLoadModule`, com um plugin `resolveId` que troca `services/firebase` por um stub ligado ao emulador. Gere o harness numa pasta **temporária dentro do projeto** (ex.: `.tmp-harness-6x/`, para as dependências resolverem) e apague-a no final. Componentes podem ser verificados com `renderToStaticMarkup`.
- **Smoke test no navegador**: `msedge --headless=new --enable-logging=stderr --v=0 --virtual-time-budget=15000 --dump-dom http://localhost:5173/` e procure `Uncaught` no log.
- Antes de editar cada subfase, faça **backup** dos arquivos tocados fora do repo.

## 4. Fase 6.3 — Alvos e atalhos de rolagem (A12–A19)
Antes, diagnostique **só com leitura** em produção: perícias, itens e ícones de atributo dos atalhos já migrados (A17 não foi verificado na 6.0).

| Item | Problema | Solução esperada | Onde olhar |
| :--- | :--- | :--- | :--- |
| A12 | A janela destacada recebe só o primeiro de vários alvos | Uma única atualização de alvos por ação: o mapa chama só `onTargetedTokensChange(lista)`, sem a segunda chamada com o primeiro alvo, e `setTargetedToken` não reenvia lista menor | `src/components/canvas/BoardViewport.jsx` (efeitos perto das linhas 335 e 360, `effectiveTargetList`, `toggleTargetToken`), `src/hooks/useCrossWindowSync.js`, `VTTLayout.jsx` |
| A13 | Sem `BroadcastChannel`, não há sincronização entre janelas | Alternativa por evento `storage` do `localStorage` quando `BroadcastChannel` não existir (sem `localStorage` dentro de `engines/`) | `src/hooks/useCrossWindowSync.js` |
| A14 | `/r` da barra inferior perdeu o alvo | Passar os alvos atuais (`targetSelectionRef`/lista de alvos) ao `executeRoll` da dock | `VTTLayout.jsx`, `QuickActionsHotbar.jsx`, `src/services/rollService.js` |
| A15 | Ataque personalizado só de acerto ("Disparo", "Espada") virou teste e perdeu Acertou/Errou | Rolagem personalizada com fórmula de acerto e alvo é ataque. Ideal: seletor explícito de tipo no formulário (`rollKind`), em vez de heurística por nome. Não reverter V-03/V-11 (perícias e atributos continuam sem comparar Defesa) | `rollService.js`, `src/components/sheets/tabs/SheetRollsTab.jsx` |
| A16 | Atalho vinculado por nome passou a usar a fórmula da origem | Na migração, só vincular quando a fórmula salva for igual à da origem; senão, manter `sourceType: "custom"`. Reparar atalhos já vinculados com fórmula divergente (precisa da fórmula antiga: verifique se o atalho ainda guarda `hitFormula`/`effectFormula` próprios) | `src/services/migrationService.js` (`linkLegacyRollEntry`, `migrateLegacyShortcuts`) e a resolução dinâmica de atalhos |
| A17 | Atalho de atributo perdeu o ícone | Marcar `customIcon: true` quando o ícone salvo não for o padrão ("sword"/"clover"). Hoje `sourceIcon` de atributo é `null`, então `customIcon` sai sempre `false` | `migrationService.js` linha ~48-57 |
| A18 | "Perícia Luta" vira "Luta" | Ao resolver o atalho, manter o nome salvo se diferente do nome da origem | resolução de atalhos (procure `sourceType` em `src/components/sheets/state/` e `rollService.js`) |
| A19 | Hotbar na ficha não mostra "Remover" | Comparar pelo `rollId` do slot **salvo**, não do resolvido | `SheetRollsTab.jsx` / componentes da Hotbar |

Validação mínima: 3 alvos numa área com rolagem na janela destacada; "Disparo" com alvo mostra Acertou/Errou; atalho com fórmula própria mantém a fórmula após a migração (teste no emulador com o `migrationService` real).

## 5. Fase 6.4 — Combate (A20–A23)
| Item | Problema | Solução esperada | Onde olhar |
| :--- | :--- | :--- | :--- |
| A20 | Pedido de teste de resistência abre em duas janelas e pode cobrar duas vezes | Fechar o modal quando chegar a mensagem que responde àquele pedido, e só exibi-lo na janela onde foi aberto primeiro (ou registrar resposta por id do pedido e ignorar a segunda) | `src/components/combat/CombatModals.jsx`, `SavingThrowModal.jsx`, `StandaloneSheetView.jsx`, `useChatRolls.js` |
| A21 | Card do chat mostra custo pago quando nada foi descontado | Gravar `costPaid` só depois que o desconto realmente acontecer | `src/services/combatService.js`, `rollService.js` |
| A22 | Jogador ataca NPC oculto com a Defesa do token, não a da ficha | **Peça decisão ao usuário**: (a) Defesa do token é a válida (documentar), ou (b) ao editar a Defesa da ficha-matriz, oferecer propagar aos tokens | `combatEngine.js` (~linha 190-200), `combatService.js` |
| A23 | No Modo de Turno, consumível é gasto mesmo com ação bloqueada | Descontar a quantidade só depois que a rolagem for aceita (checar o bloqueio de turno antes de consumir) | `VTTLayout.jsx` (`handleExecuteSheetRoll`), `combatService.js`, `src/engines/combatEngine.js` |

Validação: pedido de resistência com a ficha destacada aberta (uma cobrança só); NPC sem token selecionado mostra custo coerente; item fora do turno não é consumido.

## 6. Fase 6.5 — Avatares e perfil (A24–A27)
- **A24**: gravar `senderPhotoURL` quando a imagem da ficha for URL http(s), mesmo havendo `character.id` (`rollService.js` `resolveSpeakerIdentity`, `MessageAvatar.jsx`).
- **A25**: ao falar "como jogador", usar `senderAvatarMediaId` do jogador e não o `characterMediaId` do personagem ativo.
- **A26**: "Remover foto" também limpa o `photoURL` do Firebase Auth (`updateProfile`), e `user.photoURL` deixa de ser usado como alternativa depois de uma remoção explícita (`PlayerProfileModal.jsx`, `AuthContext.jsx`, `CampaignContext.jsx`). A 6.0 mostrou que afeta 2 jogadores com foto do Google.
- **A27**: limpar `cp_pending_avatar_dataurl` no logout e quando o e-mail não estiver autorizado (`AuthContext.jsx`, `LoginScreen.jsx`).
- Validação: contas Google e e-mail/senha; remover, trocar e falar no chat como jogador e como personagem.

## 7. Fase 6.6 — Debounce e diário (A28–A31)
- **A28**: depois de gravar, devolver o rascunho ao valor normalizado (`setDraft(value)`) (`src/hooks/useDebouncedCallback.js` e campos da ficha).
- **A29**: gravar o pendente em `pagehide`/`beforeunload` (flush do debounce).
- **A30** (suspeita): primeiro reproduza (Mestre aplica dano enquanto o jogador digita no HP). Se reproduzir, HP e MP gravam sem debounce, ou a mudança externa vence durante a digitação.
- **A31**: salvar card sem permissão não pode fechar o editor como sucesso. `updateJournalNote` (`journalService.js`) retorna sem erro quando `canUserEditJournalNote` é falso. Faça-o sinalizar falha e `NoteEditorModal.jsx` manter o editor aberto com aviso, ou abrir em modo leitura.

## 8. Fase 6.7 — Regras do deploy final (A32, A33, A4 rename) — exige autorização do usuário para o deploy
1. Ajustar `database.rules.json` local:
   - **A32**: permitir a primeira gravação de `meta/gmId` quando ainda não existe e o `gmId` do Firestore coincide (ou fazer o Mestre por e-mail gravá-la no `assignGM`).
   - **A33**: `controlledBy` de lista para mapa `{uid: true}` com `hasChild(auth.uid)`. Exige migrar o código que lê e grava `controlledBy` e os tokens existentes.
   - Atenção: nas regras locais, **`fog/` só aceita escrita do Mestre**. O layout `legacy` (jogadores desenham em `fog/`) **não funciona** com as regras novas. A troca de `RTDB_LAYOUT` para `"split"` e o deploy precisam acontecer juntos.
2. `firestore.rules` local: decidir com o usuário se quem está em `editableBy` volta a poder renomear pasta de ficha (A4 rename).
3. Testar no emulador cenários autenticados (Mestre, dono, editor, jogador), inclusive D-3 e as consultas `or` da 6.2 (já passaram 29/29 com as regras locais atuais; refaça após mudanças).
4. Roteiro do deploy, **só com autorização**. A CLI tem 3 contas e só uma tem acesso ao projeto: use `--account`.
   1. Publicar as regras.
   2. Mudar `RTDB_LAYOUT` para `"split"` em `rtdbPaths.js` (isso reativa a migração `fog/…/drawings → drawings/…` e o espelho `meta/gmId`).
   3. O Mestre abre cada cena.
   4. Conferir os 25 desenhos em 3 cenas.
   5. Só então remover o modo `legacy`.

## 9. Fase 6.8 — Validação final e registro
- Transformar `auditoria_refatoracao/validar-regressoes.mjs` em testes de regressão e somar os harnesses.
- Roteiro manual com Mestre e jogador simultâneos, janela principal e destacada, cobrindo A1–A33.
- No registro, uma tabela com o status de cada item A1–A33 (Corrigido, Adiado ou Descartado, com motivo). Depois disso, **pedir ao usuário** autorização para commit e deploy (D-1).

## 10. Pendências conhecidas a confirmar no navegador
- A consulta `or` da 6.2 ainda não rodou no Firestore real. Se for recusada, há fallback automático com aviso no console: verifique o console do jogador.
- Nada da 6.1 e da 6.2 foi testado no navegador. Antes, encerre o Modo de Turno.
