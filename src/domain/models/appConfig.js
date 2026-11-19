import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

export function parseSemver(version) {
  if (typeof version !== "string") return null;
  const match = SEMVER_PATTERN.exec(version.trim());
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) {
    throw new AppError(
      ERROR_CODES.VALIDATION_FAILED,
      "Both versions must be valid semver strings.",
      { a, b }
    );
  }
  if (pa.major !== pb.major) return pa.major < pb.major ? -1 : 1;
  if (pa.minor !== pb.minor) return pa.minor < pb.minor ? -1 : 1;
  if (pa.patch !== pb.patch) return pa.patch < pb.patch ? -1 : 1;

  if (pa.prerelease.length === 0 && pb.prerelease.length === 0) return 0;
  if (pa.prerelease.length === 0) return 1;
  if (pb.prerelease.length === 0) return -1;

  const len = Math.max(pa.prerelease.length, pb.prerelease.length);
  for (let i = 0; i < len; i += 1) {
    const segA = pa.prerelease[i];
    const segB = pb.prerelease[i];
    if (segA === undefined) return -1;
    if (segB === undefined) return 1;
    const numA = /^\d+$/.test(segA) ? Number(segA) : null;
    const numB = /^\d+$/.test(segB) ? Number(segB) : null;
    if (numA !== null && numB !== null) {
      if (numA !== numB) return numA < numB ? -1 : 1;
    } else if (numA !== null) {
      return -1;
    } else if (numB !== null) {
      return 1;
    } else if (segA !== segB) {
      return segA < segB ? -1 : 1;
    }
  }
  return 0;
}

export function isClientVersionOutdated(clientVersion, minClientVersion) {
  const parsedMin = parseSemver(minClientVersion);
  const parsedClient = parseSemver(clientVersion);
  if (!parsedMin || !parsedClient) {
    return false;
  }
  return compareSemver(clientVersion, minClientVersion) < 0;
}

function isPlainRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function trimOrNull(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeAppConfig(raw = {}, context = {}) {
  const src = isPlainRecord(raw) ? raw : {};
  const ctx = isPlainRecord(context) ? context : {};

  const id = trimOrNull(ctx.id ?? src.id ?? "runtime");
  const minClientVersion =
    src.minClientVersion === undefined || src.minClientVersion === null
      ? "0.0.0"
      : typeof src.minClientVersion === "string"
        ? src.minClientVersion.trim()
        : "";

  let schemaVersion = 2;
  if (src.schemaVersion !== undefined && src.schemaVersion !== null) {
    schemaVersion =
      typeof src.schemaVersion === "number"
        ? src.schemaVersion
        : Number(src.schemaVersion);
  }

  return {
    id,
    minClientVersion,
    schemaVersion,
    updatedAt: src.updatedAt ?? null
  };
}

export function validateAppConfig(config) {
  const errors = [];

  if (!isPlainRecord(config)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "AppConfig must be a non-null plain object.",
        { field: "appConfig" }
      )
    ]);
  }

  if (
    !isTrimmedNonEmpty(config.minClientVersion) ||
    !SEMVER_PATTERN.test(config.minClientVersion)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.VALIDATION_FAILED,
        "AppConfig minClientVersion must be a valid semver string (e.g. 2.0.0).",
        { field: "minClientVersion", value: config.minClientVersion }
      )
    );
  }

  if (
    typeof config.schemaVersion !== "number" ||
    !Number.isInteger(config.schemaVersion)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "AppConfig schemaVersion must be an integer.",
        { field: "schemaVersion", value: config.schemaVersion }
      )
    );
  } else if (config.schemaVersion < 1) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "AppConfig schemaVersion must be >= 1.",
        { field: "schemaVersion", value: config.schemaVersion }
      )
    );
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData, id = null, context = {}) {
  const src = isPlainRecord(docData) ? docData : {};
  const ctx = isPlainRecord(context) ? context : {};
  return normalizeAppConfig(src, {
    ...ctx,
    id: id ?? ctx.id ?? src.id ?? "runtime"
  });
}

export function toDoc(config) {
  const normalized = normalizeAppConfig(config);
  const payload = {
    minClientVersion: normalized.minClientVersion,
    schemaVersion: normalized.schemaVersion
  };
  if (normalized.updatedAt !== null) {
    payload.updatedAt = normalized.updatedAt;
  }
  return payload;
}

export { toDoc as toAppConfigDoc, fromDoc as fromAppConfigDoc };
