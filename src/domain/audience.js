import {
  FOLDER_DOMAINS,
  MESSAGE_VISIBILITY,
  NOTE_SCOPES
} from "./constants.js";
import {
  AppError,
  ERROR_CODES,
  validationFail,
  validationOk
} from "./errors.js";

function trimNonEmpty(value) {
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function isTrimmedNonEmpty(value) {
  return (
    typeof value === "string" && value.length > 0 && value === value.trim()
  );
}

function cleanAudienceList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  const seen = new Set();
  for (const item of list) {
    const clean = trimNonEmpty(item);
    if (clean.length > 0) {
      seen.add(clean);
    }
  }
  return Array.from(seen);
}

function makeAudienceError(message, details) {
  return new AppError(ERROR_CODES.INVALID_AUDIENCE, message, details);
}

function validateAudienceArray(value, fieldName, { allowEmpty = true } = {}) {
  const errors = [];
  if (!Array.isArray(value)) {
    errors.push(
      makeAudienceError(`${fieldName} must be an array of non-empty strings.`, {
        field: fieldName
      })
    );
    return errors;
  }

  for (let index = 0; index < value.length; index += 1) {
    const entry = value[index];
    if (!isTrimmedNonEmpty(entry)) {
      errors.push(
        makeAudienceError(
          `${fieldName}[${index}] must be a trimmed non-empty string.`,
          { field: fieldName, index }
        )
      );
    }
  }

  if (!allowEmpty && value.length === 0) {
    errors.push(
      makeAudienceError(`${fieldName} must not be empty.`, {
        field: fieldName
      })
    );
  }

  return errors;
}

export function computeAudience({
  ownerId,
  scope,
  visibleTo,
  editableBy,
  gmId,
  visibility,
  senderUid,
  uploadedBy
} = {}) {
  const cleanOwner = trimNonEmpty(ownerId);
  const cleanGm = trimNonEmpty(gmId);
  const cleanSender = trimNonEmpty(senderUid);
  const cleanUploader = trimNonEmpty(uploadedBy);
  const baseVis = cleanAudienceList(visibleTo);
  const baseEdit = cleanAudienceList(editableBy);

  if (visibility != null) {
    if (visibility === MESSAGE_VISIBILITY.GM_ONLY) {
      return {
        visibleTo: cleanAudienceList([cleanGm, cleanSender]),
        editableBy: []
      };
    }
    if (visibility === "self") {
      return {
        visibleTo: cleanAudienceList([cleanSender]),
        editableBy: []
      };
    }
    if (visibility === MESSAGE_VISIBILITY.PUBLIC) {
      return {
        visibleTo: ["ALL"],
        editableBy: []
      };
    }
    throw makeAudienceError(
      `Invalid message visibility: ${String(visibility)}.`,
      { field: "visibility", value: visibility }
    );
  }

  if (scope != null) {
    if (scope === NOTE_SCOPES.GM) {
      return {
        visibleTo: [],
        editableBy: []
      };
    }
    if (scope === NOTE_SCOPES.PARTY) {
      return {
        visibleTo: cleanAudienceList(["ALL", cleanOwner, ...baseVis]),
        editableBy: cleanAudienceList(["ALL", cleanOwner, ...baseEdit])
      };
    }
    if (scope === NOTE_SCOPES.PLAYER) {
      const nextVis = cleanAudienceList([cleanOwner, ...baseVis]);
      const nextEdit = cleanAudienceList([cleanOwner, ...baseEdit]).filter(
        (id) => id !== "ALL"
      );
      return {
        visibleTo: nextVis,
        editableBy: nextEdit
      };
    }
    throw makeAudienceError(`Invalid scope: ${String(scope)}.`, {
      field: "scope",
      value: scope
    });
  }

  if (cleanOwner) {
    return {
      visibleTo: cleanAudienceList([cleanOwner, ...baseVis]),
      editableBy: cleanAudienceList([cleanOwner, ...baseEdit])
    };
  }

  if (cleanUploader) {
    const nextVis = baseVis.includes("ALL")
      ? baseVis
      : cleanAudienceList([cleanUploader, ...baseVis]);
    return {
      visibleTo: nextVis,
      editableBy: []
    };
  }

  return {
    visibleTo: baseVis,
    editableBy: []
  };
}

