/** Greatest common divisor of two non-negative integers (Euclid). */
export const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Decimal places kept when a dimension isn’t a whole number: 2.39 × 1 reduces as 239 × 100. */
const places = (value: number) => {
  const text = String(value);
  if (text.includes("e")) return 0;
  return text.split(".")[1]?.length ?? 0;
};

const isDimension = (value: number) => Number.isFinite(value) && value > 0;

/** Width and height in lowest terms: 1920 × 1080 → 16 × 9. Decimals are scaled up first. */
export const reduceRatio = (width: number, height: number) => {
  if (!isDimension(width) || !isDimension(height)) return undefined;
  const scale = 10 ** Math.min(6, Math.max(places(width), places(height)));
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);
  if (w === 0 || h === 0) return undefined;
  const divisor = gcd(w, h);
  return { width: w / divisor, height: h / divisor };
};

/** Rounds to at most `digits` decimal places and drops trailing zeros: 1.7778, 720, 2.5. */
export const tidy = (value: number, digits = 2) => String(Number(value.toFixed(digits)));

/** Width divided by height, to four decimal places: 1.7778. */
export const decimalRatio = (width: number, height: number) => tidy(width / height, 4);

/** Ratios people name, landscape then portrait. */
export const commonRatios = [
  { id: "1:1", width: 1, height: 1 },
  { id: "5:4", width: 5, height: 4 },
  { id: "4:3", width: 4, height: 3 },
  { id: "3:2", width: 3, height: 2 },
  { id: "16:10", width: 16, height: 10 },
  { id: "16:9", width: 16, height: 9 },
  { id: "1.85:1", width: 1.85, height: 1 },
  { id: "2:1", width: 2, height: 1 },
  { id: "21:9", width: 21, height: 9 },
  { id: "2.39:1", width: 2.39, height: 1 },
  { id: "32:9", width: 32, height: 9 },
  { id: "4:5", width: 4, height: 5 },
  { id: "3:4", width: 3, height: 4 },
  { id: "2:3", width: 2, height: 3 },
  { id: "9:16", width: 9, height: 16 },
] as const;

/**
 * The named ratio closest to `width / height`, compared on a log scale so 2:1 is as far from 1:1
 * as 1:2 is. `off` is how far the actual ratio is from it, as a percentage.
 */
export const nearestRatio = (width: number, height: number) => {
  const actual = Math.log(width / height);
  const [nearest] = commonRatios
    .map((ratio) => ({ ratio, distance: Math.abs(Math.log(ratio.width / ratio.height) - actual) }))
    .sort((a, b) => a.distance - b.distance);
  const { ratio } = nearest!;
  const off = Math.abs((width / height / (ratio.width / ratio.height) - 1) * 100);
  return { id: ratio.id, exact: off < 0.005, off };
};

/** Reads `16:9`, `16/9`, `16 x 9`, `1.85:1` or a single number (`2.39`, meaning 2.39:1). */
export const parseRatio = (text: string) => {
  const match = /^\s*(\d+(?:\.\d+)?|\.\d+)\s*(?:[:/x×]\s*(\d+(?:\.\d+)?|\.\d+))?\s*$/iu.exec(text);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = match[2] === undefined ? 1 : Number(match[2]);
  return isDimension(width) && isDimension(height) ? { width, height } : undefined;
};

/** The other side of a box at a ratio: a 1280-wide 16:9 box is 720 high. */
export const solveHeight = (width: number, ratio: { width: number; height: number }) =>
  (width * ratio.height) / ratio.width;

export const solveWidth = (height: number, ratio: { width: number; height: number }) =>
  (height * ratio.width) / ratio.height;

/** The CSS declaration for a ratio, reduced: `aspect-ratio: 16 / 9;`. */
export const aspectRatioCss = (width: number, height: number) => {
  const reduced = reduceRatio(width, height);
  return reduced ? `aspect-ratio: ${reduced.width} / ${reduced.height};` : "";
};

/** Sizes people often need, with the key for their name. */
export const presets = [
  { id: "fullHd", width: 1920, height: 1080 },
  { id: "hd", width: 1280, height: 720 },
  { id: "uhd", width: 3840, height: 2160 },
  { id: "ultrawide", width: 3440, height: 1440 },
  { id: "laptop", width: 1440, height: 900 },
  { id: "ipad", width: 2048, height: 1536 },
  { id: "photo", width: 6000, height: 4000 },
  { id: "og", width: 1200, height: 630 },
  { id: "square", width: 1080, height: 1080 },
  { id: "portrait", width: 1080, height: 1350 },
  { id: "story", width: 1080, height: 1920 },
] as const;
export type PresetId = (typeof presets)[number]["id"];
