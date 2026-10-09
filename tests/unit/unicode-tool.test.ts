import { describe, expect, it } from "vitest";

import {
  codePointsOf,
  counts,
  describeCodePoint,
  flagsFor,
  flagSummary,
  formatCodePoint,
  generalCategories,
  generalCategory,
  graphemes,
  mixedScriptWords,
  normalise,
  placeholderFor,
  utf16Units,
  utf8Bytes,
} from "../../src/lib/unicode-tool";

describe("code points", () => {
  it("formats code points as U+ and at least four hex digits", () => {
    expect(formatCodePoint(0x41)).toBe("U+0041");
    expect(formatCodePoint(0x1f600)).toBe("U+1F600");
    expect(formatCodePoint(0x10ffff)).toBe("U+10FFFF");
  });

  it("encodes UTF-8 bytes and UTF-16 units", () => {
    expect(utf8Bytes(0x41)).toEqual(["41"]);
    expect(utf8Bytes(0xe9)).toEqual(["C3", "A9"]);
    expect(utf8Bytes(0x20ac)).toEqual(["E2", "82", "AC"]);
    expect(utf8Bytes(0x1f600)).toEqual(["F0", "9F", "98", "80"]);
    expect(utf8Bytes(0xd800)).toEqual(["EF", "BF", "BD"]);
    expect(utf16Units(0x41)).toEqual(["0041"]);
    expect(utf16Units(0x1f600)).toEqual(["D83D", "DE00"]);
  });

  it("finds the General Category from the engine's tables", () => {
    expect(generalCategories).toHaveLength(30);
    expect(generalCategory(0x41)).toBe("Lu");
    expect(generalCategory(0x61)).toBe("Ll");
    expect(generalCategory(0x01c5)).toBe("Lt");
    expect(generalCategory(0x02b0)).toBe("Lm");
    expect(generalCategory(0x05d0)).toBe("Lo");
    expect(generalCategory(0x0301)).toBe("Mn");
    expect(generalCategory(0x0903)).toBe("Mc");
    expect(generalCategory(0x20dd)).toBe("Me");
    expect(generalCategory(0x35)).toBe("Nd");
    expect(generalCategory(0x2160)).toBe("Nl");
    expect(generalCategory(0xbd)).toBe("No");
    expect(generalCategory(0x5f)).toBe("Pc");
    expect(generalCategory(0x2d)).toBe("Pd");
    expect(generalCategory(0x28)).toBe("Ps");
    expect(generalCategory(0x29)).toBe("Pe");
    expect(generalCategory(0x201c)).toBe("Pi");
    expect(generalCategory(0x201d)).toBe("Pf");
    expect(generalCategory(0x21)).toBe("Po");
    expect(generalCategory(0x2b)).toBe("Sm");
    expect(generalCategory(0xa3)).toBe("Sc");
    expect(generalCategory(0x5e)).toBe("Sk");
    expect(generalCategory(0x1f600)).toBe("So");
    expect(generalCategory(0x20)).toBe("Zs");
    expect(generalCategory(0x2028)).toBe("Zl");
    expect(generalCategory(0x2029)).toBe("Zp");
    expect(generalCategory(0x07)).toBe("Cc");
    expect(generalCategory(0x200d)).toBe("Cf");
    expect(generalCategory(0xd800)).toBe("Cs");
    expect(generalCategory(0xe000)).toBe("Co");
    expect(generalCategory(0x0378)).toBe("Cn");
  });

  it("describes a code point in one go", () => {
    expect(describeCodePoint(0x0430)).toEqual({
      codePoint: 0x0430,
      label: "U+0430",
      category: "Ll",
      utf8: ["D0", "B0"],
      utf16: ["0430"],
      flags: [{ kind: "confusable", label: "a" }],
      placeholder: undefined,
    });
  });

  it("keeps lone surrogates as code points", () => {
    expect(codePointsOf("a\ud800b")).toEqual([0x61, 0xd800, 0x62]);
  });
});

