import { contrastRatio, grades, nearestPassing, parseColour, toHex, type Rgb } from "../lib/colour";
import { fluidClamp } from "../lib/fluid";
import { readingStats } from "../lib/reading-time";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** The contrast checker on /tools/contrast/. */
export const initContrast = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-contrast]");
  if (!tool) return;
  const text = (role: string) => tool.querySelector<HTMLInputElement>(`[data-text="${role}"]`)!;
  const picker = (role: string) => tool.querySelector<HTMLInputElement>(`[data-picker="${role}"]`)!;
  const hint = (role: string) => tool.querySelector<HTMLElement>(`[data-hint="${role}"]`)!;
  const preview = tool.querySelector<HTMLElement>("[data-preview]")!;
  const ratio = tool.querySelector<HTMLOutputElement>("[data-ratio]")!;
  const suggestion = tool.querySelector<HTMLElement>("[data-suggestion]")!;
  const none = tool.querySelector<HTMLElement>("[data-none]")!;
  const announce = tool.querySelector<HTMLElement>("[data-announce]")!;
  const { pass = "Pass", fail = "Fail", status = "{ratio} {verdict}" } = tool.dataset;
  let fixed: Rgb | undefined;

  const read = (role: string) => {
    const colour = parseColour(text(role).value);
    text(role).setAttribute("aria-invalid", String(!colour));
    hint(role).toggleAttribute("data-invalid", !colour);
    if (colour) picker(role).value = toHex(colour);
    return colour;
  };

  const update = () => {
    const foreground = read("foreground");
    const background = read("background");
    if (!foreground || !background) return;
    preview.style.setProperty("color", toHex(foreground));
    preview.style.setProperty("background", toHex(background));
    const value = contrastRatio(foreground, background);
    const shown = (Math.floor(value * 100) / 100).toFixed(2);
    ratio.value = `${shown}:1`;
    const results = grades(value);
    for (const check of tool.querySelectorAll<HTMLElement>("[data-check]")) {
      const ok = results[check.dataset["check"] as keyof typeof results];
      const badge = check.querySelector<HTMLElement>("[data-badge]")!;
      badge.dataset["result"] = ok ? "pass" : "fail";
      badge.textContent = ok ? pass : fail;
    }
    fixed = results.aaText ? undefined : nearestPassing(foreground, background, 4.5);
    suggestion.hidden = !fixed;
    none.hidden = results.aaText || Boolean(fixed);
    if (fixed) {
      tool.querySelector<HTMLElement>("[data-suggestion-chip]")!.style.setProperty("background", toHex(fixed));
      tool.querySelector<HTMLElement>("[data-suggestion-value]")!.textContent = toHex(fixed);
    }
    announce.textContent = fill(status, { ratio: shown, verdict: results.aaText ? pass : fail });
  };

  for (const role of ["foreground", "background"]) {
    text(role).addEventListener("input", update);
    picker(role).addEventListener("input", () => {
      text(role).value = picker(role).value;
      update();
    });
  }
  tool.querySelector("[data-swap]")!.addEventListener("click", () => {
    [text("foreground").value, text("background").value] = [text("background").value, text("foreground").value];
    update();
  });
  tool.querySelector("[data-apply]")!.addEventListener("click", () => {
    if (!fixed) return;
    text("foreground").value = toHex(fixed);
    update();
  });
  update();
};

/** The clamp() generator on /tools/clamp/. */
export const initClamp = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-clamp]");
  if (!tool) return;
  const output = tool.querySelector<HTMLOutputElement>("output")!;
  const error = tool.querySelector<HTMLElement>("[data-error]")!;
  const preview = tool.querySelector<HTMLElement>("[data-clamp-preview]")!;
  const number = (name: string) => Number(tool.querySelector<HTMLInputElement>(`[name="${name}"]`)!.value);

  const update = () => {
    const result = fluidClamp({
      minSize: number("minSize"),
      maxSize: number("maxSize"),
      minViewport: number("minViewport"),
      maxViewport: number("maxViewport"),
      root: number("root"),
    });
    if ("error" in result) {
      error.textContent = tool.dataset[result.error === "positive" ? "errorPositive" : "errorViewports"] ?? "";
      error.hidden = false;
      return;
    }
    error.hidden = true;
    output.value = result.css;
    preview.style.setProperty("font-size", result.css);
  };

  tool.addEventListener("input", update);
  const copy = async (button: HTMLButtonElement) => {
    try {
      await navigator.clipboard.writeText(output.value);
      button.textContent = tool.dataset["copied"] ?? "";
    } catch {
      /* Selecting the output by hand still works. */
    }
  };
  tool.querySelector("[data-copy]")?.addEventListener("click", (event) => {
    void copy(event.currentTarget as HTMLButtonElement);
  });
  update();
};

/** The reading-time estimator on /tools/reading-time/. */
export const initReadingTime = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-reading]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("textarea")!;
  const field = (name: string) => tool.querySelector<HTMLElement>(`[data-stat="${name}"]`)!;
  const update = () => {
    const stats = readingStats(input.value);
    const empty = input.value.trim() === "";
    field("words").textContent = String(stats.words);
    field("codeLines").textContent = String(stats.codeLines);
    field("minutes").textContent = empty ? "0" : String(stats.minutes);
  };
  input.addEventListener("input", update);
  update();
};
