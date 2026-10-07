import { describe, expect, it } from "vitest";

import { nextPreference, parsePreference, resolveTheme } from "../../src/scripts/theme";

describe("theme preference", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    [null, "system"],
    [undefined, "system"],
    ["purple", "system"],
  ] as const)("parses %s as %s", (input, expected) => {
    expect(parsePreference(input)).toBe(expected);
  });

  it("cycles system → light → dark → system", () => {
    expect(nextPreference("system")).toBe("light");
    expect(nextPreference("light")).toBe("dark");
    expect(nextPreference("dark")).toBe("system");
  });

  it("resolves the system preference from the media query", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
