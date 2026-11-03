# Diretrizes de Arquitetura e Engenharia — ClubPenguinVTT

Este documento é a **fonte única da verdade (Single Source of Truth)** para a arquitetura, banco de dados, segurança, otimização de mídia e regras de negócio do VTT. Toda nova funcionalidade implementada no projeto deve seguir rigorosamente os padrões definidos aqui.

---

## 1. Princípios Gerais e Regras Inegociáveis

1. **Plano Firebase Spark (Custo Zero / Serverless Client-Driven)**:
   - Toda a lógica de processamento de regras de RPG, cálculo de fórmulas de dados e compressão de imagens roda **no cliente (navegador)**, apoiada por **Security Rules** rigorosas no Firebase (sem dependência de Cloud Functions pagas do plano Blaze).
2. **Arquitetura Híbrida de Banco de Dados**:
   - **Cloud Firestore**: Armazena dados persistentes, documentos estruturados e entidades filtráveis por permissão (Campanha, Mapas/Cenas, Fichas de Personagem, Compêndio Global e Histórico de Chat/Rolagens).
   - **Firebase Realtime Database (RTDB)**: Armazena estados de **alta frequência e baixa latência** (coordenadas `X/Y` de tokens sendo arrastados no mapa, máscara de Névoa de Guerra em tempo real, pings visuais e presença online), evitando estourar o limite diário de escritas do Firestore.
3. **Diretriz de UI/UX Limpa**:
   - **Proibido incluir textos explicativos em subtítulos, antes de botões ou locais similares.**
   - Toda regra de negócio deve ser tratada exclusivamente dentro do código, sem precisar ser explicada ou declarada explicitamente na tela.
4. **Controle de Git e Deploy**:
   - Nenhum `git commit` ou `firebase deploy` deve ser executado sem autorização explícita.

---

## 2. Arquitetura de Pastas (`src/`)

```text
src/
├── assets/                  # Ícones estáticos locais e SVGs da interface
├── components/
│   ├── auth/                # Login (Google + Email/Senha) e guarda de rotas
│   ├── canvas/              # Tabuleiro VTT (Mapa, Grid, Camada de Tokens, Fog of War, Zoom/Pan)
│   ├── chat/                # Chat lateral, cards de habilidade, rolagens públicas/secretas
│   ├── compendium/          # Catálogo global do Mestre (Habilidades, Magias, Itens)
│   ├── gm/                  # Painel exclusivo do Mestre (troca de cena, permissões, controle de NPCs)
│   ├── journal/             # Diários (Mestre, Player, Grupo), Visão Kanban e Visão de Teia (Grafo)
│   ├── sheets/              # Fichas de personagem (Atributos, Perícias, Magias, Inventário)
│   └── ui/                  # Componentes base (Modais, Botões, Tabs, Barras de Progresso)
├── contexts/
│   ├── AuthContext.jsx      # Estado do usuário logado e papel na mesa (GM vs Player)
│   └── CampaignContext.jsx  # Estado da campanha ativa, cena atual e sincronização global
├── engines/
│   ├── aliasEngine.js       # Detecção de aliases sem spoiler, auto-link e geração de nós/arestas da Teia
│   ├── diceEngine.js        # Gerador de números aleatórios e parser de dados (ex: 2d6, 1d20)
│   ├── formulaEngine.js     # Resolução de variáveis da ficha (ex: 1d20 + @forca + @pericia)
│   └── imageCompressor.js   # Conversão e redimensionamento client-side para WebP via Canvas
├── hooks/
│   ├── useRealtimeTokens.js # Sincronização de tokens via Realtime Database
│   ├── useFogOfWar.js       # Sincronização da Névoa de Guerra
│   ├── useCharacterSheet.js # Leitura/escrita reativa de fichas no Firestore
│   ├── useChatRolls.js      # Envio e escuta de mensagens/rolagens filtradas por visibilidade
│   └── useJournalNotes.js   # CRUD, clonagem e transferência de cards entre diários (GM, Player, Grupo)
└── services/
    ├── firebase.js          # Inicialização de Auth, Firestore e Realtime Database (100% Spark)
    ├── mediaService.js      # Persistência WebP em coleção dedicada (media) + Cache local IndexedDB
    ├── journalService.js    # Lógica de clonar/disponibilizar cards entre Mestre, Players e Grupo
    └── rollService.js       # Orquestração: valida custo -> desconta recurso -> rola -> grava no chat
```

---

## 3. Modelagem de Dados (JSON Schemas)

Mesmo operando inicialmente como **Mesa Única** (`DEFAULT_CAMPAIGN_ID = "main-table"`), todos os caminhos já incluem `campaignId` para permitir múltiplas mesas no futuro sem refatoração.

### 3.1. Cloud Firestore (Dados Persistentes e Filtráveis)

#### A. Documento da Campanha: `campaigns/{campaignId}`
Define quem é o Mestre e qual mapa os jogadores estão enxergando no momento.
```json
{
  "id": "main-table",
  "name": "Campanha Principal",
  "gmId": "uid_do_mestre",
  "players": {
    "uid_player_1": { "displayName": "Arthur", "role": "player", "activeCharacterId": "char_01" },
    "uid_player_2": { "displayName": "Bruna", "role": "player", "activeCharacterId": "char_02" }
  },
  "activeSceneId": "scene_taverna",
  "combatState": {
    "active": false,
    "round": 1,
    "turnOrder": []
  },
  "updatedAt": "2026-11-03T12:00:00Z"
}
```

