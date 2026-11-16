import React from "react";
import { getAssetUrl } from "../../utils/stringUtils";

/**
 * Ícones oficiais do Club Penguin (WebP dos emoticons originais) combinados
 * com itens de RPG desenhados na estética clássica Flash dos anos 2000.
 *
 * Todas as duplicatas utilizam diretamente os arquivos WebP oficiais em public/emotes/.
 * Apenas os itens exclusivos de RPG sem correspondência direta permanecem em vetor SVG.
 */

const emoteUrl = (filename) => getAssetUrl(`emotes/${filename}`);

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
  { id: "smile", label: "Sorriso Feliz", category: "reactions", keywords: ["smile", "feliz", "sorriso"], render: renderWebp("smile.webp", "Sorriso Feliz") },
  { id: "grin", label: "Sorriso Aberto", category: "reactions", keywords: ["grin", "dente"], render: renderWebp("grin.webp", "Sorriso Aberto") },
  { id: "neutral", label: "Rosto Neutro", category: "reactions", keywords: ["neutro", "straight"], render: renderWebp("neutral.webp", "Rosto Neutro") },
  { id: "sad", label: "Rosto Triste", category: "reactions", keywords: ["triste", "sad", "choro"], render: renderWebp("sad.webp", "Rosto Triste") },
  { id: "wink", label: "Piscadela", category: "reactions", keywords: ["pisca", "wink"], render: renderWebp("wink.webp", "Piscadela") },
  { id: "surprised", label: "Surpreso", category: "reactions", keywords: ["surpres", "gasp", "shock"], render: renderWebp("surprised.webp", "Surpreso") },
  { id: "tongue", label: "Língua de Fora", category: "reactions", keywords: ["lingua", "língua", "tongue"], render: renderWebp("tongue.webp", "Língua de Fora") },
  { id: "sick", label: "Enjoado", category: "reactions", keywords: ["sick", "enjoo", "vomit"], render: renderWebp("sick.webp", "Enjoado") },
  { id: "angry", label: "Bravo / Irritado", category: "reactions", keywords: ["angry", "bravo", "raiva", "irritado"], render: renderWebp("angry.webp", "Bravo") },
  { id: "worried", label: "Preocupado", category: "reactions", keywords: ["worried", "preocupado", "medo"], render: renderWebp("worried.webp", "Preocupado") },
  { id: "skeptical", label: "Cético / Desconfiado", category: "reactions", keywords: ["skep", "cético", "desconfiado"], render: renderWebp("skeptical.webp", "Cético") },
  { id: "cool_sunglasses", label: "Óculos Escuros", category: "reactions", keywords: ["oculos", "óculos", "cool"], render: renderWebp("cool_sunglasses.webp", "Óculos Escuros") },
  { id: "freezing", label: "Congelando de Frio", category: "reactions", keywords: ["congel", "frio", "freez"], render: renderWebp("freezing.webp", "Congelando") },
  { id: "unibrow", label: "Monocelha Séria", category: "reactions", keywords: ["mono", "unibrow"], render: renderWebp("unibrow.webp", "Monocelha") },
  { id: "nerd", label: "Nerd / Intelectual", category: "reactions", keywords: ["nerd", "geek"], render: renderWebp("nerd.webp", "Nerd") },
  { id: "cute_eyes", label: "Olhos Fofos e Brilhantes", category: "reactions", keywords: ["fofo", "cute"], render: renderWebp("cute_eyes.webp", "Olhos Fofos") },
  { id: "clown", label: "Palhaço Divertido", category: "reactions", keywords: ["palhac", "palhaç", "clown"], render: renderWebp("clown.webp", "Palhaço") },
  { id: "8bit_smile", label: "Sorriso Pixel 8-Bit", category: "reactions", keywords: ["8bit", "pixel"], render: renderWebp("8bit_smile.webp", "Sorriso 8-Bit") },
  { id: "penguin_woohoo", label: "Pinguim Woohoo!", category: "reactions", keywords: ["woohoo", "festa"], render: renderWebp("penguin_woohoo.webp", "Pinguim Woohoo") },

  // ==========================================
  // 2. COMBATE & EQUIPAMENTOS (18 itens)
  // ==========================================
  { id: "sword", label: "Espada de Cavaleiro CP", category: "combat", keywords: ["espada", "sword", "arma"], matchPriority: -1, render: renderWebp("sword.png", "Espada de Cavaleiro CP") },
  { id: "wooden_sword", label: "Espada de Madeira de Treino", category: "combat", render: renderWebp("wooden_sword.png", "Espada de Madeira") },
  { id: "dagger", label: "Kunai Ninja Card-Jitsu", category: "combat", keywords: ["kunai", "adaga", "dagger"], render: renderWebp("kunai.png", "Kunai Ninja Card-Jitsu") },
  { id: "bow", label: "Arco e Flecha", category: "combat", keywords: ["arco", "flecha", "bow"], render: renderWebp("bow.png", "Arco e Flecha") },
  { id: "axe", label: "Machado Viking", category: "combat", keywords: ["machado", "axe"], matchPriority: 1, render: renderWebp("axe.png", "Machado Viking") },
  { id: "battle_axe", label: "Machado de Batalha Pesado", category: "combat", render: renderWebp("battle_axe.png", "Machado de Batalha") },
  { id: "prehistoric_club", label: "Tacape Pré-histórico", category: "combat", render: renderWebp("prehistoric_club.webp", "Tacape Pré-histórico") },
  { id: "prehistoric_hammer", label: "Martelo de Pedra", category: "combat", render: renderWebp("prehistoric_hammer.webp", "Martelo de Pedra") },
  { id: "bomb", label: "Bomba Clássica do Club Penguin", category: "combat", keywords: ["bomba", "bomb"], render: renderWebp("bomb.png", "Bomba Clássica") },
  { id: "snowball", label: "Bola de Neve do Club Penguin", category: "combat", keywords: ["neve", "gelo", "snowball"], render: renderWebp("snowball.png", "Bola de Neve") },
  { id: "pow_explosion", label: "Impacto POW!", category: "combat", render: renderWebp("pow_explosion.webp", "Impacto POW!") },
  { id: "shield", label: "Escudo de Madeira", category: "combat", keywords: ["escudo", "protecao", "shield"], render: renderWebp("shield.webp", "Escudo de Madeira") },
  { id: "skate_helmet", label: "Capacete de Aventura", category: "combat", keywords: ["capacete", "helmet"], render: renderWebp("skate_helmet.webp", "Capacete de Aventura") },
  { id: "ninja_headband", label: "Faixa Ninja Card-Jitsu", category: "combat", keywords: ["faixa", "ninja", "headband"], render: renderWebp("ninja_headband.png", "Faixa Ninja") },
  { id: "crown", label: "Coroa do Rei", category: "combat", keywords: ["coroa", "crown", "rei"], render: renderWebp("king_crown.png", "Coroa do Rei") },
  { id: "queen_crown", label: "Coroa da Rainha", category: "combat", keywords: ["rainha"], matchPriority: 2, render: renderWebp("queen_crown.png", "Coroa da Rainha") },
  { id: "princess_crown", label: "Tiara da Princesa", category: "combat", keywords: ["princesa", "tiara"], matchPriority: 2, render: renderWebp("princess_crown.png", "Tiara da Princesa") },
  { id: "cape", label: "Capa Épica de Aventureiro", category: "combat", keywords: ["capa", "cape", "manto"], render: renderWebp("cape.png", "Capa de Aventureiro") },

  // ==========================================
  // 3. MAGIA & MISTICISMO (9 itens)
  // ==========================================
  { id: "wand", label: "Varinha Mágica", category: "magic", keywords: ["varinha", "cajado", "wand"], render: renderWebp("wand.webp", "Varinha Mágica") },
  { id: "shooting_star", label: "Estrela Cadente", category: "magic", keywords: ["estrela", "star"], render: renderWebp("shooting_star.webp", "Estrela Cadente") },
  { id: "prehistoric_clock", label: "Relógio do Tempo Ancestral", category: "magic", keywords: ["relogio", "relógio", "clock"], render: renderWebp("prehistoric_clock.webp", "Relógio Ancestral") },
  { id: "potion_red", label: "Poção de Vida (Vermelha)", category: "magic", keywords: ["cura", "vida", "pot_red"], render: renderWebp("potion_red.png", "Poção de Vida") },
  { id: "potion_blue", label: "Elixir de Mana (Azul)", category: "magic", keywords: ["mana", "energia", "pot_blue"], render: renderWebp("potion_blue.png", "Elixir de Mana") },
  { id: "potion_magic", label: "Poção Mágica Mística", category: "magic", keywords: ["pocao", "poção", "alquimia", "mistica", "mística", "arcano", "pot_magic"], render: renderWebp("potion_magic.png", "Poção Mágica Mística") },
  { id: "firegem", label: "Gema do Fogo Ninja", category: "magic", keywords: [["fogo", "gema"]], matchPriority: 3, render: renderWebp("firegem.png", "Gema do Fogo") },
  { id: "watergem", label: "Gema da Água Ninja", category: "magic", keywords: ["agua", ["água", "gema"]], matchPriority: 3, render: renderWebp("watergem.png", "Gema da Água") },
  { id: "snowgem", label: "Gema da Neve Ninja", category: "magic", keywords: [["neve", "gema"]], matchPriority: 3, render: renderWebp("snowgem.png", "Gema da Neve") },

  // ==========================================
  // 4. COMIDAS & BEBIDAS (17 itens)
  // ==========================================
  { id: "pizza", label: "Fatia de Pizza", category: "food", keywords: ["pizza"], render: renderWebp("pizza.webp", "Fatia de Pizza") },
  { id: "cheese", label: "Pedaço de Queijo", category: "food", keywords: ["queijo", "cheese"], render: renderWebp("cheese.webp", "Pedaço de Queijo") },
  { id: "meat", label: "Carne Assada", category: "food", keywords: ["carne", "meat"], render: renderWebp("meat.webp", "Carne Assada") },
  { id: "soup", label: "Tigela de Sopa Quente", category: "food", keywords: ["sopa", "soup"], render: renderWebp("soup.webp", "Tigela de Sopa") },
  { id: "popcorn", label: "Saco de Pipoca", category: "food", keywords: ["pipoca", "popcorn"], render: renderWebp("popcorn.webp", "Pipoca") },
  { id: "chopsticks", label: "Hashi / Comida Oriental", category: "food", keywords: ["hashi", "chopstick"], render: renderWebp("chopsticks.webp", "Hashi") },
  { id: "fortune_cookie", label: "Biscoito da Sorte", category: "food", keywords: ["sorte", "fortune"], render: renderWebp("fortune_cookie.webp", "Biscoito da Sorte") },
  { id: "cake", label: "Fatia de Bolo", category: "food", keywords: ["bolo", "cake"], render: renderWebp("cake.webp", "Fatia de Bolo") },
  { id: "ice_cream", label: "Sorvete de Baunilha", category: "food", keywords: ["sorvete", "icecream", "ice_cream"], render: renderWebp("ice_cream.webp", "Sorvete de Baunilha") },
  { id: "ice_cream_chocolate", label: "Sorvete de Chocolate", category: "food", keywords: ["chocolate"], matchPriority: 2, render: renderWebp("ice_cream_chocolate.webp", "Sorvete de Chocolate") },
  { id: "cookie", label: "Cookie com Gotas de Chocolate", category: "food", keywords: ["cookie", "biscoito"], render: renderWebp("cookie.webp", "Cookie") },
  { id: "candy", label: "Bala Doce", category: "food", keywords: ["doce", "bala", "candy"], render: renderWebp("candy.webp", "Bala Doce") },
  { id: "apple", label: "Maçã Vermelha", category: "food", keywords: ["maca", "maçã", "apple"], render: renderWebp("apple.webp", "Maçã") },
  { id: "oberry", label: "Pufito / O'Berry Silvestre", category: "food", keywords: ["oberry", "pufito"], render: renderWebp("oberry.webp", "Pufito") },
  { id: "prehistoric_oberry", label: "Pufito Pré-histórico", category: "food", render: renderWebp("prehistoric_oberry.webp", "Pufito Pré-histórico") },
  { id: "coffee", label: "Caneca de Café", category: "food", keywords: ["cafe", "café", "caneca"], render: renderWebp("coffee.webp", "Café") },
  { id: "teapot", label: "Bule de Chá", category: "food", keywords: ["cha", "chá", "bule", "teapot", "tea"], render: renderWebp("teapot.webp", "Bule de Chá") },

  // ==========================================
  // 5. CRIATURAS, PUFFLES & MONSTROS (13 itens)
  // ==========================================
  { id: "fluffy_fish", label: "Peixe Fluffy Amarelo", category: "creatures", keywords: ["peixe", "fluffy", "fish"], matchPriority: 2, render: renderWebp("fluffy_fish.webp", "Peixe Fluffy") },
  { id: "blue_puffle", label: "Puffle Azul", category: "creatures", keywords: ["puffle", "pet"], render: renderWebp("blue_puffle.webp", "Puffle Azul") },
  { id: "rainbow_puffle", label: "Puffle Arco-íris", category: "creatures", render: renderWebp("rainbow_puffle.webp", "Puffle Arco-íris") },
  { id: "cat_yarn", label: "Novelo de Lã para Felinos", category: "creatures", keywords: ["gato", "novelo", "yarn"], render: renderWebp("cat_yarn.webp", "Novelo de Lã") },
  { id: "dog_bone", label: "Osso de Cachorro", category: "creatures", keywords: ["osso", "cachorro", "bone"], render: renderWebp("dog_bone.webp", "Osso de Cachorro") },
  { id: "paw_print", label: "Pegada Animal", category: "creatures", keywords: ["pata", "pegada", "paw"], render: renderWebp("paw_print.webp", "Pegada Animal") },
  { id: "ghost", label: "Fantasma", category: "creatures", keywords: ["fantasma", "ghost"], render: renderWebp("ghost.webp", "Fantasma") },
  { id: "bat", label: "Morcego das Sombras", category: "creatures", keywords: ["morcego", "bat"], render: renderWebp("bat.webp", "Morcego") },
  { id: "pumpkin", label: "Abóbora de Halloween", category: "creatures", keywords: ["abobora", "abóbora", "pumpkin"], render: renderWebp("pumpkin.webp", "Abóbora") },
  { id: "ogre", label: "Criatura Ogro Verde", category: "creatures", keywords: ["ogro", "ogre"], render: renderWebp("ogre.webp", "Ogro") },
  { id: "vampire", label: "Vampiro Noturno", category: "creatures", keywords: ["vampiro", "vampire"], render: renderWebp("vampire.webp", "Vampiro") },
  { id: "cyclops_monster", label: "Monstro Ciclope", category: "creatures", keywords: ["ciclope", "cyclops"], render: renderWebp("cyclops_monster.webp", "Monstro Ciclope") },
  { id: "pirate", label: "Crânio Pirata", category: "creatures", keywords: ["caveira", "pirata", "pirate"], render: renderWebp("pirate.webp", "Crânio Pirata") },

  // ==========================================
  // 6. TESOUROS, ITENS & AVENTURA (11 itens)
  // ==========================================
  { id: "coin", label: "Moeda do Club Penguin", category: "treasure", keywords: ["moeda", "coin", "ouro"], render: renderWebp("coin.webp", "Moeda do Club Penguin") },
  { id: "money_bag", label: "Saco de Moedas", category: "treasure", keywords: ["saco", "money"], render: renderWebp("money_bag.webp", "Saco de Moedas") },
  { id: "treasure_chest", label: "Baú de Tesouro", category: "treasure", keywords: ["bau", "baú", "chest"], render: renderWebp("treasure_chest.webp", "Baú de Tesouro") },
  { id: "key", label: "Chave Secreta de Ouro", category: "treasure", keywords: ["chave", "key"], render: renderWebp("key.png", "Chave Secreta de Ouro") },
  { id: "pickaxe", label: "Picareta da Mina", category: "treasure", keywords: ["picareta", "mina", "pickaxe"], render: renderWebp("pickaxe.png", "Picareta da Mina") },
  { id: "magnifier", label: "Lupa de Detetive", category: "treasure", keywords: ["lupa", "detetive", "investig", "magnifier"], render: renderWebp("magnifier.png", "Lupa de Detetive") },
  { id: "ruby", label: "Rubi Carmesim Brilhante", category: "treasure", keywords: ["rubi", "ruby"], render: renderWebp("ruby.png", "Rubi Carmesim Brilhante") },
  { id: "diamond_ring", label: "Anel de Diamante", category: "treasure", keywords: ["anel", "ring", "diamante", "esmeralda", "gem"], render: renderWebp("diamond_ring.png", "Anel de Diamante") },
  { id: "campfire", label: "Fogueira de Acampamento", category: "treasure", keywords: ["fogueira", "fogo", "campfire"], render: renderWebp("campfire.webp", "Fogueira") },
  { id: "camera", label: "Câmera Fotográfica", category: "treasure", keywords: ["camera", "câmera", "foto"], render: renderWebp("camera.webp", "Câmera") },
  { id: "gift", label: "Caixa de Presente", category: "treasure", keywords: ["presente", "gift"], render: renderWebp("gift.webp", "Presente") },

  // ==========================================
  // 7. ATIVIDADES, ESPORTES & MÍDIA (11 itens)
  // ==========================================
  { id: "beach_ball", label: "Bola de Praia", category: "activities", keywords: ["praia", "beach"], render: renderWebp("beach_ball.webp", "Bola de Praia") },
  { id: "surfboard", label: "Prancha de Surfe", category: "activities", keywords: ["surfe", "surf"], render: renderWebp("surfboard.webp", "Prancha de Surfe") },
  { id: "fishing_rod", label: "Vara de Pescaria", category: "activities", keywords: ["pesca", "vara", "fishing"], render: renderWebp("fishing_rod.png", "Vara de Pescaria") },
  { id: "whistle", label: "Apito de Juiz", category: "activities", keywords: ["apito", "whistle"], render: renderWebp("whistle.webp", "Apito de Juiz") },
  { id: "red_card", label: "Cartão Vermelho", category: "activities", keywords: [["vermelho", "cartao"]], matchPriority: 3, render: renderWebp("red_card.webp", "Cartão Vermelho") },
  { id: "yellow_card", label: "Cartão Amarelo", category: "activities", keywords: [["amarelo", "cartao"]], matchPriority: 3, render: renderWebp("yellow_card.webp", "Cartão Amarelo") },
  { id: "foam_finger", label: "Mãozinha de Torcida", category: "activities", keywords: ["torcida", "dedo", "foam"], render: renderWebp("foam_finger.webp", "Mãozinha de Torcida") },
  { id: "joystick", label: "Controle de Arcade", category: "activities", keywords: ["joystick", "gamepad", "arcade", "jogo"], render: renderWebp("joystick.webp", "Controle de Arcade") },
  { id: "movie_clapper", label: "Claquete de Cinema", category: "activities", keywords: ["filme", "cinema", "claquete"], render: renderWebp("movie_clapper.webp", "Claquete de Cinema") },
  { id: "music_note", label: "Nota Musical", category: "activities", keywords: ["musica", "música", "nota", "som"], render: renderWebp("music_note.webp", "Nota Musical") },
  { id: "music_notes", label: "Notas Musicais", category: "activities", render: renderWebp("music_notes.webp", "Notas Musicais") },

  // ==========================================
  // 8. SÍMBOLOS, EPF & UTILIDADES (16 itens)
  // ==========================================
  { id: "spy_phone", label: "Telefone Secreto da PSA", category: "symbols", keywords: ["spy", "telefone", "psa", "phone"], render: renderWebp("spy_phone.png", "Telefone Secreto da PSA") },
  { id: "epf_badge", label: "Distintivo Secreto EPF", category: "symbols", keywords: ["epf"], render: renderWebp("epf_badge.webp", "Distintivo EPF") },
  { id: "epf_sunglasses", label: "Óculos de Espião EPF", category: "symbols", render: renderWebp("epf_sunglasses.webp", "Óculos EPF") },
  { id: "police_badge", label: "Distintivo Policial", category: "symbols", keywords: ["policia", "polícia", "badge"], render: renderWebp("police_badge.webp", "Distintivo Policial") },
  { id: "police_siren", label: "Giroflex Policial", category: "symbols", keywords: ["sirene", "giroflex", "siren"], render: renderWebp("police_siren.webp", "Giroflex Policial") },
  { id: "alert_beacon", label: "Sinalizador de Emergência", category: "symbols", keywords: ["alerta", "beacon"], render: renderWebp("alert_beacon.webp", "Sinalizador de Emergência") },
  { id: "heart", label: "Coração Vermelho", category: "symbols", keywords: ["coracao", "coração", "heart"], render: renderWebp("heart.webp", "Coração Vermelho") },
  { id: "flower", label: "Flor Margarida", category: "symbols", keywords: ["flor", "flower"], render: renderWebp("flower.webp", "Flor Margarida") },
  { id: "clover", label: "Trevo de Quatro Folhas", category: "symbols", keywords: ["trevo", "clover"], render: renderWebp("clover.webp", "Trevo da Sorte") },
  { id: "sun", label: "Sol Radiante", category: "symbols", keywords: ["sol", "sun"], render: renderWebp("sun.webp", "Sol") },
  { id: "moon", label: "Lua Crescente", category: "symbols", keywords: ["lua", "moon"], render: renderWebp("moon.webp", "Lua") },
  { id: "rainbow", label: "Arco-íris Colorido", category: "symbols", keywords: ["arco-iris", "arco-íris", "rainbow"], matchPriority: 2, render: renderWebp("rainbow.webp", "Arco-íris") },
  { id: "igloo", label: "Iglu de Gelo", category: "symbols", keywords: ["iglu", "igloo"], render: renderWebp("igloo.webp", "Iglu") },
  { id: "lightbulb", label: "Lâmpada de Ideia do Gary", category: "symbols", keywords: ["lampada", "lâmpada", "gary", "ideia", "lightbulb"], render: renderWebp("lightbulb.webp", "Lâmpada do Gary") },
  { id: "exclamation", label: "Ponto de Exclamação", category: "symbols", keywords: ["exclamacao", "exclamação", "!"], render: renderWebp("exclamation.webp", "Ponto de Exclamação") },
  { id: "question", label: "Ponto de Interrogação", category: "symbols", keywords: ["interrogacao", "interrogação", "?"], render: renderWebp("question.webp", "Ponto de Interrogação") }
];

