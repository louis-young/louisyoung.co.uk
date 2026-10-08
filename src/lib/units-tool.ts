/** The CSS length units the converter knows, in the order it lists them. */
export const units = ["px", "rem", "em", "pt", "vw", "vh", "%"] as const;

export type Unit = (typeof units)[number];

/** What relative units are relative to, all in pixels. */
export interface UnitContext {
  /** The root (html) font size, for rem. */
  root: number;
  /** The parent element’s font size, for em and % (as in font-size). */
  parent: number;
  viewportWidth: number;
  viewportHeight: number;
}

export const defaultContext: UnitContext = { root: 16, parent: 16, viewportWidth: 1440, viewportHeight: 900 };

/** How many pixels one of each unit is. A point is 1/72 inch and CSS has 96 pixels to the inch. */
const pixelsPer = (unit: Unit, context: UnitContext) =>
  ({
    px: 1,
    rem: context.root,
    em: context.parent,
    pt: 96 / 72,
    vw: context.viewportWidth / 100,
    vh: context.viewportHeight / 100,
    "%": context.parent / 100,
  })[unit];

export const isUnit = (value: string): value is Unit => (units as readonly string[]).includes(value);

const format = (value: number) => {
  const rounded = Number(value.toFixed(4));
  return Object.is(rounded, -0) ? "0" : rounded.toString();
};

/**
 * `value` in `from` written in every unit. Returns an error key when the value is not a number or
 * the context has a non-positive size.
 */
export const convertAll = (value: number, from: Unit, context: UnitContext) => {
  if (!Number.isFinite(value)) return { error: "value" as const };
  const sizes = [context.root, context.parent, context.viewportWidth, context.viewportHeight];
  if (sizes.some((size) => !Number.isFinite(size) || size <= 0)) return { error: "context" as const };
  const px = value * pixelsPer(from, context);
  return {
    rows: units.map((unit) => {
      const amount = format(px / pixelsPer(unit, context));
      return { unit, value: amount, css: `${amount}${unit}` };
    }),
  };
};
