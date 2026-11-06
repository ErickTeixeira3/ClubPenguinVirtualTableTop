import React from "react";

/**
 * Ícones oficiais do Club Penguin (WebP dos emoticons originais) combinados
 * com itens de RPG desenhados na estética clássica Flash dos anos 2000.
 *
 * Todas as duplicatas utilizam diretamente os arquivos WebP oficiais em public/emotes/.
 * Apenas os itens exclusivos de RPG sem correspondência direta permanecem em vetor SVG.
 */

const emoteUrl = (filename) => {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/emotes/${filename}`;
};

const renderWebp = (filename, label) => (size = 36) => (
  <img
    src={emoteUrl(filename)}
    alt={label}
    width={size}
    height={size}
    draggable={false}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      objectFit: "contain",
      display: "block",
      pointerEvents: "none",
      userSelect: "none"
    }}
  />
);

export const CP_FLASH_ICONS = [
  // ==========================================
  // 1. EXPRESSÕES & REAÇÕES (19 emotes)
  // ==========================================
  { id: "smile", label: "Sorriso Feliz", category: "reactions", render: renderWebp("smile.webp", "Sorriso Feliz") },
  { id: "grin", label: "Sorriso Aberto", category: "reactions", render: renderWebp("grin.webp", "Sorriso Aberto") },
  { id: "neutral", label: "Rosto Neutro", category: "reactions", render: renderWebp("neutral.webp", "Rosto Neutro") },
  { id: "sad", label: "Rosto Triste", category: "reactions", render: renderWebp("sad.webp", "Rosto Triste") },
  { id: "wink", label: "Piscadela", category: "reactions", render: renderWebp("wink.webp", "Piscadela") },
  { id: "surprised", label: "Surpreso", category: "reactions", render: renderWebp("surprised.webp", "Surpreso") },
  { id: "tongue", label: "Língua de Fora", category: "reactions", render: renderWebp("tongue.webp", "Língua de Fora") },
  { id: "sick", label: "Enjoado", category: "reactions", render: renderWebp("sick.webp", "Enjoado") },
  { id: "angry", label: "Bravo / Irritado", category: "reactions", render: renderWebp("angry.webp", "Bravo") },
  { id: "worried", label: "Preocupado", category: "reactions", render: renderWebp("worried.webp", "Preocupado") },
  { id: "skeptical", label: "Cético / Desconfiado", category: "reactions", render: renderWebp("skeptical.webp", "Cético") },
  { id: "cool_sunglasses", label: "Óculos Escuros", category: "reactions", render: renderWebp("cool_sunglasses.webp", "Óculos Escuros") },
  { id: "freezing", label: "Congelando de Frio", category: "reactions", render: renderWebp("freezing.webp", "Congelando") },
  { id: "unibrow", label: "Monocelha Séria", category: "reactions", render: renderWebp("unibrow.webp", "Monocelha") },
  { id: "nerd", label: "Nerd / Intelectual", category: "reactions", render: renderWebp("nerd.webp", "Nerd") },
  { id: "cute_eyes", label: "Olhos Fofos e Brilhantes", category: "reactions", render: renderWebp("cute_eyes.webp", "Olhos Fofos") },
  { id: "clown", label: "Palhaço Divertido", category: "reactions", render: renderWebp("clown.webp", "Palhaço") },
  { id: "8bit_smile", label: "Sorriso Pixel 8-Bit", category: "reactions", render: renderWebp("8bit_smile.webp", "Sorriso 8-Bit") },
  { id: "penguin_woohoo", label: "Pinguim Woohoo!", category: "reactions", render: renderWebp("penguin_woohoo.webp", "Pinguim Woohoo") },

  // ==========================================
  // 2. COMBATE & EQUIPAMENTOS (18 itens)
  // ==========================================
  { id: "sword", label: "Espada de Cavaleiro CP", category: "combat", render: renderWebp("sword.png", "Espada de Cavaleiro CP") },
  { id: "wooden_sword", label: "Espada de Madeira de Treino", category: "combat", render: renderWebp("wooden_sword.png", "Espada de Madeira") },
  { id: "dagger", label: "Kunai Ninja Card-Jitsu", category: "combat", render: renderWebp("kunai.png", "Kunai Ninja Card-Jitsu") },
  { id: "bow", label: "Arco e Flecha", category: "combat", render: renderWebp("bow.png", "Arco e Flecha") },
  { id: "axe", label: "Machado Viking", category: "combat", render: renderWebp("axe.png", "Machado Viking") },
  { id: "battle_axe", label: "Machado de Batalha Pesado", category: "combat", render: renderWebp("battle_axe.png", "Machado de Batalha") },
  { id: "prehistoric_club", label: "Tacape Pré-histórico", category: "combat", render: renderWebp("prehistoric_club.webp", "Tacape Pré-histórico") },
  { id: "prehistoric_hammer", label: "Martelo de Pedra", category: "combat", render: renderWebp("prehistoric_hammer.webp", "Martelo de Pedra") },
  { id: "bomb", label: "Bomba Clássica do Club Penguin", category: "combat", render: renderWebp("bomb.png", "Bomba Clássica") },
  { id: "snowball", label: "Bola de Neve do Club Penguin", category: "combat", render: renderWebp("snowball.png", "Bola de Neve") },
  { id: "pow_explosion", label: "Impacto POW!", category: "combat", render: renderWebp("pow_explosion.webp", "Impacto POW!") },
  { id: "shield", label: "Escudo de Madeira", category: "combat", render: renderWebp("shield.webp", "Escudo de Madeira") },
  { id: "skate_helmet", label: "Capacete de Aventura", category: "combat", render: renderWebp("skate_helmet.webp", "Capacete de Aventura") },
  { id: "ninja_headband", label: "Faixa Ninja Card-Jitsu", category: "combat", render: renderWebp("ninja_headband.png", "Faixa Ninja") },
  { id: "crown", label: "Coroa do Rei", category: "combat", render: renderWebp("king_crown.png", "Coroa do Rei") },
  { id: "queen_crown", label: "Coroa da Rainha", category: "combat", render: renderWebp("queen_crown.png", "Coroa da Rainha") },
  { id: "princess_crown", label: "Tiara da Princesa", category: "combat", render: renderWebp("princess_crown.png", "Tiara da Princesa") },
  { id: "cape", label: "Capa Épica de Aventureiro", category: "combat", render: renderWebp("cape.png", "Capa de Aventureiro") },

  // ==========================================
  // 3. MAGIA & MISTICISMO (9 itens)
  // ==========================================
  { id: "wand", label: "Varinha Mágica", category: "magic", render: renderWebp("wand.webp", "Varinha Mágica") },
  { id: "shooting_star", label: "Estrela Cadente", category: "magic", render: renderWebp("shooting_star.webp", "Estrela Cadente") },
  { id: "prehistoric_clock", label: "Relógio do Tempo Ancestral", category: "magic", render: renderWebp("prehistoric_clock.webp", "Relógio Ancestral") },
  { id: "potion_red", label: "Poção de Vida (Vermelha)", category: "magic", render: renderWebp("potion_red.png", "Poção de Vida") },
  { id: "potion_blue", label: "Elixir de Mana (Azul)", category: "magic", render: renderWebp("potion_blue.png", "Elixir de Mana") },
  { id: "potion_magic", label: "Poção Mágica Mística", category: "magic", render: renderWebp("potion_magic.png", "Poção Mágica Mística") },
  { id: "firegem", label: "Gema do Fogo Ninja", category: "magic", render: renderWebp("firegem.png", "Gema do Fogo") },
  { id: "watergem", label: "Gema da Água Ninja", category: "magic", render: renderWebp("watergem.png", "Gema da Água") },
  { id: "snowgem", label: "Gema da Neve Ninja", category: "magic", render: renderWebp("snowgem.png", "Gema da Neve") },

  // ==========================================
  // 4. COMIDAS & BEBIDAS (17 itens)
  // ==========================================
  { id: "pizza", label: "Fatia de Pizza", category: "food", render: renderWebp("pizza.webp", "Fatia de Pizza") },
  { id: "cheese", label: "Pedaço de Queijo", category: "food", render: renderWebp("cheese.webp", "Pedaço de Queijo") },
  { id: "meat", label: "Carne Assada", category: "food", render: renderWebp("meat.webp", "Carne Assada") },
  { id: "soup", label: "Tigela de Sopa Quente", category: "food", render: renderWebp("soup.webp", "Tigela de Sopa") },
  { id: "popcorn", label: "Saco de Pipoca", category: "food", render: renderWebp("popcorn.webp", "Pipoca") },
  { id: "chopsticks", label: "Hashi / Comida Oriental", category: "food", render: renderWebp("chopsticks.webp", "Hashi") },
  { id: "fortune_cookie", label: "Biscoito da Sorte", category: "food", render: renderWebp("fortune_cookie.webp", "Biscoito da Sorte") },
  { id: "cake", label: "Fatia de Bolo", category: "food", render: renderWebp("cake.webp", "Fatia de Bolo") },
  { id: "ice_cream", label: "Sorvete de Baunilha", category: "food", render: renderWebp("ice_cream.webp", "Sorvete de Baunilha") },
  { id: "ice_cream_chocolate", label: "Sorvete de Chocolate", category: "food", render: renderWebp("ice_cream_chocolate.webp", "Sorvete de Chocolate") },
  { id: "cookie", label: "Cookie com Gotas de Chocolate", category: "food", render: renderWebp("cookie.webp", "Cookie") },
  { id: "candy", label: "Bala Doce", category: "food", render: renderWebp("candy.webp", "Bala Doce") },
  { id: "apple", label: "Maçã Vermelha", category: "food", render: renderWebp("apple.webp", "Maçã") },
  { id: "oberry", label: "Pufito / O'Berry Silvestre", category: "food", render: renderWebp("oberry.webp", "Pufito") },
  { id: "prehistoric_oberry", label: "Pufito Pré-histórico", category: "food", render: renderWebp("prehistoric_oberry.webp", "Pufito Pré-histórico") },
  { id: "coffee", label: "Caneca de Café", category: "food", render: renderWebp("coffee.webp", "Café") },
  { id: "teapot", label: "Bule de Chá", category: "food", render: renderWebp("teapot.webp", "Bule de Chá") },

  // ==========================================
  // 5. CRIATURAS, PUFFLES & MONSTROS (13 itens)
  // ==========================================
  { id: "fluffy_fish", label: "Peixe Fluffy Amarelo", category: "creatures", render: renderWebp("fluffy_fish.webp", "Peixe Fluffy") },
  { id: "blue_puffle", label: "Puffle Azul", category: "creatures", render: renderWebp("blue_puffle.webp", "Puffle Azul") },
  { id: "rainbow_puffle", label: "Puffle Arco-íris", category: "creatures", render: renderWebp("rainbow_puffle.webp", "Puffle Arco-íris") },
  { id: "cat_yarn", label: "Novelo de Lã para Felinos", category: "creatures", render: renderWebp("cat_yarn.webp", "Novelo de Lã") },
  { id: "dog_bone", label: "Osso de Cachorro", category: "creatures", render: renderWebp("dog_bone.webp", "Osso de Cachorro") },
  { id: "paw_print", label: "Pegada Animal", category: "creatures", render: renderWebp("paw_print.webp", "Pegada Animal") },
  { id: "ghost", label: "Fantasma", category: "creatures", render: renderWebp("ghost.webp", "Fantasma") },
  { id: "bat", label: "Morcego das Sombras", category: "creatures", render: renderWebp("bat.webp", "Morcego") },
  { id: "pumpkin", label: "Abóbora de Halloween", category: "creatures", render: renderWebp("pumpkin.webp", "Abóbora") },
  { id: "ogre", label: "Criatura Ogro Verde", category: "creatures", render: renderWebp("ogre.webp", "Ogro") },
  { id: "vampire", label: "Vampiro Noturno", category: "creatures", render: renderWebp("vampire.webp", "Vampiro") },
  { id: "cyclops_monster", label: "Monstro Ciclope", category: "creatures", render: renderWebp("cyclops_monster.webp", "Monstro Ciclope") },
  { id: "pirate", label: "Crânio Pirata", category: "creatures", render: renderWebp("pirate.webp", "Crânio Pirata") },

  // ==========================================
  // 6. TESOUROS, ITENS & AVENTURA (11 itens)
  // ==========================================
  { id: "coin", label: "Moeda do Club Penguin", category: "treasure", render: renderWebp("coin.webp", "Moeda do Club Penguin") },
  { id: "money_bag", label: "Saco de Moedas", category: "treasure", render: renderWebp("money_bag.webp", "Saco de Moedas") },
  { id: "treasure_chest", label: "Baú de Tesouro", category: "treasure", render: renderWebp("treasure_chest.webp", "Baú de Tesouro") },
  { id: "key", label: "Chave Secreta de Ouro", category: "treasure", render: renderWebp("key.png", "Chave Secreta de Ouro") },
  { id: "pickaxe", label: "Picareta da Mina", category: "treasure", render: renderWebp("pickaxe.png", "Picareta da Mina") },
  { id: "magnifier", label: "Lupa de Detetive", category: "treasure", render: renderWebp("magnifier.png", "Lupa de Detetive") },
  { id: "ruby", label: "Rubi Carmesim Brilhante", category: "treasure", render: renderWebp("ruby.png", "Rubi Carmesim Brilhante") },
  { id: "diamond_ring", label: "Anel de Diamante", category: "treasure", render: renderWebp("diamond_ring.png", "Anel de Diamante") },
  { id: "campfire", label: "Fogueira de Acampamento", category: "treasure", render: renderWebp("campfire.webp", "Fogueira") },
  { id: "camera", label: "Câmera Fotográfica", category: "treasure", render: renderWebp("camera.webp", "Câmera") },
  { id: "gift", label: "Caixa de Presente", category: "treasure", render: renderWebp("gift.webp", "Presente") },

  // ==========================================
  // 7. ATIVIDADES, ESPORTES & MÍDIA (11 itens)
  // ==========================================
  { id: "beach_ball", label: "Bola de Praia", category: "activities", render: renderWebp("beach_ball.webp", "Bola de Praia") },
  { id: "surfboard", label: "Prancha de Surfe", category: "activities", render: renderWebp("surfboard.webp", "Prancha de Surfe") },
  { id: "fishing_rod", label: "Vara de Pescaria", category: "activities", render: renderWebp("fishing_rod.png", "Vara de Pescaria") },
  { id: "whistle", label: "Apito de Juiz", category: "activities", render: renderWebp("whistle.webp", "Apito de Juiz") },
  { id: "red_card", label: "Cartão Vermelho", category: "activities", render: renderWebp("red_card.webp", "Cartão Vermelho") },
  { id: "yellow_card", label: "Cartão Amarelo", category: "activities", render: renderWebp("yellow_card.webp", "Cartão Amarelo") },
  { id: "foam_finger", label: "Mãozinha de Torcida", category: "activities", render: renderWebp("foam_finger.webp", "Mãozinha de Torcida") },
  { id: "joystick", label: "Controle de Arcade", category: "activities", render: renderWebp("joystick.webp", "Controle de Arcade") },
  { id: "movie_clapper", label: "Claquete de Cinema", category: "activities", render: renderWebp("movie_clapper.webp", "Claquete de Cinema") },
  { id: "music_note", label: "Nota Musical", category: "activities", render: renderWebp("music_note.webp", "Nota Musical") },
  { id: "music_notes", label: "Notas Musicais", category: "activities", render: renderWebp("music_notes.webp", "Notas Musicais") },

  // ==========================================
  // 8. SÍMBOLOS, EPF & UTILIDADES (16 itens)
  // ==========================================
  { id: "spy_phone", label: "Telefone Secreto da PSA", category: "symbols", render: renderWebp("spy_phone.png", "Telefone Secreto da PSA") },
  { id: "epf_badge", label: "Distintivo Secreto EPF", category: "symbols", render: renderWebp("epf_badge.webp", "Distintivo EPF") },
  { id: "epf_sunglasses", label: "Óculos de Espião EPF", category: "symbols", render: renderWebp("epf_sunglasses.webp", "Óculos EPF") },
  { id: "police_badge", label: "Distintivo Policial", category: "symbols", render: renderWebp("police_badge.webp", "Distintivo Policial") },
  { id: "police_siren", label: "Giroflex Policial", category: "symbols", render: renderWebp("police_siren.webp", "Giroflex Policial") },
  { id: "alert_beacon", label: "Sinalizador de Emergência", category: "symbols", render: renderWebp("alert_beacon.webp", "Sinalizador de Emergência") },
  { id: "heart", label: "Coração Vermelho", category: "symbols", render: renderWebp("heart.webp", "Coração Vermelho") },
  { id: "flower", label: "Flor Margarida", category: "symbols", render: renderWebp("flower.webp", "Flor Margarida") },
  { id: "clover", label: "Trevo de Quatro Folhas", category: "symbols", render: renderWebp("clover.webp", "Trevo da Sorte") },
  { id: "sun", label: "Sol Radiante", category: "symbols", render: renderWebp("sun.webp", "Sol") },
  { id: "moon", label: "Lua Crescente", category: "symbols", render: renderWebp("moon.webp", "Lua") },
  { id: "rainbow", label: "Arco-íris Colorido", category: "symbols", render: renderWebp("rainbow.webp", "Arco-íris") },
  { id: "igloo", label: "Iglu de Gelo", category: "symbols", render: renderWebp("igloo.webp", "Iglu") },
  { id: "lightbulb", label: "Lâmpada de Ideia do Gary", category: "symbols", render: renderWebp("lightbulb.webp", "Lâmpada do Gary") },
  { id: "exclamation", label: "Ponto de Exclamação", category: "symbols", render: renderWebp("exclamation.webp", "Ponto de Exclamação") },
  { id: "question", label: "Ponto de Interrogação", category: "symbols", render: renderWebp("question.webp", "Ponto de Interrogação") }
];

/**
 * Tabela de retrocompatibilidade para mapear IDs antigos e emojis
 * diretamente para os novos identificadores oficiais.
 */
const LEGACY_ALIASES = {
  emote_grin: "grin",
  emote_smile: "smile",
  emote_neutral: "neutral",
  emote_sad: "sad",
  emote_wink: "wink",
  emote_surprised: "surprised",
  emote_tongue: "tongue",
  emote_sick: "sick",
  emote_angry: "angry",
  emote_worried: "worried",
  emote_skeptical: "skeptical",
  helmet: "skate_helmet",
  spyphone: "spy_phone",
  spy_phone: "spy_phone",
  coroa_do_rei: "crown",
  coroa_da_rainha: "queen_crown",
  coroa_da_princesa: "princess_crown",
  vara_de_pescar: "fishing_rod",
  anel: "diamond_ring",
  gem: "diamond_ring",
  potion_green: "potion_magic",
  potion_purple: "potion_magic",
  fish: "fluffy_fish",
  peixe: "fluffy_fish",
  inv_peixe: "fluffy_fish",
  "peixe fresco": "fluffy_fish",
  icecream: "ice_cream",
  tea: "teapot",
  // Emojis UTF-8 comuns
  "😀": "grin",
  "😃": "grin",
  "😄": "grin",
  "😁": "grin",
  "🙂": "smile",
  "😊": "smile",
  "😐": "neutral",
  "😑": "neutral",
  "🙁": "sad",
  "😢": "sad",
  "😭": "sad",
  "😉": "wink",
  "😜": "tongue",
  "😛": "tongue",
  "😮": "surprised",
  "😲": "surprised",
  "🤢": "sick",
  "🤮": "sick",
  "😡": "angry",
  "😠": "angry",
  "😟": "worried",
  "😨": "worried",
  "😏": "skeptical",
  "😒": "skeptical",
  "😎": "cool_sunglasses",
  "🕶️": "cool_sunglasses",
  "🥶": "freezing",
  "🤓": "nerd",
  "🥺": "cute_eyes",
  "🤡": "clown",
  "🎮": "joystick",
  "🕹️": "joystick",
  "⚔️": "sword",
  "🗡️": "dagger",
  "🏹": "bow",
  "🪓": "axe",
  "🔨": "prehistoric_hammer",
  "🪵": "prehistoric_club",
  "💥": "pow_explosion",
  "💣": "bomb",
  "❄️": "snowball",
  "🛡️": "shield",
  "🪖": "skate_helmet",
  "🥋": "ninja_headband",
  "💎": "diamond_ring",
  "💍": "diamond_ring",
  "👑": "crown",
  "👸": "princess_crown",
  "🎣": "fishing_rod",
  "🦸": "cape",
  "🪄": "wand",
  "⭐": "shooting_star",
  "✨": "shooting_star",
  "⏰": "prehistoric_clock",
  "🍷": "potion_red",
  "💧": "potion_blue",
  "🟣": "potion_magic",
  "🧪": "potion_magic",
  "🍕": "pizza",
  "🧀": "cheese",
  "🍖": "meat",
  "🥩": "meat",
  "🍲": "soup",
  "🥣": "soup",
  "🍿": "popcorn",
  "🥢": "chopsticks",
  "🥠": "fortune_cookie",
  "🎂": "cake",
  "🍰": "cake",
  "🍦": "ice_cream",
  "🍫": "ice_cream_chocolate",
  "🍪": "cookie",
  "🍬": "candy",
  "🍭": "candy",
  "🍎": "apple",
  "☕": "coffee",
  "🫖": "teapot",
  "🍵": "teapot",
  "🐟": "fluffy_fish",
  "🧶": "cat_yarn",
  "🦴": "dog_bone",
  "🐾": "paw_print",
  "👻": "ghost",
  "🦇": "bat",
  "🎃": "pumpkin",
  "🧟": "ogre",
  "🧛": "vampire",
  "👁️": "cyclops_monster",
  "💀": "pirate",
  "🪙": "coin",
  "💰": "money_bag",
  "🎁": "gift",
  "🏕️": "campfire",
  "🔥": "campfire",
  "📷": "camera",
  "🔑": "key",
  "⛏️": "pickaxe",
  "🔍": "magnifier",
  "⚽": "beach_ball",
  "🏄": "surfboard",
  "📢": "whistle",
  "📣": "foam_finger",
  "🎬": "movie_clapper",
  "🎵": "music_note",
  "🎶": "music_notes",
  "🚨": "police_siren",
  "🚔": "police_badge",
  "❤️": "heart",
  "🌼": "flower",
  "🌸": "flower",
  "🍀": "clover",
  "☘️": "clover",
  "☀️": "sun",
  "🌙": "moon",
  "🌈": "rainbow",
  "💡": "lightbulb",
  "❗": "exclamation",
  "❓": "question"
};

/**
 * Mapeia IDs ou emojis legados para o componente correspondente (WebP ou SVG).
 */
export function renderCpFlashIcon(iconOrId, size = 36) {
  if (!iconOrId) {
    return CP_FLASH_ICONS[0].render(size);
  }

  // Se receber um objeto (item ou rolagem completa)
  if (typeof iconOrId === "object" && iconOrId !== null) {
    const name = (iconOrId.name || iconOrId.title || "").toLowerCase();
    const id = (iconOrId.id || "").toLowerCase();
    const icon = (iconOrId.icon || "").toLowerCase();
    if (
      name.includes("peixe") ||
      name.includes("fish") ||
      name.includes("fluffy") ||
      id.includes("peixe")
    ) {
      if (!icon || icon === "meat" || icon === "carne" || icon === "fish") {
        const fluffy = CP_FLASH_ICONS.find((i) => i.id === "fluffy_fish");
        if (fluffy) return fluffy.render(size);
      }
    }
    return renderCpFlashIcon(iconOrId.icon || iconOrId.name || "sword", size);
  }

  // 1. Se for peixe / fluffy no texto ou ID
  const sRaw = String(iconOrId).trim();
  const s = sRaw.toLowerCase();
  if (
    s === "peixe" ||
    s === "peixe fresco" ||
    s === "inv_peixe" ||
    s === "fish" ||
    s.includes("peixe") ||
    s.includes("fluffy")
  ) {
    const fluffy = CP_FLASH_ICONS.find((i) => i.id === "fluffy_fish");
    if (fluffy) return fluffy.render(size);
  }

  // 2. Se já for um ID direto de ícone existente
  const foundById = CP_FLASH_ICONS.find((i) => i.id === iconOrId);
  if (foundById) {
    return foundById.render(size);
  }

  // 3. Tabela direta de retrocompatibilidade
  const aliasId = LEGACY_ALIASES[iconOrId] || LEGACY_ALIASES[s];
  if (aliasId) {
    const foundAlias = CP_FLASH_ICONS.find((i) => i.id === aliasId);
    if (foundAlias) {
      return foundAlias.render(size);
    }
  }

  // 4. Mapeamento heurístico por texto / palavra-chave
  let matchId = "sword";

  if (s.includes("peixe") || s.includes("fluffy") || s.includes("fish")) matchId = "fluffy_fish";
  else if (s.includes("grin") || s.includes("dente")) matchId = "grin";
  else if (s.includes("smile") || s.includes("feliz") || s.includes("sorriso")) matchId = "smile";
  else if (s.includes("neutro") || s.includes("straight")) matchId = "neutral";
  else if (s.includes("triste") || s.includes("sad") || s.includes("choro")) matchId = "sad";
  else if (s.includes("pisca") || s.includes("wink")) matchId = "wink";
  else if (s.includes("surpres") || s.includes("gasp") || s.includes("shock")) matchId = "surprised";
  else if (s.includes("lingua") || s.includes("língua") || s.includes("tongue")) matchId = "tongue";
  else if (s.includes("sick") || s.includes("enjoo") || s.includes("vomit")) matchId = "sick";
  else if (s.includes("angry") || s.includes("bravo") || s.includes("raiva") || s.includes("irritado")) matchId = "angry";
  else if (s.includes("worried") || s.includes("preocupado") || s.includes("medo")) matchId = "worried";
  else if (s.includes("skep") || s.includes("cético") || s.includes("desconfiado")) matchId = "skeptical";
  else if (s.includes("oculos") || s.includes("óculos") || s.includes("cool")) matchId = "cool_sunglasses";
  else if (s.includes("congel") || s.includes("frio") || s.includes("freez")) matchId = "freezing";
  else if (s.includes("mono") || s.includes("unibrow")) matchId = "unibrow";
  else if (s.includes("nerd") || s.includes("geek")) matchId = "nerd";
  else if (s.includes("fofo") || s.includes("cute")) matchId = "cute_eyes";
  else if (s.includes("palhac") || s.includes("palhaç") || s.includes("clown")) matchId = "clown";
  else if (s.includes("8bit") || s.includes("pixel")) matchId = "8bit_smile";
  else if (s.includes("woohoo") || s.includes("festa")) matchId = "penguin_woohoo";
  else if (s.includes("joystick") || s.includes("gamepad") || s.includes("arcade") || s.includes("jogo")) matchId = "joystick";
  else if (s.includes("pizza")) matchId = "pizza";
  else if (s.includes("queijo") || s.includes("cheese")) matchId = "cheese";
  else if (s.includes("carne") || s.includes("meat")) matchId = "meat";
  else if (s.includes("sopa") || s.includes("soup")) matchId = "soup";
  else if (s.includes("pipoca") || s.includes("popcorn")) matchId = "popcorn";
  else if (s.includes("hashi") || s.includes("chopstick")) matchId = "chopsticks";
  else if (s.includes("sorte") || s.includes("fortune")) matchId = "fortune_cookie";
  else if (s.includes("bolo") || s.includes("cake")) matchId = "cake";
  else if (s.includes("chocolate")) matchId = "ice_cream_chocolate";
  else if (s.includes("sorvete") || s.includes("icecream") || s.includes("ice_cream")) matchId = "ice_cream";
  else if (s.includes("cookie") || s.includes("biscoito")) matchId = "cookie";
  else if (s.includes("doce") || s.includes("bala") || s.includes("candy")) matchId = "candy";
  else if (s.includes("maca") || s.includes("maçã") || s.includes("apple")) matchId = "apple";
  else if (s.includes("oberry") || s.includes("pufito")) matchId = "oberry";
  else if (s.includes("cafe") || s.includes("café") || s.includes("caneca")) matchId = "coffee";
  else if (s.includes("cha") || s.includes("chá") || s.includes("bule") || s.includes("teapot") || s.includes("tea")) matchId = "teapot";
  else if (s.includes("arco-iris") || s.includes("arco-íris") || s.includes("rainbow")) matchId = "rainbow";
  else if (s.includes("puffle") || s.includes("pet")) matchId = "blue_puffle";
  else if (s.includes("gato") || s.includes("novelo") || s.includes("yarn")) matchId = "cat_yarn";
  else if (s.includes("osso") || s.includes("cachorro") || s.includes("bone")) matchId = "dog_bone";
  else if (s.includes("pata") || s.includes("pegada") || s.includes("paw")) matchId = "paw_print";
  else if (s.includes("fantasma") || s.includes("ghost")) matchId = "ghost";
  else if (s.includes("morcego") || s.includes("bat")) matchId = "bat";
  else if (s.includes("abobora") || s.includes("abóbora") || s.includes("pumpkin")) matchId = "pumpkin";
  else if (s.includes("ogro") || s.includes("ogre")) matchId = "ogre";
  else if (s.includes("vampiro") || s.includes("vampire")) matchId = "vampire";
  else if (s.includes("ciclope") || s.includes("cyclops")) matchId = "cyclops_monster";
  else if (s.includes("caveira") || s.includes("pirata") || s.includes("pirate")) matchId = "pirate";
  else if (s.includes("moeda") || s.includes("coin") || s.includes("ouro")) matchId = "coin";
  else if (s.includes("saco") || s.includes("money")) matchId = "money_bag";
  else if (s.includes("bau") || s.includes("baú") || s.includes("chest")) matchId = "treasure_chest";
  else if (s.includes("fogueira") || s.includes("fogo") || s.includes("campfire")) matchId = "campfire";
  else if (s.includes("camera") || s.includes("câmera") || s.includes("foto")) matchId = "camera";
  else if (s.includes("presente") || s.includes("gift")) matchId = "gift";
  else if (s.includes("bomba") || s.includes("bomb")) matchId = "bomb";
  else if (s.includes("neve") || s.includes("gelo") || s.includes("snowball")) matchId = "snowball";
  else if (s.includes("kunai") || s.includes("adaga") || s.includes("dagger")) matchId = "dagger";
  else if (s.includes("arco") || s.includes("flecha") || s.includes("bow")) matchId = "bow";
  else if (s.includes("machado") || s.includes("axe")) matchId = "axe";
  else if (s.includes("varinha") || s.includes("cajado") || s.includes("wand")) matchId = "wand";
  else if (s.includes("estrela") || s.includes("star")) matchId = "shooting_star";
  else if (s.includes("relogio") || s.includes("relógio") || s.includes("clock")) matchId = "prehistoric_clock";
  else if (s.includes("pesca") || s.includes("vara") || s.includes("fishing")) matchId = "fishing_rod";
  else if (s.includes("escudo") || s.includes("protecao") || s.includes("shield")) matchId = "shield";
  else if (s.includes("capacete") || s.includes("helmet")) matchId = "skate_helmet";
  else if (s.includes("faixa") || s.includes("ninja") || s.includes("headband")) matchId = "ninja_headband";
  else if (s.includes("rainha")) matchId = "queen_crown";
  else if (s.includes("princesa") || s.includes("tiara")) matchId = "princess_crown";
  else if (s.includes("coroa") || s.includes("crown") || s.includes("rei")) matchId = "crown";
  else if (s.includes("capa") || s.includes("cape") || s.includes("manto")) matchId = "cape";
  else if (s.includes("cura") || s.includes("vida") || s.includes("pot_red")) matchId = "potion_red";
  else if (s.includes("mana") || s.includes("energia") || s.includes("pot_blue")) matchId = "potion_blue";
  else if (s.includes("pocao") || s.includes("poção") || s.includes("alquimia") || s.includes("mistica") || s.includes("mística") || s.includes("arcano") || s.includes("pot_magic")) matchId = "potion_magic";
  else if (s.includes("fogo") && s.includes("gema")) matchId = "firegem";
  else if (s.includes("agua") || s.includes("água") && s.includes("gema")) matchId = "watergem";
  else if (s.includes("neve") && s.includes("gema")) matchId = "snowgem";
  else if (s.includes("picareta") || s.includes("mina") || s.includes("pickaxe")) matchId = "pickaxe";
  else if (s.includes("anel") || s.includes("ring")) matchId = "diamond_ring";
  else if (s.includes("spy") || s.includes("telefone") || s.includes("psa") || s.includes("phone")) matchId = "spy_phone";
  else if (s.includes("epf")) matchId = "epf_badge";
  else if (s.includes("policia") || s.includes("polícia") || s.includes("badge")) matchId = "police_badge";
  else if (s.includes("sirene") || s.includes("giroflex") || s.includes("siren")) matchId = "police_siren";
  else if (s.includes("alerta") || s.includes("beacon")) matchId = "alert_beacon";
  else if (s.includes("lampada") || s.includes("lâmpada") || s.includes("gary") || s.includes("ideia") || s.includes("lightbulb")) matchId = "lightbulb";
  else if (s.includes("chave") || s.includes("key")) matchId = "key";
  else if (s.includes("lupa") || s.includes("detetive") || s.includes("investig") || s.includes("magnifier")) matchId = "magnifier";
  else if (s.includes("diamante") || s.includes("esmeralda") || s.includes("gem")) matchId = "diamond_ring";
  else if (s.includes("rubi") || s.includes("ruby")) matchId = "ruby";
  else if (s.includes("praia") || s.includes("beach")) matchId = "beach_ball";
  else if (s.includes("surfe") || s.includes("surf")) matchId = "surfboard";
  else if (s.includes("apito") || s.includes("whistle")) matchId = "whistle";
  else if (s.includes("vermelho") && s.includes("cartao")) matchId = "red_card";
  else if (s.includes("amarelo") && s.includes("cartao")) matchId = "yellow_card";
  else if (s.includes("torcida") || s.includes("dedo") || s.includes("foam")) matchId = "foam_finger";
  else if (s.includes("filme") || s.includes("cinema") || s.includes("claquete")) matchId = "movie_clapper";
  else if (s.includes("musica") || s.includes("música") || s.includes("nota") || s.includes("som")) matchId = "music_note";
  else if (s.includes("coracao") || s.includes("coração") || s.includes("heart")) matchId = "heart";
  else if (s.includes("trevo") || s.includes("clover")) matchId = "clover";
  else if (s.includes("flor") || s.includes("flower")) matchId = "flower";
  else if (s.includes("sol") || s.includes("sun")) matchId = "sun";
  else if (s.includes("lua") || s.includes("moon")) matchId = "moon";
  else if (s.includes("iglu") || s.includes("igloo")) matchId = "igloo";
  else if (s.includes("exclamacao") || s.includes("exclamação") || s.includes("!")) matchId = "exclamation";
  else if (s.includes("interrogacao") || s.includes("interrogação") || s.includes("?")) matchId = "question";
  else if (s.includes("espada") || s.includes("sword") || s.includes("arma")) matchId = "sword";

  const target = CP_FLASH_ICONS.find((i) => i.id === matchId) || CP_FLASH_ICONS[0];
  return target.render(size);
}
