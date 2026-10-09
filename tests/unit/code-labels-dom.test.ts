// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { labelCodeRegions } from "../../src/scripts/code-labels";

afterEach(() => {
  document.body.innerHTML = "";
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("labelCodeRegions", () => {
  it("does nothing without a labelled container", () => {
    expect(labelCodeRegions()).toBeUndefined();
  });

  it("numbers scrollable code regions, and follows them as they change", async () => {
    document.body.innerHTML = `
      <div data-code-label="Code sample {index}">
        <div class="expressive-code"><pre role="region" tabindex="0"></pre></div>
        <div class="expressive-code"><pre></pre></div>
      </div>`;
    const [first, second] = document.querySelectorAll("pre");
    const observer = labelCodeRegions();
    expect(first!.getAttribute("aria-label")).toBe("Code sample 1");
    expect(second!.hasAttribute("aria-label")).toBe(false);

    second!.setAttribute("role", "region");
    first!.removeAttribute("role");
    await flush();
    expect(second!.getAttribute("aria-label")).toBe("Code sample 2");
    expect(first!.hasAttribute("aria-label")).toBe(false);
    observer?.disconnect();
  });
});
