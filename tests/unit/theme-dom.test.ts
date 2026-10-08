// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const listeners = new Set<() => void>();
let controller = new AbortController();

afterEach(() => {
  controller.abort();
  controller = new AbortController();
});
let systemDark = false;

const mockMatchMedia = () => {
  window.matchMedia = vi.fn().mockImplementation(() => ({
    get matches() {
      return systemDark;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
  }));
};

const toggleMarkup = `<button data-theme-toggle data-label-system="Theme: System" data-label-light="Theme: Light" data-label-dark="Theme: Dark"></button>`;

describe("theme (DOM)", () => {
  beforeEach(() => {
    vi.resetModules();
    listeners.clear();
    systemDark = false;
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.body.innerHTML = toggleMarkup;
    mockMatchMedia();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const load = () => import("../../src/scripts/theme");
  const root = document.documentElement;
  const button = () => document.querySelector<HTMLButtonElement>("[data-theme-toggle]")!;

  it("announces the new theme when it changes", async () => {
    document.body.insertAdjacentHTML("beforeend", '<p role="status" data-theme-status></p>');
    const { cycleTheme, initTheme } = await import("../../src/scripts/theme");
    initTheme(controller.signal);
    cycleTheme();
    expect(document.querySelector("[data-theme-status]")!.textContent).toBe("Theme: Light");
  });

  it("applies the stored preference and labels the toggle", async () => {
    localStorage.setItem("theme", "dark");
    (await load()).initTheme(controller.signal);
    expect(root.dataset["theme"]).toBe("dark");
    expect(root.dataset["themePreference"]).toBe("dark");
    expect(button().getAttribute("aria-label")).toBe("Theme: Dark");
    expect(button().title).toBe("Theme: Dark");
  });

  it("cycles on click and stores only explicit choices", async () => {
    (await load()).initTheme(controller.signal);
    button().click();
    expect(root.dataset["themePreference"]).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    button().click();
    expect(root.dataset["theme"]).toBe("dark");
    button().click();
    expect(root.dataset["themePreference"]).toBe("system");
    expect(localStorage.getItem("theme")).toBeNull();
  });

  it("follows system changes while on the system preference", async () => {
    (await load()).initTheme(controller.signal);
    expect(root.dataset["theme"]).toBe("light");
    systemDark = true;
    for (const listener of listeners) listener();
    expect(root.dataset["theme"]).toBe("dark");
  });

  it("syncs with other tabs", async () => {
    (await load()).initTheme(controller.signal);
    window.dispatchEvent(new StorageEvent("storage", { key: "theme", newValue: "dark" }));
    expect(root.dataset["theme"]).toBe("dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "other", newValue: "light" }));
    expect(root.dataset["theme"]).toBe("dark");
  });

  it("keeps working when storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const theme = await load();
    theme.initTheme(controller.signal);
    expect(root.dataset["theme"]).toBe("light");
    theme.cycleTheme();
    expect(root.dataset["theme"]).toBe("light");
    expect(root.dataset["themePreference"]).toBe("light");
  });
});

describe("shortcuts (DOM)", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    document.documentElement.removeAttribute("data-grid");
    mockMatchMedia();
    document.body.innerHTML = `${toggleMarkup}<input id="field" /><dialog id="other"></dialog>`;
  });

  const press = (key: string, target: EventTarget = document.body, init: KeyboardEventInit = {}) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));

  it("opens the palette with ?, ⌘K and Ctrl+K", async () => {
    const open = vi.fn();
    (await import("../../src/scripts/shortcuts")).initShortcuts(open, controller.signal);
    press("?");
    press("k", document.body, { metaKey: true });
    press("K", document.querySelector("#field")!, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(3);
  });

  it("cycles the theme with t", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(vi.fn(), controller.signal);
    press("t");
    expect(document.documentElement.dataset["themePreference"]).toBe("light");
  });

  it("focuses an on-page search input with /, otherwise opens the palette", async () => {
    const open = vi.fn();
    (await import("../../src/scripts/shortcuts")).initShortcuts(open, controller.signal);
    press("/");
    expect(open).toHaveBeenCalledOnce();
    document.body.insertAdjacentHTML("beforeend", '<input class="pagefind-ui__search-input" />');
    press("/");
    expect(document.activeElement?.className).toBe("pagefind-ui__search-input");
    expect(open).toHaveBeenCalledOnce();
  });

  it("steps through list rows with j and k", async () => {
    Element.prototype.scrollIntoView = vi.fn();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<a class="article-row__link" href="/a/">A</a><a class="work-row__link" href="/b/">B</a>',
    );
    (await import("../../src/scripts/shortcuts")).initShortcuts(vi.fn(), controller.signal);
    press("j");
    expect(document.activeElement?.textContent).toBe("A");
    press("j");
    press("j");
    expect(document.activeElement?.textContent).toBe("B");
    press("k");
    expect(document.activeElement?.textContent).toBe("A");
  });

  it("does nothing with j when there are no rows", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(vi.fn(), controller.signal);
    expect(() => press("j")).not.toThrow();
  });

  it("ignores single keys typed into fields and while a dialog is open", async () => {
    const open = vi.fn();
    (await import("../../src/scripts/shortcuts")).initShortcuts(open, controller.signal);
    press("t", document.querySelector("#field")!);
    expect(document.documentElement.dataset["themePreference"]).toBeUndefined();
    document.querySelector("#other")!.setAttribute("open", "");
    press("t");
    press("?");
    expect(document.documentElement.dataset["themePreference"]).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });
});

