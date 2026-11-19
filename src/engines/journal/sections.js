const UNSAFE_KEYS = new Set([
  "__proto__",
  "constructor",
  "prototype",
  "toString",
  "valueOf",
  "hasOwnProperty",
  "isPrototypeOf",
  "propertyIsEnumerable",
  "toLocaleString"
]);

export function extractNoteText(note) {
  if (!note || typeof note !== "object" || Array.isArray(note)) {
    return "";
  }

  const rawSections = note.sections;
  if (!rawSections || typeof rawSections !== "object") {
    return "";
  }

  const entries = [];
  if (Array.isArray(rawSections)) {
    for (let i = 0; i < rawSections.length; i += 1) {
      const sec = rawSections[i];
      if (sec && typeof sec === "object" && !Array.isArray(sec)) {
        entries.push({
          sec,
          idx: i,
          order:
            typeof sec.order === "number" && Number.isFinite(sec.order)
              ? sec.order
              : Number.MAX_SAFE_INTEGER
        });
      }
    }
  } else {
    let idx = 0;
    for (const [key, sec] of Object.entries(rawSections)) {
      if (UNSAFE_KEYS.has(key)) {
        continue;
      }
      if (sec && typeof sec === "object" && !Array.isArray(sec)) {
        entries.push({
          sec,
          idx,
          order:
            typeof sec.order === "number" && Number.isFinite(sec.order)
              ? sec.order
              : Number.MAX_SAFE_INTEGER
        });
      }
      idx += 1;
    }
  }

  if (entries.length === 0) {
    return "";
  }

  entries.sort((a, b) => a.order - b.order || a.idx - b.idx);

  const blocks = [];
  for (const { sec } of entries) {
    const title = typeof sec.title === "string" ? sec.title.trim() : "";
    const content = typeof sec.content === "string" ? sec.content.trim() : "";
    if (title && content) {
      blocks.push(`${title}\n${content}`);
    } else if (title) {
      blocks.push(title);
    } else if (content) {
      blocks.push(content);
    }
  }

  return blocks.join("\n\n");
}
