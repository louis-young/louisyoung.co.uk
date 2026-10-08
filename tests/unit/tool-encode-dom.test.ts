// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { base64Encode } from "../../src/lib/encode-tool";
import { initEncode } from "../../src/scripts/tool-encode";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const setup = (value: string) => {
  document.body.innerHTML = `
    <div data-encode data-error-base64="Bad Base64" data-error-utf8="Not UTF-8" data-error-url="Bad URL"
      data-error-jwt-parts="Three parts" data-error-jwt-header="Bad header" data-error-jwt-payload="Bad payload"
      data-jwt-empty="Paste a JWT" data-iat="Issued" data-nbf="Not before" data-exp="Expires" data-expired="expired"
      data-copy-text="Copy" data-copied="Copied">
      ${["base64", "url", "html", "jwt"].map((format, i) => `<input type="radio" name="format" value="${format}"${i === 0 ? " checked" : ""} />`).join("")}
      <div data-directions>
        <input type="radio" name="direction" value="encode" checked />
        <input type="radio" name="direction" value="decode" />
      </div>
      <textarea data-input></textarea>
      <p data-jwt-note hidden></p>
      <p data-status></p>
      <div data-text-result><button type="button" data-copy>Copy</button><output data-output></output></div>
      <div data-jwt hidden><pre data-jwt-header></pre><pre data-jwt-payload></pre><dl data-jwt-times></dl></div>
    </div>`;
  document.querySelector<HTMLTextAreaElement>("[data-input]")!.value = value;
  initEncode();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const choose = (name: string, value: string) => {
    const radio = get(`[name="${name}"][value="${value}"]`) as HTMLInputElement;
    radio.checked = true;
    radio.dispatchEvent(new Event("change", { bubbles: true }));
  };
  return {
    get,
    choose,
    input: get("[data-input]") as HTMLTextAreaElement,
    output: get("[data-output]") as HTMLOutputElement,
    status: get("[data-status]"),
    copy: get("[data-copy]") as HTMLButtonElement,
  };
};

const type = (element: HTMLTextAreaElement, value: string) => {
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
};

const segment = (value: unknown) => base64Encode(JSON.stringify(value)).replace(/=+$/u, "");

describe("encoder", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initEncode();
    }).not.toThrow();
  });

  it("encodes and decodes each format", () => {
    const { input, output, choose, copy } = setup("Café ✓");
    expect(output.value).toBe("Q2Fmw6kg4pyT");
    choose("direction", "decode");
    type(input, "Q2Fmw6kg4pyT");
    expect(output.value).toBe("Café ✓");
    choose("format", "url");
    type(input, "a%20b");
    expect(output.value).toBe("a b");
    choose("direction", "encode");
    expect(output.value).toBe("a%2520b");
    choose("format", "html");
    type(input, "<b>");
    expect(output.value).toBe("&lt;b&gt;");
    choose("direction", "decode");
    type(input, "&lt;b&gt;");
    expect(output.value).toBe("<b>");
    expect(copy.disabled).toBe(false);
    type(input, "");
    expect(copy.disabled).toBe(true);
  });

  it("shows errors for input that cannot be decoded", () => {
    const { input, output, status, choose } = setup("");
    choose("direction", "decode");
    type(input, "@@@");
    expect(status.textContent).toBe("Bad Base64");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(output.value).toBe("");
    type(input, "/w==");
    expect(status.textContent).toBe("Not UTF-8");
    choose("format", "url");
    type(input, "%E0%A4%A");
    expect(status.textContent).toBe("Bad URL");
    type(input, "ok");
    expect(status.textContent).toBe("");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("decodes a JWT, its dates and whether it has expired", () => {
    vi.useFakeTimers({ now: new Date("2024-01-01T00:00:00Z") });
    const { get, input, choose, status } = setup("");
    choose("format", "jwt");
    expect(get("[data-directions]").hidden).toBe(true);
    expect(get("[data-text-result]").hidden).toBe(true);
    expect(get("[data-jwt-note]").hidden).toBe(false);
    expect(get("[data-jwt]").hidden).toBe(true);
    expect(status.textContent).toBe("Paste a JWT");
    const payload = { sub: "1", iat: 1_700_000_000, exp: 1_700_003_600, nbf: 1_800_000_000 };
    type(input, `${segment({ alg: "none" })}.${segment(payload)}.`);
    expect(get("[data-jwt]").hidden).toBe(false);
    expect(status.textContent).toBe("");
    expect(get("[data-jwt-header]").textContent).toBe('{\n  "alg": "none"\n}');
    expect(JSON.parse(get("[data-jwt-payload]").textContent)).toEqual(payload);
    const rows = [...get("[data-jwt-times]").querySelectorAll("div")].map((row) => row.textContent);
    expect(rows).toEqual([
      "Issued14 Nov 2023, 22:13:20",
      "Not before15 Jan 2027, 08:00:00",
      "Expires14 Nov 2023, 23:13:20 · expired",
    ]);
    type(input, `${segment({ alg: "none" })}.${segment({ exp: 1_800_000_000 })}.`);
    expect(get("[data-jwt-times]").textContent).not.toContain("expired");
  });

  it("explains malformed JWTs", () => {
    const { input, choose, status, get } = setup("");
    choose("format", "jwt");
    type(input, "abc");
    expect(status.textContent).toBe("Three parts");
    expect(get("[data-jwt]").hidden).toBe(true);
    type(input, `x.${segment({})}.`);
    expect(status.textContent).toBe("Bad header");
    type(input, `${segment({})}.x.`);
    expect(status.textContent).toBe("Bad payload");
  });

  it("copies the output, and survives a blocked clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { copy } = setup("hello");
    copy.click();
    await vi.waitFor(() => {
      expect(copy.textContent).toBe("Copied");
    });
    expect(writeText).toHaveBeenCalledWith("aGVsbG8=");
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
    const again = setup("hello");
    again.copy.click();
    await Promise.resolve();
    expect(again.copy.textContent).toBe("Copy");
  });
});
