// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initHeadingLinks, initTimeLeft } from "../../src/scripts/reading";

let controller = new AbortController();

beforeEach(() => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    callback(0);
    // Runs synchronously; 0 means "no frame pending", as after a real frame has run.
    return 0;
  });
});

afterEach(() => {
  controller.abort();
  controller = new AbortController();
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("time left", () => {
  const setup = (rect: Partial<DOMRect>) => {
    document.body.innerHTML = `
      <p data-time-left data-minutes="10" data-template="{minutes} min left" data-done="Finished" hidden>
        <span data-time-left-label>10 min left</span>
      </p>
      <div data-reading-body></div>`;
    const body = document.querySelector<HTMLElement>("[data-reading-body]")!;
    body.getBoundingClientRect = () => ({ top: 0, bottom: 0, height: 0, ...rect }) as DOMRect;
    window.innerHeight = 1000;
    return document.querySelector<HTMLElement>("[data-time-left]")!;
  };

  it("does nothing without its elements", () => {
    expect(() => {
      initTimeLeft(controller.signal);
    }).not.toThrow();
  });

  it("stays out of sight before the body reaches the reader", () => {
    const pill = setup({ top: 900, bottom: 5900, height: 5000 });
    initTimeLeft(controller.signal);
    expect(pill.hidden).toBe(false);
    expect(pill.hasAttribute("data-shown")).toBe(false);
    expect(pill.textContent).toContain("10 min left");
  });

  it("counts down and fills the ring while reading", () => {
    const pill = setup({ top: -1500, bottom: 3500, height: 5000 });
    initTimeLeft(controller.signal);
    expect(pill.hasAttribute("data-shown")).toBe(true);
    expect(pill.textContent.trim()).toBe("5 min left");
    expect(pill.style.getPropertyValue("--progress")).toBe("0.500");
  });

  it("says when the reader has finished, and updates on scroll", () => {
    const pill = setup({ top: 0, bottom: 5000, height: 5000 });
    initTimeLeft(controller.signal);
    const body = document.querySelector<HTMLElement>("[data-reading-body]")!;
    body.getBoundingClientRect = () => ({ top: -4000, bottom: 1000, height: 5000 }) as DOMRect;
    window.dispatchEvent(new Event("scroll"));
    expect(pill.textContent.trim()).toBe("Finished");
    body.getBoundingClientRect = () => ({ top: -4800, bottom: 200, height: 5000 }) as DOMRect;
    window.dispatchEvent(new Event("resize"));
    expect(pill.hasAttribute("data-shown")).toBe(false);
  });
});

describe("heading links", () => {
  const setup = () => {
    document.head.innerHTML = `<link rel="canonical" href="https://example.com/article/" />`;
    document.body.innerHTML = `
      <div class="prose">
        <h2 id="one"><a class="heading-anchor" href="#one">One</a></h2>
        <h2 id="two"><a class="heading-anchor" href="#two">Two</a></h2>
        <p><a href="#one">Not a heading</a></p>
      </div>
      <p role="status" data-anchor-status data-message="Link copied" data-copied-label="Copied"></p>`;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    initHeadingLinks(controller.signal);
    return writeText;
  };

  const click = (selector: string) => {
    const link = document.querySelector<HTMLAnchorElement>(selector)!;
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
    link.click();
  };

  it("copies the canonical section URL, flashes the heading and announces it", async () => {
    vi.useFakeTimers();
    const writeText = setup();
    click("#one a");
    await vi.waitFor(() => {
      expect(document.querySelector("#one")!.getAttribute("data-copied")).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("https://example.com/article/#one");
    expect(document.querySelector("[data-anchor-status]")!.textContent).toBe("Link copied");
    vi.advanceTimersByTime(2000);
    expect(document.querySelector("#one")!.hasAttribute("data-copied")).toBe(false);
    expect(document.querySelector("[data-anchor-status]")!.textContent).toBe("");
  });

  it("moves the badge when another heading is copied", async () => {
    setup();
    click("#one a");
    await vi.waitFor(() => {
      expect(document.querySelector("#one")!.hasAttribute("data-copied")).toBe(true);
    });
    click("#two a");
    await vi.waitFor(() => {
      expect(document.querySelector("#two")!.hasAttribute("data-copied")).toBe(true);
    });
    expect(document.querySelector("#one")!.hasAttribute("data-copied")).toBe(false);
  });

  it("ignores other links and clipboard failures", async () => {
    const writeText = setup();
    click("p a");
    expect(writeText).not.toHaveBeenCalled();
    writeText.mockRejectedValueOnce(new Error("denied"));
    click("#two a");
    await Promise.resolve();
    expect(document.querySelector("#two")!.hasAttribute("data-copied")).toBe(false);
  });
});
