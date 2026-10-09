/**
 * Decodes a JSON Web Token (RFC 7519) for reading: the header and payload as JSON, the registered
 * claims and the token's expiry relative to a given time. It never verifies the signature; that
 * needs the key, and this runs on whatever the reader pastes.
 */

type JwtSegment = "header" | "payload" | "signature";

export type JwtError =
  | { kind: "empty" }
  /** A JWE (an encrypted token) has five parts and can't be read without the key. */
  | { kind: "encrypted" }
  | { kind: "parts"; count: number }
  | { kind: "base64"; segment: JwtSegment }
  | { kind: "utf8"; segment: Exclude<JwtSegment, "signature"> }
  | { kind: "json"; segment: Exclude<JwtSegment, "signature"> }
  | { kind: "object"; segment: Exclude<JwtSegment, "signature"> };

type TimeClaimName = "iat" | "nbf" | "exp";

interface TimeClaim {
  name: TimeClaimName;
  /** Seconds since the Unix epoch, as written. */
  seconds: number;
  date: Date;
}

export type JwtWarning =
  /** `alg: none`: anyone could have written this token. */
  | { kind: "unsecured" }
  /** `alg: none` but with a signature anyway, which RFC 7519 §6.1 forbids. */
  | { kind: "unsecuredSignature" }
  /** A signing algorithm, but no signature. */
  | { kind: "missingSignature" }
  /** Padding or the `+` and `/` of plain base64, which base64url (RFC 7515 §2) leaves out. */
  | { kind: "notBase64Url" }
  /** A time claim that isn't a NumericDate. */
  | { kind: "claimType"; claim: TimeClaimName }
  /** A time claim so large it's surely milliseconds, not seconds. */
  | { kind: "milliseconds"; claim: TimeClaimName };

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  /** The three parts as written, for showing the token split up. */
  parts: [string, string, string];
  /** Pretty-printed JSON. */
  headerJson: string;
  payloadJson: string;
  /** The `alg` header, if it's a string. */
  alg: string | undefined;
  /** Signature length in bytes. */
  signatureBytes: number;
  /** iat, nbf and exp, in that order, when they hold a NumericDate. */
  times: TimeClaim[];
  /** iss, sub, aud and jti, when present, as display text. */
  claims: { name: "iss" | "sub" | "aud" | "jti"; value: string }[];
  warnings: JwtWarning[];
}

export type JwtResult = { ok: true; token: DecodedJwt } | { ok: false; error: JwtError; parts: string[] };

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Decodes base64url, with or without padding. The `+` and `/` of plain base64 are accepted too,
 * since tokens get copied through tools that use it. Undefined if it isn't valid.
 */
