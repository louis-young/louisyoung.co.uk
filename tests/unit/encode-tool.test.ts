import { describe, expect, it } from "vitest";

import {
  base64Decode,
  base64Encode,
  decodeJwt,
  htmlEscape,
  htmlUnescape,
  urlDecode,
  urlEncode,
} from "../../src/lib/encode-tool";

const base64url = (value: unknown) =>
  base64Encode(JSON.stringify(value)).replace(/=+$/u, "").replaceAll("+", "-").replaceAll("/", "_");

describe("Base64", () => {
  it("round-trips UTF-8 text", () => {
    expect(base64Encode("hello")).toBe("aGVsbG8=");
    expect(base64Encode("Café ✓ 😀")).toBe("Q2Fmw6kg4pyTIPCfmIA=");
    expect(base64Encode("")).toBe("");
    expect(base64Decode("Q2Fmw6kg4pyTIPCfmIA=")).toEqual({ output: "Café ✓ 😀" });
  });

  it("accepts URL-safe alphabets, missing padding and whitespace", () => {
    expect(base64Decode("aGVsbG8")).toEqual({ output: "hello" });
    expect(base64Decode(" aGVs\nbG8= ")).toEqual({ output: "hello" });
    expect(base64Decode("-_8")).toEqual(base64Decode("+/8"));
  });

  it("rejects invalid Base64 and bytes that are not UTF-8", () => {
    expect(base64Decode("a")).toEqual({ error: "base64" });
    expect(base64Decode("ab$c")).toEqual({ error: "base64" });
    expect(base64Decode("ab=c")).toEqual({ error: "base64" });
    expect(base64Decode("/w==")).toEqual({ error: "utf8" });
  });
});

describe("URL encoding", () => {
  it("encodes and decodes URI components", () => {
    expect(urlEncode("a b&c=d/é")).toBe("a%20b%26c%3Dd%2F%C3%A9");
    expect(urlDecode("a%20b%26c%3Dd%2F%C3%A9")).toEqual({ output: "a b&c=d/é" });
  });

  it("rejects malformed percent-encoding", () => {
    expect(urlDecode("%E0%A4%A")).toEqual({ error: "url" });
  });
});

describe("HTML entities", () => {
  it("escapes the characters that matter", () => {
    expect(htmlEscape(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });

  it("unescapes named, decimal and hex entities", () => {
    expect(htmlUnescape("&lt;p&gt; &amp;amp; &quot;&apos; &copy; &hellip; &#169; &#x1F600; &#X41;")).toBe(
      `<p> &amp; "' © … © 😀 A`,
    );
  });

  it("leaves unknown names alone and replaces impossible code points", () => {
    expect(htmlUnescape("&nope; &amp &#0; &#xD800; &#x110000;")).toBe("&nope; &amp \ufffd \ufffd \ufffd");
  });
});

describe("decodeJwt", () => {
  const header = { alg: "HS256", typ: "JWT" };

  it("decodes the header, payload and time claims", () => {
    const payload = { sub: "123", name: "Ada ✓", iat: 1_700_000_000, exp: 1_700_003_600, nbf: "soon" };
    const token = `${base64url(header)}.${base64url(payload)}.c2lnbmF0dXJl`;
    expect(decodeJwt(` ${token} `)).toEqual({
      header,
      payload,
      times: [
        { claim: "iat", date: new Date("2023-11-14T22:13:20Z") },
        { claim: "exp", date: new Date("2023-11-14T23:13:20Z") },
      ],
    });
  });

  it("ignores time claims that are not valid dates", () => {
    const token = `${base64url(header)}.${base64url({ exp: 1e20, iat: Number.MAX_VALUE })}.`;
    expect(decodeJwt(token)).toMatchObject({ times: [] });
  });

  it("explains what is wrong with a malformed token", () => {
    expect(decodeJwt("abc")).toEqual({ error: "jwtParts" });
    expect(decodeJwt("a.b.c.d")).toEqual({ error: "jwtParts" });
    expect(decodeJwt(`!!.${base64url({})}.x`)).toEqual({ error: "jwtHeader" });
    expect(decodeJwt(`${base64Encode("not json")}.${base64url({})}.x`)).toEqual({ error: "jwtHeader" });
    expect(decodeJwt(`${base64url(header)}.${base64url([1])}.x`)).toEqual({ error: "jwtPayload" });
    expect(decodeJwt(`${base64url(header)}.${base64url(null)}.x`)).toEqual({ error: "jwtPayload" });
  });
});
