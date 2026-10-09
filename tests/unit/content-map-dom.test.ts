// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initContentMap } from "../../src/scripts/content-map";

afterEach(() => {
  document.body.innerHTML = "";
});

const node = (id: string, kind: string, filter: string, x: number, y: number, hub = false) =>
  `<a href="/${id}/" data-node data-id="${id}" data-kind="${kind}" data-filter="${filter}" data-hub="${hub}"
    data-label="${id} title" data-callout-text="${id} title" data-kind-name="${kind}" data-meta="2 connections"
    data-x="${x}" data-y="${y}" data-lx="${x + 10}" data-ly="${y}" data-anchor="start"><circle r="5"></circle></a>`;

const setup = (focusFirst = false) => {
  document.body.innerHTML = `
    <section data-map>
      <input type="checkbox" value="topic" checked data-map-filter />
      <input type="checkbox" value="article" checked data-map-filter />
      <input type="checkbox" value="tool" checked data-map-filter />
      <select data-map-focus><option value="">All</option><option value="topic:react">#react</option></select>
      <p data-map-status data-template="Showing {shown} of {total} nodes"></p>
      <svg data-map-svg>
        <path data-edge data-source="article:a" data-target="topic:react"></path>
        <path data-edge data-source="article:b" data-target="topic:react"></path>
        <path data-edge data-source="tool:t" data-target="category:c"></path>
        ${node("topic:react", "topic", "topic", 100, 100, true)}
        ${node("category:c", "category", "tool", 300, 100, true)}
        ${node("article:a", "article", "article", 50, 50)}
        ${node("article:b", "article", "article", 150, 100)}
        ${node("tool:t", "tool", "tool", 300, 200)}
        <text data-map-callout></text>
      </svg>
      <div data-map-inspector>
        <div data-inspector-overview>Overview</div>
        <div data-inspector-detail hidden>
          <p data-inspector-kind></p><p data-inspector-title></p><p data-inspector-meta></p><ul data-inspector-list></ul>
        </div>
      </div>
    </section>`;
  if (focusFirst) document.querySelector<SVGElement>('[data-id="article:a"]')!.focus();
  initContentMap();
};

const map = () => document.querySelector<HTMLElement>("[data-map]")!;
const svg = () => document.querySelector<SVGSVGElement>("[data-map-svg]")!;
const get = (id: string) => document.querySelector<SVGElement>(`[data-id="${id}"]`)!;
const classes = (name: string) =>
  [...document.querySelectorAll<SVGElement>(`.${name}`)].map((element) => element.dataset["id"] ?? "edge");
const press = (key: string) => {
  svg().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
};
const toggle = (value: string, checked: boolean) => {
  const input = document.querySelector<HTMLInputElement>(`[data-map-filter][value="${value}"]`)!;
  input.checked = checked;
  input.dispatchEvent(new Event("change"));
};

