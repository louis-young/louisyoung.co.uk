/** The digests `crypto.subtle.digest` supports, weakest first. */
export const hashAlgorithms = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;

/** Lowercase (or uppercase) hexadecimal, two digits per byte. */
export const toHex = (buffer: ArrayBuffer, uppercase = false) => {
  const hex = Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return uppercase ? hex.toUpperCase() : hex;
};

/** Standard, padded Base64 (RFC 4648 §4). */
export const toBase64 = (buffer: ArrayBuffer) => {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary);
};

export const uuidLimits = { min: 1, max: 20 };

/** Reads the requested number of UUIDs, clamped to 1–20. Anything unreadable becomes 1. */
export const uuidCount = (value: string) => {
  const count = Math.round(Number(value));
  if (value.trim() === "" || !Number.isFinite(count)) return uuidLimits.min;
  return Math.min(uuidLimits.max, Math.max(uuidLimits.min, count));
};
