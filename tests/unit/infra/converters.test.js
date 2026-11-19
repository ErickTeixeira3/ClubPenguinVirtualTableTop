import { describe, expect, it } from "vitest";
import {
  CHARACTER_TYPES,
  DRAWING_TYPES,
  FOLDER_DOMAINS,
  LAYER_NAMES,
  MESSAGE_TYPES,
  NOTE_SCOPES,
  NOTE_TYPES,
  PING_KINDS,
  PRESENCE_KINDS,
  TOKEN_KINDS
} from "../../../src/domain/constants.js";
import {
  FIRESTORE_CONVERTERS,
  RTDB_MAPPERS,
  appConfigConverter,
  campaignConverter,
  characterConverter,
  chatStateConverter,
  combineToken,
  compendiumEntryConverter,
  drawingMapper,
  fogAreaMapper,
  fogMapper,
  folderConverter,
  inviteConverter,
  mediaConverter,
  memberConverter,
  messageConverter,
  noteConverter,
  pendingCostConverter,
  pingMapper,
  platformAdminConverter,
  presenceMapper,
  projectPublicBars,
  sceneConverter,
  splitTokenDoc,
  tokenMapper,
  tokenSecretMapper,
  turnStateConverter
} from "../../../src/infra/converters/index.js";

function makeFirestoreSnap(id, data, parentCollection = "characters", campaignId = "camp_1") {
  return {
    id,
    data: () => data,
    ref: {
      id,
      parent: {
        id: parentCollection,
        parent: campaignId
          ? {
              id: campaignId,
              parent: { id: "campaigns" }
            }
          : null
      }
    }
  };
}

describe("firestoreConverters", () => {
  it("expõe os 15 conversores no mapa FIRESTORE_CONVERTERS", () => {
    expect(Object.keys(FIRESTORE_CONVERTERS).sort()).toEqual([
      "appConfig",
      "campaign",
      "character",
      "chatState",
      "compendiumEntry",
      "folder",
      "invite",
      "media",
      "member",
      "message",
      "note",
      "pendingCost",
      "platformAdmin",
      "scene",
      "turnState"
    ]);
  });

  it("remove undefined na saída e injeta id/campaignId da referência do snapshot", () => {
    class FakeFieldValue {
      constructor(methodName) {
        this._methodName = methodName;
      }
    }
    const sentinel = new FakeFieldValue("serverTimestamp");
    const docData = characterConverter.toFirestore({
      campaignId: "camp_1",
      type: CHARACTER_TYPES.PC,
      ownerId: "u1",
      name: "Pingu",
      notes: undefined,
      createdAt: sentinel
    });
    expect(Object.hasOwn(docData, "notes")).toBe(true);
    expect(docData.notes).toBe("");
    expect(docData.createdAt).toBe(sentinel);

    const parsed = characterConverter.fromFirestore(
      makeFirestoreSnap("char_1", {
        type: CHARACTER_TYPES.PC,
        ownerId: "u1",
        name: "Pingu"
      })
    );
    expect(parsed.id).toBe("char_1");
    expect(parsed.campaignId).toBe("camp_1");
    expect(parsed.resources.hp.max).toBe(25);
  });

  it("executa ida e volta em todos os demais modelos do Firestore", () => {
    const campSnap = {
      id: "camp_1",
      data: () => ({ name: "Mesa", gmId: "gm1" }),
      ref: { id: "camp_1", parent: { id: "campaigns", parent: null } }
    };
    const camp = campaignConverter.fromFirestore(campSnap);
    expect(camp.campaignId).toBe("camp_1");
    expect(campaignConverter.toFirestore(camp).gmId).toBe("gm1");

    const member = memberConverter.fromFirestore(
      makeFirestoreSnap("u1", { displayName: "Ana" }, "members")
    );
    expect(member.uid).toBe("u1");
    expect(memberConverter.toFirestore(member).displayName).toBe("Ana");

    const invite = inviteConverter.fromFirestore(
      makeFirestoreSnap("ana@x.com", { defaultDisplayName: "Ana" }, "invites")
    );
    expect(invite.email).toBe("ana@x.com");
    expect(inviteConverter.toFirestore(invite).defaultDisplayName).toBe("Ana");

    const folder = folderConverter.fromFirestore(
      makeFirestoreSnap(
        "f1",
        { domain: FOLDER_DOMAINS.CHARACTER, name: "Heróis", ownerId: "u1" },
        "folders"
      )
    );
    expect(folder.id).toBe("f1");
    expect(folderConverter.toFirestore(folder).name).toBe("Heróis");

    const note = noteConverter.fromFirestore(
      makeFirestoreSnap(
        "n1",
        {
          scope: NOTE_SCOPES.PARTY,
          noteType: NOTE_TYPES.LORE,
          ownerId: "u1",
          title: "Pista"
        },
        "notes"
      )
    );
    expect(note.id).toBe("n1");
    expect(noteConverter.toFirestore(note).title).toBe("Pista");

    const scene = sceneConverter.fromFirestore(
      makeFirestoreSnap("s1", { name: "Mapa" }, "scenes")
    );
    expect(scene.id).toBe("s1");
    expect(sceneConverter.toFirestore(scene).grid.cellSizePx).toBe(64);

    const comp = compendiumEntryConverter.fromFirestore(
      makeFirestoreSnap("ce1", { name: "Bola de Neve", type: "spell" }, "compendium")
    );
    expect(comp.id).toBe("ce1");
    expect(compendiumEntryConverter.toFirestore(comp).name).toBe("Bola de Neve");

    const msg = messageConverter.fromFirestore(
      makeFirestoreSnap(
        "m1",
        {
          type: MESSAGE_TYPES.TEXT,
          seq: 1,
          sender: { uid: "u1", displayName: "Ana" },
          content: "Olá"
        },
        "messages"
      )
    );
    expect(msg.id).toBe("m1");
    expect(messageConverter.toFirestore(msg).seq).toBe(1);

    const media = mediaConverter.fromFirestore(
      makeFirestoreSnap(
        "med1",
        { category: "avatar", mimeType: "image/webp", dataUrl: "data:image/webp;base64,AA==", uploadedBy: "u1" },
        "media"
      )
    );
    expect(media.id).toBe("med1");
    expect(mediaConverter.toFirestore(media).uploadedBy).toBe("u1");

    const turnDoc = turnStateConverter.toFirestore({ active: true, round: 2 });
    expect(turnStateConverter.fromFirestore({ id: "turn", data: () => turnDoc }).round).toBe(2);

    const chatDoc = chatStateConverter.toFirestore({ lastSeq: 12, lastMessageId: "m12" });
    expect(chatStateConverter.fromFirestore({ id: "chat", data: () => chatDoc }).lastSeq).toBe(12);

    const cost = pendingCostConverter.fromFirestore(
      makeFirestoreSnap(
        "op1",
        { characterId: "ch1", sourceMessageId: "m1", createdBy: "u1", costs: { mp: 2 } },
        "pendingCosts"
      )
    );
    expect(cost.opId).toBe("op1");
    expect(pendingCostConverter.toFirestore(cost).costs.mp).toBe(2);

    const cfgDoc = appConfigConverter.toFirestore({ minClientVersion: "2.0.0", schemaVersion: 2 });
    expect(appConfigConverter.fromFirestore({ id: "runtime", data: () => cfgDoc }).minClientVersion).toBe("2.0.0");

    const admin = platformAdminConverter.fromFirestore({ id: "adm1", data: () => ({}) });
    expect(admin.uid).toBe("adm1");
    expect(platformAdminConverter.toFirestore(admin).uid).toBe("adm1");
  });
});

