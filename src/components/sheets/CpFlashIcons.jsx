import React from "react";

/**
 * Ícones vetoriais no estilo clássico do Club Penguin (Flash Vector Art dos anos 2000):
 * - Contornos grossos escuros (cartoon / 2.5px)
 * - Cores saturadas e gradientes vibrantes com brilho direcional
 * - Inclui TODOS os emoticons originais do Club Penguin (conforme folha oficial)
 * - Inclui itens completos de RPG desenhados na mesma estética Flash
 */

export const CP_FLASH_ICONS = [
  // ==========================================
  // 1. EMOTICONS ORIGINAIS DO CLUB PENGUIN
  // ==========================================
  {
    id: "emote_grin",
    label: "Sorriso Aberto (Grin)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_grin" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        {/* Cabeça amarela */}
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_grin)" stroke="#451a03" strokeWidth="2.5" />
        {/* Olhos pretos redondos */}
        <circle cx="12.5" cy="14" r="1.8" fill="#1e1005" />
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Boca aberta com dentes superiores e fundo vermelho escuro */}
        <path
          d="M10 18 C10 18 11.5 28 18 28 C24.5 28 26 18 26 18 Z"
          fill="#881111"
          stroke="#451a03"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Dentes superiores brancos */}
        <path
          d="M10.8 19 C12 21.5 24 21.5 25.2 19 C23 18.2 13 18.2 10.8 19 Z"
          fill="#ffffff"
        />
      </svg>
    )
  },
  {
    id: "emote_smile",
    label: "Sorriso Feliz (Smile)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_smile" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_smile)" stroke="#451a03" strokeWidth="2.5" />
        <circle cx="12.5" cy="14" r="1.8" fill="#1e1005" />
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Sorriso curvo vermelho escuro */}
        <path
          d="M11 19 C12.5 25.5 23.5 25.5 25 19"
          stroke="#881111"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: "emote_neutral",
    label: "Rosto Neutro (Straight)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_neutral" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_neutral)" stroke="#451a03" strokeWidth="2.5" />
        <circle cx="12.5" cy="14" r="1.8" fill="#1e1005" />
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Linha reta */}
        <line x1="12" y1="22" x2="24" y2="22" stroke="#451a03" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "emote_sad",
    label: "Rosto Triste (Sad)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_sad" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_sad)" stroke="#451a03" strokeWidth="2.5" />
        <circle cx="12.5" cy="14" r="1.8" fill="#1e1005" />
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Boca curvada para baixo */}
        <path
          d="M12 24 C13.5 19 22.5 19 24 24"
          stroke="#451a03"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: "emote_wink",
    label: "Piscadela (Wink)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_wink" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_wink)" stroke="#451a03" strokeWidth="2.5" />
        {/* Olho esquerdo piscando com ruguinha */}
        <path d="M9.5 15 C11 12.5 14.5 13 15.5 15.5" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M9.5 14.5 L8 13.5" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" />
        {/* Olho direito normal */}
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Sorrisinho de canto */}
        <path
          d="M10.5 19 C11.5 24 20.5 25 24 20"
          stroke="#881111"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: "emote_surprised",
    label: "Surpreso (Gasp)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_surp" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_surp)" stroke="#451a03" strokeWidth="2.5" />
        {/* Olhos arregalados brancos com pupila preta */}
        <ellipse cx="12.5" cy="13.5" rx="3.5" ry="5" fill="#ffffff" stroke="#451a03" strokeWidth="1.8" />
        <circle cx="12.5" cy="14" r="1.5" fill="#000000" />
        <ellipse cx="23.5" cy="13.5" rx="3.5" ry="5" fill="#ffffff" stroke="#451a03" strokeWidth="1.8" />
        <circle cx="23.5" cy="14" r="1.5" fill="#000000" />
        {/* Boca redonda 'O' */}
        <ellipse cx="18" cy="24" rx="3.2" ry="4" fill="#1e1005" stroke="#451a03" strokeWidth="1" />
      </svg>
    )
  },
  {
    id: "emote_tongue",
    label: "Língua de Fora (Tongue)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_tongue" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_tongue)" stroke="#451a03" strokeWidth="2.5" />
        {/* Olhos semicerrados */}
        <path d="M10 13.5 Q12.5 11 15 13.5" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M21 13.5 Q23.5 11 26 13.5" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />
        {/* Boca */}
        <path d="M11 18 Q18 20 25 18" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />
        {/* Língua vermelha saindo para baixo */}
        <path
          d="M15 19 C15 26.5 21 26.5 21 19 Z"
          fill="#ef4444"
          stroke="#7f1d1d"
          strokeWidth="1.8"
        />
        <line x1="18" y1="19" x2="18" y2="23" stroke="#7f1d1d" strokeWidth="1.2" />
      </svg>
    )
  },
  {
    id: "emote_sick",
    label: "Enjoado (Sick)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_sick" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#86efac" />
            <stop offset="50%" stopColor="#22c55e" />
            <stop offset="100%" stopColor="#15803d" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_sick)" stroke="#14532d" strokeWidth="2.5" />
        {/* Olhos caídos com bolsas */}
        <ellipse cx="12.5" cy="14" rx="3" ry="4" fill="#ffffff" stroke="#14532d" strokeWidth="1.5" />
        <circle cx="12.5" cy="14.5" r="1.3" fill="#14532d" />
        <ellipse cx="23.5" cy="14" rx="3" ry="4" fill="#ffffff" stroke="#14532d" strokeWidth="1.5" />
        <circle cx="23.5" cy="14.5" r="1.3" fill="#14532d" />
        {/* Boca ondulada de enjoo */}
        <path
          d="M11 23 Q14 20 18 23 Q22 26 25 22"
          stroke="#14532d"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    )
  },
  {
    id: "emote_angry",
    label: "Bravo / Irritado (Angry)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_angry" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f87171" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_angry)" stroke="#450a0a" strokeWidth="2.5" />
        {/* Sobrancelhas bravas inclinadas */}
        <line x1="9" y1="12" x2="16" y2="15.5" stroke="#450a0a" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="27" y1="12" x2="20" y2="15.5" stroke="#450a0a" strokeWidth="2.6" strokeLinecap="round" />
        {/* Olhos */}
        <circle cx="13" cy="17" r="1.6" fill="#1e1005" />
        <circle cx="23" cy="17" r="1.6" fill="#1e1005" />
        {/* Boca reta de raiva */}
        <line x1="12" y1="23" x2="24" y2="23" stroke="#450a0a" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "emote_worried",
    label: "Preocupado (Worried)",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_worried" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_worried)" stroke="#451a03" strokeWidth="2.5" />
        {/* Sobrancelhas caídas no centro */}
        <line x1="10" y1="14" x2="15.5" y2="12" stroke="#451a03" strokeWidth="2.4" strokeLinecap="round" />
        <line x1="26" y1="14" x2="20.5" y2="12" stroke="#451a03" strokeWidth="2.4" strokeLinecap="round" />
        <circle cx="13" cy="16" r="1.7" fill="#1e1005" />
        <circle cx="23" cy="16" r="1.7" fill="#1e1005" />
        {/* Boca insegura */}
        <line x1="13" y1="23.5" x2="23" y2="23.5" stroke="#451a03" strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "emote_skeptical",
    label: "Cético / Desconfiado",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_face_skep" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff566" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#d97706" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14.5" fill="url(#cp_face_skep)" stroke="#451a03" strokeWidth="2.5" />
        <circle cx="12.5" cy="14" r="1.8" fill="#1e1005" />
        <circle cx="23.5" cy="14" r="1.8" fill="#1e1005" />
        {/* Boca torta/diagonal */}
        <line x1="12" y1="24" x2="24" y2="20.5" stroke="#451a03" strokeWidth="2.8" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "joystick",
    label: "Controle Arcade do Club Penguin",
    category: "emotes",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_joy_red" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#ff6b6b" />
            <stop offset="50%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#991b1b" />
          </radialGradient>
        </defs>
        {/* Base cinza isométrica com bordas grossas */}
        <path
          d="M8 20L18 16L28 20L28 27L18 31L8 27Z"
          fill="#94a3b8"
          stroke="#1e293b"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M18 16V31" stroke="#1e293b" strokeWidth="2" />
        <path d="M8 20L18 24L28 20" stroke="#1e293b" strokeWidth="2" />
        <polygon points="8,20 18,16 28,20 18,24" fill="#cbd5e1" />
        {/* Haste preta do manche */}
        <line x1="18" y1="20" x2="18" y2="9" stroke="#0f172a" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="18" y1="20" x2="18" y2="9" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
        {/* Bola vermelha do topo */}
        <circle cx="18" cy="8" r="4.5" fill="url(#cp_joy_red)" stroke="#7f1d1d" strokeWidth="2" />
        <ellipse cx="16.5" cy="6.5" rx="1.5" ry="1" fill="#ffffff" opacity="0.8" />
        {/* Botão vermelho na base */}
        <ellipse cx="23" cy="22.5" rx="2" ry="1.2" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
      </svg>
    )
  },

  // ==========================================
  // 2. ARMAS & COMBATE RPG
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
        {/* Lâmina */}
        <path
          d="M28 5L31 8L15 24L12 21L28 5Z"
          fill="url(#cp_blade_grad)"
          stroke="#1b2838"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M14 22L29 7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
        {/* Guarda dourada */}
        <path
          d="M8 20L17 29L14 31L6 22L8 20Z"
          fill="url(#cp_gold_guard)"
          stroke="#523800"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Cabo e Pomo com gema */}
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
          {/* Argola do cabo */}
          <circle cx="18" cy="30.5" r="3" fill="none" stroke="#1e293b" strokeWidth="2.4" />
          {/* Cabo envolto em tecido vermelho */}
          <rect x="16.2" y="21" width="3.6" height="7" rx="1" fill="#dc2626" stroke="#1e293b" strokeWidth="2" />
          <line x1="16.2" y1="24.5" x2="19.8" y2="24.5" stroke="#7f1d1d" strokeWidth="1.5" />
          {/* Lâmina losangular simétrica da Kunai */}
          <polygon
            points="18,3 25,16 19.8,21 16.2,21 11,16"
            fill="#94a3b8"
            stroke="#1e293b"
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
          {/* Face iluminada esquerda da lâmina */}
          <polygon points="18,4.8 18,20.2 16.5,20.2 12.2,15.8" fill="#e2e8f0" />
          {/* Vincos centrais */}
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
        {/* Arco de madeira com contorno forte */}
        <path
          d="M6 30C10 20 20 10 30 6"
          stroke="#854d0e"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M6 30C10 20 20 10 30 6"
          stroke="#422006"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Corda esticada */}
        <line x1="6" y1="30" x2="30" y2="6" stroke="#ffffff" strokeWidth="1.8" />
        {/* Flecha com ponta de metal */}
        <line x1="12" y1="24" x2="28" y2="8" stroke="#1e293b" strokeWidth="2.5" />
        <polygon points="28,8 32,4 24,7" fill="#cbd5e1" stroke="#1e293b" strokeWidth="1.5" />
        <polygon points="12,24 8,28 10,24" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.2" />
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
          {/* Cabo de madeira centralizado */}
          <rect x="16" y="4" width="4" height="29" rx="2" fill="#92400e" stroke="#3b1500" strokeWidth="2.2" />
          {/* Lâmina esquerda */}
          <path
            d="M16 10 L6 6 C3 10.5 3 16.5 6 21 L16 17 Z"
            fill="#cbd5e1"
            stroke="#1e293b"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path d="M7 7.5 C4.8 11 4.8 16 7 19.5" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
          {/* Lâmina direita */}
          <path
            d="M20 10 L30 6 C33 10.5 33 16.5 30 21 L20 17 Z"
            fill="#94a3b8"
            stroke="#1e293b"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          <path d="M29 7.5 C31.2 11 31.2 16 29 19.5" stroke="#e2e8f0" strokeWidth="1.5" strokeLinecap="round" />
          {/* Encaixe central de ferro e rebite dourado */}
          <rect x="15" y="9.5" width="6" height="8" rx="1.5" fill="#475569" stroke="#1e293b" strokeWidth="2" />
          <circle cx="18" cy="13.5" r="2.2" fill="#facc15" stroke="#713f12" strokeWidth="1.3" />
        </g>
      </svg>
    )
  },
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
        {/* Pavio aceso */}
        <path d="M22 13C25 10 27 10 29 7" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
        {/* Faísca amarela */}
        <polygon points="29,7 32,5 31,8 34,8 31,10 32,13 29,11 27,13 28,10 25,9" fill="#facc15" stroke="#ea580c" strokeWidth="1.2" />
        {/* Esfera da bomba */}
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
  {
    id: "wand",
    label: "Varinha Mágica com Estrela",
    category: "combat",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <line x1="8" y1="28" x2="22" y2="14" stroke="#1e1b4b" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="8" y1="28" x2="22" y2="14" stroke="#818cf8" strokeWidth="2.2" strokeLinecap="round" />
        <polygon
          points="25,4 27,10 33,11 29,15 30,21 25,18 20,21 21,15 17,11 23,10"
          fill="#facc15"
          stroke="#854d0e"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <circle cx="25" cy="13" r="2" fill="#ffffff" />
      </svg>
    )
  },

  // ==========================================
  // 3. ARMADURAS, ESCUDOS & VESTUÁRIO
  // ==========================================
  {
    id: "shield",
    label: "Escudo do Club Penguin",
    category: "armor",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="cp_shield_blue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0096ea" />
            <stop offset="100%" stopColor="#004c8a" />
          </linearGradient>
        </defs>
        <path
          d="M6 7C14 6 22 6 30 7C30 18 25 28 18 32C11 28 6 18 6 7Z"
          fill="url(#cp_shield_blue)"
          stroke="#001f3f"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M9 9C15 8 21 8 27 9C27 17 23 25 18 29C13 25 9 17 9 9Z"
          fill="none"
          stroke="#facc15"
          strokeWidth="2"
        />
        <path d="M18 11V25M12 16H24" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "helmet",
    label: "Capacete de Minerador",
    category: "armor",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path
          d="M5 24C5 14 11 8 18 8C25 8 31 14 31 24L33 26H3L5 24Z"
          fill="#facc15"
          stroke="#713f12"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <circle cx="18" cy="14" r="5" fill="#f8fafc" stroke="#334155" strokeWidth="2" />
        <circle cx="18" cy="14" r="3" fill="#38bdf8" />
        <ellipse cx="17" cy="13" rx="1.5" ry="1" fill="#ffffff" />
      </svg>
    )
  },
  {
    id: "ninja_headband",
    label: "Faixa Ninja Card-Jitsu",
    category: "armor",
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
    category: "armor",
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
    category: "armor",
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
  // 4. COMIDAS DO CLUB PENGUIN
  // ==========================================
  {
    id: "pizza",
    label: "Fatia de Pizza do Pizzatron",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        {/* Triângulo de queijo amarelo com borda assada */}
        <path
          d="M6 28 L14 8 C20.5 9.8 25.8 13.5 29.8 18.8 L6 28 Z"
          fill="#fef08a"
          stroke="#92400e"
          strokeWidth="2.3"
          strokeLinejoin="round"
        />
        {/* Sombra interna dourada do queijo */}
        <path
          d="M7.8 26.2 L14.5 9.8 C19.8 11.4 24.5 14.5 28 18.6 L7.8 26.2 Z"
          fill="#fde047"
        />
        {/* Borda recheada dourada no topo-direito (fiel ao emoticon original do CP) */}
        <path
          d="M13.2 6.2 C20.5 7.8 27.2 12.2 31.5 18 C32.3 19.2 30.6 20.8 29.2 19.6 C25.2 14.6 19.2 10.6 12.6 9 C11.2 8.6 11.6 5.8 13.2 6.2 Z"
          fill="#f59e0b"
          stroke="#78350f"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Brilho na borda da massa */}
        <path
          d="M14.5 7.5 C20.5 9 25.8 12.6 29.5 17.2"
          stroke="#fcd34d"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Pepperonis ovais em perspectiva dentro do queijo */}
        <ellipse cx="17" cy="14.8" rx="2.7" ry="1.4" transform="rotate(15 17 14.8)" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.1" />
        <ellipse cx="21.5" cy="18.2" rx="2.5" ry="1.3" transform="rotate(15 21.5 18.2)" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.1" />
        <ellipse cx="12.5" cy="21.8" rx="2.2" ry="1.2" transform="rotate(15 12.5 21.8)" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1.1" />
        {/* Pimentão verde */}
        <path d="M14.5 17.5 L17.2 18.4" stroke="#15803d" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  },
  {
    id: "fish",
    label: "Peixe do Ice Fishing",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <linearGradient id="cp_fish_body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93c5fd" />
            <stop offset="60%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
        </defs>
        <path
          d="M5 18C10 11 23 11 29 18C23 25 10 25 5 18Z"
          fill="url(#cp_fish_body)"
          stroke="#0f172a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polygon points="27,18 34,12 33,18 34,24" fill="#fbbf24" stroke="#0f172a" strokeWidth="2" strokeLinejoin="round" />
        <path d="M15 12C18 9 22 9 24 12" fill="#fbbf24" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="11" cy="16" r="3" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
        <circle cx="10" cy="16" r="1.5" fill="#000000" />
      </svg>
    )
  },
  {
    id: "popcorn",
    label: "Pipoca do Cinema CP",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        {/* Balde vermelho do Club Penguin */}
        <path d="M10 17L12 32H24L26 17H10Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M14 17L15 32M18 17V32M22 17L21 32" stroke="#fef08a" strokeWidth="2" />
        {/* Pipocas saindo do balde */}
        <circle cx="13" cy="15" r="3.5" fill="#fef08a" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="18" cy="12" r="4.5" fill="#fef08a" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="23" cy="15" r="3.5" fill="#fef08a" stroke="#78350f" strokeWidth="1.5" />
        <circle cx="18" cy="14" r="2" fill="#fde047" />
      </svg>
    )
  },
  {
    id: "cake",
    label: "Bolo de Aniversário CP",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        {/* Base azul do bolo */}
        <rect x="7" y="19" width="22" height="12" rx="3" fill="#60a5fa" stroke="#1e3a8a" strokeWidth="2" />
        {/* Cobertura branca ondulada */}
        <path
          d="M7 20C9 23 11 23 13 20C15 23 17 23 19 20C21 23 23 23 25 20C27 23 29 23 29 20V17H7V20Z"
          fill="#ffffff"
          stroke="#1e3a8a"
          strokeWidth="1.5"
        />
        {/* 3 Velas vermelhas */}
        <rect x="11" y="11" width="2.5" height="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <rect x="17" y="10" width="2.5" height="7" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <rect x="23" y="11" width="2.5" height="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        {/* Chamas amarelas */}
        <circle cx="12.2" cy="9" r="1.5" fill="#facc15" />
        <circle cx="18.2" cy="8" r="1.8" fill="#facc15" />
        <circle cx="24.2" cy="9" r="1.5" fill="#facc15" />
      </svg>
    )
  },
  {
    id: "icecream",
    label: "Sorvete de Casquinha CP",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <polygon points="18,33 11,20 25,20" fill="#d97706" stroke="#78350f" strokeWidth="2.2" strokeLinejoin="round" />
        <line x1="14" y1="23" x2="21" y2="28" stroke="#92400e" strokeWidth="1" />
        <path
          d="M11 18C10 13 14 8 18 8C22 8 26 13 25 18C26 21 10 21 11 18Z"
          fill="#f472b6"
          stroke="#831843"
          strokeWidth="2.2"
        />
        <circle cx="16" cy="12" r="1.5" fill="#ffffff" opacity="0.6" />
      </svg>
    )
  },
  {
    id: "meat",
    label: "Carne com Osso",
    category: "food",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <line x1="7" y1="29" x2="29" y2="7" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
        <circle cx="6" cy="27" r="2.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <circle cx="8" cy="30" r="2.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <circle cx="28" cy="6" r="2.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <circle cx="31" cy="9" r="2.5" fill="#f8fafc" stroke="#475569" strokeWidth="1.5" />
        <ellipse cx="18" cy="18" rx="8" ry="6" fill="#b91c1c" stroke="#450a0a" strokeWidth="2.5" transform="rotate(-45 18 18)" />
        <ellipse cx="16" cy="16" rx="4" ry="2" fill="#ef4444" opacity="0.8" transform="rotate(-45 16 16)" />
      </svg>
    )
  },

  // ==========================================
  // 5. BEBIDAS
  // ==========================================
  {
    id: "coffee",
    label: "Café do Coffee Shop CP",
    category: "drink",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        {/* Asa da caneca na direita (fiel ao emoticon do Club Penguin) */}
        <path
          d="M24 15C29 15 29 23 24 24"
          fill="none"
          stroke="#475569"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        {/* Corpo cerâmico da caneca cinza/branca */}
        <rect x="7" y="12" width="18" height="17" rx="3" fill="#f1f5f9" stroke="#334155" strokeWidth="2.5" />
        {/* Líquido de café escuro no topo */}
        <ellipse cx="16" cy="13" rx="8" ry="3" fill="#451a03" stroke="#334155" strokeWidth="1.5" />
      </svg>
    )
  },
  {
    id: "tea",
    label: "Chá Quente de Ervas",
    category: "drink",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path
          d="M23 16C28 16 28 22 23 23"
          fill="none"
          stroke="#166534"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <rect x="8" y="14" width="16" height="14" rx="3" fill="#bbf7d0" stroke="#166534" strokeWidth="2.2" />
        <ellipse cx="16" cy="15" rx="7" ry="2.5" fill="#15803d" />
        <path d="M14 9C13 7 16 6 15 4" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M18 9C17 7 20 6 19 4" stroke="#86efac" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
  },

  // ==========================================
  // 6. POÇÕES & ALQUIMIA
  // ==========================================
  {
    id: "potion_red",
    label: "Poção de Vida (Vermelha)",
    category: "potions",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_pot_red" cx="40%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#ff4d4d" />
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
    category: "potions",
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
    category: "potions",
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
    category: "potions",
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
  // 7. FERRAMENTAS & ENGENHOCAS
  // ==========================================
  {
    id: "pickaxe",
    label: "Picareta da Mina",
    category: "tools",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <g transform="rotate(45 18 18)">
          {/* Cabo de madeira alinhado com o centro da cabeça da picareta */}
          <rect x="16" y="5" width="4" height="28" rx="2" fill="#92400e" stroke="#3b1500" strokeWidth="2.2" />
          {/* Cabeça curvada de ferro simétrica */}
          <path
            d="M4 16.5 C7.5 8.5 13 6.5 18 6.5 C23 6.5 28.5 8.5 32 16.5 C28 12.5 23 11 18 11 C13 11 8 12.5 4 16.5 Z"
            fill="#64748b"
            stroke="#0f172a"
            strokeWidth="2.3"
            strokeLinejoin="round"
          />
          {/* Brilho metálico superior na cabeça da picareta */}
          <path
            d="M7.5 12 C11 8.5 14.5 7.8 18 7.8 C21.5 7.8 25 8.5 28.5 12"
            stroke="#cbd5e1"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          {/* Encaixe central de aço */}
          <rect x="15" y="5.8" width="6" height="6.2" rx="1.5" fill="#94a3b8" stroke="#0f172a" strokeWidth="2" />
        </g>
      </svg>
    )
  },
  {
    id: "spyphone",
    label: "Spy Phone da EPF",
    category: "tools",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <line x1="25" y1="12" x2="25" y2="4" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="25" cy="4" r="2" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <rect x="8" y="11" width="20" height="22" rx="4" fill="#003566" stroke="#001833" strokeWidth="2.5" />
        <rect x="11" y="14" width="14" height="11" rx="2" fill="#00f0ff" stroke="#004d66" strokeWidth="1.5" />
        <circle cx="18" cy="28.5" r="2" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
      </svg>
    )
  },
  {
    id: "lightbulb",
    label: "Lâmpada do Gary (Ideia)",
    category: "tools",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <rect x="14" y="26" width="8" height="6" rx="1" fill="#94a3b8" stroke="#334155" strokeWidth="2" />
        <ellipse cx="18" cy="32" rx="3" ry="1.5" fill="#334155" />
        <path
          d="M13 26C11 23 8 19 8 14C8 8.5 12.5 4 18 4C23.5 4 28 8.5 28 14C28 19 25 23 23 26H13Z"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path d="M15 16C16 11 20 11 21 16" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
        <ellipse cx="14" cy="11" rx="2" ry="3" fill="#ffffff" opacity="0.8" />
      </svg>
    )
  },
  {
    id: "key",
    label: "Chave Secreta de Ouro",
    category: "tools",
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
    id: "magnifier",
    label: "Lupa de Detetive",
    category: "tools",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <circle cx="15" cy="15" r="9.5" fill="#e0f2fe" stroke="#334155" strokeWidth="2.5" />
        <ellipse cx="13" cy="12" rx="4" ry="2" fill="#ffffff" opacity="0.8" transform="rotate(-30 13 12)" />
        <line x1="22" y1="22" x2="31" y2="31" stroke="#78350f" strokeWidth="5.5" strokeLinecap="round" />
        <line x1="22" y1="22" x2="31" y2="31" stroke="#3b1500" strokeWidth="2" strokeLinecap="round" />
      </svg>
    )
  },

  // ==========================================
  // 8. JÓIAS, TESOUROS & SÍMBOLOS CP
  // ==========================================
  {
    id: "coin",
    label: "Moeda de Ouro CP",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_coin_flash" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff3a8" />
            <stop offset="50%" stopColor="#facc15" />
            <stop offset="100%" stopColor="#ca8a04" />
          </radialGradient>
        </defs>
        <circle cx="18" cy="18" r="14" fill="url(#cp_coin_flash)" stroke="#713f12" strokeWidth="2.5" />
        <circle cx="18" cy="18" r="11" fill="none" stroke="#eab308" strokeWidth="1.5" strokeDasharray="3 1.5" />
        <path
          d="M18 10L19.5 14.5H24L20.5 17.5L22 22L18 19L14 22L15.5 17.5L12 14.5H16.5L18 10Z"
          fill="#854d0e"
        />
      </svg>
    )
  },
  {
    id: "gem",
    label: "Diamante Azul Brilhante",
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
    label: "Rubi Carmesim",
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
  {
    id: "heart",
    label: "Coração Vermelho CP",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <defs>
          <radialGradient id="cp_heart_flash" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff4d4d" />
            <stop offset="60%" stopColor="#dc2626" />
            <stop offset="100%" stopColor="#7f1d1d" />
          </radialGradient>
        </defs>
        <path
          d="M18 31C18 31 5 22 5 13C5 7 10 4 15 7C17 8 18 10 18 10C18 10 19 8 21 7C26 4 31 7 31 13C31 22 18 31 18 31Z"
          fill="url(#cp_heart_flash)"
          stroke="#450a0a"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <ellipse cx="11" cy="11" rx="3.5" ry="2" fill="#ffffff" opacity="0.7" transform="rotate(-30 11 11)" />
      </svg>
    )
  },
  {
    id: "clover",
    label: "Trevo de 4 Folhas da Sorte",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path d="M18 18C16 26 12 30 7 31" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
        <circle cx="18" cy="10" r="6" fill="#22c55e" stroke="#14532d" strokeWidth="2" />
        <circle cx="18" cy="22" r="6" fill="#15803d" stroke="#14532d" strokeWidth="2" />
        <circle cx="12" cy="16" r="6" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
        <circle cx="24" cy="16" r="6" fill="#16a34a" stroke="#14532d" strokeWidth="2" />
      </svg>
    )
  },
  {
    id: "flower",
    label: "Flor Dourada do Club Penguin",
    category: "treasure",
    render: (size = 36) => (
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <path d="M26 21C20 23 15 28 10 32" stroke="#14532d" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M12 28C8 26 6 29 10 32C14 30 15 27 12 28Z" fill="#22c55e" stroke="#14532d" strokeWidth="1.5" />
        <circle cx="26" cy="11" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
        <circle cx="31" cy="16" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
        <circle cx="29" cy="23" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
        <circle cx="21" cy="21" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
        <circle cx="19" cy="14" r="5" fill="#facc15" stroke="#713f12" strokeWidth="2" />
        <circle cx="25" cy="17" r="3.5" fill="#ffffff" stroke="#713f12" strokeWidth="2" />
      </svg>
    )
  }
];

