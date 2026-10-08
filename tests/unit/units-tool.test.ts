import { describe, expect, it } from "vitest";

import { convertAll, defaultContext, isUnit, units } from "../../src/lib/units-tool";

const context = { root: 16, parent: 20, viewportWidth: 1000, viewportHeight: 500 };

const table = (value: number, from: (typeof units)[number], ctx = context) => {
  const result = convertAll(value, from, ctx);
  if ("error" in result) throw new Error(result.error);
  return Object.fromEntries(result.rows.map((row) => [row.unit, row.css]));
};

describe("convertAll", () => {
  it("converts pixels to every unit", () => {
    expect(table(24, "px")).toEqual({
      px: "24px",
      rem: "1.5rem",
      em: "1.2em",
      pt: "18pt",
      vw: "2.4vw",
      vh: "4.8vh",
      "%": "120%",
    });
  });

  it("converts from relative units", () => {
    expect(table(2, "rem").px).toBe("32px");
    expect(table(1, "em").px).toBe("20px");
    expect(table(12, "pt").px).toBe("16px");
    expect(table(10, "vw").px).toBe("100px");
    expect(table(10, "vh").px).toBe("50px");
    expect(table(50, "%").em).toBe("0.5em");
  });

  it("rounds to four places and never shows negative zero", () => {
    expect(table(1, "px").rem).toBe("0.0625rem");
    expect(table(1, "px", { ...context, viewportWidth: 1440 }).vw).toBe("0.0694vw");
    expect(table(-0, "px").rem).toBe("0rem");
    expect(table(-8, "px").rem).toBe("-0.5rem");
  });

  it("rejects a missing value or a non-positive context", () => {
    expect(convertAll(Number.NaN, "px", context)).toEqual({ error: "value" });
    expect(convertAll(1, "px", { ...context, root: 0 })).toEqual({ error: "context" });
    expect(convertAll(1, "px", { ...context, viewportHeight: Number.POSITIVE_INFINITY })).toEqual({
      error: "context",
    });
  });

  it("has sensible defaults", () => {
    expect(table(16, "px", defaultContext).rem).toBe("1rem");
  });
});

describe("isUnit", () => {
  it("knows the units it converts", () => {
    expect(units.every(isUnit)).toBe(true);
    expect(isUnit("ch")).toBe(false);
  });
});
