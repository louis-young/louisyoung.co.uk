import { describe, expect, it } from "vitest";

import { shortcutFor } from "../../src/scripts/shortcuts";

const key = (value: string, modifiers: Partial<Record<"metaKey" | "ctrlKey" | "altKey", boolean>> = {}) => ({
  key: value,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  ...modifiers,
});

describe("shortcutFor", () => {
  it.each([
    ["/", "search"],
    ["t", "theme"],
    ["?", "help"],
    ["x", undefined],
  ])("maps %s to %s", (value, expected) => {
    expect(shortcutFor(key(value))).toBe(expected);
  });

  it("ignores chords so browser shortcuts keep working", () => {
    expect(shortcutFor(key("t", { metaKey: true }))).toBeUndefined();
    expect(shortcutFor(key("/", { ctrlKey: true }))).toBeUndefined();
    expect(shortcutFor(key("?", { altKey: true }))).toBeUndefined();
  });
});
