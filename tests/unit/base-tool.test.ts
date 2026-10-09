import { describe, expect, it } from "vitest";

import {
  bitsNeeded,
  bitsOf,
  byteOrder,
  fits,
  formatInteger,
  groupDigits,
  isBase,
  narrowestWidth,
  parseInteger,
  toggleBit,
  widthView,
  widthViews,
} from "../../src/lib/base-tool";

describe("parseInteger", () => {
  it("reads every base from 2 to 36", () => {
    expect(parseInteger("1010", 2)).toBe(10n);
    expect(parseInteger("777", 8)).toBe(511n);
    expect(parseInteger("255", 10)).toBe(255n);
    expect(parseInteger("fF", 16)).toBe(255n);
    expect(parseInteger("zz", 36)).toBe(1295n);
    expect(parseInteger("0", 3)).toBe(0n);
  });

  it("accepts the matching prefix, and any prefix in decimal", () => {
    expect(parseInteger("0xff", 16)).toBe(255n);
    expect(parseInteger("0B101", 2)).toBe(5n);
    expect(parseInteger("0o17", 8)).toBe(15n);
    expect(parseInteger("0x1F", 10)).toBe(31n);
    expect(parseInteger("0b11", 10)).toBe(3n);
    expect(parseInteger("0o10", 10)).toBe(8n);
    // In hex, 0b is just two digits.
    expect(parseInteger("0b1", 16)).toBe(0xb1n);
    expect(parseInteger("0x1", 8)).toBeUndefined();
  });

  it("accepts signs and separators between digits", () => {
    expect(parseInteger("-42", 10)).toBe(-42n);
    expect(parseInteger("+42", 10)).toBe(42n);
    expect(parseInteger(" - 0xff ", 16)).toBe(-255n);
    expect(parseInteger("1_000_000", 10)).toBe(1_000_000n);
    expect(parseInteger("1111 0000", 2)).toBe(240n);
    expect(parseInteger("0xdead_beef", 16)).toBe(0xdeadbeefn);
  });

  it("rejects stray separators, bad digits and empty input", () => {
    for (const text of ["", "-", "0x", "_1", "1_", "1__0", "1 _0", "0x_ff", "12a", "2", "1.5", "--1"]) {
      expect(parseInteger(text, text === "2" ? 2 : 10), text).toBeUndefined();
    }
    expect(parseInteger("1", 1)).toBeUndefined();
    expect(parseInteger("1", 37)).toBeUndefined();
  });

  it("stays exact beyond Number.MAX_SAFE_INTEGER", () => {
    expect(parseInteger("18446744073709551615", 10)).toBe(2n ** 64n - 1n);
    expect(parseInteger("123456789012345678901234567890", 10)!.toString()).toBe("123456789012345678901234567890");
  });
});

describe("formatting", () => {
  it("writes any base", () => {
    expect(formatInteger(255n, 16)).toBe("ff");
    expect(formatInteger(-5n, 2)).toBe("-101");
    expect(formatInteger(1295n, 36)).toBe("zz");
  });

  it("groups digits from the right", () => {
    expect(groupDigits("11110000", 4)).toBe("1111 0000");
    expect(groupDigits("101", 4)).toBe("101");
    expect(groupDigits("-1234567", 3, ",")).toBe("-1,234,567");
    expect(groupDigits("", 4)).toBe("");
  });

  it("checks bases", () => {
    expect(isBase(2)).toBe(true);
    expect(isBase(36)).toBe(true);
    expect(isBase(2.5)).toBe(false);
    expect(isBase(Number.NaN)).toBe(false);
  });
});

describe("widths", () => {
  it("counts bits", () => {
    expect(bitsNeeded(0n)).toBe(1);
    expect(bitsNeeded(255n)).toBe(8);
    expect(bitsNeeded(-1n)).toBe(1);
    expect(bitsNeeded(-128n)).toBe(8);
    expect(bitsNeeded(-129n)).toBe(9);
  });

  it("checks whether a value fits", () => {
    expect(fits(255n, 8, false)).toBe(true);
    expect(fits(256n, 8, false)).toBe(false);
    expect(fits(-1n, 8, false)).toBe(false);
    expect(fits(127n, 8, true)).toBe(true);
    expect(fits(128n, 8, true)).toBe(false);
    expect(fits(-128n, 8, true)).toBe(true);
    expect(fits(-129n, 8, true)).toBe(false);
  });

  it("finds the narrowest width", () => {
    expect(narrowestWidth(200n, false)).toBe(8);
    expect(narrowestWidth(200n, true)).toBe(16);
    expect(narrowestWidth(-40_000n, true)).toBe(32);
    expect(narrowestWidth(2n ** 63n, false)).toBe(64);
    expect(narrowestWidth(2n ** 64n, false)).toBeUndefined();
  });

  it("shows two’s complement at each width", () => {
    expect(widthView(-1n, 8)).toEqual({
      bits: 8,
      fits: true,
      pattern: 255n,
      signed: -1n,
      unsigned: 255n,
      hex: "ff",
      binary: "11111111",
    });
    expect(widthView(200n, 8)).toMatchObject({ fits: true, signed: -56n, unsigned: 200n });
    expect(widthView(300n, 8)).toMatchObject({ fits: false, hex: "2c" });
    expect(widthView(-129n, 8).fits).toBe(false);
    expect(widthView(5n, 16).hex).toBe("0005");
    expect(widthViews(-2n).map((view) => view.hex)).toEqual(["fe", "fffe", "fffffffe", "fffffffffffffffe"]);
  });

  it("toggles bits, reading the result as signed or unsigned", () => {
    expect(toggleBit(0n, 7, 8, false)).toBe(128n);
    expect(toggleBit(0n, 7, 8, true)).toBe(-128n);
    expect(toggleBit(-1n, 0, 8, true)).toBe(-2n);
    expect(toggleBit(1n, 63, 64, false)).toBe(2n ** 63n + 1n);
  });

  it("lists bits most significant first", () => {
    expect(bitsOf(5n, 8)).toEqual([false, false, false, false, false, true, false, true]);
    expect(bitsOf(-1n, 16).every(Boolean)).toBe(true);
  });
});

describe("byteOrder", () => {
  it("shows big- and little-endian bytes at a width", () => {
    expect(byteOrder(0x12345678n, 32)).toEqual({ big: ["12", "34", "56", "78"], little: ["78", "56", "34", "12"] });
    expect(byteOrder(-2n, 16)).toEqual({ big: ["ff", "fe"], little: ["fe", "ff"] });
  });

  it("uses as few bytes as a positive value needs without a width", () => {
    expect(byteOrder(0xabcn)).toEqual({ big: ["0a", "bc"], little: ["bc", "0a"] });
    expect(byteOrder(0n)).toEqual({ big: ["00"], little: ["00"] });
    expect(byteOrder(-1n)).toBeUndefined();
  });
});
