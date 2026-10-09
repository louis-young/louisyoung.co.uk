// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { fromNow, initJwt } from "../../src/scripts/tool-jwt";

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

const messages = {
  copied: "Copied",
  empty: "Paste a token.",
  encrypted: "Encrypted.",
  "parts-error": "Three parts, not {count}.",
  "error-base64": "Bad base64 in the {segment}.",
  "error-utf8": "Bad UTF-8 in the {segment}.",
  "error-json": "Bad JSON in the {segment}.",
  "error-object": "Not an object in the {segment}.",
  "segment-header": "header",
  "segment-payload": "payload",
  "segment-signature": "signature",
  expired: "Expired {when}.",
  "not-yet": "Starts {when}.",
  active: "Expires {when}.",
  "no-expiry": "Never expires.",
  "no-alg": "Not set",
  "warning-unsecured": "Unsecured.",
  "warning-unsecured-signature": "Unsecured, with a signature.",
  "warning-missing-signature": "{alg} without a signature.",
  "warning-not-base64-url": "Plain base64.",
  "warning-claim-type": "{claim} isn’t a date.",
  "warning-milliseconds": "{claim} is in milliseconds.",
  "claim-iss": "Issuer",
  "claim-sub": "Subject",
  "claim-aud": "Audience",
  "claim-jti": "ID",
  "claim-iat": "Issued",
  "claim-nbf": "Not before",
  "claim-exp": "Expires",
};

const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = (header: unknown, payload: unknown, signature = "c2ln") =>
  `${encode(header)}.${encode(payload)}.${signature}`;

const now = new Date("2026-10-09T12:00:00Z");
const seconds = (iso: string) => new Date(iso).getTime() / 1000;

