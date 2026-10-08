type EncodeError = "base64" | "utf8" | "url" | "jwtParts" | "jwtHeader" | "jwtPayload";

export type EncodeResult = { output: string } | { error: EncodeError };

/** Encodes text as Base64 via its UTF-8 bytes, so any Unicode survives (plain btoa throws on it). */
export const base64Encode = (text: string) => {
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

const base64Pattern = /^[A-Za-z0-9+/]*={0,2}$/u;

/** Decodes standard or URL-safe Base64, with or without padding, to UTF-8 text. */
export const base64Decode = (input: string): EncodeResult => {
  const normalised = input.replace(/\s+/gu, "").replaceAll("-", "+").replaceAll("_", "/");
  const unpadded = normalised.replace(/=+$/u, "");
  if (!base64Pattern.test(normalised) || unpadded.length % 4 === 1) return { error: "base64" };
  const binary = atob(unpadded.padEnd(Math.ceil(unpadded.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  try {
    return { output: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return { error: "utf8" };
  }
};

export const urlEncode = (text: string) => encodeURIComponent(text);

export const urlDecode = (input: string): EncodeResult => {
  try {
    return { output: decodeURIComponent(input) };
  } catch {
    return { error: "url" };
  }
};

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escapes the five characters that matter in HTML text and attribute values. */
export const htmlEscape = (text: string) => text.replace(/[&<>"']/gu, (character) => escapes[character] ?? character);

const named: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: "\u00a0",
  copy: "©",
  reg: "®",
  trade: "™",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  pound: "£",
  euro: "€",
};

const codePoint = (value: number) =>
  value > 0x10ffff || (value >= 0xd800 && value <= 0xdfff) || value === 0 ? "\ufffd" : String.fromCodePoint(value);

/** Unescapes numeric entities and the common named ones. Unknown names are left exactly as written. */
export const htmlUnescape = (input: string) =>
  input.replace(
    /&(?:#[xX]([0-9a-fA-F]{1,6})|#(\d{1,7})|([a-zA-Z]+));/gu,
    (entity, hex?: string, decimal?: string, name?: string) => {
      if (hex) return codePoint(Number.parseInt(hex, 16));
      if (decimal) return codePoint(Number(decimal));
      return named[name ?? ""] ?? entity;
    },
  );

interface JwtTime {
  claim: "exp" | "iat" | "nbf";
  date: Date;
}

export type JwtResult =
  { header: Record<string, unknown>; payload: Record<string, unknown>; times: JwtTime[] } | { error: EncodeError };

const jsonPart = (part: string) => {
  const decoded = base64Decode(part);
  if ("error" in decoded) return undefined;
  try {
    const value: unknown = JSON.parse(decoded.output);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
};

/** Decodes a JWT's header and payload. It does not, and cannot, verify the signature. */
export const decodeJwt = (input: string): JwtResult => {
  const parts = input.trim().split(".");
  if (parts.length !== 3) return { error: "jwtParts" };
  const header = jsonPart(parts[0] ?? "");
  if (!header) return { error: "jwtHeader" };
  const payload = jsonPart(parts[1] ?? "");
  if (!payload) return { error: "jwtPayload" };
  const times = (["iat", "nbf", "exp"] as const).flatMap((claim) => {
    const value = payload[claim];
    const date = new Date(typeof value === "number" ? value * 1000 : Number.NaN);
    return Number.isNaN(date.getTime()) ? [] : [{ claim, date }];
  });
  return { header, payload, times };
};
