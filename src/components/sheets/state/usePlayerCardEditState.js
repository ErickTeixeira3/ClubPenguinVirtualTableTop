import { useState } from "react";

/**
 * Fase 5: estados de edição inline de Moedas e XP do Player Card.
 * Chamado pela Ficha (CharacterSheetModal) na mesma posição dos useState originais.
 */
export function usePlayerCardEditState(character) {
  const [editingCoins, setEditingCoins] = useState(false);
  const [coinsInput, setCoinsInput] = useState(character?.coins ?? 0);
  const [editingXp, setEditingXp] = useState(false);
  const [xpInput, setXpInput] = useState(character?.xp ?? 0);

  return {
    editingCoins,
    setEditingCoins,
    coinsInput,
    setCoinsInput,
    editingXp,
    setEditingXp,
    xpInput,
    setXpInput
  };
}
