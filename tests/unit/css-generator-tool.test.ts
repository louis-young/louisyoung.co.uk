import { describe, expect, it } from "vitest";

import {
  clampValue,
  colourWithOpacity,
  cssRule,
  defaultGradient,
  defaultLayers,
  gradientCss,
  layerCss,
  limits,
  maxLayers,
  maxStops,
  minStops,
  newLayer,
  shadowCss,
} from "../../src/lib/css-generator-tool";

describe("clampValue", () => {
  it("rounds and clamps to each control’s limits", () => {
    expect(clampValue("blur", "12.6")).toBe(13);
    expect(clampValue("blur", -5)).toBe(0);
    expect(clampValue("x", "-250")).toBe(-100);
    expect(clampValue("angle", 400)).toBe(360);
    expect(clampValue("opacity", "50")).toBe(50);
  });

  it("falls back to the minimum for blank or unreadable input", () => {
    expect(clampValue("spread", "")).toBe(limits.spread.min);
    expect(clampValue("position", "abc")).toBe(0);
    expect(clampValue("y", "-")).toBe(-100);
  });
});

describe("colourWithOpacity", () => {
  it("keeps opaque colours as hex and writes the rest as rgb() with alpha", () => {
    expect(colourWithOpacity("#FFAA00", 100)).toBe("#ffaa00");
    expect(colourWithOpacity("#0f172a", 28)).toBe("rgb(15 23 42 / 0.28)");
    expect(colourWithOpacity("#000000", 0)).toBe("rgb(0 0 0 / 0)");
    expect(colourWithOpacity("nonsense", 50)).toBe("rgb(0 0 0 / 0.5)");
  });
});

describe("shadows", () => {
  it("writes a layer, with zero lengths unitless and inset first", () => {
    expect(layerCss({ x: 0, y: 4, blur: 12, spread: -2, colour: "#000000", opacity: 20, inset: false })).toBe(
      "0 4px 12px -2px rgb(0 0 0 / 0.2)",
    );
    expect(layerCss({ x: 2, y: 2, blur: 0, spread: 0, colour: "#ffffff", opacity: 100, inset: true })).toBe(
      "inset 2px 2px 0 0 #ffffff",
    );
  });

  it("joins layers, and writes none without any", () => {
    expect(shadowCss(defaultLayers())).toBe("0 1px 2px 0 rgb(15 23 42 / 0.12), 0 12px 32px -8px rgb(15 23 42 / 0.28)");
    expect(shadowCss([])).toBe("none");
    expect(layerCss(newLayer())).toBe("0 4px 12px 0 rgb(0 0 0 / 0.2)");
  });
});

describe("gradients", () => {
  it("writes linear gradients with the angle and stops in position order", () => {
    expect(gradientCss(defaultGradient())).toBe("linear-gradient(135deg, #7c6cf0 0%, #22d3ee 100%)");
    expect(
      gradientCss({
        type: "linear",
        angle: 90,
        stops: [
          { colour: "#FF0000", position: 80 },
          { colour: "#00ff00", position: 20 },
          { colour: "#0000ff", position: 20 },
        ],
      }),
    ).toBe("linear-gradient(90deg, #00ff00 20%, #0000ff 20%, #ff0000 80%)");
  });

  it("writes radial gradients as circles", () => {
    expect(gradientCss({ ...defaultGradient(), type: "radial" })).toBe(
      "radial-gradient(circle, #7c6cf0 0%, #22d3ee 100%)",
    );
  });
});

describe("cssRule", () => {
  it("combines the background and shadow into one rule", () => {
    expect(cssRule([], defaultGradient())).toBe(
      ".box {\n  background: linear-gradient(135deg, #7c6cf0 0%, #22d3ee 100%);\n  box-shadow: none;\n}",
    );
  });

  it("keeps sensible limits", () => {
    expect(minStops).toBeLessThan(maxStops);
    expect(defaultLayers().length).toBeLessThan(maxLayers);
  });
});
