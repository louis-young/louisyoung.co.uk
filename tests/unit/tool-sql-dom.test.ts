// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initSql } from "../../src/scripts/tool-sql";

const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
const area = (selector: string) => document.querySelector<HTMLTextAreaElement>(selector)!;
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;
const select = (selector: string) => document.querySelector<HTMLSelectElement>(selector)!;

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (sql = "select a from t") => {
  document.body.innerHTML = `
    <div data-sql data-copied="Copied" data-empty="Paste SQL." data-formatted-one="{count} statement formatted"
      data-formatted-other="{count} statements formatted" data-minified-one="{count} statement minified"
      data-minified-other="{count} statements minified" data-unterminated="Never closed." data-unchanged="Unsafe.">
      <textarea data-input></textarea>
      <input type="radio" name="case" value="upper" checked data-case />
      <input type="radio" name="case" value="lower" data-case />
      <input type="radio" name="case" value="preserve" data-case />
      <select data-indent><option value="2">2</option><option value="4">4</option><option value="tab">Tab</option></select>
      <input type="checkbox" data-minify />
      <button type="button" data-copy><span data-copy-label>Copy</span></button>
      <p data-status></p>
      <textarea data-output></textarea>
    </div>`;
  document.querySelector<HTMLTextAreaElement>("[data-input]")!.value = sql;
  initSql();
  const type = (value: string) => {
    const input = area("[data-input]");
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const output = () => area("[data-output]").value;
  const status = () => get("[data-status]").textContent;
  return { get, type, output, status };
};

describe("SQL formatter", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initSql();
    }).not.toThrow();
  });

  it("formats as soon as it starts", () => {
    const { output, status } = setup();
    expect(output()).toBe("SELECT\n  a\nFROM\n  t");
    expect(status()).toBe("1 statement formatted");
  });

  it("follows the options", () => {
    const { output, status, type } = setup("select a from t; select b from u");
    field('[data-case][value="lower"]').click();
    const indent = select("[data-indent]");
    indent.value = "tab";
    indent.dispatchEvent(new Event("change", { bubbles: true }));
    expect(output()).toBe("select\n\ta\nfrom\n\tt;\n\nselect\n\tb\nfrom\n\tu");
    expect(status()).toBe("2 statements formatted");
    field("[data-minify]").click();
    expect(indent.disabled).toBe(true);
    expect(output()).toBe("select a from t;\nselect b from u");
    expect(status()).toBe("2 statements minified");
    type("SELECT 1");
    expect(status()).toBe("1 statement minified");
    field('[data-case][value="preserve"]').click();
    field("[data-minify]").click();
    expect(output()).toBe("SELECT\n\t1");
  });

  it("warns about an unclosed string and an empty input", () => {
    const { get, type, status, output } = setup();
    type("select 'open");
    expect(status()).toBe("Never closed.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(output()).toBe("SELECT\n  'open");
    type("   ");
    expect(status()).toBe("Paste SQL.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(false);
    expect(button("[data-copy]").disabled).toBe(true);
  });

  it("copies the result", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, output } = setup();
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(output());
    });
  });
});
