/** Exact conversions between number bases, with BigInt so nothing rounds. */

const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
const prefixes: Record<string, number> = { "0x": 16, "0b": 2, "0o": 8 };

export const minBase = 2;
export const maxBase = 36;

export const isBase = (base: number) => Number.isInteger(base) && base >= minBase && base <= maxBase;

/**
 * Reads an integer written in `base`. A leading sign, `_` or space separators between digits and
 * the matching `0x`, `0b` or `0o` prefix are fine; in base 10 any of those prefixes switches base.
 * Returns undefined for anything else.
 */
export const parseInteger = (text: string, base: number): bigint | undefined => {
  if (!isBase(base)) return undefined;
  let rest = text.trim().toLowerCase();
  let negative = false;
  if (rest.startsWith("-") || rest.startsWith("+")) {
    negative = rest.startsWith("-");
    rest = rest.slice(1).trimStart();
  }
  let radix = base;
  const prefix = prefixes[rest.slice(0, 2)];
  if (prefix !== undefined && (prefix === base || base === 10)) {
    radix = prefix;
    rest = rest.slice(2);
  }
  // Separators may only sit between digits, one at a time.
  if (rest === "" || /^[_ ]|[_ ]$|[_ ]{2}/u.test(rest)) return undefined;
  let value = 0n;
  const big = BigInt(radix);
  for (const char of rest.replaceAll(/[_ ]/gu, "")) {
    const digit = digits.indexOf(char);
    if (digit === -1 || digit >= radix) return undefined;
    value = value * big + BigInt(digit);
  }
  return negative ? -value : value;
};

/** Writes `value` in `base`, lower case, with a minus sign if negative. */
export const formatInteger = (value: bigint, base: number) => value.toString(base);

/** Splits digits into groups from the right, e.g. `1111 0000`. */
export const groupDigits = (text: string, size: number, separator = " ") => {
  const sign = text.startsWith("-") ? "-" : "";
  const body = sign ? text.slice(1) : text;
  const groups: string[] = [];
  for (let end = body.length; end > 0; end -= size) groups.unshift(body.slice(Math.max(0, end - size), end));
  return sign + groups.join(separator);
};

/** The fewest bits that hold `value`: unsigned if it is positive, two’s complement if it is negative. */
export const bitsNeeded = (value: bigint) => {
  if (value >= 0n) return value.toString(2).length;
  const magnitude = -value - 1n;
  return (magnitude === 0n ? 0 : magnitude.toString(2).length) + 1;
};

export const widths = [8, 16, 32, 64] as const;
export type Width = (typeof widths)[number];

/** Whether `value` fits in `bits` as a signed (two’s complement) or unsigned integer. */
export const fits = (value: bigint, bits: number, signed: boolean) => {
  const size = 1n << BigInt(bits);
  return signed ? value >= -(size / 2n) && value < size / 2n : value >= 0n && value < size;
};

/** The narrowest standard width that holds `value`, or undefined if it needs more than 64 bits. */
export const narrowestWidth = (value: bigint, signed: boolean): Width | undefined =>
  widths.find((bits) => fits(value, bits, signed));

export interface WidthView {
  bits: Width;
  /** Whether the value fits at all: as signed or as unsigned. */
  fits: boolean;
  /** The bit pattern, as an unsigned number. */
  pattern: bigint;
  /** The pattern read as two’s complement. */
  signed: bigint;
  /** The pattern read as unsigned. */
  unsigned: bigint;
  /** The pattern in hex, zero-padded to the width. */
  hex: string;
  /** The pattern in binary, zero-padded to the width. */
  binary: string;
}

/** How `value` is stored at `bits` wide. */
export const widthView = (value: bigint, bits: Width): WidthView => {
  const pattern = BigInt.asUintN(bits, value);
  return {
    bits,
    fits: fits(value, bits, true) || fits(value, bits, false),
    pattern,
    signed: BigInt.asIntN(bits, pattern),
    unsigned: pattern,
    hex: pattern.toString(16).padStart(bits / 4, "0"),
    binary: pattern.toString(2).padStart(bits, "0"),
  };
};

/** Every standard width at once. */
export const widthViews = (value: bigint) => widths.map((bits) => widthView(value, bits));

/** Flips bit `index` (0 is the least significant) of `value` stored at `bits`, reading the result back. */
export const toggleBit = (value: bigint, index: number, bits: Width, signed: boolean) => {
  const pattern = BigInt.asUintN(bits, value) ^ (1n << BigInt(index));
  return signed ? BigInt.asIntN(bits, pattern) : pattern;
};

/** The bits of `value` stored at `bits`, most significant first. */
export const bitsOf = (value: bigint, bits: Width) => Array.from(widthView(value, bits).binary, (bit) => bit === "1");

export interface ByteOrder {
  big: string[];
  little: string[];
}

/**
 * The bytes of `value` in hex, most significant first (big-endian) and least significant first
 * (little-endian). Stored at `bits` if given, otherwise in as few bytes as a non-negative value needs.
 */
export const byteOrder = (value: bigint, bits?: Width): ByteOrder | undefined => {
  if (bits === undefined && value < 0n) return undefined;
  const pattern = bits === undefined ? value : BigInt.asUintN(bits, value);
  const hex = pattern.toString(16);
  const length = bits === undefined ? Math.ceil(hex.length / 2) : bits / 8;
  const padded = hex.padStart(length * 2, "0");
  const big = padded.match(/../gu)!;
  return { big, little: big.toReversed() };
};
