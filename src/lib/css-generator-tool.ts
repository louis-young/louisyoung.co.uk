import { parseColour } from "./colour";

export interface ShadowLayer {
  x: number;
  y: number;
  blur: number;
  spread: number;
  /** A hex colour, as `<input type="color">` gives it. */
  colour: string;
  /** Opacity from 0 to 100. */
  opacity: number;
  inset: boolean;
}

export interface GradientStop {
  colour: string;
  /** Position along the gradient line, 0 to 100. */
  position: number;
}

export interface Gradient {
  type: "linear" | "radial";
  /** Direction of a linear gradient in degrees; radial gradients ignore it. */
  angle: number;
  stops: GradientStop[];
}

/** The range each number control allows. */
export const limits = {
  x: { min: -100, max: 100 },
  y: { min: -100, max: 100 },
  blur: { min: 0, max: 200 },
  spread: { min: -100, max: 100 },
  opacity: { min: 0, max: 100 },
  angle: { min: 0, max: 360 },
  position: { min: 0, max: 100 },
} as const;

export type Limited = keyof typeof limits;

export const maxLayers = 5;
export const maxStops = 6;
export const minStops = 2;

/** A soft, two-layer default: a tight contact shadow and a wide ambient one. */
export const defaultLayers = (): ShadowLayer[] => [
  { x: 0, y: 1, blur: 2, spread: 0, colour: "#0f172a", opacity: 12, inset: false },
  { x: 0, y: 12, blur: 32, spread: -8, colour: "#0f172a", opacity: 28, inset: false },
];

export const newLayer = (): ShadowLayer => ({
  x: 0,
  y: 4,
  blur: 12,
  spread: 0,
  colour: "#000000",
  opacity: 20,
  inset: false,
});

export const defaultGradient = (): Gradient => ({
  type: "linear",
  angle: 135,
  stops: [
    { colour: "#7c6cf0", position: 0 },
    { colour: "#22d3ee", position: 100 },
  ],
});

/** Reads a control’s value as a whole number within its limits; unreadable input becomes the minimum. */
export const clampValue = (name: Limited, value: string | number) => {
  const { min, max } = limits[name];
  const number = Math.round(Number(value));
  if (String(value).trim() === "" || !Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
};

const length = (value: number) => (value === 0 ? "0" : `${value}px`);

/** A colour at an opacity: the hex itself when opaque, otherwise `rgb(r g b / a)`. */
export const colourWithOpacity = (hex: string, opacity: number) => {
  const rgb = parseColour(hex) ?? [0, 0, 0];
  if (opacity >= 100) return hex.toLowerCase();
  const alpha = Math.round(opacity) / 100;
  return `rgb(${rgb.join(" ")} / ${alpha})`;
};

/** One `box-shadow` layer, e.g. `0 12px 32px -8px rgb(15 23 42 / 0.28)`. */
export const layerCss = (layer: ShadowLayer) =>
  [
    layer.inset ? "inset" : "",
    length(layer.x),
    length(layer.y),
    length(layer.blur),
    length(layer.spread),
    colourWithOpacity(layer.colour, layer.opacity),
  ]
    .filter(Boolean)
    .join(" ");

/** The whole `box-shadow` value, or `none` without layers. */
export const shadowCss = (layers: ShadowLayer[]) =>
  layers.length === 0 ? "none" : layers.map((layer) => layerCss(layer)).join(", ");

/** A `linear-gradient()` or `radial-gradient()`, with its stops in order of position. */
export const gradientCss = (gradient: Gradient) => {
  const stops = gradient.stops
    .map((stop, index) => ({ ...stop, index }))
    .sort((a, b) => a.position - b.position || a.index - b.index)
    .map((stop) => `${stop.colour.toLowerCase()} ${stop.position}%`)
    .join(", ");
  return gradient.type === "linear"
    ? `linear-gradient(${gradient.angle}deg, ${stops})`
    : `radial-gradient(circle, ${stops})`;
};

/** The rule to copy: `background` for the gradient and `box-shadow` for the layers. */
export const cssRule = (layers: ShadowLayer[], gradient: Gradient) =>
  [".box {", `  background: ${gradientCss(gradient)};`, `  box-shadow: ${shadowCss(layers)};`, "}"].join("\n");
