import { describe, expect, it } from "vitest";

import { titleSize, withoutCanvasMasks } from "../../src/lib/og";

describe("titleSize", () => {
  it("steps the font size down as titles get longer", () => {
    expect(titleSize("Short title")).toBe(84);
    expect(titleSize("How to build an article progress indicator")).toBe(70);
    expect(titleSize("A".repeat(61))).toBe(60);
  });
});

describe("withoutCanvasMasks", () => {
  const canvasMask = '<mask id="m0"><rect x="0" y="0" width="1200" height="630" fill="#fff"/></mask>';
  const partialMask = '<mask id="m1"><rect x="72" y="64" width="56" height="56" fill="#fff"/></mask>';

  it("drops references to masks that cover the whole canvas", () => {
    const svg = `<svg>${canvasMask}<circle r="1200" mask="url(#m0)"/></svg>`;
    expect(withoutCanvasMasks(svg, 1200, 630)).toBe(`<svg>${canvasMask}<circle r="1200"/></svg>`);
  });

  it("keeps masks that cover only part of the canvas, or a canvas of another size", () => {
    const svg = `<svg>${canvasMask}${partialMask}<path mask="url(#m1)"/><rect mask="url(#m0)"/></svg>`;
    expect(withoutCanvasMasks(svg, 1200, 630)).toBe(svg.replace(' mask="url(#m0)"', ""));
    expect(withoutCanvasMasks(svg, 512, 512)).toBe(svg);
  });
});
