/**
 * Shareable tool state: a flat object of input values, encoded as base64url JSON in the URL
 * fragment (`#s=…`).
 *
 * The fragment, never the query string: browsers don't send the fragment to the server, so what
 * someone pastes into a tool (a JSON payload, a SQL query, a diff of private config) never shows
 * up in Vercel's request logs or in a referrer. A `?state=` parameter would be logged with every
 * request.
 */

type ShareValue = string | boolean;
export type ShareState = Record<string, ShareValue>;

export const SHARE_PREFIX = "#s=";

/**
 * The longest fragment we'll write or read, in characters. Comfortably inside what browsers,
 * chat apps and email clients keep intact, and small enough that a crafted link can't make the
 * page decode megabytes.
 */
export const MAX_SHARE_LENGTH = 4000;

const KEY = /^[a-z][\w-]{0,31}$/iu;

const toBase64Url = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
};

const fromBase64Url = (text: string) => {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
};

const isShareState = (value: unknown): value is ShareState =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.entries(value).every(
    ([key, item]) => KEY.test(key) && (typeof item === "string" || typeof item === "boolean"),
  );

export type EncodeResult = { ok: true; hash: string } | { ok: false; length: number };

/** Encodes `state` as a `#s=…` fragment, or reports its length when it’s over `max`. */
export const encodeShareState = (state: ShareState, max = MAX_SHARE_LENGTH): EncodeResult => {
  const hash = SHARE_PREFIX + toBase64Url(new TextEncoder().encode(JSON.stringify(state)));
  return hash.length <= max ? { ok: true, hash } : { ok: false, length: hash.length };
};

/**
 * Decodes a fragment written by `encodeShareState`. Returns undefined for anything else: another
 * kind of fragment, one that’s too long, malformed base64 or UTF-8, or JSON that isn’t a flat
 * object of strings and booleans with plain keys.
 */
export const decodeShareState = (hash: string, max = MAX_SHARE_LENGTH): ShareState | undefined => {
  if (!hash.startsWith(SHARE_PREFIX) || hash.length > max) return undefined;
  const body = hash.slice(SHARE_PREFIX.length);
  if (!/^[\w-]+$/u.test(body)) return undefined;
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(fromBase64Url(body)));
    return isShareState(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

/** The page’s own URL with `hash` as its fragment and no query string. */
export const shareUrl = (href: string, hash: string) => {
  const url = new URL(href);
  url.search = "";
  url.hash = hash;
  return url.href;
};
