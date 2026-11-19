import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../../../src/domain/errors.js";
import {
  fromFolderDoc,
  normalizeFolder,
  toFolderDoc,
  validateFolder
} from "../../../../src/domain/models/folder.js";
import {
  LEGACY_NOTE_KEYS,
  fromNoteDoc,
  normalizeNote,
  toNoteDoc,
  validateNote
} from "../../../../src/domain/models/note.js";
import { parseContentToSections } from "../../../../scripts/migrations/M006-notes-v2.mjs";

describe("domain/models/folder", () => {
  it("normalizes character & journal folders, strips v1 keys, and validates §6.3.1/§6.3.3", () => {
    const charFolder = fromFolderDoc(
      {
        campaignId: "camp_1",
        folderType: "character",
        isFolder: true,
        scope: "player",
        title: "Heróis",
        ownerId: "u_1"
      },
      "f_1"
    );
    expect(charFolder.domain).toBe("character");
    expect(charFolder.name).toBe("Heróis");
    expect(charFolder.scope).toBeNull();
    expect(charFolder.noteType).toBeNull();
    expect(charFolder.visibleTo).toEqual(["u_1"]);
    expect(charFolder.editableBy).toEqual(["u_1"]);
    expect(validateFolder(charFolder)).toEqual({ ok: true, errors: [] });

    const charDoc = toFolderDoc(charFolder);
    expect(charDoc).not.toHaveProperty("scope");
    expect(charDoc).not.toHaveProperty("noteType");
    expect(charDoc).not.toHaveProperty("isFolder");
    expect(fromFolderDoc(charDoc, "f_1")).toEqual(charFolder);

    const journalFolder = fromFolderDoc(
      {
        campaignId: "camp_1",
        domain: "journal",
        scope: "gm",
        noteType: "lore",
        name: "Segredos",
        ownerId: "gm_1"
      },
      "f_2"
    );
    expect(journalFolder.visibleTo).toEqual([]);
    expect(validateFolder(journalFolder)).toEqual({ ok: true, errors: [] });
    const jDoc = toFolderDoc(journalFolder);
    expect(jDoc.scope).toBe("gm");
    expect(jDoc.noteType).toBe("lore");
  });

  it('rejects "/" in name, self-parent, hierarchy incompatibility, cycles, and character scope/noteType', () => {
    expect(validateFolder(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const badName = normalizeFolder({
      id: "f_1",
      campaignId: "camp_1",
      domain: "character",
      name: "Pasta/Subpasta",
      parentId: "f_1",
      ownerId: "u_1"
    });
    const codes = validateFolder(badName).errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.INVALID_FOLDER_NAME);
    expect(codes).toContain(ERROR_CODES.CYCLE_DETECTED);

    const charWithScope = {
      ...normalizeFolder({
        id: "f_1",
        campaignId: "camp_1",
        domain: "character",
        name: "Ok",
        ownerId: "u_1"
      }),
      scope: "player",
      noteType: "lore",
      isFolder: true
    };
    expect(validateFolder(charWithScope).errors.map((e) => e.code)).toContain(
      ERROR_CODES.VALIDATION_FAILED
    );

    const incompatible = normalizeFolder({
      id: "f_child",
      campaignId: "camp_1",
      domain: "journal",
      scope: "player",
      noteType: "lore",
      name: "Filha",
      parentId: "f_parent",
      ownerId: "u_2"
    });
    const resIncompat = validateFolder(incompatible, {
      parentFolder: {
        id: "f_parent",
        domain: "journal",
        scope: "player",
        noteType: "lore",
        ownerId: "u_1"
      }
    });
    expect(resIncompat.errors.map((e) => e.code)).toContain(
      ERROR_CODES.INCOMPATIBLE_FOLDER
    );

    const cycleFolders = {
      f_a: { id: "f_a", domain: "character", ownerId: "u_1", parentId: "f_b" },
      f_b: { id: "f_b", domain: "character", ownerId: "u_1", parentId: "f_a" }
    };
    const resCycle = validateFolder(
      normalizeFolder({
        id: "f_a",
        campaignId: "camp_1",
        domain: "character",
        name: "A",
        parentId: "f_b",
        ownerId: "u_1"
      }),
      { foldersById: cycleFolders }
    );
    expect(resCycle.errors.map((e) => e.code)).toContain(
      ERROR_CODES.CYCLE_DETECTED
    );

    expect(
      validateFolder(
        normalizeFolder({
          id: "f_j",
          campaignId: "camp_1",
          domain: "journal",
          scope: "bad_scope",
          noteType: "bad_type",
          name: "Nome",
          ownerId: "u_1"
        })
      ).errors.map((e) => e.code)
    ).toContain(ERROR_CODES.INVALID_ENUM_VALUE);

    expect(
      validateFolder({
        ...normalizeFolder({ id: "", campaignId: "", domain: "bad_domain", name: "Ok", ownerId: "u1" }),
        parentId: "bad/parent",
        order: "NaN",
        isDeleted: "no"
      }).ok
    ).toBe(false);

    expect(
      validateFolder(
        normalizeFolder({
          id: "f_j2",
          campaignId: "c1",
          domain: "journal",
          scope: "player",
          noteType: "lore",
          name: "Sub",
          parentId: "f_p",
          ownerId: "u1"
        }),
        {
          parentFolder: {
            id: "f_p",
            domain: "character",
            ownerId: "u1"
          }
        }
      ).errors.map((e) => e.code)
    ).toContain(ERROR_CODES.INCOMPATIBLE_FOLDER);

    expect(
      validateFolder(
        normalizeFolder({
          id: "f_c2",
          campaignId: "c1",
          domain: "character",
          name: "SubChar",
          parentId: "f_cp",
          ownerId: "u2"
        }),
        {
          foldersById: {
            f_cp: { id: "f_cp", domain: "character", ownerId: "u1", parentId: null }
          }
        }
      ).errors.map((e) => e.code)
    ).toContain(ERROR_CODES.INCOMPATIBLE_FOLDER);

    expect(
      validateFolder(
        normalizeFolder({
          id: "f_j3",
          campaignId: "c1",
          domain: "journal",
          scope: "party",
          noteType: "quest",
          name: "SubQuest",
          parentId: "f_jp",
          ownerId: "u1"
        }),
        {
          parentFolder: {
            id: "f_jp",
            domain: "journal",
            scope: "party",
            noteType: "lore",
            ownerId: "u1"
          }
        }
      ).errors.map((e) => e.code)
    ).toContain(ERROR_CODES.INCOMPATIBLE_FOLDER);

    expect(fromFolderDoc(null, null, null).name).toBe("Nova Pasta");
    expect(
      normalizeFolder(
        {
          name: 123,
          parentId: 45,
          deletedBy: "  ",
          order: "3"
        },
        null
      ).order
    ).toBe(3);
  });
});

describe("domain/models/note", () => {
  it("parses legacy markdown in M006 helper and round-trips v2 note docs cleanly", () => {
    expect(parseContentToSections("")).toEqual({});
    expect(
      parseContentToSections("Intro\n## História\nTexto 1\n## Segredos\nTexto 2")
    ).toEqual({
      sec_1: { id: "sec_1", title: "Notas", content: "Intro", order: 0 },
      sec_2: { id: "sec_2", title: "História", content: "Texto 1", order: 1 },
      sec_3: { id: "sec_3", title: "Segredos", content: "Texto 2", order: 2 }
    });

    const note = fromNoteDoc(
      {
        campaignId: "camp_1",
        scope: "party",
        ownerId: "u_1",
        visibleTo: ["ALL", "u_1", "u_2"],
        editableBy: ["ALL", "u_1"],
        noteType: "lore",
        folderId: "fld_1",
        title: "Pinguinlândia",
        aliases: ["Capital"],
        ignoredAliases: ["Antigo"],
        sections: {
          sec_1: { id: "sec_1", title: "Geral", content: "Capital do gelo", order: 0 }
        },
        image: { mediaId: "med_note", url: null },
        graphPosition: { x: 10, y: 20, pinned: true },
        linkedCharacterId: "char_1",
        relatedNoteIds: ["n_2"],
        rev: 1,
        isDeleted: false
      },
      "note_1"
    );

    expect(note.visibleTo).toEqual(["ALL", "u_1", "u_2"]);
    expect(note.editableBy).toEqual(["ALL", "u_1"]);
    expect(note.folderId).toBe("fld_1");
    expect(note.image).toEqual({ mediaId: "med_note", url: null });
    expect(note.graphPosition).toEqual({ x: 10, y: 20, pinned: true });
    expect(note.linkedCharacterId).toBe("char_1");
    expect(note.sections.sec_1).toEqual({
      id: "sec_1",
      title: "Geral",
      content: "Capital do gelo",
      order: 0
    });
    expect(validateNote(note)).toEqual({ ok: true, errors: [] });

    const docOut = toNoteDoc(note);
    expect(docOut).not.toHaveProperty("id");
    for (const legacyKey of LEGACY_NOTE_KEYS) {
      expect(docOut).not.toHaveProperty(legacyKey);
    }
    expect(fromNoteDoc(docOut, "note_1")).toEqual(note);
  });

  it("validates note invariants, folder compatibility (§6.3.4), and rejects all LEGACY_NOTE_KEYS", () => {
    expect(validateNote(null).errors[0].code).toBe(ERROR_CODES.INVALID_TYPE);

    const badNote = {
      ...normalizeNote({
        id: "n_1",
        campaignId: "camp_1",
        scope: "bad_scope",
        noteType: "bad_type",
        ownerId: "u_1",
        title: "",
        folderId: "bad/ref",
        clonedFromNoteId: "n_1",
        relatedNoteIds: ["n_1", "   "],
        rev: -1
      }),
      content: "legacy",
      mentionedNoteIds: []
    };
    const res = validateNote(badNote, {
      folder: {
        domain: "character",
        scope: "player",
        noteType: "lore",
        ownerId: "other"
      }
    });
    expect(res.ok).toBe(false);
    const codes = res.errors.map((e) => e.code);
    expect(codes).toContain(ERROR_CODES.INVALID_ENUM_VALUE);
    expect(codes).toContain(ERROR_CODES.MISSING_REQUIRED_FIELD);
    expect(codes).toContain(ERROR_CODES.INVALID_REFERENCE);
    expect(codes).toContain(ERROR_CODES.INCOMPATIBLE_FOLDER);
    expect(codes).toContain(ERROR_CODES.VALIDATION_FAILED);
    expect(codes).toContain(ERROR_CODES.OUT_OF_RANGE);

    for (const legacyKey of LEGACY_NOTE_KEYS) {
      const legacyCheck = validateNote({
        ...fromNoteDoc(
          {
            campaignId: "camp_1",
            scope: "player",
            ownerId: "u_1",
            title: "Nota",
            sections: {}
          },
          "n_leg"
        ),
        [legacyKey]: "legacy-val"
      });
      expect(legacyCheck.ok).toBe(false);
      expect(legacyCheck.errors.some((e) => e.details?.field === legacyKey)).toBe(true);
    }

    expect(
      parseContentToSections("## \t\nSem título\n## Segunda\nTexto").sec_1.title
    ).toBe("Seção");

    const arrSectionsNote = fromNoteDoc(
      {
        campaignId: "c1",
        scope: "invalid_scope",
        ownerId: "u1",
        visibleTo: ["u1", "u2"],
        editableBy: ["u1"],
        sections: [{ id: "s1", title: "T", content: "C", order: 0 }, null],
        image: { mediaId: "med_1", url: null },
        graphPosition: { x: "10", y: "20", pinned: false },
        rev: "2",
        deletedBy: " ",
        title: 123,
        folderId: 99,
        linkedCharacterId: 99,
        clonedFromNoteId: 99
      },
      null,
      null
    );
    expect(arrSectionsNote.sections.s1.title).toBe("T");
    expect(arrSectionsNote.rev).toBe(2);
    expect(fromNoteDoc(null, null, null).title).toBe("Sem Título");

    const badSectionsAndGraph = validateNote({
      id: "n_2",
      campaignId: "c1",
      scope: "player",
      noteType: "lore",
      ownerId: "u1",
      visibleTo: ["u1"],
      editableBy: ["u1"],
      title: "Nota",
      folderId: 99,
      linkedCharacterId: "  ",
      clonedFromNoteId: "bad/ref",
      aliases: "bad",
      ignoredAliases: ["  "],
      relatedNoteIds: ["ok"],
      sections: JSON.parse('{"__proto__":{},"bad_null":null,"sec_x":{"id":"wrong","title":1,"content":1,"order":"bad"}}'),
      image: { mediaId: null, url: null },
      graphPosition: { x: "bad", y: "bad", pinned: "no" },
      rev: 0,
      isDeleted: "no"
    });
    expect(badSectionsAndGraph.ok).toBe(false);

    const badRootSubTypes = validateNote({
      id: "n_3",
      campaignId: "c1",
      scope: "player",
      noteType: "lore",
      ownerId: "u1",
      visibleTo: ["u1"],
      editableBy: ["u1"],
      title: "Nota",
      folderId: null,
      linkedCharacterId: null,
      clonedFromNoteId: null,
      aliases: [],
      ignoredAliases: [],
      relatedNoteIds: [],
      sections: "not-map",
      image: { mediaId: null, url: null },
      graphPosition: "not-obj",
      rev: 0,
      isDeleted: false
    });
    expect(badRootSubTypes.ok).toBe(false);

    const blankIdsAndImage = validateNote({
      id: "",
      campaignId: "",
      scope: "player",
      noteType: "lore",
      ownerId: "u1",
      visibleTo: ["u1"],
      editableBy: ["u1"],
      title: "Nota",
      folderId: null,
      linkedCharacterId: null,
      clonedFromNoteId: null,
      aliases: [],
      ignoredAliases: [],
      relatedNoteIds: [],
      sections: { "  ": { id: " ", title: "Ignorada", content: "", order: 0 } },
      image: { mediaId: "med_both", url: "https://example.com/a.png" },
      graphPosition: { x: null, y: null, pinned: false },
      rev: 0,
      isDeleted: false
    });
    expect(blankIdsAndImage.ok).toBe(false);

    const blankSecKey = normalizeNote({
      sections: { "  ": { title: "Ignorada" } },
      graphPosition: { x: 1, y: 2, pinned: false },
      deletedBy: "gm_1"
    });
    expect(blankSecKey.sections).toEqual({});
    expect(blankSecKey.deletedBy).toBe("gm_1");
  });
});
