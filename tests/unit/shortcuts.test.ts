import { describe, expect, it } from "vitest";

import { clampStep, shortcutFor } from "../../src/scripts/shortcuts";

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
    ["g", "grid"],
    ["j", "next"],
    ["k", "previous"],
    ["?", "palette"],
    ["x", undefined],
  ])("maps %s to %s", (value, expected) => {
    expect(shortcutFor(key(value))).toBe(expected);
  });

  it("ignores chords so browser shortcuts keep working", () => {
    expect(shortcutFor(key("t", { metaKey: true }))).toBeUndefined();
    expect(shortcutFor(key("/", { ctrlKey: true }))).toBeUndefined();
    expect(shortcutFor(key("?", { altKey: true }))).toBeUndefined();
    expect(shortcutFor(key("k", { altKey: true, metaKey: true }))).toBeUndefined();
  });

  it("opens the palette with ⌘K or Ctrl+K", () => {
    expect(shortcutFor(key("k", { metaKey: true }))).toBe("palette");
    expect(shortcutFor(key("K", { ctrlKey: true }))).toBe("palette");
    expect(shortcutFor(key("k"))).toBe("previous");
  });
});

describe("clampStep", () => {
  it.each([
    [-1, 1, 3, 0],
    [-1, -1, 3, 2],
    [0, 1, 3, 1],
    [2, 1, 3, 2],
    [0, -1, 3, 0],
  ] as const)("from %i by %i of %i is %i", (current, delta, length, expected) => {
    expect(clampStep(current, delta, length)).toBe(expected);
  });
});