describe("flags", () => {
  it("flags zero-width, bidi, space, look-alike and control characters", () => {
    expect(flagsFor(0x200b)).toEqual([{ kind: "invisible", label: "ZWSP" }]);
    expect(flagsFor(0x200d)).toEqual([{ kind: "invisible", label: "ZWJ" }]);
    expect(flagsFor(0xfeff)).toEqual([{ kind: "invisible", label: "BOM" }]);
    expect(flagsFor(0xe0041)).toEqual([{ kind: "invisible", label: "TAG" }]);
    expect(flagsFor(0x202e)).toEqual([{ kind: "bidi", label: "RLO" }]);
    expect(flagsFor(0x061c)).toEqual([{ kind: "bidi", label: "ALM" }]);
    expect(flagsFor(0x2066)).toEqual([{ kind: "bidi", label: "LRI" }]);
    expect(flagsFor(0xa0)).toEqual([{ kind: "space", label: "NBSP" }]);
    expect(flagsFor(0x202f)).toEqual([{ kind: "space", label: "NNBSP" }]);
    expect(flagsFor(0x0441)).toEqual([{ kind: "confusable", label: "c" }]);
    expect(flagsFor(0x0410)).toEqual([{ kind: "confusable", label: "A" }]);
    expect(flagsFor(0x03bf)).toEqual([{ kind: "confusable", label: "o" }]);
    expect(flagsFor(0x07)).toEqual([{ kind: "control", label: "^G" }]);
    expect(flagsFor(0x7f)).toEqual([{ kind: "control", label: "^?" }]);
  });

  it("leaves ordinary characters, tabs and newlines alone", () => {
    for (const codePoint of [0x41, 0x20, 0x09, 0x0a, 0x0d, 0xe9, 0x1f600, 0x0436])
      expect(flagsFor(codePoint)).toEqual([]);
  });

  it("gives invisible characters a visible stand-in", () => {
    expect(placeholderFor(0x20)).toBe("SP");
    expect(placeholderFor(0x09)).toBe("TAB");
    expect(placeholderFor(0x0a)).toBe("LF");
    expect(placeholderFor(0x0d)).toBe("CR");
    expect(placeholderFor(0x200d)).toBe("ZWJ");
    expect(placeholderFor(0xa0)).toBe("NBSP");
    expect(placeholderFor(0x01)).toBe("^A");
    expect(placeholderFor(0x2062)).toBe("IT");
    expect(placeholderFor(0x0600)).toBe("U+0600");
    expect(placeholderFor(0x85)).toBe("U+0085");
    expect(placeholderFor(0xfe0f)).toBe("VS16");
    expect(placeholderFor(0xe0100)).toBe("VS17");
    expect(placeholderFor(0x0430)).toBeUndefined();
    expect(placeholderFor(0x41)).toBeUndefined();
  });

  it("counts flags across the text", () => {
    expect(flagSummary(graphemes("p\u0430ypal\u200b \u202eabc\u00a0\u0007"))).toEqual({
      invisible: 1,
      bidi: 1,
      space: 1,
      confusable: 1,
      control: 1,
    });
  });

  it("finds words that mix Latin with Cyrillic or Greek", () => {
    expect(mixedScriptWords("p\u0430ypal and Мо\u0441кв\u0430 and cafe\u0301 and \u0391thens")).toEqual([
      "p\u0430ypal",
      "\u0391thens",
    ]);
    expect(mixedScriptWords("")).toEqual([]);
  });
});

describe("graphemes", () => {
  it("keeps emoji sequences, flags and combining marks together", () => {
    const clusters = graphemes("e\u0301👩🏽\u200d💻🇬🇧!");
    expect(clusters.map((cluster) => cluster.text)).toEqual(["e\u0301", "👩🏽\u200d💻", "🇬🇧", "!"]);
    expect(clusters.map((cluster) => cluster.index)).toEqual([0, 2, 9, 13]);
    expect(clusters[1]!.codePoints.map((point) => point.label)).toEqual(["U+1F469", "U+1F3FD", "U+200D", "U+1F4BB"]);
    expect(clusters[1]!.codePoints[2]!.flags).toEqual([{ kind: "invisible", label: "ZWJ" }]);
  });

  it("returns nothing for empty text", () => {
    expect(graphemes("")).toEqual([]);
  });
});

describe("normalisation and counts", () => {
  it("shows each form and whether it differs", () => {
    const forms = normalise("e\u0301\ufb01");
    expect(forms).toEqual([
      { form: "NFC", text: "é\ufb01", changed: true, codePoints: 2 },
      { form: "NFD", text: "e\u0301\ufb01", changed: false, codePoints: 3 },
      { form: "NFKC", text: "éfi", changed: true, codePoints: 3 },
      { form: "NFKD", text: "e\u0301fi", changed: true, codePoints: 4 },
    ]);
    expect(normalise("abc").every((form) => !form.changed)).toBe(true);
  });

  it("counts UTF-16 units, code points, graphemes and UTF-8 bytes", () => {
    expect(counts("👩🏽\u200d💻é")).toEqual({ utf16: 8, codePoints: 5, graphemes: 2, utf8: 17 });
    expect(counts("")).toEqual({ utf16: 0, codePoints: 0, graphemes: 0, utf8: 0 });
  });
});
