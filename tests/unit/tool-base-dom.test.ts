// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initBase } from "../../src/scripts/tool-base";

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const messages = {
  "invalid-number": "Not base {base}.",
  "invalid-base": "2 to 36.",
  "status-text": "{bits} bits; {width}-bit {kind}: 0x{hex}",
  "too-wide": "{bits} bits: too wide.",
  "signed-word": "signed",
  "unsigned-word": "unsigned",
  "bit-label": "Bit {index}",
  "byte-label": "{high}–{low}",
  "no-fit": "No fit",
  "no-bytes": "No bytes",
};

const field = (id: string, base: string, value: string) =>
  `<input id="${id}" data-value="${base}" value="${value}" /><p id="${id}-error" data-error hidden></p>`;

const setup = (decimal = "255", startWidth = 8) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-base-tool ${attributes}>
      ${field("bin", "2", "")}${field("oct", "8", "")}${field("dec", "10", decimal)}${field("hex", "16", "")}
      <input id="radix" data-radix value="36" /><p id="radix-error" data-radix-error hidden></p>
      ${field("custom", "custom", "")}
      <p data-status></p>
      ${[8, 16, 32, 64].map((bits) => `<input type="radio" data-width value="${bits}" ${bits === startWidth ? "checked" : ""} />`).join("")}
      <input type="checkbox" data-signed />
      <div data-grid></div><p data-grid-note hidden></p>
      <code data-big></code><code data-little></code>
      <div data-scroll><table><tbody>
        ${[8, 16, 32, 64]
          .map(
            (bits) =>
              `<tr data-row="${bits}"><td><code data-hex></code></td><td data-signed-value></td><td data-unsigned-value></td></tr>`,
          )
          .join("")}
      </tbody></table></div>
    </div>`;
  initBase();
  const get = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
  const type = (selector: string, value: string) => {
    const input = get(selector);
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const change = (input: HTMLInputElement, checked = true) => {
    input.checked = checked;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  const text = (selector: string) => get(selector).textContent;
  const bits = () =>
    [...document.querySelectorAll<HTMLButtonElement>("[data-bit]")]
      .map((button) => button.firstElementChild!.textContent)
      .join("");
  const width = (size: number) => get(`[data-width][value="${size}"]`);
  return { get, type, change, text, bits, width };
};

describe("number base converter", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initBase();
    }).not.toThrow();
  });

  it("fills every base, the bits, the bytes and the table", () => {
    const { get, text, bits, width } = setup("255");
    expect(get("#bin").value).toBe("11111111");
    expect(get("#oct").value).toBe("377");
    expect(get("#hex").value).toBe("ff");
    expect(get("#custom").value).toBe("73");
    expect(bits()).toBe("11111111");
    expect(get("[data-bit]").getAttribute("aria-pressed")).toBe("true");
    expect(get("[data-bit] .visually-hidden").textContent).toBe("Bit 7");
    expect(text(".base__byte legend")).toBe("7–0");
    expect(text("[data-big]")).toBe("ff");
    expect(text('[data-row="16"] [data-hex]')).toBe("0x00ff");
    expect(text('[data-row="8"] [data-signed-value]')).toBe("-1");
    expect(text('[data-row="8"] [data-unsigned-value]')).toBe("255");
    expect(text("[data-status]")).toBe("8 bits; 8-bit unsigned: 0xff");
    expect(width(8).checked).toBe(true);
    expect(width(8).disabled).toBe(false);
  });

  it("follows whichever field you type in, prefixes and separators included", () => {
    const { get, type, text, width } = setup();
    type("#hex", "0x1_0000");
    expect(get("#dec").value).toBe("65536");
    expect(get("#hex").value).toBe("0x1_0000");
    expect(width(32).checked).toBe(true);
    expect(width(16).disabled).toBe(true);
    expect(text("[data-big]")).toBe("00 01 00 00");
    expect(text("[data-little]")).toBe("00 00 01 00");
    type("#custom", "zz");
    expect(get("#dec").value).toBe("1295");
    expect(width(32).checked).toBe(true);
  });

  it("flags invalid input and keeps the last good value", () => {
    const { get, type, text } = setup();
    type("#bin", "102");
    expect(get("#bin").getAttribute("aria-invalid")).toBe("true");
    expect(text("#bin-error")).toBe("Not base 2.");
    expect(get("#bin-error").hidden).toBe(false);
    expect(get("#dec").value).toBe("255");
    type("#bin", "1");
    expect(get("#bin").getAttribute("aria-invalid")).toBe("false");
    expect(get("#dec").value).toBe("1");
  });

  it("switches to signed for negative numbers and shows two’s complement", () => {
    const { get, type, text, bits } = setup();
    type("#dec", "-42");
    expect(get("[data-signed]").checked).toBe(true);
    expect(bits()).toBe("11010110");
    expect(text('[data-row="16"] [data-hex]')).toBe("0xffd6");
    expect(text('[data-row="16"] [data-unsigned-value]')).toBe("65494");
    expect(text("[data-status]")).toBe("7 bits; 8-bit signed: 0xd6");
    type("#dec", "-300");
    expect(text('[data-row="8"] [data-hex]')).toBe("No fit");
    expect(get('[data-row="8"]').hasAttribute("data-invalid")).toBe(true);
    expect(text('[data-row="8"] [data-signed-value]')).toBe("–");
    expect(text("[data-big]")).toBe("fe d4");
  });

  it("toggles bits, reading them as signed or unsigned", () => {
    const { get, text, change } = setup("0");
    const top = get('[data-bit="7"]');
    top.click();
    expect(get("#dec").value).toBe("128");
    expect(top.getAttribute("aria-pressed")).toBe("true");
    change(get("[data-signed]"));
    expect(get("#dec").value).toBe("-128");
    get('[data-bit="0"]').click();
    expect(get("#dec").value).toBe("-127");
    change(get("[data-signed]"), false);
    expect(get("#dec").value).toBe("129");
    get("[data-grid]").click();
    expect(text("[data-status]")).toBe("8 bits; 8-bit unsigned: 0x81");
  });

  it("changes width and widens when signed needs more room", () => {
    const { get, change, bits, width } = setup("200");
    change(width(32));
    expect(bits()).toHaveLength(32);
    expect(document.querySelectorAll(".base__byte")).toHaveLength(4);
    change(width(8));
    change(get("[data-signed]"));
    // 200 read as signed 8-bit is -56: the same bits.
    expect(get("#dec").value).toBe("-56");
  });

  it("drops the grid beyond 64 bits", () => {
    const { get, type, text, change } = setup();
    type("#dec", (2n ** 64n).toString());
    expect(get("[data-grid]").children).toHaveLength(0);
    expect(get("[data-grid-note]").hidden).toBe(false);
    expect(text("[data-grid-note]")).toBe("65 bits: too wide.");
    expect(text("[data-status]")).toBe("65 bits: too wide.");
    expect(text("[data-big]")).toBe("01 00 00 00 00 00 00 00 00");
    get("[data-grid]").click();
    type("#dec", (-(2n ** 64n)).toString());
    expect(text("[data-big]")).toBe("No bytes");
    // A huge positive value can't be signed, so the checkbox gives way.
    type("#dec", (2n ** 63n).toString());
    expect(get("[data-signed]").checked).toBe(false);
    expect(get("[data-grid-note]").hidden).toBe(true);
    change(get("[data-signed]"));
    expect(get("#dec").value).toBe((-(2n ** 63n)).toString());
  });

  it("validates the custom base", () => {
    const { get, type, text } = setup();
    type("#radix", "40");
    expect(get("#radix").getAttribute("aria-invalid")).toBe("true");
    expect(text("#radix-error")).toBe("2 to 36.");
    type("#dec", "10");
    expect(get("#custom").value).toBe("73");
    type("#custom", "1");
    expect(get("#dec").value).toBe("10");
    type("#radix", "2");
    expect(get("#custom").value).toBe("1010");
    expect(get("#radix").getAttribute("aria-invalid")).toBe("false");
  });

  it("makes the table focusable only while it scrolls", () => {
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(600);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const { get } = setup();
    expect(get("[data-scroll]").tabIndex).toBe(0);
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(300);
    window.dispatchEvent(new Event("resize"));
    expect(get("[data-scroll]").hasAttribute("tabindex")).toBe(false);
  });
});