/**
 * Mapeia IDs ou emojis legados para o componente vetorial Flash correspondente.
 */
export function renderCpFlashIcon(iconOrId, size = 36) {
  if (!iconOrId) {
    return CP_FLASH_ICONS[0].render(size);
  }

  // Se já for um ID direto de ícone Flash
  const foundById = CP_FLASH_ICONS.find((i) => i.id === iconOrId);
  if (foundById) {
    return foundById.render(size);
  }

  // Mapeamento de emojis e palavras-chave legadas para os ícones Flash
  const s = String(iconOrId).toLowerCase();
  let matchId = "sword";

  if (s.includes("grin") || s.includes("😀") || s.includes("😃") || s.includes("😄") || s.includes("dente")) matchId = "emote_grin";
  else if (s.includes("smile") || s.includes("🙂") || s.includes("feliz") || s.includes("sorriso") || s.includes("😊")) matchId = "emote_smile";
  else if (s.includes("neutro") || s.includes("😐") || s.includes("straight")) matchId = "emote_neutral";
  else if (s.includes("triste") || s.includes("🙁") || s.includes("sad") || s.includes("choro") || s.includes("😢")) matchId = "emote_sad";
  else if (s.includes("pisca") || s.includes("wink") || s.includes("😉")) matchId = "emote_wink";
  else if (s.includes("surpres") || s.includes("gasp") || s.includes("😮") || s.includes("shock")) matchId = "emote_surprised";
  else if (s.includes("lingua") || s.includes("língua") || s.includes("tongue") || s.includes("😛") || s.includes("😜")) matchId = "emote_tongue";
  else if (s.includes("sick") || s.includes("enjoo") || s.includes("verde") || s.includes("🤢") || s.includes("vomit")) matchId = "emote_sick";
  else if (s.includes("angry") || s.includes("bravo") || s.includes("raiva") || s.includes("😡") || s.includes("irritado")) matchId = "emote_angry";
  else if (s.includes("worried") || s.includes("preocupado") || s.includes("medo") || s.includes("😟")) matchId = "emote_worried";
  else if (s.includes("skep") || s.includes("cético") || s.includes("desconfiado") || s.includes("😏") || s.includes("😒")) matchId = "emote_skeptical";
  else if (s.includes("joystick") || s.includes("gamepad") || s.includes("arcade") || s.includes("jogo") || s.includes("🕹️")) matchId = "joystick";
  else if (s.includes("pizza") || s.includes("🍕")) matchId = "pizza";
  else if (s.includes("cafe") || s.includes("café") || s.includes("☕") || s.includes("caneca") || s.includes("copo")) matchId = "coffee";
  else if (s.includes("cha") || s.includes("chá") || s.includes("🍵")) matchId = "tea";
  else if (s.includes("peixe") || s.includes("🐟") || s.includes("fish")) matchId = "fish";
  else if (s.includes("pipoca") || s.includes("🍿") || s.includes("popcorn")) matchId = "popcorn";
  else if (s.includes("bolo") || s.includes("🎂") || s.includes("cake")) matchId = "cake";
  else if (s.includes("sorvete") || s.includes("🍦") || s.includes("icecream")) matchId = "icecream";
  else if (s.includes("carne") || s.includes("🍖") || s.includes("meat")) matchId = "meat";
  else if (s.includes("bomba") || s.includes("💣") || s.includes("bomb")) matchId = "bomb";
  else if (s.includes("neve") || s.includes("❄️") || s.includes("gelo") || s.includes("snowball")) matchId = "snowball";
  else if (s.includes("kunai") || s.includes("adaga") || s.includes("🗡️")) matchId = "dagger";
  else if (s.includes("arco") || s.includes("🏹") || s.includes("flecha")) matchId = "bow";
  else if (s.includes("machado") || s.includes("🪓") || s.includes("axe")) matchId = "axe";
  else if (s.includes("varinha") || s.includes("🪄") || s.includes("cajado") || s.includes("wand")) matchId = "wand";
  else if (s.includes("escudo") || s.includes("🛡️") || s.includes("protecao") || s.includes("shield")) matchId = "shield";
  else if (s.includes("capacete") || s.includes("🪖") || s.includes("miner") || s.includes("helmet")) matchId = "helmet";
  else if (s.includes("faixa") || s.includes("ninja") || s.includes("headband") || s.includes("🥋")) matchId = "ninja_headband";
  else if (s.includes("coroa") || s.includes("crown") || s.includes("👑")) matchId = "crown";
  else if (s.includes("capa") || s.includes("cape") || s.includes("manto")) matchId = "cape";
  else if (s.includes("cura") || s.includes("vida") || s.includes("🍷") || s.includes("pot_red")) matchId = "potion_red";
  else if (s.includes("mana") || s.includes("energia") || s.includes("💧") || s.includes("pot_blue")) matchId = "potion_blue";
  else if (s.includes("pocao") || s.includes("poção") || s.includes("🧪") || s.includes("alquimia")) matchId = "potion_green";
  else if (s.includes("arcano") || s.includes("purp") || s.includes("roxa") || s.includes("elixir")) matchId = "potion_purple";
  else if (s.includes("picareta") || s.includes("⛏️") || s.includes("mina") || s.includes("pickaxe")) matchId = "pickaxe";
  else if (s.includes("spy") || s.includes("phone") || s.includes("📱") || s.includes("epf")) matchId = "spyphone";
  else if (s.includes("lampada") || s.includes("lâmpada") || s.includes("💡") || s.includes("gary") || s.includes("ideia")) matchId = "lightbulb";
  else if (s.includes("chave") || s.includes("key") || s.includes("🔑")) matchId = "key";
  else if (s.includes("lupa") || s.includes("detetive") || s.includes("🔍") || s.includes("investig")) matchId = "magnifier";
  else if (s.includes("moeda") || s.includes("coin") || s.includes("ouro") || s.includes("🪙")) matchId = "coin";
  else if (s.includes("diamante") || s.includes("gem") || s.includes("💎")) matchId = "gem";
  else if (s.includes("rubi") || s.includes("ruby") || s.includes("vermelha")) matchId = "ruby";
  else if (s.includes("coracao") || s.includes("coração") || s.includes("heart") || s.includes("❤️")) matchId = "heart";
  else if (s.includes("trevo") || s.includes("clover") || s.includes("☘️") || s.includes("🍀")) matchId = "clover";
  else if (s.includes("flor") || s.includes("flower") || s.includes("🌸") || s.includes("🌼")) matchId = "flower";
  else if (s.includes("espada") || s.includes("⚔️") || s.includes("sword") || s.includes("arma")) matchId = "sword";

  const target = CP_FLASH_ICONS.find((i) => i.id === matchId) || CP_FLASH_ICONS[0];
  return target.render(size);
}
