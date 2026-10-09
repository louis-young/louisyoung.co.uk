// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PaletteIndex } from "../../src/lib/palette";
import { decodeShareState } from "../../src/lib/share-state";

let controller = new AbortController();

const markup = `
  <button data-palette-open>Open</button>
  <dialog id="palette" data-index="/palette.json" data-count-one="# result" data-count-other="# results">
    <input role="combobox" />
    <button data-palette-close>Esc</button>
    <div role="listbox">
      <div role="none" data-palette-results hidden></div>
      <div role="group" data-group="pages" hidden><div class="palette__options"></div></div>
      <div role="group" data-group="actions" hidden><div class="palette__options"></div></div>
      <div role="group" data-group="work" hidden><div class="palette__options"></div></div>
    </div>
    <p data-palette-loading hidden>Loading pages…</p>
    <div data-palette-error hidden><p>Couldn’t load the pages.</p><button data-palette-retry>Try again</button></div>
    <p data-palette-empty hidden>Nothing</p>
    <p data-palette-status></p>
  </dialog>`;

const index: PaletteIndex = {
  groups: [
    {
      id: "pages",
      options: [
        { title: "Home", href: "/", hint: "/" },
        { title: "Hire", href: "/hire/" },
        { title: "Contrast checker", href: "/tools/contrast/" },
        { title: "Number base converter", href: "/tools/base/" },
      ],
    },
    {
      id: "actions",
      options: [
        { title: "Copy email address", action: "copy", value: "me@example.com", done: "Copied" },
        { title: "Change colour theme", action: "theme" },
        { title: "Search all writing", action: "search" },
        { title: "Download CV", action: "download", href: "/cv.pdf" },
        { title: "Open the terminal", action: "terminal" },
        { title: "Keyboard shortcuts", action: "shortcuts" },
      ],
    },
  ],
  text: {
    answer: "Answer",
    answerName: "Answer: {value}. Press Enter to copy.",
    answerCopy: "Copy",
    answerCopied: "Copied {value}",
    answerCopyFailed: "Couldn’t copy",
    answerOpen: "Open in {tool}",
    answerSwatch: "Colour swatch of {colour}",
  },
  answers: {
    local: "Your time zone",
    iso: "ISO 8601",
    seconds: "Unix seconds",
    hex: "Hex",
    rgb: "RGB",
    hsl: "HSL",
    oklch: "OKLCH",
    onWhite: "On white",
    onBlack: "On black",
    decimal: "Decimal",
    hexadecimal: "Hexadecimal",
    binary: "Binary",
    octal: "Octal",
    nextRun: "Next run",
    cron: {
      at: "At {times}",
      everyMinute: "Every minute",
      everyMinutes: "Every {step} minutes",
      minuteOne: "At minute {list}",
      minuteOther: "At minutes {list}",
      during: "during {list}",
      dayOne: "on day {list} of the month",
      dayOther: "on days {list} of the month",
      months: "in {list}",
      days: "on {list}",
      weekdays: "on weekdays",
      weekends: "at weekends",
      either: "{first} or {second}",
    },
  },
};

const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, status: ok ? 200 : 503, json: () => body } as Response);

