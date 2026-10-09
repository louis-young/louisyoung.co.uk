import { describe, expect, it } from "vitest";

import { encodeTerm, markdownQuote, quoteUrl, snapToWords, textDirective } from "../../src/lib/text-fragment";

describe("encodeTerm", () => {
  it("escapes the directive's own syntax: & , and -", () => {
    expect(encodeTerm("state-driven, fast & small")).toBe("state%2Ddriven%2C%20fast%20%26%20small");
  });

  it("escapes non-ASCII text as UTF-8", () => {
    expect(encodeTerm("café “quoted”")).toBe("caf%C3%A9%20%E2%80%9Cquoted%E2%80%9D");
  });
});

describe("snapToWords", () => {
  it("widens a selection that starts and ends mid-word", () => {
    expect(snapToWords({ before: "The qu", start: "ick brown f", after: "ox jumps" })).toEqual({
      before: "The ",
      start: "quick brown fox",
      after: " jumps",
    });
  });

  it("widens each end of a selection across blocks independently", () => {
    expect(snapToWords({ before: "Sta", start: "rt here", end: "and en", after: "d there" })).toEqual({
      before: "",
      start: "Start here",
      end: "and end",
      after: " there",
    });
  });

  it("leaves whole-word selections alone", () => {
    const context = { before: "One ", start: "two", after: ", three" };
    expect(snapToWords(context)).toEqual(context);
  });
});

describe("textDirective", () => {
  it("matches a short selection exactly, with context either side", () => {
    expect(textDirective({ before: "React batches state updates. ", start: "This matters", after: " because" })).toBe(
      "batches%20state%20updates.-,This%20matters,-because",
    );
  });

  it("takes at most three words of context", () => {
    expect(textDirective({ before: "one two three four ", start: "five", after: " six seven eight nine" })).toBe(
      "two%20three%20four-,five,-six%20seven%20eight",
    );
  });

  it("omits empty context", () => {
    expect(textDirective({ before: "", start: "Only this", after: "" })).toBe("Only%20this");
  });

  it("links long selections by their first and last words", () => {
    const start = "one two three four five six seven eight nine ten";
    expect(textDirective({ before: "", start, after: "" })).toBe("one%20two%20three%20four,seven%20eight%20nine%20ten");
  });

  it("links selections across blocks by the start of the first and the end of the last", () => {
    expect(textDirective({ before: "Intro ", start: "first block text", end: "second block", after: " outro" })).toBe(
      "Intro-,first%20block%20text,second%20block,-outro",
    );
  });

  it("collapses whitespace from the page source", () => {
    expect(textDirective({ before: "", start: "  spread\n  over\tlines ", after: "" })).toBe("spread%20over%20lines");
  });

  it("returns nothing for an empty selection", () => {
    expect(textDirective({ before: "a", start: "   ", after: "b" })).toBe("");
    expect(textDirective({ before: "", start: "text", end: " ", after: "" })).toBe("");
  });
});

describe("quoteUrl", () => {
  it("replaces any existing fragment with the text directive", () => {
    expect(quoteUrl("https://example.com/post/#intro", { before: "", start: "Hello world", after: "" })).toBe(
      "https://example.com/post/#:~:text=Hello%20world",
    );
  });

  it("falls back to the page URL when there is nothing to link to", () => {
    expect(quoteUrl("https://example.com/post/", { before: "", start: " ", after: "" })).toBe(
      "https://example.com/post/",
    );
  });
});

describe("markdownQuote", () => {
  const attribution = (link: string) => `— Louis Young, ${link}`;

  it("quotes each paragraph and credits the source", () => {
    expect(markdownQuote("First  paragraph.\nSecond\n\n", attribution, "A title", "https://x.y/#:~:text=First")).toBe(
      ["> First paragraph.", ">", "> Second", ">", "> — Louis Young, [A title](https://x.y/#:~:text=First)"].join("\n"),
    );
  });

  it("escapes square brackets in the title", () => {
    expect(markdownQuote("Quote", attribution, "Arrays [and] lists", "https://x.y/")).toContain(
      "[Arrays \\[and\\] lists](https://x.y/)",
    );
  });
});
