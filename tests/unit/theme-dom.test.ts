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
    vi.resetModules();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-theme-preference");
    mockMatchMedia();
    document.body.innerHTML = `${toggleMarkup}
      <button data-shortcuts-open>Help</button>
      <dialog id="shortcuts"><button data-shortcuts-close>Close</button></dialog>
      <input id="field" />`;
    const dialog = document.querySelector<HTMLDialogElement>("#shortcuts")!;
    dialog.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    dialog.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
  });

  const press = (key: string, target: EventTarget = document.body) =>
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  const dialog = () => document.querySelector<HTMLDialogElement>("#shortcuts")!;

  it("opens help with ? and the footer button, and closes from inside", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(controller.signal);
    press("?");
    expect(dialog().open).toBe(true);
    document.querySelector<HTMLButtonElement>("[data-shortcuts-close]")!.click();
    expect(dialog().open).toBe(false);
    document.querySelector<HTMLButtonElement>("[data-shortcuts-open]")!.click();
    expect(dialog().open).toBe(true);
    dialog().click();
    expect(dialog().open).toBe(false);
  });

  it("cycles the theme with t", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(controller.signal);
    press("t");
    expect(document.documentElement.dataset["themePreference"]).toBe("light");
  });

  it("focuses an on-page search input with /, otherwise navigates", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(controller.signal);
    const assign = vi.fn();
    vi.stubGlobal("location", { href: window.location.href, assign });
    press("/");
    expect(assign).toHaveBeenCalledWith("/search/");
    document.body.insertAdjacentHTML("beforeend", '<input class="pagefind-ui__search-input" />');
    press("/");
    expect(document.activeElement?.className).toBe("pagefind-ui__search-input");
    vi.unstubAllGlobals();
  });

  it("ignores keys typed into fields and while the dialog is open", async () => {
    (await import("../../src/scripts/shortcuts")).initShortcuts(controller.signal);
    press("t", document.querySelector("#field")!);
    expect(document.documentElement.dataset["themePreference"]).toBeUndefined();
    dialog().setAttribute("open", "");
    press("t");
    expect(document.documentElement.dataset["themePreference"]).toBeUndefined();
  });
});