#### B. Mapas / Cenas: `campaigns/{campaignId}/scenes/{sceneId}`
Configuração visual do tabuleiro, grid e visibilidade (a imagem pesada fica desacoplada na coleção `media` para manter o documento da cena leve).
```json
{
  "id": "scene_taverna",
  "name": "Taverna do Pinguim Caolho",
  "visibleToPlayers": true,
  "mapImage": {
    "mediaId": "media_map_taverna_01",
    "externalUrl": null,
    "widthPx": 2560,
    "heightPx": 1440
  },
  "grid": {
    "enabled": true,
    "snapToGrid": true,
    "cellSizePx": 64,
    "offsetX": 0,
    "offsetY": 0,
    "color": "#ffffff",
    "opacity": 0.25
  },
  "fogOfWar": {
    "enabled": true,
    "defaultOpaque": true
  },
  "createdAt": "2026-11-03T12:00:00Z"
}
```
> **Movimento Híbrido (Grid + Livre)**: Se `grid.snapToGrid` for `true`, ao soltar o token sua posição `(x, y)` é arredondada para o múltiplo mais próximo de `cellSizePx` (ou o Mestre pode segurar `Alt` ao arrastar para ignorar o snap temporariamente). Se `snapToGrid` for `false`, o posicionamento usa coordenadas exatas em pixels.

#### C. Fichas de Personagem e NPCs: `campaigns/{campaignId}/characters/{characterId}`
Suporta controle granular de quem vê e quem edita cada ficha.
```json
{
  "id": "char_01",
  "name": "Kaelen",
  "type": "pc",
  "ownerId": "uid_player_1",
  "visibleTo": ["uid_do_mestre", "uid_player_1"],
  "editableBy": ["uid_do_mestre", "uid_player_1"],
  "avatarMediaId": "media_avatar_kaelen",
  "defaultToken": {
    "mediaId": "media_token_kaelen",
    "sizeInCells": 1
  },
  "resources": {
    "hp": { "label": "Vida", "current": 28, "max": 35, "color": "#e53935" },
    "mp": { "label": "Energia", "current": 12, "max": 15, "color": "#1e88e5" }
  },
  "attributes": {
    "forca": 4,
    "agilidade": 3,
    "intelecto": 2,
    "vigor": 3,
    " espirito": 1
  },
  "skills": {
    "luta": { "label": "Luta", "attribute": "forca", "bonus": 2 },
    "furtividade": { "label": "Furtividade", "attribute": "agilidade", "bonus": 4 }
  },
  "abilities": [
    {
      "id": "ab_local_01",
      "sourceCompendiumId": "comp_golpe_pesado",
      "isCustom": false,
      "name": "Golpe Pesado",
      "category": "physical",
      "cost": { "resource": "mp", "amount": 2 },
      "hitFormula": "1d20 + @forca + @luta",
      "effectFormula": "2d6 + @forca",
      "description": "Ataque concentrado que causa dano adicional."
    }
  ],
  "inventory": [],
  "notes": "",
  "updatedAt": "2026-11-03T12:00:00Z"
}
```
> **Regra de Visibilidade de Fichas**:
> - Para tornar uma ficha pública para todo o grupo, adiciona-se `"ALL"` no array `visibleTo`.
> - Fichas de NPCs e monstros do Mestre ficam com `visibleTo: ["uid_do_mestre"]` até que o Mestre decida compartilhar com alguém.

#### D. Compêndio Global do Sistema: `campaigns/{campaignId}/compendium/{itemId}`
Catálogo central gerenciado pelo Mestre para que os jogadores selecionem habilidades, magias e itens prontos (sem impedir a criação de habilidades customizadas na própria ficha).
```json
{
  "id": "comp_golpe_pesado",
  "type": "ability",
  "name": "Golpe Pesado",
  "category": "Combate",
  "visibleToPlayers": true,
  "allowedPlayerIds": ["ALL"],
  "cost": { "resource": "mp", "amount": 2 },
  "hitFormula": "1d20 + @forca + @luta",
  "effectFormula": "2d6 + @forca",
  "criticalRule": { "naturalMin": 20, "multiplier": 2 },
  "description": "Ataque concentrado que causa dano adicional.",
  "tags": ["corpo-a-corpo", "força"]
}
```

