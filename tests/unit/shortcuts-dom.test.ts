// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initShortcuts, stepList } from "../../src/scripts/shortcuts";

let controller = new AbortController();

afterEach(() => {
  controller.abort();
  controller = new AbortController();
  document.body.innerHTML = "";
});

const press = (key: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

/** Records clicks on a link without letting jsdom try to navigate. */
const watch = (selector: string) => {
  const clicked = vi.fn();
  document.querySelector(selector)!.addEventListener("click", (event) => {
    event.preventDefault();
    clicked();
  });
  return clicked;
};

describe("article shortcuts", () => {
  const setup = () => {
    document.body.innerHTML = `
      <input id="field" />
      <nav><a href="/older/" rel="prev">Older</a><a href="/newer/" rel="next">Newer</a></nav>`;
    initShortcuts(() => undefined, controller.signal);
  };

  it("[ and ] follow the previous and next article links", () => {
    setup();
    const previous = watch("a[rel=prev]");
    const next = watch("a[rel=next]");
    press("[");
    expect(previous).toHaveBeenCalledOnce();
    press("]");
    expect(next).toHaveBeenCalledOnce();
  });

  it("are ignored while typing or with a dialog open", () => {
    setup();
    const next = watch("a[rel=next]");
    press("]", document.querySelector("#field")!);
    document.body.insertAdjacentHTML("beforeend", "<dialog open></dialog>");
    press("]");
    expect(next).not.toHaveBeenCalled();
  });

  it("do nothing on pages without neighbours", () => {
    initShortcuts(() => undefined, controller.signal);
    expect(() => press("[")).not.toThrow();
  });
});

describe("shortcuts help", () => {
  it("? opens the shortcuts dialog, except while typing", () => {
    document.body.innerHTML = `<input id="field" />`;
    const openPalette = vi.fn();
    const openHelp = vi.fn();
    initShortcuts(openPalette, controller.signal, undefined, openHelp);
    press("?", document.querySelector("#field")!);
    expect(openHelp).not.toHaveBeenCalled();
    press("?");
    expect(openHelp).toHaveBeenCalledOnce();
    expect(openPalette).not.toHaveBeenCalled();
  });
});

describe("stepList", () => {
  it("skips rows hidden by a filter", () => {
    Element.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = `
      <a class="article-row__link" href="/a/">A</a>
      <div hidden><a class="article-row__link" href="/b/">B</a></div>
      <a class="article-row__link" href="/c/">C</a>`;
    stepList(1);
    expect(document.activeElement?.textContent).toBe("A");
    stepList(1);
    expect(document.activeElement?.textContent).toBe("C");
  });
});
