/**
 * A QR code encoder (ISO/IEC 18004:2015), byte mode only: text is encoded as UTF-8 and every
 * version from 1 to 40 at each error-correction level is supported. The mask is chosen by the
 * standard's penalty score, as most encoders do.
 */

export type ErrorCorrection = "L" | "M" | "Q" | "H";

export const errorCorrectionLevels = ["L", "M", "Q", "H"] as const satisfies readonly ErrorCorrection[];

/** Roughly how much of the symbol each level can lose and still be read, as a percentage. */
export const recovery: Record<ErrorCorrection, number> = { L: 7, M: 15, Q: 25, H: 30 };

/** The two format-information bits that name each level. Note the order isn't L, M, Q, H. */
const formatBits: Record<ErrorCorrection, number> = { L: 1, M: 0, Q: 3, H: 2 };

const levelIndex: Record<ErrorCorrection, number> = { L: 0, M: 1, Q: 2, H: 3 };

const MIN_VERSION = 1;
const MAX_VERSION = 40;

/** Error-correction codewords in each block, by level then version (index 0 is unused). */
const eccPerBlock = [
  [
    -1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
  ],
  [
    -1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
  [
    -1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30,
    30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30,
  ],
] as const;

/** Error-correction blocks, by level then version (index 0 is unused). */
const blockCount = [
  [
    -1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19,
    19, 20, 21, 22, 24, 25,
  ],
  [
    -1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31,
    33, 35, 37, 38, 40, 43, 45, 47, 49,
  ],
  [
    -1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43,
    45, 48, 51, 53, 56, 59, 62, 65, 68,
  ],
  [
    -1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48,
    51, 54, 57, 60, 63, 66, 70, 74, 77, 81,
  ],
] as const;

export const symbolSize = (version: number) => version * 4 + 17;

/** Where the alignment patterns' centres sit along each axis (ISO 18004 annex E). */
export const alignmentPositions = (version: number): number[] => {
  if (version === 1) return [];
  const count = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
  const positions = [6];
  for (let position = symbolSize(version) - 7; positions.length < count; position -= step) {
    positions.splice(1, 0, position);
  }
  return positions;
};

/** Modules left for data and error correction once the function patterns are drawn, remainder bits included. */
export const rawDataModules = (version: number) => {
  let modules = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const count = Math.floor(version / 7) + 2;
    modules -= (25 * count - 10) * count - 55;
    if (version >= 7) modules -= 36;
  }
  return modules;
};

const eccCodewords = (version: number, level: ErrorCorrection) => eccPerBlock[levelIndex[level]]![version]!;
const blocks = (version: number, level: ErrorCorrection) => blockCount[levelIndex[level]]![version]!;

/**
 * How a symbol's codewords split into error-correction blocks: how many blocks, the error-correction
 * codewords in each, and the data codewords in each. Short blocks come first; the rest hold one more.
 */
export const blockStructure = (version: number, level: ErrorCorrection) => {
  const count = blocks(version, level);
  const ecc = eccCodewords(version, level);
  const raw = Math.floor(rawDataModules(version) / 8);
  const shortBlocks = count - (raw % count);
  const shortData = Math.floor(raw / count) - ecc;
  return {
    ecc,
    dataLengths: Array.from({ length: count }, (_, i) => shortData + (i < shortBlocks ? 0 : 1)),
  };
};

/** Data codewords (bytes) a symbol holds, after error correction. */
export const dataCodewords = (version: number, level: ErrorCorrection) =>
  Math.floor(rawDataModules(version) / 8) - eccCodewords(version, level) * blocks(version, level);

/** Byte mode's character count indicator is 8 bits long up to version 9 and 16 bits after. */
const countBits = (version: number) => (version <= 9 ? 8 : 16);

/** The most bytes of text a version holds at a level in byte mode. */
export const byteCapacity = (version: number, level: ErrorCorrection) =>
  Math.floor((dataCodewords(version, level) * 8 - 4 - countBits(version)) / 8);

