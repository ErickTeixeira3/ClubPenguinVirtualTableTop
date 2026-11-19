import { describe, expect, it } from "vitest";
import * as chatBarrel from "../../../src/engines/chat/index.js";
import * as combatBarrel from "../../../src/engines/combat/index.js";
import * as compendiumBarrel from "../../../src/engines/compendium/index.js";
import * as diceBarrel from "../../../src/engines/dice/index.js";
import * as fogBarrel from "../../../src/engines/fog/index.js";
import * as foldersBarrel from "../../../src/engines/folders/index.js";
import * as formulaBarrel from "../../../src/engines/formula/index.js";
import * as geometryBarrel from "../../../src/engines/geometry/index.js";
import * as journalBarrel from "../../../src/engines/journal/index.js";
import * as rollsBarrel from "../../../src/engines/rolls/index.js";
import * as turnBarrel from "../../../src/engines/turn/index.js";

describe("engines/*/index.js barrels", () => {
  it("re-exports expected public entrypoints for all 11 pure engines", () => {
    expect(typeof chatBarrel.parseChatInput).toBe("function");

    expect(typeof combatBarrel.collectEntityCombatModifiers).toBe("function");
    expect(typeof combatBarrel.computeModifiedEffectValue).toBe("function");
    expect(typeof combatBarrel.resolveTokenTargetData).toBe("function");
    expect(typeof combatBarrel.buildTargetInfo).toBe("function");
    expect(typeof combatBarrel.evaluatePendingHitEvaluation).toBe("function");
    expect(typeof combatBarrel.normalizeCombatEntry).toBe("function");
    expect(typeof combatBarrel.collectCombatTriggers).toBe("function");
    expect(typeof combatBarrel.collectSavingThrowAssists).toBe("function");
    expect(typeof combatBarrel.composeSavingThrowFormula).toBe("function");
    expect(typeof combatBarrel.summarizeCombatEntryCosts).toBe("function");
    expect(typeof combatBarrel.evaluateDcFormula).toBe("function");
    expect(typeof combatBarrel.evaluateSavingThrowOutcome).toBe("function");

    expect(typeof compendiumBarrel.mapCompendiumEntryToCharacterEntry).toBe("function");
    expect(typeof compendiumBarrel.normalizeSkillKey).toBe("function");
    expect(typeof compendiumBarrel.resolveUniqueSkillKey).toBe("function");

    expect(typeof diceBarrel.rollSingleDie).toBe("function");
    expect(typeof diceBarrel.evaluateDiceToken).toBe("function");

    expect(typeof fogBarrel.isPointRevealed).toBe("function");
    expect(typeof fogBarrel.partitionTokensByFog).toBe("function");

    expect(typeof foldersBarrel.buildFolderTree).toBe("function");
    expect(typeof foldersBarrel.collectDescendantFolderIds).toBe("function");
    expect(typeof foldersBarrel.getFolderDisplayPath).toBe("function");
    expect(typeof foldersBarrel.validateFolderMove).toBe("function");
    expect(typeof foldersBarrel.validateFolderName).toBe("function");
    expect(typeof foldersBarrel.validateItemFolderPlacement).toBe("function");

    expect(typeof formulaBarrel.stripAccents).toBe("function");
    expect(typeof formulaBarrel.normalizeFormulaKey).toBe("function");
    expect(typeof formulaBarrel.validateFormulaKeys).toBe("function");
    expect(typeof formulaBarrel.buildCharacterVariableMap).toBe("function");
    expect(typeof formulaBarrel.evaluateFormula).toBe("function");

    expect(typeof geometryBarrel.computeDistancePx).toBe("function");
    expect(typeof geometryBarrel.computeMoveDistanceMeters).toBe("function");
    expect(typeof geometryBarrel.computeRulerStats).toBe("function");
    expect(typeof geometryBarrel.getTokenCenter).toBe("function");
    expect(typeof geometryBarrel.getTokenRadiusPx).toBe("function");
    expect(typeof geometryBarrel.metersToPixels).toBe("function");
    expect(typeof geometryBarrel.pixelsToMeters).toBe("function");
    expect(typeof geometryBarrel.pointsToSvgPath).toBe("function");
    expect(typeof geometryBarrel.rotatePoint).toBe("function");
    expect(typeof geometryBarrel.computeAoePreview).toBe("function");
    expect(typeof geometryBarrel.isTokenInsideCircle).toBe("function");
    expect(typeof geometryBarrel.isTokenInsideCone).toBe("function");
    expect(typeof geometryBarrel.TEXT_BOUNDS_CONFIG).toBe("object");
    expect(typeof geometryBarrel.getTextBounds).toBe("function");
    expect(typeof geometryBarrel.doesDrawingIntersectRect).toBe("function");
    expect(typeof geometryBarrel.getDrawingBounds).toBe("function");
    expect(typeof geometryBarrel.isPointInDrawing).toBe("function");

    expect(typeof journalBarrel.extractNoteText).toBe("function");
    expect(typeof journalBarrel.buildNormalizedAliases).toBe("function");
    expect(typeof journalBarrel.detectAliasMentions).toBe("function");
    expect(typeof journalBarrel.normalizeAliasText).toBe("function");
    expect(typeof journalBarrel.normalizeWithMap).toBe("function");
    expect(typeof journalBarrel.tokenizeTextWithAliases).toBe("function");
    expect(typeof journalBarrel.buildGraphForReader).toBe("function");

    expect(typeof rollsBarrel.effectRollKind).toBe("function");
    expect(typeof rollsBarrel.inferAbilityRollKind).toBe("function");
    expect(typeof rollsBarrel.classifyRollKind).toBe("function");
    expect(typeof rollsBarrel.isAttackRollMessage).toBe("function");
    expect(typeof rollsBarrel.buildSkillFormula).toBe("function");
    expect(typeof rollsBarrel.resolveDynamicRollEntry).toBe("function");
    expect(typeof rollsBarrel.resolveHotbarSlot).toBe("function");
    expect(typeof rollsBarrel.buildHotbarSlotFromRoll).toBe("function");
    expect(typeof rollsBarrel.buildShortcutRollParams).toBe("function");
    expect(typeof rollsBarrel.doubleDiceInFormula).toBe("function");
    expect(typeof rollsBarrel.applyD20ModeToFormula).toBe("function");
    expect(typeof rollsBarrel.composeDamageFormula).toBe("function");

    expect(typeof turnBarrel.advanceTurnInState).toBe("function");
    expect(typeof turnBarrel.canActorAct).toBe("function");
    expect(typeof turnBarrel.canActorMove).toBe("function");
    expect(typeof turnBarrel.consumeActionInState).toBe("function");
    expect(typeof turnBarrel.consumeMovementInState).toBe("function");
    expect(typeof turnBarrel.createCombatantEntry).toBe("function");
    expect(typeof turnBarrel.evaluateActorAct).toBe("function");
    expect(typeof turnBarrel.evaluateActorMove).toBe("function");
    expect(typeof turnBarrel.findCombatantByActor).toBe("function");
    expect(typeof turnBarrel.getActiveCombatant).toBe("function");
    expect(typeof turnBarrel.isActorTurn).toBe("function");
    expect(typeof turnBarrel.normalizeCombatState).toBe("function");
    expect(typeof turnBarrel.normalizeCombatant).toBe("function");
    expect(typeof turnBarrel.regressTurnInState).toBe("function");
    expect(typeof turnBarrel.sortTurnOrder).toBe("function");
    expect(typeof turnBarrel.computeMoveDistanceMeters).toBe("function");
    expect(typeof turnBarrel.DEFAULT_COMBAT_STATE).toBe("object");
    expect(typeof turnBarrel.DEFAULT_MOVEMENT_BUDGET_METERS).toBe("number");
  });
});
