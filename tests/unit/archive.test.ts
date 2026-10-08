// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initArchiveFilter } from "../../src/scripts/archive";

let controller = new AbortController();

afterEach(() => {
  controller.abort();
  controller = new AbortController();
  document.body.innerHTML = "";
  history.replaceState(null, "", "/writing/");
});

const setup = () => {
  document.body.innerHTML = `
    <p data-filter-status>3 articles</p>
    <nav data-filter>
      <a href="/writing/" data-topic="" aria-current="true" data-announce="3 articles">All</a>
      <a href="/tags/react/" data-topic="react" data-announce="2 articles tagged “react”">react</a>
      <a href="/tags/css/" data-topic="css" data-announce="1 article tagged “css”">css <span>1</span></a>
    </nav>
    <ul><li><a data-year-link="2022" href="#year-2022">2022</a></li><li><a data-year-link="2021" href="#year-2021">2021</a></li></ul>
    <section data-year="2022"><article data-topics="react hooks" id="a"></article></section>
    <section data-year="2021">
      <article data-topics="react" id="b"></article>
      <article data-topics="css" id="c"></article>
    </section>`;
  initArchiveFilter(controller.signal);
};

const chip = (topic: string) => document.querySelector<HTMLAnchorElement>(`[data-topic="${topic}"]`)!;
const visible = () => [...document.querySelectorAll<HTMLElement>("[data-topics]")].filter((row) => !row.hidden);

describe("archive filter", () => {
  it("does nothing on pages without a filter", () => {
    expect(() => {
      initArchiveFilter(controller.signal);
    }).not.toThrow();
  });

  it("filters rows in place, marks the chip, announces the count and records the topic", () => {
    setup();
    chip("css").querySelector("span")!.click();
    expect(visible().map((row) => row.id)).toEqual(["c"]);
    expect(chip("css").getAttribute("aria-current")).toBe("true");
    expect(chip("").hasAttribute("aria-current")).toBe(false);
    expect(document.querySelector("[data-filter-status]")!.textContent).toBe("1 article tagged “css”");
    expect(document.querySelector<HTMLElement>('[data-year="2022"]')!.hidden).toBe(true);
    expect(document.querySelector('[data-year-link="2022"]')!.parentElement!.hidden).toBe(true);
    expect(window.location.search).toBe("?topic=css");
  });

  it("shows everything again from All", () => {
    setup();
    chip("react").click();
    expect(visible().map((row) => row.id)).toEqual(["a", "b"]);
    chip("").click();
    expect(visible()).toHaveLength(3);
    expect(window.location.search).toBe("");
  });

  it("lets modified clicks through to the topic page", () => {
    setup();
    let prevented: boolean | undefined;
    // Runs after the filter's handler: record what it did, then stop jsdom from navigating.
    document.addEventListener(
      "click",
      (event) => {
        prevented = event.defaultPrevented;
        event.preventDefault();
      },
      { signal: controller.signal, once: true },
    );
    chip("react").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, metaKey: true }));
    expect(prevented).toBe(false);
    expect(visible()).toHaveLength(3);
  });

  it("applies a topic from the URL and ignores unknown ones", () => {
    history.replaceState(null, "", "/writing/?topic=react");
    setup();
    expect(visible().map((row) => row.id)).toEqual(["a", "b"]);
    controller.abort();
    controller = new AbortController();
    history.replaceState(null, "", "/writing/?topic=nope");
    setup();
    expect(visible()).toHaveLength(3);
  });
});
