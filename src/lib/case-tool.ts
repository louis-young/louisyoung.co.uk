/** Every case the converter writes, in the order the tool shows them. */
export const caseNames = [
  "camel",
  "pascal",
  "snake",
  "screaming",
  "kebab",
  "title",
  "sentence",
  "dot",
  "path",
  "slug",
] as const;
export type CaseName = (typeof caseNames)[number];

const upper = String.raw`\p{Lu}\p{Lt}`;
const lower = String.raw`\p{Ll}\p{Lm}\p{Lo}\p{M}`;
const digit = String.raw`\p{N}`;

/**
 * One word: a plural acronym (`IDs`), an acronym before a capitalised word (`HTTP` in `HTTPResponse`), a word with an
 * optional capital (`parse`, `Response`), an acronym (`HTML5`) or a number with a suffix (`1st`, `2FA`).
 * Digits stay with the word they follow, so `base64Encode` is `base64` and `Encode`.
 */
const wordPattern = new RegExp(
  [
    `[${upper}]{2,}s(?![${lower}])`,
    `[${upper}]+(?=[${upper}][${lower}])`,
    `[${upper}]?[${lower}]+[${digit}]*`,
    `[${upper}]+[${digit}]*`,
    `[${digit}]+[${upper}]+(?![${lower}])`,
    `[${digit}]+[${lower}]*`,
  ].join("|"),
  "gu",
);

/** Splits text into words at spaces, punctuation and case changes. Apostrophes inside a word are dropped. */
export const splitWords = (text: string) =>
  text.replace(/(?<=[\p{L}\p{N}])['’](?=\p{L})/gu, "").match(wordPattern) ?? [];

const capitalise = (word: string) => {
  const [first = "", ...rest] = word;
  return first.toUpperCase() + rest.join("").toLowerCase();
};

/** Short words Title Case leaves in lower case unless they start or end the title. */
const minorWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "the",
  "to",
  "vs",
  "via",
]);

/** `HTTP`, `HTML5`, `IDs`: two or more capitals, perhaps with digits or a plural `s`. */
const isAcronym = (word: string) => /^[\p{Lu}\p{N}]+s?$/u.test(word) && (word.match(/\p{Lu}/gu) ?? []).length > 1;

/**
 * Letters that don’t decompose into a base letter and an accent, spelt the way they usually are
 * in URLs.
 */
const transliterations: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ð: "d",
  ł: "l",
  þ: "th",
  ı: "i",
};

const specialLetters = new RegExp(`[${Object.keys(transliterations).join("")}]`, "gu");

/** `Crème Brûlée & Co.` → `creme-brulee-and-co`: ASCII letters and digits only. */
const slugWords = (line: string) =>
  splitWords(line.replace(/\s&\s/gu, " and ").normalize("NFKD").replace(/\p{M}/gu, ""))
    .map((word) =>
      word
        .toLowerCase()
        .replace(specialLetters, (letter) => transliterations[letter]!)
        .replace(/[^a-z0-9]/gu, ""),
    )
    .filter(Boolean);

const convertLine = (line: string, name: CaseName) => {
  if (name === "slug") return slugWords(line).join("-");
  const words = splitWords(line);
  // Shouting input keeps nothing as an acronym; otherwise `HTTP` stays `HTTP` in prose cases.
  const keepAcronyms = line !== line.toUpperCase();
  const prose = (word: string) => (keepAcronyms && isAcronym(word) ? word : word.toLowerCase());
  switch (name) {
    case "camel":
      return words.map((word, i) => (i === 0 ? word.toLowerCase() : capitalise(word))).join("");
    case "pascal":
      return words.map(capitalise).join("");
    case "snake":
      return words.join("_").toLowerCase();
    case "screaming":
      return words.join("_").toUpperCase();
    case "kebab":
      return words.join("-").toLowerCase();
    case "title":
      return words
        .map((word, i) => {
          if (keepAcronyms && isAcronym(word)) return word;
          const minor = i > 0 && i < words.length - 1 && minorWords.has(word.toLowerCase());
          return minor ? word.toLowerCase() : capitalise(word);
        })
        .join(" ");
    case "sentence":
      return words
        .map((word, i) => (i === 0 && !(keepAcronyms && isAcronym(word)) ? capitalise(word) : prose(word)))
        .join(" ");
    case "dot":
      return words.join(".").toLowerCase();
    case "path":
      return words.join("/").toLowerCase();
  }
};

/** Converts text to one case, line by line. */
export const convertCase = (text: string, name: CaseName) =>
  text
    .split(/\r?\n/u)
    .map((line) => convertLine(line, name))
    .join("\n");

/** Every case at once. */
export const convertAll = (text: string) =>
  Object.fromEntries(caseNames.map((name) => [name, convertCase(text, name)])) as Record<CaseName, string>;
