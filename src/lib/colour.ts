/** sRGB channels, each 0–255. */
export type Rgb = [number, number, number];

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const fromLinear = (value: number) => 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

const toLinear = (byte: number) => {
  const value = byte / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

/** OKLCH (lightness 0–1) to sRGB, clipped to the gamut. Reference: https://bottosson.github.io/posts/oklab/ */
const oklchToRgb = (l: number, c: number, hue: number): Rgb => {
  const h = (hue * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return linear.map((value) => clampByte(fromLinear(Math.min(1, Math.max(0, value))))) as Rgb;
};

/** Parses #rgb, #rrggbb, rgb(r g b) / rgb(r, g, b) and oklch(L% C H). Returns undefined for anything else. */
export const parseColour = (input: string): Rgb | undefined => {
  const value = input.trim().toLowerCase();
  const short = /^#?([\da-f])([\da-f])([\da-f])$/u.exec(value);
  if (short) return short.slice(1).map((digit) => Number.parseInt(digit + digit, 16)) as Rgb;
  const long = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/u.exec(value);
  if (long) return long.slice(1).map((pair) => Number.parseInt(pair, 16)) as Rgb;
  const rgb = /^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*(?:[,/]\s*[\d.]+%?\s*)?\)$/u.exec(value);
  if (rgb) {
    const channels = rgb.slice(1).map(Number);
    return channels.every((channel) => channel <= 255) ? (channels as Rgb) : undefined;
  }
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:deg)?\s*(?:\/\s*[\d.]+%?\s*)?\)$/u.exec(value);
  if (oklch) {
    const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1);
    return oklchToRgb(lightness, Number(oklch[3]), Number(oklch[4]));
  }
  return undefined;
};

export const toHex = (rgb: Rgb) =>
  `#${rgb.map((channel) => clampByte(channel).toString(16).padStart(2, "0")).join("")}`;

/** WCAG 2 relative luminance. */
export const luminance = ([r, g, b]: Rgb) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

/** WCAG 2 contrast ratio, 1–21. */
export const contrastRatio = (foreground: Rgb, background: Rgb) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};

/** Which WCAG 2.2 thresholds a ratio meets. Large text is 24px, or 18.66px bold. */
export const grades = (ratio: number) => ({
  aaText: ratio >= 4.5,
  aaLarge: ratio >= 3,
  aaaText: ratio >= 7,
  aaaLarge: ratio >= 4.5,
  nonText: ratio >= 3,
});

const mix = (from: Rgb, to: Rgb, amount: number): Rgb =>
  from.map((channel, index) => channel + (to[index]! - channel) * amount) as Rgb;

/**
 * The closest colour to `foreground` (by mixing towards black or white) that reaches `target`
 * against `background`. Returns the foreground itself when it already passes, or undefined when
 * no mix can reach the target.
 */
export const nearestPassing = (foreground: Rgb, background: Rgb, target: number): Rgb | undefined => {
  if (contrastRatio(foreground, background) >= target) return foreground;
  const candidates = (
    [
      [0, 0, 0],
      [255, 255, 255],
    ] as Rgb[]
  ).flatMap((extreme) => {
    if (contrastRatio(extreme, background) < target) return [];
    let low = 0;
    let high = 1;
    for (let step = 0; step < 24; step += 1) {
      const middle = (low + high) / 2;
      if (contrastRatio(mix(foreground, extreme, middle), background) >= target) high = middle;
      else low = middle;
    }
    let result = mix(foreground, extreme, high).map(clampByte) as Rgb;
    // Rounding to whole bytes can land just under the target: step each channel one byte closer
    // to the extreme until it passes (at most 255 steps, by which point it *is* the extreme).
    for (let step = 0; step < 255 && contrastRatio(result, background) < target; step += 1) {
      result = result.map((channel, index) => channel + Math.sign(extreme[index]! - channel)) as Rgb;
    }
    return [{ amount: high, result }];
  });
  return candidates.sort((a, b) => a.amount - b.amount)[0]?.result;
};
