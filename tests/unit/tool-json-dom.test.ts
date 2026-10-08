// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initJson } from "../../src/scripts/tool-json";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (value: string) => {
  document.body.innerHTML = `
    <div data-json data-empty="Empty" data-valid-one="Valid · {count} character"
      data-valid-other="Valid · {count} characters" data-error-at="Line {line}, column {column}: {reason}."
      data-error-token="unexpected “{token}”" data-error-end="ends too soon" data-error-depth="too deep"
      data-copy-text="Copy" data-copied="Copied">
      <textarea data-input></textarea>
      <select data-indent><option value="2">2</option><option value="4">4</option>
        <option value="tab">tab</option><option value="minify">min</option></select>
      <input type="checkbox" data-sort />
      <button type="button" data-copy>Copy</button>
      <p data-status></p>
      <textarea data-output></textarea>
    </div>`;
  document.querySelector<HTMLTextAreaElement>("[data-input]")!.value = value;
  initJson();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  return {
    input: get("[data-input]") as HTMLTextAreaElement,
    output: get("[data-output]") as HTMLTextAreaElement,
    status: get("[data-status]"),
    copy: get("[data-copy]") as HTMLButtonElement,
    indent: get("[data-indent]") as HTMLSelectElement,
    sort: get("[data-sort]") as HTMLInputElement,
  };
};

const type = (element: HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("JSON formatter", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initJson();
    }).not.toThrow();
  });

  it("formats on load and as options change", () => {
    const { output, status, indent, sort, copy } = setup('{"b":1,"a":2}');
    expect(output.value).toBe('{\n  "b": 1,\n  "a": 2\n}');
    expect(status.textContent).toBe("Valid · 22 characters");
    expect(copy.disabled).toBe(false);
    indent.value = "minify";
    indent.dispatchEvent(new Event("change"));
    expect(output.value).toBe('{"b":1,"a":2}');
    sort.checked = true;
    sort.dispatchEvent(new Event("change"));
    expect(output.value).toBe('{"a":2,"b":1}');
  });

  it("uses the singular for one character and prompts when empty", () => {
    const { input, status, copy } = setup("1");
    expect(status.textContent).toBe("Valid · 1 character");
    type(input, "  ");
    expect(status.textContent).toBe("Empty");
    expect(copy.disabled).toBe(true);
  });

  it("explains errors with their line and column", () => {
    const { input, status, output } = setup('{\n  "a": 1,\n}');
    expect(status.textContent).toBe("Line 3, column 1: unexpected “}”.");
    expect(status.hasAttribute("data-invalid")).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(output.value).toBe("");
    type(input, "[1,");
    expect(status.textContent).toBe("Line 1, column 4: ends too soon.");
    type(input, "[".repeat(200_000));
    expect(status.textContent).toBe("Line 1, column 1: too deep.");
    type(input, "[]");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("copies the result, and survives a blocked clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { copy } = setup("[1]");
    copy.click();
    await vi.waitFor(() => {
      expect(copy.textContent).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("[\n  1\n]");
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const again = setup("[1]");
    again.copy.click();
    await Promise.resolve();
    expect(again.copy.textContent).toBe("Copy");
  });
});
