import { formats, parseAnyColour, ratioText, scaleCss, tonalScale } from "../lib/colour-convert";
import { copyText } from "./tool-copy";

/** The colour converter and palette on /tools/colour/. */
export const initColour = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-colour]");
  if (!tool) return;
  const input = tool.querySelector<HTMLInputElement>("[data-input]")!;
  const picker = tool.querySelector<HTMLInputElement>("[data-picker]")!;
  const hint = tool.querySelector<HTMLElement>("[data-hint]")!;
  const name = tool.querySelector<HTMLInputElement>("[data-name]")!;
  const preview = tool.querySelector<HTMLElement>("[data-preview]")!;
  const css = tool.querySelector<HTMLOutputElement>("[data-css]")!;
  const outputs = (format: string) => tool.querySelector<HTMLOutputElement>(`[data-format="${format}"]`);

  const update = () => {
    const colour = parseAnyColour(input.value);
    input.setAttribute("aria-invalid", String(!colour));
    hint.toggleAttribute("data-invalid", !colour);
    if (!colour) return;
    const values = formats(colour);
    picker.value = values.hex;
    preview.style.setProperty("background", values.hex);
    for (const [format, value] of Object.entries(values)) {
      const output = outputs(format);
      if (output) output.value = value;
    }
    const scale = tonalScale(colour);
    for (const step of scale) {
      const item = tool.querySelector<HTMLElement>(`[data-step="${step.step}"]`);
      if (!item) continue;
      item.querySelector<HTMLElement>("[data-chip]")?.style.setProperty("background", step.hex);
      item.querySelector("[data-hex]")!.textContent = step.hex;
      item.querySelector("[data-on-white]")!.textContent = ratioText(step.onWhite);
      item.querySelector("[data-on-black]")!.textContent = ratioText(step.onBlack);
    }
    css.value = scaleCss(scale, name.value);
  };

  input.addEventListener("input", update);
  name.addEventListener("input", update);
  picker.addEventListener("input", () => {
    input.value = picker.value;
    update();
  });
  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      const format = button.dataset["copy"] ?? "";
      const text = format === "css" ? css.value : (outputs(format)?.value ?? "");
      void copyText(button, text, tool.dataset["copied"] ?? "");
    });
  }
  update();
};
