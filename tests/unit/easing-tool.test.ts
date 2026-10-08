import { describe, expect, it } from "vitest";

import {
  clampBezier,
  clampPoint,
  curvePath,
  formatBezier,
  fromGraph,
  graph,
  presetFor,
  presets,
  toGraph,
} from "../../src/lib/easing-tool";

describe("clamping", () => {
  it("keeps x within 0–1 and y within the graph", () => {
    expect(clampPoint(-0.2, 3)).toEqual([0, 1.6]);
    expect(clampPoint(1.4, -2)).toEqual([1, -0.6]);
    expect(clampPoint(0.123456, 0.987654)).toEqual([0.12, 0.99]);
    expect(clampPoint(Number.NaN, Number.NaN)).toEqual([0, 0]);
    expect(clampBezier([2, 0, -1, 1])).toEqual([1, 0, 0, 1]);
  });

  it("formats valid CSS", () => {
    expect(formatBezier([0.16, 1, 0.3, 1])).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(formatBezier([1.5, 0, 0.5, 1])).toBe("cubic-bezier(1, 0, 0.5, 1)");
  });
});

describe("presets", () => {
  it("are all valid and uniquely named", () => {
    expect(new Set(presets.map((preset) => preset.name)).size).toBe(presets.length);
    for (const preset of presets) expect(clampBezier(preset.curve)).toEqual(preset.curve);
  });

  it("are recognised by their curve", () => {
    expect(presetFor([0.25, 0.1, 0.25, 1])).toBe("ease");
    expect(presetFor([0.25, 0.1, 0.25, 0.9])).toBeUndefined();
  });
});

describe("graph coordinates", () => {
  it("maps time across and progress up", () => {
    expect(graph).toEqual({ width: 200, height: 330 });
    expect(toGraph(0, 0)).toEqual([0, 240]);
    expect(toGraph(1, 1)).toEqual([200, 90]);
    expect(toGraph(0, 1.6)).toEqual([0, 0]);
  });

  it("maps back, clamped", () => {
    expect(fromGraph(100, 165)).toEqual([0.5, 0.5]);
    expect(fromGraph(-50, 400)).toEqual([0, -0.6]);
    expect(fromGraph(...toGraph(0.3, 1.2))).toEqual([0.3, 1.2]);
  });
});

describe("curvePath", () => {
  it("runs from the origin to (1, 1)", () => {
    const path = curvePath([0.42, 0, 0.58, 1], 4);
    expect(path).toBe("M0 240 L" + path.split(" L").slice(1).join(" L"));
    expect(path.split(" L")).toHaveLength(5);
    expect(path.endsWith("L200 90")).toBe(true);
  });

  it("draws linear as a straight line", () => {
    expect(curvePath([0, 0, 1, 1], 2)).toBe("M0 240 L100 165 L200 90");
  });

  it("clamps the curve before drawing it", () => {
    expect(curvePath([5, 0, 1, 1])).toBe(curvePath([1, 0, 1, 1]));
    expect(curvePath([0, 0, 1, 1]).split(" L")).toHaveLength(49);
  });
});
