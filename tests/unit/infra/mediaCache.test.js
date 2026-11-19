import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import {
  buildMediaCacheKey,
  createMediaCache
} from "../../../src/infra/mediaCache.js";

const mockDocs = new Map();

vi.mock("firebase/firestore", () => ({
  doc: (_db, ...parts) => {
    const fullPath = parts.join("/");
    const segs = fullPath.split("/");
    return { kind: "doc", id: segs[segs.length - 1], path: fullPath };
  },
  getDoc: async (ref) => {
    const data = mockDocs.get(ref.path) ?? null;
    return { id: ref.id, exists: () => data !== null, data: () => data };
  },
  setDoc: async () => {},
  updateDoc: async () => {},
  serverTimestamp: () => "__SERVER_TIMESTAMP__"
}));
vi.mock("../../../src/infra/firebase.js", () => ({ db: {}, DEFAULT_CAMPAIGN_ID: "main-table" }));

const mediaService = await import("../../../src/services/mediaService.js");
const { clearMediaCache } = await import("../../../src/infra/mediaCache.js");

function createFakeIndexedDbFactory() {
  const records = new Map();
  let openCalls = 0;
  let getCalls = 0;
  let putCalls = 0;
  let closeCalls = 0;

  const factory = {
    open() {
      openCalls += 1;
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null
      };
      const db = {
        objectStoreNames: {
          contains: () => true
        },
        createObjectStore: () => {},
        onclose: null,
        onversionchange: null,
        close: () => {
          closeCalls += 1;
          db.onclose?.();
        },
        transaction: () => {
          const tx = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: () => ({
              get: (key) => {
                getCalls += 1;
                const getReq = { result: undefined, error: null, onsuccess: null, onerror: null };
                queueMicrotask(() => {
                  getReq.result = records.get(key) ?? null;
                  getReq.onsuccess?.();
                });
                return getReq;
              },
              put: (val, key) => {
                putCalls += 1;
                records.set(key, val);
                queueMicrotask(() => {
                  tx.oncomplete?.();
                });
              }
            })
          };
          return tx;
        }
      };
      req.result = db;
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    }
  };

  return {
    factory,
    records,
    stats: () => ({ openCalls, getCalls, putCalls, closeCalls })
  };
}

beforeEach(async () => {
  mockDocs.clear();
  await clearMediaCache({ closeDb: true });
});

describe("mediaCache", () => {
  it("exige campaignId válido e rejeita 'default' (INT-15)", () => {
    expect(buildMediaCacheKey("camp_1", "med_1")).toBe("camp_1:med_1");
    for (const badCamp of ["", " ", "default", "DEFAULT", null, undefined]) {
      expect(() => buildMediaCacheKey(badCamp, "med_1")).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
    for (const badMedia of ["", " ", null, undefined]) {
      expect(() => buildMediaCacheKey("camp_1", badMedia)).toThrowError(
        expect.objectContaining({ code: ERROR_CODES.INVALID_REFERENCE })
      );
    }
  });

  it("reutiliza conexão única com o IndexedDB e isola cache por campanha (sem fallback sem campanha)", async () => {
    const fakeIdb = createFakeIndexedDbFactory();
    const cache = createMediaCache({ indexedDBFactory: fakeIdb.factory });

    await cache.set("camp_a", "med_shared", "data:image/webp;base64,AAA");
    expect(cache.getSync("camp_a", "med_shared")).toBe("data:image/webp;base64,AAA");
    expect(cache.getSync("camp_b", "med_shared")).toBeNull();
    expect(await cache.get("camp_b", "med_shared")).toBeNull();

    // Limpa memória mas mantém IDB para forçar leitura no IndexedDB
    await cache.clear({ closeDb: false });
    expect(await cache.get("camp_a", "med_shared")).toBe("data:image/webp;base64,AAA");
    expect(await cache.get("camp_b", "med_shared")).toBeNull();

    // Todas as operações usaram uma única abertura de IndexedDB
    expect(fakeIdb.stats().openCalls).toBe(1);

    await cache.clear({ closeDb: true });
    expect(fakeIdb.stats().closeCalls).toBe(1);
  });

  it("deduplica requisições concorrentes para a mesma chave (PERF-04)", async () => {
    const fakeIdb = createFakeIndexedDbFactory();
    const cache = createMediaCache({ indexedDBFactory: fakeIdb.factory });

    let resolveLoader;
    const loader = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveLoader = resolve;
        })
    );

    const p1 = cache.resolve("camp_1", "med_99", loader);
    const p2 = cache.resolve("camp_1", "med_99", loader);
    const p3 = cache.resolve("camp_1", "med_99", loader);

    expect(cache.hasInFlight("camp_1", "med_99")).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(loader).toHaveBeenCalledTimes(1);
    expect(fakeIdb.stats().getCalls).toBe(1);

    resolveLoader("data:image/webp;base64,DEDUP");
    const results = await Promise.all([p1, p2, p3]);
    expect(results).toEqual([
      "data:image/webp;base64,DEDUP",
      "data:image/webp;base64,DEDUP",
      "data:image/webp;base64,DEDUP"
    ]);
    expect(cache.hasInFlight("camp_1", "med_99")).toBe(false);
    expect(fakeIdb.stats().putCalls).toBe(1);
  });

  it("remove inFlight em erro para permitir nova tentativa", async () => {
    const fakeIdb = createFakeIndexedDbFactory();
    const cache = createMediaCache({ indexedDBFactory: fakeIdb.factory });

    const failing = vi.fn(async () => {
      throw new Error("network");
    });
    await expect(cache.resolve("camp_1", "med_fail", failing)).rejects.toThrow("network");
    expect(cache.hasInFlight("camp_1", "med_fail")).toBe(false);

    const succeeding = vi.fn(async () => "data:image/webp;base64,OK");
    expect(await cache.resolve("camp_1", "med_fail", succeeding)).toBe("data:image/webp;base64,OK");
  });

  it("mediaService.getMediaDataUrl isola campanhas e não usa fallback sem campanha", async () => {
    mockDocs.set("campaigns/camp_1/media/med_1", {
      dataUrl: "data:image/webp;base64,CAMP1"
    });
    const url1 = await mediaService.getMediaDataUrl("med_1", "camp_1");
    expect(url1).toBe("data:image/webp;base64,CAMP1");
    expect(mediaService.getCachedMediaSync("med_1", "camp_1")).toBe("data:image/webp;base64,CAMP1");
    expect(mediaService.getCachedMediaSync("med_1", "camp_2")).toBeNull();
    expect(await mediaService.getMediaDataUrl("med_1", "camp_2")).toBeNull();
  });
});
