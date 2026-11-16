# Diretrizes de Arquitetura, Engenharia de Dados e Design System — ClubPenguinVTT

Este documento é a **fonte única da verdade (Single Source of Truth)** para a arquitetura de software, modelagem de banco de dados, segurança, pipeline de mídia, regras de negócio e padrões visuais do **ClubPenguinVTT**. Toda refatoração e nova funcionalidade implementada no projeto deve seguir rigorosamente os padrões definidos aqui.

---

## 1. Princípios Gerais e Regras Inegociáveis

1. **Plano Firebase Spark (Custo Zero / Serverless Client-Driven)**:
   - Toda a lógica de processamento de regras de RPG, resolução de fórmulas, automação de combate, compressão de imagens e remoção de fundo de tokens roda **no cliente (navegador)**, protegida por **Security Rules** rigorosas no Firebase (sem dependência de Cloud Functions ou Firebase Storage pagos do plano Blaze).
2. **Arquitetura Híbrida de Banco de Dados**:
   - **Cloud Firestore**: Armazena dados persistentes, documentos estruturados e entidades filtráveis por permissão (Campanhas, Cenas/Mapas, Fichas de Personagem, Pastas, Compêndio, Diários/Notas, Histórico de Chat/Rolagens e Repositório de Mídia em documento único por arquivo).
   - **Firebase Realtime Database (RTDB)**: Armazena estados efêmeros de **alta frequência e baixa latência** em nós irmãos e desacoplados (`tokens`, `fog`, `drawings`, `pings` e `presence`), evitando re-renderizações cruzadas e poupando a franquia diária de escritas do Firestore.
3. **Preparação Nativa para Múltiplas Campanhas (`campaignId` Universal)**:
   - Mesmo operando com a campanha padrão (`DEFAULT_CAMPAIGN_ID = "main-table"`), **todos os documentos do Firestore e nós do RTDB devem conter explicitamente o campo `"campaignId"` dentro do próprio payload JSON** (além de estarem sob o caminho da campanha).
   - Parâmetros de URL de janelas destacadas (`?campaignId=...&sheetId=...`), canais de sincronização entre abas (`BroadcastChannel`) e chaves do cache local `IndexedDB` (`${campaignId}:${mediaId}`) devem sempre incluir `campaignId`.
4. **Política de "Falsa Exclusão" (Soft Delete no Firestore vs. Hard Delete no RTDB)**:
   - **No Firestore (`characters`, `folders`, `notes`, `scenes`, `compendium`, `messages`)**: Exclusões acionadas na interface **nunca apagam fisicamente o documento (`deleteDoc`)**. Toda exclusão em tela aplica **Soft Delete** (`isDeleted: true`, `deletedAt: serverTimestamp()`, `deletedBy: uid`), ocultando o item na interface e preservando tanto o documento quanto suas mídias em `media/{mediaId}` para auditoria ou restauração direta no banco.
   - **Exclusão de Pastas (Fichas e Diário)**: Ao excluir uma pasta que possua subpastas, fichas ou cards de diário, o sistema deve exibir confirmação perguntando se o usuário deseja **(a) ocultar também todos os cards/fichas internos** ou **(b) mover os itens internos para a pasta pai** antes de ocultar a pasta *(decisão D-2, 2026-11-13: os itens vão para a pasta pai, não para a raiz)*.
     - Hoje as subpastas da pasta excluída são ocultadas e o conteúdo delas vai para a pasta pai. **Escopo futuro (D-2)**: as subpastas devem ir inteiras para a pasta pai, preservando a hierarquia.
   - **Quem pode excluir (decisão D-3, 2026-11-13)**: cada jogador só pode excluir (Soft Delete) o que é **seu** (`ownerId === auth.uid`). `editableBy` e o escopo `party` concedem apenas edição, nunca exclusão. O Mestre pode excluir tudo e é o **único** que apaga mensagens do chat. A regra vale na UI, nos hooks/serviços e nas Security Rules (alterar `isDeleted`/`deletedAt`/`deletedBy` só pelo dono ou pelo Mestre; *hard delete* só pelo Mestre).
   - **No Realtime Database (`tokens` e `drawings`)**: Elementos táticos efêmeros do tabuleiro são excluídos permanentemente (`remove()`) ao serem removidos do mapa.
5. **Isolamento Estrito de Autoria e Controle de Acesso**:
   - Cada jogador autenticado pode criar, mover, editar ou excluir **apenas seus próprios desenhos no mapa (`authorId === auth.uid`), seus próprios tokens e suas próprias fichas (`ownerId === auth.uid` ou incluído em `editableBy`)**.
   - O Mestre (`gmId` / `GM_EMAIL`) possui permissão global de leitura, edição e moderação sobre todas as entidades da campanha.
6. **Regra de Sincronização Ficha ↔ Token (Diferenciação Mestre vs. Players)**:
   - **Fichas de Players (`ownerId !== gmId`)**: A ficha e o token do jogador no mapa representam **a mesma entidade**. Alterações de Vida (`hp`), Energia (`mp`), Defesa (`defense`), Nome (`name`), Cor (`cardColor`) e Avatar feitas na ficha atualizam automaticamente o token na cena ativa, e ajustes rápidos feitos no token atualizam a ficha no Firestore.
   - **Fichas do Mestre (`ownerId === gmId` ou `type === "npc"`)**: A ficha funciona como **matriz/template**. Cada token instanciado no mapa a partir de uma ficha do Mestre possui vida (`hpCurrent`/`hpMax`), Defesa (`defense`) e recursos **100% individuais e autoritativos no tabuleiro**, permitindo múltiplos inimigos idênticos em cena sem que o dano sofrido ou ajustes em um token alterem a ficha-matriz ou os demais tokens *(decisão A22, 2026-11-16: a Defesa do token é a fonte autoritativa em cena tanto para jogadores quanto para o Mestre)*.
7. **Estilos Inline Atuais como Fonte da Verdade Visual (CSS)**:
   - O visual aprovado e mais atualizado do sistema encontra-se implementado nos estilos inline (`style={{ ... }}`) dos componentes atuais. Na extração de classes CSS e componentes base (`src/components/ui/`), **os valores visuais dos estilos inline têm prioridade absoluta sobre definições antigas de `index.css` e `App.css`**, garantindo fidelidade visual idêntica.
8. **Diretriz de UI/UX Limpa**:
   - **Proibido incluir textos explicativos em subtítulos, antes de botões ou locais similares.** Toda regra de negócio deve ser tratada exclusivamente dentro do código, sem precisar ser explicada ou declarada explicitamente na tela.
9. **Controle de Git e Deploy**:
   - Nenhum `git commit` ou `firebase deploy` deve ser executado sem autorização explícita do usuário.

---

## 2. Arquitetura de Pastas e Camadas de Software (`src/`)

A aplicação segue uma arquitetura em camadas com separação estrita de responsabilidades (**Views/UI → Hooks/Contexts → Services de Domínio → Engines Puros / Infra Firebase**):

