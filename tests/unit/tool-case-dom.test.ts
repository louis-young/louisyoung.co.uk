// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { caseNames } from "../../src/lib/case-tool";
import { initCase } from "../../src/scripts/tool-case";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (text: string) => {
  document.body.innerHTML = `
    <div data-case data-copied="Copied" data-empty="Type something." data-lines-one="{count} line"
      data-lines-other="{count} lines">
      <textarea data-input></textarea>
      <p data-status></p>
      ${caseNames
        .map(
          (name) =>
            `<button type="button" data-copy="${name}"><span data-copy-label>Copy</span></button><pre data-value="${name}"></pre>`,
        )
        .join("")}
    </div>`;
  document.querySelector<HTMLTextAreaElement>("[data-input]")!.value = text;
  initCase();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const type = (value: string) => {
    const input = get("[data-input]") as HTMLTextAreaElement;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const value = (name: string) => get(`[data-value="${name}"]`).textContent;
  return { get, type, value };
};

describe("case converter", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initCase();
    }).not.toThrow();
  });

  it("fills every case as you type", () => {
    const { type, value, get } = setup("parseHTTPResponse");
    expect(value("camel")).toBe("parseHttpResponse");
    expect(value("title")).toBe("Parse HTTP Response");
    expect(get("[data-status]").textContent).toBe("1 line");
    type("Crème brûlée\n\nuser id");
    expect(value("slug")).toBe("creme-brulee\n\nuser-id");
    expect(value("screaming")).toBe("CRÈME_BRÛLÉE\n\nUSER_ID");
    expect(get("[data-status]").textContent).toBe("2 lines");
    type("  ");
    expect(get("[data-status]").textContent).toBe("Type something.");
  });

  it("copies one case", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get } = setup("user id");
    get('[data-copy="kebab"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("user-id");
    });
    expect(get('[data-copy="kebab"] [data-copy-label]').textContent).toBe("Copied");
  });
});