#### E. Mensagens do Chat e Rolagens: `campaigns/{campaignId}/messages/{messageId}`
```json
{
  "id": "msg_991",
  "senderId": "uid_player_1",
  "senderName": "Kaelen",
  "characterId": "char_01",
  "type": "ability_roll",
  "visibility": "public",
  "visibleTo": ["ALL"],
  "content": "",
  "rollData": {
    "title": "Golpe Pesado",
    "costPaid": { "resource": "mp", "amount": 2 },
    "rolls": [
      {
        "label": "Acerto",
        "formulaOriginal": "1d20 + @forca + @luta",
        "formulaResolved": "1d20 + 4 + 2",
        "diceResults": [{ "sides": 20, "results": [17] }],
        "modifierTotal": 6,
        "total": 23,
        "isCrit": false,
        "isFumble": false
      },
      {
        "label": "Dano",
        "formulaOriginal": "2d6 + @forca",
        "formulaResolved": "2d6 + 4",
        "diceResults": [{ "sides": 6, "results": [5, 4] }],
        "modifierTotal": 4,
        "total": 13
      }
    ]
  },
  "createdAt": "2026-11-03T12:05:00Z"
}
```
> **Rolagens Secretas (`gm_only` ou `whisper`)**:
> - Rolagem Pública: `visibleTo: ["ALL"]`
> - Rolagem Secreta (só Mestre e quem rolou veem): `visibility: "gm_only"`, `visibleTo: ["uid_do_mestre", "uid_player_1"]`
> - Rolagem Oculta do Mestre (só o Mestre vê): `visibility: "self"`, `visibleTo: ["uid_do_mestre"]`

#### F. Diários, Anotações e Wiki Relacional: `campaigns/{campaignId}/notes/{noteId}`
Unifica os cards de investigação e campanha em três escopos de diário (`gm`, `player`, `party`) e cinco categorias relacionáveis (`character`, `lore`, `location`, `event`, `quest`), com suporte nativo a **Aliases**, **Kanban** e **Visão de Teia (Grafo)**.

```json
{
  "id": "note_vilao_01",
  "scope": "gm",
  "ownerId": "uid_do_mestre",
  "visibleTo": ["uid_do_mestre"],
  "editableBy": ["uid_do_mestre"],
  "clonedFromNoteId": null,
  "noteType": "character",
  "linkedCharacterSheetId": "char_npc_boss",
  "title": "Vilão da Campanha",
  "aliases": ["Vilão", "Monstro do Mal", "Carlos", "O Encapuzado"],
  "aliasesNormalized": ["vilao", "monstro do mal", "carlos", "o encapuzado"],
  "imageMediaId": "media_note_carlos",
  "kanbanStatus": "active",
  "content": "Na [[note_missao_01|Missão 1]], o Carlos explodiu a [[note_lugar_01|Vila de Gelo]] buscando o [[note_lore_01|Cristal Ancestral]].",
  "relatedNoteIds": [
    "note_missao_01",
    "note_lugar_01",
    "note_lore_01"
  ],
  "mentionedNoteIds": [
    "note_missao_01",
    "note_lugar_01",
    "note_lore_01"
  ],
  "graphNode": {
    "x": 420,
    "y": 180,
    "pinned": false,
    "color": "#e53935"
  },
  "tags": ["ameaça", "ato-1"],
  "updatedAt": "2026-11-03T14:00:00Z"
}
```
> **Regras de Escopo e Visibilidade dos Diários**:
> - **Diário do Mestre (`scope: "gm"`)**: `visibleTo: ["uid_do_mestre"]`. Nenhum player tem acesso.
> - **Diário Individual do Player (`scope: "player"`)**: `ownerId: "uid_player_X"`, `visibleTo: ["uid_do_mestre", "uid_player_X"]`, `editableBy: ["uid_do_mestre", "uid_player_X"]`. O Mestre enxerga e pode interagir com os diários de todos os jogadores, mas um jogador não vê o diário individual de outro jogador.
> - **Diário de Aventura em Grupo (`scope: "party"`)**: `visibleTo: ["ALL"]`, `editableBy: ["ALL"]`. Espaço colaborativo onde jogadores e Mestre constroem teorias e conectam pistas juntos.

#### G. Repositório Imutável de Mídia WebP (100% Spark, Sem Firebase Storage): `campaigns/{campaignId}/media/{mediaId}`
Como o Firebase Storage exige migração para o plano Blaze em projetos recentes, todas as imagens (mapas, tokens, avatares e ilustrações de diário) são convertidas no navegador para `WebP` de alta eficiência e salvas em documentos dedicados e imutáveis na coleção `media`.

```json
{
  "id": "media_map_taverna_01",
  "category": "scene",
  "mimeType": "image/webp",
  "widthPx": 2560,
  "heightPx": 1440,
  "sizeBytes": 342100,
  "dataUrl": "data:image/webp;base64,UklGRv...",
  "uploadedBy": "uid_do_mestre",
  "createdAt": "2026-11-03T12:00:00Z"
}
```
> **Por que desacoplar em `media/{mediaId}` em vez de gravar o Base64 direto na Cena/Ficha?**
> 1. **Tráfego Zero em Atualizações**: Quando o Mestre altera o grid da cena ou quando um player perde 2 de HP na ficha, o Firestore trafega apenas ~500 bytes (pois a cena/ficha guarda apenas a string `mediaId: "media_map_taverna_01"`).
> 2. **Cache Persistente Local (`IndexedDB`)**: Como cada `mediaId` é imutável, o `mediaService.js` salva o `dataUrl` no banco `IndexedDB` (`cpvtt_media_cache`) do navegador na primeira vez que é lido. Nas próximas sessões ou trocas de mapa, a imagem é carregada do disco local em **0ms e 0 leituras do Firestore**.

