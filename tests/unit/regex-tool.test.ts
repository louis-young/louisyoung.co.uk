import { describe, expect, it } from "vitest";

import { groupNames, matchLimit, runRegex, segments } from "../../src/lib/regex-tool";

describe("groupNames", () => {
  it("lists capturing groups in order, skipping non-capturing groups, lookarounds, escapes and classes", () => {
    expect(groupNames(String.raw`(a)(?:b)(?<word>c)(?=d)(?!e)(?<=f)(?<!g)\(h\)[(i)](j)`)).toEqual([
      undefined,
      "word",
      undefined,
    ]);
    expect(groupNames(String.raw`[\]()](k)`)).toEqual([undefined]);
    expect(groupNames("plain")).toEqual([]);
  });
});

describe("runRegex", () => {
  it("finds every match with numbered and named groups", () => {
    const result = runRegex(String.raw`(?<year>\d{4})-(\d{2})(x)?`, "g", "2024-03 and 2026-10");
    expect(result).toEqual({
      truncated: false,
      matches: [
        {
          index: 0,
          text: "2024-03",
          groups: [
            { number: 1, name: "year", value: "2024" },
            { number: 2, name: undefined, value: "03" },
            { number: 3, name: undefined, value: undefined },
          ],
        },
        {
          index: 12,
          text: "2026-10",
          groups: [
            { number: 1, name: "year", value: "2026" },
            { number: 2, name: undefined, value: "10" },
            { number: 3, name: undefined, value: undefined },
          ],
        },
      ],
    });
  });

  it("returns only the first match without the global or sticky flag", () => {
    expect(runRegex("a", "", "aaa")).toEqual({ truncated: false, matches: [{ index: 0, text: "a", groups: [] }] });
    expect(runRegex("z", "i", "aaa")).toEqual({ truncated: false, matches: [] });
  });

  it("applies flags", () => {
    expect(runRegex("A", "gi", "aA")).toMatchObject({ matches: [{ index: 0 }, { index: 1 }] });
    expect(runRegex("^b", "gm", "a\nb")).toMatchObject({ matches: [{ index: 2 }] });
    expect(runRegex("a.b", "s", "a\nb")).toMatchObject({ matches: [{ text: "a\nb" }] });
    expect(runRegex("a", "y", "aab")).toMatchObject({ matches: [{ index: 0 }, { index: 1 }] });
  });

  it("steps over empty matches instead of looping forever", () => {
    const result = runRegex("x*", "g", "axb");
    expect(result).toMatchObject({
      matches: [{ index: 0, text: "" }, { index: 1, text: "x" }, { index: 2 }, { index: 3 }],
    });
  });

  it("steps over a whole astral code point in Unicode mode", () => {
    expect(runRegex("", "gu", "😀a")).toMatchObject({ matches: [{ index: 0 }, { index: 2 }, { index: 3 }] });
    expect(runRegex("", "g", "😀")).toMatchObject({ matches: [{ index: 0 }, { index: 1 }, { index: 2 }] });
  });

  it("caps the number of matches", () => {
    const result = runRegex("a", "g", "a".repeat(matchLimit + 5));
    expect(result).toMatchObject({ truncated: true });
    expect("matches" in result && result.matches).toHaveLength(matchLimit);
    expect(runRegex("", "g", "abc", 2)).toMatchObject({ truncated: true, matches: [{}, {}] });
  });

  it("reports invalid patterns and flags", () => {
    expect(runRegex("(", "g", "")).toEqual({ error: expect.stringMatching(/./u) as unknown });
    expect(runRegex("a", "gg", "")).toHaveProperty("error");
  });
});

describe("segments", () => {
  it("splits text into plain and matched runs", () => {
    const text = "one two three";
    const result = runRegex("t\\w+", "g", text);
    expect("matches" in result && segments(text, result.matches)).toEqual([
      { text: "one " },
      { text: "two", match: 0 },
      { text: " " },
      { text: "three", match: 1 },
    ]);
  });

  it("skips empty matches and handles matches at the edges", () => {
    const empty = runRegex("x*", "g", "axb");
    expect("matches" in empty && segments("axb", empty.matches)).toEqual([
      { text: "a" },
      { text: "x", match: 1 },
      { text: "b" },
    ]);
    const edges = runRegex("^a|b$", "g", "ab");
    expect("matches" in edges && segments("ab", edges.matches)).toEqual([
      { text: "a", match: 0 },
      { text: "b", match: 1 },
    ]);
    expect(segments("", [])).toEqual([]);
  });
});
