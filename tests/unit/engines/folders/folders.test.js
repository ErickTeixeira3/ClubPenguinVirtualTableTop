import { describe, expect, it } from "vitest";
import { FOLDER_DOMAINS, NOTE_SCOPES, NOTE_TYPES } from "../../../../src/domain/constants.js";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  buildFolderTree,
  collectDescendantFolderIds,
  getFolderDisplayPath,
  validateFolderMove,
  validateFolderName,
  validateItemFolderPlacement
} from "../../../../src/engines/folders/index.js";

describe("validateFolderName", () => {
  it("accepts valid trimmed single-segment names", () => {
    expect(validateFolderName("NPCs")).toEqual({ ok: true, errors: [] });
    expect(validateFolderName("  Lore Antigo  ")).toEqual({ ok: true, errors: [] });
  });

  it("rejects non-string values with INVALID_TYPE", () => {
    for (const bad of [null, undefined, 123, {}, []]) {
      const res = validateFolderName(bad);
      expect(res.ok).toBe(false);
      expect(res.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);
    }
  });

  it("rejects empty or whitespace-only names with INVALID_FOLDER_NAME", () => {
    for (const bad of ["", "   ", "\t\n"]) {
      const res = validateFolderName(bad);
      expect(res.ok).toBe(false);
      expect(res.errors[0].code).toBe(ERROR_CODES.INVALID_FOLDER_NAME);
    }
  });

  it("rejects names containing slashes with INVALID_FOLDER_NAME", () => {
    for (const bad of ["A/B", "/root", "sub/"]) {
      const res = validateFolderName(bad);
      expect(res.ok).toBe(false);
      expect(res.errors[0].code).toBe(ERROR_CODES.INVALID_FOLDER_NAME);
    }
  });
});

