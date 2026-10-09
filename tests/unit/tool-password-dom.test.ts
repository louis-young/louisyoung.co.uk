// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RandomSource } from "../../src/lib/password-tool";
import { initPassword } from "../../src/scripts/tool-password";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  localStorage.clear();
});

const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;

const messages = {
  copy: "Copy",
  copied: "Copied",
  "no-sets": "Pick a set.",
  "item-password": "password {number}",
  "item-passphrase": "passphrase {number}",
  "generated-password": "Made {count} passwords, {bits} bits.",
  "generated-passphrase": "Made {count} passphrases, {bits} bits.",
  bits: "{bits} bits",
  "very-weak": "Very weak.",
  weak: "Weak.",
  fair: "Fair.",
  strong: "Strong.",
  "very-strong": "Very strong.",
  instant: "Instantly",
  seconds: "{value} seconds",
  minutes: "{value} minutes",
  hours: "{value} hours",
  days: "{value} days",
  years: "{value} years",
  aeons: "Forever",
};

/** A deterministic pseudo-random source (xorshift32). */
const xorshift = (): RandomSource => {
  let state = 88_675_123;
  return (words) => {
    for (let i = 0; i < words.length; i++) {
      state ^= state << 13;
      state >>>= 0;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      words[i] = state;
    }
    return words;
  };
};

/** Pass "crypto" to use the real Web Crypto source. */
const setup = (source: RandomSource | "crypto" = xorshift()) => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-password ${attributes}>
      <input type="radio" name="k" value="password" checked data-kind />
      <input type="radio" name="k" value="passphrase" data-kind />
      <fieldset data-panel="password">
        <input type="range" min="4" max="128" value="20" data-length /><output data-length-output></output>
        ${["lower", "upper", "digits", "symbols"].map((set) => `<input type="checkbox" value="${set}" checked data-set />`).join("")}
        <input type="checkbox" data-ambiguous />
      </fieldset>
      <fieldset data-panel="passphrase" hidden>
        <input type="range" min="3" max="12" value="5" data-words /><output data-words-output></output>
        <select data-separator><option value="-">-</option><option value=" ">space</option><option value="">none</option></select>
        <select data-capitalisation><option value="lower">lower</option><option value="title">Title</option></select>
        <input type="checkbox" data-digit />
      </fieldset>
      <input type="number" value="5" data-count />
      <button data-generate>Generate</button>
      <button data-copy-all><span data-copy-label>Copy all</span></button>
      <p data-status></p>
      <div data-meter><span data-bar></span><dl><dd data-entropy></dd><dd data-time></dd><dd data-rating></dd></dl></div>
      <ol data-list></ol>
    </div>`;
  initPassword(document, source === "crypto" ? undefined : source);
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const values = () => [...document.querySelectorAll("[data-list] code")].map((code) => code.textContent);
  const set = (selector: string, value: string | boolean) => {
    const element = field(selector);
    if (typeof value === "boolean") element.checked = value;
    else element.value = value;
    element.dispatchEvent(new Event(element.type === "range" ? "input" : "change", { bubbles: true }));
  };
  return { get, values, set };
};

describe("password generator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initPassword();
    }).not.toThrow();
  });

  it("generates several passwords with copy buttons, and rates their strength", () => {
    const { get, values } = setup();
    expect(values()).toHaveLength(5);
    for (const value of values()) expect(value).toHaveLength(20);
    expect(new Set(values()).size).toBe(5);
    expect(get("[data-status]").textContent).toBe("Made 5 passwords, 130 bits.");
    expect(get("[data-entropy]").textContent).toBe("130 bits");
    expect(get("[data-rating]").textContent).toBe("Very strong.");
    expect(get("[data-time]").textContent).toBe("Forever");
    expect(get("[data-meter]").dataset["strength"]).toBe("veryStrong");
    expect(get("[data-bar]").style.width).toBe("100%");
    expect(get("[data-length-output]").textContent).toBe("20");
    const button = get("[data-list] li button");
    expect(button.textContent).toBe("Copy password 1");
  });

  it("follows the options, and explains when no set is picked", () => {
    const { get, values, set } = setup();
    set("[data-length]", "8");
    for (const box of document.querySelectorAll<HTMLInputElement>("[data-set]")) box.checked = false;
    set('[data-set][value="digits"]', true);
    expect(values().every((value) => /^\d{8}$/u.test(value))).toBe(true);
    expect(get("[data-rating]").textContent).toBe("Very weak.");
    expect(get("[data-time]").textContent).toBe("Instantly");
    set("[data-ambiguous]", true);
    expect(values().every((value) => /^[2-9]{8}$/u.test(value))).toBe(true);
    set('[data-set][value="digits"]', false);
    expect(values()).toEqual([]);
    expect(get("[data-status]").textContent).toBe("Pick a set.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-meter]").hidden).toBe(true);
    expect(field("[data-copy-all]").disabled).toBe(true);
  });

  it("switches to passphrases and their options", () => {
    const { get, values, set } = setup();
    set('[data-kind][value="passphrase"]', true);
    expect(get('[data-panel="password"]').hidden).toBe(true);
    expect(get('[data-panel="passphrase"]').hidden).toBe(false);
    expect(values().every((value) => value.split("-").length >= 5)).toBe(true);
    expect(get("[data-status]").textContent).toBe("Made 5 passphrases, 51 bits.");
    expect(get("[data-rating]").textContent).toBe("Weak.");
    expect(get("[data-list] li button").textContent).toBe("Copy passphrase 1");
    set("[data-words]", "8");
    set("[data-capitalisation]", "title");
    set("[data-separator]", " ");
    set("[data-digit]", true);
    expect(get("[data-words-output]").textContent).toBe("8");
    for (const value of values()) {
      expect(value.split(" ").length).toBeGreaterThanOrEqual(8);
      expect(value).toMatch(/^[A-Z]/u);
      expect(value).toMatch(/\d/u);
    }
    expect(get("[data-rating]").textContent).toBe("Strong.");
    expect(get("[data-time]").textContent).toMatch(/years$/u);
  });

  it("clamps how many to make, and regenerates on demand", () => {
    const { get, values, set } = setup();
    set("[data-count]", "50");
    expect(field("[data-count]").value).toBe("20");
    expect(values()).toHaveLength(20);
    const before = values();
    get("[data-generate]").click();
    expect(values()).not.toEqual(before);
  });

  it("copies one value or all of them", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, values } = setup();
    get("[data-list] li button").click();
    expect(writeText).toHaveBeenLastCalledWith(values()[0]);
    get("[data-copy-all]").click();
    expect(writeText).toHaveBeenLastCalledWith(values().join("\n"));
    await Promise.resolve();
  });

  it("uses the Web Crypto API by default, and stores nothing", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    const { values } = setup("crypto");
    expect(values()).toHaveLength(5);
    expect(spy).toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(window.location.hash).toBe("");
    spy.mockRestore();
  });
});