function detectAudienceKind(entity, entityType) {
  if (entityType) {
    return entityType;
  }
  if (entity.visibility !== undefined && entity.visibility !== null) {
    return "message";
  }
  const hasOwnerId = entity.ownerId !== undefined && entity.ownerId !== null;
  if ("uploadedBy" in entity && !hasOwnerId) {
    return "media";
  }
  if (entity.scope !== undefined && entity.scope !== null) {
    return "note";
  }
  if ("ownerId" in entity) {
    return "character";
  }
  return "generic";
}

function validateMessageAudience(entity, senderUid) {
  const errors = [];
  const visErrors = validateAudienceArray(entity.visibleTo, "visibleTo", {
    allowEmpty: false
  });
  errors.push(...visErrors);

  const visibleTo = Array.isArray(entity.visibleTo) ? entity.visibleTo : [];

  if (entity.visibility === MESSAGE_VISIBILITY.PUBLIC) {
    if (!visibleTo.includes("ALL")) {
      errors.push(
        makeAudienceError('Public message must include "ALL" in visibleTo.', {
          field: "visibleTo",
          visibility: entity.visibility
        })
      );
    }
  } else if (entity.visibility === MESSAGE_VISIBILITY.GM_ONLY) {
    if (visibleTo.includes("ALL")) {
      errors.push(
        makeAudienceError('GM-only message must not include "ALL" in visibleTo.', {
          field: "visibleTo",
          visibility: entity.visibility
        })
      );
    }
    const effectiveSender =
      trimNonEmpty(senderUid) || trimNonEmpty(entity.sender?.uid);
    if (effectiveSender && !visibleTo.includes(effectiveSender)) {
      errors.push(
        makeAudienceError("GM-only message must include sender in visibleTo.", {
          field: "visibleTo",
          senderUid: effectiveSender
        })
      );
    }
  } else {
    errors.push(
      makeAudienceError(
        `Invalid message visibility: ${String(entity.visibility)}.`,
        { field: "visibility", value: entity.visibility }
      )
    );
  }

  return errors;
}

function validateMediaAudience(entity) {
  const errors = [];
  if (!trimNonEmpty(entity.uploadedBy)) {
    errors.push(
      makeAudienceError("Media entity requires a non-empty uploadedBy.", {
        field: "uploadedBy"
      })
    );
  }
  errors.push(
    ...validateAudienceArray(entity.visibleTo, "visibleTo", {
      allowEmpty: false
    })
  );
  return errors;
}

