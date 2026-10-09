// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initSnippetFilter } from "../../src/scripts/snippets";

afterEach(() => {
  document.body.innerHTML = "";
  history.replaceState(null, "", "/snippets/");
});

const setup = () => {
  document.body.innerHTML = `
    <div data-snippets data-count-all="3 snippets" data-count-none="No snippets match."
      data-count-one="1 snippet matches." data-count-other="{count} snippets match.">
      <input type="search" data-snippet-query />
      <input type="radio" name="language" value="" checked />
      <input type="radio" name="language" value="ts" />
      <input type="radio" name="language" value="css" />
      <input type="radio" name="tag" value="" checked />
      <input type="radio" name="tag" value="react" />
      <input type="radio" name="tag" value="accessibility" />
      <p data-snippet-status>3 snippets</p>
      <ul>
        <li id="a" data-snippet data-language="ts" data-tags="typescript react" data-text="a typed useeventlistener hook"></li>
        <li id="b" data-snippet data-language="ts" data-tags="typescript" data-text="exhaustive switch statements"></li>
        <li id="c" data-snippet data-language="css" data-tags="css accessibility" data-text="focus rings forced colours"></li>
      </ul>
      <div data-snippet-empty hidden><button type="button" data-snippet-clear>Clear</button></div>
    </div>`;
  initSnippetFilter();
};

const search = () => document.querySelector<HTMLInputElement>("[data-snippet-query]")!;
const status = () => document.querySelector("[data-snippet-status]")!.textContent;
const empty = () => document.querySelector<HTMLElement>("[data-snippet-empty]")!;
const visible = () =>
  [...document.querySelectorAll<HTMLElement>("[data-snippet]")].filter((item) => !item.hidden).map((item) => item.id);
const type = (value: string) => {
  search().value = value;
  search().dispatchEvent(new Event("input", { bubbles: true }));
};
const choose = (name: string, value: string) => {
  const radio = document.querySelector<HTMLInputElement>(`input[name="${name}"][value="${value}"]`)!;
  radio.checked = true;
  radio.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("snippet filter", () => {
  it("does nothing on pages without one", () => {
    expect(() => {
      initSnippetFilter();
    }).not.toThrow();
  });

  it("filters by text, announces the count and records the query in the URL", () => {
    setup();
    expect(status()).toBe("3 snippets");
    type("switch");
    expect(visible()).toEqual(["b"]);
    expect(status()).toBe("1 snippet matches.");
    expect(window.location.search).toBe("?q=switch");
  });

  it("combines language, tag and text", () => {
    setup();
    choose("language", "ts");
    expect(visible()).toEqual(["a", "b"]);
    expect(status()).toBe("2 snippets match.");
    choose("tag", "react");
    expect(visible()).toEqual(["a"]);
    expect(window.location.search).toBe("?language=ts&tag=react");
  });

  it("shows the empty state when nothing matches, and clears every filter", () => {
    setup();
    choose("language", "css");
    type("hook");
    expect(visible()).toEqual([]);
    expect(empty().hidden).toBe(false);
    expect(status()).toBe("No snippets match.");
    document.querySelector<HTMLButtonElement>("[data-snippet-clear]")!.click();
    expect(visible()).toEqual(["a", "b", "c"]);
    expect(empty().hidden).toBe(true);
    expect(search().value).toBe("");
    expect(document.activeElement).toBe(search());
    expect(status()).toBe("3 snippets");
    expect(window.location.search).toBe("");
  });

  it("applies a filter from the URL, ignoring values it doesn't offer", () => {
    history.replaceState(null, "", "/snippets/?q=focus&language=css&tag=nope");
    setup();
    expect(search().value).toBe("focus");
    expect(visible()).toEqual(["c"]);
    expect(document.querySelector<HTMLInputElement>('input[name="tag"][value=""]')!.checked).toBe(true);
  });

  it("only initialises once", () => {
    setup();
    initSnippetFilter();
    type("switch");
    expect(visible()).toEqual(["b"]);
  });
});
