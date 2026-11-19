import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

export const EMPTY_IMAGE_REF = Object.freeze({
  mediaId: null,
  url: null
});

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function hasControlChars(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code < 32 || code === 127) {
      return true;
    }
  }
  return false;
}

function firstTrimmedString(candidates) {
  for (const candidate of candidates) {
    const clean = trimOrNull(candidate);
    if (clean !== null) {
      return clean;
    }
  }
  return null;
}

export function normalizeImageRef(raw) {
  if (!isPlainRecord(raw)) {
    return { mediaId: null, url: null };
  }

  const mediaId =
    raw.mediaId === undefined || raw.mediaId === null
      ? null
      : typeof raw.mediaId === "string"
        ? trimOrNull(raw.mediaId)
        : raw.mediaId;

  const url =
    raw.url === undefined || raw.url === null
      ? null
      : typeof raw.url === "string"
        ? trimOrNull(raw.url)
        : raw.url;

  return {
    mediaId,
    url
  };
}

export function validateImageRef(imageRef, { fieldName = "image" } = {}) {
  const errors = [];

  if (!isPlainRecord(imageRef)) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_IMAGE_REF,
        `${fieldName} must be a non-null plain object.`,
        { field: fieldName }
      )
    );
    return validationFail(errors);
  }

  const { mediaId, url } = imageRef;

  if (mediaId !== null) {
    if (
      typeof mediaId !== "string" ||
      mediaId.length === 0 ||
      mediaId !== mediaId.trim() ||
      mediaId.includes("/") ||
      /\s/.test(mediaId) ||
      hasControlChars(mediaId)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_IMAGE_REF,
          `${fieldName}.mediaId must be null or a valid trimmed ID without spaces or "/".`,
          { field: `${fieldName}.mediaId`, value: mediaId }
        )
      );
    }
  }

  if (url !== null) {
    let validHttpUrl = false;
    if (
      typeof url === "string" &&
      url.length > 0 &&
      url === url.trim() &&
      !/^data:/i.test(url) &&
      !/\s/.test(url) &&
      !hasControlChars(url) &&
      /^https?:\/\/\S+$/i.test(url)
    ) {
      try {
        const parsed = new URL(url);
        validHttpUrl =
          parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        validHttpUrl = false;
      }
    }

    if (!validHttpUrl) {
      errors.push(
        new AppError(
          ERROR_CODES.INVALID_IMAGE_REF,
          `${fieldName}.url must be null or a valid http(s) URL (no inline data: URLs).`,
          { field: `${fieldName}.url` }
        )
      );
    }
  }

  if (mediaId !== null && url !== null) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_IMAGE_REF,
        `${fieldName} cannot specify both mediaId and url simultaneously.`,
        { field: fieldName }
      )
    );
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(raw) {
  if (!isPlainRecord(raw)) {
    return { mediaId: null, url: null };
  }

  if (raw.avatarRemoved === true && raw.mediaId == null && raw.url == null) {
    return { mediaId: null, url: null };
  }

  const mediaId = firstTrimmedString([
    raw.mediaId,
    raw.avatarMediaId,
    raw.imageMediaId
  ]);

  if (mediaId !== null) {
    return {
      mediaId,
      url: null
    };
  }

  const url = firstTrimmedString([
    raw.url,
    raw.externalUrl,
    raw.avatarExternalUrl,
    raw.photoURL,
    raw.tokenImage,
    raw.avatarImage
  ]);

  return {
    mediaId: null,
    url
  };
}

export function toDoc(imageRef) {
  const normalized = normalizeImageRef(imageRef);
  return {
    mediaId: typeof normalized.mediaId === "string" ? normalized.mediaId : null,
    url: typeof normalized.url === "string" ? normalized.url : null
  };
}

export { toDoc as toImageRefDoc, fromDoc as fromImageRefDoc };
