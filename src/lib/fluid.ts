/** Inputs for a fluid value, all in pixels. */
export interface FluidInput {
  minSize: number;
  maxSize: number;
  minViewport: number;
  maxViewport: number;
  /** The root font size that rem values are relative to. Defaults to 16. */
  root?: number;
}

const round = (value: number, places = 4) => Number(value.toFixed(places)).toString();

/**
 * A CSS `clamp()` that scales linearly from `minSize` at `minViewport` to `maxSize` at
 * `maxViewport`, in rem so it respects the reader's font size. Returns an error key for input
 * that can't make a valid clamp.
 */
export const fluidClamp = ({ minSize, maxSize, minViewport, maxViewport, root = 16 }: FluidInput) => {
  const values = [minSize, maxSize, minViewport, maxViewport, root];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) return { error: "positive" as const };
  if (minViewport >= maxViewport) return { error: "viewports" as const };
  const slope = (maxSize - minSize) / (maxViewport - minViewport);
  const intercept = minSize - slope * minViewport;
  const rem = (px: number) => `${round(px / root)}rem`;
  const [lower, upper] = minSize <= maxSize ? [minSize, maxSize] : [maxSize, minSize];
  const preferred = slope === 0 ? rem(minSize) : `${rem(intercept)} + ${round(slope * 100)}vw`;
  return { css: `clamp(${rem(lower)}, ${preferred}, ${rem(upper)})`, slope, intercept };
};