```text
src/
├── assets/                          # Fontes locais e recursos estáticos de build
├── constants/
│   ├── authorizedUsers.js           # Whitelist inicial de e-mails, papel do Mestre (GM_EMAIL) e helpers de autorização
│   └── zLayers.js                   # Referências JS (Z_LAYERS) para a escala oficial de camadas --z-* (Seção 7.2)
├── contexts/
│   ├── AuthContext.jsx              # Autenticação Firebase (Google + Email/Senha), perfil e verificação de whitelist
│   ├── CampaignContext.jsx          # Estado da campanha ativa (campaignId), cena ativa, jogadores e presença RTDB
│   └── BoardTokensContext.jsx       # (Fase 5: BoardTokensContext.js + BoardTokensProvider.jsx) tokens da cena ativa; substitui o boardSyncRef
├── engines/                         # Motores PUROS (sem dependências de React, Firebase ou localStorage)
│   ├── aliasEngine.js               # Normalização de texto, parser anti-spoiler de aliases e construtor do Grafo (Teia)
│   ├── combatEngine.js              # Constantes táticas, avaliação de acerto/CD, geometria de alcance/AoE e regras de turno
│   ├── diceEngine.js                # RNG criptográfico (window.crypto) e parser de dados (NdX, kh, kl)
│   ├── formulaEngine.js             # Resolução de variáveis da ficha (@forca, @pericia) e avaliador aritmético seguro
│   └── imageCompressor.js           # Compressão e redimensionamento adaptativo client-side para WebP via Canvas
├── services/                        # Orquestração de regras de negócio e persistência (Firestore + RTDB + IndexedDB)
│   ├── firebase.js                  # Inicialização do Firebase Auth, Firestore e Realtime Database
│   ├── mediaService.js              # Persistência em media/{mediaId} (documento único, < 800 KB) e cache IndexedDB por campanha
│   ├── combatService.js             # Dedução de custos/itens consumíveis, sincronização Ficha↔Token (PC vs NPC) e aplicação de dano/cura
│   ├── rollService.js               # Orquestração de rolagens (ataque, dano diferido, teste de resistência, ping) e resolução de remetente
│   ├── journalService.js            # Clonagem, compartilhamento granular, árvore de pastas e exclusão lógica (Soft Delete)
│   └── migrationService.js          # Saneamento idempotente de dados legados (campaignId, isDeleted, visibleTo, pastas)
├── hooks/                           # Adaptadores reativos entre Services/Firebase e Componentes React
│   ├── useBoardInteractive.js       # Sincronização de desenhos vetoriais (drawings) e pings em nós dedicados do RTDB
│   ├── useBoardCamera.js            # (planejado, não criado) Controle de Pan, Zoom e conversão de coordenadas tela <-> mundo
│   ├── useSnowballProjectiles.js    # (planejado, não criado) Animação de projéteis de bola de neve entre atacante e alvos
│   ├── useCharacters.js             # Assinatura de fichas filtradas por visibilidade/Soft Delete e CRUD (o debounce fica nos campos: ui/DebouncedField)
│   ├── useFolders.js                # Listener unificado da subcoleção folders por domínio ("character" | "journal") — Fase 5
│   ├── useChatRolls.js              # Histórico de mensagens/rolagens do chat e disparo de ações
│   ├── useCompendium.js             # Catálogo global de habilidades, perícias e itens do Mestre
│   ├── useFogOfWar.js               # Sincronização exclusiva da máscara de Névoa de Guerra no RTDB
│   ├── useJournalNotes.js           # Leitura/escrita reativa de cards do Diário com filtro anti-spoiler
│   ├── useMediaUrl.js               # Hook reativo para resolução de mediaId (IndexedDB -> Firestore) ou URL externa
│   ├── useRealtimeTokens.js         # Sincronização de tokens da cena ativa via RTDB
│   ├── useScenes.js                 # Gerenciamento de cenas, mapas em imagem/vídeo e áudio ambiente
│   ├── useDebouncedCallback.js      # Controle de debounce e flush em onBlur para evitar escritas por tecla no Firestore
│   └── useCrossWindowSync.js        # Comunicação entre janela principal e janela destacada (?campaignId=&sheetId=) via BroadcastChannel
├── utils/
│   └── stringUtils.js               # Normalização NFD sem acentos, sanitização de chaves do Firestore e helpers de formatação
└── components/
    ├── auth/
    │   └── LoginScreen.jsx          # Telas de Login (com Post-it), Criar Pinguim (2 colunas + foto WebP) e Recuperar Senha
    ├── layout/
    │   ├── VTTLayout.jsx            # Shell visual principal (Barra Superior, Dock Inferior, Sidebars e Modais Globais)
    │   ├── StandaloneSheetView.jsx  # Janela destacada (?campaignId=&sheetId=): Ficha + modais de combate — Fase 5 (assinaturas ainda via VTTLayout)
    │   ├── QuickActionsHotbar.jsx   # Hotbar de 9 slots de Bola de Neve (teclas 1-9) com resolução dinâmica de atalhos
    │   ├── EmotePickerMenu.jsx      # Seletor rápido de emotes oficiais do Club Penguin no dock inferior
    │   └── PlayerProfileModal.jsx   # Edição de nome de exibição e foto de perfil do jogador (salva em media/{mediaId})
    ├── canvas/
    │   ├── BoardViewport.jsx        # Container do tabuleiro interativo integrando camadas de mídia, grid, tokens, desenhos e medição
    │   ├── BoardDrawingsLayer.jsx   # (planejado, não criado) Renderização SVG de rabiscos, formas, textos e seleção/rotação
    │   ├── BoardMeasurementLayer.jsx# Régua tática: linha, cone (45°/60°) e círculo em metros — Fase 5
    │   ├── BoardAoeTemplateLayer.jsx# Template visual de demarcação de AoE (alcance, círculo e cone) — Fase 5
    │   ├── BoardPingsLayer.jsx      # Pings e bolas de neve em voo — Fase 5
    │   ├── boardConstants.js        # Cores de desenho, metadados de camadas e geometria pura de traços — Fase 5
    │   ├── BoardLeftToolbar.jsx     # Barra de ferramentas táticas do mapa (Seleção, Pan, Fog, Lápis/Formas, Texto, Ping, Medição)
    │   ├── FogOfWarCanvas.jsx       # Máscara HTML5 Canvas da Névoa de Guerra (visão semi-transparente p/ GM, opaca p/ Players)
    │   ├── TokenSprite.jsx          # Renderizador do token com remoção automática de fundo por Flood-Fill, anel de cor e barras HP/MP
    │   ├── TokenQuickHpPopup.jsx    # (planejado, não criado) Popup rápido sobre o token para ajuste de vida
    │   ├── TokenSpeechBubble.jsx    # Balão flutuante de fala e emote sobre o token no mapa
    │   └── TokenModal.jsx           # Configuração detalhada do token no tabuleiro
    ├── combat/
    │   ├── DamageRollModal.jsx      # Modal de rolagem de dano/efeito com gatilhos da ficha, itens e assistências de aliados
    │   ├── CombatModals.jsx         # Dano + Resistência renderizados na mesa e na janela destacada — Fase 5
    │   └── SavingThrowModal.jsx     # Modal de teste de resistência (CD) com bônus de atributo, reação e consumíveis
    ├── chat/
    │   ├── ChatSidebarPanel.jsx     # Painel lateral de chat, seletor de identidade ("Falar como") e rolador rápido de dados
    │   ├── MessageAvatar.jsx        # Avatar do remetente (personagem ou jogador) — Fase 5
    │   ├── RollMessageCard.jsx      # Card de rolagem de ataque/dano/resistência e calculadora de aplicação de efeito do Mestre
    │   ├── SkillPingCard.jsx        # Card de exibição de habilidade/perícia pingada no chat
    │   └── EmoteMessageCard.jsx     # Card de emote ou fala estilizada no chat
    ├── sheets/
    │   ├── CharacterSheetModal.jsx  # Container do Player Card Clássico (Lado Esquerdo) + Gaveta de Abas (Lado Direito)
    │   ├── PlayerCardLeftPanel.jsx  # Cartão azul/colorido do pinguim (nível, nome, moldura de foto, moedas, XP e paleta de cores)
    │   ├── CharactersSidebarList.jsx# Árvore lateral de fichas e pastas (Seção do Mestre + Seções recolhíveis por Jogador)
    │   ├── CpFlashIcons.jsx         # Catálogo declarativo de ícones WebP oficiais do Club Penguin
    │   ├── CpIconPicker.jsx         # Seletor de ícones (arquivo próprio: não mistura componente com dados) — Fase 5
    │   ├── CpSheetBadges.jsx        # Moeda, Livro de Selos e insígnia de Nível do Player Card — Fase 5
    │   ├── sheetConstants.js        # Cores do cartão, abas da ficha e resolveItemIcon — Fase 5
    │   ├── state/                   # Hooks de estado dos formulários da ficha (mesma ordem de useState) — Fase 5
    │   └── tabs/
    │       ├── SheetInventoryTab.jsx# Grade 3x4 estilo Club Penguin, controles de scroll e inspetor de item
    │       ├── SheetInventoryItemForm.jsx# Cadastro de item do Inventário — Fase 5
    │       ├── SheetInventoryToolbar.jsx# Ações contextuais do Inventário — Fase 5
    │       ├── SheetSkillsToolbar.jsx   # Ações contextuais da aba Skills — Fase 5
    │       ├── SheetAttributesTab.jsx# Barras de HP/MP, Defesa, Nível, configuração de Token e grade de Atributos
    │       ├── SheetSkillsTab.jsx   # Cards expansíveis de Habilidades/Magias (com Alcance/AoE/CD) e lista de Perícias
    │       ├── SheetNotesTab.jsx    # Campos de História/Origem e Anotações da Ficha com salvamento debounced
    │       └── SheetRollsTab.jsx    # Grupos de rolagens customizadas, vínculo com a ficha e configuração dos 9 slots da Hotbar
    ├── journal/
    │   ├── JournalWorkspace.jsx     # Menu lateral Explorer (Categorias -> Pastas/Subpastas -> Cards) + área da Visão de Teia
    │   ├── JournalGraphWebView.jsx  # Grafo tático interativo (Visor EPF) com filtro por categoria, isolamento de vizinhança e pan/zoom
    │   └── NoteEditorModal.jsx      # Editor de cards em blocos reordenáveis, modo interativo de aliases com portal popover e compartilhamento
    ├── compendium/
    │   └── CompendiumModal.jsx      # Catálogo do Mestre para criação e distribuição de habilidades, perícias e itens
    ├── scenes/
    │   └── ScenesManagerModal.jsx   # Gerenciador de cenas (upload de mapa imagem/vídeo, áudio ambiente, grid e névoa)
    ├── gm/
    │   └── GMPanelModal.jsx         # Central do Mestre (autorização de e-mails, visão geral da mesa, cenas e fichas)
    └── ui/                          # Componentes base reutilizáveis extraídos dos estilos inline aprovados (Fase 4)
        ├── WindowModal.jsx          # Janela modal padrão (variantes "light" e "cp"), portal opcional e camada via Z_LAYERS
        ├── CPButton.jsx             # Botões com variantes (default/primary, gold, green, orange, epf) sobre .cp-btn
        ├── DebouncedField.jsx       # Input/textarea com rascunho local, gravação debounced (400ms) e flush no onBlur — Fase 5
        ├── CpSpeechBubble.jsx       # Balão de fala/emote (apresentação); o tempo de exibição fica com TokenSpeechBubble
        ├── SavingThrowFields.jsx    # Campos de Teste de Resistência (habilita, CD, Atributo, Efeito na falha), layouts "inline" e "grid"
        └── ConfirmDeleteModal.jsx   # Confirmação de exclusão de pasta (mover itens p/ pasta pai — D-2 — vs. ocultar tudo)
```

