// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initCssGenerator } from "../../src/scripts/tool-css-generator";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const slider = (prop: string) =>
  `<div data-pair><label>${prop}<input type="range" min="-100" max="200" data-prop="${prop}" /></label>
    <input type="number" data-prop="${prop}" aria-label="${prop}" /></div>`;

const setup = (type = "linear") => {
  document.body.innerHTML = `
    <div data-css-gen data-layer="Layer {number}" data-stop="Stop {number}" data-added="{name} added."
      data-removed="{name} removed." data-copied="Copied">
      <div data-layers>
        <fieldset data-layer><legend data-name>Layer 1</legend>
          ${["x", "y", "blur", "spread", "opacity"].map(slider).join("")}
          <input type="color" data-prop="colour" /><input type="checkbox" data-prop="inset" />
          <button type="button" data-remove>Remove <span data-name>Layer 1</span></button>
        </fieldset>
      </div>
      <p data-no-layers hidden></p>
      <button type="button" data-add-layer>Add layer</button>
      <input type="radio" name="css-gen-type" value="linear" ${type === "linear" ? "checked" : ""} />
      <input type="radio" name="css-gen-type" value="radial" ${type === "radial" ? "checked" : ""} />
      <div data-angle-field>
        <input type="range" data-angle value="135" /><input type="number" data-angle value="135" />
      </div>
      <div data-stops>
        <fieldset data-stop><legend data-name>Stop 1</legend>
          <input type="color" data-prop="colour" />${slider("position")}
          <button type="button" data-remove>Remove <span data-name>Stop 1</span></button>
        </fieldset>
      </div>
      <button type="button" data-add-stop>Add stop</button>
      <div data-preview></div>
      <code data-output></code>
      <button type="button" data-copy><span data-copy-label>Copy</span></button>
      <p data-announce></p>
    </div>`;
  initCssGenerator();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const all = (selector: string) => [...document.querySelectorAll<HTMLInputElement>(selector)];
  const set = (input: HTMLInputElement, value: string, event = "input") => {
    if (input.type === "checkbox") input.checked = value === "on";
    else input.value = value;
    input.dispatchEvent(new Event(event, { bubbles: true }));
  };
  const layer = (index: number) => document.querySelectorAll<HTMLElement>("[data-layers] fieldset")[index]!;
  const stop = (index: number) => document.querySelectorAll<HTMLElement>("[data-stops] fieldset")[index]!;
  const output = () => get("[data-output]").textContent;
  return { get, all, set, layer, stop, output };
};

describe("shadow and gradient generator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initCssGenerator();
    }).not.toThrow();
  });

  it("renders the default layers and stops, the preview and the CSS", () => {
    const { get, layer, stop, output } = setup();
    expect(document.querySelectorAll("[data-layers] fieldset")).toHaveLength(2);
    expect(layer(1).querySelector("legend")?.textContent).toBe("Layer 2");
    expect(layer(1).querySelector<HTMLInputElement>('input[type="range"][data-prop="blur"]')?.value).toBe("32");
    expect(stop(0).querySelector<HTMLInputElement>('[data-prop="colour"]')?.value).toBe("#7c6cf0");
    expect(stop(0).querySelector<HTMLButtonElement>("[data-remove]")?.disabled).toBe(true);
    expect(output()).toContain("background: linear-gradient(135deg, #7c6cf0 0%, #22d3ee 100%);");
    expect(output()).toContain("box-shadow: 0 1px 2px 0 rgb(15 23 42 / 0.12), 0 12px 32px -8px rgb(15 23 42 / 0.28);");
    expect(get("[data-preview]").style.boxShadow).not.toBe("");
    expect(get("[data-angle-field]").hidden).toBe(false);
  });

  it("keeps each slider and its number box in step", () => {
    const { layer, set, output } = setup();
    const range = layer(0).querySelector<HTMLInputElement>('input[type="range"][data-prop="y"]')!;
    const number = layer(0).querySelector<HTMLInputElement>('input[type="number"][data-prop="y"]')!;
    set(range, "10");
    expect(number.value).toBe("10");
    expect(output()).toContain("box-shadow: 0 10px 2px 0");
    set(number, "");
    expect(number.value).toBe("");
    expect(range.value).toBe("-100");
    set(number, "-5", "change");
    expect(number.value).toBe("-5");
    expect(range.value).toBe("-5");
    set(layer(0).querySelector<HTMLInputElement>('[data-prop="inset"]')!, "on", "change");
    set(layer(0).querySelector<HTMLInputElement>('[data-prop="colour"]')!, "#ff0000");
    expect(output()).toContain("box-shadow: inset 0 -5px 2px 0 rgb(255 0 0 / 0.12)");
  });

  it("adds and removes layers up to the limit, announcing each", () => {
    const { get, layer, output } = setup();
    const add = get("[data-add-layer]") as HTMLButtonElement;
    add.click();
    expect(get("[data-announce]").textContent).toBe("Layer 3 added.");
    expect(document.activeElement).toBe(layer(2).querySelector("input"));
    add.click();
    add.click();
    expect(add.disabled).toBe(true);
    for (let i = 0; i < 5; i++) layer(0).querySelector<HTMLButtonElement>("[data-remove]")!.click();
    expect(get("[data-announce]").textContent).toBe("Layer 1 removed.");
    expect(document.activeElement).toBe(add);
    expect(get("[data-no-layers]").hidden).toBe(false);
    expect(output()).toContain("box-shadow: none;");
    expect(add.disabled).toBe(false);
  });

  it("builds the gradient from the type, angle and stops", () => {
    const { get, all, set, stop, output } = setup();
    const [range, number] = all("[data-angle]");
    set(range!, "90");
    expect(number!.value).toBe("90");
    set(number!, "400", "change");
    expect(number!.value).toBe("360");
    expect(output()).toContain("linear-gradient(360deg,");
    set(stop(1).querySelector<HTMLInputElement>('input[type="number"][data-prop="position"]')!, "40", "change");
    const add = get("[data-add-stop]") as HTMLButtonElement;
    add.click();
    expect(get("[data-announce]").textContent).toBe("Stop 3 added.");
    expect(output()).toContain("#7c6cf0 0%, #22d3ee 40%, #22d3ee 100%");
    expect(stop(0).querySelector<HTMLButtonElement>("[data-remove]")?.disabled).toBe(false);
    stop(1).querySelector<HTMLButtonElement>("[data-remove]")!.click();
    expect(get("[data-announce]").textContent).toBe("Stop 2 removed.");
    const radial = document.querySelector<HTMLInputElement>('[value="radial"]')!;
    radial.checked = true;
    radial.dispatchEvent(new Event("change"));
    expect(output()).toContain("radial-gradient(circle, #7c6cf0 0%, #22d3ee 100%)");
    expect(get("[data-angle-field]").hidden).toBe(true);
    for (let i = 0; i < 6; i++) add.click();
    expect(add.disabled).toBe(true);
  });

  it("starts radial when the browser restored that choice, and copies the CSS", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, output } = setup("radial");
    expect(output()).toContain("radial-gradient(");
    get("[data-copy]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(output());
    });
  });

  it("ignores events from elements that aren’t controls", () => {
    const { layer, output } = setup();
    const before = output();
    layer(0)
      .querySelector("legend")!
      .dispatchEvent(new Event("input", { bubbles: true }));
    layer(0).querySelector("legend")!.click();
    expect(output()).toBe(before);
    expect(document.querySelectorAll("[data-layers] fieldset")).toHaveLength(2);
  });
});
