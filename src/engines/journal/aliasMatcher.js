function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function normalizeWithMap(rawText) {
  if (typeof rawText !== "string" || rawText.length === 0) {
    return { norm: "", origStarts: [], origEnds: [] };
  }

  const chars = [];
  const origStarts = [];
  const origEnds = [];
  let hasStarted = false;
  let lastWasSpace = false;

  let i = 0;
  while (i < rawText.length) {
    const cp = rawText.codePointAt(i);
    const cpLen = cp > 0xffff ? 2 : 1;
    const nextI = i + cpLen;
    const ch = rawText.slice(i, nextI);

    if (/\s/.test(ch)) {
      if (hasStarted) {
        if (!lastWasSpace) {
          chars.push(" ");
          origStarts.push(i);
          origEnds.push(nextI);
          lastWasSpace = true;
        } else {
          origEnds[origEnds.length - 1] = nextI;
        }
      }
    } else {
      const stripped = ch
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Mn}/gu, "");

      if (stripped.length === 0) {
        if (chars.length > 0 && !lastWasSpace) {
          origEnds[origEnds.length - 1] = nextI;
        }
      } else {
        hasStarted = true;
        lastWasSpace = false;
        for (let k = 0; k < stripped.length; k += 1) {
          chars.push(stripped[k]);
          origStarts.push(i);
          origEnds.push(nextI);
        }
      }
    }

    i = nextI;
  }

  if (chars.length > 0 && lastWasSpace) {
    chars.pop();
    origStarts.pop();
    origEnds.pop();
  }

  return {
    norm: chars.join(""),
    origStarts,
    origEnds
  };
}

export function normalizeAliasText(rawText) {
  return normalizeWithMap(rawText).norm;
}

export function buildNormalizedAliases(title, aliasesArray = []) {
  const seen = new Set();
  const candidates = [title, ...(Array.isArray(aliasesArray) ? aliasesArray : [])];

  for (const item of candidates) {
    if (typeof item !== "string") {
      continue;
    }
    const norm = normalizeAliasText(item);
    if (norm.length >= 2) {
      seen.add(norm);
    }
  }

  return Array.from(seen);
}

function findAliasMatches(
  content,
  accessibleNotes = [],
  currentNoteId = null,
  ignoredAliases = []
) {
  if (typeof content !== "string" || content.length === 0) {
    return [];
  }

  const { norm: normContent, origStarts, origEnds } = normalizeWithMap(content);
  if (!normContent) {
    return [];
  }

  const normalizedIgnored = new Set(
    (Array.isArray(ignoredAliases) ? ignoredAliases : [])
      .map((item) => normalizeAliasText(item))
      .filter((norm) => norm.length > 0)
  );

  const notes = Array.isArray(accessibleNotes) ? accessibleNotes : [];
  const candidates = [];

  for (const note of notes) {
    if (!note || typeof note !== "object" || Array.isArray(note)) {
      continue;
    }
    if (note.isDeleted === true) {
      continue;
    }
    const noteId = typeof note.id === "string" ? note.id.trim() : "";
    if (!noteId || noteId === currentNoteId) {
      continue;
    }

    const rawTerms = [
      note.title,
      ...(Array.isArray(note.aliases) ? note.aliases : [])
    ];
    const seenPerNote = new Set();

    for (const rawTerm of rawTerms) {
      if (typeof rawTerm !== "string") {
        continue;
      }
      const trimmed = rawTerm.trim();
      const normTerm = normalizeAliasText(trimmed);
      if (
        normTerm.length < 2 ||
        normalizedIgnored.has(normTerm) ||
        seenPerNote.has(normTerm)
      ) {
        continue;
      }
      seenPerNote.add(normTerm);
      candidates.push({
        note,
        rawTerm: trimmed,
        normTerm,
        len: normTerm.length
      });
    }
  }

  candidates.sort((a, b) => b.len - a.len);

  const accepted = [];

  for (const cand of candidates) {
    const pattern = new RegExp(
      `(?<=^|[^\\p{L}\\p{N}])${escapeRegex(cand.normTerm)}(?=$|[^\\p{L}\\p{N}])`,
      "gu"
    );

    let match;
    while ((match = pattern.exec(normContent)) !== null) {
      const normStart = match.index;
      const normEnd = normStart + match[0].length;

      const overlaps = accepted.some(
        (inv) => normStart < inv.normEnd && normEnd > inv.normStart
      );
      if (overlaps) {
        continue;
      }

      const origStart = origStarts[normStart];
      const origEnd = origEnds[normEnd - 1];
      accepted.push({
        normStart,
        normEnd,
        origStart,
        origEnd,
        matchedText: content.slice(origStart, origEnd),
        note: cand.note,
        term: cand.rawTerm,
        normTerm: cand.normTerm
      });
    }
  }

  accepted.sort((a, b) => a.origStart - b.origStart);
  return accepted;
}

export function detectAliasMentions(
  content,
  accessibleNotes = [],
  currentNoteId = null,
  ignoredAliases = []
) {
  const matches = findAliasMatches(
    content,
    accessibleNotes,
    currentNoteId,
    ignoredAliases
  );

  const byNoteId = new Map();
  for (const match of matches) {
    const noteId = match.note.id;
    const existing = byNoteId.get(noteId);
    if (!existing || match.normTerm.length > existing.matchedAlias.length) {
      byNoteId.set(noteId, {
        noteId,
        title: typeof match.note.title === "string" ? match.note.title : "",
        noteType: match.note.noteType ?? null,
        matchedAlias: match.normTerm
      });
    }
  }

  return {
    mentionedNoteIds: Array.from(byNoteId.keys()),
    matchedDetails: Array.from(byNoteId.values())
  };
}

export function tokenizeTextWithAliases(
  content,
  accessibleNotes = [],
  currentNoteId = null,
  ignoredAliases = []
) {
  if (typeof content !== "string" || content.length === 0) {
    return [];
  }

  const matches = findAliasMatches(
    content,
    accessibleNotes,
    currentNoteId,
    ignoredAliases
  );

  if (matches.length === 0) {
    return [{ type: "text", text: content }];
  }

  const tokens = [];
  let cursor = 0;

  for (const match of matches) {
    if (match.origStart > cursor) {
      tokens.push({
        type: "text",
        text: content.slice(cursor, match.origStart)
      });
    }
    tokens.push({
      type: "link",
      text: match.matchedText,
      note: match.note,
      term: match.term
    });
    cursor = match.origEnd;
  }

  if (cursor < content.length) {
    tokens.push({
      type: "text",
      text: content.slice(cursor)
    });
  }

  return tokens;
}
