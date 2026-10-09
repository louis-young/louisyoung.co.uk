// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { initUrl } from "../../src/scripts/tool-url";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const messages = {
  copied: "Copied",
  empty: "Paste a URL.",
  "invalid-url": "Not a URL.",
  "valid-none": "Valid, no parameters.",
  "valid-one": "Valid, {count} parameter.",
  "valid-other": "Valid, {count} parameters.",
  rejected: "Rejected.",
  "issue-missing-protocol": "No protocol.",
  "issue-spaces": "Spaces.",
  "issue-hash-in-query": "Hash in query.",
  "issue-bad-escape": "Bad escape.",
  "param-name": "Name {n}",
  "param-value": "Value {n}",
  "param-remove": "Remove {n}",
  added: "Added {n}.",
  removed: "Removed.",
};

const parts = ["protocol", "username", "password", "hostname", "port", "pathname", "hash"];

const setup = (url: string) => {
  const attributes = Object.entries(messages)
    .map(([key, text]) => `data-${key}="${text}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-url ${attributes}>
      <textarea data-input></textarea>
      <button data-encode>Encode</button><button data-decode>Decode</button>
      <p data-status></p>
      <ul data-issues hidden></ul>
      <code data-origin></code><code data-host></code><code data-readable></code><code data-href></code>
      <button data-copy><span data-copy-label>Copy</span></button>
      <fieldset data-parts>
        ${parts.map((part) => `<input id="url-${part}" data-part="${part}" /><p id="url-${part}-error" hidden></p>`).join("")}
      </fieldset>
      <fieldset data-params>
        <table><tbody data-rows></tbody></table>
        <button data-add>Add</button>
        <p data-announce></p>
      </fieldset>
      <template data-row-template>
        <tr><td><input data-name /></td><td><input data-param /></td>
        <td><button data-remove><span data-remove-label></span></button></td></tr>
      </template>
    </div>`;
  const input = document.querySelector<HTMLTextAreaElement>("[data-input]")!;
  input.value = url;
  initUrl();
  const get = (selector: string) => document.querySelector<HTMLInputElement>(selector)!;
  const type = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
    element.value = value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const text = (selector: string) => get(selector).textContent;
  const part = (name: string) => get(`[data-part="${name}"]`);
  const rows = () =>
    [...document.querySelectorAll("[data-rows] tr")].map((row) => [
      row.querySelector<HTMLInputElement>("[data-name]")!.value,
      row.querySelector<HTMLInputElement>("[data-param]")!.value,
    ]);
  return { input, get, type, text, part, rows };
};

describe("URL parser", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initUrl();
    }).not.toThrow();
  });

  it("splits a URL into parts, parameters and outputs", () => {
    const { text, part, rows, get } = setup("https://ann:pw@x.dev:8080/caf%C3%A9?q=a+b&n=1#top");
    expect(part("protocol").value).toBe("https:");
    expect(part("username").value).toBe("ann");
    expect(part("hostname").value).toBe("x.dev");
    expect(part("port").value).toBe("8080");
    expect(part("pathname").value).toBe("/caf%C3%A9");
    expect(part("hash").value).toBe("#top");
    expect(rows()).toEqual([
      ["q", "a b"],
      ["n", "1"],
    ]);
    expect(get("[data-name]").getAttribute("aria-label")).toBe("Name 1");
    expect(text("[data-remove-label]")).toBe("Remove 1");
    expect(text("[data-origin]")).toBe("https://x.dev:8080");
    expect(text("[data-host]")).toBe("x.dev:8080");
    expect(text("[data-readable]")).toBe("https://ann:pw@x.dev:8080/café?q=a+b&n=1#top");
    expect(text("[data-status]")).toBe("Valid, 2 parameters.");
    expect(get("[data-issues]").hidden).toBe(true);
  });

  it("lists mistakes and reports empty or invalid input", () => {
    const { input, type, text, get } = setup("x.dev/a b?c=#d");
    expect([...get("[data-issues]").children].map((item) => item.textContent)).toEqual([
      "No protocol.",
      "Spaces.",
      "Hash in query.",
    ]);
    expect(text("[data-status]")).toBe("Valid, 1 parameter.");
    type(input, "https://x.dev/100%");
    expect(text("[data-issues]")).toBe("Bad escape.");
    expect(text("[data-status]")).toBe("Valid, no parameters.");
    type(input, "http://[::1");
    expect(text("[data-status]")).toBe("Not a URL.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-parts]").disabled).toBe(true);
    expect(get("[data-copy]").disabled).toBe(true);
    expect(text("[data-href]")).toBe("");
    type(input, "");
    expect(text("[data-status]")).toBe("Paste a URL.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(false);
    // With nothing parsed, editing does nothing.
    type(get('[data-part="hostname"]'), "x");
    get("[data-encode]").click();
    get("[data-decode]").click();
    get("[data-add]").click();
    expect(input.value).toBe("");
  });

  it("rebuilds the URL when a part changes, and flags values it can’t take", () => {
    const { input, type, part, get, text } = setup("https://x.dev/a?q=1");
    type(part("hostname"), "example.org");
    expect(input.value).toBe("https://example.org/a?q=1");
    expect(text("[data-origin]")).toBe("https://example.org");
    type(part("port"), "abc");
    expect(part("port").getAttribute("aria-invalid")).toBe("true");
    expect(text("#url-port-error")).toBe("Rejected.");
    expect(get("#url-port-error").hidden).toBe(false);
    expect(input.value).toBe("https://example.org/a?q=1");
    type(part("port"), "81");
    expect(part("port").getAttribute("aria-invalid")).toBe("false");
    expect(input.value).toBe("https://example.org:81/a?q=1");
    type(part("protocol"), "HTTP");
    expect(part("protocol").value).toBe("HTTP");
    part("protocol").dispatchEvent(new Event("change", { bubbles: true }));
    expect(part("protocol").value).toBe("http:");
    type(part("port"), "x");
    part("port").dispatchEvent(new Event("change", { bubbles: true }));
    expect(part("port").value).toBe("x");
    expect(text("#url-port-error")).toBe("Rejected.");
  });

  it("rebuilds the query from the table and adds and removes rows", () => {
    const { input, type, rows, get, text } = setup("https://x.dev/?a=1&b=2");
    type(get("[data-param]"), "x y");
    expect(input.value).toBe("https://x.dev/?a=x+y&b=2");
    get("[data-add]").click();
    expect(rows()).toHaveLength(3);
    expect(text("[data-announce]")).toBe("Added 3.");
    expect(document.activeElement).toBe(document.querySelectorAll("[data-name]")[2]);
    type(document.querySelectorAll<HTMLInputElement>("[data-name]")[2]!, "c");
    expect(input.value).toBe("https://x.dev/?a=x+y&b=2&c=");
    document.querySelector<HTMLButtonElement>("[data-remove]")!.click();
    expect(rows()).toEqual([
      ["b", "2"],
      ["c", ""],
    ]);
    expect(text("[data-announce]")).toBe("Removed.");
    expect(input.value).toBe("https://x.dev/?b=2&c=");
    expect(document.activeElement).toBe(get("[data-name]"));
    expect(get("[data-name]").getAttribute("aria-label")).toBe("Name 1");
    const last = () => [...document.querySelectorAll<HTMLButtonElement>("[data-remove]")].at(-1)!;
    last().click();
    expect(document.activeElement).toBe(get("[data-name]"));
    last().click();
    expect(document.activeElement).toBe(get("[data-add]"));
    expect(input.value).toBe("https://x.dev/");
    get("[data-rows]").click();
  });

  it("encodes, decodes and copies", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { input, get } = setup("https://x.dev/café menu");
    get("[data-encode]").click();
    expect(input.value).toBe("https://x.dev/caf%C3%A9%20menu");
    get("[data-decode]").click();
    expect(input.value).toBe("https://x.dev/café menu");
    get("[data-copy]").click();
    await Promise.resolve();
    expect(writeText).toHaveBeenCalledWith("https://x.dev/caf%C3%A9%20menu");
  });
});
