/**
 * UUIDs (RFC 9562) and ULIDs: making version 4 and 7 UUIDs and ULIDs from injected randomness and
 * time, and reading the version, variant and embedded timestamp back out of one.
 */

// cspell:ignore ABCDEFGHJKMNPQRSTVWXYZ HJKMNP

export type IdKind = "v4" | "v7" | "ulid";

export const countLimits = { min: 1, max: 1000 };

/** Clamps a typed count to the limits, falling back to the minimum. */
export const clampCount = (value: string) => {
  const count = Math.trunc(Number(value));
  if (value.trim() === "" || !Number.isFinite(count)) return countLimits.min;
  return Math.min(countLimits.max, Math.max(countLimits.min, count));
};

export interface IdSource {
  /** Milliseconds since the Unix epoch. */
  now: () => number;
  /** `length` uniformly random bytes, e.g. from crypto.getRandomValues. */
  random: (length: number) => Uint8Array;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

/** Hyphenates 32 hex digits as 8-4-4-4-12. */
const hyphenate = (digits: string) =>
  `${digits.slice(0, 8)}-${digits.slice(8, 12)}-${digits.slice(12, 16)}-${digits.slice(16, 20)}-${digits.slice(20)}`;

/** Sets the version nibble and the RFC 9562 variant bits (10xx). */
const stamp = (bytes: Uint8Array, version: number) => {
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | (version << 4);
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return hyphenate(hex(bytes));
};

/** Writes a 48-bit millisecond time big-endian into the first six bytes. */
const writeTime = (bytes: Uint8Array, ms: number) => {
  let time = Math.max(0, Math.min(2 ** 48 - 1, Math.floor(ms)));
  for (let index = 5; index >= 0; index--) {
    bytes[index] = time % 256;
    time = Math.floor(time / 256);
  }
};

/** A version 4 UUID: 122 random bits (RFC 9562 §5.4). */
export const uuidV4 = (random: Uint8Array) => stamp(Uint8Array.from(random.slice(0, 16)), 4);

/** A version 7 UUID: a 48-bit Unix millisecond time, then 74 random bits (RFC 9562 §5.7). */
export const uuidV7 = (ms: number, random: Uint8Array) => {
  const bytes = new Uint8Array(16);
  bytes.set(random.slice(0, 10), 6);
  writeTime(bytes, ms);
  return stamp(bytes, 7);
};

/** Crockford's base 32, which ULIDs use: no I, L, O or U. */
const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A ULID: a 48-bit millisecond time and 80 random bits, as 26 Crockford base 32 characters. */
export const ulid = (ms: number, random: Uint8Array) => {
  const bytes = new Uint8Array(16);
  bytes.set(random.slice(0, 10), 6);
  writeTime(bytes, ms);
  let value = BigInt(`0x${hex(bytes)}`);
  let text = "";
  for (let index = 0; index < 26; index++) {
    text = crockford[Number(value & 31n)]! + text;
    value >>= 5n;
  }
  return text;
};

/**
 * Makes `count` IDs. Version 7 UUIDs and ULIDs made in the same batch share a millisecond, so
 * they're sorted to keep the batch in order, as RFC 9562 §6.2 and the ULID spec ask.
 */
export const generateIds = (kind: IdKind, count: number, source: IdSource) => {
  const ids = Array.from({ length: count }, () => {
    if (kind === "v4") return uuidV4(source.random(16));
    const ms = source.now();
    return kind === "v7" ? uuidV7(ms, source.random(10)) : ulid(ms, source.random(10));
  });
  return kind === "v4" ? ids : ids.sort();
};

type Variant = "ncs" | "rfc" | "microsoft" | "future";

export interface IdInfo {
  kind: "uuid" | "ulid";
  /** Lower-case, hyphenated UUID form, which a ULID has too. */
  uuid: string;
  /** The canonical ULID form, for a ULID. */
  ulid?: string;
  /** The version, for an RFC 9562 variant UUID. */
  version?: number;
  variant?: Variant;
  /** The nil (all zeros) and max (all ones) UUIDs. */
  special?: "nil" | "max";
  /** The embedded time, for versions 1, 6 and 7 and ULIDs. */
  time?: Date;
}

export type InspectResult = { ok: true; info: IdInfo } | { ok: false; error: "empty" | "invalid" | "overflow" };

/** 100-nanosecond intervals from the start of the Gregorian calendar to the Unix epoch. */
const gregorianOffset = 0x01b21dd213814000n;

const variantOf = (digit: number): Variant => {
  if (digit < 8) return "ncs";
  if (digit < 12) return "rfc";
  return digit < 14 ? "microsoft" : "future";
};

/** The time in a version 1 or 6 UUID: a 60-bit count of 100 ns intervals since 15 October 1582. */
const gregorianTime = (digits: string, version: 1 | 6) => {
  const ticks =
    version === 1
      ? `${digits.slice(13, 16)}${digits.slice(8, 12)}${digits.slice(0, 8)}`
      : `${digits.slice(0, 12)}${digits.slice(13, 16)}`;
  return new Date(Number((BigInt(`0x${ticks}`) - gregorianOffset) / 10_000n));
};

const inspectUuid = (digits: string): IdInfo => {
  const uuid = hyphenate(digits);
  if (/^0{32}$/u.test(digits)) return { kind: "uuid", uuid, special: "nil" };
  if (/^f{32}$/u.test(digits)) return { kind: "uuid", uuid, special: "max" };
  const variant = variantOf(parseInt(digits.charAt(16), 16));
  if (variant !== "rfc") return { kind: "uuid", uuid, variant };
  const version = parseInt(digits.charAt(12), 16);
  const info: IdInfo = { kind: "uuid", uuid, variant, version };
  if (version === 7) info.time = new Date(parseInt(digits.slice(0, 12), 16));
  if (version === 1 || version === 6) info.time = gregorianTime(digits, version);
  return info;
};

const inspectUlid = (text: string): InspectResult => {
  let value = 0n;
  for (const char of text) value = value * 32n + BigInt(crockford.indexOf(char));
  // 26 characters hold 130 bits; a ULID only has 128, so the first character can't pass 7.
  if (value >> 128n !== 0n) return { ok: false, error: "overflow" };
  const digits = value.toString(16).padStart(32, "0");
  return {
    ok: true,
    info: { kind: "ulid", uuid: hyphenate(digits), ulid: text, time: new Date(parseInt(digits.slice(0, 12), 16)) },
  };
};

/**
 * Reads a UUID (hyphenated or not, in braces or as a `urn:uuid:`) or a ULID (any case). Only the
 * RFC 9562 variant has versions; the nil and max UUIDs are named as such.
 */
export const inspectId = (input: string): InspectResult => {
  const text = input.trim();
  if (text === "") return { ok: false, error: "empty" };
  const upper = text.toUpperCase();
  if (/^[0-9A-HJKMNP-TV-Z]{26}$/u.test(upper)) return inspectUlid(upper);
  const bare = text
    .toLowerCase()
    .replace(/^urn:uuid:/u, "")
    .replace(/^\{(.*)\}$/u, "$1");
  const match = /^([\da-f]{8})-?([\da-f]{4})-?([\da-f]{4})-?([\da-f]{4})-?([\da-f]{12})$/u.exec(bare);
  if (!match) return { ok: false, error: "invalid" };
  return { ok: true, info: inspectUuid(match.slice(1).join("")) };
};
