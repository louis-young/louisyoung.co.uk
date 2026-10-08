// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initKeyLight, keyName } from "../../src/scripts/key-light";

const press = (key: string) => {
  document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
};

describe("keyName", () => {
  it("folds ⌘ and Ctrl into one cap and ignores case", () => {
    expect(keyName("Meta")).toBe("mod");
    expect(keyName("Control")).toBe("mod");
    expect(keyName("K")).toBe("k");
    expect(keyName("/")).toBe("/");
  });
});

describe("key light", () => {
  let controller = new AbortController();

  afterEach(() => {
    controller.abort();
    controller = new AbortController();
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  it("lights every matching cap briefly", () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<kbd data-key="k">K</kbd><kbd data-key="k">K</kbd><kbd data-key="j">J</kbd>`;
    initKeyLight(controller.signal);
    press("K");
    const caps = [...document.querySelectorAll<HTMLElement>("kbd")];
    expect(caps.map((cap) => "lit" in cap.dataset)).toEqual([true, true, false]);
    vi.advanceTimersByTime(200);
    press("k");
    vi.advanceTimersByTime(200);
    expect("lit" in caps[0]!.dataset).toBe(true);
    vi.advanceTimersByTime(100);
    expect(caps.some((cap) => "lit" in cap.dataset)).toBe(false);
  });

  it("does nothing on a page without key caps", () => {
    const listen = vi.spyOn(document, "addEventListener");
    initKeyLight(controller.signal);
    expect(listen).not.toHaveBeenCalled();
    listen.mockRestore();
  });
});
