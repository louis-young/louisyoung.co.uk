/** Keeps a number between 0 and 1. */
const unit = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * How much of a block of text has been read, from 0 to 1: the share of it that has
 * scrolled above the bottom of the viewport. `top` is the block's top relative to the viewport.
 */
export const readProgress = (top: number, height: number, viewportHeight: number) =>
  height <= 0 ? 1 : unit((viewportHeight - top) / height);

/** Whole minutes still to read, rounded up so the last few lines never claim "0 min left". */
export const minutesLeft = (totalMinutes: number, progress: number) =>
  Math.max(0, Math.ceil(totalMinutes * (1 - unit(progress)) - 1e-9));