---

## 3. Modelagem de Dados e Relacionamentos (JSON Schemas)

Todas as entidades persistentes do Firestore incluem obrigatoriamente:
- `"campaignId"`: Identificador da campanha a que pertencem (ex: `"main-table"`).
- `"visibleTo"`: Array normalizado de controle de leitura nas Security Rules e nas queries (`["ALL"]` para documentos públicos ou `["uid_do_mestre", "uid_dono", ...]` para documentos restritos).
- `"isDeleted"`: Booleano (`false` por padrão; `true` quando excluído em tela via Soft Delete), acompanhado de `"deletedAt"` e `"deletedBy"`.

### 3.1. Cloud Firestore (Dados Persistentes e Filtráveis)

#### A. Documento da Campanha: `campaigns/{campaignId}`
Controla permissões globais da mesa, lista de jogadores, cena ativa e o estado do **Modo de Turno (`combatState`)**.
```json
{
  "id": "main-table",
  "campaignId": "main-table",
  "name": "Campanha Principal — Club Penguin RPG",
  "gmId": "uid_do_mestre",
  "gmEmail": "mestre@exemplo.com",
  "authorizedEmails": ["mestre@exemplo.com", "jogador1@exemplo.com"],
  "authorizedUsers": {
    "mestre@exemplo_com": {
      "email": "mestre@exemplo.com",
      "role": "gm",
      "defaultDisplayName": "Sensei",
      "uid": "uid_do_mestre"
    }
  },
  "players": {
    "uid_player_1": {
      "uid": "uid_player_1",
      "displayName": "Pinguim Azul",
      "email": "jogador1@exemplo.com",
      "role": "player",
      "avatarMediaId": "media_avatar_user_1",
      "photoURL": null,
      "activeCharacterId": "char_01",
      "lastSeen": "2026-11-12T15:00:00Z"
    }
  },
  "activeSceneId": "scene_dojo",
  "combatState": {
    "active": false,
    "round": 1,
    "activeTurnIndex": 0,
    "lockMovementOutsideTurn": true,
    "lockActionsOutsideTurn": true,
    "turnOrder": [
      {
        "combatantId": "tok_01",
        "tokenId": "tok_01",
        "characterId": "char_01",
        "ownerId": "uid_player_1",
        "name": "Pinguim Azul",
        "initiative": 18,
        "movementBudgetMeters": 9,
        "movementUsedMeters": 0,
        "actionsMax": 1,
        "actionsRemaining": 1,
        "reactionsMax": 1,
        "reactionsRemaining": 1
      }
    ]
  },
  "updatedAt": "2026-11-12T15:00:00Z"
}
```

#### B. Mapas / Cenas: `campaigns/{campaignId}/scenes/{sceneId}`
Suporta imagens WebP de alta definição ou vídeos em loop (`video/mp4`, `video/webm`), além de trilha sonora/áudio ambiente por cena.
```json
{
  "id": "scene_dojo",
  "campaignId": "main-table",
  "name": "Pátio do Dojo",
  "visibleToPlayers": true,
  "visibleTo": ["ALL"],
  "mapImage": {
    "mediaId": "media_map_dojo_01",
    "externalUrl": null,
    "mimeType": "image/webp",
    "widthPx": 2560,
    "heightPx": 1440
  },
  "ambientAudio": {
    "mediaId": "media_audio_dojo_theme",
    "externalUrl": null,
    "name": "Dojo Ambience.mp3",
    "volume": 0.5,
    "loop": true,
    "isPlaying": false
  },
  "grid": {
    "enabled": true,
    "snapToGrid": true,
    "cellSizePx": 64,
    "color": "#ffffff",
    "opacity": 0.22
  },
  "fogOfWar": {
    "enabled": true,
    "defaultOpaque": true,
    "color": "#050b14"
  },
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2026-11-12T15:00:00Z",
  "updatedAt": "2026-11-12T15:00:00Z"
}
```

