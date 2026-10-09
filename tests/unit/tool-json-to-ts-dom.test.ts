// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initJsonToTs } from "../../src/scripts/tool-json-to-ts";

const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
const area = (selector: string) => document.querySelector<HTMLTextAreaElement>(selector)!;
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (json = '{"id": 1, "address": {"city": "London"}}') => {
  document.body.innerHTML = `
    <div data-jsonts data-empty="Paste JSON." data-count-one="{count} type" data-count-other="{count} types"
      data-error-at="Line {line}, column {column}: {reason}." data-error-token="unexpected “{token}”"
      data-error-end="it ends too soon" data-error-depth="too deep" data-copied="Copied">
      <textarea data-input></textarea>
      <input data-root value="User" />
      <input type="radio" name="style" value="interface" checked data-style />
      <input type="radio" name="style" value="type" data-style />
      <input type="checkbox" data-readonly />
      <input type="checkbox" checked data-export />
      <button type="button" data-copy><span data-copy-label>Copy</span></button>
      <p data-status></p>
      <textarea data-output></textarea>
    </div>`;
  document.querySelector<HTMLTextAreaElement>("[data-input]")!.value = json;
  initJsonToTs();
  const type = (selector: string, value: string) => {
    field(selector).value = value;
    get(selector).dispatchEvent(new Event("input", { bubbles: true }));
  };
  const click = (selector: string) => {
    field(selector).click();
  };
  const output = () => area("[data-output]").value;
  return { get, type, click, output };
};

describe("JSON to TypeScript", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initJsonToTs();
    }).not.toThrow();
  });

  it("generates types as soon as it starts", () => {
    const { get, output } = setup();
    expect(output()).toBe(
      "export interface User {\n  id: number;\n  address: Address;\n}\n\nexport interface Address {\n  city: string;\n}\n",
    );
    expect(get("[data-status]").textContent).toBe("2 types");
    expect(get("[data-input]").getAttribute("aria-invalid")).toBe("false");
  });

  it("follows the options", () => {
    const { type, click, output, get } = setup('{"id": 1}');
    type("[data-root]", "api result");
    click('[data-style][value="type"]');
    click("[data-readonly]");
    click("[data-export]");
    expect(output()).toBe("type ApiResult = {\n  readonly id: number;\n};\n");
    expect(get("[data-status]").textContent).toBe("1 type");
  });

  it("explains a parse error and clears the output", () => {
    const { type, get, output } = setup();
    type("[data-input]", '{\n  "a": 1,\n}');
    expect(get("[data-status]").textContent).toBe("Line 3, column 1: unexpected “}”.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-input]").getAttribute("aria-invalid")).toBe("true");
    expect(output()).toBe("");
    expect(button("[data-copy]").disabled).toBe(true);
    type("[data-input]", '{"a": ');
    expect(get("[data-status]").textContent).toBe("Line 1, column 7: it ends too soon.");
    type("[data-input]", "[".repeat(200_000));
    expect(get("[data-status]").textContent).toBe("Line 1, column 1: too deep.");
    type("[data-input]", " ");
    expect(get("[data-status]").textContent).toBe("Paste JSON.");
  });

  it("copies the types", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, output } = setup();
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(output());
    });
    expect(get("[data-copy-label]").textContent).toBe("Copied");
  });
});