const setup = (token: string) => {
  const attributes = Object.entries(messages)
    .map(([key, value]) => `data-${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <div data-jwt ${attributes}>
      <textarea data-input></textarea>
      <p data-status></p>
      <ul data-warnings hidden></ul>
      <code data-parts></code>
      <button data-copy="header"><span data-copy-label>Copy</span></button>
      <code data-header></code>
      <button data-copy="payload"><span data-copy-label>Copy</span></button>
      <code data-payload></code>
      <dl data-claims></dl><p data-no-claims hidden></p>
      <code data-alg></code><span data-length></span><code data-signature></code>
    </div>`;
  const get = (selector: string) => document.querySelector<HTMLElement>(selector)!;
  const input = document.querySelector<HTMLTextAreaElement>("[data-input]")!;
  input.value = token;
  initJwt(document, () => now);
  const type = (value: string) => {
    input.value = value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const claims = () =>
    [...document.querySelectorAll("[data-claims] > div")].map(
      (row) => `${row.querySelector("dt")!.textContent}: ${row.querySelector("dd")!.textContent}`,
    );
  const warnings = () => [...document.querySelectorAll("[data-warnings] li")].map((item) => item.textContent);
  return { get, input, type, claims, warnings };
};

describe("fromNow", () => {
  it("says how far a time is from now", () => {
    expect(fromNow(new Date("2026-10-09T15:00:00Z"), now)).toBe("in 3 hours");
    expect(fromNow(new Date("2026-10-07T12:00:00Z"), now)).toBe("2 days ago");
  });
});

describe("JWT decoder", () => {
  it("does nothing without the tool", () => {
    expect(() => {
      initJwt();
    }).not.toThrow();
  });

  it("decodes the header, payload, claims and signature", () => {
    const token = jwt(
      { alg: "HS256", typ: "JWT" },
      { iss: "auth", sub: "42", iat: seconds("2026-10-09T11:00:00Z"), exp: seconds("2026-10-09T15:00:00Z") },
    );
    const { get, claims, warnings, input } = setup(token);
    expect(get("[data-status]").textContent).toBe("Expires in 3 hours.");
    expect(get("[data-status]").dataset["state"]).toBe("active");
    expect(get("[data-header]").textContent).toBe('{\n  "alg": "HS256",\n  "typ": "JWT"\n}');
    expect(JSON.parse(get("[data-payload]").textContent)).toMatchObject({ iss: "auth", sub: "42" });
    expect(claims()).toEqual([
      "Issuer: auth",
      "Subject: 42",
      "Issued: 9 Oct 2026, 11:00:00 UTC1 hour ago",
      "Expires: 9 Oct 2026, 15:00:00 UTCin 3 hours",
    ]);
    expect(get("[data-claims] time").getAttribute("datetime")).toBe("2026-10-09T11:00:00.000Z");
    expect(get("[data-no-claims]").hidden).toBe(true);
    expect(warnings()).toEqual([]);
    expect(get("[data-warnings]").hidden).toBe(true);
    expect(get("[data-alg]").textContent).toBe("HS256");
    expect(get("[data-length]").textContent).toBe("3");
    expect(get("[data-signature]").textContent).toBe("c2ln");
    expect([...document.querySelectorAll("[data-parts] [data-part]")].map((part) => part.textContent)).toEqual(
      token.split("."),
    );
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("says when a token has expired or isn’t valid yet", () => {
    const { get, type } = setup(jwt({ alg: "HS256" }, { exp: seconds("2026-10-07T12:00:00Z") }));
    expect(get("[data-status]").textContent).toBe("Expired 2 days ago.");
    expect(get("[data-status]").dataset["state"]).toBe("expired");
    type(jwt({ alg: "HS256" }, { nbf: seconds("2026-10-09T13:00:00Z") }));
    expect(get("[data-status]").textContent).toBe("Starts in 1 hour.");
    type(jwt({ alg: "HS256" }, { name: "x" }));
    expect(get("[data-status]").textContent).toBe("Never expires.");
    expect(get("[data-no-claims]").hidden).toBe(false);
  });

  it("warns about unsecured tokens and odd claims", () => {
    const { get, warnings, type } = setup(jwt({ alg: "none" }, { exp: "soon" }, ""));
    expect(warnings()).toEqual(["Unsecured.", "exp isn’t a date."]);
    expect(get("[data-warnings]").hidden).toBe(false);
    type(jwt({ alg: "RS256" }, {}, ""));
    expect(warnings()).toEqual(["RS256 without a signature."]);
    type(jwt({}, {}));
    expect(get("[data-alg]").textContent).toBe("Not set");
  });

  it("names the broken part and clears the results", () => {
    const { get, type, input, claims } = setup(jwt({ alg: "HS256" }, { sub: "1" }));
    type(`${encode({ alg: "HS256" })}.!!!.sig`);
    expect(get("[data-status]").textContent).toBe("Bad base64 in the payload.");
    expect(get("[data-status]").hasAttribute("data-invalid")).toBe(true);
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(get('[data-parts] [data-part="payload"]').hasAttribute("data-broken")).toBe(true);
    expect(get('[data-parts] [data-part="header"]').hasAttribute("data-broken")).toBe(false);
    expect(get("[data-header]").textContent).toBe("");
    expect(claims()).toEqual([]);
    expect(document.querySelector<HTMLButtonElement>("[data-copy]")!.disabled).toBe(true);
    type("a.b");
    expect(get("[data-status]").textContent).toBe("Three parts, not 2.");
    type("a.b.c.d.e");
    expect(get("[data-status]").textContent).toBe("Encrypted.");
    type("");
    expect(get("[data-status]").textContent).toBe("Paste a token.");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("copies the header and payload", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const { get } = setup(jwt({ alg: "HS256" }, { sub: "1" }));
    get('[data-copy="header"]').click();
    get('[data-copy="payload"]').click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(2);
    });
    expect(writeText).toHaveBeenNthCalledWith(1, '{\n  "alg": "HS256"\n}');
    expect(writeText).toHaveBeenNthCalledWith(2, '{\n  "sub": "1"\n}');
  });
});
