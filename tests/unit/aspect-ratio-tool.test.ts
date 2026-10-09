import { describe, expect, it } from "vitest";

import {
  aspectRatioCss,
  commonRatios,
  decimalRatio,
  gcd,
  nearestRatio,
  parseRatio,
  presets,
  reduceRatio,
  solveHeight,
  solveWidth,
  tidy,
} from "../../src/lib/aspect-ratio-tool";

describe("reduceRatio", () => {
  it("finds the greatest common divisor", () => {
    expect(gcd(1920, 1080)).toBe(120);
    expect(gcd(7, 13)).toBe(1);
    expect(gcd(5, 0)).toBe(5);
  });

  it.each([
    [1920, 1080, 16, 9],
    [1366, 768, 683, 384],
    [1080, 1080, 1, 1],
    [1080, 1920, 9, 16],
    [2.39, 1, 239, 100],
    [1.5, 0.75, 2, 1],
    [3440, 1440, 43, 18],
  ])("reduces %d × %d to %d:%d", (width, height, w, h) => {
    expect(reduceRatio(width, height)).toEqual({ width: w, height: h });
  });

  it("rejects sizes that aren’t positive numbers", () => {
    for (const [width, height] of [
      [0, 1],
      [1, -1],
      [Number.NaN, 1],
      [1, Number.POSITIVE_INFINITY],
      [1e-7, 1],
    ] as const) {
      expect(reduceRatio(width, height)).toBeUndefined();
    }
    expect(reduceRatio(1e21, 1e21)).toEqual({ width: 1, height: 1 });
  });
});

describe("ratios", () => {
  it("writes the decimal ratio", () => {
    expect(decimalRatio(1920, 1080)).toBe("1.7778");
    expect(decimalRatio(4, 2)).toBe("2");
    expect(tidy(720)).toBe("720");
    expect(tidy(719.999_99)).toBe("720");
    expect(tidy(1.256)).toBe("1.26");
  });

  it("names the nearest common ratio", () => {
    expect(nearestRatio(1920, 1080)).toMatchObject({ id: "16:9", exact: true });
    expect(nearestRatio(1440, 900)).toMatchObject({ id: "16:10", exact: true });
    expect(nearestRatio(1080, 1920)).toMatchObject({ id: "9:16", exact: true });
    expect(nearestRatio(2100, 900)).toMatchObject({ id: "21:9", exact: true });
    expect(nearestRatio(3440, 1440)).toMatchObject({ id: "2.39:1", exact: false });
    const laptop = nearestRatio(1366, 768);
    expect(laptop).toMatchObject({ id: "16:9", exact: false });
    expect(laptop.off).toBeCloseTo(0.05, 2);
    expect(nearestRatio(100, 1)).toMatchObject({ id: "32:9" });
    expect(nearestRatio(1, 100)).toMatchObject({ id: "9:16" });
  });

  it("lists every common ratio once", () => {
    expect(new Set(commonRatios.map((ratio) => ratio.id)).size).toBe(commonRatios.length);
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length);
  });

  it.each([
    ["16:9", 16, 9],
    [" 4 / 3 ", 4, 3],
    ["21x9", 21, 9],
    ["3 × 2", 3, 2],
    ["1.85:1", 1.85, 1],
    ["2.39", 2.39, 1],
    [".5:1", 0.5, 1],
  ])("reads %j", (text, width, height) => {
    expect(parseRatio(text)).toEqual({ width, height });
  });

  it.each(["", "16:", "a:b", "16:9:1", "0:1", "1:0", "-1:2"])("rejects %j", (text) => {
    expect(parseRatio(text)).toBeUndefined();
  });
});

describe("solving", () => {
  it("solves the other side at a ratio", () => {
    const ratio = { width: 16, height: 9 };
    expect(solveHeight(1280, ratio)).toBe(720);
    expect(solveWidth(1080, ratio)).toBe(1920);
    expect(tidy(solveHeight(1000, ratio))).toBe("562.5");
  });

  it("writes the CSS", () => {
    expect(aspectRatioCss(1920, 1080)).toBe("aspect-ratio: 16 / 9;");
    expect(aspectRatioCss(2.39, 1)).toBe("aspect-ratio: 239 / 100;");
    expect(aspectRatioCss(0, 1)).toBe("");
  });
});
