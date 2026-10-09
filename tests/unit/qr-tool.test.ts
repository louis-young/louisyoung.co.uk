import { describe, expect, it } from "vitest";

import {
  alignmentPositions,
  blockStructure,
  byteCapacity,
  dataCodewords,
  dataCodewordsFor,
  encodeQr,
  type ErrorCorrection,
  errorCorrectionLevels,
  formatInformation,
  interleave,
  masks,
  modulePath,
  penalty,
  type QrCode,
  qrSvg,
  rawDataModules,
  reedSolomonDivisor,
  reedSolomonRemainder,
  symbolSize,
  versionInformation,
} from "../../src/lib/qr-tool";

const encode = (text: string, level: ErrorCorrection, mask?: number) => {
  const result = encodeQr(text, level, mask === undefined ? {} : { mask });
  if (!result.ok) throw new Error("too long");
  return result.code;
};

const rows = (code: QrCode) => code.modules.map((row) => row.map((dark) => (dark ? "1" : "0")).join(""));

/*
 * Reference symbols, byte mode, produced by the python-qrcode library (an independent encoder)
 * with the same mask forced. Each row is top to bottom; 1 is a dark module.
 */
const helloWorldM = [
  "111111101100101111111",
  "100000100001001000001",
  "101110100101001011101",
  "101110101001001011101",
  "101110101110101011101",
  "100000101001001000001",
  "111111101010101111111",
  "000000001001100000000",
  "100010111111011111001",
  "000100001011100001111",
  "001111110011011010010",
  "111110001100010000000",
  "111110101010101100110",
  "000000001010111101011",
  "111111101110101011010",
  "100000100101110110011",
  "101110101101011000110",
  "101110100100100011011",
  "101110100111000111000",
  "100000100001010000000",
  "111111101111111110101",
];

const urlL = [
  "1111111010011110001111111",
  "1000001011101110001000001",
  "1011101000111100001011101",
  "1011101000100101001011101",
  "1011101011110010001011101",
  "1000001010010110101000001",
  "1111111010101010101111111",
  "0000000010111000100000000",
  "1110011011100001011110011",
  "0101110111100001101101011",
  "1101101110010011000111101",
  "0100010011000011111111000",
  "0001011011011000101100001",
  "0100100101001101111100011",
  "1100101101101001001001101",
  "0001010111011010010111000",
  "1110101000001010111110010",
  "0000000011000101100010001",
  "1111111001010000101010001",
  "1000001010111001100010010",
  "1011101000001001111110010",
  "1011101001110011110010110",
  "1011101011010101110111011",
  "1000001011010011101110000",
  "1111111010001000101001001",
];

/** Reads the first copy of the format bits, around the top-left finder, most significant first. */
const formatCopyOne = (m: boolean[][]) => {
  const cells: [number, number][] = [
    [0, 8],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [8, 0],
  ];
  return cells.map(([x, y]) => (m[y]![x] ? "1" : "0")).join("");
};

/** Reads the second copy: down the bottom of column 8, then along row 8 on the right. */
const formatCopyTwo = (m: boolean[][]) => {
  const size = m.length;
  const bits: string[] = [];
  for (let y = size - 1; y >= size - 7; y--) bits.push(m[y]![8] ? "1" : "0");
  for (let x = size - 8; x < size; x++) bits.push(m[8]![x] ? "1" : "0");
  return bits.join("");
};

const finderAt = (m: boolean[][], left: number, top: number) =>
  Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 7 }, (_, x) => (m[top + y]![left + x] ? "1" : "0")).join(""),
  );

const finder = ["1111111", "1000001", "1011101", "1011101", "1011101", "1000001", "1111111"];

/**
 * A minimal decoder, written independently of the encoder's placement code: it reads the format
 * bits, walks the codeword zigzag, unmasks, de-interleaves, checks every block's Reed–Solomon
 * remainder and parses the byte-mode segment back to text.
 */