#### C. Fichas de Personagem e NPCs: `campaigns/{campaignId}/characters/{characterId}`
```json
{
  "id": "char_01",
  "campaignId": "main-table",
  "name": "Agente Puffle",
  "type": "pc",
  "ownerId": "uid_player_1",
  "folderId": "fld_aliados_01",
  "visibleTo": ["ALL"],
  "editableBy": ["uid_do_mestre", "uid_player_1"],
  "cardColor": "#008be3",
  "level": 3,
  "xp": 450,
  "coins": 120,
  "defense": 14,
  "avatarMediaId": "media_avatar_char_01",
  "avatarExternalUrl": null,
  "defaultToken": {
    "mediaId": "media_token_char_01",
    "externalUrl": null,
    "sizeInCells": 1,
    "showName": true
  },
  "resources": {
    "hp": { "label": "Vida", "current": 28, "max": 28, "color": "#e53935" },
    "mp": { "label": "Energia", "current": 15, "max": 15, "color": "#1e88e5" }
  },
  "attributes": [
    { "key": "forca", "label": "Força", "value": 3 },
    { "key": "agilidade", "label": "Agilidade", "value": 4 },
    { "key": "intelecto", "label": "Intelecto", "value": 2 },
    { "key": "vigor", "label": "Vigor", "value": 3 },
    { "key": "espirito", "label": "Espírito", "value": 2 }
  ],
  "skills": [
    {
      "id": "sk_01",
      "name": "Furtividade",
      "attribute": "agilidade",
      "bonus": 4,
      "formula": "1d20 + @agilidade + @furtividade"
    }
  ],
  "abilities": [
    {
      "id": "ab_01",
      "name": "Bomba de Fumaça EPF",
      "elementColor": "#00838f",
      "icon": "bomb",
      "cost": { "resource": "mp", "amount": 3 },
      "hitFormula": "1d20 + @agilidade",
      "effectFormula": "2d6 + @intelecto",
      "trigger": "active",
      "effectType": "damage",
      "range": { "type": "ranged", "distanceMeters": 9 },
      "aoe": { "type": "circle", "radiusMeters": 6, "coneAngleDeg": 45 },
      "savingThrow": {
        "enabled": true,
        "dcFormula": "12 + @intelecto",
        "attribute": "resistencia",
        "effectDescription": "Cego por 1 rodada na falha"
      },
      "description": "Dispara uma granada tática que cobre a área de fumaça."
    }
  ],
  "inventory": [
    {
      "id": "inv_01",
      "name": "Peixe Fluffy Assado",
      "qty": 3,
      "icon": "fluffy_fish",
      "elementColor": "#38c172",
      "rollFormula": "2d4 + 2",
      "trigger": "active",
      "effectType": "heal",
      "consumeOnUse": true,
      "savingThrow": { "enabled": false, "dcFormula": "12", "attribute": "resistencia", "effectDescription": "" },
      "description": "Recupera vida instantaneamente."
    }
  ],
  "rollGroups": [
    {
      "id": "grp_combate",
      "name": "Ações Rápidas",
      "rolls": [
        {
          "id": "r_01",
          "sourceType": "ability",
          "sourceId": "ab_01",
          "name": "Bomba de Fumaça EPF",
          "color": "#00838f",
          "icon": "bomb",
          "hitFormula": "1d20 + @agilidade",
          "effectFormula": "2d6 + @intelecto",
          "effectType": "damage",
          "savingThrow": null,
          "costResource": "mp",
          "costAmount": 3
        }
      ]
    }
  ],
  "hotbar": [
    {
      "rollId": "r_01",
      "sourceType": "ability",
      "sourceId": "ab_01",
      "name": "Bomba de Fumaça EPF",
      "icon": "bomb",
      "color": "#00838f"
    },
    null, null, null, null, null, null, null, null
  ],
  "biography": "Recrutado pela EPF após o incidente do Herbert.",
  "notes": "Investigar a caverna submarina.",
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2026-11-12T15:00:00Z",
  "updatedAt": "2026-11-12T15:00:00Z"
}
```
> **Vínculo Dinâmico em `rollGroups` e `hotbar`**:
> Quando um item de `rollGroups` ou slot da `hotbar` possui `sourceType` (`"ability" | "skill" | "item"`) e `sourceId`, a resolução da rolagem busca em tempo real os dados atualizados (fórmula, custo, alcance, AoE e CD) diretamente na Habilidade, Perícia ou Item correspondente da ficha. Se o usuário editar a Habilidade na aba *Skills*, o atalho na aba *Rolagens* e na *Hotbar* reflete a mudança imediatamente.

#### D. Pastas e Subpastas Unificadas: `campaigns/{campaignId}/folders/{folderId}`
Subcoleção dedicada que organiza tanto a árvore de **Fichas (`domain: "characters"`)** quanto a árvore do **Diário (`domain: "notes"`)**, sem poluir as coleções de entidades com documentos polimórficos.
```json
{
  "id": "fld_01",
  "campaignId": "main-table",
  "domain": "notes",
  "name": "Ato 1",
  "parentId": null,
  "path": "Ato 1",
  "noteType": "lore",
  "scope": "party",
  "ownerId": "uid_do_mestre",
  "visibleTo": ["ALL"],
  "editableBy": ["ALL"],
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2026-11-12T15:00:00Z",
  "updatedAt": "2026-11-12T15:00:00Z"
}
```

#### E. Compêndio Global do Sistema: `campaigns/{campaignId}/compendium/{entryId}`
```json
{
  "id": "comp_01",
  "campaignId": "main-table",
  "type": "ability",
  "name": "Jato de Água Pressurizado",
  "category": "Card-Jitsu Água",
  "icon": "watergem",
  "elementColor": "#1e88e5",
  "visibleToPlayers": true,
  "visibleTo": ["ALL"],
  "cost": { "resource": "mp", "amount": 2 },
  "hitFormula": "1d20 + @espirito",
  "effectFormula": "2d8 + @espirito",
  "trigger": "active",
  "effectType": "damage",
  "savingThrow": {
    "enabled": true,
    "dcFormula": "13",
    "attribute": "reflexo",
    "effectDescription": "Empurrado 3m para trás"
  },
  "description": "Dispara uma torrente de água gelada contra o alvo.",
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "updatedAt": "2026-11-12T15:00:00Z"
}
```

#### F. Mensagens do Chat e Rolagens Táticas: `campaigns/{campaignId}/messages/{messageId}`
```json
{
  "id": "msg_991",
  "campaignId": "main-table",
  "senderId": "uid_player_1",
  "senderName": "Agente Puffle",
  "senderAvatarMediaId": "media_avatar_user_1",
  "senderPhotoURL": null,
  "characterMediaId": "media_avatar_char_01",
  "characterId": "char_01",
  "type": "roll",
  "visibility": "public",
  "visibleTo": ["ALL"],
  "content": "",
  "rollData": {
    "title": "Bomba de Fumaça EPF",
    "rollKind": "attack",
    "_rollKindValores": "attack | damage | heal | mp_damage | mp_heal | saving_throw | check | utility (ROLL_KINDS em combatEngine.js; não existem CUSTOM nem SAVE)",
    "categoryColor": "#00838f",
    "icon": "bomb",
    "costPaid": { "resource": "mp", "amount": 3 },
    "deferSecondaryDamage": true,
    "damageRolled": false,
    "secondaryFormula": "2d6 + @intelecto",
    "secondaryLabel": "Dano / Efeito",
    "effectType": "damage",
    "savingThrow": {
      "enabled": true,
      "dcFormula": "12 + @intelecto",
      "dcResolved": 14,
      "attribute": "resistencia",
      "effectDescription": "Cego por 1 rodada na falha"
    },
    "targets": [
      {
        "tokenId": "tok_npc_1",
        "characterId": "char_npc_robo",
        "name": "Robô de Herbert",
        "defense": 13,
        "ownerId": "uid_do_mestre"
      }
    ],
    "hitEvaluation": {
      "attackTotal": 19,
      "isCrit": false,
      "isFumble": false,
      "anyHit": true,
      "allHit": true,
      "results": [
        { "tokenId": "tok_npc_1", "name": "Robô de Herbert", "defense": 13, "hit": true }
      ]
    },
    "rolls": [
      {
        "label": "Acerto",
        "formulaOriginal": "1d20 + @agilidade",
        "formulaResolved": "1d20 + 4",
        "rolls": [{ "notation": "1d20", "rawRolls": [15], "keptRolls": [15], "subtotal": 15 }],
        "total": 19,
        "isCrit": false,
        "isFumble": false
      }
    ],
    "appliedTargets": {}
  },
  "isDeleted": false,
  "createdAt": "2026-11-12T15:05:00Z"
}
```

