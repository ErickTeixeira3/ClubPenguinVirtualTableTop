const COMPRESSION_PRESETS = {
  scene: {
    maxDimension: 2560,
    initialQuality: 0.82,
    minQuality: 0.55,
    maxBytes: 680 * 1024 // ~680 KB para caber com folga no limite de 1 MiB do Firestore
  },
  token: {
    maxDimension: 256,
    initialQuality: 0.85,
    minQuality: 0.65,
    maxBytes: 120 * 1024
  },
  avatar: {
    maxDimension: 512,
    initialQuality: 0.8,
    minQuality: 0.6,
    maxBytes: 200 * 1024
  }
};

function loadImageFromFile(file) {
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

function calculateProportionalDimensions(srcWidth, srcHeight, maxDimension) {
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

function renderToWebPDataUrl(img, width, height, quality) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/webp", quality);
}

export async function compressImageToWebP(file, category = "scene") {
  if (!file) {
    throw new Error("Nenhum arquivo de imagem informado.");
  }

  const preset = COMPRESSION_PRESETS[category] || COMPRESSION_PRESETS.scene;
  const img = await loadImageFromFile(file);

  let currentMaxDim = preset.maxDimension;
  let { width, height } = calculateProportionalDimensions(
    img.naturalWidth || img.width,
    img.naturalHeight || img.height,
    currentMaxDim
  );

  let quality = preset.initialQuality;
  let dataUrl = renderToWebPDataUrl(img, width, height, quality);
  let sizeBytes = new Blob([dataUrl]).size;

  // Loop adaptativo caso o mapa ainda ultrapasse o teto seguro do documento Firestore
  let attempts = 0;
  while (sizeBytes > preset.maxBytes && attempts < 6) {
    attempts += 1;
    if (quality > preset.minQuality) {
      quality = Math.max(preset.minQuality, Number((quality - 0.08).toFixed(2)));
    } else {
      currentMaxDim = Math.round(currentMaxDim * 0.85);
      const nextDims = calculateProportionalDimensions(
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        currentMaxDim
      );
      width = nextDims.width;
      height = nextDims.height;
    }
    dataUrl = renderToWebPDataUrl(img, width, height, quality);
    sizeBytes = new Blob([dataUrl]).size;
  }

  return {
    dataUrl,
    widthPx: width,
    heightPx: height,
    sizeBytes,
    originalSizeBytes: file.size || 0,
    mimeType: "image/webp"
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