const decode = (m: boolean[][]) => {
  const size = m.length;
  const version = (size - 17) / 4;
  const format = Number.parseInt(formatCopyOne(m), 2);
  let level: ErrorCorrection | undefined;
  let mask = -1;
  for (const candidate of errorCorrectionLevels) {
    for (let k = 0; k < 8; k++) {
      if (formatInformation(candidate, k) === format) {
        level = candidate;
        mask = k;
      }
    }
  }
  if (!level) throw new Error("unreadable format");

  const isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const fill = (x0: number, y0: number, w: number, h: number) => {
    for (let y = Math.max(0, y0); y < Math.min(size, y0 + h); y++) {
      for (let x = Math.max(0, x0); x < Math.min(size, x0 + w); x++) isFunction[y]![x] = true;
    }
  };
  fill(0, 0, 9, 9);
  fill(size - 8, 0, 8, 9);
  fill(0, size - 8, 9, 8);
  fill(6, 0, 1, size);
  fill(0, 6, size, 1);
  const centres = alignmentPositions(version);
  for (const cx of centres) {
    for (const cy of centres) {
      const overlapsFinder = (cx < 9 && cy < 9) || (cx > size - 9 && cy < 9) || (cx < 9 && cy > size - 9);
      if (!overlapsFinder) fill(cx - 2, cy - 2, 5, 5);
    }
  }
  if (version >= 7) {
    fill(size - 11, 0, 3, 6);
    fill(0, size - 11, 6, 3);
  }

  const bits: number[] = [];
  let upward = true;
  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--;
    for (let i = 0; i < size; i++) {
      const y = upward ? size - 1 - i : i;
      for (const x of [right, right - 1]) {
        if (isFunction[y]![x]) continue;
        bits.push(Number(m[y]![x]! !== masks(mask, x, y)));
      }
    }
    upward = !upward;
  }
  const codewords: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) codewords.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));

  const { ecc, dataLengths } = blockStructure(version, level);
  const blocks = dataLengths.map(() => [] as number[]);
  let index = 0;
  for (let i = 0; i < Math.max(...dataLengths); i++) {
    dataLengths.forEach((length, b) => {
      if (i < length) blocks[b]!.push(codewords[index++]!);
    });
  }
  const divisor = reedSolomonDivisor(ecc);
  const data: number[] = [];
  blocks.forEach((block, b) => {
    const parity = Array.from({ length: ecc }, (_, i) => codewords[index + i * dataLengths.length + b]);
    expect(reedSolomonRemainder(block, divisor)).toEqual(parity);
    data.push(...block);
  });

  const stream = data.flatMap((byte) => Array.from({ length: 8 }, (_, i) => (byte >> (7 - i)) & 1));
  let at = 0;
  const read = (length: number) => {
    let value = 0;
    for (let i = 0; i < length; i++) value = (value << 1) | stream[at++]!;
    return value;
  };
  expect(read(4)).toBe(0b0100);
  const count = read(version <= 9 ? 8 : 16);
  const bytes = Uint8Array.from({ length: count }, () => read(8));
  return { version, level, mask, text: new TextDecoder().decode(bytes) };
};

