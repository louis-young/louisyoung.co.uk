import { describe, expect, it } from "vitest";

import { useTranslations } from "../../src/i18n";
import { httpStatuses, matchesStatus, statusClass, statusClasses } from "../../src/lib/http-status-tool";

const t = useTranslations();

describe("httpStatuses", () => {
  it("lists each code once, in order, in one of the five classes", () => {
    const codes = httpStatuses.map((status) => status.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes).toEqual([...codes].sort((a, b) => a - b));
    for (const code of codes) expect(statusClasses).toContain(statusClass(code));
    expect(codes).toEqual(expect.arrayContaining([100, 103, 200, 204, 301, 308, 404, 418, 422, 429, 451, 500, 511]));
  });

  it("gives every code a name, a meaning and when to use it", () => {
    for (const status of httpStatuses) {
      expect(status.name.length, String(status.code)).toBeGreaterThan(1);
      expect(t(status.meaning), String(status.code)).toMatch(/\.$/u);
      expect(t(status.use), String(status.code)).toMatch(/\.$/u);
    }
  });
});

describe("statusClass", () => {
  it("reads the first digit", () => {
    expect(statusClass(101)).toBe(1);
    expect(statusClass(299)).toBe(2);
    expect(statusClass(511)).toBe(5);
  });
});

describe("matchesStatus", () => {
  const notFound = "Not Found The server has nothing at this URL.";

  it("matches everything when the search is blank", () => {
    expect(matchesStatus("", 404, notFound)).toBe(true);
    expect(matchesStatus("   ", 500, "")).toBe(true);
  });

  it("matches numbers as code prefixes", () => {
    expect(matchesStatus("4", 404, notFound)).toBe(true);
    expect(matchesStatus("40", 404, notFound)).toBe(true);
    expect(matchesStatus("404", 404, notFound)).toBe(true);
    expect(matchesStatus("41", 404, notFound)).toBe(false);
    expect(matchesStatus("04", 404, notFound)).toBe(false);
  });

  it("matches a whole class written as 4xx", () => {
    expect(matchesStatus("4xx", 404, notFound)).toBe(true);
    expect(matchesStatus("4XX", 404, notFound)).toBe(true);
    expect(matchesStatus("5xx", 404, notFound)).toBe(false);
  });

  it("needs every word, in any case, with either apostrophe", () => {
    expect(matchesStatus("not found", 404, notFound)).toBe(true);
    expect(matchesStatus("URL nothing", 404, notFound)).toBe(true);
    expect(matchesStatus("found gone", 404, notFound)).toBe(false);
    expect(matchesStatus("4xx url", 404, notFound)).toBe(true);
    expect(matchesStatus("i'm", 418, "I’m a teapot")).toBe(true);
    expect(matchesStatus("I’m", 418, "I'm a teapot")).toBe(true);
  });
});
