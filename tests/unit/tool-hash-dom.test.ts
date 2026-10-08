// @vitest-environment jsdom
import { createHash } from "node:crypto";

import { afterEach, describe, expect, it, vi } from "vitest";

import { initHash } from "../../src/scripts/tool-hash";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

/** jsdom has no crypto.subtle, so digests come from Node’s own hashing. */
const stubCrypto = (overrides: Partial<Crypto> = {}) => {
  let uuid = 0;
  const digest = vi.fn((algorithm: string, data: Uint8Array) =>
    Promise.resolve(new Uint8Array(createHash(algorithm.replace("-", "").toLowerCase()).update(data).digest()).buffer),
  );
  vi.stubGlobal("crypto", {
    subtle: { digest },
    randomUUID: () => `00000000-0000-4000-8000-${String(++uuid).padStart(12, "0")}`,
    ...overrides,
  });
  return digest;
};

const algorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"];

const setup = (text = "abc") => {
  document.body.innerHTML = `
    <div data-hash data-copied="Copied">
      <p data-unsupported hidden></p>
      <textarea data-input>${text}</textarea>
      <input type="checkbox" data-uppercase />
      ${algorithms
        .map(
          (algorithm) => `<div data-algorithm="${algorithm}">
            <code data-value="hex"></code><button type="button" data-copy="${algorithm} hex"><span data-copy-label>Copy</span></button>
            <code data-value="base64"></code><button type="button" data-copy="${algorithm} base64"><span data-copy-label>Copy</span></button>
          </div>`,
        )
        .join("")}
      <input type="number" value="5" data-count />
      <button type="button" data-generate>Generate</button>
      <button type="button" data-copy-all><span data-copy-label>Copy all</span></button>
      <ol data-uuids></ol>
    </div>`;
  initHash();
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  return {
    get,
    value: (algorithm: string, kind: string) =>
      get(`[data-algorithm="${algorithm}"] [data-value="${kind}"]`).textContent,
    uuids: () => [...document.querySelectorAll("[data-uuids] code")].map((code) => code.textContent),
  };
};

describe("hash and UUID generator", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initHash();
    }).not.toThrow();
  });

  it("hashes text with every algorithm, in hex and Base64", async () => {
    stubCrypto();
    const { value, get } = setup();
    await vi.waitFor(() => {
      expect(value("SHA-256", "hex")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    });
    expect(value("SHA-1", "hex")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(value("SHA-256", "base64")).toBe("ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0=");
    expect(value("SHA-512", "hex")).toHaveLength(128);
    const uppercase = get("[data-uppercase]") as HTMLInputElement;
    uppercase.checked = true;
    uppercase.dispatchEvent(new Event("change"));
    await vi.waitFor(() => {
      expect(value("SHA-1", "hex")).toBe("A9993E364706816ABA3E25717850C26C9CD0D89D");
    });
  });

  it("keeps only the latest round of digests", async () => {
    const digest = stubCrypto();
    const { value, get } = setup("first");
    const input = get("[data-input]") as HTMLTextAreaElement;
    input.value = "abc";
    input.dispatchEvent(new Event("input"));
    await vi.waitFor(() => {
      expect(value("SHA-1", "hex")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    });
    expect(digest).toHaveBeenCalledTimes(8);
  });

  it("generates 1 to 20 UUIDs and copies them all", async () => {
    stubCrypto();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get, uuids, value } = setup();
    expect(uuids()).toHaveLength(5);
    const count = get("[data-count]") as HTMLInputElement;
    count.value = "50";
    count.dispatchEvent(new Event("change"));
    expect(count.value).toBe("20");
    get("[data-generate]").click();
    expect(uuids()).toHaveLength(20);
    count.value = "2";
    get("[data-generate]").click();
    expect(uuids()).toEqual(["00000000-0000-4000-8000-000000000026", "00000000-0000-4000-8000-000000000027"]);
    get("[data-copy-all]").click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-000000000026\n00000000-0000-4000-8000-000000000027",
      );
    });
    await vi.waitFor(() => {
      expect(value("SHA-1", "base64")).not.toBe("");
    });
    get('[data-copy="SHA-1 base64"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("qZk+NkcGgWq6PiVxeFDCbJzQ2J0=");
    });
  });

  it("explains when the Web Crypto API isn’t available", () => {
    vi.stubGlobal("crypto", {});
    const { get, uuids } = setup();
    expect(get("[data-unsupported]").hidden).toBe(false);
    expect(uuids()).toEqual([]);
  });
});
