/** The two control points of a CSS cubic-bezier(): x1, y1, x2, y2. */
export type Bezier = [number, number, number, number];

/** Named curves: the CSS keywords plus the site’s own tokens and common expressive curves. */
export const presets: readonly { name: string; curve: Bezier }[] = [
  { name: "linear", curve: [0, 0, 1, 1] },
  { name: "ease", curve: [0.25, 0.1, 0.25, 1] },
  { name: "ease-in", curve: [0.42, 0, 1, 1] },
  { name: "ease-out", curve: [0, 0, 0.58, 1] },
  { name: "ease-in-out", curve: [0.42, 0, 0.58, 1] },
  { name: "ease-out-expo", curve: [0.16, 1, 0.3, 1] },
  { name: "ease-in-out-cubic", curve: [0.65, 0, 0.35, 1] },
  { name: "ease-out-back", curve: [0.34, 1.56, 0.64, 1] },
  { name: "ease-in-back", curve: [0.36, 0, 0.66, -0.56] },
];

/** The y range the graph shows, wide enough for curves that overshoot. */
const minY = -0.6;
const maxY = 1.6;

/** The graph’s size in SVG units: 200 per unit of time, 150 per unit of progress. */
export const graph = { width: 200, height: (maxY - minY) * 150 } as const;

const round = (value: number, places = 2) => Number(value.toFixed(places));

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Keeps a control point valid: CSS requires x in 0–1, and y is kept within what the graph shows. */
export const clampPoint = (x: number, y: number): [number, number] => [
  round(clamp(Number.isFinite(x) ? x : 0, 0, 1)),
  round(clamp(Number.isFinite(y) ? y : 0, minY, maxY)),
];

export const clampBezier = ([x1, y1, x2, y2]: Bezier): Bezier => [...clampPoint(x1, y1), ...clampPoint(x2, y2)];

export const formatBezier = (curve: Bezier) => `cubic-bezier(${clampBezier(curve).join(", ")})`;

/** The preset whose curve matches, if any. */
export const presetFor = (curve: Bezier) =>
  presets.find((preset) => preset.curve.every((value, index) => value === curve[index]))?.name;

/** A point on the curve at parameter `t` (not time: x is time). */
const pointAt = (t: number, [x1, y1, x2, y2]: Bezier) => {
  const u = 1 - t;
  const along = (p1: number, p2: number) => 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
  return { x: along(x1, x2), y: along(y1, y2) };
};

/** A curve point (time, progress) in graph coordinates, y pointing down. */
export const toGraph = (x: number, y: number): [number, number] => [
  round(x * graph.width),
  round((maxY - y) * (graph.height / (maxY - minY))),
];

/** Graph coordinates back to a clamped control point. */
export const fromGraph = (gx: number, gy: number) =>
  clampPoint(gx / graph.width, maxY - gy / (graph.height / (maxY - minY)));

/** The curve as an SVG path through `samples` + 1 points. */
export const curvePath = (curve: Bezier, samples = 48) =>
  Array.from({ length: samples + 1 }, (_, index) => {
    const { x, y } = pointAt(index / samples, clampBezier(curve));
    return `${index === 0 ? "M" : "L"}${toGraph(x, y).join(" ")}`;
  }).join(" ");