describe("buildFolderTree", () => {
  it("builds multi-level tree, rolls up totalItemCount, and sorts by order then name/title then id", () => {
    const folders = [
      { id: "f_b", name: "Beta", parentId: null, order: 2 },
      { id: "f_a", title: "Alfa", parentId: null, order: 1 },
      { id: "f_c", name: "Gamma", parentId: null },
      { id: "f_c2", name: "Gamma", parentId: null },
      { id: "f_sub", name: "Sub", parentId: "f_a", order: 0 },
      { id: "f_del", name: "Deleted", parentId: null, isDeleted: true },
      null,
      []
    ];
    const items = [
      { id: "i_root", name: "Root Item", folderId: null, order: 2 },
      { id: "i_sub", name: "Sub Item", folderId: "f_sub", order: 0 },
      { id: "i_a", title: "Alfa Item", folderId: "f_a", order: 1 },
      { id: "i_del", name: "Deleted Item", folderId: "f_a", isDeleted: true },
      null
    ];

    const tree = buildFolderTree(folders, items);

    expect(tree.roots.map((r) => r.id)).toEqual(["f_a", "f_b", "f_c", "f_c2"]);
    expect(tree.nodesById.has("f_del")).toBe(false);
    expect(tree.rootItems.map((i) => i.id)).toEqual(["i_root"]);

    const alfaNode = tree.nodesById.get("f_a");
    expect(alfaNode.items.map((i) => i.id)).toEqual(["i_a"]);
    expect(alfaNode.children.map((c) => c.id)).toEqual(["f_sub"]);
    expect(alfaNode.totalItemCount).toBe(2);
    expect(tree.nodesById.get("f_sub").totalItemCount).toBe(1);
    expect(tree.orphanFolderIds).toEqual([]);
    expect(tree.orphanItemIds).toEqual([]);
    expect(tree.cycleFolderIds).toEqual([]);
  });

  it("supports Map and plain Object inputs and skips prototype pollution keys", () => {
    const folderMap = new Map([
      ["f1", { name: "One", parentId: null }],
      ["__proto__", { name: "Evil", parentId: null }]
    ]);
    const itemMap = new Map([
      ["i1", { id: "i1", name: "Item 1", folderId: "f1" }]
    ]);

    const fromMaps = buildFolderTree(folderMap, itemMap);
    expect(fromMaps.roots.map((r) => r.id)).toEqual(["f1"]);
    expect(fromMaps.nodesById.size).toBe(1);

    const folderObj = Object.create(null);
    folderObj.f1 = { id: "f1", name: "One", parentId: null };
    folderObj.constructor = { id: "constructor", name: "Bad", parentId: null };

    const itemObj = {
      i1: { id: "i1", name: "Item 1", folderId: "f1" },
      prototype: { id: "p", name: "Bad", folderId: "f1" }
    };

    const fromObjs = buildFolderTree(folderObj, itemObj);
    expect(fromObjs.roots.map((r) => r.id)).toEqual(["f1"]);
    expect(fromObjs.nodesById.get("f1").items.map((i) => i.id)).toEqual(["i1"]);
  });

  it("handles nullish and non-object inputs gracefully", () => {
    const empty = buildFolderTree(null, null);
    expect(empty.roots).toEqual([]);
    expect(empty.rootItems).toEqual([]);
    expect(empty.nodesById.size).toBe(0);

    const nonObj = buildFolderTree("invalid", 42);
    expect(nonObj.roots).toEqual([]);
    expect(nonObj.rootItems).toEqual([]);
  });

  it("promotes orphan folders and orphan items to root without dropping anything", () => {
    const folders = [
      { id: "f_deleted_parent", name: "Gone", parentId: null, isDeleted: true },
      { id: "f_orphan", name: "Orphan", parentId: "f_deleted_parent" },
      { id: "f_missing_parent", name: "Orphan2", parentId: "non_existent" }
    ];
    const items = [
      { id: "i_orphan_del", name: "Item1", folderId: "f_deleted_parent" },
      { id: "i_orphan_missing", name: "Item2", folderId: "does_not_exist" },
      { name: "NamelessIdOrphan", folderId: "does_not_exist" }
    ];

    const tree = buildFolderTree(folders, items);
    expect(tree.roots.map((r) => r.id)).toEqual(["f_orphan", "f_missing_parent"]);
    expect(tree.orphanFolderIds).toEqual(["f_orphan", "f_missing_parent"]);
    expect(tree.orphanItemIds).toEqual(["i_orphan_del", "i_orphan_missing"]);
    expect(tree.rootItems).toHaveLength(3);
  });

  it("breaks self-cycles and multi-node cycles safely without infinite recursion or dropped nodes", () => {
    const folders = [
      { id: "f_self", name: "Self", parentId: "f_self" },
      { id: "f_a", name: "A", parentId: "f_b" },
      { id: "f_b", name: "B", parentId: "f_a" },
      { id: "f_tail", name: "Tail", parentId: "f_a" }
    ];
    const items = [
      { id: "i_self", name: "ISelf", folderId: "f_self" },
      { id: "i_tail", name: "ITail", folderId: "f_tail" }
    ];

    const tree = buildFolderTree(folders, items);
    expect(tree.nodesById.size).toBe(4);
    expect(tree.cycleFolderIds).toEqual(expect.arrayContaining(["f_self", "f_a", "f_b"]));
    expect(tree.cycleFolderIds).not.toContain("f_tail");
    expect(tree.roots.some((r) => r.id === "f_self")).toBe(true);
    expect(tree.nodesById.get("f_tail").totalItemCount).toBe(1);
    expect(tree.nodesById.get("f_self").totalItemCount).toBe(1);
  });
});

