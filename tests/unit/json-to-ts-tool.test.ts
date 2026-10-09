import { describe, expect, it } from "vitest";

import {
  generateTypes,
  jsonToTypes,
  pascalCase,
  propertyKey,
  singular,
  type TypeOptions,
} from "../../src/lib/json-to-ts-tool";

const options: TypeOptions = { rootName: "Root", style: "interface", readonly: false, export: false };
const types = (value: unknown, overrides: Partial<TypeOptions> = {}) =>
  generateTypes(value, { ...options, ...overrides }).join("\n\n");

describe("names", () => {
  it.each([
    ["user", "User"],
    ["first_name", "FirstName"],
    ["first-name", "FirstName"],
    ["userID", "UserId"],
    ["HTTPStatus", "HttpStatus"],
    ["2fa", "T2fa"],
    ["café au lait", "CaféAuLait"],
    ["$$$", ""],
  ])("PascalCases %j as %j", (key, name) => {
    expect(pascalCase(key)).toBe(name);
  });

  it.each([
    ["Users", "User"],
    ["Categories", "Category"],
    ["Addresses", "Address"],
    ["Boxes", "Box"],
    ["Matches", "Match"],
    ["Wishes", "Wish"],
    ["Data", "DataItem"],
    ["Status", "StatusItem"],
    ["Class", "ClassItem"],
    ["Bus", "BusItem"],
    ["Ids", "IdsItem"],
    ["Keys", "Key"],
    ["Days", "Day"],
  ])("names one of %s %s", (list, item) => {
    expect(singular(list)).toBe(item);
  });

  it("quotes keys that aren’t identifiers", () => {
    expect(propertyKey("id")).toBe("id");
    expect(propertyKey("$ref")).toBe("$ref");
    expect(propertyKey("_private")).toBe("_private");
    expect(propertyKey("naïve")).toBe("naïve");
    expect(propertyKey("class")).toBe("class");
    expect(propertyKey("first-name")).toBe('"first-name"');
    expect(propertyKey("2fa")).toBe('"2fa"');
    expect(propertyKey("")).toBe('""');
    expect(propertyKey('say "hi"')).toBe(String.raw`"say \"hi\""`);
    expect(propertyKey("a b")).toBe('"a b"');
  });
});

describe("generateTypes", () => {
  it("types primitives, nulls and nested objects as named interfaces", () => {
    expect(types({ id: 1, name: "Ada", admin: false, manager: null, address: { city: "London", zip: null } })).toBe(
      [
        "interface Root {",
        "  id: number;",
        "  name: string;",
        "  admin: boolean;",
        "  manager: null;",
        "  address: Address;",
        "}",
        "",
        "interface Address {",
        "  city: string;",
        "  zip: null;",
        "}",
      ].join("\n"),
    );
  });

  it("merges objects in an array, making missing keys optional", () => {
    expect(
      types({
        users: [
          { id: 1, name: "a" },
          { id: 2, email: null },
          { id: 3, email: "c", name: null },
        ],
      }),
    ).toBe(
      [
        "interface Root {",
        "  users: User[];",
        "}",
        "",
        "interface User {",
        "  id: number;",
        "  name?: string | null;",
        "  email?: string | null;",
        "}",
      ].join("\n"),
    );
  });

  it("unions an array’s element types", () => {
    expect(types({ mixed: [1, "a", null, true, [1], { a: 1 }], empty: [], nested: [[1], ["a"], []] })).toBe(
      [
        "interface Root {",
        "  mixed: (string | number | boolean | MixedItem | number[] | null)[];",
        "  empty: unknown[];",
        "  nested: (string | number)[][];",
        "}",
        "",
        "interface MixedItem {",
        "  a: number;",
        "}",
      ].join("\n"),
    );
  });

  it("deduplicates names, reusing an identical shape under the same name", () => {
    expect(
      types({
        home: { address: { city: "a" } },
        work: { address: { city: "b" } },
        old: { address: { street: "c" } },
        root: { x: 1 },
      }),
    ).toBe(
      [
        "interface Root {",
        "  home: Home;",
        "  work: Work;",
        "  old: Old;",
        "  root: Root2;",
        "}",
        "",
        "interface Home {",
        "  address: Address;",
        "}",
        "",
        "interface Address {",
        "  city: string;",
        "}",
        "",
        "interface Work {",
        "  address: Address;",
        "}",
        "",
        "interface Old {",
        "  address: Address2;",
        "}",
        "",
        "interface Address2 {",
        "  street: string;",
        "}",
        "",
        "interface Root2 {",
        "  x: number;",
        "}",
      ].join("\n"),
    );
  });

  it("quotes awkward keys and names awkward children", () => {
    expect(types({ "first-name": "a", "2fa": { on: true }, "!!": { x: 1 } })).toBe(
      [
        "interface Root {",
        '  "first-name": string;',
        '  "2fa": T2fa;',
        '  "!!": Field;',
        "}",
        "",
        "interface T2fa {",
        "  on: boolean;",
        "}",
        "",
        "interface Field {",
        "  x: number;",
        "}",
      ].join("\n"),
    );
  });

  it("supports type aliases, readonly and export", () => {
    expect(types({ tags: ["a"], grid: [[1]], point: { x: 1 } }, { style: "type", readonly: true, export: true })).toBe(
      [
        "export type Root = {",
        "  readonly tags: readonly string[];",
        "  readonly grid: readonly (readonly number[])[];",
        "  readonly point: Point;",
        "};",
        "",
        "export type Point = {",
        "  readonly x: number;",
        "};",
      ].join("\n"),
    );
  });

  it("aliases a root that isn’t an object", () => {
    expect(types([{ id: 1 }, { id: 2 }], { rootName: "users" })).toBe(
      "type Users = User[];\n\ninterface User {\n  id: number;\n}",
    );
    expect(types("text")).toBe("type Root = string;");
    expect(types(null)).toBe("type Root = null;");
    expect(types([])).toBe("type Root = unknown[];");
    expect(types({})).toBe("type Root = Record<string, unknown>;");
    expect(types({ meta: {} })).toBe("interface Root {\n  meta: Record<string, unknown>;\n}");
    expect(types([1, null], { readonly: true })).toBe("type Root = readonly (number | null)[];");
  });

  it("falls back to Root for a root name with no letters", () => {
    expect(types(1, { rootName: " -- " })).toBe("type Root = number;");
    expect(types(1, { rootName: "api response" })).toBe("type ApiResponse = number;");
  });

  it("treats __proto__ as an ordinary key", () => {
    expect(types(JSON.parse('{"__proto__": {"a": 1}}'))).toBe(
      "interface Root {\n  __proto__: Proto;\n}\n\ninterface Proto {\n  a: number;\n}",
    );
  });
});

describe("jsonToTypes", () => {
  it("parses JSON and counts declarations", () => {
    expect(jsonToTypes('{"a": {"b": 1}}', { ...options, export: true })).toEqual({
      output: "export interface Root {\n  a: A;\n}\n\nexport interface A {\n  b: number;\n}\n",
      count: 2,
    });
  });

  it("returns nothing for empty input", () => {
    expect(jsonToTypes("  ", options)).toEqual({ output: "", count: 0 });
  });

  it("reports where the JSON goes wrong", () => {
    expect(jsonToTypes('{\n  "a": 1,\n}', options)).toEqual({
      error: { reason: "token", line: 3, column: 1, token: "}" },
    });
  });
});