describe("QR code tables", () => {
  it("sizes symbols and places alignment patterns as annex E lists them", () => {
    expect(symbolSize(1)).toBe(21);
    expect(symbolSize(40)).toBe(177);
    expect(alignmentPositions(1)).toEqual([]);
    expect(alignmentPositions(2)).toEqual([6, 18]);
    expect(alignmentPositions(7)).toEqual([6, 22, 38]);
    expect(alignmentPositions(14)).toEqual([6, 26, 46, 66]);
    expect(alignmentPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
    expect(alignmentPositions(36)).toEqual([6, 24, 50, 76, 102, 128, 154]);
    expect(alignmentPositions(40)).toEqual([6, 30, 58, 86, 114, 142, 170]);
  });

  it("counts raw modules and data codewords", () => {
    expect(rawDataModules(1)).toBe(208);
    expect(rawDataModules(7)).toBe(1568);
    expect(rawDataModules(40)).toBe(29_648);
    expect(errorCorrectionLevels.map((level) => dataCodewords(1, level))).toEqual([19, 16, 13, 9]);
    expect(errorCorrectionLevels.map((level) => dataCodewords(40, level))).toEqual([2956, 2334, 1666, 1276]);
  });

  it("matches the standard's byte-mode capacities", () => {
    const table: Record<number, number[]> = {
      1: [17, 14, 11, 7],
      2: [32, 26, 20, 14],
      5: [106, 84, 60, 44],
      9: [230, 180, 130, 98],
      10: [271, 213, 151, 119],
      20: [858, 666, 482, 382],
      27: [1465, 1125, 805, 625],
      40: [2953, 2331, 1663, 1273],
    };
    for (const [version, capacities] of Object.entries(table)) {
      expect(
        errorCorrectionLevels.map((level) => byteCapacity(Number(version), level)),
        version,
      ).toEqual(capacities);
    }
  });

  it("splits codewords into short blocks then long ones", () => {
    expect(blockStructure(1, "M")).toEqual({ ecc: 10, dataLengths: [16] });
    expect(blockStructure(5, "Q")).toEqual({ ecc: 18, dataLengths: [15, 15, 16, 16] });
    for (let version = 1; version <= 40; version++) {
      for (const level of errorCorrectionLevels) {
        const { ecc, dataLengths } = blockStructure(version, level);
        const data = dataLengths.reduce((sum, length) => sum + length, 0);
        expect(data).toBe(dataCodewords(version, level));
        expect(data + ecc * dataLengths.length).toBe(Math.floor(rawDataModules(version) / 8));
      }
    }
  });
});

describe("Reed–Solomon", () => {
  it("builds the generator polynomials", () => {
    // g(x) = (x - 1)(x - α) = x² + 3x + 2, and the degree-7 generator from annex A.
    expect(reedSolomonDivisor(2)).toEqual([3, 2]);
    expect(reedSolomonDivisor(7)).toEqual([127, 122, 154, 164, 11, 68, 117]);
  });

  it("computes the error correction for the standard's worked example", () => {
    // ISO 18004 annex I: "01234567" at 1-M.
    const data = [16, 32, 12, 86, 97, 128, 236, 17, 236, 17, 236, 17, 236, 17, 236, 17];
    expect(reedSolomonRemainder(data, reedSolomonDivisor(10))).toEqual([165, 36, 212, 193, 237, 54, 199, 135, 44, 85]);
  });
});

describe("data encoding", () => {
  it("writes the mode, count, bytes, terminator and alternating pad bytes", () => {
    const codewords = dataCodewordsFor(new TextEncoder().encode("A"), 1, "H");
    // 0100 00000001 01000001 0000, then 0xEC 0x11 … to nine codewords.
    expect(codewords).toEqual([0x40, 0x14, 0x10, 0xec, 0x11, 0xec, 0x11, 0xec, 0x11]);
  });

  it("uses a 16-bit count from version 10 and truncates the terminator when there's no room", () => {
    const bytes = new Uint8Array(byteCapacity(10, "L")).fill(0x61);
    const codewords = dataCodewordsFor(bytes, 10, "L");
    expect(codewords).toHaveLength(dataCodewords(10, "L"));
    expect(codewords.slice(0, 3)).toEqual([0x40, 0x10, 0xf6]);
  });

  it("interleaves data then error correction across blocks", () => {
    const data = Array.from({ length: dataCodewords(5, "Q") }, (_, i) => i);
    const result = interleave(data, 5, "Q");
    expect(result).toHaveLength(Math.floor(rawDataModules(5) / 8));
    // Blocks of 15, 15, 16 and 16: the first column takes the first codeword of each.
    expect(result.slice(0, 4)).toEqual([0, 15, 30, 46]);
    // The long blocks' last codewords come after the short blocks run out.
    expect(result.slice(60, 62)).toEqual([45, 61]);
  });
});

describe("format and version information", () => {
  it("matches the standard's format bit table", () => {
    expect(formatInformation("M", 0).toString(2).padStart(15, "0")).toBe("101010000010010");
    expect(formatInformation("L", 0).toString(2).padStart(15, "0")).toBe("111011111000100");
    expect(formatInformation("L", 4).toString(2).padStart(15, "0")).toBe("110011000101111");
    expect(formatInformation("Q", 0).toString(2).padStart(15, "0")).toBe("011010101011111");
    expect(formatInformation("H", 0).toString(2).padStart(15, "0")).toBe("001011010001001");
    expect(formatInformation("M", 4).toString(2).padStart(15, "0")).toBe("100010111111001");
    expect(formatInformation("H", 7).toString(2).padStart(15, "0")).toBe("000100000111011");
  });

  it("matches the standard's version bit table", () => {
    expect(versionInformation(7)).toBe(0x07c94);
    expect(versionInformation(8)).toBe(0x085bc);
    expect(versionInformation(21)).toBe(0x15683);
    expect(versionInformation(40)).toBe(0x28c69);
  });
});

describe("encodeQr", () => {
  it("encodes HELLO WORLD at M as a known-good version 1 symbol", () => {
    const code = encode("HELLO WORLD", "M");
    expect(code).toMatchObject({ version: 1, level: "M", size: 21, bytes: 11, mask: 4 });
    expect(rows(code)).toEqual(helloWorldM);
  });

  it("encodes a URL at L as a known-good version 2 symbol", () => {
    const code = encode("https://louisyoung.co.uk/", "L", 1);
    expect(code).toMatchObject({ version: 2, size: 25, mask: 1 });
    expect(rows(code)).toEqual(urlL);
  });

  it("draws finder, separator, timing and alignment patterns and the dark module", () => {
    const code = encode("https://louisyoung.co.uk/", "L");
    const m = code.modules;
    const last = code.size - 7;
    expect(finderAt(m, 0, 0)).toEqual(finder);
    expect(finderAt(m, last, 0)).toEqual(finder);
    expect(finderAt(m, 0, last)).toEqual(finder);
    for (let i = 0; i < 8; i++) {
      expect(m[7]![i], "separator").toBe(false);
      expect(m[i]![7], "separator").toBe(false);
      expect(m[7]![code.size - 1 - i], "separator").toBe(false);
      expect(m[code.size - 8]![i], "separator").toBe(false);
    }
    for (let i = 8; i < code.size - 8; i++) {
      expect(m[6]![i], `timing row ${i}`).toBe(i % 2 === 0);
      expect(m[i]![6], `timing column ${i}`).toBe(i % 2 === 0);
    }
    // The single alignment pattern of version 2 is centred on (18, 18).
    expect(
      finderAt(m, 16, 16)
        .slice(0, 5)
        .map((row) => row.slice(0, 5)),
    ).toEqual(["11111", "10001", "10101", "10001", "11111"]);
    expect(m[code.size - 8]![8]).toBe(true);
  });

  it("writes both copies of the format bits for the level and mask", () => {
    for (const level of errorCorrectionLevels) {
      for (let mask = 0; mask < 8; mask++) {
        const code = encode("format", level, mask);
        const expected = formatInformation(level, mask).toString(2).padStart(15, "0");
        expect(formatCopyOne(code.modules)).toBe(expected);
        expect(formatCopyTwo(code.modules)).toBe(expected);
      }
    }
    expect(formatCopyOne(encode("HELLO WORLD", "M").modules)).toBe("100010111111001");
  });

  it("writes both copies of the version bits from version 7", () => {
    const code = encode("v".repeat(150), "L");
    expect(code.version).toBe(7);
    const bits = versionInformation(7);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >> i) & 1) === 1;
      expect(code.modules[Math.floor(i / 3)]![code.size - 11 + (i % 3)]).toBe(dark);
      expect(code.modules[code.size - 11 + (i % 3)]![Math.floor(i / 3)]).toBe(dark);
    }
  });

  it("picks the mask with the lowest penalty, the first on a tie", () => {
    for (const [text, level] of [
      ["HELLO WORLD", "M"],
      ["https://louisyoung.co.uk/", "L"],
      ["Café ✓ 😀", "H"],
    ] as const) {
      const chosen = encode(text, level);
      const scores = Array.from({ length: 8 }, (_, mask) => penalty(encode(text, level, mask).modules));
      expect(chosen.mask).toBe(scores.indexOf(Math.min(...scores)));
    }
  });

  it("uses the smallest version that fits, or a bigger one on request", () => {
    expect(encode("x".repeat(17), "L").version).toBe(1);
    expect(encode("x".repeat(18), "L").version).toBe(2);
    expect(encode("é".repeat(9), "L").version).toBe(2);
    const result = encodeQr("x", "L", { minVersion: 5 });
    expect(result.ok && result.code.version).toBe(5);
  });

  it("reports text too long for version 40", () => {
    expect(encodeQr("x".repeat(1274), "H")).toEqual({ ok: false, bytes: 1274, capacity: 1273 });
    expect(encodeQr("x".repeat(2953), "L").ok).toBe(true);
  });

  // Every version once, cycling through the levels, plus every level at the version boundaries.
  const roundTrips: [number, ErrorCorrection][] = Array.from({ length: 40 }, (_, i) => [
    i + 1,
    errorCorrectionLevels[i % 4]!,
  ]);
  for (const version of [1, 7, 10, 40]) for (const level of errorCorrectionLevels) roundTrips.push([version, level]);

  it.each(roundTrips)("round-trips version %i-%s, filled to capacity, through a decoder", (version, level) => {
    const length = byteCapacity(version, level) - (version % 3);
    const text = Array.from({ length }, (_, i) => String.fromCharCode(33 + ((i * 7 + version) % 94))).join("");
    const code = encode(text, level);
    expect(code.version).toBe(version);
    expect(decode(code.modules)).toEqual({ version, level, mask: code.mask, text });
  });

  it("decodes UTF-8 text and both reference symbols", () => {
    expect(decode(encode("Café ✓ 😀", "Q").modules).text).toBe("Café ✓ 😀");
    const parse = (lines: string[]) => lines.map((line) => Array.from(line, (cell) => cell === "1"));
    expect(decode(parse(helloWorldM)).text).toBe("HELLO WORLD");
    expect(decode(parse(urlL)).text).toBe("https://louisyoung.co.uk/");
  });
});