---

### 3.2. Firebase Realtime Database (Estado de Tempo Real)

Usado para evitar latência e custos de escrita por documento durante movimentação de tokens e revelação de mapa.

```json
{
  "vtt_realtime": {
    "main-table": {
      "tokens": {
        "scene_taverna": {
          "tok_01": {
            "id": "tok_01",
            "characterId": "char_01",
            "name": "Kaelen",
            "mediaId": "media_token_kaelen",
            "x": 320,
            "y": 192,
            "sizeInCells": 1,
            "rotation": 0,
            "visibleToPlayers": true,
            "controlledBy": ["uid_do_mestre", "uid_player_1"],
            "showBarsToPlayers": true,
            "updatedBy": "uid_player_1",
            "updatedAt": 1730646000000
          }
        }
      },
      "fog": {
        "scene_taverna": {
          "resetCounter": 1,
          "revealedAreas": {
            "area_01": { "type": "rect", "x": 0, "y": 0, "w": 640, "h": 480, "op": "reveal" },
            "area_02": { "type": "polygon", "points": [[640,120], [800,120], [800,300]], "op": "hide" }
          }
        }
      },
      "presence": {
        "uid_player_1": {
          "online": true,
          "displayName": "Arthur",
          "role": "player",
          "ping": { "x": 320, "y": 192, "color": "#42a5f5", "timestamp": 1730646000000 }
        }
      }
    }
  }
}
```

---

## 4. Pipeline de Imagens: Menor Armazenamento com Alta Nitidez (Sem Firebase Storage)

Para cumprir o requisito de **armazenamento mínimo sem deixar os mapas pixelados** e rodar **100% no plano gratuito Spark** sem depender do Firebase Storage, todas as imagens passam pelo módulo `src/engines/imageCompressor.js` no navegador e são gerenciadas pelo `src/services/mediaService.js`.

### 4.1. Presets de Compressão Automática (`WebP`)

| Tipo de Arquivo | Dimensão Máxima | Formato Saída | Qualidade Inicial | Teto Máximo Documento | Tamanho Médio Final |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Mapa / Cena (`scene`)** | `2560px` (2K / QHD no maior lado) | `image/webp` | `0.82` (adaptativa) | `<= 700 KB` (Base64) | **180 KB – 450 KB** |
| **Token (`token`)** | `256x256px` (Padrão) ou `384x384px` (Boss) | `image/webp` (alfa transparente) | `0.85` | `<= 120 KB` | **12 KB – 35 KB** |
| **Avatar / Card Diário (`avatar`)** | `512x512px` | `image/webp` | `0.80` | `<= 200 KB` | **25 KB – 50 KB** |

### 4.2. Regras Técnicas de Compressão Adaptativa e Cache Local (`IndexedDB`)
1. **Proporção e Nitidez Intactas**: O redimensionamento calcula o `aspectRatio` original com `ctx.imageSmoothingEnabled = true` e `ctx.imageSmoothingQuality = 'high'`, nunca esticando imagens menores.
2. **Garantia Automática de Limite do Firestore (`< 700 KB`)**:
   - O limite físico de um documento no Cloud Firestore é `1 MiB` (`1.048.576 bytes`).
   - Caso um mapa muito complexo em `2560px` com qualidade `0.82` gere uma string Base64 acima de `700 KB`, o `imageCompressor.js` reduz automaticamente a qualidade em passos suaves (`0.74` -> `0.66`) ou a dimensão máxima para `2048px`, garantindo que **qualquer imagem enviada caiba com folga num único documento sem perder nitidez**.
3. **Cache Imutável no Navegador via `IndexedDB` (`cpvtt_media_cache`)**:
   - Quando qualquer componente solicita um `mediaId`, o `mediaService.js` busca primeiro na store local `IndexedDB` do navegador.
   - Se encontrado localmente, retorna imediatamente sem tocar na rede. Se não encontrado, faz `getDoc` em `campaigns/{campaignId}/media/{mediaId}`, grava no `IndexedDB` e retorna o `dataUrl`.
4. **Limpeza Automática de Mídias Órfãs**:
   - Quando o Mestre substitui a imagem de um mapa ou exclui uma cena/personagem/nota, o `mediaService.deleteMedia(oldMediaId)` remove o documento correspondente de `campaigns/{campaignId}/media/{oldMediaId}`, liberando espaço imediatamente no banco.
5. **Suporte Opcional a URL Externa**:
   - Além do upload de arquivo local comprimido, o usuário também pode informar uma URL direta de imagem (`https://...`), que é renderizada diretamente sem ocupar armazenamento no Firestore.

---

## 5. Motor de Fórmulas e Rolagens (`formulaEngine` + `diceEngine`)

Como as regras específicas de atributos do sistema podem evoluir, o motor de cálculo é desacoplado e orientado a expressões dinâmicas.

### 5.1. Sintaxe Suportada nas Fórmulas
- **Variáveis de Atributos e Perícias (`@nome`)**:
  - Exemplo: `1d20 + @forca + @luta`
  - O parser busca primeiro em `character.attributes[chave]`, depois em `character.skills[chave].bonus` e `character.resources[chave].current`.