const SORTED_ICON_KEYWORD_ENTRIES = [...CP_FLASH_ICONS]
  .filter((icon) => Array.isArray(icon.keywords) && icon.keywords.length > 0)
  .sort((a, b) => (b.matchPriority || 0) - (a.matchPriority || 0));

function matchesDeclarativeKeyword(text, rule) {
  if (Array.isArray(rule)) {
    return rule.every((part) => text.includes(part));
  }
  return text.includes(rule);
}

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
    return renderCpFlashIcon(
      iconOrId.icon || iconOrId.name || iconOrId.title || "sword",
      size
    );
  }

  const sRaw = String(iconOrId).trim();
  const s = sRaw.toLowerCase();

  // 1. Se já for um ID direto de ícone existente
  const foundById = CP_FLASH_ICONS.find((i) => i.id === iconOrId);
  if (foundById) {
    return foundById.render(size);
  }

  // 2. Tabela direta de retrocompatibilidade
  const aliasId = LEGACY_ALIASES[iconOrId] || LEGACY_ALIASES[s];
  if (aliasId) {
    const foundAlias = CP_FLASH_ICONS.find((i) => i.id === aliasId);
    if (foundAlias) {
      return foundAlias.render(size);
    }
  }

  // 3. Mapeamento declarativo por palavras-chave nos metadados do catálogo (OCP)
  let matchId = "sword";
  for (const entry of SORTED_ICON_KEYWORD_ENTRIES) {
    if (entry.keywords.some((kw) => matchesDeclarativeKeyword(s, kw))) {
      matchId = entry.id;
      break;
    }
  }

  const target = CP_FLASH_ICONS.find((i) => i.id === matchId) || CP_FLASH_ICONS[0];
  return target.render(size);
}
