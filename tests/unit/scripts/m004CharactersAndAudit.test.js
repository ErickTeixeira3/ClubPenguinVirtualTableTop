import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { evaluateAuditData } from "../../../scripts/migrations/audit-v2.mjs";
import M004CharactersV2 from "../../../scripts/migrations/M004-characters-v2.mjs";
import { normalizeCompendiumEntry, toCompendiumEntryDoc } from "../../../src/domain/models/compendiumEntry.js";

function cloneDocData(value) {
  if (value instanceof Timestamp) {
    return new Timestamp(value.seconds, value.nanoseconds);
  }
  if (Array.isArray(value)) {
    return value.map(cloneDocData);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cloneDocData(v)])
    );
  }
  return value;
}

function createFakeAdminFirestore(collectionsData) {
  return {
    collection(colPath) {
      const items = collectionsData[colPath] || [];
      return {
        async get() {
          return {
            docs: items.map(({ id, data }) => ({
              id,
              ref: { path: `${colPath}/${id}` },
              data: () => cloneDocData(data)
            }))
          };
        }
      };
    }
  };
}

function applyFirestoreUpdate(docData, updateData) {
  const next = cloneDocData(docData);
  const deleteSentinel = FieldValue.delete();
  const serverTimestampSentinel = FieldValue.serverTimestamp();
  for (const [k, v] of Object.entries(updateData)) {
    if (v && typeof v.isEqual === "function" && v.isEqual(deleteSentinel)) {
      delete next[k];
    } else if (v && typeof v.isEqual === "function" && v.isEqual(serverTimestampSentinel)) {
      next[k] = Timestamp.fromMillis(1763000000000);
    } else {
      next[k] = cloneDocData(v);
    }
  }
  return next;
}

