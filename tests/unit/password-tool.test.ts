import { describe, expect, it, vi } from "vitest";

import { effShortWordlist } from "../../src/lib/eff-short-wordlist";
import {
  acceptLimit,
  ambiguousCharacters,
  characterSets,
  clampCount,
  crackTime,
  cryptoSource,
  generatePassphrase,
  generatePassword,
  log2,
  passwordAlphabets,
  passwordSpace,
  type RandomSource,
  randomBelow,
  strength,
} from "../../src/lib/password-tool";

/** A source that hands out the given 32-bit words in order, then repeats the last. */
const sequence = (...values: number[]) => {
  let index = 0;
  const source = vi.fn<RandomSource>((words) => {
    for (let i = 0; i < words.length; i++) words[i] = values[Math.min(index++, values.length - 1)]!;
    return words;
  });
  return source;
};

/** A deterministic pseudo-random source (xorshift32), for tests that need many draws. */
const xorshift = (seed = 2_463_534_242): RandomSource => {
  let state = seed;
  return (words) => {
    for (let i = 0; i < words.length; i++) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      words[i] = state;
    }
    return words;
  };
};

describe("randomBelow", () => {
  it("accepts only a whole number of copies of the range, so every result is equally likely", () => {
    for (const max of [1, 2, 3, 6, 10, 26, 62, 94, 1296, 1_000_000, 2 ** 31 + 1, 2 ** 32]) {
      const limit = acceptLimit(max);
      expect(limit % max, String(max)).toBe(0);
      expect(limit).toBeLessThanOrEqual(2 ** 32);
      // The rejected tail is always shorter than one copy of the range.
      expect(2 ** 32 - limit).toBeLessThan(max);
    }
    expect(acceptLimit(3)).toBe(2 ** 32 - 1);
    expect(acceptLimit(1296)).toBe(2 ** 32 - (2 ** 32 % 1296));
  });

  it("rejects draws in the biased tail and draws again", () => {
    // 2^32 mod 3 = 1, so 0xFFFFFFFF would favour 0; it must be thrown away.
    const source = sequence(0xffffffff, 0xffffffff, 7);
    expect(randomBelow(3, source)).toBe(1);
    expect(source).toHaveBeenCalledTimes(3);
    const limit = acceptLimit(1296);
    const again = sequence(limit, limit + 5, limit - 1);
    expect(randomBelow(1296, again)).toBe((limit - 1) % 1296);
    expect(again).toHaveBeenCalledTimes(3);
  });

  it("maps accepted draws straight to their remainder", () => {
    expect(randomBelow(10, sequence(12_345))).toBe(5);
    expect(randomBelow(1, sequence(99))).toBe(0);
    expect(randomBelow(2 ** 32, sequence(0xffffffff))).toBe(0xffffffff);
  });

  it("is uniform over many draws", () => {
    const source = xorshift();
    const counts = new Array<number>(6).fill(0);
    for (let i = 0; i < 60_000; i++) counts[randomBelow(6, source)]! += 1;
    for (const count of counts) expect(Math.abs(count - 10_000)).toBeLessThan(400);
  });

  it("refuses an impossible range", () => {
    expect(() => randomBelow(0)).toThrow(RangeError);
    expect(() => randomBelow(1.5)).toThrow(RangeError);
    expect(() => randomBelow(2 ** 32 + 1)).toThrow(RangeError);
  });

  it("uses the Web Crypto API by default", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    const value = randomBelow(100);
    expect(value).toBeGreaterThanOrEqual(0);
    expect(value).toBeLessThan(100);
    expect(spy).toHaveBeenCalled();
    expect(cryptoSource(new Uint32Array(2))).toHaveLength(2);
    spy.mockRestore();
  });
});

describe("passwords", () => {
  it("takes the ambiguous characters out of each set", () => {
    const [lower, upper, digits, symbols] = passwordAlphabets({
      sets: ["lower", "upper", "digits", "symbols"],
      excludeAmbiguous: true,
    });
    expect(lower).not.toContain("o");
    expect(lower).toHaveLength(24);
    expect(upper).toHaveLength(24);
    expect(digits).toEqual(["2", "3", "4", "5", "6", "7", "8", "9"]);
    for (const char of ambiguousCharacters) expect(symbols).not.toContain(char);
    expect(passwordAlphabets({ sets: ["digits"], excludeAmbiguous: false })).toEqual([
      Array.from(characterSets.digits),
    ]);
  });

  it("counts the passwords that use every set, by inclusion–exclusion", () => {
    const digits = ["0", "1"];
    const letters = ["a", "b"];
    // Length 2 over {0,1,a,b} with at least one digit and one letter: 2 × 2 × 2 orders = 8.
    expect(passwordSpace(2, [digits, letters])).toBe(8n);
    expect(passwordSpace(3, [digits])).toBe(8n);
    expect(passwordSpace(3, [digits, letters])).toBe(4n ** 3n - 2n * 2n ** 3n);
  });

  it("works out log2 of huge numbers", () => {
    expect(log2(1n)).toBe(0);
    expect(log2(1024n)).toBe(10);
    expect(log2(2n ** 200n)).toBeCloseTo(200, 10);
    expect(log2(3n * 2n ** 100n)).toBeCloseTo(100 + Math.log2(3), 10);
    expect(log2(0n)).toBe(-Infinity);
  });

  it("generates a password of the length asked, using every set", () => {
    const source = xorshift(7);
    for (let i = 0; i < 50; i++) {
      const result = generatePassword(
        { length: 12, sets: ["lower", "upper", "digits", "symbols"], excludeAmbiguous: true },
        source,
      )!;
      expect(result.value).toHaveLength(12);
      expect(result.value).toMatch(/[a-z]/u);
      expect(result.value).toMatch(/[A-Z]/u);
      expect(result.value).toMatch(/\d/u);
      expect(result.value).toMatch(/[^a-z\d]/iu);
      for (const char of ambiguousCharacters) expect(result.value).not.toContain(char);
    }
  });

  it("reports the exact entropy, a little under length × log2(alphabet) when every set must appear", () => {
    const result = generatePassword(
      { length: 20, sets: ["lower", "upper", "digits", "symbols"], excludeAmbiguous: false },
      xorshift(),
    )!;
    expect(result.entropy).toBeLessThan(20 * Math.log2(94));
    expect(result.entropy).toBeGreaterThan(20 * Math.log2(94) - 1);
    const lower = generatePassword({ length: 10, sets: ["lower"], excludeAmbiguous: false }, xorshift())!;
    expect(lower.entropy).toBeCloseTo(10 * Math.log2(26), 10);
  });

  it("redraws a whole password that misses a set", () => {
    // Pool "0123456789abc…": draws of 0 give "0", so "00" lacks a letter and is thrown away.
    const source = sequence(0, 0, 0, 10);
    expect(generatePassword({ length: 2, sets: ["digits", "lower"], excludeAmbiguous: false }, source)!.value).toBe(
      "0a",
    );
  });

  it("gives up without a set, or when the length can't fit one of each", () => {
    expect(generatePassword({ length: 10, sets: [], excludeAmbiguous: false })).toBeUndefined();
    expect(
      generatePassword({ length: 2, sets: ["lower", "upper", "digits"], excludeAmbiguous: false }),
    ).toBeUndefined();
  });
});

