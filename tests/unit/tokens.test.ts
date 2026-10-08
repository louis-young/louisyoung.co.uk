import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { contrast } from "../helpers/color";

const css = readFileSync(new URL("../../src/styles/global.css", import.meta.url), "utf8");

const block = (selector: string): Record<string, string> => {
  const start = css.indexOf(`${selector} {`);
  const body = css.slice(start, css.indexOf("\n}", start));
  return Object.fromEntries(
    [...body.matchAll(/--([a-z-]+):\s*(oklch\([^)]+\))/gu)].map((match) => [match[1]!, match[2]!]),
  );
};

const themes = { light: block(":root"), dark: block(':root[data-theme="dark"]') };

/** [foreground, background, minimum ratio]. 4.5 is WCAG AA body text, 3 is large text and UI. */
const pairs: [string, string, number][] = [
  ["ink", "paper", 7],
  ["ink", "paper-sunken", 7],
  ["ink", "paper-raised", 7],
  ["ink-muted", "paper", 4.5],
  ["ink-muted", "paper-sunken", 4.5],
  ["accent", "paper", 4.5],
  ["accent", "paper-sunken", 4.5],
  ["accent", "accent-soft", 4.5],
  ["on-accent", "signal", 4.5],
  ["signal", "night", 4.5],
  ["signal-text", "paper", 4.5],
  ["signal-text", "paper-sunken", 4.5],
  ["day", "night", 7],
  ["note", "note-soft", 4.5],
  ["warning", "warning-soft", 4.5],
  ["ink", "note-soft", 7],
  ["ink", "warning-soft", 7],
  ["ink", "selection", 4.5],
  ["ink-faint", "paper", 3],
  ["rule-strong", "paper", 1.4],
];

describe.each(Object.entries(themes))("%s theme tokens", (_theme, tokens) => {
  it("defines every token used in contrast pairs", () => {
    for (const [foreground, background] of pairs) {
      expect(tokens[foreground], foreground).toBeDefined();
      expect(tokens[background], background).toBeDefined();
    }
  });

  it.each(pairs)("%s on %s meets %d:1", (foreground, background, minimum) => {
    expect(contrast(tokens[foreground] ?? "", tokens[background] ?? "")).toBeGreaterThanOrEqual(minimum);
  });
});

describe("contrast helper", () => {
  it("matches known WCAG values", () => {
    expect(contrast("oklch(100% 0 0)", "oklch(0% 0 0)")).toBeCloseTo(21, 0);
    expect(contrast("oklch(50% 0 0)", "oklch(50% 0 0)")).toBeCloseTo(1, 5);
  });
});
