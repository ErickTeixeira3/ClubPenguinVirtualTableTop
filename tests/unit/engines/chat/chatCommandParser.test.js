import { describe, expect, it } from "vitest";
import { parseChatInput } from "../../../../src/engines/chat/index.js";

describe("parseChatInput", () => {
  it("returns empty for non-string, empty, or whitespace-only inputs", () => {
    for (const input of [null, undefined, 123, {}, [], "", "   ", "\t\n  "]) {
      expect(parseChatInput(input)).toEqual({ type: "empty" });
    }
  });

  it("parses case-insensitive /r and /roll commands with expressions", () => {
    expect(parseChatInput("/r 1d20")).toEqual({
      type: "roll",
      command: "/r",
      expression: "1d20"
    });
    expect(parseChatInput("  /ROLL\t2d6 + @Forca  ")).toEqual({
      type: "roll",
      command: "/roll",
      expression: "2d6 + @Forca"
    });
    expect(parseChatInput("/R\n1d20+3")).toEqual({
      type: "roll",
      command: "/r",
      expression: "1d20+3"
    });
  });

  it("returns invalid MISSING_EXPRESSION for bare /r or /roll", () => {
    expect(parseChatInput("/r")).toEqual({
      type: "invalid",
      command: "/r",
      error: "MISSING_EXPRESSION",
      raw: "/r"
    });
    expect(parseChatInput("  /ROLL   ")).toEqual({
      type: "invalid",
      command: "/roll",
      error: "MISSING_EXPRESSION",
      raw: "/ROLL"
    });
  });

  it("returns plain text for prefix false-positives, mid-string /r, and regular chat", () => {
    expect(parseChatInput("/rr 1d20")).toEqual({ type: "text", text: "/rr 1d20" });
    expect(parseChatInput("/red")).toEqual({ type: "text", text: "/red" });
    expect(parseChatInput("/rollback")).toEqual({ type: "text", text: "/rollback" });
    expect(parseChatInput("  olá /r 1d20  ")).toEqual({ type: "text", text: "olá /r 1d20" });
  });
});