describe("M004-characters-v2 e auditValidators — sincronização de chaves legadas e colisões", () => {
  it("auditValidators rejeita coneAngleDeg e rollFormula e M004 limpa ambos via FieldValue.delete()", async () => {
    const validCompV2 = toCompendiumEntryDoc(
      normalizeCompendiumEntry({
        id: "comp_1",
        campaignId: "camp_1",
        type: "spell",
        name: "Sopro Cônico",
        visibleTo: ["ALL"]
      })
    );

    const legacyCompDoc = {
      ...validCompV2,
      aoeType: "cone",
      aoeRadiusMeters: 6,
      coneAngleDeg: 60,
      rollFormula: "3d6",
      aoe: undefined
    };
    delete legacyCompDoc.aoe;
    delete legacyCompDoc.effectFormula;

    const auditBefore = evaluateAuditData({
      source: "memory",
      documents: {
        "campaigns/camp_1/compendium/comp_1": legacyCompDoc
      }
    });
    expect(auditBefore.exitCode).toBe(1);
    const codes = auditBefore.report.samples.map((s) => s.code);
    expect(codes).toContain("LEGACY_FIELD_coneAngleDeg");
    expect(codes).toContain("LEGACY_FIELD_rollFormula");

    const firestore = createFakeAdminFirestore({
      campaigns: [{ id: "camp_1", data: { gmId: "gm_1", name: "Mesa" } }],
      "campaigns/camp_1/characters": [],
      "campaigns/camp_1/compendium": [{ id: "comp_1", data: legacyCompDoc }]
    });

    const plan = await M004CharactersV2.plan({ firestore });
    expect(plan.summary.compendiumUpdated).toBe(1);
    expect(plan.operations).toHaveLength(1);

    const op = plan.operations[0];
    expect(op.path).toBe("campaigns/camp_1/compendium/comp_1");
    expect(op.data.aoe).toEqual({ type: "cone", radiusMeters: 6, coneAngleDeg: 60 });
    expect(op.data.effectFormula).toBe("3d6");
    expect(op.data.coneAngleDeg.isEqual(FieldValue.delete())).toBe(true);
    expect(op.data.rollFormula.isEqual(FieldValue.delete())).toBe(true);

    const cleanedDoc = applyFirestoreUpdate(legacyCompDoc, op.data);
    expect(cleanedDoc).not.toHaveProperty("coneAngleDeg");
    expect(cleanedDoc).not.toHaveProperty("rollFormula");

    const auditAfter = evaluateAuditData({
      source: "memory",
      documents: {
        "campaigns/camp_1/compendium/comp_1": cleanedDoc
      }
    });
    expect(auditAfter.exitCode).toBe(0);
    expect(auditAfter.report.violations).toBe(0);
  });

  it("M004 emite relatório detalhado de colisões (collisionReport) e é idempotente", async () => {
    const charDoc = {
      id: "ch_1",
      name: "Pinguim",
      type: "pc",
      ownerId: "p_1",
      visibleTo: ["p_1", "gm_1"],
      editableBy: ["p_1", "gm_1"],
      attributes: [{ key: "forca", label: "Força", value: 3 }],
      skills: [
        { id: "sk_attr", name: "Força", attribute: "forca", bonus: 2 },
        { id: "sk_res", name: "HP", attribute: "forca", bonus: 1 },
        { id: "sk_a", name: "Luta", attribute: "forca", bonus: 3 },
        { id: "sk_b", name: "Luta", attribute: "forca", bonus: 1 }
      ],
      rollGroups: [
        {
          id: "g1",
          name: "Geral",
          rolls: [
            { id: "r1", sourceType: "skill", sourceId: "sk_a" },
            { id: "r2", sourceType: "skill", sourceId: "sk_b" }
          ]
        }
      ]
    };

    const firestore = createFakeAdminFirestore({
      campaigns: [{ id: "camp_1", data: { gmId: "gm_1", name: "Mesa" } }],
      "campaigns/camp_1/characters": [{ id: "ch_1", data: charDoc }],
      "campaigns/camp_1/compendium": []
    });

    const plan = await M004CharactersV2.plan({ firestore });
    expect(plan.summary.skillKeyCollisions).toBe(3);
    expect(plan.summary.collisionReport).toEqual([
      {
        path: "campaigns/camp_1/characters/ch_1",
        legacySkillId: "sk_attr",
        originalKey: "forca",
        resolvedKey: "forca_2",
        reason: "attribute_collision"
      },
      {
        path: "campaigns/camp_1/characters/ch_1",
        legacySkillId: "sk_res",
        originalKey: "hp",
        resolvedKey: "hp_2",
        reason: "reserved_key"
      },
      {
        path: "campaigns/camp_1/characters/ch_1",
        legacySkillId: "sk_b",
        originalKey: "luta",
        resolvedKey: "luta_2",
        reason: "skill_collision"
      }
    ]);

    const migratedChar = applyFirestoreUpdate(charDoc, plan.operations[0].data);
    expect(migratedChar.rollGroups.g1.rolls.r1.source.id).toBe("luta");
    expect(migratedChar.rollGroups.g1.rolls.r2.source.id).toBe("luta_2");

    const secondFirestore = createFakeAdminFirestore({
      campaigns: [{ id: "camp_1", data: { gmId: "gm_1", name: "Mesa" } }],
      "campaigns/camp_1/characters": [{ id: "ch_1", data: migratedChar }],
      "campaigns/camp_1/compendium": []
    });
    const secondPlan = await M004CharactersV2.plan({ firestore: secondFirestore });
    expect(secondPlan.operations).toHaveLength(0);
    expect(secondPlan.summary.skillKeyCollisions).toBe(0);
    expect(secondPlan.summary.collisionReport).toEqual([]);
  });

  it("M004 escalona sufixo quando forca_2 já existe e preserva/limpa campos híbridos no compêndio com idempotência", async () => {
    const charWithForca2 = {
      id: "ch_esc",
      name: "Escalado",
      type: "pc",
      ownerId: "p_1",
      visibleTo: ["p_1", "gm_1"],
      editableBy: ["p_1", "gm_1"],
      attributes: [{ key: "forca", label: "Força", value: 4 }],
      skills: [
        { id: "sk_existing_2", key: "forca_2", name: "Força Auxiliar", attribute: "Força", bonus: 1 },
        { id: "sk_dup", name: "Força", attribute: "forca", bonus: 3 }
      ]
    };

    const hybridSpell = {
      ...toCompendiumEntryDoc(
        normalizeCompendiumEntry({
          id: "comp_hyb",
          campaignId: "camp_1",
          type: "spell",
          name: "Cone Híbrido",
          visibleTo: ["ALL"]
        })
      ),
      effectFormula: "",
      rollFormula: "4d6",
      aoe: { type: "cone", radiusMeters: 9 },
      coneAngleDeg: 60
    };
    const legacySkillComp = {
      ...toCompendiumEntryDoc(
        normalizeCompendiumEntry({
          id: "comp_sk",
          campaignId: "camp_1",
          type: "skill",
          name: "Salto",
          visibleTo: ["ALL"]
        })
      ),
      formula: "1d20+@agilidade",
      distanceMeters: 6
    };
    delete legacySkillComp.hitFormula;
    delete legacySkillComp.range;

    const firestore = createFakeAdminFirestore({
      campaigns: [{ id: "camp_1", data: { gmId: "gm_1", name: "Mesa" } }],
      "campaigns/camp_1/characters": [{ id: "ch_esc", data: charWithForca2 }],
      "campaigns/camp_1/compendium": [
        { id: "comp_hyb", data: hybridSpell },
        { id: "comp_sk", data: legacySkillComp }
      ]
    });

    const plan = await M004CharactersV2.plan({ firestore });
    expect(plan.summary.skillKeyCollisions).toBe(1);
    expect(plan.summary.collisionReport).toEqual([
      {
        path: "campaigns/camp_1/characters/ch_esc",
        legacySkillId: "sk_dup",
        originalKey: "forca",
        resolvedKey: "forca_3",
        reason: "attribute_collision"
      }
    ]);

    const charMigrated = applyFirestoreUpdate(charWithForca2, plan.operations[0].data);
    expect(charMigrated.skills.forca_2.attributeKey).toBe("forca");
    expect(charMigrated.skills.forca_3.bonus).toBe(3);

    const hybOp = plan.operations.find((o) => o.path.endsWith("/comp_hyb"));
    const skOp = plan.operations.find((o) => o.path.endsWith("/comp_sk"));
    expect(hybOp.data.effectFormula).toBe("4d6");
    expect(hybOp.data.aoe).toEqual({ type: "cone", radiusMeters: 9, coneAngleDeg: 60 });
    expect(hybOp.data.coneAngleDeg.isEqual(FieldValue.delete())).toBe(true);
    expect(hybOp.data.rollFormula.isEqual(FieldValue.delete())).toBe(true);

    expect(skOp.data.hitFormula).toBe("1d20+@agilidade");
    expect(skOp.data.range).toEqual({ type: "ranged", distanceMeters: 6 });
    expect(skOp.data.formula.isEqual(FieldValue.delete())).toBe(true);
    expect(skOp.data.distanceMeters.isEqual(FieldValue.delete())).toBe(true);

    const cleanedHyb = applyFirestoreUpdate(hybridSpell, hybOp.data);
    const cleanedSk = applyFirestoreUpdate(legacySkillComp, skOp.data);

    const auditAfter = evaluateAuditData({
      source: "memory",
      documents: {
        "campaigns/camp_1/characters/ch_esc": charMigrated,
        "campaigns/camp_1/compendium/comp_hyb": cleanedHyb,
        "campaigns/camp_1/compendium/comp_sk": cleanedSk
      }
    });
    expect(auditAfter.exitCode).toBe(0);

    const secondPlan = await M004CharactersV2.plan({
      firestore: createFakeAdminFirestore({
        campaigns: [{ id: "camp_1", data: { gmId: "gm_1", name: "Mesa" } }],
        "campaigns/camp_1/characters": [{ id: "ch_esc", data: charMigrated }],
        "campaigns/camp_1/compendium": [
          { id: "comp_hyb", data: cleanedHyb },
          { id: "comp_sk", data: cleanedSk }
        ]
      })
    });
    expect(secondPlan.operations).toHaveLength(0);
  });
});