const paletteMarkup = `
  <button data-palette-open>Open</button>
  <dialog id="palette" data-count-one="# result" data-count-other="# results">
    <input role="combobox" />
    <button data-palette-close>Esc</button>
    <div role="listbox">
      <div role="none" data-palette-results hidden></div>
      <div role="group" data-group="pages"><div class="palette__options">
        <div role="option" id="o1" data-group="pages" data-title="Home" data-href="/">Home</div>
        <div role="option" id="o2" data-group="pages" data-title="Hire" data-href="/hire/">Hire</div>
      </div></div>
      <div role="group" data-group="actions"><div class="palette__options">
        <div role="option" id="o3" data-group="actions" data-title="Copy email address" data-action="copy" data-value="me@example.com" data-done="Copied">Copy</div>
        <div role="option" id="o4" data-group="actions" data-title="Change colour theme" data-action="theme">Theme</div>
        <div role="option" id="o5" data-group="actions" data-title="Search all writing" data-action="search">Search</div>
        <div role="option" id="o6" data-group="actions" data-title="Download CV" data-action="download" data-href="/cv.pdf">CV</div>
        <div role="option" id="o7" data-group="actions" data-title="Show the layout grid" data-action="grid">Grid</div>
      </div></div>
    </div>
    <p data-palette-empty hidden>Nothing</p>
    <p data-palette-status></p>
  </dialog>`;