describe("penalty", () => {
  it("scores runs, blocks, finder-like patterns and balance", () => {
    const light = Array.from({ length: 11 }, () => new Array<boolean>(11).fill(false));
    // All light: 11 rows and 11 columns of run 11 (3 + 6 each), 100 blocks, 50% off balance.
    expect(penalty(light)).toBe(22 * 9 + 100 * 3 + 100);
    const pattern = [true, false, true, true, true, false, true, false, false, false, false];
    const grid = Array.from({ length: 11 }, (_, y) => (y === 0 ? [...pattern] : new Array<boolean>(11).fill(false)));
    const withPattern = penalty(grid);
    const reversed = Array.from({ length: 11 }, (_, y) =>
      y === 0 ? [...pattern].reverse() : new Array<boolean>(11).fill(false),
    );
    expect(penalty(reversed)).toBe(withPattern);
    expect(withPattern).toBeGreaterThanOrEqual(40);
  });
});

describe("rendering", () => {
  it("draws each horizontal run of dark modules as one subpath inside the quiet zone", () => {
    expect(
      modulePath([
        [true, true, false],
        [false, true, true],
      ]),
    ).toBe("M4 4h2v1h-2zM5 5h2v1h-2z");
    expect(modulePath([[true]], 0)).toBe("M0 0h1v1h-1z");
  });

  it("writes a standalone SVG with the colours, a title and a quiet zone", () => {
    const code = encode("HELLO WORLD", "M");
    const svg = qrSvg(code, { foreground: "#112233", background: "#ffffff", title: 'A & "B" <c>' });
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 29 29" width="232" height="232"/u);
    expect(svg).toContain("<title>A &amp; &quot;B&quot; &lt;c&gt;</title>");
    expect(svg).toContain('<rect width="29" height="29" fill="#ffffff"/>');
    expect(svg).toContain('<path fill="#112233" d="M4 4h7v1h-7z');
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(qrSvg(code, { foreground: "#000", background: "#fff", scale: 1 })).not.toContain("<title>");
  });
});
