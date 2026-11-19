import { AppError, ERROR_CODES } from "../domain/errors.js";

export const COMPRESSION_PRESETS = Object.freeze({
  scene: Object.freeze({
    maxDimension: 2560,
    initialQuality: 0.82,
    minQuality: 0.55,
    maxBytes: 680 * 1024 // ~680 KB para caber com folga no limite de 1 MiB do Firestore
  }),
  token: Object.freeze({
    maxDimension: 256,
    initialQuality: 0.85,
    minQuality: 0.65,
    maxBytes: 120 * 1024
  }),
  avatar: Object.freeze({
    maxDimension: 512,
    initialQuality: 0.8,
    minQuality: 0.6,
    maxBytes: 200 * 1024
  })
});

export function extractDataUrlMimeType(dataUrl) {
  if (typeof dataUrl !== "string") {
    return "application/octet-stream";
  }
  const match = /^data:([^;,]+)[;,]/i.exec(dataUrl.trim());
  return match && match[1] ? match[1].toLowerCase() : "application/octet-stream";
}

export function measureDataUrlBytes(dataUrl) {
  if (typeof dataUrl !== "string") {
    return 0;
  }
  if (typeof Blob === "function") {
    return new Blob([dataUrl]).size;
  }
  return new TextEncoder().encode(dataUrl).byteLength;
}

export function isCompressedImageResult(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  if (typeof Blob === "function" && value instanceof Blob) {
    return false;
  }
  return (
    typeof value.dataUrl === "string" &&
    value.dataUrl.startsWith("data:") &&
    typeof value.widthPx === "number" &&
    Number.isFinite(value.widthPx) &&
    value.widthPx > 0 &&
    typeof value.heightPx === "number" &&
    Number.isFinite(value.heightPx) &&
    value.heightPx > 0
  );
}

function defaultLoadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(objectUrl);
      reject(err);
    };
    img.src = objectUrl;
  });
}

function defaultCreateCanvas() {
  if (typeof document === "undefined") {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Canvas não disponível neste ambiente."
    );
  }
  return document.createElement("canvas");
}

export function calculateProportionalDimensions(srcWidth, srcHeight, maxDimension) {
  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight };
  }
  const aspectRatio = srcWidth / srcHeight;
  if (srcWidth >= srcHeight) {
    return {
      width: maxDimension,
      height: Math.max(1, Math.round(maxDimension / aspectRatio))
    };
  }
  return {
    width: Math.max(1, Math.round(maxDimension * aspectRatio)),
    height: maxDimension
  };
}

function renderToWebPDataUrl(img, width, height, quality, createCanvas) {
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/webp", quality);
}

export async function compressImageToWebP(
  fileOrCompressed,
  category = "scene",
  deps = {}
) {
  if (!fileOrCompressed) {
    throw new AppError(
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      "Nenhum arquivo de imagem informado."
    );
  }

  const preset = COMPRESSION_PRESETS[category] || COMPRESSION_PRESETS.scene;

  if (isCompressedImageResult(fileOrCompressed)) {
    const sizeBytes =
      typeof fileOrCompressed.sizeBytes === "number" &&
      Number.isFinite(fileOrCompressed.sizeBytes) &&
      fileOrCompressed.sizeBytes > 0
        ? fileOrCompressed.sizeBytes
        : measureDataUrlBytes(fileOrCompressed.dataUrl);
    if (sizeBytes > preset.maxBytes) {
      throw new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        `Imagem excede o limite de tamanho (${formatBytes(sizeBytes)} > ${formatBytes(preset.maxBytes)}).`,
        { category, sizeBytes, maxBytes: preset.maxBytes }
      );
    }
    return {
      dataUrl: fileOrCompressed.dataUrl,
      widthPx: fileOrCompressed.widthPx,
      heightPx: fileOrCompressed.heightPx,
      sizeBytes,
      originalSizeBytes:
        typeof fileOrCompressed.originalSizeBytes === "number" &&
        Number.isFinite(fileOrCompressed.originalSizeBytes)
          ? fileOrCompressed.originalSizeBytes
          : sizeBytes,
      mimeType: extractDataUrlMimeType(fileOrCompressed.dataUrl)
    };
  }

  const loadImage = deps.loadImage || defaultLoadImageFromFile;
  const createCanvas = deps.createCanvas || defaultCreateCanvas;
  const img = await loadImage(fileOrCompressed);

  const srcWidth = img.naturalWidth || img.width;
  const srcHeight = img.naturalHeight || img.height;
  let currentMaxDim = preset.maxDimension;
  let { width, height } = calculateProportionalDimensions(
    srcWidth,
    srcHeight,
    currentMaxDim
  );

  let quality = preset.initialQuality;
  let dataUrl = renderToWebPDataUrl(img, width, height, quality, createCanvas);
  let sizeBytes = measureDataUrlBytes(dataUrl);

  // Loop adaptativo até atingir o limite ou esgotar as tentativas
  let attempts = 0;
  while (sizeBytes > preset.maxBytes && attempts < 6) {
    attempts += 1;
    if (quality > preset.minQuality) {
      quality = Math.max(preset.minQuality, Number((quality - 0.08).toFixed(2)));
    } else {
      currentMaxDim = Math.max(1, Math.round(currentMaxDim * 0.85));
      const nextDims = calculateProportionalDimensions(
        srcWidth,
        srcHeight,
        currentMaxDim
      );
      width = nextDims.width;
      height = nextDims.height;
    }
    dataUrl = renderToWebPDataUrl(img, width, height, quality, createCanvas);
    sizeBytes = measureDataUrlBytes(dataUrl);
  }

  if (sizeBytes > preset.maxBytes) {
    throw new AppError(
      ERROR_CODES.OUT_OF_RANGE,
      `Imagem excede o limite de ${formatBytes(preset.maxBytes)} após compressão (${formatBytes(sizeBytes)}).`,
      { category, sizeBytes, maxBytes: preset.maxBytes }
    );
  }

  return {
    dataUrl,
    widthPx: width,
    heightPx: height,
    sizeBytes,
    originalSizeBytes: fileOrCompressed.size || 0,
    mimeType: extractDataUrlMimeType(dataUrl)
  };
}

export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  return `${(kb / 1024).toFixed(2)} MB`;
}