describe("rtdbMappers", () => {
  it("expõe os 7 mapeadores no mapa RTDB_MAPPERS e trata snapshots nulos", () => {
    expect(Object.keys(RTDB_MAPPERS).sort()).toEqual([
      "drawing",
      "fog",
      "fogArea",
      "ping",
      "presence",
      "token",
      "tokenSecret"
    ]);
    expect(tokenMapper.fromRtdb(null)).toBeNull();
    expect(tokenMapper.fromRtdb({ key: "t1", val: () => null })).toBeNull();
  });

  it("preserva ServerValue.TIMESTAMP e executa mapeamento público/secreto", () => {
    const svTimestamp = { ".sv": "timestamp" };

    const pingPayload = pingMapper.toRtdb({
      id: "p1",
      authorId: "u1",
      kind: PING_KINDS.PING,
      x: 100,
      y: 200,
      createdAt: svTimestamp
    });
    expect(pingPayload.createdAt).toEqual(svTimestamp);

    const pingParsed = pingMapper.fromRtdb({
      key: "p1",
      val: () => ({ authorId: "u1", kind: PING_KINDS.PING, x: 10, y: 20, createdAt: 1000 })
    });
    expect(pingParsed.id).toBe("p1");

    const tokPayload = tokenMapper.toRtdb({
      id: "t1",
      kind: TOKEN_KINDS.NPC,
      ownerId: "gm1",
      layer: LAYER_NAMES.TOKENS,
      updatedAt: svTimestamp
    });
    expect(tokPayload.updatedAt).toEqual(svTimestamp);

    const secret = tokenSecretMapper.fromRtdb({
      defense: 14,
      hp: { current: 10, max: 20 },
      showBarsToPlayers: true
    });
    expect(projectPublicBars(secret)).toEqual({
      hpCurrent: 10,
      hpMax: 20,
      mpCurrent: null,
      mpMax: null
    });

    const split = splitTokenDoc({
      id: "t1",
      ownerId: "gm1",
      isGmToken: true,
      defense: 15,
      hpCurrent: 8,
      hpMax: 12
    });
    expect(split.publicDoc.bars.hpCurrent).toBe(8);
    expect(split.secretDoc.defense).toBe(15);
    expect(combineToken(split.publicDoc, split.secretDoc).secrets.hp.max).toBe(12);

    const drawing = drawingMapper.fromRtdb({
      key: "d1",
      val: () => ({ type: DRAWING_TYPES.STROKE, authorId: "u1", layer: "tokens", points: [{ x: 0, y: 0 }] })
    });
    expect(drawing.id).toBe("d1");
    expect(drawingMapper.toRtdb({ ...drawing, createdAt: svTimestamp }).createdAt).toEqual(svTimestamp);

    const fog = fogMapper.toRtdb({
      enabled: true,
      areas: { a1: { id: "a1", op: "reveal", x: 0, y: 0, w: 64, h: 64, createdAt: svTimestamp } },
      updatedAt: svTimestamp
    });
    expect(fog.updatedAt).toEqual(svTimestamp);
    expect(fog.areas.a1.createdAt).toEqual(svTimestamp);
    expect(fogAreaMapper.fromRtdb({ id: "a1", op: "hide", x: 1, y: 2, w: 30, h: 40 }).w).toBe(30);

    const presence = presenceMapper.toRtdb({
      kind: PRESENCE_KINDS.SHEET,
      sheetId: "ch1",
      connectedAt: svTimestamp
    });
    expect(presence.connectedAt).toEqual(svTimestamp);
    expect(presenceMapper.fromRtdb({ kind: PRESENCE_KINDS.MAIN, connectedAt: 55 }).sheetId).toBeNull();
  });
});
