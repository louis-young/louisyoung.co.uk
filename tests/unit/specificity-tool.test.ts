import { describe, expect, it } from "vitest";

import {
  analyseSelectorList,
  compareSpecificity,
  formatSpecificity,
  rankSelectors,
  SelectorError,
  specificity,
  tokenize,
} from "../../src/lib/specificity-tool";

const one = (selector: string) => specificity(selector)[0];
const fails = (selector: string) => {
  try {
    analyseSelectorList(selector);
  } catch (error) {
    if (error instanceof SelectorError) return { code: error.code, at: error.at, text: error.text };
    throw error;
  }
  throw new Error(`${selector} parsed`);
};
const types = (selector: string) =>
  tokenize(selector)
    .filter((token) => token.type !== "whitespace")
    .map((token) => `${token.type}:${token.text}`);

describe("tokenize", () => {
  it("reads idents, hashes, delims and brackets with their offsets", () => {
    expect(tokenize("a#b.c")).toEqual([
      { type: "ident", text: "a", value: "a", start: 0, end: 1 },
      { type: "hash", text: "#b", value: "b", start: 1, end: 3 },
      { type: "delim", text: ".", value: ".", start: 3, end: 4 },
      { type: "ident", text: "c", value: "c", start: 4, end: 5 },
    ]);
    expect(types("[x='y'] > :is(p, q)")).toEqual([
      "open-square:[",
      "ident:x",
      "delim:=",
      "string:'y'",
      "close-square:]",
      "delim:>",
      "colon::",
      "function:is(",
      "ident:p",
      "comma:,",
      "ident:q",
      "close-paren:)",
    ]);
  });

  it("lower-cases names but keeps the source text", () => {
    const [token] = tokenize("DIV");
    expect(token).toMatchObject({ text: "DIV", value: "div" });
    expect(tokenize(":NOT(")[1]).toMatchObject({ type: "function", value: "not" });
  });

  it("reads escapes, custom-property-style names and non-ASCII names", () => {
    expect(types(String.raw`.\31 0 .a\:b .--x .-y .café .\😀`)).toEqual([
      "delim:.",
      String.raw`ident:\31 0`,
      "delim:.",
      String.raw`ident:a\:b`,
      "delim:.",
      "ident:--x",
      "delim:.",
      "ident:-y",
      "delim:.",
      "ident:café",
      "delim:.",
      String.raw`ident:\😀`,
    ]);
    expect(types("#\\31")).toEqual(["hash:#\\31"]);
    expect(types("a\\")).toEqual(["ident:a", "delim:\\"]);
  });

  it("reads strings with escaped quotes, and comments", () => {
    expect(types(String.raw`"a\"b" 'c' /* x */`)).toEqual([String.raw`string:"a\"b"`, "string:'c'", "comment:/* x */"]);
  });

  it("reads An+B as numbers and idents", () => {
    expect(types("2n+1 -n+3 +5 .5 -.5 odd")).toEqual([
      "number:2n",
      "number:+1",
      "ident:-n",
      "number:+3",
      "number:+5",
      "number:.5",
      "number:-.5",
      "ident:odd",
    ]);
  });

  it("fails on an unclosed string or comment", () => {
    expect(() => tokenize("[a='b")).toThrow(SelectorError);
    expect(() => tokenize('"a\nb"')).toThrow(/unclosed at 0/u);
    expect(() => tokenize("a /* b")).toThrow(/unclosed at 2/u);
  });
});

