import { describe, expect, it } from "vitest";

import { formatJson, locate } from "../../src/lib/json-tool";

const pretty = { indent: "2", sort: false } as const;

describe("formatJson", () => {
  it("pretty-prints with spaces or tabs, and minifies", () => {
    const input = '{"b":1,"a":[true,false,null,"x"]}';
    expect(formatJson(input, pretty)).toEqual({
      output: '{\n  "b": 1,\n  "a": [\n    true,\n    false,\n    null,\n    "x"\n  ]\n}',
    });
    expect(formatJson('{"a":1}', { indent: "4", sort: false })).toEqual({ output: '{\n    "a": 1\n}' });
    expect(formatJson('{"a":1}', { indent: "tab", sort: false })).toEqual({ output: '{\n\t"a": 1\n}' });
    expect(formatJson(' {\n "a" : [ 1 , 2 ] }\n', { indent: "minify", sort: false })).toEqual({
      output: '{"a":[1,2]}',
    });
  });

  it("sorts keys at every depth without touching array order", () => {
    const input = '{"b":{"z":1,"y":2},"a":[{"d":1,"c":2}],"__proto__":0,"a":3}';
    expect(formatJson(input, { indent: "minify", sort: true })).toEqual({
      output: '{"__proto__":0,"a":3,"b":{"y":2,"z":1}}',
    });
    expect(formatJson('[{"b":1,"a":2},3]', { indent: "minify", sort: true })).toEqual({ output: '[{"a":2,"b":1},3]' });
    expect(formatJson('{"a":1,"a":2}', { indent: "minify", sort: true })).toEqual({ output: '{"a":2}' });
  });

  it("accepts every JSON value type at the top level", () => {
    for (const value of ["0", "-0.5e+10", "1E2", '"\\u00e9\\n\\"\\/"', "true", "false", "null", "[]", "{}", "[ ]"]) {
      expect(formatJson(value, pretty), value).toEqual({ output: JSON.stringify(JSON.parse(value), null, 2) });
    }
  });

  it("returns nothing for empty input", () => {
    expect(formatJson("  \n", pretty)).toEqual({ output: "" });
  });

  it.each([
    ['{"a":1,}', 1, 8, "}"],
    ["{'a':1}", 1, 2, "'"],
    ['{\n  "a": 1\n  "b": 2\n}', 3, 3, '\\"'],
    ['{"a" 1}', 1, 6, "1"],
    ["[1 2]", 1, 4, "2"],
    ["[01]", 1, 3, "1"],
    ["tru", 1, 4, ""],
    ["nul!", 1, 4, "!"],
    ["fals", 1, 5, ""],
    ['"a\\x"', 1, 4, "x"],
    ['"\\u12G4"', 1, 6, "G"],
    ['"tab\there"', 1, 5, "\\t"],
    ["[1] 2", 1, 5, "2"],
    ["-", 1, 1, "-"],
    ["{1:2}", 1, 2, "1"],
    ["@", 1, 1, "@"],
  ])("locates the error in %j", (input, line, column, token) => {
    const result = formatJson(input, pretty);
    expect(result).toMatchObject({ error: { line, column, token } });
  });

  it.each(['{"a":', "[1,", '"open', '"\\', '"\\u12', "{", "["])("reports %j as ending too soon", (input) => {
    expect(formatJson(input, pretty)).toMatchObject({ error: { reason: "end", token: "" } });
  });

  it("reports unexpected characters as tokens", () => {
    expect(formatJson("[1,]", pretty)).toMatchObject({ error: { reason: "token", line: 1, column: 4, token: "]" } });
  });

  it("survives nesting too deep to recurse", () => {
    expect(formatJson("[".repeat(200_000), pretty)).toEqual({
      error: { reason: "depth", line: 1, column: 1, token: "" },
    });
  });
});

describe("locate", () => {
  it("gives 1-based lines and columns", () => {
    expect(locate("ab\ncd", 0)).toEqual({ line: 1, column: 1 });
    expect(locate("ab\ncd", 4)).toEqual({ line: 2, column: 2 });
    expect(locate("ab\n", 3)).toEqual({ line: 2, column: 1 });
  });
});
