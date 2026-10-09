import { describe, expect, it } from "vitest";

import { compileGlob, expandBraces, isMatch, matchPaths, MAX_EXPANSIONS } from "../../src/lib/glob-tool";

/** Each case: pattern, paths that match, paths that don't. Checked with picomatch and minimatch. */
const cases: [string, string[], string[]][] = [
  ["*", ["a", "a.js", "dir/"], ["a/b", ".env", "", "."]],
  ["*.js", ["a.js", "x.min.js"], ["a.ts", "a/b.js", ".a.js", "./a.js"]],
  ["*.{js,ts}", ["a.js", "a.ts"], ["a.jsx", "a/b.ts"]],
  ["**", ["a", "a/b", "a/b/c", "a/"], [".env", "a/.b", ".git/config"]],
  ["**/*.js", ["a.js", "x/y/a.js"], ["a.ts", "x/.y/a.js", ".a.js"]],
  ["src/**", ["src", "src/", "src/a", "src/a/b.ts"], ["srcx", "lib/a", "src/.cache/x"]],
  ["src/**/*.ts", ["src/index.ts", "src/a/x.ts", "src/a/b/c.ts"], ["src/a/x.tsx", "src/.hidden/x.ts", "lib/x.ts"]],
  ["a/**/b", ["a/b", "a/x/b", "a/x/y/b"], ["a/b/c", "a/.x/b", "b"]],
  ["a/**/b/**/c", ["a/b/c", "a/x/b/y/z/c"], ["a/c", "a/b/x"]],
  ["**/node_modules/**", ["node_modules/x", "a/node_modules/b/c"], ["a/node_modules_x/b"]],
  ["?.js", ["a.js"], ["ab.js", ".js", "/.js"]],
  ["a?c", ["abc", "a.c"], ["a/c", "ac"]],
  ["[abc].js", ["a.js", "c.js"], ["d.js", "ab.js"]],
  ["[a-c]*", ["abc", "b", "c.js"], ["d", "Abc"]],
  ["[!a]*", ["b.ts", "1a", "Abc"], ["a", "abc", ".env"]],
  ["[^a]*", ["b"], ["a", ".a"]],
  ["*.[jt]s", ["a.js", "a.ts"], ["a.cs"]],
  ["[[:digit:]]*", ["1a", "9"], ["a1"]],
  ["[[:upper:]][[:alpha:]]", ["Ab"], ["ab", "A1"]],
  ["[.]*", [".env", ".a.js"], ["env"]],
  [".*", [".env", ".github"], ["env", "a/.b", ".", ".."]],
  ["*/.*", ["a/.b"], ["a/b", ".a/.b"]],
  ["a/*", ["a/b", "a/b/"], ["a/", "a", "a/b/c", "a/.b"]],
  ["src/{a,b}/*.ts", ["src/a/x.ts", "src/b/y.ts"], ["src/c/z.ts"]],
  ["{a,b/c}/d", ["a/d", "b/c/d"], ["b/d", "c/d"]],
  ["{src,test}/**/*.{ts,tsx}", ["src/a.ts", "test/x/y.tsx"], ["lib/a.ts", "src/a.js"]],
  ["file{1..3}.txt", ["file1.txt", "file3.txt"], ["file4.txt", "file0.txt"]],
  ["img{01..03}.png", ["img01.png", "img03.png"], ["img1.png", "img04.png"]],
  ["{c..a}", ["a", "b", "c"], ["d"]],
  ["{10..0..5}", ["0", "5", "10"], ["1", "15"]],
  ["a{,.min}.js", ["a.js", "a.min.js"], ["a.max.js"]],
  ["{a,}b", ["ab", "b"], ["cb"]],
  ["{a}", ["{a}"], ["a"]],
  ["a\\*b", ["a*b"], ["axb"]],
  ["a[", ["a["], ["a"]],
  ["a{b", ["a{b"], ["ab"]],
  ["**/", ["a/", "a/b/"], ["a"]],
  ["/a/*", ["/a/b"], ["a/b"]],
  ["a/**b", ["a/xb", "a/b"], ["a/x/yb"]],
  ["a/[b/]c", ["a/[b/]c"], ["a/bc"]],
  ["**/**/a", ["a", "x/y/a"], ["x/a/b"]],
];

describe("glob matcher", () => {
  it.each(cases)("%s", (pattern, matches, misses) => {
    for (const path of matches) expect(isMatch(path, pattern), `${pattern} should match ${path}`).toBe(true);
    for (const path of misses) expect(isMatch(path, pattern), `${pattern} shouldn't match ${path}`).toBe(false);
  });

  it("matches dotfiles and dot folders with the dot option, but never . or ..", () => {
    expect(isMatch(".env", "*", { dot: true })).toBe(true);
    expect(isMatch("a/.b/c", "a/**/c", { dot: true })).toBe(true);
    expect(isMatch(".git/config", "**", { dot: true })).toBe(true);
    expect(isMatch(".a.js", "?a.js", { dot: true })).toBe(true);
    expect(isMatch(".", "*", { dot: true })).toBe(false);
    expect(isMatch("..", "*", { dot: true })).toBe(false);
    expect(isMatch("a/../b", "a/*/b", { dot: true })).toBe(false);
    expect(isMatch("a/./b", "a/**/b", { dot: true })).toBe(false);
  });

  it("negates a pattern that starts with !, and cancels a double negation", () => {
    expect(isMatch("a.ts", "!*.js")).toBe(true);
    expect(isMatch("a.js", "!*.js")).toBe(false);
    expect(isMatch("x/a.js", "!*.js")).toBe(true);
    expect(isMatch("a.js", "!!*.js")).toBe(true);
    expect(isMatch("a.test.ts", "!**/*.test.ts")).toBe(false);
  });

  it("ignores case on request", () => {
    expect(isMatch("README.MD", "*.md")).toBe(false);
    expect(isMatch("README.MD", "*.md", { nocase: true })).toBe(true);
  });

  it("escapes regex syntax in literal text", () => {
    expect(isMatch("a+b(c)|d$^.e", "a+b(c)|d$^.e")).toBe(true);
    expect(isMatch("aab", "a+b")).toBe(false);
    expect(isMatch("a-b", "[a\\-]-b")).toBe(true);
    expect(isMatch("]", "[]]")).toBe(true);
    expect(isMatch("x", "[!]]")).toBe(true);
    expect(isMatch("-", "[a-]")).toBe(true);
    expect(isMatch("^", "[\\^]")).toBe(true);
    expect(isMatch("a", "[[:nope:]a]")).toBe(false);
  });
});

