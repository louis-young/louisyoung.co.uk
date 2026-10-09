import { describe, expect, it } from "vitest";

import { searchText } from "../../src/lib/snippet-filter";
import { isToolFilterActive, matchesTool } from "../../src/lib/tool-filter";

const regex = {
  text: searchText(["Regex tester", "Test a regular expression", "pattern match", "Text & data"]),
  category: "text",
};

describe("tool filter", () => {
  it("matches every word of the query against title, summary, keywords and category", () => {
    expect(matchesTool(regex, { query: "", category: "" })).toBe(true);
    expect(matchesTool(regex, { query: "  REGEX  ", category: "" })).toBe(true);
    expect(matchesTool(regex, { query: "regular pattern", category: "" })).toBe(true);
    expect(matchesTool(regex, { query: "regular json", category: "" })).toBe(false);
  });

  it("ignores accents and case", () => {
    expect(
      matchesTool({ text: searchText(["Colour café"]), category: "colour" }, { query: "CAFE", category: "" }),
    ).toBe(true);
  });

  it("narrows to a category", () => {
    expect(matchesTool(regex, { query: "", category: "text" })).toBe(true);
    expect(matchesTool(regex, { query: "regex", category: "colour" })).toBe(false);
  });

  it("knows when the list is filtered", () => {
    expect(isToolFilterActive({ query: "  ", category: "" })).toBe(false);
    expect(isToolFilterActive({ query: "a", category: "" })).toBe(true);
    expect(isToolFilterActive({ query: "", category: "css" })).toBe(true);
  });
});
