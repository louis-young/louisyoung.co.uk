import {
  aspectRatioCss,
  decimalRatio,
  nearestRatio,
  parseRatio,
  reduceRatio,
  solveHeight,
  solveWidth,
  tidy,
} from "../lib/aspect-ratio-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);

/** The aspect ratio calculator on /tools/aspect-ratio/. */
export const initAspectRatio = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-aspect]");
  if (!tool) return;
  const width = tool.querySelector<HTMLInputElement>("[data-width]")!;
  const height = tool.querySelector<HTMLInputElement>("[data-height]")!;
  const ratioInput = tool.querySelector<HTMLInputElement>("[data-ratio]")!;
  const ratioMessage = tool.querySelector<HTMLElement>("[data-ratio-message]")!;
  const lock = tool.querySelector<HTMLInputElement>("[data-lock]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const reducedOut = tool.querySelector<HTMLElement>("[data-reduced]")!;
  const decimalOut = tool.querySelector<HTMLElement>("[data-decimal]")!;
  const nearestOut = tool.querySelector<HTMLElement>("[data-nearest]")!;
  const box = tool.querySelector<HTMLElement>("[data-box]")!;
  const boxRatio = tool.querySelector<HTMLElement>("[data-box-ratio]")!;
  const boxSize = tool.querySelector<HTMLElement>("[data-box-size]")!;
  const css = tool.querySelector<HTMLElement>("[data-css]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  let ratio = reduceRatio(width.valueAsNumber, height.valueAsNumber);

  const setRatioValidity = (valid: boolean) => {
    ratioInput.setAttribute("aria-invalid", String(!valid));
    ratioMessage.toggleAttribute("data-invalid", !valid);
    ratioMessage.textContent = message(valid ? "ratioHint" : "errorRatio");
  };

  /** Shows the current width and height everywhere except the field being typed in. */
  const render = (source?: HTMLInputElement) => {
    const w = width.valueAsNumber;
    const h = height.valueAsNumber;
    // A side solved from a ratio is rounded, so the ratio it came from reads better than its own.
    const own = reduceRatio(w, h);
    const reduced =
      own && ratio && Math.abs((w * ratio.height) / (h * ratio.width) - 1) < 0.001
        ? reduceRatio(ratio.width, ratio.height)
        : own;
    const valid = reduced !== undefined;
    width.setAttribute("aria-invalid", String(!(w > 0)));
    height.setAttribute("aria-invalid", String(!(h > 0)));
    status.toggleAttribute("data-invalid", !valid);
    copy.disabled = !valid;
    if (!valid) {
      status.textContent = message("invalid");
      for (const output of [reducedOut, decimalOut, nearestOut, css]) output.textContent = "–";
      return;
    }
    const text = `${reduced.width}:${reduced.height}`;
    const nearest = nearestRatio(w, h);
    const near = nearest.exact
      ? fill(message("exact"), { ratio: nearest.id })
      : fill(message("near"), { ratio: nearest.id, off: tidy(nearest.off) });
    status.textContent = fill(message("statusText"), {
      width: tidy(w),
      height: tidy(h),
      ratio: text,
      nearest: near,
    });
    reducedOut.textContent = text;
    decimalOut.textContent = decimalRatio(w, h);
    nearestOut.textContent = nearest.exact ? nearest.id : `≈ ${nearest.id}`;
    if (source !== ratioInput) {
      ratioInput.value = text;
      setRatioValidity(true);
    }
    box.style.setProperty("--ratio", String(w / h));
    boxRatio.textContent = text;
    boxSize.textContent = `${tidy(w)} × ${tidy(h)}`;
    css.textContent = aspectRatioCss(reduced.width, reduced.height);
  };

  width.addEventListener("input", () => {
    if (lock.checked && ratio && width.valueAsNumber > 0) height.value = tidy(solveHeight(width.valueAsNumber, ratio));
    else ratio = reduceRatio(width.valueAsNumber, height.valueAsNumber) ?? ratio;
    render(width);
  });
  height.addEventListener("input", () => {
    if (lock.checked && ratio && height.valueAsNumber > 0) width.value = tidy(solveWidth(height.valueAsNumber, ratio));
    else ratio = reduceRatio(width.valueAsNumber, height.valueAsNumber) ?? ratio;
    render(height);
  });
  ratioInput.addEventListener("input", () => {
    const parsed = parseRatio(ratioInput.value);
    setRatioValidity(parsed !== undefined);
    if (!parsed) return;
    ratio = parsed;
    if (width.valueAsNumber > 0) height.value = tidy(solveHeight(width.valueAsNumber, parsed));
    render(ratioInput);
  });
  for (const preset of tool.querySelectorAll<HTMLButtonElement>("[data-preset-width]")) {
    preset.addEventListener("click", () => {
      width.value = preset.dataset["presetWidth"] ?? "";
      height.value = preset.dataset["presetHeight"] ?? "";
      ratio = reduceRatio(width.valueAsNumber, height.valueAsNumber);
      render();
    });
  }
  copy.addEventListener("click", () => {
    void copyText(copy, css.textContent, message("copied"));
  });
  render();
};
