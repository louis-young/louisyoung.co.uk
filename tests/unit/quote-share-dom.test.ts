// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initQuoteShare, quoteContext, quoteText, tighten } from "../../src/scripts/quote-share";

let controller = new AbortController();
let writeText = vi.fn();
let coarse = false;

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: coarse && query.includes("coarse") }));
  Range.prototype.getBoundingClientRect = () => rect(100, 300, 200, 40);
  Range.prototype.getClientRects = () => [rect(100, 300, 200, 20), rect(40, 320, 80, 20)] as unknown as DOMRectList;
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  document.head.innerHTML = `<link rel="canonical" href="https://example.com/post/" />`;
  document.body.innerHTML = `
    <header class="site-header"></header>
    <div class="prose" data-quote-scope>
      <h2 id="intro">Intro<a class="heading-anchor" href="#intro" aria-label="Link to section: Intro"></a></h2>
      <p id="one">React batches state updates so that a render
        sees them together. Read <a href="https://react.dev/" data-external>the docs<span class="visually-hidden"> (opens external site)</span></a> too.</p>
      <p id="two">Second paragraph here.</p>
      <div class="expressive-code"><pre><code id="code">const answer = 42;</code></pre></div>
    </div>
    <p id="outside">Outside the article.</p>
    <p role="status" data-anchor-status></p>
    <p role="status" data-quote-hint data-message="Press Alt+Q"></p>
    <div data-quote-toolbar hidden data-title="A [great] post" data-attribution="— Louis Young, {title}">
      <button type="button" data-quote-action="link" data-done="Link to quote copied">Copy link to quote</button>
      <button type="button" data-quote-action="quote" data-done="Quote copied" tabindex="-1">Copy quote</button>
    </div>`;
  document.querySelector(".site-header")!.getBoundingClientRect = () => rect(0, 0, 1000, 65);
});

