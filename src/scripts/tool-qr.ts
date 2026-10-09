import { contrastRatio, luminance, parseColour } from "../lib/colour";
import {
  byteCapacity,
  encodeQr,
  type ErrorCorrection,
  MIN_SCAN_CONTRAST,
  modulePath,
  type QrCode,
  qrSvg,
  QUIET_ZONE,
} from "../lib/qr-tool";
import { copyText } from "./tool-copy";

const SVG = "http://www.w3.org/2000/svg";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** Shortens long text for the code's accessible name. */
const excerpt = (text: string, max = 80) => {
  const flat = text.replace(/\s+/gu, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
};

const download = (href: string, name: string) => {
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
};

const downloadBlob = (blob: Blob, name: string) => {
  const url = URL.createObjectURL(blob);
  download(url, name);
  // Give the browser a moment to start the download before letting the URL go.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
};

/** The QR code generator on /tools/qr/. */
export const initQr = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-qr]");
  if (!tool) return;
  const text = tool.querySelector<HTMLTextAreaElement>("[data-text]")!;
  const levels = [...tool.querySelectorAll<HTMLInputElement>("[data-level]")];
  const foreground = tool.querySelector<HTMLInputElement>("[data-foreground]")!;
  const background = tool.querySelector<HTMLInputElement>("[data-background]")!;
  const foregroundValue = tool.querySelector<HTMLElement>("[data-foreground-value]")!;
  const backgroundValue = tool.querySelector<HTMLElement>("[data-background-value]")!;
  const contrastNote = tool.querySelector<HTMLElement>("[data-contrast-note]")!;
  const preview = tool.querySelector<HTMLElement>("[data-preview]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const stats = tool.querySelector<HTMLElement>("[data-stats]")!;
  const stat = (name: string) => tool.querySelector<HTMLElement>(`[data-stat="${name}"]`)!;
  const actions = [
    ...tool.querySelectorAll<HTMLButtonElement>("[data-download-svg], [data-download-png], [data-copy-svg]"),
  ];
  const message = (key: string) => tool.dataset[key] ?? "";

  let current: QrCode | undefined;

  const level = () => (levels.find((input) => input.checked)?.value ?? "M") as ErrorCorrection;
  const colours = () => ({ foreground: foreground.value, background: background.value });

  const checkContrast = () => {
    foregroundValue.textContent = foreground.value;
    backgroundValue.textContent = background.value;
    const dark = parseColour(foreground.value);
    const light = parseColour(background.value);
    if (!dark || !light) return;
    const ratio = contrastRatio(dark, light);
    const rounded = ratio.toFixed(ratio < 10 ? 2 : 1);
    const notes: string[] = [];
    if (ratio < MIN_SCAN_CONTRAST) notes.push(fill(message("lowContrast"), { ratio: rounded }));
    else notes.push(fill(message("contrast"), { ratio: rounded }));
    const inverted = luminance(dark) > luminance(light);
    if (inverted) notes.push(message("inverted"));
    contrastNote.textContent = notes.join(" ");
    contrastNote.toggleAttribute("data-warning", ratio < MIN_SCAN_CONTRAST || inverted);
  };

  const render = () => {
    const value = text.value;
    const chosen = level();
    current = undefined;
    status.removeAttribute("data-invalid");
    if (value === "") {
      preview.replaceChildren();
      stats.hidden = true;
      status.textContent = message("empty");
      for (const button of actions) button.disabled = true;
      return;
    }
    const result = encodeQr(value, chosen);
    if (!result.ok) {
      preview.replaceChildren();
      stats.hidden = true;
      status.textContent = fill(message("tooLong"), { bytes: result.bytes, capacity: result.capacity, level: chosen });
      status.toggleAttribute("data-invalid", true);
      for (const button of actions) button.disabled = true;
      return;
    }
    const code = result.code;
    current = code;
    const extent = code.size + QUIET_ZONE * 2;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", `0 0 ${extent} ${extent}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", fill(message("label"), { text: excerpt(value) }));
    svg.setAttribute("shape-rendering", "crispEdges");
    const backdrop = document.createElementNS(SVG, "rect");
    backdrop.setAttribute("width", String(extent));
    backdrop.setAttribute("height", String(extent));
    backdrop.setAttribute("fill", background.value);
    const modules = document.createElementNS(SVG, "path");
    modules.setAttribute("fill", foreground.value);
    modules.setAttribute("d", modulePath(code.modules));
    svg.append(backdrop, modules);
    preview.replaceChildren(svg);

    const capacity = byteCapacity(code.version, code.level);
    stats.hidden = false;
    stat("version").textContent = String(code.version);
    stat("modules").textContent = fill(message("modulesValue"), { size: code.size });
    stat("data").textContent = fill(message("dataValue"), { bytes: code.bytes, capacity });
    stat("mask").textContent = String(code.mask);
    status.textContent = fill(message("statusText"), {
      version: code.version,
      size: code.size,
      level: code.level,
      bytes: code.bytes,
      capacity,
    });
    for (const button of actions) button.disabled = false;
  };

  const markup = () => (current ? qrSvg(current, { ...colours(), title: excerpt(text.value) }) : "");

  const downloadPng = () => {
    if (!current) return;
    const extent = current.size + QUIET_ZONE * 2;
    // About 1,000 pixels across, in whole pixels per module so the edges stay sharp.
    const scale = Math.max(4, Math.floor(1024 / extent));
    const canvas = document.createElement("canvas");
    canvas.width = extent * scale;
    canvas.height = extent * scale;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = background.value;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = foreground.value;
    current.modules.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) context.fillRect((x + QUIET_ZONE) * scale, (y + QUIET_ZONE) * scale, scale, scale);
      });
    });
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, "qr-code.png");
    }, "image/png");
  };

  text.addEventListener("input", render);
  for (const input of levels) input.addEventListener("change", render);
  for (const input of [foreground, background]) {
    input.addEventListener("input", () => {
      checkContrast();
      render();
    });
  }
  tool.querySelector("[data-download-svg]")!.addEventListener("click", () => {
    if (current) downloadBlob(new Blob([markup()], { type: "image/svg+xml" }), "qr-code.svg");
  });
  tool.querySelector("[data-download-png]")!.addEventListener("click", downloadPng);
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy-svg]")!;
  copy.addEventListener("click", () => {
    if (current) void copyText(copy, markup(), message("copied"));
  });
  checkContrast();
  render();
};
