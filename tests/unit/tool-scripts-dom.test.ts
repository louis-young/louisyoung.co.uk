// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initColour } from "../../src/scripts/tool-colour";
import { copyText } from "../../src/scripts/tool-copy";
import { initEasing } from "../../src/scripts/tool-easing";
import { initUnits } from "../../src/scripts/tool-units";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const type = (element: HTMLInputElement | HTMLSelectElement, value: string, event = "input") => {
  element.value = value;
  element.dispatchEvent(new Event(event, { bubbles: true }));
};

const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
const inputEl = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
const outputEl = (selector: string) => document.querySelector<HTMLOutputElement>(selector)!;
const selectEl = (selector: string) => document.querySelector<HTMLSelectElement>(selector)!;

const stubClipboard = (writeText = vi.fn().mockResolvedValue(undefined)) => {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  return writeText;
};

describe("copyText", () => {
  it("copies, confirms and restores the label", async () => {
    vi.useFakeTimers();
    const writeText = stubClipboard();
    document.body.innerHTML = `<button><span data-copy-label>Copy</span> hex</button>`;
    await copyText(get("button"), "#fff", "Copied");
    expect(writeText).toHaveBeenCalledWith("#fff");
    expect(get("[data-copy-label]").textContent).toBe("Copied");
    await copyText(get("button"), "#fff", "Copied");
    vi.advanceTimersByTime(1500);
    expect(get("[data-copy-label]").textContent).toBe("Copy");
  });

  it("uses the button itself without a label, and ignores a blocked clipboard", async () => {
    stubClipboard();
    document.body.innerHTML = `<button>Copy</button>`;
    await copyText(get("button"), "x", "Copied");
    expect(get("button").textContent).toBe("Copied");
    stubClipboard(vi.fn().mockRejectedValue(new Error("denied")));
    document.body.innerHTML = `<button>Copy</button>`;
    await copyText(get("button"), "x", "Copied");
    expect(get("button").textContent).toBe("Copy");
  });
});

describe("colour converter", () => {
  const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const setup = (value = "#7c6cf0") => {
    document.body.innerHTML = `
      <div data-colour data-copied="Copied">
        <input data-picker type="color" /><input data-input value="${value}" /><p data-hint></p>
        <div data-preview></div>
        ${["hex", "rgb", "hsl", "oklch"]
          .map((format) => `<output data-format="${format}"></output><button data-copy="${format}">Copy</button>`)
          .join("")}
        <button data-copy="missing">Copy</button>
        ${steps
          .filter((step) => step !== 950)
          .map(
            (step) => `<li data-step="${step}"><span data-chip></span><code data-hex></code>
              <dd data-on-white></dd><dd data-on-black></dd></li>`,
          )
          .join("")}
        <input data-name value="brand" />
        <output data-css></output><button data-copy="css">Copy</button>
      </div>`;
    initColour();
  };

  it("does nothing without the tool", () => {
    expect(() => {
      initColour();
    }).not.toThrow();
  });

  it("shows every format, the scale and the CSS", () => {
    setup("hsl(0 100% 50%)");
    expect(outputEl('[data-format="hex"]').value).toBe("#ff0000");
    expect(outputEl('[data-format="rgb"]').value).toBe("rgb(255 0 0)");
    expect(outputEl('[data-format="oklch"]').value).toMatch(/^oklch\(62\.\d+% 0\.25/u);
    expect(inputEl("[data-picker]").value).toBe("#ff0000");
    expect(get("[data-preview]").style.getPropertyValue("background")).not.toBe("");
    expect(get('[data-step="50"] [data-hex]').textContent).toMatch(/^#[\da-f]{6}$/u);
    expect(get('[data-step="50"] [data-on-black]').textContent).toMatch(/^\d+\.\d\d:1$/u);
    expect(get('[data-step="500"] [data-chip]').style.getPropertyValue("background")).not.toBe("");
    expect(outputEl("[data-css]").value).toContain("--brand-950: #");
  });

  it("flags invalid input and keeps the last good result", () => {
    setup();
    const input = inputEl("[data-input]");
    type(input, "nope");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-hint]").hasAttribute("data-invalid")).toBe(true);
    expect(outputEl('[data-format="hex"]').value).toBe("#7c6cf0");
    type(input, "rgb(0 0 0)");
    expect(input.getAttribute("aria-invalid")).toBe("false");
    expect(outputEl('[data-format="hex"]').value).toBe("#000000");
  });

  it("follows the picker and the property name", () => {
    setup();
    type(inputEl("[data-picker]"), "#00ff00");
    expect(inputEl("[data-input]").value).toBe("#00ff00");
    expect(outputEl('[data-format="hsl"]').value).toBe("hsl(120 100% 50%)");
    type(inputEl("[data-name]"), "Accent");
    expect(outputEl("[data-css]").value).toContain("--accent-50:");
  });

  it("copies a format and the CSS", async () => {
    const writeText = stubClipboard();
    setup();
    get('[data-copy="hex"]').click();
    get('[data-copy="css"]').click();
    get('[data-copy="missing"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(3);
    });
    expect(writeText).toHaveBeenNthCalledWith(1, "#7c6cf0");
    expect(writeText).toHaveBeenNthCalledWith(2, expect.stringContaining(":root {"));
    expect(writeText).toHaveBeenNthCalledWith(3, "");
  });
});