- **Notações de Dados**:
  - `NdX`: Rola `N` dados de `X` faces (ex: `1d20`, `3d6`, `2d8`).
  - `NdXkhY` (*Keep Highest*): Rola `N` dados e mantém os `Y` maiores (ex: `2d20kh1` para vantagem).
  - `NdXklY` (*Keep Lowest*): Rola `N` dados e mantém os `Y` menores (ex: `2d20kl1` para desvantagem).
- **Operadores Matemáticos**: `+`, `-`, `*`, `/`, `floor()`, `ceil()`, parênteses `()`.

### 5.2. Fluxo de Clique na Habilidade da Ficha (`rollService.js`)
Quando o jogador ou Mestre clica em uma habilidade/magia na ficha:
1. **Verificação de Custo**: Se a habilidade possui `cost` (ex: `2 MP`), verifica `character.resources.mp.current >= 2`.
2. **Desconto Automático**: Atualiza o recurso na ficha (`mp.current -= 2`).
3. **Resolução da Fórmula**: Converte `1d20 + @forca` em `1d20 + 4` com base no estado atual da ficha.
4. **Execução Criptograficamente Segura**: Usa `window.crypto.getRandomValues()` no `diceEngine.js` para garantir aleatoriedade justa e imprevisível.
5. **Envio ao Chat**: Grava o documento na coleção `messages` com `serverTimestamp()` e o detalhamento completo de cada dado rolado.

---

## 6. Sistema de Diários, Aliases, Kanban e Visão de Teia (`aliasEngine` + `journalService`)

### 6.1. Categorias de Cards Relacionáveis (`noteType`)
Tanto o Mestre quanto os Players e o Diário do Grupo utilizam a mesma estrutura base de cards, divididos em 5 tipos:
1. **`character` (Personagem)**: Pode ser vinculado opcionalmente a uma ficha real (`linkedCharacterSheetId`) ou existir apenas como card narrativo/NPC.
2. **`lore` (Lore / Conhecimento)**: Histórias do mundo, segredos, facções, profecias, pistas.
3. **`location` (Lugar)**: Cidades, tavernas, masmorras, regiões (podendo referenciar uma `sceneId`).
4. **`event` (Evento)**: Acontecimentos passados ou marcos ocorridos durante as sessões.
5. **`quest` (Missão)**: Objetivos que conectam lugares, personagens envolvidos, eventos e lore.

### 6.2. Fluxo de Clonar e Disponibilizar Cards (`journalService.js`)
- **Clonar Card (`cloneNoteToTarget`)**:
  - Cria um novo documento em `notes` copiando título, aliases, imagem, tipo e conteúdo, preenchendo `clonedFromNoteId` com o ID original.
  - **Casos suportados**:
    - **Mestre -> Player específico**: O Mestre envia/clona uma pista ou card de NPC para o diário privado de um jogador (`scope: "player"`, `ownerId: targetPlayerUid`).
    - **Mestre -> Diário do Grupo**: O Mestre revela um card para toda a mesa (`scope: "party"`, `visibleTo: ["ALL"]`).
    - **Player -> Mestre / Outro Player (via Mestre)**: O Mestre acessa o diário de qualquer jogador e pode clonar a anotação daquele jogador para o Diário do Mestre ou para o Diário de outro jogador.
    - **Player -> Diário do Grupo**: Qualquer jogador pode clicar em "Disponibilizar no Diário do Grupo" em um card pessoal seu, gerando um clone público no escopo `"party"` (ou movendo-o diretamente) para compartilhar teorias.

### 6.3. Motor de Aliases Anti-Spoiler (`aliasEngine.js`)
Cada card possui um `title` e uma lista de `aliases` (ex: Card `"Vilão da Campanha"` com aliases `["vilão", "monstro do mal", "carlos"]`).
1. **Indexação Normalizada**: Ao salvar um card, o sistema gera `aliasesNormalized` (texto em minúsculas, sem acentos e sem espaços duplicados, incluindo o próprio `title`).
2. **Isolamento Estrito de Permissão (Anti-Spoiler)**:
   - O `aliasEngine` opera **exclusivamente sobre a lista de cards carregados que o usuário atual tem permissão de leitura (`canSeeResource`)**.
   - Se o Mestre possui um card oculto com o alias `"carlos"`, e um jogador ainda não tem acesso a esse card, digitar `"carlos"` no diário do jogador **não** acusará vínculo com o card secreto do Mestre.
   - Assim que o jogador tiver um card acessível (seja no próprio diário dele ou no diário do grupo) contendo o alias `"carlos"`, o sistema passa a reconhecer o termo automaticamente.
3. **Detecção e Auto-Link no Texto**:
   - Enquanto o usuário digita (ou ao clicar em identificar menções), expressões que batem com `aliasesNormalized` de cards acessíveis são convertidas ou sugeridas como links internos `[[noteId|Texto Exibido]]` e seus IDs são salvos em `mentionedNoteIds`.
   - Além das menções no texto, o usuário pode vincular cards diretamente pelo seletor relacional (`relatedNoteIds`: ex. na Missão 1 selecionar Lugar 1, Personagens 1 a 5 e Lore 1).

