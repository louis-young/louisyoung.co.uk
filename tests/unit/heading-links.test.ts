import type { Element } from "hast";
import { describe, expect, it } from "vitest";

import { headingLinkOptions, textOf } from "../../src/lib/heading-links";

const heading: Element = {
  type: "element",
  tagName: "h2",
  properties: { id: "using-usestate" },
  children: [
    { type: "text", value: "Using " },
    { type: "element", tagName: "code", properties: {}, children: [{ type: "text", value: "useState" }] },
    { type: "comment", value: "ignored" },
    { type: "text", value: " " },
  ],
};

describe("textOf", () => {
  it("reads nested text and skips comments", () => {
    expect(heading.children.map(textOf).join("")).toBe("Using useState ");
  });
});

describe("headingLinkOptions", () => {
  it("appends an empty, named link to h2–h4", () => {
    const options = headingLinkOptions();
    expect(options).toMatchObject({ behavior: "append", test: ["h2", "h3", "h4"], content: [] });
    const properties = options.properties as (element: Element) => Record<string, unknown>;
    expect(properties(heading)).toEqual({
      className: ["heading-anchor"],
      ariaLabel: "Link to section: Using useState",
    });
  });
});
