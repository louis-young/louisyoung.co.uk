import { describe, expect, it } from "vitest";

import { contrastRatio, type Rgb } from "../../src/lib/colour";
import {
  formats,
  oklchToRgb,
  parseAnyColour,
  propertyName,
  ratioText,
  rgbToHsl,
  rgbToOklch,
  scaleCss,
  tonalScale,
} from "../../src/lib/colour-convert";

describe("parseAnyColour", () => {
  it("parses hsl() in every common spelling", () => {
    expect(parseAnyColour("hsl(210 50% 40%)")).toEqual([51, 102, 153]);
    expect(parseAnyColour("hsl(210, 50%, 40%)")).toEqual([51, 102, 153]);
    expect(parseAnyColour("HSLA(210deg 50% 40% / 0.5)")).toEqual([51, 102, 153]);
    expect(parseAnyColour("hsl(0.5turn 100% 50%)")).toEqual([0, 255, 255]);
    expect(parseAnyColour("hsl(-120 100% 50%)")).toEqual([0, 0, 255]);
    expect(parseAnyColour("hsl(0 0% 100%)")).toEqual([255, 255, 255]);
  });

  it("delegates hex, rgb() and oklch() to the shared parser", () => {
    expect(parseAnyColour("  #FFF ")).toEqual([255, 255, 255]);
    expect(parseAnyColour("rgb(1 2 3)")).toEqual([1, 2, 3]);
    expect(parseAnyColour("oklch(62.8% 0.2577 29.23)")).toEqual([255, 0, 0]);
  });

  it("rejects malformed or out-of-range hsl()", () => {
    expect(parseAnyColour("hsl(10 120% 50%)")).toBeUndefined();
    expect(parseAnyColour("hsl(10 50% 101%)")).toBeUndefined();
    expect(parseAnyColour("hsl(1.2.3 50% 50%)")).toBeUndefined();
    expect(parseAnyColour("hsl(red)")).toBeUndefined();
    expect(parseAnyColour("tomato")).toBeUndefined();
  });
});

describe("rgbToHsl", () => {
  it("covers each hue sector and greys", () => {
    expect(rgbToHsl([255, 0, 0])).toEqual([0, 100, 50]);
    expect(rgbToHsl([0, 255, 0])).toEqual([120, 100, 50]);
    expect(rgbToHsl([0, 0, 255])).toEqual([240, 100, 50]);
    expect(rgbToHsl([255, 0, 128])[0]).toBeCloseTo(329.9, 1);
    expect(rgbToHsl([128, 128, 128])).toEqual([0, 0, (128 / 255) * 100]);
  });
});

describe("OKLCH", () => {
  it("matches reference values", () => {
    const red = rgbToOklch([255, 0, 0]);
    expect(red.l).toBeCloseTo(0.628, 3);
    expect(red.c).toBeCloseTo(0.2577, 3);
    expect(red.h).toBeCloseTo(29.23, 1);
    expect(rgbToOklch([0, 0, 255]).h).toBeCloseTo(264.05, 1);
    expect(rgbToOklch([255, 255, 255])).toEqual({ l: expect.closeTo(1, 4) as number, c: 0, h: 0 });
    expect(rgbToOklch([0, 0, 0])).toEqual({ l: 0, c: 0, h: 0 });
  });

  it("round-trips sRGB colours", () => {
    const colours: Rgb[] = [
      [255, 0, 0],
      [12, 200, 99],
      [124, 108, 240],
      [3, 3, 3],
      [250, 250, 240],
    ];
    for (const colour of colours) expect(oklchToRgb(rgbToOklch(colour))).toEqual(colour);
  });

  it("maps out-of-gamut colours by reducing chroma, keeping the hue", () => {
    const mapped = oklchToRgb({ l: 0.9, c: 0.4, h: 264 });
    expect(mapped.every((channel) => channel >= 0 && channel <= 255)).toBe(true);
    const { h, l } = rgbToOklch(mapped);
    expect(h).toBeGreaterThan(255);
    expect(h).toBeLessThan(275);
    expect(l).toBeCloseTo(0.9, 1);
  });

  it("treats lightness at or beyond the ends as white or black", () => {
    expect(oklchToRgb({ l: 1.2, c: 0.1, h: 30 })).toEqual([255, 255, 255]);
    expect(oklchToRgb({ l: 0, c: 0.1, h: 30 })).toEqual([0, 0, 0]);
  });
});

describe("formats", () => {
  it("writes every syntax, and each parses back to the same colour", () => {
    const colour: Rgb = [124, 108, 240];
    const result = formats(colour);
    expect(result).toEqual({
      hex: "#7c6cf0",
      rgb: "rgb(124 108 240)",
      hsl: "hsl(247.3 81.5% 68.2%)",
      oklch: expect.stringMatching(/^oklch\(\d+(\.\d+)?% 0\.\d+ \d+(\.\d+)?\)$/u) as string,
    });
    for (const value of Object.values(result)) expect(parseAnyColour(value)).toEqual(colour);
  });

  it("writes greys without a hue", () => {
    expect(formats([128, 128, 128]).oklch).toMatch(/ 0 0\)$/u);
  });
});

describe("tonalScale", () => {
  const scale = tonalScale([124, 108, 240]);

  it("has 11 steps from light to dark", () => {
    expect(scale.map(({ step }) => step)).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]);
    const lightness = scale.map(({ hex }) => rgbToOklch(parseAnyColour(hex)!).l);
    for (let index = 1; index < lightness.length; index += 1) {
      expect(lightness[index]).toBeLessThan(lightness[index - 1]!);
    }
  });

  it("keeps the hue and reports contrast against white and black", () => {
    for (const { hex, onWhite, onBlack } of scale) {
      const rgb = parseAnyColour(hex)!;
      expect(rgbToOklch(rgb).h).toBeGreaterThan(270);
      expect(rgbToOklch(rgb).h).toBeLessThan(300);
      expect(onWhite).toBeCloseTo(contrastRatio(rgb, [255, 255, 255]));
      expect(onBlack).toBeCloseTo(contrastRatio(rgb, [0, 0, 0]));
    }
    expect(scale[0]!.onBlack).toBeGreaterThan(15);
    expect(scale[10]!.onWhite).toBeGreaterThan(12);
  });

  it("stays grey for a grey", () => {
    for (const { hex } of tonalScale([128, 128, 128])) expect(rgbToOklch(parseAnyColour(hex)!).c).toBeLessThan(0.002);
  });
});

describe("CSS output", () => {
  it("cleans up custom property names", () => {
    expect(propertyName("Brand Blue!")).toBe("brand-blue");
    expect(propertyName("--accent")).toBe("accent");
    expect(propertyName("  ")).toBe("colour");
    expect(propertyName("***", "x")).toBe("x");
  });

  it("writes a :root block", () => {
    const css = scaleCss(tonalScale([124, 108, 240]), "Brand");
    expect(css.startsWith(":root {\n  --brand-50: #")).toBe(true);
    expect(css.split("\n")).toHaveLength(13);
    expect(css.endsWith(";\n}")).toBe(true);
  });

  it("rounds ratios down", () => {
    expect(ratioText(4.499)).toBe("4.49:1");
    expect(ratioText(21)).toBe("21.00:1");
  });
});