#### G. Diários, Cards em Blocos e Grafo Relacional: `campaigns/{campaignId}/notes/{noteId}`
```json
{
  "id": "note_herbert_01",
  "campaignId": "main-table",
  "scope": "gm",
  "ownerId": "uid_do_mestre",
  "visibleTo": ["uid_do_mestre"],
  "editableBy": ["uid_do_mestre"],
  "clonedFromNoteId": null,
  "noteType": "character",
  "folder": "Vilões/EPF",
  "folderId": "fld_viloes_epf",
  "linkedCharacterSheetId": "char_npc_herbert",
  "title": "Herbert P. Bear",
  "aliases": ["Herbert", "Urso Polar", "Inimigo Número 1"],
  "ignoredAliases": [],
  "imageMediaId": "media_note_herbert",
  "sections": [
    {
      "id": "sec_1",
      "title": "RESUMO TÁTICO",
      "content": "Planeja aquecer a ilha usando o refletor solar roubado da Mina."
    },
    {
      "id": "sec_2",
      "title": "CONEXÕES",
      "content": "Trabalha ao lado de Klutzy no esconderijo subterrâneo."
    }
  ],
  "content": "## RESUMO TÁTICO\nPlaneja aquecer a ilha...\n\n## CONEXÕES\nTrabalha ao lado de Klutzy...",
  "relatedNoteIds": ["note_klutzy_01", "note_mina_01"],
  "graphPosition": { "x": 420, "y": 260 },
  "isDeleted": false,
  "deletedAt": null,
  "deletedBy": null,
  "createdAt": "2026-11-12T15:00:00Z",
  "updatedAt": "2026-11-12T15:00:00Z"
}
```

#### H. Repositório Imutável de Mídia: `campaigns/{campaignId}/media/{mediaId}`
Cada mídia é **um único documento** com o conteúdo em `dataUrl` (WebP comprimido no cliente). A rule de criação exige `sizeBytes < 800000`.

> [!NOTE]
> **Errata (Validação Pós-Fase 3 / Fase 3.1)**: versões anteriores deste documento descreviam fragmentação automática em `media/{mediaId}/chunks/{chunkIndex}` (`isChunked`, `chunkCount`) para mídias acima de 700 KB. **Essa fragmentação nunca foi implementada** (nem no `HEAD`). A regra `media/{mediaId}/chunks/{chunkIndex}` existe em `firestore.rules`, mas nenhum código a utiliza; fica reservada para uma eventual implementação futura.
```json
{
  "id": "media_map_dojo_01",
  "campaignId": "main-table",
  "category": "scene",
  "mimeType": "image/webp",
  "widthPx": 2560,
  "heightPx": 1440,
  "sizeBytes": 342100,
  "isDeleted": false,
  "dataUrl": "data:image/webp;base64,UklGRv...",
  "uploadedBy": "uid_do_mestre",
  "createdAt": "2026-11-12T15:00:00Z"
}
```

---

### 3.2. Firebase Realtime Database (`vtt_realtime/{campaignId}`)

Os nós do RTDB são **estritamente separados por domínio** na raiz da campanha para que atualizações em `drawings` ou `pings` nunca disparem listeners de `fog` ou `tokens`:

```json
{
  "vtt_realtime": {
    "main-table": {
      "tokens": {
        "scene_dojo": {
          "tok_01": {
            "id": "tok_01",
            "campaignId": "main-table",
            "sceneId": "scene_dojo",
            "characterId": "char_01",
            "ownerId": "uid_player_1",
            "isGmToken": false,
            "name": "Agente Puffle",
            "mediaId": "media_token_char_01",
            "externalUrl": null,
            "x": 320,
            "y": 192,
            "size": 1,
            "hpCurrent": 28,
            "hpMax": 28,
            "mpCurrent": 15,
            "mpMax": 15,
            "defense": 14,
            "ringColor": "#008be3",
            "showName": true,
            "visibleToPlayers": true,
            "updatedAt": 1730646000000
          }
        }
      },
      "fog": {
        "scene_dojo": {
          "campaignId": "main-table",
          "strokes": [
            { "id": "fog_1", "op": "reveal", "shape": "rect", "x": 120, "y": 120, "w": 500, "h": 400 }
          ],
          "updatedAt": 1730646000000
        }
      },
      "drawings": {
        "scene_dojo": {
          "drw_01": {
            "id": "drw_01",
            "campaignId": "main-table",
            "sceneId": "scene_dojo",
            "type": "stroke",
            "authorId": "uid_player_1",
            "authorName": "Pinguim Azul",
            "color": "#ffcc00",
            "size": 4,
            "rotation": 0,
            "points": [{ "x": 200, "y": 210 }, { "x": 240, "y": 250 }],
            "createdAt": 1730646000000
          }
        }
      },
      "pings": {
        "scene_dojo": {
          "png_01": {
            "id": "png_01",
            "campaignId": "main-table",
            "x": 384,
            "y": 256,
            "color": "#00f0ff",
            "authorId": "uid_player_1",
            "authorName": "Pinguim Azul",
            "createdAt": 1730646000000
          }
        }
      },
      "presence": {
        "uid_player_1": {
          "uid": "uid_player_1",
          "campaignId": "main-table",
          "online": true,
          "displayName": "Pinguim Azul",
          "avatarMediaId": "media_avatar_user_1",
          "role": "player",
          "lastSeen": 1730646000000
        }
      }
    }
  }
}
```

---

## 4. Pipeline de Mídia, Cache Local e Tratamento de Sprites

1. **Compressão WebP Adaptativa (`imageCompressor.js`)**:
   - **Mapas (`scene`)**: Máximo `2560px` (2K QHD), qualidade inicial `0.82` com redução adaptativa caso passe de `700 KB`.
   - **Tokens (`token`)**: Máximo `384x384px`, WebP com canal alfa preservado (`<= 120 KB`).
   - **Avatares de Perfil, Personagens e Notas (`avatar`)**: Máximo `512x512px`, WebP (`<= 200 KB`), **sempre armazenados na coleção `media/{mediaId}`** (nunca injetando strings Base64 diretamente nos documentos de `campaigns`, `presence` ou `auth.currentUser.photoURL`).
