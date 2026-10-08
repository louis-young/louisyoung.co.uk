import { describe, expect, it } from "vitest";

import { collect, format } from "../../scripts/content-todo";
import { findPlaceholders, findPlaceholdersInText, isPlaceholder } from "../../src/lib/placeholders";

describe("placeholders", () => {
  it.each([
    ["[CITY]", true],
    ["From [MONTH YEAR]", true],
    ["[Senior / Staff] software engineer", true],
    ["[2024]", true],
    ["Louis Young", false],
    ["[link text](https://example.com)", false],
    ["an [inline] note in lower case", false],
    ["", false],
  ])("isPlaceholder(%j) is %s", (value, expected) => {
    expect(isPlaceholder(value)).toBe(expected);
  });

  it("walks nested data and reports dotted paths", () => {
    expect(
      findPlaceholders({
        name: "Louis",
        roles: [{ company: "[Company]", stack: ["React", "[Stack]"] }],
        count: 3,
        x: null,
      }),
    ).toEqual([
      { path: "roles.0.company", placeholders: ["[Company]"] },
      { path: "roles.0.stack.1", placeholders: ["[Stack]"] },
    ]);
    expect(findPlaceholders("[ROOT]")).toEqual([{ path: "(root)", placeholders: ["[ROOT]"] }]);
  });

  it("reports text placeholders by line", () => {
    expect(findPlaceholdersInText("Fine\n[A] and [B]\n[link](/x)")).toEqual([
      { path: "line 2", placeholders: ["[A]", "[B]"] },
    ]);
  });
});

describe("content:todo", () => {
  it("collects placeholders from data files and MDX, and formats a report", () => {
    const report = collect();
    expect(report.map(([file]) => file)).toContain("content/data/profile.ts");
    expect(format(report)).toMatch(/\d+ placeholders? in \d+ files?\./u);
  });

  it("congratulates when nothing is left", () => {
    expect(format([])).toBe("No placeholders left. Ship it.\n");
    expect(format([["a.ts", [{ path: "x", placeholders: ["[X]"] }]]])).toContain("1 placeholder in 1 file.");
  });
});
