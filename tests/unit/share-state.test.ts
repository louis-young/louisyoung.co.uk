import { describe, expect, it } from "vitest";

import {
  decodeShareState,
  encodeShareState,
  MAX_SHARE_LENGTH,
  SHARE_PREFIX,
  shareUrl,
} from "../../src/lib/share-state";

const encode = (state: Parameters<typeof encodeShareState>[0]) => {
  const result = encodeShareState(state);
  if (!result.ok) throw new Error("too long");
  return result.hash;
};

/** base64url of arbitrary text, for crafting links by hand. */
const craft = (text: string) => SHARE_PREFIX + Buffer.from(text).toString("base64url");

describe("share state", () => {
  it("round-trips strings and booleans, including non-ASCII text", () => {
    const state = { pattern: String.raw`(?<year>\d{4})`, text: "Café ✓ 😀\n<b>bold</b>", g: true, i: false };
    const hash = encode(state);
    expect(hash.startsWith(SHARE_PREFIX)).toBe(true);
    expect(hash.slice(SHARE_PREFIX.length)).toMatch(/^[\w-]+$/u);
    expect(decodeShareState(hash)).toEqual(state);
  });

  it("round-trips an empty object", () => {
    expect(decodeShareState(encode({}))).toEqual({});
  });

  it("refuses to encode past the cap and says how long it would have been", () => {
    const result = encodeShareState({ text: "x".repeat(MAX_SHARE_LENGTH) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.length).toBeGreaterThan(MAX_SHARE_LENGTH);
    expect(encodeShareState({ text: "x" }, 10)).toMatchObject({ ok: false });
  });

  it("ignores fragments that aren't share links", () => {
    expect(decodeShareState("")).toBeUndefined();
    expect(decodeShareState("#main")).toBeUndefined();
    expect(decodeShareState(SHARE_PREFIX)).toBeUndefined();
  });

  it("rejects over-long, malformed and hostile links", () => {
    expect(decodeShareState(`${SHARE_PREFIX}${"a".repeat(MAX_SHARE_LENGTH)}`)).toBeUndefined();
    expect(decodeShareState(`${SHARE_PREFIX}abc+/=`)).toBeUndefined();
    expect(decodeShareState(`${SHARE_PREFIX}%3Cscript%3E`)).toBeUndefined();
    expect(decodeShareState(craft("not json"))).toBeUndefined();
    expect(decodeShareState(SHARE_PREFIX + Buffer.from([0xff, 0xfe]).toString("base64url"))).toBeUndefined();
    expect(decodeShareState(craft("[1,2]"))).toBeUndefined();
    expect(decodeShareState(craft("null"))).toBeUndefined();
    expect(decodeShareState(craft('"text"'))).toBeUndefined();
    expect(decodeShareState(craft('{"a":{"nested":true}}'))).toBeUndefined();
    expect(decodeShareState(craft('{"a":1}'))).toBeUndefined();
    expect(decodeShareState(craft('{"__proto__":"x"}'))).toBeUndefined();
    expect(decodeShareState(craft('{"bad key":"x"}'))).toBeUndefined();
  });

  it("accepts a hand-made link that follows the format", () => {
    expect(decodeShareState(craft('{"range":"^1.2.0","minify":true}'))).toEqual({ range: "^1.2.0", minify: true });
  });

  it("builds a link to the same page with the state in the fragment and no query string", () => {
    expect(shareUrl("https://louisyoung.co.uk/tools/regex/?utm=x#old", "#s=abc")).toBe(
      "https://louisyoung.co.uk/tools/regex/#s=abc",
    );
  });
});