describe("unit converter", () => {
  const setup = () => {
    document.body.innerHTML = `
      <div data-units data-error-value="Value" data-error-context="Context" data-copied="Copied">
        <input name="value" value="24" />
        <select name="unit">${["px", "rem", "em", "pt", "vw", "vh", "%", "ch"]
          .map((unit) => `<option>${unit}</option>`)
          .join("")}</select>
        <input name="root" value="16" /><input name="parent" value="16" />
        <input name="viewportWidth" value="1000" /><input name="viewportHeight" value="800" />
        <p data-error hidden></p>
        <table><tbody>${["px", "rem", "em", "pt", "vw", "vh"]
          .map(
            (unit) =>
              `<tr data-unit="${unit}"><th><code data-value></code></th><td><button data-copy="${unit}">Copy</button></td></tr>`,
          )
          .join("")}</tbody></table>
        <button data-copy="%">Copy</button>
      </div>`;
    initUnits();
    const value = (unit: string) => get(`tr[data-unit="${unit}"] [data-value]`).textContent;
    return { value };
  };

  it("does nothing without the tool", () => {
    expect(() => {
      initUnits();
    }).not.toThrow();
  });

  it("converts as you type and marks the source unit", () => {
    const { value } = setup();
    expect(value("rem")).toBe("1.5rem");
    expect(value("vw")).toBe("2.4vw");
    expect(get('tr[data-unit="px"]').hasAttribute("data-current")).toBe(true);
    type(selectEl('[name="unit"]'), "rem", "change");
    expect(value("px")).toBe("384px");
    expect(get('tr[data-unit="px"]').hasAttribute("data-current")).toBe(false);
    expect(get('tr[data-unit="rem"]').hasAttribute("data-current")).toBe(true);
    type(inputEl('[name="root"]'), "10");
    expect(value("px")).toBe("240px");
  });

  it("explains bad input and recovers", () => {
    const { value } = setup();
    type(inputEl('[name="value"]'), "");
    expect(get("[data-error]").textContent).toBe("Value");
    expect(get("[data-error]").hidden).toBe(false);
    type(inputEl('[name="value"]'), "24");
    type(inputEl('[name="parent"]'), "0");
    expect(get("[data-error]").textContent).toBe("Context");
    type(inputEl('[name="parent"]'), "16");
    expect(get("[data-error]").hidden).toBe(true);
    type(selectEl('[name="unit"]'), "ch", "change");
    expect(value("rem")).toBe("1.5rem");
  });

  it("copies a row", async () => {
    const writeText = stubClipboard();
    setup();
    get('[data-copy="rem"]').click();
    get('[data-copy="%"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(writeText).toHaveBeenNthCalledWith(1, "1.5rem");
    expect(writeText).toHaveBeenNthCalledWith(2, "");
  });
});

describe("easing editor", () => {
  const setup = () => {
    document.body.innerHTML = `
      <div data-easing data-value-text="Time {x}, progress {y}" data-copied="Copied">
        <div data-plot>
          <svg><line data-arm="1"></line><line data-arm="2"></line><path data-curve></path></svg>
          <div data-handle="1" tabindex="0"></div><div data-handle="2" tabindex="0"></div>
        </div>
        <input name="x1" value="0.16" /><input name="y1" value="1" />
        <input name="x2" value="0.3" /><input name="y2" value="1" />
        <button data-preset="ease" aria-pressed="false"></button>
        <button data-preset="ease-out-expo" aria-pressed="false"></button>
        <button data-preset="unknown" aria-pressed="false"></button>
        <output data-output></output><button data-copy><span data-copy-label>Copy</span></button>
        <div data-tracks></div>
      </div>`;
    initEasing();
    return {
      output: () => outputEl("[data-output]").value,
      handle: (index: number) => get(`[data-handle="${index}"]`),
      input: (name: string) => inputEl(`[name="${name}"]`),
    };
  };

  const key = (element: HTMLElement, name: string, shiftKey = false) => {
    const event = new KeyboardEvent("keydown", { key: name, shiftKey, cancelable: true });
    element.dispatchEvent(event);
    return event;
  };

  it("does nothing without the tool", () => {
    expect(() => {
      initEasing();
    }).not.toThrow();
  });

  it("renders the starting curve", () => {
    const { output, handle } = setup();
    expect(output()).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(get("[data-curve]").getAttribute("d")).toMatch(/^M0 240 L/u);
    expect(get("[data-tracks]").style.getPropertyValue("--curve")).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    expect(handle(1).getAttribute("aria-valuenow")).toBe("0.16");
    expect(handle(1).getAttribute("aria-valuetext")).toBe("Time 0.16, progress 1");
    expect(handle(1).style.getPropertyValue("left")).toBe("16%");
    expect(get('[data-arm="2"]').getAttribute("x1")).toBe("200");
    expect(get('[data-preset="ease-out-expo"]').getAttribute("aria-pressed")).toBe("true");
  });

  it("moves handles with the arrow keys, clamping x", () => {
    const { output, handle, input } = setup();
    expect(key(handle(1), "ArrowRight").defaultPrevented).toBe(true);
    expect(output()).toBe("cubic-bezier(0.17, 1, 0.3, 1)");
    key(handle(1), "ArrowDown", true);
    expect(output()).toBe("cubic-bezier(0.17, 0.9, 0.3, 1)");
    expect(input("y1").value).toBe("0.9");
    for (let index = 0; index < 10; index += 1) key(handle(2), "ArrowRight", true);
    key(handle(2), "ArrowUp");
    key(handle(2), "ArrowLeft");
    expect(output()).toBe("cubic-bezier(0.17, 0.9, 0.99, 1.01)");
    expect(key(handle(2), "Enter").defaultPrevented).toBe(false);
    expect(get('[data-preset="ease-out-expo"]').getAttribute("aria-pressed")).toBe("false");
  });

  it("follows typed values without rewriting them until they change", () => {
    const { output, input } = setup();
    type(input("x1"), "1.5");
    expect(output()).toBe("cubic-bezier(1, 1, 0.3, 1)");
    expect(input("x1").value).toBe("1.5");
    input("x1").dispatchEvent(new Event("change"));
    expect(input("x1").value).toBe("1");
  });

  it("applies presets", () => {
    const { output, input } = setup();
    get('[data-preset="ease"]').click();
    expect(output()).toBe("cubic-bezier(0.25, 0.1, 0.25, 1)");
    expect(input("y1").value).toBe("0.1");
    expect(get('[data-preset="ease"]').getAttribute("aria-pressed")).toBe("true");
    get('[data-preset="unknown"]').click();
    expect(output()).toBe("cubic-bezier(0.25, 0.1, 0.25, 1)");
  });

  it("drags a handle with the pointer", () => {
    const { output, handle } = setup();
    const plot = get("[data-plot]");
    const box = { left: 0, top: 0, width: 200, height: 330 };
    vi.spyOn(plot, "getBoundingClientRect").mockReturnValue(box as DOMRect);
    let captured = false;
    const target = handle(2);
    target.setPointerCapture = () => {
      captured = true;
    };
    target.hasPointerCapture = () => captured;
    const pointer = (type: string, clientX: number, clientY: number) => {
      const event = new MouseEvent(type, { clientX, clientY, cancelable: true }) as MouseEvent & { pointerId: number };
      Object.defineProperty(event, "pointerId", { value: 1 });
      target.dispatchEvent(event);
    };
    pointer("pointermove", 100, 165);
    expect(output()).toBe("cubic-bezier(0.16, 1, 0.3, 1)");
    pointer("pointerdown", 0, 0);
    expect(document.activeElement).toBe(target);
    pointer("pointermove", 100, 165);
    expect(output()).toBe("cubic-bezier(0.16, 1, 0.5, 0.5)");
    box.width = 0;
    pointer("pointermove", 0, 0);
    expect(output()).toBe("cubic-bezier(0.16, 1, 0.5, 0.5)");
  });

  it("copies the CSS", async () => {
    const writeText = stubClipboard();
    setup();
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(get("[data-copy-label]").textContent).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("cubic-bezier(0.16, 1, 0.3, 1)");
  });
});
