import { describe, expect, it } from "vitest";

import { snippetLanguages } from "../../src/content.config";
import { isFiltered, matchesSnippet, searchText } from "../../src/lib/snippet-filter";
import { languageName, languagesOf, snippetPath, tagsOf } from "../../src/lib/snippets";

const snippet = (language: string, tags: string[]) => ({ data: { language, tags } });
const all = [
  snippet("ts", ["typescript", "react"]),
  snippet("css", ["css", "accessibility"]),
  snippet("ts", ["typescript"]),
  snippet("bash", ["git"]),
];

describe("snippets", () => {
  it("lives under /snippets/, clear of article URLs at the root", () => {
    expect(snippetPath({ id: "exhaustive-switch" })).toBe("/snippets/exhaustive-switch/");
  });

  it("names every language the schema accepts, and passes anything else through", () => {
    for (const language of snippetLanguages) expect(languageName(language)).not.toBe(language);
    expect(languageName("ts")).toBe("TypeScript");
    expect(languageName("bash")).toBe("Shell");
    expect(languageName("cobol")).toBe("cobol");
  });

  it("counts languages and tags, most used first, then alphabetically", () => {
    expect(languagesOf(all)).toEqual([
      { value: "ts", count: 2 },
      { value: "bash", count: 1 },
      { value: "css", count: 1 },
    ]);
    expect(tagsOf(all).slice(0, 3)).toEqual([
      { value: "typescript", count: 2 },
      { value: "accessibility", count: 1 },
      { value: "css", count: 1 },
    ]);
  });
});

describe("snippet filter", () => {
  const entry = {
    text: searchText(["Focus rings that survive forced colours", "Visible   rings", "CSS", "accessibility"]),
    language: "css",
    tags: ["css", "accessibility"],
  };
  const query = (changes: Partial<Parameters<typeof matchesSnippet>[1]> = {}) => ({
    query: "",
    language: "",
    tag: "",
    ...changes,
  });

  it("builds one lower-case, single-spaced search string", () => {
    expect(entry.text).toBe("focus rings that survive forced colours visible rings css accessibility");
    expect(searchText(["Café", "Ünïcode"])).toBe("cafe unicode");
  });

  it("matches everything with no filters", () => {
    expect(matchesSnippet(entry, query())).toBe(true);
    expect(isFiltered(query())).toBe(false);
    expect(isFiltered(query({ query: "   " }))).toBe(false);
  });

  it("needs every word, in any order and case, ignoring accents", () => {
    expect(matchesSnippet(entry, query({ query: "FORCED focus" }))).toBe(true);
    expect(matchesSnippet(entry, query({ query: "colóurs" }))).toBe(true);
    expect(matchesSnippet(entry, query({ query: "focus react" }))).toBe(false);
  });

  it("filters by language and tag", () => {
    expect(matchesSnippet(entry, query({ language: "css", tag: "accessibility" }))).toBe(true);
    expect(matchesSnippet(entry, query({ language: "ts" }))).toBe(false);
    expect(matchesSnippet(entry, query({ tag: "react" }))).toBe(false);
    expect(isFiltered(query({ tag: "react" }))).toBe(true);
    expect(isFiltered(query({ language: "ts" }))).toBe(true);
  });
});
