import { describe, expect, it } from "vitest";

import { base64UrlDecode, decodeJwt, type DecodedJwt, formatClaimDate, validity } from "../../src/lib/jwt-tool";

const encode = (value: unknown) =>
  Buffer.from(typeof value === "string" ? value : JSON.stringify(value)).toString("base64url");

const jwt = (header: unknown, payload: unknown, signature = "c2lnbmF0dXJl") =>
  `${encode(header)}.${encode(payload)}.${signature}`;

const decoded = (token: string): DecodedJwt => {
  const result = decodeJwt(token);
  if (!result.ok) throw new Error(`Expected ${token} to decode: ${JSON.stringify(result.error)}`);
  return result.token;
};

/** The example token from RFC 7519 §3.1, in parts so secret scanners don’t flag a public example. */
const rfc = [
  "eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9",
  "eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ",
  "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
].join(".");

describe("base64UrlDecode", () => {
  const text = (value: string) => {
    const bytes = base64UrlDecode(value);
    return bytes && new TextDecoder().decode(bytes);
  };

  it("decodes with and without padding", () => {
    expect(text("")).toBe("");
    expect(text("YQ")).toBe("a");
    expect(text("YQ==")).toBe("a");
    expect(text("YWI")).toBe("ab");
    expect(text("YWI=")).toBe("ab");
    expect(text("YWJj")).toBe("abc");
  });

  it("decodes the url-safe alphabet, and plain base64’s + and / too", () => {
    expect(base64UrlDecode("-_8")).toEqual(Uint8Array.from([0xfb, 0xff]));
    expect(base64UrlDecode("+/8")).toEqual(Uint8Array.from([0xfb, 0xff]));
    expect(base64UrlDecode("AAECAwQFBgcICQ")).toEqual(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]));
  });

  it("refuses characters outside the alphabet, impossible lengths and bad padding", () => {
    for (const value of ["a b", "YQ!", "Y", "YWJjZ", "YQ=", "YWI==", "=", "==", "YQ===", "Y=Q"]) {
      expect(base64UrlDecode(value), value).toBeUndefined();
    }
  });
});

