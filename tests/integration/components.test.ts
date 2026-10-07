import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, it } from "vitest";

import ArticleMeta from "../../src/components/ArticleMeta.astro";
import Icon from "../../src/components/Icon.astro";
import Callout from "../../src/components/mdx/Callout.astro";
import Demo from "../../src/components/mdx/Demo.astro";
import Sandbox from "../../src/components/mdx/Sandbox.astro";
import Toc from "../../src/components/Toc.astro";

let container: AstroContainer;

beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = async (component: Parameters<AstroContainer["renderToString"]>[0], options = {}) =>
  JSDOM.fragment(await container.renderToString(component, options));

describe("<Callout>", () => {
  it("defaults to a labelled note", async () => {
    const fragment = await render(Callout, { slots: { default: "<p>Remember this.</p>" } });
    const aside = fragment.querySelector("[role=note]");
    expect(aside?.getAttribute("aria-label")).toBe("Note");
    expect(aside?.classList.contains("callout--note")).toBe(true);
    expect(fragment.querySelector(".callout__body")?.textContent).toBe("Remember this.");
  });

  it("uses a custom title and type", async () => {
    const fragment = await render(Callout, { props: { type: "warning", title: "Heads up" } });
    expect(fragment.querySelector("[role=note]")?.getAttribute("aria-label")).toBe("Heads up");
    expect(fragment.querySelector(".callout__title")?.textContent.trim()).toBe("Heads up");
    expect(fragment.querySelector("[role=note]")?.classList.contains("callout--warning")).toBe(true);
  });
});

describe("<Demo>", () => {
  it("frames content as a captioned figure", async () => {
    const fragment = await render(Demo, { props: { title: "Two updates" }, slots: { default: "<button>Go</button>" } });
    expect(fragment.querySelector("figure > figcaption")?.textContent).toContain("Two updates");
    expect(fragment.querySelector("figcaption")?.textContent).toContain("Live demo");
    expect(fragment.querySelector(".demo__stage button")?.textContent).toBe("Go");
  });
});

describe("<Sandbox>", () => {
  it("renders a facade instead of loading third-party code", async () => {
    const fragment = await render(Sandbox, { props: { id: "fetch-api-9d09j", title: "Fetch API" } });
    expect(fragment.querySelector("iframe")).toBeNull();
    expect(fragment.querySelector("button[data-sandbox-load]")).not.toBeNull();
    expect(fragment.querySelector("a")?.getAttribute("href")).toBe("https://codesandbox.io/s/fetch-api-9d09j");
  });

  it("only requests the preview view when asked", async () => {
    const editor = await render(Sandbox, { props: { id: "abc", title: "A" } });
    const preview = await render(Sandbox, { props: { id: "abc", title: "A", view: "preview" } });
    expect(editor.querySelector("sandbox-embed")?.getAttribute("data-src")).not.toContain("view=preview");
    expect(preview.querySelector("sandbox-embed")?.getAttribute("data-src")).toContain("view=preview");
  });
});

describe("<ArticleMeta>", () => {
  it("renders machine-readable dates and reading time", async () => {
    const fragment = await render(ArticleMeta, { props: { date: new Date("2021-02-15T00:00:00Z"), minutes: 4 } });
    const time = fragment.querySelector("time");
    expect(time?.getAttribute("datetime")).toBe("2021-02-15");
    expect(time?.textContent).toBe("15 February 2021");
    expect(fragment.textContent).toContain("4 min read");
    expect(fragment.textContent).not.toContain("Updated");
  });

  it("shows the updated date when present", async () => {
    const fragment = await render(ArticleMeta, {
      props: { date: new Date("2021-02-15"), updated: new Date("2026-10-07"), minutes: 1 },
    });
    expect(fragment.querySelectorAll("time")).toHaveLength(2);
    expect(fragment.textContent).toContain("Updated");
  });
});

describe("<Toc>", () => {
  const items = [
    { depth: 2, slug: "a", text: "A", children: [{ depth: 3, slug: "a1", text: "A1", children: [] }] },
    { depth: 2, slug: "b", text: "B", children: [] },
  ];

  it("renders a nested, labelled list of anchor links", async () => {
    const fragment = await render(Toc, { props: { items } });
    expect(fragment.querySelector("nav")?.getAttribute("aria-labelledby")).toBe("toc-title");
    expect([...fragment.querySelectorAll("a")].map((link) => link.getAttribute("href"))).toEqual(["#a", "#a1", "#b"]);
  });

  it("renders nothing for a single section", async () => {
    const fragment = await render(Toc, { props: { items: items.slice(1) } });
    expect(fragment.querySelector("nav")).toBeNull();
  });
});

describe("<Icon>", () => {
  it("is decorative and unfocusable", async () => {
    const svg = (await render(Icon, { props: { name: "search" } })).querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
    expect(svg?.getAttribute("focusable")).toBe("false");
    expect(svg?.getAttribute("stroke")).toBe("currentColor");
  });

  it("fills brand icons", async () => {
    const svg = (await render(Icon, { props: { name: "github", size: 16 } })).querySelector("svg");
    expect(svg?.getAttribute("fill")).toBe("currentColor");
    expect(svg?.getAttribute("width")).toBe("16");
  });
});