/* Reed–Solomon over GF(2^8) with the QR code polynomial x^8 + x^4 + x^3 + x^2 + 1. */

const multiply = (x: number, y: number) => {
  let product = 0;
  for (let bit = 7; bit >= 0; bit--) {
    product = (product << 1) ^ ((product >>> 7) * 0x11d);
    product ^= ((y >>> bit) & 1) * x;
  }
  return product;
};

/** The generator polynomial of `degree`, highest power first with its leading 1 dropped. */
export const reedSolomonDivisor = (degree: number) => {
  const divisor = new Array<number>(degree).fill(0);
  divisor[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      divisor[j] = multiply(divisor[j]!, root);
      if (j + 1 < degree) divisor[j] = divisor[j]! ^ divisor[j + 1]!;
    }
    root = multiply(root, 0x02);
  }
  return divisor;
};

/** The error-correction codewords for `data`: the remainder of data × x^n divided by the generator. */
export const reedSolomonRemainder = (data: readonly number[], divisor: readonly number[]) => {
  const result = new Array<number>(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift()!;
    result.push(0);
    divisor.forEach((coefficient, i) => {
      result[i] = result[i]! ^ multiply(coefficient, factor);
    });
  }
  return result;
};

/** The data bits for `bytes` in byte mode, terminated and padded to fill a version's capacity. */
export const dataCodewordsFor = (bytes: Uint8Array, version: number, level: ErrorCorrection) => {
  const bits: number[] = [];
  const append = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  append(0b0100, 4);
  append(bytes.length, countBits(version));
  for (const byte of bytes) append(byte, 8);
  const capacity = dataCodewords(version, level) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) append(pad, 8);
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    codewords.push(bits.slice(i, i + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
  }
  return codewords;
};

/**
 * Splits the data codewords into blocks, adds each block's error correction, then interleaves
 * them: the first codeword of every block, then the second, and so on, data before ECC.
 */
export const interleave = (data: readonly number[], version: number, level: ErrorCorrection) => {
  const { ecc, dataLengths } = blockStructure(version, level);
  const divisor = reedSolomonDivisor(ecc);
  let offset = 0;
  const split = dataLengths.map((length) => {
    const block = data.slice(offset, offset + length);
    offset += length;
    return { data: block, ecc: reedSolomonRemainder(block, divisor) };
  });
  const result: number[] = [];
  for (let i = 0; i < Math.max(...dataLengths); i++) {
    for (const block of split) if (i < block.data.length) result.push(block.data[i]!);
  }
  for (let i = 0; i < ecc; i++) for (const block of split) result.push(block.ecc[i]!);
  return result;
};

/** The 15 format bits: the level and mask, BCH-protected and XORed with 101010000010010. */
export const formatInformation = (level: ErrorCorrection, mask: number) => {
  const data = (formatBits[level] << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i++) remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
  return ((data << 10) | remainder) ^ 0x5412;
};

/** The 18 version bits for versions 7 and up: the version, then its 12-bit BCH code. */
export const versionInformation = (version: number) => {
  let remainder = version;
  for (let i = 0; i < 12; i++) remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1f25);
  return (version << 12) | remainder;
};

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0;

const maskRules: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/** Does mask pattern `mask` (0–7) flip the module at column `x`, row `y`? */
export const masks = (mask: number, x: number, y: number) => maskRules[mask]!(x, y);

type Grid = boolean[][];

class Builder {
  readonly version: number;
  readonly size: number;
  readonly modules: Grid;
  /** Function-pattern modules, which data and masks leave alone. */
  readonly reserved: Grid;