describe("decodeJwt", () => {
  it("decodes the RFC 7519 example", () => {
    const token = decoded(rfc);
    expect(token.header).toEqual({ typ: "JWT", alg: "HS256" });
    expect(token.payload).toEqual({ iss: "joe", exp: 1_300_819_380, "http://example.com/is_root": true });
    expect(token.alg).toBe("HS256");
    expect(token.signatureBytes).toBe(32);
    expect(token.parts).toEqual(rfc.split("."));
    expect(token.headerJson).toBe('{\n  "typ": "JWT",\n  "alg": "HS256"\n}');
    expect(token.claims).toEqual([{ name: "iss", value: "joe" }]);
    expect(token.times).toEqual([{ name: "exp", seconds: 1_300_819_380, date: new Date(1_300_819_380_000) }]);
    expect(token.warnings).toEqual([]);
  });

  it("ignores surrounding space and a Bearer prefix", () => {
    expect(decoded(`  Bearer ${rfc}\n`).alg).toBe("HS256");
    expect(decoded(`bearer   ${rfc}`).alg).toBe("HS256");
  });

  it("decodes UTF-8 in the payload", () => {
    expect(decoded(jwt({ alg: "HS256" }, { name: "Zoë 👋" })).payload).toEqual({ name: "Zoë 👋" });
  });

  it("reads time claims in order, and lists the text claims", () => {
    const token = decoded(
      jwt(
        { alg: "RS256" },
        { exp: 1_700_003_600, iat: 1_700_000_000, nbf: 1_700_000_000.5, aud: ["a", "b"], sub: "1", jti: 7 },
      ),
    );
    expect(token.times.map((claim) => claim.name)).toEqual(["iat", "nbf", "exp"]);
    expect(token.times[1]!.date.getTime()).toBe(1_700_000_000_500);
    expect(token.claims).toEqual([
      { name: "sub", value: "1" },
      { name: "aud", value: "a, b" },
      { name: "jti", value: "7" },
    ]);
  });

  it("warns about time claims that aren’t NumericDates, or look like milliseconds", () => {
    const token = decoded(jwt({ alg: "HS256" }, { iat: "yesterday", nbf: 1e20, exp: 1_700_000_000_000 }));
    expect(token.times.map((claim) => claim.name)).toEqual(["exp"]);
    expect(token.warnings).toEqual([
      { kind: "claimType", claim: "iat" },
      { kind: "claimType", claim: "nbf" },
      { kind: "milliseconds", claim: "exp" },
    ]);
    expect(decoded(jwt({ alg: "HS256" }, { exp: null })).warnings).toEqual([{ kind: "claimType", claim: "exp" }]);
  });

  it("flags unsecured tokens, with and without a signature", () => {
    const unsecured = decoded(jwt({ alg: "none" }, { sub: "x" }, ""));
    expect(unsecured.alg).toBe("none");
    expect(unsecured.signatureBytes).toBe(0);
    expect(unsecured.warnings).toEqual([{ kind: "unsecured" }]);
    expect(decoded(jwt({ alg: "None" }, {}, "c2ln")).warnings).toEqual([{ kind: "unsecuredSignature" }]);
  });

  it("flags a missing signature and a missing alg", () => {
    expect(decoded(jwt({ alg: "HS256" }, {}, "")).warnings).toEqual([{ kind: "missingSignature" }]);
    const token = decoded(jwt({ typ: "JWT" }, {}, ""));
    expect(token.alg).toBeUndefined();
    expect(token.warnings).toEqual([{ kind: "missingSignature" }]);
    expect(decoded(jwt({ alg: 5 }, {})).alg).toBeUndefined();
  });

  it("flags plain base64 with padding", () => {
    const padded = `${encode({ alg: "HS256" })}.${Buffer.from('{"a":1}').toString("base64")}.c2ln`;
    expect(padded).toContain("=");
    expect(decoded(padded).warnings).toEqual([{ kind: "notBase64Url" }]);
  });

  it("says which part is broken", () => {
    const header = encode({ alg: "HS256" });
    const payload = encode({ sub: "x" });
    const cases: [string, unknown][] = [
      ["", { kind: "empty" }],
      ["   ", { kind: "empty" }],
      ["abc", { kind: "parts", count: 1 }],
      [`${header}.${payload}`, { kind: "parts", count: 2 }],
      [`${header}.${payload}.sig.x`, { kind: "parts", count: 4 }],
      ["a.b.c.d.e", { kind: "encrypted" }],
      [`${header}!.${payload}.sig`, { kind: "base64", segment: "header" }],
      [`${header}.${payload}*.sig`, { kind: "base64", segment: "payload" }],
      [`${header}.${payload}.s`, { kind: "base64", segment: "signature" }],
      [`${header}.${payload}.si!g`, { kind: "base64", segment: "signature" }],
      [`${Buffer.from([0xff, 0xfe]).toString("base64url")}.${payload}.sig`, { kind: "utf8", segment: "header" }],
      [`${header}.${Buffer.from([0xc3]).toString("base64url")}.sig`, { kind: "utf8", segment: "payload" }],
      [`${encode("{alg")}.${payload}.sig`, { kind: "json", segment: "header" }],
      [`.${payload}.sig`, { kind: "json", segment: "header" }],
      [`${header}.${encode("not json")}.sig`, { kind: "json", segment: "payload" }],
      [`${encode("[1]")}.${payload}.sig`, { kind: "object", segment: "header" }],
      [`${header}.${encode("null")}.sig`, { kind: "object", segment: "payload" }],
      [`${header}.${encode("42")}.sig`, { kind: "object", segment: "payload" }],
    ];
    for (const [token, error] of cases) {
      const result = decodeJwt(token);
      expect(result.ok, token).toBe(false);
      if (!result.ok) expect(result.error, token).toEqual(error);
    }
  });

  it("returns the parts it found, even when decoding fails", () => {
    const result = decodeJwt("a.b");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.parts).toEqual(["a", "b"]);
  });
});

describe("validity", () => {
  const at = (seconds: number) => new Date(seconds * 1000);
  const token = (payload: Record<string, unknown>) => decoded(jwt({ alg: "HS256" }, payload));

  it("is active before exp, and expired from exp on", () => {
    const expiring = token({ exp: 1000 });
    expect(validity(expiring, at(999))).toEqual({ state: "active", at: at(1000) });
    expect(validity(expiring, at(1000))).toEqual({ state: "expired", at: at(1000) });
    expect(validity(expiring, at(5000))).toEqual({ state: "expired", at: at(1000) });
  });

  it("isn’t valid yet before nbf", () => {
    const later = token({ nbf: 2000, exp: 3000 });
    expect(validity(later, at(1999))).toEqual({ state: "notYet", at: at(2000) });
    expect(validity(later, at(2000))).toEqual({ state: "active", at: at(3000) });
    expect(validity(token({ nbf: 2000 }), at(2500))).toEqual({ state: "noExpiry" });
  });

  it("reports an expired token as expired, even with a future nbf", () => {
    expect(validity(token({ nbf: 2000, exp: 1000 }), at(1500))).toEqual({ state: "expired", at: at(1000) });
  });

  it("never expires without exp", () => {
    expect(validity(token({ iat: 1 }), at(10))).toEqual({ state: "noExpiry" });
  });
});

describe("formatClaimDate", () => {
  it("writes the date in UTC", () => {
    expect(formatClaimDate(new Date("2026-10-09T08:30:05Z"))).toBe("9 Oct 2026, 08:30:05 UTC");
  });
});
