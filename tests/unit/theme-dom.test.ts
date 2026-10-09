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

  it("opens the palette with ⌘K and Ctrl+K, and the shortcuts help with ?", async () => {
    const open = vi.fn();
    const openHelp = vi.fn();
    (await import("../../src/scripts/shortcuts")).initShortcuts(open, controller.signal, undefined, openHelp);
    press("?");
    press("k", document.body, { metaKey: true });
    press("K", document.querySelector("#field")!, { ctrlKey: true });
    expect(open).toHaveBeenCalledTimes(2);
    expect(openHelp).toHaveBeenCalledOnce();
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

  it("focuses a page’s own opted-in search box with /, but not a hidden one, and never twice", async () => {
    const open = vi.fn();
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div hidden><input id="hidden" data-search-shortcut /></div><input id="tools" data-search-shortcut />',
    );
    (await import("../../src/scripts/shortcuts")).initShortcuts(open, controller.signal);
    const typed = vi.fn();
    document.addEventListener("keydown", (event) => {
      if (!event.defaultPrevented) typed();
    });
    press("/");
    expect(document.activeElement?.id).toBe("tools");
    expect(open).not.toHaveBeenCalled();
    expect(typed).not.toHaveBeenCalled();
    // Once the box has focus, / is a character to type, not a shortcut.
    press("/", document.activeElement!);
    expect(typed).toHaveBeenCalledOnce();
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
