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
});

describe("bindOpeners", () => {
  it("wires every matching element until the signal aborts", () => {
    document.body.innerHTML = `<button data-open>One</button><button data-open>Two</button>`;
    const open = vi.fn();
    const controller = new AbortController();
    bindOpeners("[data-open]", open, controller.signal);
    for (const button of document.querySelectorAll<HTMLButtonElement>("[data-open]")) button.click();
    expect(open).toHaveBeenCalledTimes(2);
    controller.abort();
    document.querySelector<HTMLButtonElement>("[data-open]")!.click();
    expect(open).toHaveBeenCalledTimes(2);
  });
});
