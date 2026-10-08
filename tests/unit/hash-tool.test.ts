import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashAlgorithms, toBase64, toHex, uuidCount } from "../../src/lib/hash-tool";

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe("toHex", () => {
  it("writes two digits per byte, optionally in capitals", () => {
    expect(toHex(bytes())).toBe("");
    expect(toHex(bytes(0, 1, 15, 16, 171, 255))).toBe("00010f10abff");
    expect(toHex(bytes(171, 205), true)).toBe("ABCD");
  });
});

describe("toBase64", () => {
  it("writes padded standard Base64", () => {
    expect(toBase64(bytes())).toBe("");
    expect(toBase64(bytes(102))).toBe("Zg==");
    expect(toBase64(bytes(102, 111))).toBe("Zm8=");
    expect(toBase64(bytes(251, 255, 191))).toBe("+/+/");
  });
});

describe("digests", () => {
  it("match Node’s own hashes for every algorithm", async () => {
    const text = "The quick brown fox jumps over the lazy dog ✓";
    const data = new TextEncoder().encode(text);
    for (const algorithm of hashAlgorithms) {
      const digest = await crypto.subtle.digest(algorithm, data);
      const node = createHash(algorithm.replace("-", "").toLowerCase()).update(text, "utf8");
      const expected = node.digest();
      expect(toHex(digest)).toBe(expected.toString("hex"));
      expect(toBase64(digest)).toBe(expected.toString("base64"));
    }
  });
});

describe("uuidCount", () => {
  it.each([
    ["5", 5],
    ["1", 1],
    ["20", 20],
    ["0", 1],
    ["-4", 1],
    ["21", 20],
    ["1000", 20],
    ["2.6", 3],
    ["", 1],
    ["  ", 1],
    ["abc", 1],
  ])("reads %j as %d", (value, count) => {
    expect(uuidCount(value)).toBe(count);
  });
});
