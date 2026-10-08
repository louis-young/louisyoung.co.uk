import { contrastRatio, parseColour, toHex, type Rgb } from "./colour";

/** OKLCH with lightness 0–1, chroma ≥ 0 and hue in degrees 0–360. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
}

type Linear = [number, number, number];

const round = (value: number, places: number) => Number(value.toFixed(places)).toString();

const toLinear = (byte: number) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (value: number) => 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

const toByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

/** Parses hsl()/hsla() with degrees or turns, commas or spaces. Returns undefined for anything else. */
const parseHsl = (value: string): Rgb | undefined => {
  const match = /^hsla?\(\s*(-?[\d.]+)(deg|turn)?[\s,]+([\d.]+)%?[\s,]+([\d.]+)%?\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/u.exec(
    value,
  );
  if (!match) return undefined;
  const [hue, saturation, lightness] = [Number(match[1]), Number(match[3]), Number(match[4])];
  if ([hue, saturation, lightness].some(Number.isNaN) || saturation > 100 || lightness > 100) return undefined;
  return hslToRgb(match[2] === "turn" ? hue * 360 : hue, saturation / 100, lightness / 100);
};

const hslToRgb = (hue: number, saturation: number, lightness: number): Rgb => {
  const h = (((hue % 360) + 360) % 360) / 30;
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number) => {
    const k = (n + h) % 12;
    return toByte(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [channel(0), channel(8), channel(4)];
};

/** Any colour the tool accepts: #rgb, #rrggbb, rgb(), hsl() or oklch(). */
export const parseAnyColour = (input: string): Rgb | undefined => {
  const value = input.trim().toLowerCase();
  return value.startsWith("hsl") ? parseHsl(value) : parseColour(value);
};

/** sRGB to HSL: hue in degrees, saturation and lightness 0–100. */
export const rgbToHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return [0, 0, lightness * 100];
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === red) hue = ((green - blue) / delta) % 6;
  else if (max === green) hue = (blue - red) / delta + 2;
  else hue = (red - green) / delta + 4;
  return [(hue * 60 + 360) % 360, saturation * 100, lightness * 100];
};

/** sRGB to OKLCH. Reference: https://bottosson.github.io/posts/oklab/ */
export const rgbToOklch = (rgb: Rgb): Oklch => {
  const [r, g, b] = rgb.map(toLinear) as Linear;
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const chroma = Math.hypot(a, bb);
  // Greys have no meaningful hue; floating-point noise would otherwise give a random one.
  const hue = chroma < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: lightness, c: chroma < 1e-4 ? 0 : chroma, h: hue };
};

const oklchToLinear = ({ l, c, h }: Oklch): Linear => {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
};

const inGamut = (linear: Linear) => linear.every((value) => value >= -1e-6 && value <= 1 + 1e-6);

/**
 * OKLCH to sRGB, mapped into the gamut by reducing chroma (keeping lightness and hue) rather than
 * clipping each channel, which would shift the hue.
 */
export const oklchToRgb = (colour: Oklch): Rgb => {
  if (colour.l >= 1) return [255, 255, 255];
  if (colour.l <= 0) return [0, 0, 0];
  let linear = oklchToLinear(colour);
  if (!inGamut(linear)) {
    let low = 0;
    let high = colour.c;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (inGamut(oklchToLinear({ ...colour, c: middle }))) low = middle;
      else high = middle;
    }
    linear = oklchToLinear({ ...colour, c: low });
  }
  return linear.map((value) => toByte(fromLinear(Math.min(1, Math.max(0, value))))) as Rgb;
};

/** The colour written in each CSS syntax the tool offers. */
export const formats = (rgb: Rgb) => {
  const [h, s, l] = rgbToHsl(rgb);
  const oklch = rgbToOklch(rgb);
  return {
    hex: toHex(rgb),
    rgb: `rgb(${rgb.join(" ")})`,
    hsl: `hsl(${round(h, 1)} ${round(s, 1)}% ${round(l, 1)}%)`,
    oklch: `oklch(${round(oklch.l * 100, 2)}% ${round(oklch.c, 4)} ${round(oklch.h, 2)})`,
  };
};

/** The steps of a tonal scale, with the OKLCH lightness and share of the base chroma for each. */
const scaleSteps = [
  { step: 50, l: 0.97, chroma: 0.25 },
  { step: 100, l: 0.93, chroma: 0.4 },
  { step: 200, l: 0.87, chroma: 0.6 },
  { step: 300, l: 0.79, chroma: 0.8 },
  { step: 400, l: 0.7, chroma: 0.95 },
  { step: 500, l: 0.62, chroma: 1 },
  { step: 600, l: 0.54, chroma: 1 },
  { step: 700, l: 0.46, chroma: 0.9 },
  { step: 800, l: 0.38, chroma: 0.75 },
  { step: 900, l: 0.3, chroma: 0.6 },
  { step: 950, l: 0.22, chroma: 0.45 },
] as const;

const white: Rgb = [255, 255, 255];
const black: Rgb = [0, 0, 0];

/**
 * An 11-step (50–950) scale with the base colour's hue, evenly spaced in OKLCH lightness, with
 * chroma eased towards the ends and every step mapped into sRGB.
 */
export const tonalScale = (base: Rgb) => {
  const { c, h } = rgbToOklch(base);
  return scaleSteps.map(({ step, l, chroma }) => {
    const rgb = oklchToRgb({ l, c: c * chroma, h });
    return { step, hex: toHex(rgb), onWhite: contrastRatio(rgb, white), onBlack: contrastRatio(rgb, black) };
  });
};

/** A custom-property name from free text: lower-case letters, digits and hyphens. */
export const propertyName = (input: string, fallback = "colour") =>
  input
    .trim()
    .toLowerCase()
    .replace(/^-+/u, "")
    .replace(/[^a-z\d-]+/gu, "-")
    .replace(/-+$/u, "") || fallback;

/** The scale as a `:root` block of custom properties. */
export const scaleCss = (scale: ReturnType<typeof tonalScale>, name: string) =>
  `:root {\n${scale.map(({ step, hex }) => `  --${propertyName(name)}-${step}: ${hex};`).join("\n")}\n}`;

/** A contrast ratio as shown in the tool: rounded down, so 4.499 never reads as a pass. */
export const ratioText = (ratio: number) => `${(Math.floor(ratio * 100) / 100).toFixed(2)}:1`;
