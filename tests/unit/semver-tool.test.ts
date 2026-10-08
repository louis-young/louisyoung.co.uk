import { describe, expect, it } from "vitest";

import {
  checkVersions,
  compareVersions,
  describeRange,
  formatRange,
  formatVersion,
  highestMatch,
  parseRange,
  parseVersion,
  satisfies,
  type ComparatorSet,
} from "../../src/lib/semver-tool";

const v = (text: string) => {
  const version = parseVersion(text);
  if (!version) throw new Error(`Not a version: ${text}`);
  return version;
};

const sets = (range: string): ComparatorSet[] => {
  const result = parseRange(range);
  if (!("sets" in result)) throw new Error(`Not a range: ${range}`);
  return result.sets;
};

const expand = (range: string) => formatRange(sets(range));
const test = (range: string, version: string) => satisfies(v(version), sets(range));

describe("parseVersion", () => {
  it("reads core, pre-release and build parts", () => {
    expect(parseVersion("1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
    expect(parseVersion(" v1.0.0-beta.11+sha.5114f85 ")).toEqual({
      major: 1,
      minor: 0,
      patch: 0,
      prerelease: ["beta", 11],
      build: ["sha", "5114f85"],
    });
    expect(parseVersion("=2.0.0-0")?.prerelease).toEqual([0]);
  });

  it("rejects anything that isn’t strict SemVer", () => {
    for (const text of ["1.2", "01.2.3", "1.2.3-", "1.2.3-01", "1.2.3+", "latest", "1.2.3.4", ""]) {
      expect(parseVersion(text), text).toBeUndefined();
    }
  });

  it("formats without build metadata", () => {
    expect(formatVersion(v("1.2.3-rc.1+build"))).toBe("1.2.3-rc.1");
  });
});

describe("compareVersions", () => {
  it("follows the SemVer precedence example", () => {
    const ordered = [
      "1.0.0-alpha",
      "1.0.0-alpha.1",
      "1.0.0-alpha.beta",
      "1.0.0-beta",
      "1.0.0-beta.2",
      "1.0.0-beta.11",
      "1.0.0-rc.1",
      "1.0.0",
      "1.0.1",
      "1.1.0",
      "2.0.0",
    ];
    for (let i = 1; i < ordered.length; i++) {
      expect(compareVersions(v(ordered[i - 1]!), v(ordered[i]!)), ordered[i]).toBe(-1);
      expect(compareVersions(v(ordered[i]!), v(ordered[i - 1]!)), ordered[i]).toBe(1);
    }
  });

  it("ignores build metadata", () => {
    expect(compareVersions(v("1.0.0+a"), v("1.0.0+b"))).toBe(0);
    expect(compareVersions(v("1.0.0-a.1"), v("1.0.0-a.1"))).toBe(0);
  });
});

describe("parseRange", () => {
  it.each([
    ["^1.2.3", ">=1.2.3 <2.0.0"],
    ["^0.2.3", ">=0.2.3 <0.3.0"],
    ["^0.0.3", ">=0.0.3 <0.0.4"],
    ["^1.2.x", ">=1.2.0 <2.0.0"],
    ["^0.0.x", ">=0.0.0 <0.1.0"],
    ["^0.0", ">=0.0.0 <0.1.0"],
    ["^1.x", ">=1.0.0 <2.0.0"],
    ["^0.x", ">=0.0.0 <1.0.0"],
    ["^1.2.3-beta.2", ">=1.2.3-beta.2 <2.0.0"],
    ["~1.2.3", ">=1.2.3 <1.3.0"],
    ["~1.2", ">=1.2.0 <1.3.0"],
    ["~1", ">=1.0.0 <2.0.0"],
    ["~0.2.3", ">=0.2.3 <0.3.0"],
    ["~>1.2.3", ">=1.2.3 <1.3.0"],
    ["1.x", ">=1.0.0 <2.0.0"],
    ["1.2.*", ">=1.2.0 <1.3.0"],
    ["1", ">=1.0.0 <2.0.0"],
    ["1.x.3", ">=1.0.0 <2.0.0"],
    ["*", ">=0.0.0"],
    ["x", ">=0.0.0"],
    ["1.2.3", "1.2.3"],
    ["v1.2.3", "1.2.3"],
    ["=1.2", ">=1.2.0 <1.3.0"],
    ["1.2.3 - 2.3.4", ">=1.2.3 <=2.3.4"],
    ["1.2 - 2.3.4", ">=1.2.0 <=2.3.4"],
    ["1.2.3 - 2.3", ">=1.2.3 <2.4.0"],
    ["1.2.3 - 2", ">=1.2.3 <3.0.0"],
    ["* - 2", "<3.0.0"],
    ["1.2.3 - *", ">=1.2.3"],
    ["* - *", ">=0.0.0"],
    [">1.2.3", ">1.2.3"],
    [">1.2", ">=1.3.0"],
    [">1", ">=2.0.0"],
    [">=1.2", ">=1.2.0"],
    ["<1.2", "<1.2.0"],
    ["<1", "<1.0.0"],
    ["<=1.2", "<1.3.0"],
    ["<=1.2.3", "<=1.2.3"],
    [">*", "<0.0.0"],
    ["<*", "<0.0.0"],
    [">=*", ">=0.0.0"],
    [">= 1.2.3  < 2", ">=1.2.3 <2.0.0"],
    ["^1 || ^2 ||", ">=1.0.0 <2.0.0 || >=2.0.0 <3.0.0 || >=0.0.0"],
  ])("expands %s to %s", (range, expanded) => {
    expect(expand(range)).toBe(expanded);
  });

  it("reports blanks and bad tokens", () => {
    expect(parseRange("  ")).toEqual({ error: "empty" });
    expect(parseRange("^1.2.3 || banana")).toEqual({ error: "syntax", token: "banana" });
    expect(parseRange(">=1.2.3.4")).toEqual({ error: "syntax", token: ">=1.2.3.4" });
    expect(parseRange("1 - 2 - 3")).toEqual({ error: "syntax", token: "1 - 2 - 3" });
    expect(parseRange("- 2")).toEqual({ error: "syntax", token: "- 2" });
    expect(parseRange("one - 2")).toEqual({ error: "syntax", token: "one" });
    expect(parseRange("1 - two")).toEqual({ error: "syntax", token: "two" });
  });
});

describe("satisfies", () => {
  it.each([
    ["^1.2.3", "1.2.3", true],
    ["^1.2.3", "1.9.9", true],
    ["^1.2.3", "2.0.0", false],
    ["^1.2.3", "1.2.2", false],
    ["~1.2.3", "1.2.9", true],
    ["~1.2.3", "1.3.0", false],
    ["1.2.3 - 2.3.4", "2.3.4", true],
    ["1.2.3 - 2.3.4", "2.3.5", false],
    [">1.2.3", "1.2.3", false],
    [">=1.2.3", "1.2.3", true],
    ["<=1.2.3", "1.2.3", true],
    ["<1.2.3", "1.2.3", false],
    ["1.2.3", "1.2.3+build", true],
    ["1.x || >=2.5.0", "2.4.0", false],
    ["1.x || >=2.5.0", "3.0.0", true],
    [">*", "0.0.0", false],
  ])("%s with %s is %s", (range, version, expected) => {
    expect(test(range, version)).toBe(expected);
  });

  it("only matches pre-releases the range names on the same version", () => {
    expect(test("^1.2.3", "1.5.0-beta")).toBe(false);
    expect(test("^1.2.3-beta.2", "1.2.3-beta.4")).toBe(true);
    expect(test("^1.2.3-beta.2", "1.2.4-beta.4")).toBe(false);
    expect(test(">=1.0.0-beta <1.0.0", "1.0.0-rc.1")).toBe(true);
    expect(test("^1.2.3", "2.0.0-alpha")).toBe(false);
  });
});

describe("describeRange", () => {
  const messages = {
    ">=": "at least {version}",
    ">": "above {version}",
    "<=": "at most {version}",
    "<": "below {version}",
    "=": "exactly {version}",
    any: "any version",
    none: "no version",
  };
  const lists = { and: (items: string[]) => items.join(" and "), or: (items: string[]) => items.join(" or ") };
  const words = (range: string) => describeRange(sets(range), messages, lists);

  it("puts every set into words", () => {
    expect(words("^1.2.3")).toBe("at least 1.2.3 and below 2.0.0");
    expect(words("1.2.3 || >1 <=3.1.0")).toBe("exactly 1.2.3 or at least 2.0.0 and at most 3.1.0");
    expect(words(">1.2.3")).toBe("above 1.2.3");
    expect(words("*")).toBe("any version");
    expect(words("<*")).toBe("no version");
    expect(words("<0.0.0")).toBe("below 0.0.0");
  });
});

describe("checkVersions and highestMatch", () => {
  it("checks each line and finds the highest match", () => {
    const checks = checkVersions("1.2.2\n\n 1.4.0 \nv1.10.1\n1.9.9-rc.1\n2.0.0\nlatest\n1.3.0", sets("^1.2.3"));
    expect(checks.map((check) => [check.text, check.result])).toEqual([
      ["1.2.2", "miss"],
      ["1.4.0", "match"],
      ["v1.10.1", "match"],
      ["1.9.9-rc.1", "prerelease"],
      ["2.0.0", "miss"],
      ["latest", "invalid"],
      ["1.3.0", "match"],
    ]);
    expect(highestMatch(checks)?.text).toBe("v1.10.1");
  });

  it("finds nothing without a match", () => {
    expect(highestMatch(checkVersions("3.0.0", sets("^1")))).toBeUndefined();
    expect(highestMatch([])).toBeUndefined();
  });
});
