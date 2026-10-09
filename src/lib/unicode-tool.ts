/**
 * Unicode inspection: grapheme clusters, code points, UTF-8 and UTF-16, General Category,
 * normalisation forms, and the invisible and look-alike characters that cause trouble.
 */

// Unicode’s own abbreviations for the characters flagged below.
// cspell:ignore HWHF IDSP LSEP MMSP MQSP NNBSP NQSP OGHAM PSEP THSP ZWSP

/** Unicode’s General Category values, by short alias. Their names are UI text, in the message catalogue. */
export const generalCategories = [
  "Lu",
  "Ll",
  "Lt",
  "Lm",
  "Lo",
  "Mn",
  "Mc",
  "Me",
  "Nd",
  "Nl",
  "No",
  "Pc",
  "Pd",
  "Ps",
  "Pe",
  "Pi",
  "Pf",
  "Po",
  "Sm",
  "Sc",
  "Sk",
  "So",
  "Zs",
  "Zl",
  "Zp",
  "Cc",
  "Cf",
  "Cs",
  "Co",
  "Cn",
] as const;

export type GeneralCategory = (typeof generalCategories)[number];

const categoryPatterns = generalCategories.map(
  (category) => [category, new RegExp(String.raw`^\p{gc=${category}}$`, "u")] as const,
);

/** The General Category of a code point, from the engine's own Unicode tables. */
export const generalCategory = (codePoint: number): GeneralCategory => {
  const char = String.fromCodePoint(codePoint);
  return categoryPatterns.find(([, pattern]) => pattern.test(char))?.[0] ?? "Cn";
};