  constructor(version: number) {
    this.version = version;
    this.size = symbolSize(version);
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.reserved = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  set(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.reserved[y]![x] = true;
  }

  drawFunctionPatterns(level: ErrorCorrection) {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.set(6, i, i % 2 === 0);
      this.set(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);
    const positions = alignmentPositions(this.version);
    const last = positions.length - 1;
    positions.forEach((x, i) => {
      positions.forEach((y, j) => {
        // The three corners that would overlap the finder patterns are skipped.
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
        this.drawAlignment(x, y);
      });
    });
    // Reserve the format areas now; the real bits go in once the mask is known.
    this.drawFormat(level, 0);
    this.drawVersion();
  }

  /** A 7×7 finder pattern centred on (x, y), with its light separator. */
  drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const distance = Math.max(Math.abs(dx), Math.abs(dy));
        const column = x + dx;
        const row = y + dy;
        if (column >= 0 && column < this.size && row >= 0 && row < this.size) {
          this.set(column, row, distance !== 2 && distance !== 4);
        }
      }
    }
  }

  drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  drawFormat(level: ErrorCorrection, mask: number) {
    const bits = formatInformation(level, mask);
    const { size } = this;
    // The copy around the top-left finder.
    for (let i = 0; i <= 5; i++) this.set(8, i, bit(bits, i));
    this.set(8, 7, bit(bits, 6));
    this.set(8, 8, bit(bits, 7));
    this.set(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.set(14 - i, 8, bit(bits, i));
    // The copy split between the other two finders.
    for (let i = 0; i < 8; i++) this.set(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.set(8, size - 15 + i, bit(bits, i));
    // The dark module, always dark.
    this.set(8, size - 8, true);
  }

  drawVersion() {
    if (this.version < 7) return;
    const bits = versionInformation(this.version);
    for (let i = 0; i < 18; i++) {
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.set(a, b, bit(bits, i));
      this.set(b, a, bit(bits, i));
    }
  }

  /** Places the codewords in two-module columns, zigzagging up and down from the bottom right. */
  drawCodewords(codewords: readonly number[]) {
    const { size } = this;
    let index = 0;
    const total = codewords.length * 8;
    for (let right = size - 1; right >= 1; right -= 2) {
      // Column 6 is the vertical timing pattern, so the pair to its left shifts over by one.
      if (right === 6) right = 5;
      const upward = ((right + 1) & 2) === 0;
      for (let step = 0; step < size; step++) {
        const y = upward ? size - 1 - step : step;
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          if (this.reserved[y]![x] || index >= total) continue;
          this.modules[y]![x] = bit(codewords[index >>> 3]!, 7 - (index & 7));
          index++;
        }
      }
    }
  }

  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (!this.reserved[y]![x] && masks(mask, x, y)) this.modules[y]![x] = !this.modules[y]![x];
      }
    }
  }
}

/**
 * The penalty score ISO 18004 uses to pick a mask: long runs (N1), 2×2 blocks (N2), patterns that
 * look like finders (N3) and an unbalanced ratio of dark to light (N4). Lower is better.
 */
export const penalty = (modules: readonly (readonly boolean[])[]) => {
  const size = modules.length;
  const columns = Array.from({ length: size }, (_, x) => modules.map((row) => row[x]!));
  let score = 0;
  for (const line of [...modules, ...columns]) {
    // Rule 1: five or more of the same colour in a row (or column) cost 3, plus 1 for each extra.
    let run = 1;
    for (let x = 1; x <= size; x++) {
      if (x < size && line[x] === line[x - 1]) run++;
      else {
        if (run >= 5) score += run - 2;
        run = 1;
      }
    }
    // Rule 3: 1:1:3:1:1 dark:light:dark:light:dark with four light modules on one side costs 40.
    for (let x = 0; x + 10 < size; x++) {
      const finder = (at: number) =>
        line[at]! && !line[at + 1] && line[at + 2]! && line[at + 3]! && line[at + 4]! && !line[at + 5] && line[at + 6]!;
      const light = (at: number) => !line[at] && !line[at + 1] && !line[at + 2] && !line[at + 3];
      if (finder(x) && light(x + 7)) score += 40;
      if (light(x) && finder(x + 4)) score += 40;
    }
  }
  // Rule 2: each 2×2 block of one colour costs 3.
  for (let y = 0; y + 1 < size; y++) {
    const row = modules[y]!;
    const next = modules[y + 1]!;
    for (let x = 0; x + 1 < size; x++) {
      const colour = row[x];
      if (row[x + 1] === colour && next[x] === colour && next[x + 1] === colour) score += 3;
    }
  }
  // Rule 4: 10 for every whole 5% the share of dark modules strays from 50%.
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
};

