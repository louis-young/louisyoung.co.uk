// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

import { bindOpeners, lazyOpener } from "../../src/scripts/lazy";

describe("lazyOpener", () => {
  it("loads once and opens on every call", async () => {
    const open = vi.fn();
    const load = vi.fn().mockResolvedValue(open);
    const opener = lazyOpener(load);
    opener();
    opener();
    await vi.waitFor(() => {
      expect(open).toHaveBeenCalledTimes(2);
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("can warm up without opening", async () => {
    const open = vi.fn();
    const load = vi.fn().mockResolvedValue(open);
    const opener = lazyOpener(load);
    opener.warm();
    opener.warm();
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
  });
});

describe("bindOpeners", () => {
  it("opens on click, warms on hover and focus, until the signal aborts", () => {
    document.body.innerHTML = `<button data-open>One</button><button data-open>Two</button>`;
    const opener = Object.assign(vi.fn(), { warm: vi.fn() });
    const controller = new AbortController();
    bindOpeners("[data-open]", opener, controller.signal);
    const [first, second] = document.querySelectorAll<HTMLButtonElement>("[data-open]");
    first!.dispatchEvent(new Event("pointerenter"));
    second!.focus();
    expect(opener.warm).toHaveBeenCalledTimes(2);
    first!.click();
    second!.click();
    expect(opener).toHaveBeenCalledTimes(2);
    controller.abort();
    first!.click();
    expect(opener).toHaveBeenCalledTimes(2);
  });
});
