// Testes adversariais das Regras de Segurança na Fase 4 (Apêndice B, blocos B3 e B4).
import fs from "node:fs";
import path from "node:path";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const CAMPAIGN = "main-table";
let env;

const seed = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx));
const fsAs = (uid) => env.authenticatedContext(uid, { email_verified: true }).firestore();

async function seedStandardCampaign() {
  await seed(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
      campaignId: CAMPAIGN,
      gmId: "gm_a",
      name: "Mesa Fase 4"
    });
    for (const uid of ["gm_a", "player1", "player2", "outsider_member"]) {
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/members/${uid}`), {
        uid,
        campaignId: CAMPAIGN,
        displayName: uid,
        avatar: { mediaId: null, url: null },
        activeCharacterId: null
      });
    }
  });
}

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-cpvtt-test",
    firestore: {
      rules: fs.readFileSync(path.join(repoRoot, "firestore.rules"), "utf8")
    }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

describe("B3 — Bypass de ownerId, visibilidade canônica e invariantes (Apêndice B)", () => {
  it("B3.1: bloqueia sequência do exploit (remover ownerId -> assumir ownerId -> soft delete) em notes e folders", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_exploit`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        title: "Segredo",
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/f_exploit`), {
        campaignId: CAMPAIGN,
        domain: "character",
        ownerId: "player1",
        visibleTo: ["ALL", "player1"],
        editableBy: ["player1", "player2"],
        name: "Pasta",
        isDeleted: false
      });
    });

    const p2 = fsAs("player2");

    // Passo 1, 2 e 3 bloqueados em note (party / editableBy)
    const noteRef = doc(p2, `campaigns/${CAMPAIGN}/notes/n_exploit`);
    await assertFails(updateDoc(noteRef, { ownerId: deleteField() }));
    await assertFails(updateDoc(noteRef, { ownerId: "player2" }));
    await assertFails(
      updateDoc(noteRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: "player2"
      })
    );

    // Passo 1, 2 e 3 bloqueados em folder (editableBy)
    const folderRef = doc(p2, `campaigns/${CAMPAIGN}/folders/f_exploit`);
    await assertFails(updateDoc(folderRef, { ownerId: deleteField() }));
    await assertFails(updateDoc(folderRef, { ownerId: "player2" }));
    await assertFails(
      updateDoc(folderRef, {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: "player2"
      })
    );

    // Edição de conteúdo pelo editor não-dono continua permitida
    await assertSucceeds(updateDoc(noteRef, { title: "Editado pelo grupo" }));
    await assertSucceeds(updateDoc(folderRef, { name: "Pasta Renomeada" }));
  });

  it("B3.2: editor não-dono não altera visibleTo, editableBy nem scope em notes e folders; dono consegue com invariantes", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n1`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "player",
        visibleTo: ["player1", "player2"],
        editableBy: ["player1", "player2"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/f1`), {
        campaignId: CAMPAIGN,
        folderType: "journal",
        scope: "player",
        ownerId: "player1",
        visibleTo: ["player1", "player2"],
        editableBy: ["player1", "player2"],
        isDeleted: false
      });
    });

    const p2 = fsAs("player2");
    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n1`), {
        visibleTo: ["player1", "player2", "outsider_member"]
      })
    );
    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n1`), {
        editableBy: ["player1"]
      })
    );
    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n1`), {
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"]
      })
    );
    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/folders/f1`), {
        visibleTo: ["ALL", "player1"]
      })
    );

    // Dono pode promover para party quando invariantes forem satisfeitos
    const p1 = fsAs("player1");
    await assertSucceeds(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n1`), {
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"]
      })
    );
  });

  it("B3.3 & B3.4: scope/party sem ALL e exclusão de ownerId de visibleTo/editableBy falham", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_inv`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "player",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/characters/c_inv`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        type: "pc",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        isDeleted: false
      });
    });

    const p1 = fsAs("player1");
    const gm = fsAs("gm_a");

    // B3.3: scope == party sem ALL em visibleTo ou editableBy -> assertFails
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_inv`), {
        scope: "party",
        visibleTo: ["player1"],
        editableBy: ["ALL", "player1"]
      })
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_inv`), {
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["player1"]
      })
    );
    // B3.3 complementar: scope == gm com ALL falha mesmo para o Mestre
    await assertFails(
      setDoc(doc(gm, `campaigns/${CAMPAIGN}/notes/n_gm_bad`), {
        campaignId: CAMPAIGN,
        ownerId: "gm_a",
        scope: "gm",
        visibleTo: ["ALL"],
        editableBy: ["gm_a"],
        isDeleted: false
      })
    );

    // B3.4: ownerId excluído de visibleTo ou editableBy -> assertFails
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_inv`), {
        visibleTo: ["player2"]
      })
    );
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_inv`), {
        editableBy: ["player2"]
      })
    );
    await assertFails(
      updateDoc(doc(gm, `campaigns/${CAMPAIGN}/characters/c_inv`), {
        visibleTo: ["player2"]
      })
    );
  });

  it("B3.5: não-Mestre não altera type, ownerId, visibleTo ou editableBy em characters", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/characters/c_p1`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        type: "pc",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        isDeleted: false
      });
    });

    const p1 = fsAs("player1");
    const ref = doc(p1, `campaigns/${CAMPAIGN}/characters/c_p1`);
    await assertFails(updateDoc(ref, { type: "npc" }));
    await assertFails(updateDoc(ref, { ownerId: "player2" }));
    await assertFails(updateDoc(ref, { visibleTo: ["ALL", "player1"] }));
    await assertFails(updateDoc(ref, { editableBy: ["player1", "player2"] }));
    // Dono pode atualizar campos da própria ficha
    await assertSucceeds(updateDoc(ref, { name: "Pinguim Renovado" }));
  });

  it("canSeeResource exige visibleTo canônico sem fallbacks legados e queries funcionam", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/scenes/s_legacy_flag`), {
        campaignId: CAMPAIGN,
        visibleToPlayers: true,
        visibleTo: ["gm_a"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/scenes/s_pub`), {
        campaignId: CAMPAIGN,
        visibleTo: ["ALL"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_owner_missing`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "player",
        visibleTo: ["gm_a"],
        editableBy: ["player1"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_party_missing_all`), {
        campaignId: CAMPAIGN,
        ownerId: "gm_a",
        scope: "party",
        visibleTo: ["gm_a"],
        editableBy: ["ALL", "gm_a"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_gm_leak`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "gm",
        visibleTo: ["ALL", "player1"],
        editableBy: ["gm_a"],
        isDeleted: false
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/compendium/comp_pub`), {
        campaignId: CAMPAIGN,
        visibleTo: ["ALL"],
        isDeleted: false
      });
    });

    const p1 = fsAs("player1");
    const gm = fsAs("gm_a");

    // Fallbacks legados não dão leitura fora de visibleTo
    await assertFails(getDoc(doc(p1, `campaigns/${CAMPAIGN}/scenes/s_legacy_flag`)));
    await assertFails(getDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_owner_missing`)));
    await assertFails(getDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_party_missing_all`)));
    await assertFails(getDoc(doc(p1, `campaigns/${CAMPAIGN}/notes/n_gm_leak`)));

    // Escrever visibleToPlayers em scenes ou compendium falha
    await assertFails(
      setDoc(doc(gm, `campaigns/${CAMPAIGN}/scenes/s_bad_flag`), {
        campaignId: CAMPAIGN,
        visibleToPlayers: true,
        visibleTo: ["ALL"],
        isDeleted: false
      })
    );
    await assertFails(
      setDoc(doc(gm, `campaigns/${CAMPAIGN}/compendium/comp_bad_flag`), {
        campaignId: CAMPAIGN,
        visibleToPlayers: false,
        visibleTo: ["gm_a"],
        isDeleted: false
      })
    );

    // Consulta canônica combinada visibleTo + isDeleted funciona no emulador
    const scenesSnap = await assertSucceeds(
      getDocs(
        query(
          collection(p1, `campaigns/${CAMPAIGN}/scenes`),
          where("visibleTo", "array-contains-any", ["ALL", "player1"]),
          where("isDeleted", "==", false)
        )
      )
    );
    expect(scenesSnap.docs.map((d) => d.id)).toEqual(["s_pub"]);

    const compSnap = await assertSucceeds(
      getDocs(
        query(
          collection(p1, `campaigns/${CAMPAIGN}/compendium`),
          where("visibleTo", "array-contains-any", ["ALL", "player1"]),
          where("isDeleted", "==", false)
        )
      )
    );
    expect(compSnap.docs.map((d) => d.id)).toEqual(["comp_pub"]);
  });
});

describe("B4 — Mídia v2 imutável, audiência monotônica e chunks bloqueados (Apêndice B)", () => {
  it("B4.1 & B4.2: valida limite 800KB real de dataUrl, campos v2 e uploadedBy == auth.uid", async () => {
    await seedStandardCampaign();
    const p1 = fsAs("player1");

    const hugeDataUrl = `data:image/webp;base64,${"A".repeat(800000)}`;
    // B4.1: dataUrl >= 800KB mesmo declarando byteLength menor -> assertFails
    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_huge`), {
        campaignId: CAMPAIGN,
        category: "scene",
        mimeType: "image/webp",
        widthPx: 100,
        heightPx: 100,
        byteLength: 100,
        dataUrl: hugeDataUrl,
        uploadedBy: "player1",
        visibleTo: ["player1"],
        createdAt: serverTimestamp()
      })
    );

    // Campos legados sizeBytes ou isDeleted não são aceitos
    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_legacy`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 100,
        heightPx: 100,
        byteLength: 50,
        sizeBytes: 50,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player1",
        visibleTo: ["player1"]
      })
    );

    // B4.2: spoof de uploadedBy != auth.uid -> assertFails
    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_spoof`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 100,
        heightPx: 100,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player2",
        visibleTo: ["player1", "player2"]
      })
    );

    // Criação válida v2 funciona
    await assertSucceeds(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_ok`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 128,
        heightPx: 128,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player1",
        visibleTo: ["player1"],
        createdAt: serverTimestamp()
      })
    );
  });

  it("B4.3: payload imutável e expansão estritamente monotônica de visibleTo; exclusão negada", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/media/med_1`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 128,
        heightPx: 128,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player1",
        visibleTo: ["player1"],
        createdAt: serverTimestamp()
      });
    });

    const p1 = fsAs("player1");
    const p2 = fsAs("player2");
    const outsider = fsAs("outsider_member");
    const gm = fsAs("gm_a");

    // B4.3: alterar dataUrl ou qualquer campo fora visibleTo falha (até para uploader e GM)
    await assertFails(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_1`), {
        dataUrl: "data:image/webp;base64,QkJC"
      })
    );
    await assertFails(
      updateDoc(doc(gm, `campaigns/${CAMPAIGN}/media/med_1`), {
        byteLength: 10
      })
    );
    await assertFails(deleteDoc(doc(gm, `campaigns/${CAMPAIGN}/media/med_1`)));

    // B4.3: estranho fora de visibleTo não expande
    await assertFails(
      updateDoc(doc(outsider, `campaigns/${CAMPAIGN}/media/med_1`), {
        visibleTo: ["player1", "outsider_member"]
      })
    );

    // Uploader expande monotonicamente para player2
    await assertSucceeds(
      updateDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_1`), {
        visibleTo: ["player1", "player2"]
      })
    );

    // Membro atual (player2) expande monotonicamente para ALL
    await assertSucceeds(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/media/med_1`), {
        visibleTo: ["player1", "player2", "ALL"]
      })
    );

    // Encolher visibleTo falha até para o GM
    await assertFails(
      updateDoc(doc(gm, `campaigns/${CAMPAIGN}/media/med_1`), {
        visibleTo: ["player1"]
      })
    );
  });

  it("B4.4: leitura por ID respeita visibleTo; listagem completa só para o Mestre", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/media/med_priv`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 64,
        heightPx: 64,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player1",
        visibleTo: ["player1"]
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/media/med_pub`), {
        campaignId: CAMPAIGN,
        category: "scene",
        mimeType: "image/webp",
        widthPx: 64,
        heightPx: 64,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "gm_a",
        visibleTo: ["ALL"]
      });
    });

    const p1 = fsAs("player1");
    const p2 = fsAs("player2");
    const gm = fsAs("gm_a");

    await assertSucceeds(getDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_priv`)));
    await assertFails(getDoc(doc(p2, `campaigns/${CAMPAIGN}/media/med_priv`)));
    await assertSucceeds(getDoc(doc(p2, `campaigns/${CAMPAIGN}/media/med_pub`)));

    // list da coleção negado para não-GM
    await assertFails(getDocs(collection(p1, `campaigns/${CAMPAIGN}/media`)));
    await assertFails(
      getDocs(
        query(
          collection(p1, `campaigns/${CAMPAIGN}/media`),
          where("visibleTo", "array-contains-any", ["ALL", "player1"])
        )
      )
    );
    // GM pode listar
    const gmList = await assertSucceeds(getDocs(collection(gm, `campaigns/${CAMPAIGN}/media`)));
    expect(gmList.docs).toHaveLength(2);
  });

  it("B4.5: qualquer leitura ou escrita em media/*/chunks/* falha", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/media/med_1`), {
        campaignId: CAMPAIGN,
        category: "avatar",
        mimeType: "image/webp",
        widthPx: 64,
        heightPx: 64,
        byteLength: 27,
        dataUrl: "data:image/webp;base64,QUFB",
        uploadedBy: "player1",
        visibleTo: ["player1"]
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/media/med_1/chunks/0`), {
        index: 0,
        data: "chunk"
      });
    });

    const p1 = fsAs("player1");
    const gm = fsAs("gm_a");

    await assertFails(getDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_1/chunks/0`)));
    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_1/chunks/1`), { data: "x" })
    );
    await assertFails(getDoc(doc(gm, `campaigns/${CAMPAIGN}/media/med_1/chunks/0`)));
    await assertFails(
      setDoc(doc(gm, `campaigns/${CAMPAIGN}/media/med_1/chunks/1`), { data: "x" })
    );
  });

  it("B4.6: create de media bloqueia non-dataUrl e campos soft-delete (deletedAt/deletedBy/updatedAt)", async () => {
    await seedStandardCampaign();
    const p1 = fsAs("player1");

    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_not_data`), {
        campaignId: CAMPAIGN,
        uploadedBy: "player1",
        dataUrl: "not-a-data-url",
        byteLength: 15,
        visibleTo: ["player1"]
      })
    );

    for (const extra of [
      { deletedAt: 123 },
      { deletedBy: "player1" },
      { updatedAt: 123 }
    ]) {
      await assertFails(
        setDoc(doc(p1, `campaigns/${CAMPAIGN}/media/med_extra_${Object.keys(extra)[0]}`), {
          campaignId: CAMPAIGN,
          uploadedBy: "player1",
          dataUrl: "data:image/webp;base64,QUFB",
          byteLength: 27,
          visibleTo: ["player1"],
          ...extra
        })
      );
    }
  });
});

describe("B3/Regressão — assignGM, editor não-dono e bloqueio de scope em characters", () => {
  it("após assignGM, antigo Mestre não lê scope='gm' e suas queries canônicas de notes/folders não quebram", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_gm_secret`), {
        campaignId: CAMPAIGN,
        ownerId: "gm_a",
        scope: "gm",
        visibleTo: [],
        editableBy: [],
        isDeleted: false,
        title: "Segredo"
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_party_ok`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        isDeleted: false,
        title: "Pública"
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/f_gm_secret`), {
        campaignId: CAMPAIGN,
        ownerId: "gm_a",
        domain: "journal",
        scope: "gm",
        visibleTo: [],
        editableBy: [],
        isDeleted: false,
        name: "Pasta Secreta"
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/folders/f_char_ok`), {
        campaignId: CAMPAIGN,
        ownerId: "gm_a",
        domain: "character",
        visibleTo: ["ALL", "gm_a"],
        editableBy: ["ALL", "gm_a"],
        isDeleted: false,
        name: "Pasta Heróis"
      });
      // assignGM(player2)
      await setDoc(doc(db, `campaigns/${CAMPAIGN}`), {
        campaignId: CAMPAIGN,
        gmId: "player2",
        name: "Mesa Fase 4"
      });
    });

    const formerGm = fsAs("gm_a");
    const newGm = fsAs("player2");

    await assertFails(getDoc(doc(formerGm, `campaigns/${CAMPAIGN}/notes/n_gm_secret`)));
    await assertFails(getDoc(doc(formerGm, `campaigns/${CAMPAIGN}/folders/f_gm_secret`)));
    await assertSucceeds(getDoc(doc(newGm, `campaigns/${CAMPAIGN}/notes/n_gm_secret`)));
    await assertSucceeds(getDoc(doc(newGm, `campaigns/${CAMPAIGN}/folders/f_gm_secret`)));

    const notesSnap = await assertSucceeds(
      getDocs(
        query(
          collection(formerGm, `campaigns/${CAMPAIGN}/notes`),
          where("isDeleted", "==", false),
          where("visibleTo", "array-contains-any", ["ALL", "gm_a"])
        )
      )
    );
    expect(notesSnap.docs.map((d) => d.id)).toEqual(["n_party_ok"]);

    const foldersSnap = await assertSucceeds(
      getDocs(
        query(
          collection(formerGm, `campaigns/${CAMPAIGN}/folders`),
          where("isDeleted", "==", false),
          where("visibleTo", "array-contains-any", ["ALL", "gm_a"])
        )
      )
    );
    expect(foldersSnap.docs.map((d) => d.id)).toEqual(["f_char_ok"]);
  });

  it("editor não-dono atualiza título/conteúdo em nota party e player compartilhada sem reescrever scope/audiência", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_party_edit`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        isDeleted: false,
        title: "Original"
      });
      await setDoc(doc(db, `campaigns/${CAMPAIGN}/notes/n_shared_edit`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        scope: "player",
        visibleTo: ["player1", "player2"],
        editableBy: ["player1", "player2"],
        isDeleted: false,
        title: "Compartilhada"
      });
    });

    const p2 = fsAs("player2");
    await assertSucceeds(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n_party_edit`), {
        title: "Editada por P2"
      })
    );
    await assertSucceeds(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n_shared_edit`), {
        title: "Editada Compartilhada"
      })
    );
    // Mesmo sem campaignId legado no doc, não-GM não pode injetar campaignId estrangeiro
    await seed(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/notes/n_legacy_nocamp`), {
        ownerId: "player1",
        scope: "party",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        isDeleted: false,
        title: "Sem campaignId"
      });
    });
    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/notes/n_legacy_nocamp`), {
        campaignId: "other-campaign",
        title: "Sequestro"
      })
    );
  });

  it("não-Mestre não pode criar nem injetar scope='gm' em characters", async () => {
    await seedStandardCampaign();
    await seed(async (ctx) => {
      await setDoc(doc(ctx.firestore(), `campaigns/${CAMPAIGN}/characters/c_pc`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        type: "pc",
        visibleTo: ["ALL", "player1"],
        editableBy: ["ALL", "player1"],
        isDeleted: false,
        name: "Herói"
      });
    });

    const p1 = fsAs("player1");
    const p2 = fsAs("player2");

    await assertFails(
      setDoc(doc(p1, `campaigns/${CAMPAIGN}/characters/c_bad_scope`), {
        campaignId: CAMPAIGN,
        ownerId: "player1",
        type: "pc",
        scope: "gm",
        visibleTo: ["player1"],
        editableBy: ["player1"],
        isDeleted: false,
        name: "Bad"
      })
    );

    await assertFails(
      updateDoc(doc(p2, `campaigns/${CAMPAIGN}/characters/c_pc`), {
        scope: "gm",
        name: "Sequestro"
      })
    );

    await assertSucceeds(getDoc(doc(p1, `campaigns/${CAMPAIGN}/characters/c_pc`)));
  });
});
