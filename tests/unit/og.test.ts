import { describe, expect, it } from "vitest";

import { titleSize } from "../../src/lib/og";

describe("titleSize", () => {
  it("steps the font size down as titles get longer", () => {
    expect(titleSize("Short title")).toBe(100);
    expect(titleSize("How to build an article progress indicator")).toBe(84);
    expect(titleSize("A".repeat(61))).toBe(70);
  });
});