### 6.4. Duas Visões de Interface: Kanban e Teia (Graph View)
1. **Visão Kanban / Cards Distribuídos (`KanbanView.jsx`)**:
   - Exibição em colunas por **Tipo de Card** (`Missões`, `Lugares`, `Personagens`, `Lore`, `Eventos`) ou por **Status** (`Descoberto`, `Em Investigação`, `Resolvido/Concluído`).
   - Busca instantânea por título, tag ou alias.
2. **Visão de Teia Interativa (`GraphWebView.jsx`)**:
   - Renderiza um grafo 2D interativo em Canvas/SVG onde:
     - **Pontos (Nós)**: São os cards visíveis no escopo selecionado, estilizados por `noteType` (cor e ícone próprios).
     - **Linhas (Arestas)**: São geradas automaticamente pela união de `relatedNoteIds` (vínculos diretos) + `mentionedNoteIds` (menções detectadas por alias no texto).
   - **Filtros Dinâmicos na Teia**:
     - Toggles rápidos por categoria (ex: desmarcar `Personagens` ou `Eventos` oculta imediatamente esses nós e suas linhas da teia).
     - Filtro por escopo (`Meu Diário`, `Diário do Grupo`, `Unificado` e, para o Mestre, `Diário do Player X`).
     - Filtro de profundidade (ao clicar em uma Missão, destacar apenas os Lugares, Personagens e Lores diretamente ligados a ela).

---

## 7. Diretrizes Globais de Aparência e Design System (Universo Club Penguin)

Toda a interface do **ClubPenguinVTT** traduz os elementos clássicos do Club Penguin (AS2/AS3, EPF, Card-Jitsu e Stampbook) para componentes modernos de VTT.

### 7.1. Mapeamento Visual por Módulo do VTT

| Módulo do VTT | Referência Visual no Club Penguin | Características de Interface |
| :--- | :--- | :--- |
| **HUD Principal, Dock Inferior e Chat Público** | **Barra Clássica Azul (AS2/AS3 Dock & Chatbar)** | Painéis em azul-oceano brilhante (`#02529C` -> `#013567`), bordas grossas azul-marinho (`#001B3A`), reflexo superior branco translúcido (*glossy bevel*), botões redondos saltitantes e mensagens em estilo *Speech Bubble* (`#FFFFFF` com contorno `#002244`). |
| **Fichas de Personagem (Janelas Flutuantes)** | **Player Card Clássico (Cartão de Pinguim)** | Card vertical/expandido com cantos bem arredondados (`20px`), moldura azul-celeste ou personalizada pela cor do pinguim, botão `"X"` circular no canto superior direito, retrato central e abas laterais. |
| **Habilidades, Magias e Cards Rolados no Chat** | **Cartas de Desafio Ninja (Card-Jitsu Power Cards)** | Cards estilo *trading card* com borda grossa colorida por categoria/elemento (Fogo `#E53935`, Água `#1E88E5`, Neve `#00ACC1`, Sombra `#5E35B1`, Neutro `#FDD835`), ícone elemental/tático no canto superior esquerdo e valor/fórmula em tipografia pesada estilo *Burbank*. |
| **Painel do Mestre, Rolagens Secretas e Visão de Teia** | **Visor Tático da EPF (Spy Phone & Sala de Comando)** | Chassi metálico grafite/titânio (`#1E2631` a `#2D3748`) com cantos chanfrados, tela escura de radar (`#07131E`) com *scanlines* horizontais sutis, linhas e nós luminosos em ciano elétrico (`#00F0FF`), verde terminal (`#00FF66`) e laranja de alerta (`#FF5722`). |
| **Diários (Kanban, Lore, Lugares e Missões)** | **Álbum de Selos (Stampbook) + Dossiês Confidenciais PSA/EPF** | Visão Kanban inspirada nas páginas de fichário/álbum com abas divisórias coloridas nas bordas e cards estilo dossiê/polaroid presos com clipes ou selos. |
| **Seletor de Mapas / Cenas** | **Mapa da Ilha do Club Penguin** | Modal com estética de mapa ilustrado sobre gelo/pergaminho, onde cada cena disponível aparece como um ponto/cartão interativo que cresce levemente no `:hover`. |

---

### 7.2. Paleta de Cores Oficial (CSS Custom Properties)