export interface QrCode {
  version: number;
  level: ErrorCorrection;
  mask: number;
  /** Modules per side, without the quiet zone. */
  size: number;
  /** Rows of modules, top to bottom; `true` is dark. */
  modules: boolean[][];
  /** Bytes of data encoded. */
  bytes: number;
}

export type QrResult = { ok: true; code: QrCode } | { ok: false; bytes: number; capacity: number };

export interface QrOptions {
  /** Force a mask from 0 to 7 rather than picking the one with the lowest penalty. */
  mask?: number;
  /** The smallest version to use, if a bigger symbol is wanted. */
  minVersion?: number;
}

/** Encodes `text` as UTF-8 in byte mode in the smallest version that holds it at `level`. */
export const encodeQr = (text: string, level: ErrorCorrection = "M", options: QrOptions = {}): QrResult => {
  const bytes = new TextEncoder().encode(text);
  let version = Math.max(MIN_VERSION, options.minVersion ?? MIN_VERSION);
  while (version <= MAX_VERSION && byteCapacity(version, level) < bytes.length) version++;
  if (version > MAX_VERSION) return { ok: false, bytes: bytes.length, capacity: byteCapacity(MAX_VERSION, level) };

  const builder = new Builder(version);
  builder.drawFunctionPatterns(level);
  builder.drawCodewords(interleave(dataCodewordsFor(bytes, version, level), version, level));

  let mask = options.mask ?? -1;
  if (mask < 0) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      builder.applyMask(candidate);
      builder.drawFormat(level, candidate);
      const score = penalty(builder.modules);
      if (score < best) {
        best = score;
        mask = candidate;
      }
      builder.applyMask(candidate);
    }
  }
  builder.applyMask(mask);
  builder.drawFormat(level, mask);
  return {
    ok: true,
    code: { version, level, mask, size: builder.size, modules: builder.modules, bytes: bytes.length },
  };
};

/** The modules quiet zone the standard asks for on every side. */
export const QUIET_ZONE = 4;

/**
 * An SVG path that draws every dark module, one subpath per horizontal run, offset by the quiet
 * zone so the path sits inside a `viewBox` of `0 0 size+2q size+2q`.
 */
export const modulePath = (modules: readonly (readonly boolean[])[], margin = QUIET_ZONE) => {
  const parts: string[] = [];
  modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let end = x;
      while (end + 1 < row.length && row[end + 1]) end++;
      const width = end - x + 1;
      parts.push(`M${x + margin} ${y + margin}h${width}v1h-${width}z`);
      x = end;
    }
  });
  return parts.join("");
};

const escapeXml = (text: string) =>
  text.replace(
    /[&<>"']/gu,
    (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!,
  );

export interface SvgOptions {
  foreground: string;
  background: string;
  /** A title for the file, e.g. what the code encodes. */
  title?: string;
  /** Pixels per module for the width and height attributes. */
  scale?: number;
}

/** A standalone SVG file for `code`, with its quiet zone and the colours given. */
export const qrSvg = (code: QrCode, { foreground, background, title, scale = 8 }: SvgOptions) => {
  const extent = code.size + QUIET_ZONE * 2;
  const pixels = extent * scale;
  const label = title ? `<title>${escapeXml(title)}</title>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}" width="${pixels}" height="${pixels}" shape-rendering="crispEdges">`,
    label,
    `<rect width="${extent}" height="${extent}" fill="${escapeXml(background)}"/>`,
    `<path fill="${escapeXml(foreground)}" d="${modulePath(code.modules)}"/>`,
    "</svg>",
  ].join("");
};

/** Below this contrast ratio between the colours, many scanners struggle to read a code. */
export const MIN_SCAN_CONTRAST = 4;
