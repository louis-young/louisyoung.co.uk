// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initSpotlight } from "../../src/scripts/spotlight";

const media = (matches: boolean) => {
  window.matchMedia = vi.fn().mockReturnValue({ matches });
};

const move = (target: Element, clientX: number, clientY: number) => {
  const event = new MouseEvent("pointermove", { bubbles: true, clientX, clientY });
  target.dispatchEvent(event);
};

describe("spotlight", () => {
  let controller = new AbortController();

  afterEach(() => {
    controller.abort();
    controller = new AbortController();
    document.body.innerHTML = "";
  });

  const setup = () => {
    document.body.innerHTML = `<div class="card"><p>Inside</p></div><p class="outside">Outside</p>`;
    const card = document.querySelector<HTMLElement>(".card")!;
    card.getBoundingClientRect = () => ({ left: 100, top: 50 }) as DOMRect;
    return card;
  };

  it("tracks the pointer relative to the card under it", () => {
    media(true);
    const card = setup();
    initSpotlight(controller.signal);
    move(card.querySelector("p")!, 160.4, 90.6);
    expect(card.style.getPropertyValue("--spot-x")).toBe("60px");
    expect(card.style.getPropertyValue("--spot-y")).toBe("41px");
  });

  it("ignores movement outside cards", () => {
    media(true);
    const card = setup();
    initSpotlight(controller.signal);
    move(document.querySelector(".outside")!, 10, 10);
    expect(card.style.getPropertyValue("--spot-x")).toBe("");
  });

  it("does nothing for touch, coarse pointers or reduced motion", () => {
    media(false);
    const card = setup();
    initSpotlight(controller.signal);
    move(card, 160, 90);
    expect(card.style.getPropertyValue("--spot-x")).toBe("");
  });
});