describe("collectDescendantFolderIds", () => {
  const treeFolders = [
    { id: "root", name: "Root", parentId: null },
    { id: "c2", name: "C2", parentId: "root", order: 2 },
    { id: "c1", name: "C1", parentId: "root", order: 1 },
    { id: "gc1", name: "GC1", parentId: "c1" },
    { id: "del", name: "Deleted", parentId: "root", isDeleted: true }
  ];

  it("collects strict descendants in BFS order and supports includeSelf", () => {
    expect(collectDescendantFolderIds("root", treeFolders)).toEqual(["c1", "c2", "gc1"]);
    expect(collectDescendantFolderIds("root", treeFolders, { includeSelf: true })).toEqual([
      "root",
      "c1",
      "c2",
      "gc1"
    ]);
    expect(collectDescendantFolderIds("gc1", treeFolders)).toEqual([]);
  });

  it("returns empty array for invalid, unsafe, or missing folderId", () => {
    expect(collectDescendantFolderIds(null, treeFolders)).toEqual([]);
    expect(collectDescendantFolderIds("   ", treeFolders)).toEqual([]);
    expect(collectDescendantFolderIds("__proto__", treeFolders)).toEqual([]);
    expect(collectDescendantFolderIds("missing", treeFolders, { includeSelf: true })).toEqual([]);
    expect(collectDescendantFolderIds("root", treeFolders, null)).toEqual(["c1", "c2", "gc1"]);
  });

  it("terminates cleanly on cyclic graphs without duplicating IDs", () => {
    const cyclic = [
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
      { id: "s", name: "Self", parentId: "s" }
    ];
    expect(collectDescendantFolderIds("a", cyclic)).toEqual(["b"]);
    expect(collectDescendantFolderIds("s", cyclic)).toEqual([]);
  });
});

describe("getFolderDisplayPath", () => {
  const folders = {
    root: { id: "root", name: "Campanha", parentId: null },
    mid: { id: "mid", title: "Missões", parentId: "root" },
    leaf: { id: "leaf", name: "", parentId: "mid" },
    orphan: { id: "orphan", name: "Órfã", parentId: "deleted_parent" },
    deleted_parent: { id: "deleted_parent", name: "Removida", parentId: null, isDeleted: true }
  };

  it("returns joined ancestor path and respects custom separator", () => {
    expect(getFolderDisplayPath("root", folders)).toBe("Campanha");
    expect(getFolderDisplayPath("leaf", folders)).toBe("Campanha / Missões / leaf");
    expect(getFolderDisplayPath("leaf", folders, { separator: " > " })).toBe(
      "Campanha > Missões > leaf"
    );
  });

  it("stops cleanly at missing/deleted ancestors and cycles", () => {
    expect(getFolderDisplayPath("orphan", folders)).toBe("Órfã");
    expect(getFolderDisplayPath("missing", folders)).toBe("");
    expect(getFolderDisplayPath(null, folders)).toBe("");
    expect(getFolderDisplayPath("leaf", folders, null)).toBe("Campanha / Missões / leaf");

    const cyclic = [
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" }
    ];
    expect(getFolderDisplayPath("a", cyclic)).toBe("B / A");
  });
});