```css
:root {
  /* 1. Classic Club Penguin Ice & Ocean Blue (HUD, Modais Padrão, Chat) */
  --cp-blue-light: #3090F0;
  --cp-blue-primary: #02529C;
  --cp-blue-dark: #013567;
  --cp-blue-border: #001B3A;
  --cp-ice-bg: #E6F4FF;
  --cp-snow-white: #FFFFFF;
  --cp-cream-panel: #FFFDF5;

  /* 2. Destaques, Moedas, Selos e Botões de Ação */
  --cp-yellow-gold: #FFCC00;
  --cp-yellow-border: #B37700;
  --cp-orange-alert: #FF6B2B;
  --cp-green-Action: #38C172;

  /* 3. Estética Tática EPF (Mestre, Visão de Teia, Rolagens Ocultas, Fog) */
  --epf-metal-outer: #2A3441;
  --epf-metal-inner: #1A202C;
  --epf-screen-bg: #07131E;
  --epf-cyan-glow: #00F0FF;
  --epf-green-radar: #00FF66;
  --epf-amber-warn: #FFB300;
  --epf-red-classified: #FF2A55;

  /* 4. Elementos Card-Jitsu (Categorias de Habilidades e Tipos de Nota na Teia) */
  --cj-fire: #E53935;      /* Ataques / Eventos */
  --cj-water: #1E88E5;     /* Magias / Lugares */
  --cj-snow: #00BCD4;      /* Utilidade / Lore */
  --cj-gold: #FDD835;      /* Missões (Quests) */
  --cj-shadow: #6A1B9A;    /* Segredos / Personagens Ocultos */

  /* 5. Sombras e Brilhos Assinatura (Glossy Cartoon Bevel) */
  --cp-bevel-highlight: inset 0 2px 0 rgba(255, 255, 255, 0.45);
  --cp-card-shadow: 0 6px 0 #001B3A, 0 10px 20px rgba(0, 0, 0, 0.35);
  --cp-btn-shadow: inset 0 2px 1px rgba(255, 255, 255, 0.55), 0 3px 0 #001B3A;
  --epf-neon-shadow: 0 0 10px rgba(0, 240, 255, 0.35);
}
```

---

### 7.3. Tipografia Padrão

1. **Fonte Display / Títulos / Botões / Resultados de Dados (`--font-display`)**:
   - **Inspiração**: *Burbank Big Condensed Bold* (fonte oficial dos títulos, botões e números do Club Penguin).
   - **Implementação**: Suporte local a `Burbank Big Condensed Bold` + Google Fonts `'Fredoka'` / `'Baloo 2'` (`font-weight: 800`), sempre acompanhada de contorno escuro ou sombra dura (`text-shadow: 0 2px 0 #001B3A`).
2. **Fonte de Interface, Chat, Fichas e Diários (`--font-body`)**:
   - **Inspiração**: *CCFaceFront* / *Arial Rounded MT Bold* (usada nos balões de fala, jornais e descrições de missões PSA).
   - **Implementação**: Google Fonts `'Nunito'` ou `'Rubik'` (`font-weight: 600` e `700`), garantindo leitura confortável em textos longos de lore sem perder o aspecto arredondado e amigável.
3. **Fonte de Visores EPF, Fórmulas e Coordenadas (`--font-epf`)**:
   - **Inspiração**: Monitores da Sala de Comando da EPF e *Spy Phone*.
   - **Implementação**: Google Fonts `'Share Tech Mono'` ou `'JetBrains Mono'`, aplicada em contadores de grade, fórmulas (`1d20 + @forca`), carimbos `"CONFIDENCIAL EPF"` e filtros da Visão de Teia.

---

### 7.4. Anatomia dos Componentes Base (Regras de Estilo)

- **Botões Estilo Club Penguin (`cp-button`)**:
  - Bordas totalmente arredondadas (`border-radius: 999px` ou `12px`), contorno `2.5px solid var(--cp-blue-border)`, fundo em gradiente vertical (`linear-gradient(180deg, #3898FF 0%, #02529C 100%)`), reflexo interno no topo (`var(--cp-btn-shadow)`).
  - Micro-interação: no `:hover` aumenta levemente o brilho (`filter: brightness(1.1)`) e escala (`scale(1.03)`); no `:active` afunda `transform: translateY(2px)` reduzindo a sombra inferior.
- **Janelas e Modais (`cp-window` vs `epf-visor`)**:
  - **Janelas Gerais (`cp-window`)**: Cabeçalho azul com título centralizado em branco contornado, botão circular de fechar no topo direito, corpo interno em tom gelo claro (`#E6F4FF`) ou creme (`#FFFDF5`) para alto contraste de leitura.
  - **Janelas do Mestre / Teia de Investigação (`epf-visor`)**: Fundo escuro `#07131E` com efeito de linhas horizontais (`repeating-linear-gradient(0deg, rgba(0,240,255,0.03) 0px, rgba(0,240,255,0.03) 1px, transparent 1px, transparent 3px)`), bordas metálicas e indicadores luminosos de status.

---

## 8. Segurança e Filtros (Mestre vs. Players)

A filtragem acontece em **duas camadas**: nas queries da interface (para que a UI só busque o que é permitido) e nas **Security Rules do Firebase** (para que nenhum jogador mal-intencionado consiga inspecionar dados ocultos pelo console do navegador).

