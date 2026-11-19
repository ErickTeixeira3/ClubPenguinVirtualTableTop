import { describe, expect, it } from "vitest";
import {
  adaptMessageForLegacyChat,
  compareMessagesBySeq,
  getMessageCreatedAtMs,
  selectMessageView
} from "../../../../src/engines/chat/messageSelector.js";

describe("Fase 9 — seletor transitório T5 de mensagens", () => {
  const v2 = {
    id: "msg_2",
    type: "roll",
    seq: 12,
    visibility: "public",
    sender: {
      uid: "p1",
      characterId: "char_1",
      displayName: "Rookie",
      image: { mediaId: "med_1", url: null }
    },
    roll: {
      kind: "attack",
      title: "Bola de Neve",
      icon: "snowball",
      color: "#38bdf8",
      rolls: [{ total: 18 }],
      targets: [
        { tokenId: "tok_1", sceneId: "sc_1", characterId: "char_2", label: "Herbert" }
      ],
      hitEvaluation: {
        status: "done",
        results: [{ tokenId: "tok_1", hit: true, crit: false, fumble: false }]
      },
      savingThrowRequest: null,
      respondsTo: null,
      secondary: null,
      allyCostOps: [],
      appliedEffects: {
        op_1: {
          effectType: "damage",
          scaleMode: "full",
          finalValue: 4,
          targetTokenId: "tok_1",
          targetLabel: "Herbert",
          appliedBy: "gm1",
          at: 123
        }
      }
    },
    createdAt: { toMillis: () => 1234 }
  };

  it("lê identidade, payload, ordem e horário exclusivamente do contrato v2", () => {
    const view = selectMessageView(v2);

    expect(view.sender).toEqual(v2.sender);
    expect(view.roll).toBe(v2.roll);
    expect(view.skillPing).toBeNull();
    expect(view.createdAtMs).toBe(1234);
    expect(view.seq).toBe(12);
  });

  it("adapta o contrato v2 para o chat v1 sem expor Defesa e sem usar alvo corrente", () => {
    const adapted = adaptMessageForLegacyChat(v2);

    expect(adapted.senderName).toBe("Rookie");
    expect(adapted.characterId).toBe("char_1");
    expect(adapted.rollData.rollKind).toBe("attack");
    expect(adapted.rollData.targetInfo).toMatchObject({
      tokenId: "tok_1",
      characterId: "char_2",
      name: "Herbert",
      isHit: true
    });
    expect(adapted.rollData.targetInfo).not.toHaveProperty("defense");
    expect(adapted.rollData.appliedEffects).toEqual([
      expect.objectContaining({ opId: "op_1", targetName: "Herbert" })
    ]);
  });

  it("ordena por seq e mantém fallback determinístico apenas para documentos pré-M008", () => {
    expect(compareMessagesBySeq({ id: "b", seq: 2 }, { id: "a", seq: 1 })).toBeGreaterThan(0);
    expect(compareMessagesBySeq({ id: "a" }, { id: "b" })).toBeLessThan(0);
    expect(getMessageCreatedAtMs({ createdAt: 99 })).toBe(99);
  });
});
