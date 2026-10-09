// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { encodeQr } from "../../src/lib/qr-tool";
import { initQr } from "../../src/scripts/tool-qr";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const field = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;

const messages = {
  copied: "Copied",
  label: "QR code for “{text}”",
  empty: "Type something.",
  "status-text": "Version {version}, {size} × {size}, level {level}. {bytes} of {capacity} bytes.",
  "too-long": "{bytes} bytes; {level} holds {capacity}.",
  "modules-value": "{size} × {size}",
  "data-value": "{bytes} / {capacity}",
  contrast: "Contrast {ratio}:1.",
  "low-contrast": "Only {ratio}:1.",
  inverted: "Inverted.",
};

const setup = (text = "HELLO WORLD") => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-qr ${attributes}>
      <textarea data-text>${text}</textarea>
      ${["L", "M", "Q", "H"].map((level) => `<input type="radio" name="l" value="${level}" data-level ${level === "M" ? "checked" : ""} />`).join("")}
      <input type="color" value="#000000" data-foreground /><code data-foreground-value></code>
      <input type="color" value="#ffffff" data-background /><code data-background-value></code>
      <p data-contrast-note></p>
      <div data-preview></div>
      <p data-status></p>
      <dl data-stats><dd data-stat="version"></dd><dd data-stat="modules"></dd><dd data-stat="data"></dd><dd data-stat="mask"></dd></dl>
      <button data-download-svg>SVG</button><button data-download-png>PNG</button>
      <button data-copy-svg><span data-copy-label>Copy SVG</span></button>
    </div>`;
  initQr();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const type = (selector: string, value: string, event = "input") => {
    const element = field(selector);
    element.value = value;
    element.dispatchEvent(new Event(event, { bubbles: true }));
  };
  return { get, type };
};

const stubDownloads = () => {
  const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:qr");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL, revokeObjectURL }));
  const clicks: HTMLAnchorElement[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
    clicks.push(this);
  });
  return { createObjectURL, revokeObjectURL, clicks };
};

describe("QR code generator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initQr();
    }).not.toThrow();
  });

  it("draws the code as an SVG image named for what it encodes", () => {
    const { get } = setup();
    const svg = get("[data-preview] svg");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("QR code for “HELLO WORLD”");
    expect(svg.getAttribute("viewBox")).toBe("0 0 29 29");
    expect(svg.querySelector("rect")!.getAttribute("fill")).toBe("#ffffff");
    const path = svg.querySelector("path")!;
    expect(path.getAttribute("fill")).toBe("#000000");
    expect(path.getAttribute("d")).toMatch(/^M4 4h7v1h-7z/u);
    expect(get("[data-status]").textContent).toBe("Version 1, 21 × 21, level M. 11 of 14 bytes.");
    expect(get('[data-stat="version"]').textContent).toBe("1");
    expect(get('[data-stat="modules"]').textContent).toBe("21 × 21");
    expect(get('[data-stat="data"]').textContent).toBe("11 / 14");
    expect(get('[data-stat="mask"]').textContent).toBe("4");
  });

  it("re-encodes when the text or level changes, and shortens a long label", () => {
    const { get, type } = setup();
    field('[value="H"]').checked = true;
    get('[value="H"]').dispatchEvent(new Event("change", { bubbles: true }));
    expect(get("[data-status]").textContent).toContain("level H. 11 of 14 bytes.");
    type("[data-text]", "x".repeat(200));
    const expected = encodeQr("x".repeat(200), "H");
    expect(get('[data-stat="version"]').textContent).toBe(String(expected.ok && expected.code.version));
    expect(get('[data-stat="version"]').textContent).toBe("15");
    expect(get("[data-preview] svg").getAttribute("aria-label")).toBe(`QR code for “${"x".repeat(79)}…”`);
  });

  it("explains an empty input and text that's too long, and disables the actions", () => {
    const { get, type } = setup();
    type("[data-text]", "");
    expect(get("[data-status]").textContent).toBe("Type something.");
    expect(get("[data-preview]").children).toHaveLength(0);
    expect(field("[data-download-svg]").disabled).toBe(true);
    expect(get("[data-stats]").hidden).toBe(true);
    type("[data-text]", "x".repeat(3000));
    expect(get("[data-status]").textContent).toBe("3000 bytes; M holds 2331.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    type("[data-text]", "ok");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(false);
    expect(field("[data-download-svg]").disabled).toBe(false);
  });

  it("recolours the code and warns about low contrast or inverted colours", () => {
    const { get, type } = setup();
    expect(get("[data-contrast-note]").textContent).toBe("Contrast 21.0:1.");
    type("[data-foreground]", "#999999");
    expect(get("[data-contrast-note]").textContent).toBe("Only 2.85:1.");
    expect(get("[data-contrast-note]").hasAttribute("data-warning")).toBe(true);
    expect(get("[data-foreground-value]").textContent).toBe("#999999");
    expect(get("[data-preview] path").getAttribute("fill")).toBe("#999999");
    type("[data-foreground]", "#ffffff");
    type("[data-background]", "#000000");
    expect(get("[data-contrast-note]").textContent).toBe("Contrast 21.0:1. Inverted.");
    expect(get("[data-contrast-note]").hasAttribute("data-warning")).toBe(true);
    type("[data-foreground]", "#112233");
    type("[data-background]", "#fafafa");
    expect(get("[data-contrast-note]").hasAttribute("data-warning")).toBe(false);
  });

  it("ignores a colour it can't parse", () => {
    const { get, type } = setup();
    type("[data-foreground]", "nonsense");
    expect(get("[data-contrast-note]").textContent).toBe("Contrast 21.0:1.");
  });

  it("downloads the SVG file", async () => {
    vi.useFakeTimers();
    const { createObjectURL, revokeObjectURL, clicks } = stubDownloads();
    const { get } = setup();
    get("[data-download-svg]").click();
    expect(clicks).toHaveLength(1);
    expect(clicks[0]!.download).toBe("qr-code.svg");
    expect(clicks[0]!.href).toBe("blob:qr");
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("image/svg+xml");
    const svg = await blob.text();
    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/u);
    expect(svg).toContain("<title>HELLO WORLD</title>");
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:qr");
    expect(document.querySelector("a")).toBeNull();
  });

  it("draws the PNG on a canvas, a whole number of pixels per module", () => {
    const { clicks } = stubDownloads();
    const fillRect = vi.fn();
    const context = { fillRect, fillStyle: "" };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    let size = 0;
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(function (
      this: HTMLCanvasElement,
      callback: BlobCallback,
      type?: string,
    ) {
      size = this.width;
      expect(type).toBe("image/png");
      callback(new Blob(["png"], { type: "image/png" }));
    });
    const { get } = setup();
    get("[data-download-png]").click();
    // 29 modules with the quiet zone, 35 pixels each.
    expect(size).toBe(29 * 35);
    expect(fillRect).toHaveBeenNthCalledWith(1, 0, 0, size, size);
    expect(fillRect).toHaveBeenNthCalledWith(2, 4 * 35, 4 * 35, 35, 35);
    expect(clicks[0]!.download).toBe("qr-code.png");
  });

  it("skips the PNG without a canvas context or a blob", () => {
    const { clicks } = stubDownloads();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    const { get } = setup();
    get("[data-download-png]").click();
    expect(clicks).toHaveLength(0);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback: BlobCallback) => {
      callback(null);
    });
    get("[data-download-png]").click();
    expect(clicks).toHaveLength(0);
  });

  it("does nothing on the actions when there's no code", () => {
    const { clicks } = stubDownloads();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, type } = setup();
    type("[data-text]", "");
    for (const selector of ["[data-download-svg]", "[data-download-png]", "[data-copy-svg]"]) {
      get(selector).dispatchEvent(new Event("click"));
    }
    expect(clicks).toHaveLength(0);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("copies the SVG markup", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get } = setup();
    get("[data-copy-svg]").click();
    await Promise.resolve();
    expect(writeText.mock.calls[0]![0]).toMatch(/^<svg [^>]+><title>HELLO WORLD<\/title><rect /u);
    await Promise.resolve();
    expect(get("[data-copy-label]").textContent).toBe("Copied");
  });
});
