// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initTimestamp } from "../../src/scripts/tool-timestamp";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const formats = ["seconds", "milliseconds", "iso", "rfc2822"];
const zones = ["local", "UTC", "Asia/Tokyo"];

const setup = (value: string) => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-08T09:00:00Z"));
  document.body.innerHTML = `
    <div data-timestamp data-read-as="Read as {format}." data-assumed-utc="No offset, so UTC."
      data-seconds="Unix seconds" data-milliseconds="Unix milliseconds" data-iso="ISO 8601" data-rfc2822="RFC 2822"
      data-unavailable="Not expressible" data-error-empty="Type one." data-error-invalid="Not a date."
      data-error-range="Too far." data-error-weekday="Wrong weekday." data-copied="Copied">
      <input data-input value="${value}" />
      <button type="button" data-now>Now</button>
      <p data-status></p>
      <div data-results>
        ${formats
          .map(
            (format) => `<div data-format="${format}"><code data-value></code>
              <button type="button" data-copy="${format}"><span data-copy-label>Copy</span></button></div>`,
          )
          .join("")}
        <output data-relative></output>
        ${zones.map((zone) => `<div data-zone="${zone}"><span ${zone === "local" ? "data-local-zone" : ""}></span><span data-value></span></div>`).join("")}
      </div>
    </div>`;
  initTimestamp();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  return {
    get,
    input: get("[data-input]") as HTMLInputElement,
    status: get("[data-status]"),
    format: (name: string) => get(`[data-format="${name}"] [data-value]`).textContent,
    zone: (name: string) => get(`[data-zone="${name}"] [data-value]`).textContent,
  };
};

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
};

describe("timestamp converter", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initTimestamp();
    }).not.toThrow();
  });

  it("starts at the current time when empty", () => {
    const { input, status, format, get } = setup("");
    expect(input.value).toBe("1791450000");
    expect(status.textContent).toBe("Read as Unix seconds.");
    expect(format("iso")).toBe("2026-10-08T09:00:00.000Z");
    expect(get("[data-relative]").textContent).toBe("now");
    expect(get("[data-local-zone]").textContent).toMatch(/^\(.+\)$/u);
  });

  it("converts any format into every other, with relative time and zones", () => {
    const { input, status, format, zone, get } = setup("2026-10-05 09:00");
    expect(status.textContent).toBe("Read as ISO 8601. No offset, so UTC.");
    expect(format("seconds")).toBe("1791190800");
    expect(format("milliseconds")).toBe("1791190800000");
    expect(format("rfc2822")).toBe("Mon, 05 Oct 2026 09:00:00 +0000");
    expect(get("[data-relative]").textContent).toBe("3 days ago");
    expect(zone("Asia/Tokyo")).toMatch(/18:00:00 GMT\+9$/u);
    expect(zone("local")).toMatch(/2026/u);
    type(input, "Thu, 08 Oct 2026 10:00:00 +0100");
    expect(status.textContent).toBe("Read as RFC 2822.");
    expect(get("[data-relative]").textContent).toBe("now");
  });

  it("marks RFC 2822 unavailable for years it can’t express", () => {
    const { format, get } = setup("+012026-01-01T00:00:00Z");
    expect(format("rfc2822")).toBe("Not expressible");
    expect(get('[data-copy="rfc2822"]')).toHaveProperty("disabled", true);
    expect(get('[data-copy="iso"]')).toHaveProperty("disabled", false);
  });

  it("explains what it can’t read", () => {
    const { input, status, get } = setup("soon");
    expect(status.textContent).toBe("Not a date.");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-results]").hidden).toBe(true);
    type(input, "Fri, 08 Oct 2026 09:00:00 +0000");
    expect(status.textContent).toBe("Wrong weekday.");
    type(input, "9999999999999999");
    expect(status.textContent).toBe("Too far.");
    type(input, "");
    expect(status.textContent).toBe("Type one.");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("jumps to now and copies a format", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { input, get } = setup("0");
    get("[data-now]").click();
    expect(input.value).toBe("1791450000");
    get('[data-copy="iso"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("2026-10-08T09:00:00.000Z");
    });
  });
});
