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
  // 2. COMBATE & EQUIPAMENTOS (14 itens)
  // ==========================================
  {
    id: "sword",
    label: "Espada de Cavaleiro CP",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="cp_blade_grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="40%" stopColor="#d1e0ea" />
            <stop offset="100%" stopColor="#8ba5b8" />
          </linearGradient>
          <linearGradient id="cp_gold_guard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe666" />
            <stop offset="100%" stopColor="#c98a00" />
          </linearGradient>
        </defs>
        <path
          d="M28 5L31 8L15 24L12 21L28 5Z"
          fill="url(#cp_blade_grad)"
          stroke="#1b2838"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M14 22L29 7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M8 20L17 29L14 31L6 22L8 20Z"
          fill="url(#cp_gold_guard)"
          stroke="#523800"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M10 27L5 32" stroke="#6b2100" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="4" cy="33" r="2.2" fill="#e53935" stroke="#520000" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: "dagger",
    label: "Kunai Ninja Card-Jitsu",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <g transform="rotate(45 18 18)">
          <circle cx="18" cy="30.5" r="3" fill="none" stroke="#1e293b" strokeWidth="2.4" />
          <rect x="16.2" y="21" width="3.6" height="7" rx="1" fill="#dc2626" stroke="#1e293b" strokeWidth="2" />
          <line x1="16.2" y1="24.5" x2="19.8" y2="24.5" stroke="#7f1d1d" strokeWidth="1.5" />
          <polygon
            points="18,3 25,16 19.8,21 16.2,21 11,16"
            fill="#94a3b8"
            stroke="#1e293b"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          <polygon points="18,4.8 18,20.2 16.5,20.2 12.2,15.8" fill="#e2e8f0" />
          <line x1="18" y1="4.5" x2="18" y2="20.5" stroke="#1e293b" strokeWidth="1.5" />
        </g>
      </svg>
    )
  },
  {
    id: "bow",
    label: "Arco e Flecha",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <g transform="rotate(45 18 18)">
          <polyline
            points="5,22 18,26.5 31,22"
            stroke="#cbd5e1"
            strokeWidth="1.8"
            strokeLinejoin="round"
            fill="none"
          />
          <path
            d="M5 22 C8 8.5 13 6.5 18 6.5 C23 6.5 28 8.5 31 22"
            stroke="#422006"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M5 22 C8 8.5 13 6.5 18 6.5 C23 6.5 28 8.5 31 22"
            stroke="#b45309"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
          <polygon points="18,24 21.5,28 21.5,31 18,28.5 14.5,31 14.5,28" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.3" strokeLinejoin="round" />
          <line x1="18" y1="28.5" x2="18" y2="6" stroke="#1e293b" strokeWidth="2.5" strokeLinecap="round" />
          <polygon points="18,1.5 22.5,8.5 18,7 13.5,8.5" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
      </svg>
    )
  },
  {
    id: "axe",
    label: "Machado Viking Duplo",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <g transform="rotate(45 18 18)">
          <rect x="16" y="9" width="4" height="24" rx="2" fill="#92400e" stroke="#3b1500" strokeWidth="2.2" />
          <polygon points="18,3.5 20.5,9 15.5,9" fill="#cbd5e1" stroke="#1e293b" strokeWidth="2" strokeLinejoin="round" />
          <path
            d="M16 9.5 L6 5.5 C3 10 3 16 6 20.5 L16 16.5 Z"
            fill="#cbd5e1"
            stroke="#1e293b"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path d="M7 7 C4.8 10.5 4.8 15.5 7 19" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          <path
            d="M20 9.5 L30 5.5 C33 10 33 16 30 20.5 L20 16.5 Z"
            fill="#94a3b8"
            stroke="#1e293b"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path d="M29 7 C31.2 10.5 31.2 15.5 29 19" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
          <rect x="15" y="9" width="6" height="8" rx="1.5" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <circle cx="18" cy="13" r="2.2" fill="#facc15" stroke="#713f12" strokeWidth="1.3" />
        </g>
      </svg>
    )
  },
  { id: "prehistoric_club", label: "Tacape Pré-histórico", category: "combat", render: renderWebp("prehistoric_club.webp", "Tacape Pré-histórico") },
  { id: "prehistoric_hammer", label: "Martelo de Pedra", category: "combat", render: renderWebp("prehistoric_hammer.webp", "Martelo de Pedra") },
  {
    id: "bomb",
    label: "Bomba Clássica do Club Penguin",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_bomb_grad" cx="35%" cy="35%" r="65%">
            <stop offset="0%" stopColor="#4b5563" />
            <stop offset="60%" stopColor="#1f2937" />
            <stop offset="100%" stopColor="#0b0f17" />
          </radialGradient>
        </defs>
        <path d="M22 13C25 10 27 10 29 7" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
        <polygon points="29,7 32,5 31,8 34,8 31,10 32,13 29,11 27,13 28,10 25,9" fill="#facc15" stroke="#ea580c" strokeWidth="1.2" />
        <circle cx="16" cy="21" r="12" fill="url(#cp_bomb_grad)" stroke="#0b0f17" strokeWidth="2.5" />
        <ellipse cx="12" cy="17" rx="3.5" ry="2" fill="#ffffff" opacity="0.6" transform="rotate(-30 12 17)" />
        <rect x="18" y="10" width="6" height="4" rx="1" fill="#4b5563" stroke="#0b0f17" strokeWidth="1.5" transform="rotate(30 20 12)" />
      </svg>
    )
  },
  {
    id: "snowball",
    label: "Bola de Neve do Club Penguin",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_snow_grad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#dff0fc" />
            <stop offset="100%" stopColor="#89c2ec" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14" fill="url(#cp_snow_grad)" stroke="#024379" strokeWidth="2.5" />
        <ellipse cx="13" cy="12" rx="4" ry="2.5" fill="#ffffff" opacity="0.9" transform="rotate(-25 13 12)" />
        <circle cx="23" cy="21" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="21" cy="25" r="2" fill="#69a8da" opacity="0.6" />
      </svg>
    )
  },
  { id: "pow_explosion", label: "Impacto POW!", category: "combat", render: renderWebp("pow_explosion.webp", "Impacto POW!") },
  { id: "shield", label: "Escudo de Madeira", category: "combat", render: renderWebp("shield.webp", "Escudo de Madeira") },
  { id: "skate_helmet", label: "Capacete de Aventura", category: "combat", render: renderWebp("skate_helmet.webp", "Capacete de Aventura") },
  {
    id: "ninja_headband",
    label: "Faixa Ninja Card-Jitsu",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path
          d="M4 17C12 15 24 15 32 17L30 22C22 20 14 20 6 22L4 17Z"
          fill="#1e293b"
          stroke="#020617"
          strokeWidth="2"
        />
        <path d="M30 21L34 29L31 31L28 22Z" fill="#1e293b" stroke="#020617" strokeWidth="1.5" />
        <circle cx="18" cy="18.5" r="4.5" fill="#e53935" stroke="#7f1d1d" strokeWidth="1.5" />
        <path d="M16 18.5H20M18 16.5V20.5" stroke="#ffffff" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: "crown",
    label: "Coroa Real de Ouro",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path
          d="M5 26L7 12L13 18L18 9L23 18L29 12L31 26H5Z"
          fill="#facc15"
          stroke="#713f12"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="9" r="2" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <circle cx="7" cy="12" r="1.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
        <circle cx="29" cy="12" r="1.5" fill="#3b82f6" stroke="#1d4ed8" strokeWidth="1" />
        <rect x="7" y="22" width="22" height="3" fill="#eab308" />
      </svg>
    )
  },
  {
    id: "cape",
    label: "Capa Épica de Aventureiro",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path
          d="M11 8L5 28C11 31 25 31 31 28L25 8H11Z"
          fill="#b91c1c"
          stroke="#450a0a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M11 8C14 13 22 13 25 8" fill="#ef4444" stroke="#450a0a" strokeWidth="1.5" />
        <circle cx="18" cy="9" r="2.5" fill="#facc15" stroke="#713f12" strokeWidth="1.5" />
      </svg>
    )
  },

  // ==========================================
  // 3. MAGIA & MISTICISMO (7 itens)
  // ==========================================
  { id: "wand", label: "Varinha Mágica", category: "magic", render: renderWebp("wand.webp", "Varinha Mágica") },
  { id: "shooting_star", label: "Estrela Cadente", category: "magic", render: renderWebp("shooting_star.webp", "Estrela Cadente") },
  { id: "prehistoric_clock", label: "Relógio do Tempo Ancestral", category: "magic", render: renderWebp("prehistoric_clock.webp", "Relógio Ancestral") },
  {
    id: "potion_red",
    label: "Poção de Vida (Vermelha)",
    category: "magic",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_pot_red" cx="40%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="65%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
        </defs>
        <rect x="15" y="5" width="6" height="4" rx="1" fill="#b45309" stroke="#451a03" strokeWidth="1.5" />
        <rect x="16" y="8" width="4" height="4" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="18" cy="22" r="11" fill="url(#cp_pot_red)" stroke="#1e293b" strokeWidth="2.5" />
        <circle cx="15" cy="18" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="21" cy="23" r="1.2" fill="#ffffff" opacity="0.6" />
        <ellipse cx="14" cy="24" rx="2" ry="1" fill="#ffffff" opacity="0.4" />
      </svg>
    )
  },
  {
    id: "potion_blue",
    label: "Elixir de Mana (Azul)",
    category: "magic",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_pot_blue" cx="40%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="65%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
        </defs>
        <rect x="15" y="5" width="6" height="4" rx="1" fill="#b45309" stroke="#451a03" strokeWidth="1.5" />
        <rect x="16" y="8" width="4" height="4" fill="#e2e8f0" stroke="#1e293b" strokeWidth="1.5" />
        <circle cx="18" cy="22" r="11" fill="url(#cp_pot_blue)" stroke="#1e293b" strokeWidth="2.5" />
        <circle cx="15" cy="18" r="1.5" fill="#ffffff" opacity="0.8" />
        <circle cx="20" cy="24" r="1.5" fill="#93c5fd" opacity="0.8" />
      </svg>
    )
  },
  {
    id: "potion_green",
    label: "Poção de Alquimia (Verde)",
    category: "magic",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <polygon points="18,12 28,30 8,30" fill="#22c55e" stroke="#14532d" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="16" y="5" width="4" height="7" fill="#e2e8f0" stroke="#14532d" strokeWidth="1.5" />
        <rect x="15" y="4" width="6" height="3" fill="#b45309" stroke="#451a03" strokeWidth="1" />
        <circle cx="16" cy="24" r="2" fill="#86efac" />
        <circle cx="21" cy="22" r="1.5" fill="#86efac" />
      </svg>
    )
  },
  {
    id: "potion_purple",
    label: "Frasco Mágico Arcano (Roxo)",
    category: "magic",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <polygon points="18,12 27,20 18,30 9,20" fill="#a855f7" stroke="#581c87" strokeWidth="2.5" strokeLinejoin="round" />
        <rect x="16" y="6" width="4" height="6" fill="#e2e8f0" stroke="#581c87" strokeWidth="1.5" />
        <rect x="15" y="4" width="6" height="3" fill="#b45309" stroke="#451a03" strokeWidth="1" />
        <circle cx="18" cy="20" r="2" fill="#f3e8ff" />
      </svg>
    )
  },

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
  {
    id: "key",
    label: "Chave Secreta de Ouro",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <circle cx="12" cy="12" r="7" fill="#facc15" stroke="#713f12" strokeWidth="2.5" />
        <circle cx="12" cy="12" r="3" fill="#ffffff" stroke="#713f12" strokeWidth="1.5" />
        <line x1="17" y1="17" x2="30" y2="30" stroke="#facc15" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="17" y1="17" x2="30" y2="30" stroke="#713f12" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="27" y1="27" x2="30" y2="24" stroke="#713f12" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="24" y1="24" x2="26" y2="22" stroke="#713f12" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "pickaxe",
    label: "Picareta da Mina",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <g transform="rotate(45 18 18)">
          <rect x="16" y="5" width="4" height="28" rx="2" fill="#92400e" stroke="#3b1500" strokeWidth="2.2" />
          <path
            d="M4 16.5 C7.5 8.5 13 6.5 18 6.5 C23 6.5 28.5 8.5 32 16.5 C28 12.5 23 11 18 11 C13 11 8 12.5 4 16.5 Z"
            fill="#64748b"
            stroke="#0f172a"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path
            d="M7.5 12 C11 8.5 14.5 7.8 18 7.8 C21.5 7.8 25 8.5 28.5 12"
            stroke="#cbd5e1"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <rect x="15" y="5.8" width="6" height="6.2" rx="1.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="2" />
        </g>
      </svg>
    )
  },
  {
    id: "magnifier",
    label: "Lupa de Detetive",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <circle cx="15" cy="15" r="9.5" fill="#e0f2fe" stroke="#334155" strokeWidth="2.5" />
        <ellipse cx="13" cy="12" rx="4" ry="2" fill="#ffffff" opacity="0.8" transform="rotate(-30 13 12)" />
        <line x1="22" y1="22" x2="31" y2="31" stroke="#78350f" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="22" y1="22" x2="31" y2="31" stroke="#3b1500" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "gem",
    label: "Esmeralda Mística",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="cp_gem_grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#e0f2fe" />
            <stop offset="40%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>
        <polygon
          points="10,8 26,8 32,16 18,31 4,16"
          fill="url(#cp_gem_grad)"
          stroke="#082f49"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <line x1="4" y1="16" x2="32" y2="16" stroke="#082f49" strokeWidth="1.5" />
        <line x1="10" y1="8" x2="18" y2="31" stroke="#082f49" strokeWidth="1.5" />
        <line x1="26" y1="8" x2="18" y2="31" stroke="#082f49" strokeWidth="1.5" />
        <polygon points="10,8 18,16 26,8" fill="#ffffff" opacity="0.5" />
      </svg>
    )
  },
  {
    id: "ruby",
    label: "Rubi Carmesim Brilhante",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <polygon
          points="12,7 24,7 30,15 18,31 6,15"
          fill="#dc2626"
          stroke="#450a0a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <line x1="6" y1="15" x2="30" y2="15" stroke="#450a0a" strokeWidth="1.5" />
        <polygon points="12,7 18,15 24,7" fill="#ef4444" />
        <line x1="12" y1="7" x2="18" y2="31" stroke="#450a0a" strokeWidth="1.5" />
        <line x1="24" y1="7" x2="18" y2="31" stroke="#450a0a" strokeWidth="1.5" />
        <polygon points="12,7 15,11 18,7" fill="#ffffff" opacity="0.6" />
      </svg>
    )
  },
  { id: "campfire", label: "Fogueira de Acampamento", category: "treasure", render: renderWebp("campfire.webp", "Fogueira") },
  { id: "camera", label: "Câmera Fotográfica", category: "treasure", render: renderWebp("camera.webp", "Câmera") },
  { id: "gift", label: "Caixa de Presente", category: "treasure", render: renderWebp("gift.webp", "Presente") },

  // ==========================================
  // 7. ATIVIDADES, ESPORTES & MÍDIA (10 itens)
  // ==========================================
  { id: "beach_ball", label: "Bola de Praia", category: "activities", render: renderWebp("beach_ball.webp", "Bola de Praia") },
  { id: "surfboard", label: "Prancha de Surfe", category: "activities", render: renderWebp("surfboard.webp", "Prancha de Surfe") },
  { id: "whistle", label: "Apito de Juiz", category: "activities", render: renderWebp("whistle.webp", "Apito de Juiz") },
  { id: "red_card", label: "Cartão Vermelho", category: "activities", render: renderWebp("red_card.webp", "Cartão Vermelho") },
  { id: "yellow_card", label: "Cartão Amarelo", category: "activities", render: renderWebp("yellow_card.webp", "Cartão Amarelo") },
  { id: "foam_finger", label: "Mãozinha de Torcida", category: "activities", render: renderWebp("foam_finger.webp", "Mãozinha de Torcida") },
  { id: "joystick", label: "Controle de Arcade", category: "activities", render: renderWebp("joystick.webp", "Controle de Arcade") },
  { id: "movie_clapper", label: "Claquete de Cinema", category: "activities", render: renderWebp("movie_clapper.webp", "Claquete de Cinema") },
  { id: "music_note", label: "Nota Musical", category: "activities", render: renderWebp("music_note.webp", "Nota Musical") },
  { id: "music_notes", label: "Notas Musicais", category: "activities", render: renderWebp("music_notes.webp", "Notas Musicais") },

  // ==========================================
  // 8. SÍMBOLOS, EPF & UTILIDADES (15 itens)
  // ==========================================
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
  spyphone: "epf_badge",
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
  "👑": "crown",
  "🦸": "cape",
  "🪄": "wand",
  "⭐": "shooting_star",
  "✨": "shooting_star",
  "⏰": "prehistoric_clock",
  "🍷": "potion_red",
  "🧪": "potion_green",
  "💧": "potion_blue",
  "🟣": "potion_purple",
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
  "🎣": "fluffy_fish",
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
  "💎": "gem",
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
  else if (s.includes("escudo") || s.includes("protecao") || s.includes("shield")) matchId = "shield";
  else if (s.includes("capacete") || s.includes("helmet")) matchId = "skate_helmet";
  else if (s.includes("faixa") || s.includes("ninja") || s.includes("headband")) matchId = "ninja_headband";
  else if (s.includes("coroa") || s.includes("crown")) matchId = "crown";
  else if (s.includes("capa") || s.includes("cape") || s.includes("manto")) matchId = "cape";
  else if (s.includes("cura") || s.includes("vida") || s.includes("pot_red")) matchId = "potion_red";
  else if (s.includes("mana") || s.includes("energia") || s.includes("pot_blue")) matchId = "potion_blue";
  else if (s.includes("pocao") || s.includes("poção") || s.includes("alquimia")) matchId = "potion_green";
  else if (s.includes("arcano") || s.includes("purp") || s.includes("roxa") || s.includes("elixir")) matchId = "potion_purple";
  else if (s.includes("picareta") || s.includes("mina") || s.includes("pickaxe")) matchId = "pickaxe";
  else if (s.includes("spy") || s.includes("phone") || s.includes("epf")) matchId = "epf_badge";
  else if (s.includes("policia") || s.includes("polícia") || s.includes("badge")) matchId = "police_badge";
  else if (s.includes("sirene") || s.includes("giroflex") || s.includes("siren")) matchId = "police_siren";
  else if (s.includes("alerta") || s.includes("beacon")) matchId = "alert_beacon";
  else if (s.includes("lampada") || s.includes("lâmpada") || s.includes("gary") || s.includes("ideia") || s.includes("lightbulb")) matchId = "lightbulb";
  else if (s.includes("chave") || s.includes("key")) matchId = "key";
  else if (s.includes("lupa") || s.includes("detetive") || s.includes("investig") || s.includes("magnifier")) matchId = "magnifier";
  else if (s.includes("diamante") || s.includes("esmeralda") || s.includes("gem")) matchId = "gem";
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
