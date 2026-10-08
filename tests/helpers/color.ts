/** OKLCH → linear sRGB → WCAG relative luminance. Reference: https://bottosson.github.io/posts/oklab/ */
export const oklchToLinearSrgb = (l: number, c: number, hDegrees: number): [number, number, number] => {
  const h = (hDegrees * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [
    clamp(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    clamp(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    clamp(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
};

export const parseOklch = (value: string): [number, number, number] => {
  const match = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)/u.exec(value);
  if (!match) throw new Error(`Not an oklch() colour: ${value}`);
  return [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
};

export const luminance = (oklch: string) => {
  const [r, g, b] = oklchToLinearSrgb(...parseOklch(oklch));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (foreground: string, background: string) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((x, y) => y - x) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
};