export const base64UrlDecode = (text: string): Uint8Array | undefined => {
  const body = text
    .replace(/={1,2}$/u, "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
  if (!/^[\w-]*$/u.test(body) || body.length % 4 === 1) return undefined;
  // Padding, when there is any, must make the length a multiple of four.
  if (body.length !== text.length && text.length % 4 !== 0) return undefined;
  const bytes = new Uint8Array(Math.floor((body.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let index = 0;
  for (const char of body) {
    buffer = ((buffer << 6) | alphabet.indexOf(char)) & 0xffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[index++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes;
};

const utf8 = new TextDecoder("utf-8", { fatal: true });

type JsonSegment = Exclude<JwtSegment, "signature">;

const decodeJson = (
  text: string,
  segment: JsonSegment,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: JwtError } => {
  const bytes = base64UrlDecode(text);
  if (!bytes) return { ok: false, error: { kind: "base64", segment } };
  let json: string;
  try {
    json = utf8.decode(bytes);
  } catch {
    return { ok: false, error: { kind: "utf8", segment } };
  }
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return { ok: false, error: { kind: "json", segment } };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, error: { kind: "object", segment } };
  }
  return { ok: true, value: value as Record<string, unknown> };
};

/** The largest time a Date can hold, in seconds. */
const maxSeconds = 8.64e12;

/** NumericDates past this (the year 5138) are almost certainly milliseconds. */
const millisecondThreshold = 1e11;

const timeNames: TimeClaimName[] = ["iat", "nbf", "exp"];
const textNames = ["iss", "sub", "aud", "jti"] as const;

const claimText = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value.join(", ");
  return JSON.stringify(value);
};

/** Decodes a JWT without verifying it. A leading `Bearer ` and surrounding space are ignored. */
export const decodeJwt = (input: string): JwtResult => {
  const text = input.trim().replace(/^bearer\s+/iu, "");
  const parts = text === "" ? [] : text.split(".");
  if (parts.length === 0) return { ok: false, error: { kind: "empty" }, parts };
  if (parts.length === 5) return { ok: false, error: { kind: "encrypted" }, parts };
  if (parts.length !== 3) return { ok: false, error: { kind: "parts", count: parts.length }, parts };
  const [headerText = "", payloadText = "", signatureText = ""] = parts;

  const header = decodeJson(headerText, "header");
  if (!header.ok) return { ok: false, error: header.error, parts };
  const payload = decodeJson(payloadText, "payload");
  if (!payload.ok) return { ok: false, error: payload.error, parts };
  const signature = base64UrlDecode(signatureText);
  if (!signature) return { ok: false, error: { kind: "base64", segment: "signature" }, parts };

  const warnings: JwtWarning[] = [];
  const alg = typeof header.value["alg"] === "string" ? header.value["alg"] : undefined;
  if (alg?.toLowerCase() === "none") {
    warnings.push({ kind: signature.length > 0 ? "unsecuredSignature" : "unsecured" });
  } else if (signature.length === 0) warnings.push({ kind: "missingSignature" });
  if (/[=+/]/u.test(text)) warnings.push({ kind: "notBase64Url" });

  const times: TimeClaim[] = [];
  for (const name of timeNames) {
    if (!(name in payload.value)) continue;
    const seconds = payload.value[name];
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || Math.abs(seconds) > maxSeconds) {
      warnings.push({ kind: "claimType", claim: name });
      continue;
    }
    if (Math.abs(seconds) >= millisecondThreshold) warnings.push({ kind: "milliseconds", claim: name });
    times.push({ name, seconds, date: new Date(seconds * 1000) });
  }

  return {
    ok: true,
    token: {
      header: header.value,
      payload: payload.value,
      parts: [headerText, payloadText, signatureText],
      headerJson: JSON.stringify(header.value, null, 2),
      payloadJson: JSON.stringify(payload.value, null, 2),
      alg,
      signatureBytes: signature.length,
      times,
      claims: textNames
        .filter((name) => name in payload.value)
        .map((name) => ({ name, value: claimText(payload.value[name]) })),
      warnings,
    },
  };
};

export type JwtValidity =
  | { state: "expired"; at: Date }
  | { state: "notYet"; at: Date }
  | { state: "active"; at: Date }
  | { state: "noExpiry" };

/**
 * Where `now` falls against the token's nbf and exp. RFC 7519 §4.1.4 makes a token expired on
 * or after exp; §4.1.5 makes it valid from nbf. No clock skew is allowed for.
 */
export const validity = (token: DecodedJwt, now: Date): JwtValidity => {
  const time = (name: TimeClaimName) => token.times.find((claim) => claim.name === name)?.date;
  const exp = time("exp");
  const nbf = time("nbf");
  if (exp && now.getTime() >= exp.getTime()) return { state: "expired", at: exp };
  if (nbf && now.getTime() < nbf.getTime()) return { state: "notYet", at: nbf };
  return exp ? { state: "active", at: exp } : { state: "noExpiry" };
};

/** A NumericDate for display, e.g. “9 Oct 2026, 09:30:00 UTC”. */
export const formatClaimDate = (date: Date) =>
  `${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }).format(date)} UTC`;
