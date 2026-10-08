import { describe, expect, it } from "vitest";

import { minutesLeft, readProgress } from "../../src/lib/reading-progress";

describe("readProgress", () => {
  it("counts how much of the block has scrolled above the bottom of the viewport", () => {
    expect(readProgress(900, 2000, 900)).toBe(0);
    expect(readProgress(400, 2000, 900)).toBe(0.25);
    expect(readProgress(-1100, 2000, 900)).toBe(1);
  });

  it("clamps before the start and after the end", () => {
    expect(readProgress(1500, 2000, 900)).toBe(0);
    expect(readProgress(-5000, 2000, 900)).toBe(1);
  });

  it("treats an empty block as read and ignores nonsense", () => {
    expect(readProgress(0, 0, 900)).toBe(1);
    expect(readProgress(Number.NaN, 100, 900)).toBe(0);
  });
});

describe("minutesLeft", () => {
  it.each([
    [10, 0, 10],
    [10, 0.25, 8],
    [10, 0.5, 5],
    [10, 0.95, 1],
    [10, 1, 0],
    [3, 2, 0],
    [3, -1, 3],
  ])("%d minutes at %d read leaves %d", (total, progress, expected) => {
    expect(minutesLeft(total, progress)).toBe(expected);
  });
});