describe("passphrases", () => {
  it("embeds the whole EFF short wordlist", () => {
    expect(effShortWordlist).toHaveLength(1296);
    expect(new Set(effShortWordlist).size).toBe(1296);
    expect(effShortWordlist.slice(0, 3)).toEqual(["acid", "acorn", "acre"]);
    expect(effShortWordlist.at(-1)).toBe("zoom");
    for (const word of effShortWordlist) expect(word).toMatch(/^[a-z]+(?:-[a-z]+)?$/u);
  });

  it("joins words with the separator and capitalises them", () => {
    const words = ["alpha", "bravo", "charlie"];
    const source = sequence(0, 1, 2);
    expect(
      generatePassphrase({ words: 3, separator: "-", capitalisation: "lower", digit: false }, source, words),
    ).toEqual({
      value: "alpha-bravo-charlie",
      entropy: 3 * Math.log2(3),
    });
    expect(
      generatePassphrase({ words: 2, separator: " ", capitalisation: "title", digit: false }, sequence(2, 0), words)
        .value,
    ).toBe("Charlie Alpha");
    expect(
      generatePassphrase({ words: 2, separator: "", capitalisation: "upper", digit: false }, sequence(1), words).value,
    ).toBe("BRAVOBRAVO");
  });

  it("adds a digit to one word and counts its entropy", () => {
    const words = ["alpha", "bravo", "charlie"];
    // Words 0 and 1, then the digit goes on word 1, and it's a 7.
    const result = generatePassphrase(
      { words: 2, separator: ".", capitalisation: "lower", digit: true },
      sequence(0, 1, 1, 7),
      words,
    );
    expect(result.value).toBe("alpha.bravo7");
    expect(result.entropy).toBeCloseTo(2 * Math.log2(3) + Math.log2(20), 10);
  });

  it("draws from the EFF list by default, at about 10.3 bits a word", () => {
    const result = generatePassphrase({ words: 6, separator: "-", capitalisation: "lower", digit: false }, xorshift());
    const words = result.value.split("-");
    expect(words.length).toBeGreaterThanOrEqual(6);
    expect(result.entropy).toBeCloseTo(6 * Math.log2(1296), 10);
    expect(
      generatePassphrase({ words: 4, separator: " ", capitalisation: "lower", digit: false }).value.split(" ").length,
    ).toBeGreaterThanOrEqual(4);
  });
});

describe("strength and crack time", () => {
  it("bands entropy into plain-English ratings", () => {
    expect(strength(20)).toBe("veryWeak");
    expect(strength(40)).toBe("weak");
    expect(strength(60)).toBe("fair");
    expect(strength(80)).toBe("strong");
    expect(strength(100)).toBe("veryStrong");
  });

  it("estimates the average time to guess at 100 billion guesses a second", () => {
    expect(crackTime(20)).toEqual({ unit: "instant" });
    expect(crackTime(38)).toEqual({ unit: "seconds", value: 1 });
    expect(crackTime(Math.log2(2 * 1e11 * 90))).toEqual({ unit: "minutes", value: 1 });
    expect(crackTime(Math.log2(2 * 1e11 * 7300))).toEqual({ unit: "hours", value: 2 });
    expect(crackTime(Math.log2(2 * 1e11 * 86_400 * 3.5))).toEqual({ unit: "days", value: 3 });
    expect(crackTime(Math.log2(2 * 1e11 * 31_557_600 * 500.5))).toEqual({ unit: "years", value: 500 });
    expect(crackTime(128)).toEqual({ unit: "aeons" });
    expect(crackTime(10, 100)).toEqual({ unit: "seconds", value: 5 });
  });

  it("clamps counts to a range", () => {
    const range = { min: 1, max: 20 };
    expect(clampCount("5", range, 3)).toBe(5);
    expect(clampCount("50", range, 3)).toBe(20);
    expect(clampCount("0", range, 3)).toBe(1);
    expect(clampCount("2.6", range, 3)).toBe(3);
    expect(clampCount("", range, 3)).toBe(3);
    expect(clampCount("abc", range, 3)).toBe(3);
  });
});