afterEach(() => {
  controller.abort();
  controller = new AbortController();
  coarse = false;
  document.getSelection()?.removeAllRanges();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const scope = () => document.querySelector<HTMLElement>("[data-quote-scope]")!;
const toolbar = () => document.querySelector<HTMLElement>("[data-quote-toolbar]")!;
const button = (action: string) => document.querySelector<HTMLButtonElement>(`[data-quote-action="${action}"]`)!;

/** Selects from `start` to `end` (offsets into text nodes) and lets the debounce run. */
const select = (startNode: Node, startOffset: number, endNode: Node, endOffset: number) => {
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  document.dispatchEvent(new Event("selectionchange"));
  vi.advanceTimersByTime(200);
  return range;
};

const text = (selector: string) => document.querySelector(selector)!.firstChild!;

const start = (keyboard = false) => {
  initQuoteShare(scope(), { keyboard, signal: controller.signal });
};

describe("quote context", () => {
  it("reads the text around a selection within one block", () => {
    const node = text("#one");
    const range = document.createRange();
    range.setStart(node, 6);
    range.setEnd(node, 20);
    expect(quoteContext(range, scope())).toMatchObject({
      before: "React ",
      start: "batches state ",
      after: expect.stringMatching(/^updates so that a render\s+sees/u) as unknown,
    });
  });

  it("splits a selection across blocks into its first and last parts", () => {
    const range = document.createRange();
    range.setStart(text("#one"), 0);
    range.setEnd(text("#two"), 6);
    const context = quoteContext(range, scope());
    expect(context.before).toBe("");
    expect(context.start).toContain("React batches");
    expect(context.end).toBe("Second");
    expect(context.after).toBe(" paragraph here.");
  });

  it("treats a selection ending at the start of the next block as one block", () => {
    const range = document.createRange();
    range.setStart(text("#one"), 0);
    range.setEnd(document.querySelector("#two")!, 0);
    expect(quoteContext(range, scope())).toMatchObject({ before: "", after: "" });
    expect(quoteContext(range, scope())).not.toHaveProperty("end");
  });

  it("falls back to the scope for text outside any block", () => {
    scope().append("Loose text");
    const range = document.createRange();
    range.setStart(scope().lastChild!, 0);
    range.setEnd(scope().lastChild!, 5);
    expect(quoteContext(range, scope()).start).toBe("Loose");
  });
});

describe("tighten", () => {
  it("shrinks a triple-click selection to the text it covers", () => {
    const range = document.createRange();
    range.setStart(document.querySelector("#two")!, 0);
    range.setEnd(document.querySelector(".expressive-code")!, 0);
    const tight = tighten(range)!;
    expect(tight.startContainer).toBe(text("#two"));
    expect(tight.endContainer).toBe(text("#two"));
    expect(tight.toString()).toBe("Second paragraph here.");
  });

  it("keeps offsets inside the first and last text nodes", () => {
    const range = document.createRange();
    range.setStart(text("#one"), 6);
    range.setEnd(text("#two"), 6);
    expect(tighten(range)!.toString()).toMatch(/^batches[\s\S]*Second$/u);
  });

  it("returns nothing for whitespace", () => {
    const range = document.createRange();
    const space = document.createTextNode("  ");
    scope().append(space, document.createElement("hr"));
    range.setStart(space, 0);
    range.setEnd(space, 2);
    expect(tighten(range)).toBeUndefined();
    range.setEnd(scope(), scope().childNodes.length);
    expect(tighten(range)).toBeUndefined();
  });
});

describe("quote text", () => {
  it("drops hidden helper text and puts each block on its own line", () => {
    const range = document.createRange();
    range.setStart(text("#one"), 0);
    range.setEnd(text("#two"), 6);
    expect(quoteText(range)).toBe(
      "React batches state updates so that a render sees them together. Read the docs too.\nSecond",
    );
  });
});

describe("quote toolbar", () => {
  it("does nothing without a toolbar", () => {
    toolbar().remove();
    expect(() => {
      start();
    }).not.toThrow();
  });

  it("announces the shortcut when the selection that loaded it was made with the keyboard", () => {
    select(text("#two"), 0, text("#two"), 6);
    start(true);
    vi.advanceTimersByTime(200);
    expect(document.querySelector("[data-quote-hint]")!.textContent).toBe("Press Alt+Q");
  });

  it("appears above a selection in the prose and hides when it collapses", () => {
    start();
    select(text("#one"), 0, text("#one"), 13);
    expect(toolbar().hidden).toBe(false);
    expect(toolbar().dataset["placement"]).toBe("above");
    expect(toolbar().style.getPropertyValue("--arrow-x")).toBe("14px");
    document.getSelection()!.collapse(text("#one"), 0);
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(200);
    expect(toolbar().hidden).toBe(true);
  });

  it("goes below the selection on touch screens and when the header is in the way", () => {
    coarse = true;
    start();
    select(text("#one"), 0, text("#one"), 13);
    expect(toolbar().dataset["placement"]).toBe("below");
    coarse = false;
    Range.prototype.getClientRects = () => [rect(100, 70, 200, 20)] as unknown as DOMRectList;
    window.dispatchEvent(new Event("resize"));
    expect(toolbar().dataset["placement"]).toBe("below");
  });

  it("ignores selections outside the prose, in code, or of only whitespace", () => {
    start();
    select(text("#outside"), 0, text("#outside"), 7);
    expect(toolbar().hidden).toBe(true);
    select(text("#code"), 0, text("#code"), 5);
    expect(toolbar().hidden).toBe(true);
    select(text("#two"), 0, text("#code"), 5);
    expect(toolbar().hidden).toBe(true);
    select(text("#two"), 0, document.querySelector(".expressive-code")!, 0);
    expect(toolbar().hidden).toBe(false);
    const space = document.createTextNode("   ");
    scope().append(space);
    select(space, 0, space, 3);
    expect(toolbar().hidden).toBe(true);
  });

  it("waits for the pointer to lift before following a drag", () => {
    start();
    document.querySelector("#one")!.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    select(text("#one"), 0, text("#one"), 13);
    expect(toolbar().hidden).toBe(true);
    document.dispatchEvent(new Event("pointerup"));
    vi.advanceTimersByTime(200);
    expect(toolbar().hidden).toBe(false);
    document.dispatchEvent(new Event("pointercancel"));
    vi.advanceTimersByTime(200);
    expect(toolbar().hidden).toBe(false);
  });

  it("copies a text-fragment link and announces it", async () => {
    start();
    select(text("#one"), 6, text("#one"), 27);
    toolbar().dispatchEvent(new Event("pointerdown", { bubbles: true, cancelable: true }));
    button("link").click();
    await vi.waitFor(() => {
      expect(button("link").hasAttribute("data-copied")).toBe(true);
    });
    expect(writeText).toHaveBeenCalledWith(
      "https://example.com/post/#:~:text=React-,batches%20state%20updates,-so%20that%20a",
    );
    expect(document.querySelector("[data-anchor-status]")!.textContent).toBe("Link to quote copied");
    expect(toolbar().hidden).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(button("link").hasAttribute("data-copied")).toBe(false);
  });

  it("copies a Markdown quote with attribution", async () => {
    start();
    select(text("#two"), 0, text("#two"), 22);
    button("quote").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalled();
    });
    expect(writeText).toHaveBeenCalledWith(
      [
        "> Second paragraph here.",
        ">",
        "> — Louis Young, [A \\[great\\] post](https://example.com/post/#:~:text=Second%20paragraph%20here.)",
      ].join("\n"),
    );
    expect(document.querySelector("[data-anchor-status]")!.textContent).toBe("Quote copied");
  });

  it("offers the text to copy by hand when the clipboard is unavailable", async () => {
    const prompt = vi.fn();
    vi.stubGlobal("prompt", prompt);
    writeText.mockRejectedValueOnce(new Error("denied"));
    start();
    select(text("#two"), 0, text("#two"), 6);
    button("link").click();
    await vi.waitFor(() => {
      expect(prompt).toHaveBeenCalledWith("", "https://example.com/post/#:~:text=Second,-paragraph%20here.");
    });
    expect(button("link").hasAttribute("data-copied")).toBe(false);
  });

  it("ignores clicks between the buttons", () => {
    start();
    select(text("#two"), 0, text("#two"), 6);
    toolbar().click();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("tells keyboard users how to reach it, and Alt+Q focuses it", () => {
    start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", shiftKey: true }));
    select(text("#two"), 0, text("#two"), 6);
    expect(document.querySelector("[data-quote-hint]")!.textContent).toBe("Press Alt+Q");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "œ", code: "KeyQ", altKey: true, cancelable: true }));
    expect(document.activeElement).toBe(button("link"));
    // Focus moving into the toolbar must not hide it, even if the selection changes.
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(200);
    expect(toolbar().hidden).toBe(false);
  });

  it("moves between its buttons with the arrow keys, Home and End", () => {
    start();
    select(text("#two"), 0, text("#two"), 6);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", altKey: true }));
    const press = (key: string) => {
      document.activeElement!.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
    };
    press("ArrowRight");
    expect(document.activeElement).toBe(button("quote"));
    expect(button("link").tabIndex).toBe(-1);
    press("ArrowRight");
    expect(document.activeElement).toBe(button("link"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(button("quote"));
    press("Home");
    expect(document.activeElement).toBe(button("link"));
    press("End");
    expect(document.activeElement).toBe(button("quote"));
    press("a");
    expect(document.activeElement).toBe(button("quote"));
  });

  it("Escape hides it, returns focus and keeps the selection without reopening", () => {
    const focusable = document.createElement("button");
    scope().append(focusable);
    focusable.focus();
    start();
    const range = select(text("#two"), 0, text("#two"), 6);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toolbar().hidden).toBe(true);
    expect(document.activeElement).toBe(focusable);
    expect(document.getSelection()!.toString()).toBe(range.toString());
    document.dispatchEvent(new Event("selectionchange"));
    vi.advanceTimersByTime(200);
    expect(toolbar().hidden).toBe(true);
    select(text("#two"), 0, text("#two"), 9);
    expect(toolbar().hidden).toBe(false);
  });

  it("Escape blurs the toolbar when nothing was focused before, and is ignored when hidden", () => {
    start();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    select(text("#two"), 0, text("#two"), 6);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", altKey: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(document.activeElement).toBe(document.body);
    expect(toolbar().hidden).toBe(true);
  });

  it("Escape without focus inside just hides it", () => {
    start();
    select(text("#two"), 0, text("#two"), 6);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(toolbar().hidden).toBe(true);
    expect(document.getSelection()!.toString()).toBe("Second");
  });

  it("hides when focus leaves it", () => {
    start();
    select(text("#two"), 0, text("#two"), 6);
    document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ", altKey: true }));
    button("link").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: button("quote") }));
    expect(toolbar().hidden).toBe(false);
    button("link").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: null }));
    expect(toolbar().hidden).toBe(true);
  });

  it("ignores Alt+Q with no selection, and clicks that come with no range", () => {
    start();
    const event = new KeyboardEvent("keydown", { code: "KeyQ", altKey: true, cancelable: true });
    document.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    toolbar().hidden = false;
    button("link").click();
    expect(writeText).not.toHaveBeenCalled();
  });
});