describe("specificity: the examples in Selectors Level 4", () => {
  it.each([
    ["*", [0, 0, 0]],
    ["LI", [0, 0, 1]],
    ["UL LI", [0, 0, 2]],
    ["UL OL+LI", [0, 0, 3]],
    ["H1 + *[REL=up]", [0, 1, 1]],
    ["UL OL LI.red", [0, 1, 3]],
    ["LI.red.level", [0, 2, 1]],
    ["#x34y", [1, 0, 0]],
    ["#s12:not(FOO)", [1, 0, 1]],
    [".foo :is(.bar, #baz)", [1, 1, 0]],
  ])("%s is %j", (selector, expected) => {
    expect(one(selector)).toEqual(expected);
  });

  it("takes the most specific argument of :is(), :not() and :has()", () => {
    expect(one(":is(em, #foo)")).toEqual([1, 0, 0]);
    expect(one(":not(em, strong#foo)")).toEqual([1, 0, 1]);
    expect(one(":has(> img, .a.b)")).toEqual([0, 2, 0]);
    expect(one("a:has(+ p)")).toEqual([0, 0, 2]);
    expect(one(":is(:not(#a), .b)")).toEqual([1, 0, 0]);
  });

  it("counts :where() and the universal selector as zero", () => {
    expect(one(":where(#a, .b)")).toEqual([0, 0, 0]);
    expect(one(":where(#a) .b")).toEqual([0, 1, 0]);
    expect(one("*.a")).toEqual([0, 1, 0]);
    expect(one(":where()")).toEqual([0, 0, 0]);
  });

  it("adds :nth-child(An+B of S) to its most specific selector", () => {
    expect(one(":nth-child(2n+1 of li.important)")).toEqual([0, 2, 1]);
    expect(one(":nth-last-child(even of #a, .b)")).toEqual([1, 1, 0]);
    expect(one("li:nth-child(odd)")).toEqual([0, 1, 1]);
    expect(one(":nth-of-type(2n of p)")).toEqual([0, 1, 0]);
  });

  it("counts pseudo-elements, including legacy single-colon ones, as types", () => {
    expect(one("p::before")).toEqual([0, 0, 2]);
    expect(one("p:first-line")).toEqual([0, 0, 2]);
    expect(one("a:BEFORE")).toEqual([0, 0, 2]);
    expect(one("::part(label)")).toEqual([0, 0, 1]);
    expect(one("a:hover::after")).toEqual([0, 1, 2]);
  });

  it("counts attribute selectors in every form", () => {
    expect(one("[href]")).toEqual([0, 1, 0]);
    expect(one('a[href^="https"][target=_blank i][lang|=en s]')).toEqual([0, 3, 1]);
    expect(one("[ data-x ~= 'y' ]")).toEqual([0, 1, 0]);
    expect(one("[a$=b][a*=b]")).toEqual([0, 2, 0]);
  });

  it("counts namespaced types and attributes", () => {
    expect(one("svg|a")).toEqual([0, 0, 1]);
    expect(one("*|a")).toEqual([0, 0, 1]);
    expect(one("|a")).toEqual([0, 0, 1]);
    expect(one("svg|*")).toEqual([0, 0, 0]);
    expect(one("*|*")).toEqual([0, 0, 0]);
    expect(one("[xlink|href][*|lang][|id]")).toEqual([0, 3, 0]);
  });

  it("follows CSS Scoping for :host and ::slotted()", () => {
    expect(one(":host")).toEqual([0, 1, 0]);
    expect(one(":host(.dark)")).toEqual([0, 2, 0]);
    expect(one(":host-context(main#x)")).toEqual([1, 1, 1]);
    expect(one("::slotted(span.a)")).toEqual([0, 1, 2]);
  });

  it("counts other pseudo-classes once, whatever their arguments", () => {
    expect(one(":lang(en)")).toEqual([0, 1, 0]);
    expect(one("a:hover:focus-visible")).toEqual([0, 2, 1]);
    expect(one("p:dir(rtl)")).toEqual([0, 1, 1]);
  });

  it("drops what :is() can't parse but nothing else forgives", () => {
    expect(one(":is(#a, 1x, a b >)")).toEqual([1, 0, 0]);
    expect(one(":is(>, .b)")).toEqual([0, 1, 0]);
    expect(one(":is()")).toEqual([0, 0, 0]);
    expect(fails(":not(.a, 1x)")).toMatchObject({ code: "unexpected", text: "1x" });
  });

  it("counts & as zero and reads the column combinator", () => {
    expect(one("& .a")).toEqual([0, 1, 0]);
    expect(one("col.selected || td")).toEqual([0, 1, 2]);
    expect(one("a ~ b > c + d")).toEqual([0, 0, 4]);
  });

  it("ignores comments", () => {
    expect(one("a/* x */.b")).toEqual([0, 1, 1]);
    expect(one("a /* x */ b")).toEqual([0, 0, 2]);
  });

  it("splits a list into its selectors", () => {
    expect(specificity("a, .b ,#c")).toEqual([
      [0, 0, 1],
      [0, 1, 0],
      [1, 0, 0],
    ]);
  });
});