describe("validateFolderMove", () => {
  const charRoot = {
    id: "f_char_1",
    name: "Heróis",
    domain: FOLDER_DOMAINS.CHARACTER,
    ownerId: "u1",
    parentId: null
  };
  const charChild = {
    id: "f_char_2",
    name: "Aliados",
    domain: FOLDER_DOMAINS.CHARACTER,
    ownerId: "u1",
    parentId: "f_char_1"
  };
  const charOtherOwner = {
    id: "f_char_3",
    name: "Outro",
    domain: FOLDER_DOMAINS.CHARACTER,
    ownerId: "u2",
    parentId: null
  };
  const journalPartyLore = {
    id: "f_j_party_1",
    name: "Lore",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PARTY,
    noteType: NOTE_TYPES.LORE,
    ownerId: "u1",
    parentId: null
  };
  const journalPartyLoreOtherAuthor = {
    id: "f_j_party_2",
    name: "SubLore",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PARTY,
    noteType: NOTE_TYPES.LORE,
    ownerId: "u2",
    parentId: null
  };
  const journalGmLore = {
    id: "f_j_gm",
    name: "GM Lore",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.GM,
    noteType: NOTE_TYPES.LORE,
    ownerId: "gm1",
    parentId: null
  };
  const journalPlayer1 = {
    id: "f_j_p1",
    name: "Notas U1",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PLAYER,
    noteType: NOTE_TYPES.LORE,
    ownerId: "u1",
    parentId: null
  };
  const journalPlayer2 = {
    id: "f_j_p2",
    name: "Notas U2",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PLAYER,
    noteType: NOTE_TYPES.LORE,
    ownerId: "u2",
    parentId: null
  };
  const journalPartyQuest = {
    id: "f_j_quest",
    name: "Quests",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PARTY,
    noteType: NOTE_TYPES.QUEST,
    ownerId: "u1",
    parentId: null
  };
  const deletedFolder = {
    id: "f_deleted",
    name: "Removida",
    domain: FOLDER_DOMAINS.CHARACTER,
    ownerId: "u1",
    isDeleted: true
  };

  const allFolders = [
    charRoot,
    charChild,
    charOtherOwner,
    journalPartyLore,
    journalPartyLoreOtherAuthor,
    journalGmLore,
    journalPlayer1,
    journalPlayer2,
    journalPartyQuest,
    deletedFolder
  ];

  it("validates folder input and domain", () => {
    expect(validateFolderMove().ok).toBe(false);
    expect(validateFolderMove(null).errors[0].code).toBe(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(validateFolderMove({ folder: { name: "NoId", domain: FOLDER_DOMAINS.CHARACTER } }).errors[0].code).toBe(
      ERROR_CODES.MISSING_REQUIRED_FIELD
    );
    expect(validateFolderMove({ folder: { id: "f1", domain: "unknown" } }).errors[0].code).toBe(
      ERROR_CODES.INVALID_ENUM_VALUE
    );
  });

  it("allows moving to root when targetParentId is null or undefined", () => {
    expect(
      validateFolderMove({ folder: charChild, targetParentId: null, foldersById: allFolders })
    ).toEqual({ ok: true, errors: [] });
    expect(
      validateFolderMove({ folder: charChild, targetParentId: undefined, foldersById: allFolders })
    ).toEqual({ ok: true, errors: [] });
  });

  it("rejects empty/whitespace targetParentId, non-string targetParentId, and missing/deleted targets", () => {
    for (const emptyStr of ["", "   "]) {
      const res = validateFolderMove({
        folder: charChild,
        targetParentId: emptyStr,
        foldersById: allFolders
      });
      expect(res.ok).toBe(false);
      expect(res.errors[0].code).toBe(ERROR_CODES.INVALID_REFERENCE);
    }

    const nonStr = validateFolderMove({
      folder: charChild,
      targetParentId: 42,
      foldersById: allFolders
    });
    expect(nonStr.ok).toBe(false);
    expect(nonStr.errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const missing = validateFolderMove({
      folder: charChild,
      targetParentId: "f_missing",
      foldersById: allFolders
    });
    expect(missing.ok).toBe(false);
    expect(missing.errors[0].code).toBe(ERROR_CODES.INVALID_REFERENCE);

    const deleted = validateFolderMove({
      folder: charChild,
      targetParentId: "f_deleted",
      foldersById: allFolders
    });
    expect(deleted.ok).toBe(false);
    expect(deleted.errors[0].code).toBe(ERROR_CODES.INVALID_REFERENCE);
  });

  it("detects self-parent and ancestor/descendant cycles", () => {
    const selfRes = validateFolderMove({
      folder: charRoot,
      targetParentId: "f_char_1",
      foldersById: allFolders
    });
    expect(selfRes.ok).toBe(false);
    expect(selfRes.errors[0].code).toBe(ERROR_CODES.CYCLE_DETECTED);

    const descRes = validateFolderMove({
      folder: charRoot,
      targetParentId: "f_char_2",
      foldersById: allFolders
    });
    expect(descRes.ok).toBe(false);
    expect(descRes.errors[0].code).toBe(ERROR_CODES.CYCLE_DETECTED);

    // Cycle detected via upward walk
    const brokenDownward = [
      { id: "p", domain: FOLDER_DOMAINS.CHARACTER, ownerId: "u1", parentId: null },
      { id: "c", domain: FOLDER_DOMAINS.CHARACTER, ownerId: "u1", parentId: "p" },
      { id: "orphan_target", domain: FOLDER_DOMAINS.CHARACTER, ownerId: "u1", parentId: "missing_ancestor" }
    ];
    const upwardRes = validateFolderMove({
      folder: { id: "p", domain: FOLDER_DOMAINS.CHARACTER, ownerId: "u1" },
      targetParentId: "c",
      foldersById: brokenDownward
    });
    expect(upwardRes.ok).toBe(false);
    expect(upwardRes.errors[0].code).toBe(ERROR_CODES.CYCLE_DETECTED);

    // Moving into a folder with a missing ancestor stops upward walk cleanly and succeeds if compatible
    const orphanTargetOk = validateFolderMove({
      folder: { id: "p", domain: FOLDER_DOMAINS.CHARACTER, ownerId: "u1" },
      targetParentId: "orphan_target",
      foldersById: brokenDownward
    });
    expect(orphanTargetOk).toEqual({ ok: true, errors: [] });
  });

  it("enforces §6.3.3 domain, character ownerId, and journal scope/noteType/player-ownerId rules", () => {
    // Domain mismatch
    const crossDomain = validateFolderMove({
      folder: charRoot,
      targetParentId: "f_j_party_1",
      foldersById: allFolders
    });
    expect(crossDomain.ok).toBe(false);
    expect(crossDomain.errors[0].code).toBe(ERROR_CODES.INCOMPATIBLE_FOLDER);

    // Character owner mismatch
    const diffCharOwner = validateFolderMove({
      folder: charRoot,
      targetParentId: "f_char_3",
      foldersById: allFolders
    });
    expect(diffCharOwner.ok).toBe(false);
    expect(diffCharOwner.errors[0].code).toBe(ERROR_CODES.INCOMPATIBLE_FOLDER);

    // Journal party scope allows different ownerId when (scope, noteType) match
    expect(
      validateFolderMove({
        folder: journalPartyLoreOtherAuthor,
        targetParentId: "f_j_party_1",
        foldersById: allFolders
      })
    ).toEqual({ ok: true, errors: [] });

    // Journal gm scope allows different ownerId when (scope, noteType) match
    const gmOther = { ...journalGmLore, id: "f_j_gm_2", ownerId: "gm2" };
    expect(
      validateFolderMove({
        folder: gmOther,
        targetParentId: "f_j_gm",
        foldersById: allFolders
      })
    ).toEqual({ ok: true, errors: [] });

    // Journal scope & noteType mismatch
    const scopeAndTypeMismatch = validateFolderMove({
      folder: journalGmLore,
      targetParentId: "f_j_quest",
      foldersById: allFolders
    });
    expect(scopeAndTypeMismatch.ok).toBe(false);
    expect(scopeAndTypeMismatch.errors.map((e) => e.code)).toEqual([
      ERROR_CODES.INCOMPATIBLE_FOLDER,
      ERROR_CODES.INCOMPATIBLE_FOLDER
    ]);

    // Journal player scope requires same ownerId
    const playerDiffOwner = validateFolderMove({
      folder: journalPlayer1,
      targetParentId: "f_j_p2",
      foldersById: allFolders
    });
    expect(playerDiffOwner.ok).toBe(false);
    expect(playerDiffOwner.errors[0].code).toBe(ERROR_CODES.INCOMPATIBLE_FOLDER);

    const playerSameOwner = validateFolderMove({
      folder: { ...journalPlayer1, id: "f_j_p1_sub" },
      targetParentId: "f_j_p1",
      foldersById: allFolders
    });
    expect(playerSameOwner).toEqual({ ok: true, errors: [] });
  });
});

describe("validateItemFolderPlacement", () => {
  const charFolder = {
    id: "f_c",
    domain: FOLDER_DOMAINS.CHARACTER,
    ownerId: "u1"
  };
  const journalPartyFolder = {
    id: "f_jp",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PARTY,
    noteType: NOTE_TYPES.LORE,
    ownerId: "u1"
  };
  const journalPlayerFolder = {
    id: "f_jpl",
    domain: FOLDER_DOMAINS.JOURNAL,
    scope: NOTE_SCOPES.PLAYER,
    noteType: NOTE_TYPES.EVENT,
    ownerId: "u1"
  };

  it("validates item, domain, and targetFolder types and soft deletes", () => {
    expect(validateItemFolderPlacement().ok).toBe(false);
    expect(validateItemFolderPlacement(null).errors[0].code).toBe(
      ERROR_CODES.MISSING_REQUIRED_FIELD
    );
    expect(
      validateItemFolderPlacement({ item: { id: "c1" }, domain: "bad" }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_ENUM_VALUE);
    expect(
      validateItemFolderPlacement({
        item: { id: "c1" },
        targetFolder: "not-object",
        domain: FOLDER_DOMAINS.CHARACTER
      }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_TYPE);
    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: { ...charFolder, isDeleted: true },
        domain: FOLDER_DOMAINS.CHARACTER
      }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_REFERENCE);
  });

  it("allows root placement when targetFolder is null/undefined", () => {
    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: null,
        domain: FOLDER_DOMAINS.CHARACTER
      })
    ).toEqual({ ok: true, errors: [] });
  });

  it("enforces §6.3.4 compatibility for character and journal items", () => {
    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: charFolder
      })
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u2" },
        targetFolder: charFolder
      }).errors[0].code
    ).toBe(ERROR_CODES.INCOMPATIBLE_FOLDER);

    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: charFolder,
        domain: FOLDER_DOMAINS.JOURNAL
      }).errors[0].code
    ).toBe(ERROR_CODES.INCOMPATIBLE_FOLDER);

    expect(
      validateItemFolderPlacement({
        item: {
          id: "n1",
          scope: NOTE_SCOPES.PARTY,
          noteType: NOTE_TYPES.LORE,
          ownerId: "u2"
        },
        targetFolder: journalPartyFolder
      })
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateItemFolderPlacement({
        item: {
          id: "n_player_ok",
          scope: NOTE_SCOPES.PLAYER,
          noteType: NOTE_TYPES.EVENT,
          ownerId: "u1"
        },
        targetFolder: journalPlayerFolder
      })
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateItemFolderPlacement({
        item: { id: "c_no_owner" },
        targetFolder: { id: "f_c_no_owner", domain: FOLDER_DOMAINS.CHARACTER }
      })
    ).toEqual({ ok: true, errors: [] });

    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: [],
        domain: FOLDER_DOMAINS.CHARACTER
      }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_TYPE);

    expect(
      validateItemFolderPlacement({
        item: { id: "c1", ownerId: "u1" },
        targetFolder: { domain: FOLDER_DOMAINS.CHARACTER, isDeleted: true },
        domain: FOLDER_DOMAINS.CHARACTER
      }).errors[0].code
    ).toBe(ERROR_CODES.INVALID_REFERENCE);

    const badJournal = validateItemFolderPlacement({
      item: {
        id: "n2",
        scope: NOTE_SCOPES.GM,
        noteType: NOTE_TYPES.QUEST,
        ownerId: "u2"
      },
      targetFolder: journalPlayerFolder
    });
    expect(badJournal.ok).toBe(false);
    expect(badJournal.errors.map((e) => e.code)).toEqual([
      ERROR_CODES.INCOMPATIBLE_FOLDER,
      ERROR_CODES.INCOMPATIBLE_FOLDER,
      ERROR_CODES.INCOMPATIBLE_FOLDER
    ]);
  });
});
