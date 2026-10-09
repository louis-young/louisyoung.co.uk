// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initAspectRatio } from "../../src/scripts/tool-aspect-ratio";

const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
const button = (selector: string) => document.querySelector<HTMLButtonElement>(selector)!;

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const setup = (width = "1920", height = "1080") => {
  document.body.innerHTML = `
    <div data-aspect data-copied="Copied" data-status-text="{width} × {height} is {ratio}: {nearest}."
      data-exact="exactly {ratio}" data-near="closest to {ratio}, {off}% off" data-invalid="Enter sizes."
      data-ratio-hint="Type a ratio." data-error-ratio="Bad ratio.">
      <input type="number" data-width value="${width}" />
      <input type="number" data-height value="${height}" />
      <input type="text" data-ratio value="" /><p data-ratio-message></p>
      <input type="checkbox" data-lock />
      <button type="button" data-preset-width="1080" data-preset-height="1350">Portrait</button>
      <p data-status></p>
      <dd data-reduced></dd><dd data-decimal></dd><dd data-nearest></dd>
      <div data-box><span data-box-ratio></span><span data-box-size></span></div>
      <code data-css></code>
      <button type="button" data-copy><span data-copy-label>Copy</span></button>
    </div>`;
  initAspectRatio();
  const input = (selector: string) => field(selector);
  const type = (selector: string, value: string) => {
    input(selector).value = value;
    input(selector).dispatchEvent(new Event("input", { bubbles: true }));
  };
  const text = (selector: string) => get(selector).textContent;
  return { get, input, type, text };
};

describe("aspect ratio calculator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initAspectRatio();
    }).not.toThrow();
  });

  it("reduces the starting size", () => {
    const { text, input, get } = setup();
    expect(text("[data-status]")).toBe("1920 × 1080 is 16:9: exactly 16:9.");
    expect(text("[data-reduced]")).toBe("16:9");
    expect(text("[data-decimal]")).toBe("1.7778");
    expect(text("[data-nearest]")).toBe("16:9");
    expect(text("[data-css]")).toBe("aspect-ratio: 16 / 9;");
    expect(text("[data-box-size]")).toBe("1920 × 1080");
    expect(input("[data-ratio]").value).toBe("16:9");
    expect(get("[data-box]").style.getPropertyValue("--ratio")).toBe(String(1920 / 1080));
  });

  it("recalculates the ratio when a side changes freely", () => {
    const { type, text, input } = setup();
    type("[data-height]", "768");
    expect(text("[data-reduced]")).toBe("5:2");
    type("[data-width]", "1366");
    expect(text("[data-reduced]")).toBe("683:384");
    expect(text("[data-nearest]")).toBe("≈ 16:9");
    expect(text("[data-status]")).toBe("1366 × 768 is 683:384: closest to 16:9, 0.05% off.");
    expect(input("[data-ratio]").value).toBe("683:384");
  });

  it("solves the other side when the ratio is locked", () => {
    const { type, input, text } = setup();
    input("[data-lock]").click();
    type("[data-width]", "1000");
    expect(input("[data-height]").value).toBe("562.5");
    type("[data-height]", "720");
    expect(input("[data-width]").value).toBe("1280");
    expect(text("[data-reduced]")).toBe("16:9");
  });

  it("takes a typed ratio and keeps showing it after rounding", () => {
    const { type, input, text, get } = setup();
    type("[data-ratio]", "2.39");
    expect(input("[data-height]").value).toBe("803.35");
    expect(text("[data-reduced]")).toBe("239:100");
    expect(text("[data-css]")).toBe("aspect-ratio: 239 / 100;");
    expect(input("[data-ratio]").value).toBe("2.39");
    type("[data-ratio]", "16:");
    expect(input("[data-ratio]").getAttribute("aria-invalid")).toBe("true");
    expect(text("[data-ratio-message]")).toBe("Bad ratio.");
    expect(get("[data-ratio-message]").hasAttribute("data-invalid")).toBe(true);
    expect(text("[data-reduced]")).toBe("239:100");
    type("[data-width]", "1920");
    expect(input("[data-ratio]").getAttribute("aria-invalid")).toBe("false");
    expect(text("[data-ratio-message]")).toBe("Type a ratio.");
  });

  it("applies a preset", () => {
    const { get, text, input } = setup();
    get("[data-preset-width]").click();
    expect(input("[data-width]").value).toBe("1080");
    expect(input("[data-height]").value).toBe("1350");
    expect(text("[data-reduced]")).toBe("4:5");
  });

  it("explains an impossible size", () => {
    const { type, text, input, get } = setup();
    type("[data-height]", "0");
    expect(text("[data-status]")).toBe("Enter sizes.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(input("[data-height]").getAttribute("aria-invalid")).toBe("true");
    expect(input("[data-width]").getAttribute("aria-invalid")).toBe("false");
    expect(text("[data-css]")).toBe("–");
    expect(button("[data-copy]").disabled).toBe(true);
    input("[data-lock]").click();
    type("[data-width]", "");
    expect(input("[data-height]").value).toBe("0");
    type("[data-height]", "9");
    type("[data-width]", "16");
    expect(text("[data-reduced]")).toBe("16:9");
  });

  it("copies the CSS", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get } = setup("1080", "1080");
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("aspect-ratio: 1 / 1;");
    });
  });
});
