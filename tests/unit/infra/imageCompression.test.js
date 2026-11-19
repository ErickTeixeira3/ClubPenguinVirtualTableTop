import { beforeEach, describe, expect, it, vi } from "vitest";
import { ERROR_CODES } from "../../../src/domain/errors.js";
import {
  COMPRESSION_PRESETS,
  compressImageToWebP,
  extractDataUrlMimeType,
  formatBytes,
  isCompressedImageResult
} from "../../../src/infra/imageCompression.js";
import { fakeDb, resetFakeDb } from "../../support/fakeFirebase.js";

vi.mock("firebase/firestore", async () => (await import("../../support/fakeFirebase.js")).firestoreModule);
vi.mock("../../../src/infra/firebase.js", async () => (await import("../../support/fakeFirebase.js")).appModule);

const mediaService = await import("../../../src/services/mediaService.js");
const { clearMediaCache } = await import("../../../src/infra/mediaCache.js");

function makeFakeCanvasFactory(dataUrlBuilder) {
  const calls = [];
  const createCanvas = () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({
        imageSmoothingEnabled: false,
        imageSmoothingQuality: "low",
        clearRect: () => {},
        drawImage: () => {}
      }),
      toDataURL: (requestedType, quality) => {
        calls.push({ width: canvas.width, height: canvas.height, requestedType, quality });
        return dataUrlBuilder({ width: canvas.width, height: canvas.height, quality, attempt: calls.length });
      }
    };
    return canvas;
  };
  return { createCanvas, calls };
}

beforeEach(async () => {
  resetFakeDb();
  await clearMediaCache({ closeDb: true });
});

describe("imageCompression", () => {
  it("extrai o mimeType real do dataUrl quando o navegador faz fallback para PNG", async () => {
    const { createCanvas, calls } = makeFakeCanvasFactory(
      () => "data:image/png;base64," + "A".repeat(120)
    );
    const result = await compressImageToWebP(
      { size: 4096 },
      "token",
      {
        loadImage: async () => ({ naturalWidth: 512, naturalHeight: 256 }),
        createCanvas
      }
    );

    expect(calls).toHaveLength(1);
    expect(result.widthPx).toBe(256);
    expect(result.heightPx).toBe(128);
    expect(result.mimeType).toBe("image/png");
    expect(extractDataUrlMimeType(result.dataUrl)).toBe("image/png");
  });

  it("falha explicitamente com OUT_OF_RANGE quando ultrapassa maxBytes após 6 tentativas", async () => {
    const oversizedPayload = "data:image/webp;base64," + "A".repeat(COMPRESSION_PRESETS.token.maxBytes + 5000);
    const { createCanvas, calls } = makeFakeCanvasFactory(() => oversizedPayload);

    await expect(
      compressImageToWebP(
        { size: 999999 },
        "token",
        {
          loadImage: async () => ({ naturalWidth: 1024, naturalHeight: 1024 }),
          createCanvas
        }
      )
    ).rejects.toMatchObject({ code: ERROR_CODES.OUT_OF_RANGE });

    expect(calls).toHaveLength(7); // inicial + 6 tentativas adaptativas
  });

  it("reduz qualidade/dimensão adaptativamente até caber no limite", async () => {
    const { createCanvas, calls } = makeFakeCanvasFactory(({ attempt }) => {
      if (attempt < 3) {
        return "data:image/webp;base64," + "A".repeat(COMPRESSION_PRESETS.token.maxBytes + 100);
      }
      return "data:image/webp;base64," + "A".repeat(1000);
    });

    const result = await compressImageToWebP(
      { size: 500000 },
      "token",
      {
        loadImage: async () => ({ naturalWidth: 512, naturalHeight: 512 }),
        createCanvas
      }
    );

    expect(calls).toHaveLength(3);
    expect(result.sizeBytes).toBeLessThanOrEqual(COMPRESSION_PRESETS.token.maxBytes);
    expect(result.mimeType).toBe("image/webp");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("reutiliza resultado já comprimido sem reprocessar Canvas (FUN-27)", async () => {
    const preCompressed = {
      dataUrl: "data:image/webp;base64,AAAA",
      widthPx: 128,
      heightPx: 128,
      sizeBytes: 27,
      originalSizeBytes: 1000,
      mimeType: "image/webp"
    };
    expect(isCompressedImageResult(preCompressed)).toBe(true);

    const loadImage = vi.fn();
    const createCanvas = vi.fn();
    const reused = await compressImageToWebP(preCompressed, "token", { loadImage, createCanvas });
    expect(loadImage).not.toHaveBeenCalled();
    expect(createCanvas).not.toHaveBeenCalled();
    expect(reused).toEqual(preCompressed);

    const uploaded = await mediaService.uploadCompressedMedia({
      file: preCompressed,
      category: "token",
      campaignId: "camp_1",
      uploadedBy: "gm1"
    });
    expect(uploaded.mediaId).toMatch(/^media_/);
    expect(uploaded.mimeType).toBe("image/webp");
    expect(fakeDb.writes).toHaveLength(1);
    expect(fakeDb.writes[0].payload.dataUrl).toBe("data:image/webp;base64,AAAA");
  });
});