describe("compileGlob", () => {
  it("builds a readable equivalent RegExp", () => {
    const result = compileGlob("src/**/*.ts");
    expect(result.ok && result.regex.source).toBe(String.raw`^src\/(?:(?!\.)[^/]+\/)*(?!\.)[^/]*\.ts\/?$`);
    const dotted = compileGlob("*", { dot: true, nocase: true });
    expect(dotted.ok && dotted.regex.source).toBe(String.raw`^(?!\.{1,2}(?:\/|$))[^/]+\/?$`);
    expect(dotted.ok && dotted.regex.flags).toBe("iu");
  });

  it("joins brace expansions into one alternation, dropping duplicates", () => {
    const result = compileGlob("{a,b,a}.js");
    expect(result.ok && result.expanded).toEqual(["a.js", "b.js", "a.js"]);
    expect(result.ok && result.regex.source).toBe(String.raw`^(?:a\.js\/?|b\.js\/?)$`);
  });

  it("explains each segment, keeping braces whole", () => {
    const result = compileGlob("!src/{a,b/c}/**/[!.]?*.ts");
    if (!result.ok) throw new Error("failed");
    expect(result.negated).toBe(true);
    expect(result.segments.map((segment) => segment.text)).toEqual(["src", "{a,b/c}", "**", "[!.]?*.ts"]);
    expect(result.segments[1]!.parts).toEqual([{ kind: "braces", alternatives: ["a", "b/c"] }]);
    expect(result.segments[2]).toEqual({ text: "**", parts: [{ kind: "globstar" }], skipsHidden: true });
    expect(result.segments[3]!.parts).toEqual([
      { kind: "class", negated: true, text: "." },
      { kind: "qmark" },
      { kind: "star" },
      { kind: "literal", text: ".ts" },
    ]);
    expect(result.segments[0]!.skipsHidden).toBe(false);
    expect(compileGlob("*", { dot: true }).ok && compileGlob("*", { dot: true })).toMatchObject({
      segments: [{ skipsHidden: false }],
    });
  });

  it("treats a ** that shares its segment as a single *", () => {
    const result = compileGlob("a**b");
    expect(result.ok && result.segments[0]!.parts).toEqual([
      { kind: "literal", text: "a" },
      { kind: "star" },
      { kind: "literal", text: "b" },
    ]);
  });

  it("reports an empty pattern and runaway braces", () => {
    expect(compileGlob("  ")).toEqual({ ok: false, error: "empty" });
    expect(compileGlob("!")).toEqual({ ok: false, error: "empty" });
    expect(compileGlob("{1..5000}")).toEqual({ ok: false, error: "tooMany" });
    expect(compileGlob("{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}")).toEqual({ ok: false, error: "tooMany" });
  });
});

describe("expandBraces", () => {
  it("expands lists, nested lists and ranges", () => {
    expect(expandBraces("a{b,c{d,e}}f")).toEqual(["abf", "acdf", "acef"]);
    expect(expandBraces("{1..3}")).toEqual(["1", "2", "3"]);
    expect(expandBraces("{3..1}")).toEqual(["3", "2", "1"]);
    expect(expandBraces("{-1..1}")).toEqual(["-1", "0", "1"]);
    expect(expandBraces("{a..c}")).toEqual(["a", "b", "c"]);
    expect(expandBraces("{0..10..0}")).toHaveLength(11);
  });

  it("leaves escaped braces, braces in classes and lone braces alone", () => {
    expect(expandBraces(String.raw`\{a,b}`)).toEqual([String.raw`\{a,b}`]);
    expect(expandBraces("[{]a,b}")).toEqual(["[{]a,b}"]);
    expect(expandBraces("{a}")).toEqual(["{a}"]);
    expect(expandBraces("{a,b")).toEqual(["{a,b"]);
    expect(expandBraces("{x}{a,b}")).toEqual(["{x}a", "{x}b"]);
  });

  it("stops past the limit", () => {
    expect(() => expandBraces(`{1..${MAX_EXPANSIONS + 1}}`)).toThrow();
  });
});

describe("matchPaths", () => {
  it("tests every non-empty line, trimmed", () => {
    const { result, matches } = matchPaths("*.ts", "a.ts\r\n\n  b.js  \n.c.ts\n");
    expect(result.ok).toBe(true);
    expect(matches).toEqual([
      { path: "a.ts", matched: true },
      { path: "b.js", matched: false },
      { path: ".c.ts", matched: false },
    ]);
    expect(matchPaths("!*.ts", "a.ts\nb.js").matches.map((match) => match.matched)).toEqual([false, true]);
    expect(matchPaths(".*", ".c.ts", { dot: false }).matches[0]!.matched).toBe(true);
  });

  it("returns no matches for an invalid pattern", () => {
    expect(matchPaths("", "a")).toEqual({ result: { ok: false, error: "empty" }, matches: [] });
  });
});
