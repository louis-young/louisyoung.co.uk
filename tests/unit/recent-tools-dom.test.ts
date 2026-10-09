// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { RECENT_KEY } from "../../src/lib/recent-tools";
import { initRecentTools, recordToolVisit } from "../../src/scripts/recent-tools";

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  vi.restoreAllMocks();
});

const card = (slug: string, icon: string, title: string) => `
  <li data-tool="${slug}">
    <span data-tool-icon>${icon}</span>
    <h3><a href="/tools/${slug}/" data-tool-link>${title}</a></h3>
  </li>`;

const page = () => {
  document.body.innerHTML = `
    <section data-recent hidden><ul data-recent-list></ul></section>
    <ul>${card("json", "{ }", "JSON formatter")}${card("regex", ".*", "Regex tester")}${card("cron", "*/5", "Cron")}</ul>`;
  return document.querySelector<HTMLElement>("[data-recent]")!;
};

describe("recently used tools", () => {
  it("records visits newest first", () => {
    recordToolVisit("json");
    recordToolVisit("regex");
    recordToolVisit("json");
    expect(JSON.parse(localStorage.getItem(RECENT_KEY)!)).toEqual(["json", "regex"]);
  });

  it("shows recent tools as links built from the cards, as text", () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify(["regex", "gone", "json"]));
    const section = page();
    initRecentTools();
    expect(section.hidden).toBe(false);
    const links = [...section.querySelectorAll("a")];
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/tools/regex/", "/tools/json/"]);
    expect(links.map((link) => link.textContent)).toEqual([".*Regex tester", "{ }JSON formatter"]);
    expect(section.querySelector(".recent__icon")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("stays hidden with nothing stored", () => {
    const section = page();
    initRecentTools();
    expect(section.hidden).toBe(true);
  });

  it("stays hidden, and records nothing, when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const section = page();
    expect(() => {
      recordToolVisit("json");
      initRecentTools();
    }).not.toThrow();
    expect(section.hidden).toBe(true);
  });

  it("does nothing on pages without the row", () => {
    expect(() => {
      initRecentTools();
    }).not.toThrow();
  });
});