describe("command palette (DOM)", () => {
  let assign: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme-preference");
    document.documentElement.removeAttribute("data-grid");
    mockMatchMedia();
    document.body.innerHTML = toggleMarkup + paletteMarkup;
    const dialog = document.querySelector<HTMLDialogElement>("#palette")!;
    dialog.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    dialog.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
    Element.prototype.scrollIntoView = vi.fn();
    assign = vi.fn();
    vi.stubGlobal("location", { href: window.location.href, origin: window.location.origin, assign });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const dialog = () => document.querySelector<HTMLDialogElement>("#palette")!;
  const input = () => document.querySelector<HTMLInputElement>("[role=combobox]")!;
  const key = (value: string) =>
    input().dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, cancelable: true }));
  const type = (value: string) => {
    input().value = value;
    input().dispatchEvent(new Event("input"));
  };
  const selected = () => input().getAttribute("aria-activedescendant");
  const init = async () => (await import("../../src/scripts/palette")).initPalette(controller.signal);

  it("does nothing without the dialog", async () => {
    document.body.innerHTML = "";
    const open = await init();
    expect(() => {
      open();
    }).not.toThrow();
  });

  it("opens from a button, highlights the first option and wraps with the arrow keys", async () => {
    (await init())();
    expect(dialog().open).toBe(true);
    expect(selected()).toBe("o1");
    key("ArrowUp");
    expect(selected()).toBe("o7");
    key("ArrowDown");
    expect(selected()).toBe("o1");
    key("End");
    expect(selected()).toBe("o7");
    key("Home");
    expect(selected()).toBe("o1");
  });

  it("ranks matches into one list and navigates on Enter", async () => {
    const open = await init();
    open();
    type("hire");
    const results = document.querySelector("[data-palette-results]")!;
    expect(results.hasAttribute("hidden")).toBe(false);
    expect(results.firstElementChild?.id).toBe("o2");
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/hire/");
    expect(dialog().open).toBe(false);
  });

  it("restores the groups when the query is cleared", async () => {
    const open = await init();
    open();
    type("theme");
    type("");
    expect(document.querySelector("[data-palette-results]")!.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("#o4")!.parentElement?.className).toBe("palette__options");
  });

  it("announces how many options match", async () => {
    const open = await init();
    open();
    const status = () => document.querySelector("[data-palette-status]")!.textContent;
    type("hire");
    expect(status()).toBe("1 result");
    type("e");
    expect(status()).toMatch(/^\d+ results$/u);
  });

  it("falls back to full-text search when nothing matches", async () => {
    const open = await init();
    open();
    type("zzzz");
    expect(document.querySelector("[data-palette-empty]")!.hasAttribute("hidden")).toBe(false);
    expect(selected()).toBeNull();
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/search/?q=zzzz");
  });

  it("runs actions: theme, search and copy", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const open = await init();
    const click = (id: string) => {
      document.querySelector<HTMLElement>(`#${id}`)!.click();
    };
    open();
    click("o4");
    expect(document.documentElement.dataset["themePreference"]).toBe("light");
    open();
    type("search");
    key("Enter");
    expect(assign).toHaveBeenCalledWith("/search/?q=search");
    type("");
    click("o5");
    expect(assign).toHaveBeenLastCalledWith("/search/");
    click("o3");
    await vi.waitFor(() => {
      expect(document.querySelector("[data-palette-status]")!.textContent).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("me@example.com");
  });

  it("opens mail when the clipboard is unavailable, and downloads files", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const open = await init();
    open();
    document.querySelector<HTMLElement>("#o3")!.click();
    await vi.waitFor(() => {
      expect(assign).toHaveBeenCalledWith("mailto:me%40example.com");
    });
    document.querySelector<HTMLElement>("#o6")!.click();
    expect(anchorClick).toHaveBeenCalled();
    anchorClick.mockRestore();
  });

  it("highlights on hover and closes on a backdrop click", async () => {
    const open = await init();
    open();
    document.querySelector("#o2")!.dispatchEvent(new Event("pointermove", { bubbles: true }));
    expect(selected()).toBe("o2");
    dialog().click();
    expect(dialog().open).toBe(false);
    open();
    open();
    expect(dialog().hasAttribute("open")).toBe(true);
    document.querySelector<HTMLButtonElement>("[data-palette-close]")!.click();
    expect(dialog().open).toBe(false);
  });
});

describe("clock (DOM)", () => {
  it("shows the time in the configured zone and stops on abort", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T09:59:30Z"));
    document.body.innerHTML = '<time data-clock data-time-zone="Europe/London">--:--</time><time data-clock>--</time>';
    const local = new AbortController();
    (await import("../../src/scripts/clock")).initClock(local.signal);
    const [london, utc] = document.querySelectorAll("time");
    expect(london!.textContent).toBe("09:59");
    expect(utc!.textContent).toBe("09:59");
    vi.advanceTimersByTime(30_000);
    expect(london!.textContent).toBe("10:00");
    local.abort();
    vi.advanceTimersByTime(60_000);
    expect(london!.textContent).toBe("10:00");
    vi.useRealTimers();
  });

  it("does nothing without clocks", async () => {
    document.body.innerHTML = "";
    const { initClock } = await import("../../src/scripts/clock");
    expect(() => {
      initClock();
    }).not.toThrow();
  });
});
