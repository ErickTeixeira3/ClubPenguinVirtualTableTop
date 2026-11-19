import React from "react";
import { getAssetUrl } from "../../utils/stringUtils";

/**
 * Catálogo declarativo dos ícones do Club Penguin e RPG.
 * Resolução em runtime é estritamente por `id` do catálogo (sem heurísticas nem aliases).
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

export const CP_ICON_CATEGORIES = Object.freeze([
  Object.freeze({ id: "all", label: "Todos" }),
  Object.freeze({ id: "reactions", label: "Expressões" }),
  Object.freeze({ id: "combat", label: "Combate" }),
  Object.freeze({ id: "magic", label: "Magia" }),
  Object.freeze({ id: "food", label: "Comidas" }),
  Object.freeze({ id: "creatures", label: "Criaturas" }),
  Object.freeze({ id: "treasure", label: "Tesouros" }),
  Object.freeze({ id: "activities", label: "Atividades" }),
  Object.freeze({ id: "symbols", label: "Símbolos" })
]);

const CATALOG_DEFS = [
  // 1. EXPRESSÕES & REAÇÕES
  { id: "smile", label: "Sorriso Feliz", category: "reactions", asset: "smile.webp", alt: "Sorriso Feliz" },
  { id: "grin", label: "Sorriso Aberto", category: "reactions", asset: "grin.webp", alt: "Sorriso Aberto" },
  { id: "neutral", label: "Rosto Neutro", category: "reactions", asset: "neutral.webp", alt: "Rosto Neutro" },
  { id: "sad", label: "Rosto Triste", category: "reactions", asset: "sad.webp", alt: "Rosto Triste" },
  { id: "wink", label: "Piscadela", category: "reactions", asset: "wink.webp", alt: "Piscadela" },
  { id: "surprised", label: "Surpreso", category: "reactions", asset: "surprised.webp", alt: "Surpreso" },
  { id: "tongue", label: "Língua de Fora", category: "reactions", asset: "tongue.webp", alt: "Língua de Fora" },
  { id: "sick", label: "Enjoado", category: "reactions", asset: "sick.webp", alt: "Enjoado" },
  { id: "angry", label: "Bravo / Irritado", category: "reactions", asset: "angry.webp", alt: "Bravo" },
  { id: "worried", label: "Preocupado", category: "reactions", asset: "worried.webp", alt: "Preocupado" },
  { id: "skeptical", label: "Cético / Desconfiado", category: "reactions", asset: "skeptical.webp", alt: "Cético" },
  { id: "cool_sunglasses", label: "Óculos Escuros", category: "reactions", asset: "cool_sunglasses.webp", alt: "Óculos Escuros" },
  { id: "freezing", label: "Congelando de Frio", category: "reactions", asset: "freezing.webp", alt: "Congelando" },
  { id: "unibrow", label: "Monocelha Séria", category: "reactions", asset: "unibrow.webp", alt: "Monocelha" },
  { id: "nerd", label: "Nerd / Intelectual", category: "reactions", asset: "nerd.webp", alt: "Nerd" },
  { id: "cute_eyes", label: "Olhos Fofos e Brilhantes", category: "reactions", asset: "cute_eyes.webp", alt: "Olhos Fofos" },
  { id: "clown", label: "Palhaço Divertido", category: "reactions", asset: "clown.webp", alt: "Palhaço" },
  { id: "8bit_smile", label: "Sorriso Pixel 8-Bit", category: "reactions", asset: "8bit_smile.webp", alt: "Sorriso 8-Bit" },
  { id: "penguin_woohoo", label: "Pinguim Woohoo!", category: "reactions", asset: "penguin_woohoo.webp", alt: "Pinguim Woohoo" },

  // 2. COMBATE & EQUIPAMENTOS
  { id: "sword", label: "Espada de Cavaleiro CP", category: "combat", asset: "sword.png", alt: "Espada de Cavaleiro CP" },
  { id: "wooden_sword", label: "Espada de Madeira de Treino", category: "combat", asset: "wooden_sword.png", alt: "Espada de Madeira" },
  { id: "dagger", label: "Kunai Ninja Card-Jitsu", category: "combat", asset: "kunai.png", alt: "Kunai Ninja Card-Jitsu" },
  { id: "bow", label: "Arco e Flecha", category: "combat", asset: "bow.png", alt: "Arco e Flecha" },
  { id: "axe", label: "Machado Viking", category: "combat", asset: "axe.png", alt: "Machado Viking" },
  { id: "battle_axe", label: "Machado de Batalha Pesado", category: "combat", asset: "battle_axe.png", alt: "Machado de Batalha" },
  { id: "prehistoric_club", label: "Tacape Pré-histórico", category: "combat", asset: "prehistoric_club.webp", alt: "Tacape Pré-histórico" },
  { id: "prehistoric_hammer", label: "Martelo de Pedra", category: "combat", asset: "prehistoric_hammer.webp", alt: "Martelo de Pedra" },
  { id: "bomb", label: "Bomba Clássica do Club Penguin", category: "combat", asset: "bomb.png", alt: "Bomba Clássica" },
  { id: "snowball", label: "Bola de Neve do Club Penguin", category: "combat", asset: "snowball.png", alt: "Bola de Neve" },
  { id: "pow_explosion", label: "Impacto POW!", category: "combat", asset: "pow_explosion.webp", alt: "Impacto POW!" },
  { id: "shield", label: "Escudo de Madeira", category: "combat", asset: "shield.webp", alt: "Escudo de Madeira" },
  { id: "skate_helmet", label: "Capacete de Aventura", category: "combat", asset: "skate_helmet.webp", alt: "Capacete de Aventura" },
  { id: "ninja_headband", label: "Faixa Ninja Card-Jitsu", category: "combat", asset: "ninja_headband.png", alt: "Faixa Ninja" },
  { id: "crown", label: "Coroa do Rei", category: "combat", asset: "king_crown.png", alt: "Coroa do Rei" },
  { id: "queen_crown", label: "Coroa da Rainha", category: "combat", asset: "queen_crown.png", alt: "Coroa da Rainha" },
  { id: "princess_crown", label: "Tiara da Princesa", category: "combat", asset: "princess_crown.png", alt: "Tiara da Princesa" },
  { id: "cape", label: "Capa Épica de Aventureiro", category: "combat", asset: "cape.png", alt: "Capa de Aventureiro" },

  // 3. MAGIA & MISTICISMO
  { id: "wand", label: "Varinha Mágica", category: "magic", asset: "wand.webp", alt: "Varinha Mágica" },
  { id: "shooting_star", label: "Estrela Cadente", category: "magic", asset: "shooting_star.webp", alt: "Estrela Cadente" },
  { id: "prehistoric_clock", label: "Relógio do Tempo Ancestral", category: "magic", asset: "prehistoric_clock.webp", alt: "Relógio Ancestral" },
  { id: "potion_red", label: "Poção de Vida (Vermelha)", category: "magic", asset: "potion_red.png", alt: "Poção de Vida" },
  { id: "potion_blue", label: "Elixir de Mana (Azul)", category: "magic", asset: "potion_blue.png", alt: "Elixir de Mana" },
  { id: "potion_magic", label: "Poção Mágica Mística", category: "magic", asset: "potion_magic.png", alt: "Poção Mágica Mística" },
  { id: "firegem", label: "Gema do Fogo Ninja", category: "magic", asset: "firegem.png", alt: "Gema do Fogo" },
  { id: "watergem", label: "Gema da Água Ninja", category: "magic", asset: "watergem.png", alt: "Gema da Água" },
  { id: "snowgem", label: "Gema da Neve Ninja", category: "magic", asset: "snowgem.png", alt: "Gema da Neve" },

  // 4. COMIDAS & BEBIDAS
  { id: "pizza", label: "Fatia de Pizza", category: "food", asset: "pizza.webp", alt: "Fatia de Pizza" },
  { id: "cheese", label: "Pedaço de Queijo", category: "food", asset: "cheese.webp", alt: "Pedaço de Queijo" },
  { id: "meat", label: "Carne Assada", category: "food", asset: "meat.webp", alt: "Carne Assada" },
  { id: "soup", label: "Tigela de Sopa Quente", category: "food", asset: "soup.webp", alt: "Tigela de Sopa" },
  { id: "popcorn", label: "Saco de Pipoca", category: "food", asset: "popcorn.webp", alt: "Pipoca" },
  { id: "chopsticks", label: "Hashi / Comida Oriental", category: "food", asset: "chopsticks.webp", alt: "Hashi" },
  { id: "fortune_cookie", label: "Biscoito da Sorte", category: "food", asset: "fortune_cookie.webp", alt: "Biscoito da Sorte" },
  { id: "cake", label: "Fatia de Bolo", category: "food", asset: "cake.webp", alt: "Fatia de Bolo" },
  { id: "ice_cream", label: "Sorvete de Baunilha", category: "food", asset: "ice_cream.webp", alt: "Sorvete de Baunilha" },
  { id: "ice_cream_chocolate", label: "Sorvete de Chocolate", category: "food", asset: "ice_cream_chocolate.webp", alt: "Sorvete de Chocolate" },
  { id: "cookie", label: "Cookie com Gotas de Chocolate", category: "food", asset: "cookie.webp", alt: "Cookie" },
  { id: "candy", label: "Bala Doce", category: "food", asset: "candy.webp", alt: "Bala Doce" },
  { id: "apple", label: "Maçã Vermelha", category: "food", asset: "apple.webp", alt: "Maçã" },
  { id: "oberry", label: "Pufito / O'Berry Silvestre", category: "food", asset: "oberry.webp", alt: "Pufito" },
  { id: "prehistoric_oberry", label: "Pufito Pré-histórico", category: "food", asset: "prehistoric_oberry.webp", alt: "Pufito Pré-histórico" },
  { id: "coffee", label: "Caneca de Café", category: "food", asset: "coffee.webp", alt: "Café" },
  { id: "teapot", label: "Bule de Chá", category: "food", asset: "teapot.webp", alt: "Bule de Chá" },

  // 5. CRIATURAS, PUFFLES & MONSTROS
  { id: "fluffy_fish", label: "Peixe Fluffy Amarelo", category: "creatures", asset: "fluffy_fish.webp", alt: "Peixe Fluffy" },
  { id: "blue_puffle", label: "Puffle Azul", category: "creatures", asset: "blue_puffle.webp", alt: "Puffle Azul" },
  { id: "rainbow_puffle", label: "Puffle Arco-íris", category: "creatures", asset: "rainbow_puffle.webp", alt: "Puffle Arco-íris" },
  { id: "cat_yarn", label: "Novelo de Lã para Felinos", category: "creatures", asset: "cat_yarn.webp", alt: "Novelo de Lã" },
  { id: "dog_bone", label: "Osso de Cachorro", category: "creatures", asset: "dog_bone.webp", alt: "Osso de Cachorro" },
  { id: "paw_print", label: "Pegada Animal", category: "creatures", asset: "paw_print.webp", alt: "Pegada Animal" },
  { id: "ghost", label: "Fantasma", category: "creatures", asset: "ghost.webp", alt: "Fantasma" },
  { id: "bat", label: "Morcego das Sombras", category: "creatures", asset: "bat.webp", alt: "Morcego" },
  { id: "pumpkin", label: "Abóbora de Halloween", category: "creatures", asset: "pumpkin.webp", alt: "Abóbora" },
  { id: "ogre", label: "Criatura Ogro Verde", category: "creatures", asset: "ogre.webp", alt: "Ogro" },
  { id: "vampire", label: "Vampiro Noturno", category: "creatures", asset: "vampire.webp", alt: "Vampiro" },
  { id: "cyclops_monster", label: "Monstro Ciclope", category: "creatures", asset: "cyclops_monster.webp", alt: "Monstro Ciclope" },
  { id: "pirate", label: "Crânio Pirata", category: "creatures", asset: "pirate.webp", alt: "Crânio Pirata" },

  // 6. TESOUROS, ITENS & AVENTURA
  { id: "coin", label: "Moeda do Club Penguin", category: "treasure", asset: "coin.webp", alt: "Moeda do Club Penguin" },
  { id: "money_bag", label: "Saco de Moedas", category: "treasure", asset: "money_bag.webp", alt: "Saco de Moedas" },
  { id: "treasure_chest", label: "Baú de Tesouro", category: "treasure", asset: "treasure_chest.webp", alt: "Baú de Tesouro" },
  { id: "key", label: "Chave Secreta de Ouro", category: "treasure", asset: "key.png", alt: "Chave Secreta de Ouro" },
  { id: "pickaxe", label: "Picareta da Mina", category: "treasure", asset: "pickaxe.png", alt: "Picareta da Mina" },
  { id: "magnifier", label: "Lupa de Detetive", category: "treasure", asset: "magnifier.png", alt: "Lupa de Detetive" },
  { id: "ruby", label: "Rubi Carmesim Brilhante", category: "treasure", asset: "ruby.png", alt: "Rubi Carmesim Brilhante" },
  { id: "diamond_ring", label: "Anel de Diamante", category: "treasure", asset: "diamond_ring.png", alt: "Anel de Diamante" },
  { id: "campfire", label: "Fogueira de Acampamento", category: "treasure", asset: "campfire.webp", alt: "Fogueira" },
  { id: "camera", label: "Câmera Fotográfica", category: "treasure", asset: "camera.webp", alt: "Câmera" },
  { id: "gift", label: "Caixa de Presente", category: "treasure", asset: "gift.webp", alt: "Presente" },

  // 7. ATIVIDADES, ESPORTES & MÍDIA
  { id: "beach_ball", label: "Bola de Praia", category: "activities", asset: "beach_ball.webp", alt: "Bola de Praia" },
  { id: "surfboard", label: "Prancha de Surfe", category: "activities", asset: "surfboard.webp", alt: "Prancha de Surfe" },
  { id: "fishing_rod", label: "Vara de Pescaria", category: "activities", asset: "fishing_rod.png", alt: "Vara de Pescaria" },
  { id: "whistle", label: "Apito de Juiz", category: "activities", asset: "whistle.webp", alt: "Apito de Juiz" },
  { id: "red_card", label: "Cartão Vermelho", category: "activities", asset: "red_card.webp", alt: "Cartão Vermelho" },
  { id: "yellow_card", label: "Cartão Amarelo", category: "activities", asset: "yellow_card.webp", alt: "Cartão Amarelo" },
  { id: "foam_finger", label: "Mãozinha de Torcida", category: "activities", asset: "foam_finger.webp", alt: "Mãozinha de Torcida" },
  { id: "joystick", label: "Controle de Arcade", category: "activities", asset: "joystick.webp", alt: "Controle de Arcade" },
  { id: "movie_clapper", label: "Claquete de Cinema", category: "activities", asset: "movie_clapper.webp", alt: "Claquete de Cinema" },
  { id: "music_note", label: "Nota Musical", category: "activities", asset: "music_note.webp", alt: "Nota Musical" },
  { id: "music_notes", label: "Notas Musicais", category: "activities", asset: "music_notes.webp", alt: "Notas Musicais" },

  // 8. SÍMBOLOS, EPF & UTILIDADES
  { id: "spy_phone", label: "Telefone Secreto da PSA", category: "symbols", asset: "spy_phone.png", alt: "Telefone Secreto da PSA" },
  { id: "epf_badge", label: "Distintivo Secreto EPF", category: "symbols", asset: "epf_badge.webp", alt: "Distintivo EPF" },
  { id: "epf_sunglasses", label: "Óculos de Espião EPF", category: "symbols", asset: "epf_sunglasses.webp", alt: "Óculos EPF" },
  { id: "police_badge", label: "Distintivo Policial", category: "symbols", asset: "police_badge.webp", alt: "Distintivo Policial" },
  { id: "police_siren", label: "Giroflex Policial", category: "symbols", asset: "police_siren.webp", alt: "Giroflex Policial" },
  { id: "alert_beacon", label: "Sinalizador de Emergência", category: "symbols", asset: "alert_beacon.webp", alt: "Sinalizador de Emergência" },
  { id: "heart", label: "Coração Vermelho", category: "symbols", asset: "heart.webp", alt: "Coração Vermelho" },
  { id: "flower", label: "Flor Margarida", category: "symbols", asset: "flower.webp", alt: "Flor Margarida" },
  { id: "clover", label: "Trevo de Quatro Folhas", category: "symbols", asset: "clover.webp", alt: "Trevo da Sorte" },
  { id: "sun", label: "Sol Radiante", category: "symbols", asset: "sun.webp", alt: "Sol" },
  { id: "moon", label: "Lua Crescente", category: "symbols", asset: "moon.webp", alt: "Lua" },
  { id: "rainbow", label: "Arco-íris Colorido", category: "symbols", asset: "rainbow.webp", alt: "Arco-íris" },
  { id: "igloo", label: "Iglu de Gelo", category: "symbols", asset: "igloo.webp", alt: "Iglu" },
  { id: "lightbulb", label: "Lâmpada de Ideia do Gary", category: "symbols", asset: "lightbulb.webp", alt: "Lâmpada do Gary" },
  { id: "exclamation", label: "Ponto de Exclamação", category: "symbols", asset: "exclamation.webp", alt: "Ponto de Exclamação" },
  { id: "question", label: "Ponto de Interrogação", category: "symbols", asset: "question.webp", alt: "Ponto de Interrogação" }
];

export const CP_FLASH_ICONS = Object.freeze(
  CATALOG_DEFS.map((entry) =>
    Object.freeze({
      id: entry.id,
      label: entry.label,
      category: entry.category,
      asset: entry.asset,
      render: renderWebp(entry.asset, entry.alt)
    })
  )
);

const ICONS_BY_ID = new Map(CP_FLASH_ICONS.map((icon) => [icon.id, icon]));
const DEFAULT_ICON = ICONS_BY_ID.get("sword") || CP_FLASH_ICONS[0];

export function hasCpFlashIcon(iconId) {
  return typeof iconId === "string" && ICONS_BY_ID.has(iconId.trim());
}

/**
 * Renderiza estritamente por ID declarativo do catálogo. Sem aliases por nome/id nem adivinhação.
 */
export function renderCpFlashIcon(iconOrId, size = 36) {
  if (!iconOrId) {
    return DEFAULT_ICON.render(size);
  }

  if (typeof iconOrId === "object" && iconOrId !== null) {
    return renderCpFlashIcon(iconOrId.icon, size);
  }

  const key = String(iconOrId).trim();
  const target = ICONS_BY_ID.get(key) || DEFAULT_ICON;
  return target.render(size);
}
