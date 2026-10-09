// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initShortcutsHelp } from "../../src/scripts/shortcuts-help";

let controller = new AbortController();
let opens = 0;

const dialog = () => document.querySelector<HTMLDialogElement>("#shortcuts-help")!;

describe("shortcuts help (DOM)", () => {
  beforeEach(() => {
    opens = 0;
    document.body.innerHTML = `
      <dialog id="shortcuts-help">
        <button data-shortcuts-close><svg></svg></button>
        <dl><dt><kbd>?</kbd></dt><dd>Show these shortcuts</dd></dl>
      </dialog>`;
    dialog().showModal = vi.fn(function (this: HTMLDialogElement) {
      opens += 1;
      this.setAttribute("open", "");
    });
    dialog().close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    });
  });

  afterEach(() => {
    controller.abort();
    controller = new AbortController();
  });

  it("returns a no-op without the markup", () => {
    document.body.innerHTML = "";
    expect(() => {
      initShortcutsHelp(controller.signal)();
    }).not.toThrow();
  });

  it("opens once and focuses the close button", () => {
    const open = initShortcutsHelp(controller.signal);
    open();
    open();
    expect(opens).toBe(1);
    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(document.querySelector("[data-shortcuts-close]"));
  });

  it("closes from the close button or the backdrop, but not from its content", () => {
    const open = initShortcutsHelp(controller.signal);
    open();
    document.querySelector("dd")!.click();
    expect(dialog().open).toBe(true);
    document.querySelector("[data-shortcuts-close] svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog().open).toBe(false);
    open();
    dialog().click();
    expect(dialog().open).toBe(false);
  });
});