describe("command palette (DOM)", () => {
  let assign: ReturnType<typeof vi.fn>;
  let reload: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme-preference");
    window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener: vi.fn() }));
    document.body.innerHTML = markup;
    const dialog = document.querySelector<HTMLDialogElement>("#palette")!;
    dialog.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    dialog.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Element.prototype.scrollIntoView = vi.fn();
    assign = vi.fn();
    reload = vi.fn();
    vi.stubGlobal("location", {
      href: "http://localhost:3000/",
      origin: "http://localhost:3000",
      pathname: "/",
      search: "",
      assign,
      reload,
    });
  });

  afterEach(() => {
    controller.abort();
    controller = new AbortController();
    vi.unstubAllGlobals();
  });

  const dialog = () => document.querySelector<HTMLDialogElement>("#palette")!;
  const input = () => document.querySelector<HTMLInputElement>("[role=combobox]")!;
  const status = () => document.querySelector("[data-palette-status]")!.textContent;
  const key = (value: string, init: KeyboardEventInit = {}) =>
    input().dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true, ...init }));
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event("input"));
  };
  const selected = () => input().getAttribute("aria-activedescendant");
  const click = (id: string) => {
    document.querySelector<HTMLElement>(`#${id}`)!.click();
  };
  /** Opens the palette with the index already loaded. */
  const ready = async (response: Promise<Response> = respond(index)) => {
    const open = (await import("../../src/scripts/palette")).initPalette({
      signal: controller.signal,
      index: response,
    });
    await vi.waitFor(() => {
      expect(document.querySelector("#palette-pages-0")).not.toBeNull();
    });
    return open;
  };
  const answer = () => document.querySelector<HTMLElement>("#palette-answer");

  it("does nothing without the dialog", async () => {
    document.body.innerHTML = "";
    const open = (await import("../../src/scripts/palette")).initPalette();
    expect(() => {
      open();
    }).not.toThrow();
  });

  it("renders the fetched options with DOM APIs, as text", async () => {
    const hostile = structuredClone(index);
    hostile.groups[0]!.options.push({ title: "<img src=x onerror=alert(1)>", href: "/x/" });
    (await ready(respond(hostile)))();
    const option = document.querySelector("#palette-pages-4")!;
    expect(option.textContent).toBe("<img src=x onerror=alert(1)>");
    expect(option.querySelector("img")).toBeNull();
    expect(document.querySelector("#palette-pages-0 .palette__hint")!.getAttribute("aria-hidden")).toBe("true");
    // Groups with options show; the empty one stays hidden.
    expect(document.querySelector<HTMLElement>('[data-group="pages"]')!.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('[data-group="work"]')!.hidden).toBe(true);
  });

  it("fetches the index itself when not handed one", async () => {
    const fetch = vi.fn(() => respond(index));
    vi.stubGlobal("fetch", fetch);
    (await import("../../src/scripts/palette")).initPalette({ signal: controller.signal })();
    await vi.waitFor(() => {
      expect(selected()).toBe("palette-pages-0");
    });
    expect(fetch).toHaveBeenCalledWith("/palette.json");
  });

  it("opens, highlights the first option and wraps with the arrow keys", async () => {
    (await ready())();
    expect(dialog().open).toBe(true);
    expect(selected()).toBe("palette-pages-0");
    key("ArrowUp");
    expect(selected()).toBe("palette-actions-5");
    key("ArrowDown");
    expect(selected()).toBe("palette-pages-0");
    key("End");
    expect(selected()).toBe("palette-actions-5");
    key("Home");
    expect(selected()).toBe("palette-pages-0");
    key("Tab");
    expect(selected()).toBe("palette-pages-0");
  });

  it("ranks matches into one list and navigates on Enter", async () => {
    (await ready())();
    type("hire");
    const results = document.querySelector<HTMLElement>("[data-palette-results]")!;
    expect(results.hidden).toBe(false);
    expect(results.firstElementChild?.id).toBe("palette-pages-1");
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/hire/");
    expect(dialog().open).toBe(false);
  });

  it("restores the groups when the query is cleared", async () => {
    (await ready())();
    type("theme");
    type("");
    expect(document.querySelector<HTMLElement>("[data-palette-results]")!.hidden).toBe(true);
    expect(document.querySelector("#palette-actions-1")!.parentElement?.className).toBe("palette__options");
  });

  it("announces how many options match", async () => {
    (await ready())();
    type("hire");
    expect(status()).toBe("1 result");
    type("e");
    expect(status()).toMatch(/^\d+ results$/u);
  });

  it("falls back to full-text search when nothing matches", async () => {
    (await ready())();
    type("zzzz");
    expect(document.querySelector<HTMLElement>("[data-palette-empty]")!.hidden).toBe(false);
    expect(selected()).toBeNull();
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/search/?q=zzzz");
  });

  it("runs actions: theme, search and copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const open = await ready();
    open();
    click("palette-actions-1");
    expect(document.documentElement.dataset["themePreference"]).toBe("light");
    open();
    type("search");
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/search/?q=search");
    type("");
    click("palette-actions-2");
    expect(assign).toHaveBeenLastCalledWith("/search/");
    click("palette-actions-0");
    await vi.waitFor(() => {
      expect(status()).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("me@example.com");
  });

  it("hands the terminal and shortcuts actions to their dialogs", async () => {
    const events: string[] = [];
    for (const name of ["terminal:open", "shortcuts:open"]) {
      document.addEventListener(name, () => events.push(name), { signal: controller.signal });
    }
    const open = await ready();
    open();
    click("palette-actions-4");
    expect(dialog().open).toBe(false);
    open();
    click("palette-actions-5");
    expect(dialog().open).toBe(false);
    expect(events).toEqual(["terminal:open", "shortcuts:open"]);
  });

  it("opens mail when the clipboard is unavailable, and downloads files", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    (await ready())();
    click("palette-actions-0");
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith("mailto:me%40example.com");
    });
    click("palette-actions-3");
    expect(anchorClick).toHaveBeenCalled();
    anchorClick.mockRestore();
  });

  it("highlights on hover and closes on a backdrop click or the close button", async () => {
    const open = await ready();
    open();
    document.querySelector("#palette-pages-1")!.dispatchEvent(new Event("pointermove", { bubbles: true }));
    expect(selected()).toBe("palette-pages-1");
    dialog().click();
    expect(dialog().open).toBe(false);
    open();
    open();
    expect(dialog().hasAttribute("open")).toBe(true);
    document.querySelector<HTMLButtonElement>("[data-palette-close]")!.click();
    expect(dialog().open).toBe(false);
  });

  it("shows a loading state, then applies keys pressed while loading", async () => {
    let resolve: (response: Response) => void = () => undefined;
    const response = new Promise<Response>((done) => {
      resolve = done;
    });
    const open = (await import("../../src/scripts/palette")).initPalette({
      signal: controller.signal,
      index: response,
    });
    open();
    const loading = document.querySelector<HTMLElement>("[data-palette-loading]")!;
    expect(loading.hidden).toBe(false);
    expect(document.querySelector("[role=listbox]")!.hasAttribute("aria-busy")).toBe(true);
    expect(status()).toBe("Loading pages…");
    expect(document.querySelector<HTMLElement>("[data-palette-empty]")!.hidden).toBe(true);
    type("hire");
    key("Enter");
    expect(assign).not.toHaveBeenCalled();
    resolve({ ok: true, status: 200, json: () => index } as unknown as Response);
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith("/hire/");
    });
    expect(loading.hidden).toBe(true);
    expect(document.querySelector("[role=listbox]")!.hasAttribute("aria-busy")).toBe(false);
  });

  it.each([
    ["the request fails", () => Promise.reject(new TypeError("offline"))],
    ["the server errors", () => respond({}, false)],
    ["the index is malformed", () => respond({ groups: "nope" })],
  ])("shows an error with a retry when %s", async (_name, failing) => {
    const response = failing();
    const fetch = vi.fn(() => respond(index));
    vi.stubGlobal("fetch", fetch);
    const open = (await import("../../src/scripts/palette")).initPalette({
      signal: controller.signal,
      index: response,
    });
    open();
    const error = document.querySelector<HTMLElement>("[data-palette-error]")!;
    await vi.waitFor(() => {
      expect(error.hidden).toBe(false);
    });
    expect(status()).toBe("Couldn’t load the pages.");
    expect(document.querySelector("[role=option]")).toBeNull();
    key("Enter");
    expect(assign).not.toHaveBeenCalled();
    document.querySelector<HTMLButtonElement>("[data-palette-retry]")!.click();
    expect(document.activeElement).toBe(input());
    await vi.waitFor(() => {
      expect(selected()).toBe("palette-pages-0");
    });
    expect(error.hidden).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("tries again when reopened after a failure", async () => {
    const fetch = vi.fn(() => respond(index));
    vi.stubGlobal("fetch", fetch);
    const open = (await import("../../src/scripts/palette")).initPalette({
      signal: controller.signal,
      index: respond({}, false),
    });
    await vi.waitFor(() => {
      expect(document.querySelector<HTMLElement>("[data-palette-error]")!.hidden).toBe(false);
    });
    open();
    await vi.waitFor(() => {
      expect(selected()).toBe("palette-pages-0");
    });
  });

  describe("quick answers", () => {
    it("adds no answer for plain words", async () => {
      (await ready())();
      type("hire");
      await new Promise((done) => setTimeout(done, 20));
      expect(answer()).toBeNull();
      expect(status()).toBe("1 result");
    });

    it("puts the answer first, announces it and copies it on Enter", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      (await ready())();
      type("2^10");
      await vi.waitFor(() => {
        expect(answer()).not.toBeNull();
      });
      expect(answer()!.getAttribute("aria-label")).toBe("Answer: 1,024. Press Enter to copy.");
      expect(answer()!.getAttribute("role")).toBe("option");
      expect(selected()).toBe("palette-answer");
      expect(status()).toBe("Answer: 1,024. Press Enter to copy. 0 results");
      // Arithmetic has no tool, so the answer stands alone.
      expect(document.querySelector("#palette-answer-tool")).toBeNull();
      key("Enter");
      await vi.waitFor(() => {
        expect(status()).toBe("Copied 1024");
      });
      expect(writeText).toHaveBeenCalledWith("1024");
      expect(answer()!.querySelector(".palette__hint")!.textContent).toBe("↵✓");
      expect(dialog().open).toBe(true);
    });

    it("says so when copying fails", async () => {
      vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
      (await ready())();
      type("0xff");
      await vi.waitFor(() => {
        expect(answer()).not.toBeNull();
      });
      click("palette-answer");
      await vi.waitFor(() => {
        expect(status()).toBe("Couldn’t copy");
      });
    });

    it("shows a colour with a described swatch, and opens the contrast checker prefilled", async () => {
      (await ready())();
      type("#7c6cf0");
      await vi.waitFor(() => {
        expect(answer()).not.toBeNull();
      });
      const swatch = answer()!.querySelector<HTMLElement>(".palette__swatch")!;
      expect(swatch.getAttribute("role")).toBe("img");
      expect(swatch.getAttribute("aria-label")).toBe("Colour swatch of #7c6cf0");
      expect(swatch.style.backgroundColor).toBe("rgb(124, 108, 240)");
      const description = document.getElementById(answer()!.getAttribute("aria-describedby")!)!;
      expect(description.textContent).toContain("Colour swatch of #7c6cf0.");
      expect(description.textContent).toContain("On white:");
      expect(answer()!.querySelector(".palette__answer-details")!.getAttribute("aria-hidden")).toBe("true");
      const tool = document.querySelector("#palette-answer-tool")!;
      expect(tool.textContent).toContain("Open in Contrast checker");
      key("ArrowDown");
      expect(selected()).toBe("palette-answer-tool");
      key("Enter");
      const href = assign.mock.calls[0]![0] as string;
      expect(href.startsWith("/tools/contrast/#s=")).toBe(true);
      expect(decodeShareState(href.slice(href.indexOf("#")))).toEqual({
        foreground: "#7c6cf0",
        background: "#000000",
      });
      expect(reload).not.toHaveBeenCalled();
    });

    it("opens the tool with ⌘/Ctrl+Enter on the answer, reloading when only the fragment changes", async () => {
      vi.stubGlobal("location", {
        href: "http://localhost:3000/tools/contrast/",
        origin: "http://localhost:3000",
        pathname: "/tools/contrast/",
        search: "",
        assign,
        reload,
      });
      (await ready())();
      type("rgb(0 0 0)");
      await vi.waitFor(() => {
        expect(answer()).not.toBeNull();
      });
      key("Enter", { ctrlKey: true });
      expect(assign.mock.calls[0]![0]).toMatch(/^\/tools\/contrast\/#s=/u);
      expect(reload).toHaveBeenCalled();
    });

    it("keeps the UUID while the selection moves, and makes one without randomUUID", async () => {
      vi.stubGlobal("crypto", { getRandomValues: (bytes: Uint8Array) => bytes.fill(255) });
      (await ready())();
      type("uuid");
      await vi.waitFor(() => {
        expect(answer()).not.toBeNull();
      });
      const value = () => answer()!.querySelector(".palette__answer-value")!.textContent;
      expect(value()).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
      const element = answer();
      key("ArrowDown");
      key("ArrowUp");
      expect(answer()).toBe(element);
      expect(selected()).toBe("palette-answer");
      // The hash tool isn't in this index, so there's no way in.
      expect(document.querySelector("#palette-answer-tool")).toBeNull();
    });

    it("drops a stale answer once the query moves on", async () => {
      (await ready())();
      type("1+1");
      type("hire");
      await new Promise((done) => setTimeout(done, 20));
      expect(answer()).toBeNull();
      expect(status()).toBe("1 result");
    });
  });
});
