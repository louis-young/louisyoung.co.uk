// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initClamp, initContrast, initReadingTime } from "../../src/scripts/tools";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("contrast checker", () => {
  const setup = (foreground: string, background: string) => {
    document.body.innerHTML = `
      <div data-contrast data-pass="Pass" data-fail="Fail" data-status="{ratio}:1 {verdict}">
        ${["foreground", "background"]
          .map(
            (role) => `<input data-picker="${role}" type="color" />
              <input data-text="${role}" value="${role === "foreground" ? foreground : background}" />
              <p data-hint="${role}"></p>`,
          )
          .join("")}
        <button data-swap></button>
        <div data-preview></div>
        <output data-ratio></output>
        <ul>
          <li data-check="aaText"><span data-badge></span></li>
          <li data-check="nonText"><span data-badge></span></li>
        </ul>
        <div data-suggestion hidden><span data-suggestion-chip></span><code data-suggestion-value></code>
          <button data-apply></button></div>
        <p data-none hidden></p>
        <p data-announce></p>
      </div>`;
    initContrast();
    const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
    return { get, text: (role: string) => get(`[data-text="${role}"]`) as HTMLInputElement };
  };

  it("does nothing without the tool", () => {
    expect(() => {
      initContrast();
    }).not.toThrow();
  });

  it("shows the ratio, grades and an announcement", () => {
    const { get } = setup("#000", "#fff");
    expect((get("[data-ratio]") as HTMLOutputElement).value).toBe("21.00:1");
    expect(get('[data-check="aaText"] [data-badge]').textContent).toBe("Pass");
    expect(get("[data-announce]").textContent).toBe("21.00:1 Pass");
    expect(get("[data-suggestion]").hidden).toBe(true);
    expect((get('[data-picker="foreground"]') as HTMLInputElement).value).toBe("#000000");
  });

  it("suggests a passing colour and applies it", () => {
    const { get, text } = setup("#999999", "#ffffff");
    expect(get('[data-check="aaText"] [data-badge]').textContent).toBe("Fail");
    expect(get("[data-suggestion]").hidden).toBe(false);
    const suggested = get("[data-suggestion-value]").textContent;
    (get("[data-apply]") as HTMLButtonElement).click();
    expect(text("foreground").value).toBe(suggested);
    expect(get('[data-check="aaText"] [data-badge]').textContent).toBe("Pass");
  });

  it("says when nothing passes, swaps colours and flags invalid input", () => {
    const { get, text } = setup("#777777", "#767676");
    expect(get("[data-none]").hidden).toBe(true);
    (get("[data-swap]") as HTMLButtonElement).click();
    expect(text("foreground").value).toBe("#767676");
    type(text("background"), "nope");
    expect(text("background").getAttribute("aria-invalid")).toBe("true");
    expect(get('[data-hint="background"]').hasAttribute("data-invalid")).toBe(true);
    const picker = get('[data-picker="background"]') as HTMLInputElement;
    picker.value = "#ffffff";
    picker.dispatchEvent(new Event("input"));
    expect(text("background").value).toBe("#ffffff");
    expect(text("background").getAttribute("aria-invalid")).toBe("false");
  });
});

describe("clamp generator", () => {
  const setup = () => {
    document.body.innerHTML = `
      <div data-clamp data-error-positive="Positive" data-error-viewports="Viewports" data-copied="Copied">
        <input name="minSize" value="16" /><input name="maxSize" value="24" />
        <input name="minViewport" value="320" /><input name="maxViewport" value="1280" />
        <input name="root" value="16" />
        <output></output><button type="button" data-copy>Copy</button>
        <p data-error hidden></p><p data-clamp-preview></p>
      </div>`;
    initClamp();
    return (selector: string) => document.querySelector<HTMLElement>(selector)!;
  };

  it("does nothing without the tool", () => {
    expect(() => {
      initClamp();
    }).not.toThrow();
  });

  it("writes the clamp and previews it", () => {
    const get = setup();
    expect((get("output") as HTMLOutputElement).value).toBe("clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)");
    expect(get("[data-clamp-preview]").style.getPropertyValue("font-size")).toContain("clamp(");
  });

  it("explains invalid input and recovers", () => {
    const get = setup();
    type(get('[name="minSize"]') as HTMLInputElement, "0");
    expect(get("[data-error]").textContent).toBe("Positive");
    type(get('[name="minSize"]') as HTMLInputElement, "16");
    type(get('[name="minViewport"]') as HTMLInputElement, "2000");
    expect(get("[data-error]").textContent).toBe("Viewports");
    type(get('[name="minViewport"]') as HTMLInputElement, "320");
    expect(get("[data-error]").hidden).toBe(true);
  });

  it("copies the CSS, and survives a blocked clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const get = setup();
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(get("[data-copy]").textContent).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("clamp(1rem, 0.8333rem + 0.8333vw, 1.5rem)");
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const again = setup();
    again("[data-copy]").click();
    await Promise.resolve();
    expect(again("[data-copy]").textContent).toBe("Copy");
  });
});

describe("reading-time estimator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initReadingTime();
    }).not.toThrow();
  });

  it("counts words, code lines and minutes as you type", () => {
    document.body.innerHTML = `<div data-reading><textarea></textarea>
      <dd data-stat="words"></dd><dd data-stat="codeLines"></dd><dd data-stat="minutes"></dd></div>`;
    initReadingTime();
    const stat = (name: string) => document.querySelector(`[data-stat="${name}"]`)!.textContent;
    expect(stat("minutes")).toBe("0");
    type(document.querySelector("textarea")!, `${"word ".repeat(460)}\n\`\`\`js\nconst a = 1;\nconst b = 2;\n\`\`\``);
    expect(stat("words")).toBe("460");
    expect(stat("codeLines")).toBe("2");
    expect(stat("minutes")).toBe("2");
  });
});