export const formatCodePoint = (codePoint: number) => `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;

const hex = (value: number, width: number) => value.toString(16).toUpperCase().padStart(width, "0");

/** The code point's UTF-8 bytes, as hex. Lone surrogates become U+FFFD, as TextEncoder does. */
export const utf8Bytes = (codePoint: number) =>
  [...new TextEncoder().encode(String.fromCodePoint(codePoint))].map((byte) => hex(byte, 2));

/** The code point's UTF-16 code units, as hex. */
export const utf16Units = (codePoint: number) => {
  const char = String.fromCodePoint(codePoint);
  return Array.from({ length: char.length }, (_, i) => hex(char.charCodeAt(i), 4));
};

export type FlagKind = "invisible" | "bidi" | "space" | "confusable" | "control";

export interface Flag {
  kind: FlagKind;
  /** A short name for the character, e.g. ZWJ, or the Latin letter it looks like. */
  label: string;
}

/** Zero-width and otherwise invisible characters, by code point, with a short name. */
const invisible: Record<number, string> = {
  0x00ad: "SHY",
  0x034f: "CGJ",
  0x061c: "ALM",
  0x115f: "HCF",
  0x1160: "HJF",
  0x17b4: "KIV AQ",
  0x17b5: "KIV AA",
  0x180e: "MVS",
  0x200b: "ZWSP",
  0x200c: "ZWNJ",
  0x200d: "ZWJ",
  0x2060: "WJ",
  0x2061: "FA",
  0x2062: "IT",
  0x2063: "IS",
  0x2064: "IP",
  0x3164: "HF",
  0xfeff: "BOM",
  0xffa0: "HWHF",
};

/** Characters that change the direction of the text around them. */
const bidi: Record<number, string> = {
  0x061c: "ALM",
  0x200e: "LRM",
  0x200f: "RLM",
  0x202a: "LRE",
  0x202b: "RLE",
  0x202c: "PDF",
  0x202d: "LRO",
  0x202e: "RLO",
  0x2066: "LRI",
  0x2067: "RLI",
  0x2068: "FSI",
  0x2069: "PDI",
};

/** Spaces that look like U+0020 but aren't. */
const spaces: Record<number, string> = {
  0x00a0: "NBSP",
  0x1680: "OGHAM",
  0x2000: "NQSP",
  0x2001: "MQSP",
  0x2002: "ENSP",
  0x2003: "EMSP",
  0x2004: "3/MSP",
  0x2005: "4/MSP",
  0x2006: "6/MSP",
  0x2007: "FSP",
  0x2008: "PSP",
  0x2009: "THSP",
  0x200a: "HSP",
  0x2028: "LSEP",
  0x2029: "PSEP",
  0x202f: "NNBSP",
  0x205f: "MMSP",
  0x3000: "IDSP",
};

/** Cyrillic and Greek letters that look like Latin ones, mapped to the Latin letter. */
const confusables: Record<number, string> = {
  // Cyrillic lower case
  0x0430: "a",
  0x0441: "c",
  0x0501: "d",
  0x0435: "e",
  0x04bb: "h",
  0x0456: "i",
  0x0458: "j",
  0x043e: "o",
  0x0440: "p",
  0x051b: "q",
  0x0455: "s",
  0x051d: "w",
  0x0445: "x",
  0x0443: "y",
  // Cyrillic upper case
  0x0410: "A",
  0x0412: "B",
  0x0421: "C",
  0x0415: "E",
  0x041d: "H",
  0x0406: "I",
  0x0408: "J",
  0x041a: "K",
  0x041c: "M",
  0x041e: "O",
  0x0420: "P",
  0x0405: "S",
  0x0422: "T",
  0x0425: "X",
  0x04ae: "Y",
  // Greek
  0x0391: "A",
  0x0392: "B",
  0x0395: "E",
  0x0396: "Z",
  0x0397: "H",
  0x0399: "I",
  0x039a: "K",
  0x039c: "M",
  0x039d: "N",
  0x039f: "O",
  0x03a1: "P",
  0x03a4: "T",
  0x03a5: "Y",
  0x03a7: "X",
  0x03bf: "o",
  0x03bd: "v",
};

/** What, if anything, is worth flagging about a code point. */
export const flagsFor = (codePoint: number): Flag[] => {
  const flags: Flag[] = [];
  if (bidi[codePoint]) flags.push({ kind: "bidi", label: bidi[codePoint] });
  else if (invisible[codePoint]) flags.push({ kind: "invisible", label: invisible[codePoint] });
  // Tag characters spell out hidden ASCII; they're used to smuggle text past readers.
  else if (codePoint >= 0xe0000 && codePoint <= 0xe007f) flags.push({ kind: "invisible", label: "TAG" });
  if (spaces[codePoint]) flags.push({ kind: "space", label: spaces[codePoint] });
  if (confusables[codePoint]) flags.push({ kind: "confusable", label: confusables[codePoint] });
  // Tab, line feed and carriage return are expected in pasted text.
  if (generalCategory(codePoint) === "Cc" && ![0x09, 0x0a, 0x0d].includes(codePoint)) {
    // Caret notation for C0 controls and DEL, as terminals print them; C1 controls have none.
    const caret = codePoint < 0x20 || codePoint === 0x7f;
    flags.push({
      kind: "control",
      label: caret ? `^${String.fromCharCode((codePoint + 0x40) & 0x7f)}` : formatCodePoint(codePoint),
    });
  }
  return flags;
};

/** A visible stand-in for a character that would otherwise show as nothing, or undefined. */
export const placeholderFor = (codePoint: number) => {
  if (codePoint === 0x20) return "SP";
  if (codePoint === 0x09) return "TAB";
  if (codePoint === 0x0a) return "LF";
  if (codePoint === 0x0d) return "CR";
  const flag = flagsFor(codePoint).find((item) => item.kind !== "confusable");
  if (flag) return flag.label;
  const category = generalCategory(codePoint);
  if (category === "Cf" || category === "Cc" || category === "Zs") return formatCodePoint(codePoint);
  // Variation selectors change how the previous character renders, and show nothing themselves.
  if ((codePoint >= 0xfe00 && codePoint <= 0xfe0f) || (codePoint >= 0xe0100 && codePoint <= 0xe01ef)) {
    return `VS${codePoint >= 0xe0100 ? codePoint - 0xe0100 + 17 : codePoint - 0xfe00 + 1}`;
  }
  return undefined;
};

export interface CodePointInfo {
  codePoint: number;
  label: string;
  category: GeneralCategory;
  utf8: string[];
  utf16: string[];
  flags: Flag[];
  /** A visible stand-in when the character renders as nothing. */
  placeholder: string | undefined;
}

export interface Grapheme {
  text: string;
  /** Offset in UTF-16 code units. */
  index: number;
  codePoints: CodePointInfo[];
}

export const describeCodePoint = (codePoint: number): CodePointInfo => ({
  codePoint,
  label: formatCodePoint(codePoint),
  category: generalCategory(codePoint),
  utf8: utf8Bytes(codePoint),
  utf16: utf16Units(codePoint),
  flags: flagsFor(codePoint),
  placeholder: placeholderFor(codePoint),
});

/** Every code point in a string. Lone surrogates come through as themselves. */
export const codePointsOf = (text: string) => Array.from(text, (char) => char.codePointAt(0)!);

/** Splits text into grapheme clusters, the characters a reader sees. */
export const graphemes = (text: string, locale = "en-GB"): Grapheme[] => {
  const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
  return [...segmenter.segment(text)].map(({ segment, index }) => ({
    text: segment,
    index,
    codePoints: codePointsOf(segment).map(describeCodePoint),
  }));
};

export const normalisationForms = ["NFC", "NFD", "NFKC", "NFKD"] as const;
type NormalisationForm = (typeof normalisationForms)[number];

export interface Normalised {
  form: NormalisationForm;
  text: string;
  /** Whether the form differs from the input. */
  changed: boolean;
  codePoints: number;
}

export const normalise = (text: string): Normalised[] =>
  normalisationForms.map((form) => {
    const normalised = text.normalize(form);
    return { form, text: normalised, changed: normalised !== text, codePoints: codePointsOf(normalised).length };
  });

export interface Counts {
  /** `string.length` in JavaScript: UTF-16 code units. */
  utf16: number;
  codePoints: number;
  graphemes: number;
  utf8: number;
}

export const counts = (text: string, clusters = graphemes(text)): Counts => ({
  utf16: text.length,
  codePoints: codePointsOf(text).length,
  graphemes: clusters.length,
  utf8: new TextEncoder().encode(text).length,
});

/** How many code points of each flag kind the text holds. */
export const flagSummary = (clusters: readonly Grapheme[]) => {
  const summary: Record<FlagKind, number> = { invisible: 0, bidi: 0, space: 0, confusable: 0, control: 0 };
  for (const cluster of clusters) {
    for (const point of cluster.codePoints) for (const flag of point.flags) summary[flag.kind]++;
  }
  return summary;
};

/** Whether a word mixes Latin letters with Cyrillic or Greek ones: a classic spoofing tell. */
export const mixedScriptWords = (text: string) =>
  (text.match(/[\p{L}\p{M}]+/gu) ?? []).filter(
    (word) => /\p{Script=Latin}/u.test(word) && /[\p{Script=Cyrillic}\p{Script=Greek}]/u.test(word),
  );