### 8.1. Diretrizes de Firestore Security Rules (`firestore.rules`)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    function isGM(campaignId) {
      return isSignedIn() &&
        get(/databases/$(database)/documents/campaigns/$(campaignId)).data.gmId == request.auth.uid;
    }

    function canSeeResource(campaignId, resourceData) {
      return isGM(campaignId) ||
        resourceData.visibleToPlayers == true ||
        ('visibleTo' in resourceData && (
          'ALL' in resourceData.visibleTo ||
          request.auth.uid in resourceData.visibleTo
        ));
    }

    match /campaigns/{campaignId} {
      allow read: if isSignedIn();
      allow write: if isGM(campaignId);

      // Mapas / Cenas
      match /scenes/{sceneId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow write: if isGM(campaignId);
      }

      // Fichas de Personagem
      match /characters/{characterId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow create: if isGM(campaignId);
        allow update: if isGM(campaignId) ||
          (isSignedIn() && request.auth.uid in resource.data.editableBy);
        allow delete: if isGM(campaignId);
      }

      // Compêndio (Habilidades, Magias, Itens)
      match /compendium/{itemId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow write: if isGM(campaignId);
      }

      // Chat e Rolagens (Imutáveis para players após enviadas)
      match /messages/{messageId} {
        allow read: if canSeeResource(campaignId, resource.data);
        allow create: if isSignedIn() && request.resource.data.senderId == request.auth.uid;
        allow update, delete: if isGM(campaignId);
      }

      // Diários e Cards de Investigação (Mestre, Players e Grupo)
      match /notes/{noteId} {
        allow read: if canSeeResource(campaignId, resource.data) ||
          (isSignedIn() && (
            resource.data.scope == 'party' ||
            resource.data.ownerId == request.auth.uid
          ));
        allow create: if isGM(campaignId) ||
          (isSignedIn() &&
            request.resource.data.ownerId == request.auth.uid &&
            request.resource.data.scope in ['player', 'party']);
        allow update: if isGM(campaignId) ||
          (isSignedIn() && (
            resource.data.scope == 'party' ||
            resource.data.ownerId == request.auth.uid ||
            request.auth.uid in resource.data.editableBy
          ));
        allow delete: if isGM(campaignId) ||
          (isSignedIn() && resource.data.ownerId == request.auth.uid);
      }

      // Repositório Imutável de Mídia WebP (Mapas, Tokens, Avatares, Notas)
      match /media/{mediaId} {
        allow read: if isSignedIn();
        allow create: if isSignedIn() && request.resource.data.sizeBytes < 800000;
        allow update, delete: if isGM(campaignId) ||
          (isSignedIn() && resource.data.uploadedBy == request.auth.uid);
      }
    }
  }
}
```

### 8.2. Diretrizes de Realtime Database Rules (`database.rules.json`)
- **Leitura de Tokens**: Liberada para jogadores autenticados na cena ativa; no entanto, tokens ocultos pelo Mestre (`visibleToPlayers: false`) ou são filtrados/removidos do nó público ou guardados no nó `gm_tokens/{sceneId}` até que o Mestre clique em "Revelar no Mapa".
- **Escrita de Posição de Token (`x`, `y`)**: Permitida apenas se `auth.uid == gmId` ou se `data.child('controlledBy').child(auth.uid).val() == true`.
- **Escrita de Névoa de Guerra (`fog`)**: Exclusiva do Mestre (`auth.uid == gmId`).

---

## 9. Roadmap de Desenvolvimento Modular

Para mantermos o código organizado e testável a cada etapa, seguiremos esta ordem de construção:

- **Fase 1 — Infraestrutura, Auth e Papel de Mestre/Player**:
  - Configurar Realtime Database no `src/services/firebase.js`.
  - Tela de Login (Google + Email/Senha) e criação automática/vínculo na campanha principal (`main-table`), definindo o Mestre e os Players.
- **Fase 2 — Compressor WebP, Cache IndexedDB e Gerenciador de Mapas (Cenas)**:
  - Implementar `imageCompressor.js` e `mediaService.js` (coleção `media` + cache local `IndexedDB`).
  - Painel do Mestre para subir mapas (convertendo automaticamente para WebP 2K), configurar Grid e alternar o mapa ativo para os jogadores.
- **Fase 3 — Tabuleiro Interativo (Canvas, Tokens e Névoa de Guerra)**:
  - Renderização do mapa com Zoom e Pan (arrastar câmera).
  - Camada de Tokens em tempo real via RTDB (arrastar com snap-to-grid ou movimento livre, ocultar/revelar token).
  - Camada de Névoa de Guerra (Fog of War) com pincel/retângulo para o Mestre revelar áreas aos jogadores.
- **Fase 4 — Fichas de Personagem e Compêndio do Sistema**:
  - Cadastro de habilidades/magias/itens no Compêndio pelo Mestre (com controle de visibilidade).
  - Interface de Ficha de Personagem (atributos, barras de vida/energia, seleção de itens do compêndio + criação customizada, permissões de quem vê/edita).
- **Fase 5 — Motor de Dados e Chat Integrado**:
  - Implementar `diceEngine.js` e `formulaEngine.js`.
  - Chat lateral com suporte a texto, cards de habilidades clicadas direto da ficha, desconto automático de custo e seletor de rolagem (Pública vs. Secreta para o Mestre).
- **Fase 6 — Sistema de Diários, Aliases, Kanban e Teia de Investigação**:
  - Implementar CRUD de cards relacionáveis (`character`, `lore`, `location`, `event`, `quest`) nos 3 escopos (`gm`, `player`, `party`) e motor de clonagem/compartilhamento (`journalService.js`).
  - Implementar `aliasEngine.js` com vinculação por aliases respeitando permissões anti-spoiler.
  - Construir a alternância entre **Visão Kanban** e **Visão de Teia (Grafo Interativo)** com filtros por categoria e conexões.

