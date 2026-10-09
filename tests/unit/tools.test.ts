import { describe, expect, it } from "vitest";

import { contrastRatio, grades, luminance, nearestPassing, parseColour, toHex } from "../../src/lib/colour";
import { fluidClamp } from "../../src/lib/fluid";

describe("parseColour", () => {
  it("parses hex, rgb() and oklch()", () => {
    expect(parseColour("#fff")).toEqual([255, 255, 255]);
    expect(parseColour("0a0B0c")).toEqual([10, 11, 12]);
    expect(parseColour("rgb(1, 2, 3)")).toEqual([1, 2, 3]);
    expect(parseColour("rgb(1 2 3 / 50%)")).toEqual([1, 2, 3]);
    expect(parseColour("oklch(100% 0 0)")).toEqual([255, 255, 255]);
    expect(parseColour("oklch(0 0 0)")).toEqual([0, 0, 0]);
    expect(toHex(parseColour("oklch(62.8% 0.2577 29.23deg)")!)).toBe("#ff0000");
  });

  it("rejects anything else", () => {
    expect(parseColour("red")).toBeUndefined();
    expect(parseColour("#12345")).toBeUndefined();
    expect(parseColour("rgb(300, 0, 0)")).toBeUndefined();
  });

  // Bug hunt: a number with two decimal points became NaN channels, shown as #NaNNaNNaN.
  it("rejects oklch() numbers that aren't numbers", () => {
    expect(parseColour("oklch(0.5.1 0.1 30)")).toBeUndefined();
    expect(parseColour("oklch(50% . 30)")).toBeUndefined();
  });
});

describe("contrast", () => {
  it("matches WCAG reference values", () => {
    expect(luminance([255, 255, 255])).toBeCloseTo(1);
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21);
    expect(contrastRatio([255, 255, 255], [255, 255, 255])).toBeCloseTo(1);
    expect(contrastRatio([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
  });

  it("grades a ratio against every threshold", () => {
    expect(grades(4.6)).toEqual({ aaText: true, aaLarge: true, aaaText: false, aaaLarge: true, nonText: true });
    expect(grades(2.9)).toEqual({ aaText: false, aaLarge: false, aaaText: false, aaaLarge: false, nonText: false });
  });
});

describe("nearestPassing", () => {
  const white: [number, number, number] = [255, 255, 255];

  it("returns the colour unchanged when it already passes", () => {
    expect(nearestPassing([0, 0, 0], white, 4.5)).toEqual([0, 0, 0]);
  });

  it("darkens a light colour just enough to pass", () => {
    const fixed = nearestPassing([150, 150, 150], white, 4.5)!;
    expect(contrastRatio(fixed, white)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(fixed, white)).toBeLessThan(4.7);
  });

  it("lightens on a dark background", () => {
    const fixed = nearestPassing([60, 60, 60], [20, 20, 20], 7)!;
    expect(luminance(fixed)).toBeGreaterThan(luminance([60, 60, 60]));
    expect(contrastRatio(fixed, [20, 20, 20])).toBeGreaterThanOrEqual(7);
  });

  it("gives up when nothing can reach the target", () => {
    expect(nearestPassing([128, 128, 128], [118, 118, 118], 21)).toBeUndefined();
  });
});

describe("fluidClamp", () => {
  it("builds a rem clamp() between two viewports", () => {
    expect(fluidClamp({ minSize: 16, maxSize: 24, minViewport: 320, maxViewport: 1280 }).css).toBe(
      "clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)",
    );
  });

  it("orders the bounds when the size shrinks, and handles a flat value", () => {
    expect(fluidClamp({ minSize: 24, maxSize: 16, minViewport: 320, maxViewport: 1280 }).css).toBe(
      "clamp(1rem, 1.6667rem + -0.8333vw, 1.5rem)",
    );
    expect(fluidClamp({ minSize: 20, maxSize: 20, minViewport: 320, maxViewport: 1280, root: 10 }).css).toBe(
      "clamp(2rem, 2rem, 2rem)",
    );
  });

  it("reports invalid input", () => {
    expect(fluidClamp({ minSize: 0, maxSize: 24, minViewport: 320, maxViewport: 1280 })).toEqual({ error: "positive" });
    expect(fluidClamp({ minSize: 16, maxSize: 24, minViewport: 1280, maxViewport: 320 })).toEqual({
      error: "viewports",
    });
  });
});