function validateScopedAudience(entity) {
  const errors = [];
  const hasValidOwner = isTrimmedNonEmpty(entity.ownerId);
  const ownerId = hasValidOwner ? entity.ownerId : "";
  if (!hasValidOwner) {
    errors.push(
      makeAudienceError("Scoped entity requires a trimmed non-empty ownerId.", {
        field: "ownerId"
      })
    );
  }

  errors.push(
    ...validateAudienceArray(entity.visibleTo, "visibleTo", {
      allowEmpty: true
    }),
    ...validateAudienceArray(entity.editableBy, "editableBy", {
      allowEmpty: true
    })
  );

  const visibleTo = Array.isArray(entity.visibleTo) ? entity.visibleTo : [];
  const editableBy = Array.isArray(entity.editableBy) ? entity.editableBy : [];

  if (entity.scope === NOTE_SCOPES.GM) {
    if (visibleTo.includes("ALL")) {
      errors.push(
        makeAudienceError('GM-scoped entity must not include "ALL" in visibleTo.', {
          field: "visibleTo",
          scope: entity.scope
        })
      );
    }
    if (editableBy.includes("ALL")) {
      errors.push(
        makeAudienceError('GM-scoped entity must not include "ALL" in editableBy.', {
          field: "editableBy",
          scope: entity.scope
        })
      );
    }
    return errors;
  }

  if (entity.scope === NOTE_SCOPES.PARTY) {
    if (!visibleTo.includes("ALL")) {
      errors.push(
        makeAudienceError('Party-scoped entity must include "ALL" in visibleTo.', {
          field: "visibleTo",
          scope: entity.scope
        })
      );
    }
    if (!editableBy.includes("ALL")) {
      errors.push(
        makeAudienceError('Party-scoped entity must include "ALL" in editableBy.', {
          field: "editableBy",
          scope: entity.scope
        })
      );
    }
  } else if (entity.scope === NOTE_SCOPES.PLAYER) {
    if (editableBy.includes("ALL")) {
      errors.push(
        makeAudienceError(
          'Player-scoped entity must not include "ALL" in editableBy.',
          { field: "editableBy", scope: entity.scope }
        )
      );
    }
  } else {
    errors.push(
      makeAudienceError(`Invalid scope: ${String(entity.scope)}.`, {
        field: "scope",
        value: entity.scope
      })
    );
    return errors;
  }

  if (ownerId && !visibleTo.includes(ownerId)) {
    errors.push(
      makeAudienceError("ownerId must be included in visibleTo.", {
        field: "visibleTo",
        ownerId
      })
    );
  }
  if (ownerId && !editableBy.includes(ownerId)) {
    errors.push(
      makeAudienceError("ownerId must be included in editableBy.", {
        field: "editableBy",
        ownerId
      })
    );
  }

  return errors;
}

function validateOwnerAudience(entity) {
  const errors = [];
  const hasValidOwner = isTrimmedNonEmpty(entity.ownerId);
  const ownerId = hasValidOwner ? entity.ownerId : "";
  if (!hasValidOwner) {
    errors.push(
      makeAudienceError("Entity requires a trimmed non-empty ownerId.", {
        field: "ownerId"
      })
    );
  }

  errors.push(
    ...validateAudienceArray(entity.visibleTo, "visibleTo", {
      allowEmpty: true
    }),
    ...validateAudienceArray(entity.editableBy, "editableBy", {
      allowEmpty: true
    })
  );

  const visibleTo = Array.isArray(entity.visibleTo) ? entity.visibleTo : [];
  const editableBy = Array.isArray(entity.editableBy) ? entity.editableBy : [];

  if (ownerId && !visibleTo.includes(ownerId)) {
    errors.push(
      makeAudienceError("ownerId must be included in visibleTo.", {
        field: "visibleTo",
        ownerId
      })
    );
  }
  if (ownerId && !editableBy.includes(ownerId)) {
    errors.push(
      makeAudienceError("ownerId must be included in editableBy.", {
        field: "editableBy",
        ownerId
      })
    );
  }

  return errors;
}

export function assertAudience(entity, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const { entityType, senderUid, throwOnError = false } = opts;

  let errors = [];
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) {
    errors.push(
      makeAudienceError("Audience target must be a non-null plain object.", {
        entityType: entityType ?? null
      })
    );
  } else {
    const kind = detectAudienceKind(entity, entityType);
    if (kind === "message") {
      errors = validateMessageAudience(entity, senderUid);
    } else if (kind === "media") {
      errors = validateMediaAudience(entity);
    } else if (kind === "scene" || kind === "compendiumEntry") {
      errors = validateAudienceArray(entity.visibleTo, "visibleTo", {
        allowEmpty: true
      });
    } else if (
      kind === "note" ||
      (kind === "folder" && entity.domain === FOLDER_DOMAINS.JOURNAL)
    ) {
      errors = validateScopedAudience(entity);
    } else if (kind === "character" || kind === "folder") {
      errors = validateOwnerAudience(entity);
    } else {
      errors = validateAudienceArray(entity.visibleTo, "visibleTo", {
        allowEmpty: true
      });
    }
  }

  if (errors.length === 0) {
    return validationOk();
  }

  if (throwOnError === true) {
    throw new AppError(ERROR_CODES.INVALID_AUDIENCE, errors[0].message, {
      errors
    });
  }

  return validationFail(errors);
}
