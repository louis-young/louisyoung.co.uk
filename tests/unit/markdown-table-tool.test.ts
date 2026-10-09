import { describe, expect, it } from "vitest";

import {
  escapeCell,
  normalise,
  parseDelimited,
  parseTable,
  type Table,
  toMarkdown,
} from "../../src/lib/markdown-table-tool";

const table: Table = {
  headers: ["Operator", "Meaning", "Example"],
  rows: [
    ["&&", "Logical AND", "a && b"],
    ["||", "Logical OR", "a || b"],
    ["??", "Nullish", "a ?? b"],
  ],
  align: ["center", "left", "right"],
};

describe("escapeCell", () => {
  it("escapes pipes, trims and keeps line breaks as <br>", () => {
    expect(escapeCell(" a | b ")).toBe(String.raw`a \| b`);
    expect(escapeCell("one\r\ntwo\nthree")).toBe("one<br>two<br>three");
  });
});

describe("toMarkdown", () => {
  it("pads columns and writes the alignment", () => {
    expect(toMarkdown(table)).toBe(
      [
        "| Operator | Meaning     |  Example |",
        "| :------: | :---------- | -------: |",
        "|    &&    | Logical AND |   a && b |",
        String.raw`|   \|\|   | Logical OR  | a \|\| b |`,
        "|    ??    | Nullish     |   a ?? b |",
      ].join("\n"),
    );
  });

  it("writes a compact table", () => {
    expect(toMarkdown(table, true)).toBe(
      [
        "|Operator|Meaning|Example|",
        "|:-:|:-|-:|",
        "|&&|Logical AND|a && b|",
        String.raw`|\|\||Logical OR|a \|\| b|`,
        "|??|Nullish|a ?? b|",
      ].join("\n"),
    );
  });

  it("keeps columns at least three wide and counts emoji once", () => {
    expect(toMarkdown({ headers: ["", "🎉"], rows: [["a"]], align: ["left", "center"] })).toBe(
      ["|     |  🎉  |", "| :-- | :-: |", "| a   |     |"].join("\n"),
    );
  });

  it("fills ragged rows", () => {
    expect(normalise({ headers: ["a"], rows: [["1", "2"], []], align: [] })).toEqual({
      headers: ["a", ""],
      rows: [
        ["1", "2"],
        ["", ""],
      ],
      align: ["left", "left"],
    });
    expect(normalise({ headers: [], rows: [], align: [] }).headers).toEqual([""]);
  });
});

describe("parseDelimited", () => {
  it("reads quoted fields with separators, quotes and line breaks", () => {
    expect(parseDelimited('a,"b, c","say ""hi"""\r\n"two\nlines",x,\n', ",")).toEqual([
      ["a", "b, c", 'say "hi"'],
      ["two\nlines", "x", ""],
    ]);
  });

  it("keeps a last line without a newline and skips blank lines", () => {
    expect(parseDelimited("a\tb\n\n\nc\td", "\t")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
    expect(parseDelimited("a,b\n", ",")).toEqual([["a", "b"]]);
    expect(parseDelimited("a,", ",")).toEqual([["a", ""]]);
  });
});

describe("parseTable", () => {
  it("reads a Markdown table with its alignment and escaped pipes", () => {
    const result = parseTable(toMarkdown(table));
    expect(result).toEqual({ table, format: "markdown" });
    expect(parseTable("a | b\n--- | ---:\n1 | 2 \\| 3\n")).toEqual({
      table: { headers: ["a", "b"], rows: [["1", "2 | 3"]], align: ["left", "right"] },
      format: "markdown",
    });
    expect(parseTable("|a|\n|-|\n|x\\||")!.table.rows).toEqual([["x|"]]);
  });

  it("reads TSV pasted from a spreadsheet", () => {
    expect(parseTable("Name\tAge\nAnn\t31\nBo\n")).toEqual({
      table: {
        headers: ["Name", "Age"],
        rows: [
          ["Ann", "31"],
          ["Bo", ""],
        ],
        align: ["left", "left"],
      },
      format: "tsv",
    });
  });

  it("reads CSV, with semicolons when they outnumber commas", () => {
    expect(parseTable('a,b\n"1,5",2')!.table.rows).toEqual([["1,5", "2"]]);
    expect(parseTable("a;b\n1,5;2")).toMatchObject({ table: { rows: [["1,5", "2"]] }, format: "csv" });
    expect(parseTable('a,b\n"x\ny",z')!.table.rows).toEqual([["x<br>y", "z"]]);
  });

  it("reads one line as a header and nothing as nothing", () => {
    expect(parseTable("just text")!.table).toEqual({ headers: ["just text"], rows: [], align: ["left"] });
    expect(parseTable(" \n ")).toBeUndefined();
  });
});