2. **Cache Local Escopado por Campanha (`IndexedDB`)**:
   - O `mediaService.js` armazena os blobs/dataUrls sob a chave `${campaignId}:${mediaId}` no banco `cpvtt_media_cache` (store `media`; nome mantido para não invalidar o cache já salvo nos navegadores — ressalva #1 da Fase 0).
   - Leituras subsequentes têm custo zero de rede e zero leituras no Firestore.
3. **Remoção Automática de Fundo de Tokens (`TokenSprite.jsx`)**:
   - Tokens com fundo sólido (branco/chapado) passam por algoritmo de *Flood-Fill* iniciado nas 4 bordas da imagem em Canvas offscreen, convertendo os pixels de fundo conectados à borda em alfa transparente com suavização de transição (*anti-aliasing*) e cache em memória.

---

## 5. Sistema de Combate Tático, Tabuleiro Interativo e Modo de Turno

### 5.1. Alvos, Hotbar de Bolas de Neve e Área de Efeito (AoE)
1. **Seleção de Alvos no Tabuleiro**:
   - O jogador ou Mestre seleciona um ou mais tokens como alvo (`targetedTokenIds`) clicando com atalho ou demarcando área no mapa.
   - A seleção é compartilhada em tempo real com a janela destacada (`?campaignId=&sheetId=`) via `BroadcastChannel`.
2. **Hotbar de Ações Rápidas / Bolas de Neve (`QuickActionsHotbar.jsx`)**:
   - Possui 9 slots acionáveis por clique ou pelas teclas `1` a `9`.
   - Quando uma ação ofensiva é disparada com alvo selecionado, o tabuleiro anima projéteis de bola de neve (`useSnowballProjectiles.js`) saindo do token atacante até o(s) token(s) alvo(s) antes de registrar o impacto.
3. **Alcance e Demarcação Geométrica de Área (`1 célula = 1,5m`)**:
   - Habilidades configuram `range` (`self`, `touch`, `ranged` em metros) e `aoe` (`single`, `circle` com raio em metros, ou `cone` de `45°` ou `60°`).
   - O botão `"🎯 Demarcar Área"` projeta o alcance máximo ao redor do conjurador e desenha o círculo ou cone direcional no tabuleiro, selecionando automaticamente todos os tokens contidos na geometria ao confirmar o clique.

### 5.2. Fluxo de Ataque em Duas Etapas, Gatilhos e Testes de Resistência
1. **Etapa 1 — Rolagem de Acerto (`rollKind: "attack"`, `deferSecondaryDamage: true`)**:
   - Desconta o custo base da habilidade (`mp` ou `hp`), rola a fórmula de acerto (`1d20 + ...`) e compara automaticamente o total contra a `defense` de cada token alvo (`hitEvaluation`), exibindo no card do chat quais alvos foram atingidos (`ACERTOU` / `ERROU` / `CRÍTICO`).
2. **Etapa 2 — Modal de Dano, Gatilhos e Assistências (`DamageRollModal.jsx`)**:
   - Ao clicar em `"⚔️ Rolar Dano / Efeito"` no card do chat, abre-se o modal listando:
     - A fórmula base de dano/cura da habilidade (com opção de multiplicar dados em caso de crítico);
     - **Habilidades de Gatilho (`on_hit`, `on_crit`)** e **Itens do Inventário** do próprio atacante;
     - **Assistências / Buffs de Aliados** (habilidades e itens compatíveis de outros personagens da mesa);
     - Modificador livre adicional.
   - Ao confirmar, o serviço deduz automaticamente os custos de MP/HP e dá baixa na quantidade (`qty - 1`) dos itens consumíveis utilizados por cada personagem participante.
3. **Etapa 3 — Teste de Resistência Automático (`SavingThrowModal.jsx`)**:
   - Quando uma habilidade ou item possui `savingThrow.enabled === true`, o sistema calcula a CD (`dcFormula` resolvida com os atributos do conjurador) e gera a exigência de resistência para os alvos atingidos.
   - O jogador dono do alvo (ou Mestre) rola o teste no `SavingThrowModal` (podendo ativar reações `on_save` / `reaction` e consumíveis), avaliando automaticamente `SUCESSO` (`total >= CD`) ou `FALHA` (`total < CD`).
4. **Aplicação de Dano/Cura pelo Mestre**:
   - Nos cards de dano/efeito do chat, o Mestre dispõe de controles rápidos (`1x`, `½`, `2x`, `+HP`, `MP` ou valor customizado) para aplicar o resultado nos alvos, respeitando a regra de sincronização (atualizando Ficha + Token para Players, e apenas o Token individual para NPCs do Mestre).

### 5.3. Arquitetura do Futuro "Modo de Turno" (`combatState`)
Quando `campaign.combatState.active === true`:
- **Ordem de Iniciativa (`turnOrder`)**: Define o combatente ativo (`turnOrder[activeTurnIndex]`).
- **Trava de Movimento e Deslocamento**:
  - Fora do seu turno, jogadores ficam impedidos de arrastar seus tokens (`lockMovementOutsideTurn`).
  - No turno ativo, o arraste do token calcula a distância percorrida em metros (`células * 1,5m`) e desconta de `movementBudgetMeters` (`movementUsedMeters`), bloqueando movimentos que excedam o deslocamento restante.
- **Orçamento de Ações por Turno**:
  - Cada habilidade/item consome `actionsRemaining` (quando `trigger === "active"`) ou `reactionsRemaining` (quando `trigger === "reaction"` ou `"on_save"`), travando novas ações ativas quando o limite do turno chega a zero (`lockActionsOutsideTurn`).
- **Registro de ações e virada de rodada (decisão D-4, 2026-11-13)**:
  - O sistema mantém um registro **temporário** das ações tomadas por cada jogador.
  - Esse registro é apagado **na virada de RODADA**, e não ao fim do turno de cada jogador.
  - Uma rodada termina quando todos os combatentes já agiram uma vez, e **a virada de rodada exige confirmação do Mestre**.
  - A base estrutural da Fase 3 (`advanceTurnInState`) ainda zera o orçamento do próximo combatente a cada turno e incrementa `round` automaticamente, sem confirmação; deve ser adequada a esta especificação quando o Modo de Turno for implementado.

---

## 6. Sistema de Diários: Explorer em Árvore, Blocos e Visão de Teia

1. **Menu Lateral Explorer (`JournalWorkspace.jsx`)**:
   - Organizado nos escopos **Mestre (`gm`)**, **Player (`player`)**, **Grupo (`party`)** e **Todos (`unified`)**.
   - Dentro de cada uma das 5 categorias (`Missões`, `Lugares`, `Personagens`, `Lore`, `Eventos`), exibe uma **Árvore Recursiva de Pastas e Subpastas** com suporte completo a *Drag & Drop* de cards e criação inline de subpastas.
2. **Editor de Cards em Blocos e Modo Interativo (`NoteEditorModal.jsx`)**:
   - O conteúdo de cada card é estruturado em múltiplos **Blocos Reordenáveis (`sections: [{ id, title, content }]`)**.
   - **Modo Visualizar (Interativo)**: O `aliasEngine.js` analisa o texto de cada bloco confrontando-o **apenas com os cards que o usuário atual tem permissão de ver (`anti-spoiler`)** e respeitando a lista de termos negados (`ignoredAliases`). Nomes e aliases reconhecidos tornam-se chips interativos com popover em portal permitindo **abrir o card vinculado** ou **remover o vínculo (`✕`)**.
   - **Seleção Rápida para Vínculo (`📎 Vincular card`)**: Selecionar qualquer trecho de texto permite vinculá-lo a outro card existente, adicionando automaticamente o termo selecionado aos `aliases` do card destino.
   - **Compartilhamento Granular e Clonagem**: Permite conceder/revogar acesso de leitura ao Grupo ou a jogadores individuais (`visibleTo`), ou clonar o card para outro diário (`cloneNoteToTarget`).
3. **Visão de Teia Interativa (`JournalGraphWebView.jsx`)**:
   - Grafo 2D renderizado sobre o visor tático da EPF com câmera Pan/Zoom, arraste de nós com persistência de coordenadas (`graphPosition`), filtros por categoria e botão de **Isolar Conexões** (destacando apenas a vizinhança direta do card em foco).

---

## 7. Design System e Regras de CSS (Baseado nos Estilos Inline Aprovados)

> **Diretriz Central de Estilo**: Os estilos abaixo refletem a implementação real consolidada nos estilos inline dos componentes, que prevalece sobre folhas de estilo legadas.

### 7.1. Padrões Visuais por Módulo
1. **Tela de Autenticação (`LoginScreen.jsx`)**:
   - Fundo radial oceano profundo (`#004b94` -> `#001f44`).
   - **Modo Login**: Painel azul arredondado (`border-radius: 28px`, gradiente `#0589de` -> `#005098`), campos alinhados à direita com borda `#000c24`, Post-it amarelo inclinado (`rotate(-6deg)`, `#fff275` -> `#f0cd17`) e botão principal glossy `"Entrar"`.
   - **Modo Criar Pinguim**: Layout em 2 colunas (`max-width: 920px`, fundo `#0072cb`), moldura circular (`230x230px`) para upload de foto com balão amarelo `"Seu Pinguim necessita de um nome!"` à esquerda, e campos de senha (com toggle `"MOSTRAR SENHA: ON/OFF"`), e-mail e termos à direita.
2. **Ficha de Personagem (`CharacterSheetModal.jsx`)**:
   - **Lado Esquerdo (`cp-playercard-left`)**: Cartão clássico vertical com gradiente dinâmico baseado em `character.cardColor`, notch superior triplo, badge dourado `"⭐ NÍVEL X"`, moldura central quadrada do avatar, rodapé de Moedas (`coin.webp`) e Experiência (`stamp_book.png`) com edição inline e seletor de 10 cores de cartão.
   - **Lado Direito (`cp-playercard-right`)**: Gaveta clara conectada ao cartão com barra superior de ações contextuais, área central rolável e dock inferior (`cp-inv-bottom-dock`) com botão cápsula que abre o menu popup de troca de abas (`Inventário`, `Atributos`, `Skills`, `História & Notas`, `Rolagens & Ações`).
3. **Árvore de Fichas (`CharactersSidebarList.jsx`)**:
   - Fundo claro limpo (`#ffffff`), botões superiores `"+ Personagem"` e `"+ Pasta"`, itens da raiz do Mestre seguidos pelas seções divisórias de cada Jogador (`- Nome do Jogador (N)`), subpastas indentadas com guia vertical (`border-left: 2px solid #e2e8f0`) e indicador luminoso verde/laranja de status online.
4. **Workspace do Diário (`JournalWorkspace.jsx` + `JournalGraphWebView.jsx`)**:
   - Sidebar esquerda escura (`linear-gradient(180deg, #0b1d33 0%, #071322 100%)`, `width: 290px`) com busca, seletores de escopo e árvore de categorias/pastas/cards; área principal direita ocupada pelo Visor EPF (`#07131e` com grade radial ciano e arestas luminosas `#00f0ff` para vínculos explícitos e `#ffcc00` tracejado para menções por alias).

### 7.2. Escala Oficial de Camadas (`z-index`)
Para evitar sobreposições acidentais, todos os componentes devem respeitar a hierarquia de camadas abaixo:
```css
:root {
  --z-board-canvas: 1;          /* Mapa, Grid, Desenhos, Tokens e Fog of War */
  --z-board-ui: 20;             /* Toolbar lateral do mapa, controles de mídia e régua */
  --z-workspace-journal: 12;    /* Workspace do Diário quando aberto sobre o canvas */
  --z-hud-bars: 40;             /* Barra superior, Sidebar direita e Dock inferior */
  --z-hud-popovers: 120;        /* Menu de Emotes, Hotbar de Bolas de Neve e Flyouts da Toolbar */
  --z-modal-base: 1000;         /* Modais principais (Ficha, Cena, Compêndio, Painel GM) */
  --z-modal-nested: 1250;       /* Submodais da Ficha (Seletor de Ícone, Slots da Hotbar, Pastas) */
  --z-modal-combat: 3500;       /* Modais prioritários de Combate (DamageRollModal, SavingThrowModal) */
  --z-modal-note-editor: 5000;  /* Editor de Card do Diário e submodal de vínculo */
  --z-portal-tooltip: 9000;     /* Popovers em Portal (LinkedCardSpan, Menu de Contexto) */
}
```

**Regras de uso (implementadas na Fase 4)**:
- Os tokens estão declarados em `src/index.css` (`:root`). Em CSS, use `z-index: var(--z-...)`; em JSX, use `Z_LAYERS` de `src/constants/zLayers.js` (ex.: `style={{ zIndex: Z_LAYERS.modalBase }}`).
- Os tokens valem para **camadas globais** (shell, HUD, popovers, modais e portais). Valores **locais**, dentro de um elemento que já cria contexto de empilhamento (ex.: a superfície transformada do tabuleiro, o workspace do Diário, o overlay de um modal, o dock), continuam numéricos, porque só ordenam elementos dentro daquele contexto.
- Exceção documentada: o visor de mapa (`ScenesManagerModal`, aba "map") usa `calc(var(--z-modal-base) + 1)` para continuar acima da Ficha, do Compêndio e do Painel GM, que são renderizados depois no DOM.

### 7.3. Componentes Base (`src/components/ui/`)
Extraídos na Fase 4 com **HTML idêntico** ao dos inlines que substituem (verificado por renderização estática comparativa). Estilos inline passados por `style` continuam prevalecendo.
- **`WindowModal`** (`variant`, `onClose`, `zIndex = Z_LAYERS.modalBase`, `maxWidth`, `overlayStyle`, `panelStyle`, `portal = false`): overlay + painel; clique no overlay fecha, clique no painel não propaga.
  - `"light"`: painel branco (`#ffffff`, borda `3px #008be3`, raio `14px`, sombra `0 10px 30px rgba(0,0,0,0.3)`) sobre overlay `rgba(0, 27, 58, 0.45)` com `blur(2px)`.
  - `"cp"`: classes globais `.cp-modal-overlay` + `.cp-window`.
  - `portal` é opcional porque o contexto de empilhamento de quem renderiza deve ser preservado.
- **`CPButton`** (`variant`, `className`, `type = "button"`): gera exatamente `cp-btn` ou `cp-btn cp-btn-{gold|green|orange|epf}`.
- **`ConfirmDeleteModal`** (`title`, `question`, `moveLabel`, `deleteLabel`, `onMove`, `onDelete`, `onCancel`, `zIndex`, `maxWidth = 350px`, `overlayBackground`, `panelShadow`): usa `WindowModal` "light" + 3 `CPButton`.
- **`SavingThrowFields`** (`layout = "inline" | "grid"`, valores/handlers de `enabled`, `dcFormula`, `attribute`, `effectDescription`, rótulo, placeholders e larguras): opções de `SAVE_ATTRIBUTES`.
- **`CpSpeechBubble`** (`text`, `icon`, `isFadingOut`, `bottomOffset`, `iconSize`): apresentação do balão (classes `.cp-speech-bubble-*`).
- **Adoção**: novos componentes e os subcomponentes da decomposição da Fase 5 devem usar estes componentes base em vez de recriar overlays, botões e campos de resistência inline.

---

## 8. Segurança e Regras de Acesso (`firestore.rules` e `database.rules.json`)

> [!IMPORTANT]
> **Alinhamento Obrigatório entre Queries e Security Rules**:
> No Firestore, uma query falha inteiramente se puder retornar qualquer documento que o usuário não tenha permissão de ler. Por isso:
> 1. Todo documento criado/atualizado normaliza o campo `visibleTo` como array contendo `"ALL"` (se público) ou os UIDs autorizados (`[gmId, ownerId, ...sharedUids]`).
> 2. Quando `isGM` for `false`, os hooks do cliente adicionam `where("visibleTo", "array-contains-any", ["ALL", currentUser.uid])` na query do Firestore e filtram `doc.isDeleted !== true`.

### 8.1. Regras do Cloud Firestore (`firestore.rules`)

> [!NOTE]
> O bloco abaixo é a especificação de referência. A versão vigente é o arquivo `firestore.rules` (local, ainda sem deploy — decisão D-1). Pontos da versão vigente após a Fase 3.1:
> - E-mail do Mestre: `erickteixeiractt@gmail.com` (o mesmo de `src/constants/authorizedUsers.js`); o Mestre também é reconhecido por `campaigns/{campaignId}.gmId`.
> - **D-3**: em `characters`, `notes` e `folders`, quem não é Mestre só altera `isDeleted`/`deletedAt`/`deletedBy` se for o dono (`ownerId`); `allow delete` (exclusão física) é exclusivo do Mestre.
> - `messages`: `update`/`delete` exclusivos do Mestre (D-3).
> - `canSeeResource` aceita também `scope == 'party'`; o ramo `senderId` não é necessário porque `visibleTo` das mensagens sempre inclui o remetente.
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isGM(campaignId) {
      return isSignedIn() && (
        request.auth.token.email == 'erickteixeiractt@gmail.com' ||
        get(/databases/$(database)/documents/campaigns/$(campaignId)).data.gmId == request.auth.uid
      );
    }

    function canSeeResource(campaignId, resourceData) {
      return isGM(campaignId) || (
        isSignedIn() && (
          resourceData.visibleToPlayers == true ||
          resourceData.ownerId == request.auth.uid ||
          resourceData.senderId == request.auth.uid ||
          ('visibleTo' in resourceData && (
            'ALL' in resourceData.visibleTo ||
            request.auth.uid in resourceData.visibleTo
          ))
        )
      );
    }

    match /campaigns/{campaignId} {
      allow read: if isSignedIn();
      allow create, delete: if isSignedIn();
      // Mestre pode atualizar tudo; jogadores só podem atualizar seu próprio registro em players
      allow update: if isGM(campaignId) || (
        isSignedIn() &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['players', 'updatedAt'])
      );

      match /scenes/{sceneId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow write: if isGM(campaignId);
      }

      match /characters/{characterId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow create: if isSignedIn();
        allow update: if isGM(campaignId) || (
          isSignedIn() && (
            resource.data.ownerId == request.auth.uid ||
            ('editableBy' in resource.data && request.auth.uid in resource.data.editableBy)
          )
        );
        // Exclusões são sempre Soft Delete (via update de isDeleted: true); hard delete restrito ao GM
        allow delete: if isGM(campaignId);
      }

      match /folders/{folderId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow create: if isSignedIn();
        allow update: if isGM(campaignId) || (
          isSignedIn() && (
            resource.data.ownerId == request.auth.uid ||
            resource.data.scope == 'party' ||
            ('editableBy' in resource.data && request.auth.uid in resource.data.editableBy)
          )
        );
        allow delete: if isGM(campaignId);
      }

      match /compendium/{itemId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow write: if isGM(campaignId);
      }

      match /messages/{messageId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow create: if isSignedIn() && request.resource.data.senderId == request.auth.uid;
        allow update: if isSignedIn();
        allow delete: if isGM(campaignId);
      }

      match /notes/{noteId} {
        allow read: if canSeeResource(campaignId, resource.data) || (
          isSignedIn() && resource.data.scope == 'party'
        );
        allow create: if isSignedIn();
        allow update: if isGM(campaignId) || (
          isSignedIn() && (
            resource.data.scope == 'party' ||
            resource.data.ownerId == request.auth.uid ||
            ('editableBy' in resource.data && request.auth.uid in resource.data.editableBy)
          )
        );
        allow delete: if isGM(campaignId);
      }

      match /media/{mediaId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn();
        allow update, delete: if isGM(campaignId) || (
          isSignedIn() && resource.data.uploadedBy == request.auth.uid
        );

        match /chunks/{chunkId} {
          allow read: if isSignedIn();
          allow create: if isSignedIn();
          allow update, delete: if isGM(campaignId);
        }
      }
    }
  }
}
```

### 8.2. Regras do Realtime Database (`database.rules.json`)
- **Reconhecimento do Mestre (Fase 3.1)**: o RTDB não lê o Firestore, então o `gmId` da campanha é espelhado em `vtt_realtime/{campaignId}/meta/gmId`. Em `tokens`, `fog`, `drawings` e `pings`, o Mestre é quem tem o e-mail autorizado **ou** `auth.uid === meta/gmId`. `meta/gmId` só pode ser escrito pelo e-mail do Mestre ou pelo próprio `gmId` já espelhado (o cliente do Mestre grava ao abrir a mesa e em `assignGM`).
- **`tokens/$sceneId/$tokenId`**: Leitura para autenticados; escrita permitida ao Mestre ou ao dono do token (`data.child('ownerId').val() == auth.uid`). Quem não é Mestre só cria token com `ownerId === auth.uid` e `layer === 'tokens'`; quem tem a ficha em `editableBy` vira dono da instância, e o dono da ficha mantém o controle via `controlledBy`. Só o Mestre marca `isGmToken: true`.
- **`fog/$sceneId`**: Leitura para autenticados; escrita exclusiva do Mestre.
- **`drawings/$sceneId/$drawingId`**: Leitura para autenticados; criação para autenticados (`newData.child('authorId').val() == auth.uid`); edição/exclusão permitida apenas ao próprio autor (`data.child('authorId').val() == auth.uid`) ou ao Mestre.
- **`pings/$sceneId/$pingId`**: Leitura para autenticados; criação e remoção pelo autor (`authorId`/`senderId === auth.uid`) ou pelo Mestre.
- **`presence/$uid`**: Leitura para autenticados; escrita apenas pelo próprio `$uid === auth.uid`.

---

## 9. Plano Diretor de Refatoração e Evolução

1. **Fase 1 — Saneamento de Dados, Multi-Campanha (`campaignId`), Soft Delete e Correções de Auth/Mídia**:
   - Injetar `campaignId` explícito em todas as criações/atualizações de documentos e nós, URLs (`?campaignId=&sheetId=`) e chaves do `IndexedDB`.
   - Executar rotina idempotente de migração/backfill (`migrationService.js`) que carimba `campaignId`, `isDeleted: false`, normaliza `visibleTo`, corrige em definitivo o ícone `"fluffy_fish"` no banco (removendo os 6 hacks de runtime) e migra pastas para `folders/{folderId}`.
   - Substituir exclusões físicas no Firestore por **Soft Delete (`isDeleted: true`)** e adicionar o modal de decisão ao excluir pastas (mover itens para a pasta pai — D-2 — vs. ocultar tudo).
   - Remover `btoa(password)` do `localStorage` em `LoginScreen.jsx` e migrar avatares de jogadores para `media/{mediaId}`.
2. **Fase 2 — Isolamento no RTDB, Autoria, Sincronização Ficha ↔ Token e Ativação das Security Rules**:
   - Mover `drawings` e `pings` para fora de `fog/{sceneId}` no RTDB.
   - Remover todo o código morto da Borracha Parcial (`erasePortionAt` e helpers geométricos).
   - Garantir isolamento de autoria em desenhos, tokens e fichas.
   - Implementar a sincronização bidirecional Ficha ↔ Token para Players (`ownerId !== gmId`) e vida/recursos independentes por token para fichas do Mestre (`ownerId === gmId` / `type === "npc"`).
   - Ajustar queries dos hooks (`visibleTo` com `array-contains-any`) e ativar as regras definitivas em `firestore.rules` e `database.rules.json`.
3. **Fase 3 — Limpeza de `engines/`, Criação de `services/` de Domínio, Atalhos Dinâmicos e Base do Modo de Turno**:
   - Substituir `localStorage` em `combatEngine.js` por `useCrossWindowSync.js` (`BroadcastChannel`) e unificar estado de alvos.
   - Criar `combatService.js`, `rollService.js` e `journalService.js` eliminando código duplicado (custos/consumíveis, identidade do remetente, normalização NFD).
   - Implementar vínculo dinâmico por referência (`sourceType` + `sourceId`) em `rollGroups` e `hotbar`.
   - Estruturar o estado e seletores do futuro **Modo de Turno (`combatState`)**.
4. **Fase 4 — Design System (`src/components/ui/`) e Padronização CSS (Fidelidade aos Inlines Atuais)**:
   - Extrair componentes base (`WindowModal`, `CPButton`, `CpSpeechBubble`, `SavingThrowFields`, `ConfirmDeleteModal`) preservando 100% do visual atual dos estilos inline e padronizar a escala de `--z-*`.
5. **Fase 5 — Decomposição dos "God Components" (SRP) e Otimização de Performance (Debounce)**:
   - Adicionar *debounce* (400ms + flush em `onBlur`) nos campos de texto/números da ficha.
   - Decompor `CharacterSheetModal.jsx`, `BoardViewport.jsx`, `VTTLayout.jsx` e `ChatSidebarPanel.jsx` nos módulos definidos na Seção 2, isolando `StandaloneSheetView.jsx` com suporte completo aos modais de combate.
