import { AppError, ERROR_CODES, validationFail, validationOk } from "../errors.js";

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

export function normalizeChatState(raw = {}) {
  const src = isPlainRecord(raw) ? raw : {};

  let lastSeq = 0;
  if (src.lastSeq !== undefined && src.lastSeq !== null) {
    lastSeq =
      typeof src.lastSeq === "number" ? src.lastSeq : Number(src.lastSeq);
  }

  let lastMessageId = null;
  if (src.lastMessageId !== undefined && src.lastMessageId !== null) {
    lastMessageId =
      typeof src.lastMessageId === "string"
        ? trimOrNull(src.lastMessageId)
        : src.lastMessageId;
  }

  return {
    lastSeq,
    lastMessageId
  };
}

export function validateChatState(chatState) {
  const errors = [];

  if (!isPlainRecord(chatState)) {
    return validationFail([
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "ChatState must be a non-null plain object.",
        { field: "chatState" }
      )
    ]);
  }

  if (
    typeof chatState.lastSeq !== "number" ||
    !Number.isInteger(chatState.lastSeq)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "ChatState lastSeq must be an integer.",
        { field: "lastSeq", value: chatState.lastSeq }
      )
    );
  } else if (chatState.lastSeq < 0) {
    errors.push(
      new AppError(
        ERROR_CODES.OUT_OF_RANGE,
        "ChatState lastSeq must be >= 0.",
        { field: "lastSeq", value: chatState.lastSeq }
      )
    );
  }

  if (
    chatState.lastMessageId !== null &&
    !isTrimmedNonEmpty(chatState.lastMessageId)
  ) {
    errors.push(
      new AppError(
        ERROR_CODES.INVALID_TYPE,
        "ChatState lastMessageId must be null or a trimmed non-empty string.",
        { field: "lastMessageId" }
      )
    );
  }

  if (
    typeof chatState.lastSeq === "number" &&
    Number.isInteger(chatState.lastSeq)
  ) {
    if (chatState.lastSeq === 0 && chatState.lastMessageId !== null) {
      errors.push(
        new AppError(
          ERROR_CODES.VALIDATION_FAILED,
          "ChatState lastMessageId must be null when lastSeq is 0.",
          { field: "lastMessageId" }
        )
      );
    } else if (
      chatState.lastSeq > 0 &&
      !isTrimmedNonEmpty(chatState.lastMessageId)
    ) {
      errors.push(
        new AppError(
          ERROR_CODES.MISSING_REQUIRED_FIELD,
          "ChatState lastMessageId is required when lastSeq > 0.",
          { field: "lastMessageId" }
        )
      );
    }
  }

  return errors.length === 0 ? validationOk() : validationFail(errors);
}

export function fromDoc(docData) {
  return normalizeChatState(docData);
}

export function toDoc(chatState) {
  const normalized = normalizeChatState(chatState);
  return {
    lastSeq: normalized.lastSeq,
    lastMessageId: normalized.lastMessageId
  };
}

export { toDoc as toChatStateDoc, fromDoc as fromChatStateDoc };
