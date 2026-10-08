import type { Messages } from "./en-GB";

const accents: Record<string, string> = {
  a: "á",
  b: "ƀ",
  c: "ç",
  d: "ð",
  e: "é",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "í",
  j: "ĵ",
  k: "ķ",
  l: "ļ",
  m: "ɱ",
  n: "ñ",
  o: "ó",
  p: "þ",
  q: "ǫ",
  r: "ŕ",
  s: "š",
  t: "ţ",
  u: "ú",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ý",
  z: "ž",
  A: "Á",
  B: "Ɓ",
  C: "Ç",
  D: "Ð",
  E: "É",
  F: "Ƒ",
  G: "Ĝ",
  H: "Ĥ",
  I: "Í",
  J: "Ĵ",
  K: "Ķ",
  L: "Ļ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ó",
  P: "Þ",
  Q: "Ǫ",
  R: "Ŕ",
  S: "Š",
  T: "Ţ",
  U: "Ú",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẋ",
  Y: "Ý",
  Z: "Ž",
};

/**
 * Pseudo-localises a message: accents every letter, pads it by roughly 40% to simulate
 * longer languages and wraps it in brackets so truncation is obvious. ICU placeholders
 * (`{name}`, `{count, plural, …}`) and `#` are left untouched.
 */
export const pseudoLocalise = (message: string): string => {
  let depth = 0;
  let output = "";
  for (const char of message) {
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    output += depth === 0 && char !== "}" ? (accents[char] ?? char) : char;
  }
  const letters = message.replace(/\{[^}]*\}/gu, "").replace(/[^a-z]/giu, "").length;
  const padding = "·".repeat(Math.ceil(letters * 0.4));
  return `⟦${output}${padding ? ` ${padding}` : ""}⟧`;
};

export const pseudoMessages = (source: Messages): Messages =>
  Object.fromEntries(Object.entries(source).map(([key, value]) => [key, pseudoLocalise(value)])) as Messages;
