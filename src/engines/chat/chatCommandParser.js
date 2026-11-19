const ROLL_COMMAND_REGEX = /^(\/roll|\/r)(?:\s+([\s\S]+))?$/i;

export function parseChatInput(rawText) {
  if (typeof rawText !== "string") {
    return { type: "empty" };
  }

  const trimmed = rawText.trim();
  if (trimmed.length === 0) {
    return { type: "empty" };
  }

  const match = ROLL_COMMAND_REGEX.exec(trimmed);
  if (match) {
    const command = match[1].toLowerCase();
    const expression = typeof match[2] === "string" ? match[2].trim() : "";
    if (!expression) {
      return {
        type: "invalid",
        command,
        error: "MISSING_EXPRESSION",
        raw: trimmed
      };
    }
    return {
      type: "roll",
      command,
      expression
    };
  }

  return {
    type: "text",
    text: trimmed
  };
}
