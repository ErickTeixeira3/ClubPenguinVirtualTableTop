import { NOTE_TYPES as DOMAIN_NOTE_TYPES } from "../../domain/constants.js";

export const JOURNAL_NOTE_TYPES = Object.freeze([
  {
    key: DOMAIN_NOTE_TYPES.QUEST,
    label: "Missões",
    singular: "Missão",
    color: "#fdd835",
    badgeTextColor: "#001b3a",
    icon: "🎯"
  },
  {
    key: DOMAIN_NOTE_TYPES.LOCATION,
    label: "Lugares",
    singular: "Lugar",
    color: "#1e88e5",
    badgeTextColor: "#ffffff",
    icon: "📍"
  },
  {
    key: DOMAIN_NOTE_TYPES.CHARACTER,
    label: "Personagens",
    singular: "Personagem",
    color: "#e53935",
    badgeTextColor: "#ffffff",
    icon: "🐧"
  },
  {
    key: DOMAIN_NOTE_TYPES.LORE,
    label: "Lore",
    singular: "Lore",
    color: "#00bcd4",
    badgeTextColor: "#ffffff",
    icon: "📜"
  },
  {
    key: DOMAIN_NOTE_TYPES.EVENT,
    label: "Eventos",
    singular: "Evento",
    color: "#6a1b9a",
    badgeTextColor: "#ffffff",
    icon: "⚡"
  }
]);

const NOTE_TYPE_META_BY_KEY = new Map(
  JOURNAL_NOTE_TYPES.map((entry) => [entry.key, entry])
);

const DEFAULT_NOTE_TYPE_META = Object.freeze({
  key: DOMAIN_NOTE_TYPES.LORE,
  label: "Lore",
  singular: "Lore",
  color: "#3090f0",
  badgeTextColor: "#ffffff",
  icon: "📄"
});

export function getNoteTypeMeta(noteType) {
  return NOTE_TYPE_META_BY_KEY.get(noteType) || DEFAULT_NOTE_TYPE_META;
}

export function getNoteTypeIcon(noteType) {
  return getNoteTypeMeta(noteType).icon;
}