describe("initContentMap", () => {
  it("marks itself ready once, gives the map one tab stop and announces the count", () => {
    setup();
    initContentMap();
    expect(map().hasAttribute("data-ready")).toBe(true);
    expect(svg().getAttribute("aria-describedby")).toBe("map-hint");
    const stops = [...document.querySelectorAll("[data-node]")].map((element) => element.getAttribute("tabindex"));
    expect(stops).toEqual(["0", "-1", "-1", "-1", "-1"]);
    expect(document.querySelector("[data-map-status]")!.textContent).toBe("Showing 5 of 5 nodes");
  });

  it("does nothing without a map", () => {
    expect(() => {
      initContentMap();
    }).not.toThrow();
  });

  it("highlights a node's neighbours on hover and fills the inspector", () => {
    setup();
    get("topic:react").dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(map().hasAttribute("data-highlighting")).toBe(true);
    expect(classes("is-active")).toEqual(["topic:react"]);
    expect(classes("is-near")).toEqual(["article:a", "article:b"]);
    expect(classes("is-lit")).toHaveLength(2);
    expect(document.querySelector("[data-inspector-overview]")!.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("[data-inspector-title]")!.textContent).toBe("topic:react title");
    expect(document.querySelector("[data-inspector-list]")!.textContent).toBe("article:a titlearticle:b title");
    // Hubs already show their label, so the callout is flagged for the CSS to hide.
    expect(document.querySelector("[data-map-callout]")!.textContent).toBe("topic:react title");
    expect(document.querySelector("[data-map-callout]")!.hasAttribute("data-hub")).toBe(true);

    svg().dispatchEvent(new Event("pointerleave"));
    expect(map().hasAttribute("data-highlighting")).toBe(false);
    expect(document.querySelector("[data-inspector-detail]")!.hasAttribute("hidden")).toBe(true);
  });

  it("ignores pointer movement over things that aren't nodes", () => {
    setup();
    svg()
      .querySelector("path")!
      .dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(map().hasAttribute("data-highlighting")).toBe(false);
  });

  it("highlights on focus, moves with the arrow keys and clears with Escape", () => {
    setup();
    get("topic:react").focus();
    expect(classes("is-active")).toEqual(["topic:react"]);
    press("ArrowRight");
    expect(document.activeElement).toBe(get("article:b"));
    expect(get("article:b").getAttribute("tabindex")).toBe("0");
    expect(get("topic:react").getAttribute("tabindex")).toBe("-1");
    expect(document.querySelector("[data-map-callout]")!.getAttribute("x")).toBe("160");
    press("End");
    expect(document.activeElement).toBe(get("tool:t"));
    press("ArrowDown");
    expect(document.activeElement).toBe(get("tool:t"));
    press("Home");
    expect(document.activeElement).toBe(get("topic:react"));
    press("Escape");
    expect(map().hasAttribute("data-highlighting")).toBe(false);
    press("a");
    expect(document.activeElement).toBe(get("topic:react"));
  });

  it("keeps the highlight while a node inside has focus and resets when focus leaves", () => {
    setup();
    get("article:a").focus();
    svg().dispatchEvent(new Event("pointerleave"));
    expect(classes("is-active")).toEqual(["article:a"]);
    get("article:a").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: get("tool:t") }));
    expect(classes("is-active")).toEqual(["article:a"]);
    get("article:a").dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: document.body }));
    expect(map().hasAttribute("data-highlighting")).toBe(false);
    svg().dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(map().hasAttribute("data-highlighting")).toBe(false);
  });

  it("picks up a node that was focused before the script loaded", () => {
    setup(true);
    expect(classes("is-active")).toEqual(["article:a"]);
    expect(get("article:a").getAttribute("tabindex")).toBe("0");
  });

  it("filters by kind, skipping hidden nodes and moving the tab stop off them", () => {
    setup();
    toggle("topic", false);
    expect(map().hasAttribute("data-hide-topic")).toBe(true);
    expect(document.querySelector("[data-map-status]")!.textContent).toBe("Showing 4 of 5 nodes");
    expect(document.querySelector<HTMLSelectElement>("[data-map-focus]")!.disabled).toBe(true);
    expect(get("category:c").getAttribute("tabindex")).toBe("0");
    get("article:a").focus();
    press("ArrowRight");
    expect(document.activeElement).toBe(get("article:b"));
    press("ArrowLeft");
    expect(document.activeElement).toBe(get("article:a"));
    // Hidden neighbours stay out of the inspector, and a hidden node shows nothing.
    toggle("topic", true);
    toggle("article", false);
    get("topic:react").dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(document.querySelector("[data-inspector-list]")!.textContent).toBe("");
    get("article:a").dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(document.querySelector("[data-inspector-detail]")!.hasAttribute("hidden")).toBe(true);
    expect(document.querySelector("[data-map-callout]")!.textContent).toBe("");
  });

  it("pins the chosen topic as the resting highlight and the next tab stop", () => {
    setup();
    const select = document.querySelector<HTMLSelectElement>("[data-map-focus]")!;
    select.value = "topic:react";
    select.dispatchEvent(new Event("change"));
    expect(map().hasAttribute("data-pinned")).toBe(true);
    expect(classes("is-active")).toEqual(["topic:react"]);
    get("tool:t").dispatchEvent(new Event("pointerover", { bubbles: true }));
    expect(classes("is-active")).toEqual(["tool:t"]);
    svg().dispatchEvent(new Event("pointerleave"));
    expect(classes("is-active")).toEqual(["topic:react"]);
    select.value = "";
    select.dispatchEvent(new Event("change"));
    expect(map().hasAttribute("data-highlighting")).toBe(false);
  });
});