describe("invalid selectors", () => {
  it.each([
    ["", "empty", 0],
    ["a,", "empty", 2],
    ["a,,b", "empty", 2],
    ["a >", "combinator", 2],
    ["a > , b", "combinator", 2],
    ["> a", "unexpected", 0],
    [".", "unexpected", 0],
    [". a", "unexpected", 1],
    ["#1a", "unexpected", 0],
    ["a)", "unexpected", 1],
    ["a(", "unexpected", 0],
    [":not()", "empty", 5],
    [":lang()", "empty", 6],
    [":has(>)", "combinator", 5],
    [":", "unexpected", 1],
    [": hover", "unexpected", 1],
    ["[", "unclosed", 0],
    ["[]", "empty", 1],
    ["[1]", "unexpected", 1],
    ["[a=]", "empty", 3],
    ["[a=1]", "unexpected", 3],
    ["[a!=b]", "unexpected", 2],
    ["[a=b c]", "unexpected", 5],
    ["[a)]", "unexpected", 2],
    [":is(a]", "unexpected", 5],
    ["div|", "unexpected", 3],
    ["|.a", "unexpected", 1],
    [":host(a b)", "unexpected", 7],
    [":host(a, b)", "unexpected", 7],
    [":host()", "empty", 1],
    [":nth-child( of a)", "unexpected", 12],
    [".a.b:not(#c", "unclosed", 5],
  ])("%j fails with %s at %d", (selector, code, at) => {
    const error = fails(selector);
    expect(error.code).toBe(code);
    expect(error.at).toBe(at);
  });

  it("only allows a type selector first in a compound", () => {
    expect(one(".a div")).toEqual([0, 1, 1]);
    expect(fails(".a|div")).toMatchObject({ code: "unexpected", text: "|" });
  });
});

describe("breakdown", () => {
  const parts = (selector: string) => analyseSelectorList(selector)[0]!.parts.map(({ text, kind }) => [text, kind]);

  it("marks what counts towards a, b and c, covering every character", () => {
    expect(parts("ul > li.red#x::marker")).toEqual([
      ["ul", "type"],
      [" > ", "plain"],
      ["li", "type"],
      [".red", "class"],
      ["#x", "id"],
      ["::marker", "type"],
    ]);
  });

  it("marks the winning argument and greys out the rest", () => {
    expect(parts(":is(.a, #b)")).toEqual([
      [":is(", "plain"],
      [".a", "ignored"],
      [", ", "plain"],
      ["#b", "id"],
      [")", "plain"],
    ]);
    expect(parts(":where(#a) *")).toEqual([
      [":where(#a)", "zero"],
      [" ", "plain"],
      ["*", "zero"],
    ]);
    expect(parts(":is(#a, 1x)")).toEqual([
      [":is(", "plain"],
      ["#a", "id"],
      [",", "plain"],
      [" 1x", "ignored"],
      [")", "plain"],
    ]);
    expect(parts(":nth-child(2n of .a, #b)")).toEqual([
      [":nth-child(2n of ", "class"],
      [".a", "ignored"],
      [", ", "class"],
      ["#b", "id"],
      [")", "class"],
    ]);
  });

  it("lists every contribution, with the pseudo-class it sits inside", () => {
    const [result] = analyseSelectorList("#s12:not(FOO) :nth-child(odd of li) :host(.x) a:lang(en)");
    expect(result!.contributions).toEqual([
      { text: "#s12", weight: "id" },
      { text: "FOO", weight: "type", via: ":not()" },
      { text: ":nth-child(odd of …)", weight: "class" },
      { text: "li", weight: "type", via: ":nth-child()" },
      { text: ":host()", weight: "class" },
      { text: ".x", weight: "class", via: ":host()" },
      { text: "a", weight: "type" },
      { text: ":lang(en)", weight: "class" },
    ]);
  });

  it("trims each selector in a list", () => {
    expect(analyseSelectorList(" a , b /* c */ ").map((result) => result.selector)).toEqual(["a", "b"]);
  });
});

describe("ranking", () => {
  it("compares and formats specificity", () => {
    expect(compareSpecificity([1, 0, 0], [0, 9, 9])).toBeLessThan(0);
    expect(compareSpecificity([0, 1, 0], [0, 1, 0])).toBe(0);
    expect(compareSpecificity([0, 0, 1], [0, 0, 2])).toBeGreaterThan(0);
    expect(formatSpecificity([1, 2, 3])).toBe("(1, 2, 3)");
  });

  it("sorts by specificity and puts the later of equals first", () => {
    const { ranked, tie, errors } = rankSelectors(".a\n#b\n\nul li, .c\n");
    expect(ranked.map((item) => [item.selector, item.line, item.order])).toEqual([
      ["#b", 2, 1],
      [".c", 4, 3],
      [".a", 1, 0],
      ["ul li", 4, 2],
    ]);
    expect(tie).toBe(false);
    expect(errors).toEqual([]);
  });

  it("flags a tie for first place", () => {
    const { ranked, tie } = rankSelectors(".a\r\n.b");
    expect(ranked[0]!.selector).toBe(".b");
    expect(tie).toBe(true);
    expect(rankSelectors("").tie).toBe(false);
  });

  it("reports invalid lines with their column and keeps the rest", () => {
    const { ranked, errors } = rankSelectors("a\n  a >\n.b");
    expect(ranked).toHaveLength(2);
    expect(errors).toEqual([{ line: 2, code: "combinator", column: 5, text: ">" }]);
  });
});
