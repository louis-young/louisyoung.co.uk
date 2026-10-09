// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { initCidr } from "../../src/scripts/tool-cidr";

afterEach(() => {
  document.body.innerHTML = "";
});

const messages = {
  summary: "{block}: {total} addresses, {usable} usable.",
  "summary-one": "{block}: one address.",
  "error-empty": "Type a block.",
  "error-ipv6": "IPv6.",
  "error-address": "Bad address.",
  "error-prefix": "Bad prefix.",
  "error-mask": "Bad mask.",
  normalised: "{address} is in {block}.",
  assumed: "Read as /32.",
  "point-to-point": "Point-to-point.",
  host: "One host.",
  "no-broadcast-link": "None (link)",
  "no-broadcast-host": "None (host)",
  "check-empty": "Type an address.",
  "check-invalid": "Not an address.",
  inside: "{address} is in {block}.",
  outside: "{address} isn’t in {block}.",
  "bits-summary": "{network}+{host}",
  "range-public": "Public",
  "range-private": "Private",
  "range-shared": "Shared",
  "range-loopback": "Loopback",
  "range-link-local": "Link-local",
  "range-documentation": "Documentation",
  "range-benchmarking": "Benchmarking",
  "range-multicast": "Multicast",
  "range-reserved": "Reserved",
  "range-this-network": "This network",
  "range-broadcast": "Broadcast",
  "range-mixed": "Mixed",
};

const keys = ["block", "network", "broadcast", "first", "last", "usable", "total", "netmask", "wildcard", "range"];
const bitRows = ["address", "netmask", "network", "broadcast"];

const setup = (block: string, address = "") => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-cidr ${attributes}>
      <input data-input value="${block}" />
      <p data-status></p>
      <p data-note hidden></p>
      <input data-check value="${address}" />
      <p data-check-status></p>
      <div data-results>
        ${keys.map((key) => `<code data-value="${key}"></code>`).join("")}
        ${bitRows.map((key) => `<code data-bits="${key}"><span></span><span></span></code>`).join("")}
        <span data-bits-note></span>
      </div>
    </div>`;
  initCidr();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const type = (selector: string, value: string) => {
    const input = document.querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const value = (key: string) => get(`[data-value="${key}"]`).textContent;
  const bits = (key: string) =>
    [...document.querySelectorAll(`[data-bits="${key}"] span`)].map((span) => span.textContent);
  return { get, type, value, bits };
};

describe("CIDR calculator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initCidr();
    }).not.toThrow();
  });

  it("fills in the block, its bits and the address check", () => {
    const { get, value, bits } = setup("10.0.0.0/22", "10.0.2.15");
    expect(get("[data-status]").textContent).toBe("10.0.0.0/22: 1,024 addresses, 1,022 usable.");
    expect(get("[data-note]").hidden).toBe(true);
    expect(keys.map(value)).toEqual([
      "10.0.0.0/22",
      "10.0.0.0",
      "10.0.3.255",
      "10.0.0.1",
      "10.0.3.254",
      "1,022",
      "1,024",
      "255.255.252.0",
      "0.0.3.255",
      "Private",
    ]);
    expect(bits("address")).toEqual(["00001010.00000000.000000", "00.00000000"]);
    expect(bits("broadcast")).toEqual(["00001010.00000000.000000", "11.11111111"]);
    expect(bits("netmask")).toEqual(["11111111.11111111.111111", "00.00000000"]);
    expect(get("[data-bits-note]").textContent).toBe("22+10");
    expect(get("[data-check-status]").textContent).toBe("10.0.2.15 is in 10.0.0.0/22.");
    expect(get("[data-check-status]").dataset["in"]).toBe("true");
  });

  it("says when it normalises a host address, or assumes /32", () => {
    const { get, type, value } = setup("192.168.1.130/26");
    expect(get("[data-note]").textContent).toBe("192.168.1.130 is in 192.168.1.128/26.");
    expect(get("[data-note]").hidden).toBe(false);
    expect(value("network")).toBe("192.168.1.128");
    type("[data-input]", "8.8.8.8");
    expect(get("[data-note]").textContent).toBe("Read as /32.");
    expect(get("[data-status]").textContent).toBe("8.8.8.8/32: one address.");
    expect(value("broadcast")).toBe("None (host)");
    expect(value("range")).toBe("Public");
  });

  it("explains /31 and /32", () => {
    const { get, type, value } = setup("10.0.0.0/31");
    expect(get("[data-note]").textContent).toBe("Point-to-point.");
    expect(value("broadcast")).toBe("None (link)");
    expect(value("first")).toBe("10.0.0.0");
    expect(value("last")).toBe("10.0.0.1");
    expect(value("usable")).toBe("2");
    type("[data-input]", "10.0.0.7/32");
    expect(get("[data-note]").textContent).toBe("One host.");
  });

  it("explains errors and hides the results", () => {
    const { get, type } = setup("10.0.0.0/22", "10.0.0.1");
    type("[data-input]", "10.0.0.0/40");
    expect(get("[data-status]").textContent).toBe("Bad prefix.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(get("[data-input]").getAttribute("aria-invalid")).toBe("true");
    expect(get("[data-results]").hidden).toBe(true);
    expect(get("[data-check-status]").textContent).toBe("");
    type("[data-input]", "fe80::/10");
    expect(get("[data-status]").textContent).toBe("IPv6.");
    type("[data-input]", "");
    expect(get("[data-status]").textContent).toBe("Type a block.");
    expect(get("[data-input]").getAttribute("aria-invalid")).toBe("false");
    type("[data-input]", "10.0.0.0/8");
    expect(get("[data-results]").hidden).toBe(false);
  });

  it("checks addresses as they’re typed", () => {
    const { get, type } = setup("10.0.0.0/22");
    expect(get("[data-check-status]").textContent).toBe("Type an address.");
    type("[data-check]", "10.0.4.1");
    expect(get("[data-check-status]").textContent).toBe("10.0.4.1 isn’t in 10.0.0.0/22.");
    expect(get("[data-check-status]").dataset["in"]).toBe("false");
    type("[data-check]", "10.0.4");
    expect(get("[data-check-status]").textContent).toBe("Not an address.");
    expect(get("[data-check]").getAttribute("aria-invalid")).toBe("true");
  });
});
