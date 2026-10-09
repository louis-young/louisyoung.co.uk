// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { searchText } from "../../src/lib/snippet-filter";
import { initToolsIndex } from "../../src/scripts/tools-index";

afterEach(() => {
  document.body.innerHTML = "";
});

const card = (slug: string, category: string, ...fields: string[]) =>
  `<li data-tool="${slug}" data-category="${category}" data-text="${searchText(fields)}"><a href="/tools/${slug}/">${slug}</a></li>`;

const setup = () => {
  document.body.innerHTML = `
    <div data-tools data-count-all="All 3 tools" data-count-none="No tools match."
      data-count-one="1 tool matches." data-count-other="{count} tools match.">
      <input type="search" data-tools-query />
      <input type="radio" name="category" value="" checked />
      <input type="radio" name="category" value="colour" />
      <input type="radio" name="category" value="text" />
      <p data-tools-status>All 3 tools</p>
      <section data-recent><ul data-recent-list><li>json</li></ul></section>
      <section data-tool-group="colour"><ul>
        ${card("contrast", "colour", "Contrast checker", "wcag")}
        ${card("colour", "colour", "Colour palette", "hex rgb")}
      </ul></section>
      <section data-tool-group="text"><ul>${card("json", "text", "JSON formatter", "validate")}</ul></section>
      <div data-tools-empty hidden><button type="button" data-tools-clear>Clear</button></div>
    </div>`;
  initToolsIndex();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
  return {
    search: field("[data-tools-query]"),
    status: get("[data-tools-status]"),
    empty: get("[data-tools-empty]"),
    recent: get("[data-recent]"),
    group: (id: string) => get(`[data-tool-group="${id}"]`),
    tool: (slug: string) => get(`[data-tool="${slug}"]`),
    chip: (value: string) => field(`input[name="category"][value="${value}"]`),
  };
};

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

const pick = (chip: HTMLInputElement) => {
  chip.checked = true;
  chip.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("tools index filter", () => {
  it("starts with everything shown", () => {
    const view = setup();
    expect(view.status.textContent).toBe("All 3 tools");
    expect(view.empty.hidden).toBe(true);
    expect(view.recent.hasAttribute("data-suppressed")).toBe(false);
  });

  it("filters by search words, hides empty groups and announces the count", () => {
    const view = setup();
    type(view.search, "wcag");
    expect(view.tool("contrast").hidden).toBe(false);
    expect(view.tool("colour").hidden).toBe(true);
    expect(view.group("text").hidden).toBe(true);
    expect(view.status.textContent).toBe("1 tool matches.");
    expect(view.recent.hasAttribute("data-suppressed")).toBe(true);
    type(view.search, "o");
    expect(view.status.textContent).toBe("3 tools match.");
  });

  it("filters by category chip and combines it with the search", () => {
    const view = setup();
    pick(view.chip("colour"));
    expect(view.status.textContent).toBe("2 tools match.");
    expect(view.group("text").hidden).toBe(true);
    type(view.search, "json");
    expect(view.status.textContent).toBe("No tools match.");
    expect(view.empty.hidden).toBe(false);
  });

  it("clears both filters from the empty state", () => {
    const view = setup();
    pick(view.chip("text"));
    type(view.search, "nothing at all");
    document.querySelector<HTMLButtonElement>("[data-tools-clear]")!.click();
    expect(view.search.value).toBe("");
    expect(view.chip("").checked).toBe(true);
    expect(view.status.textContent).toBe("All 3 tools");
    expect(document.activeElement).toBe(view.search);
  });

  it("applies whatever was typed before it loaded, and only starts once", () => {
    document.body.innerHTML = "";
    const view = setup();
    view.search.value = "json";
    initToolsIndex();
    expect(view.status.textContent).toBe("All 3 tools");
    document.querySelector("[data-tools]")!.removeAttribute("data-ready");
    initToolsIndex();
    expect(view.status.textContent).toBe("1 tool matches.");
  });

  it("does nothing on other pages", () => {
    expect(() => {
      initToolsIndex();
    }).not.toThrow();
  });
});
