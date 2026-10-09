import { effShortWordlist } from "./eff-short-wordlist";

/** Fills an array with random 32-bit words. In the browser this is `crypto.getRandomValues`. */
export type RandomSource = (words: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

export const cryptoSource: RandomSource = (words) => crypto.getRandomValues(words);

const RANGE = 2 ** 32;

/**
 * The largest multiple of `max` that fits in 32 bits. Draws at or above it are thrown away, so
 * every remainder below `max` is reached by exactly the same number of accepted draws.
 */
export const acceptLimit = (max: number) => RANGE - (RANGE % max);

/** A uniformly random integer from 0 to `max - 1`, by rejection sampling: no modulo bias. */
export const randomBelow = (max: number, source: RandomSource = cryptoSource) => {
  if (!Number.isInteger(max) || max < 1 || max > RANGE) throw new RangeError(`Bad range: ${max}`);
  const limit = acceptLimit(max);
  const word = new Uint32Array(1);
  for (;;) {
    const value = source(word)[0]!;
    if (value < limit) return value % max;
  }
};

export const characterSets = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~",
} as const;

export type CharacterSet = keyof typeof characterSets;

/** Characters that are easy to misread for one another in many fonts. */
export const ambiguousCharacters = "Il1|O0o`'\".,:;";

export interface PasswordOptions {
  length: number;
  sets: readonly CharacterSet[];
  excludeAmbiguous: boolean;
}

export const passwordLimits = { min: 4, max: 128 } as const;

/** Each selected set's characters, with the ambiguous ones taken out if asked. Empty sets are dropped. */
export const passwordAlphabets = ({ sets, excludeAmbiguous }: Pick<PasswordOptions, "sets" | "excludeAmbiguous">) =>
  sets
    .map((set) =>
      Array.from(characterSets[set]).filter((char) => !excludeAmbiguous || !ambiguousCharacters.includes(char)),
    )
    .filter((chars) => chars.length > 0);

/**
 * How many passwords of `length` use at least one character from every alphabet, by
 * inclusion–exclusion over the alphabets left out. Alphabets don't overlap.
 */
export const passwordSpace = (length: number, alphabets: readonly (readonly string[])[]) => {
  const sizes = alphabets.map((chars) => chars.length);
  let total = 0n;
  // Every subset of alphabets to leave out, with the sign alternating by how many are left out.
  for (let subset = 0; subset < 1 << sizes.length; subset++) {
    let size = 0;
    let left = 0;
    sizes.forEach((count, i) => {
      if (subset & (1 << i)) left++;
      else size += count;
    });
    const term = BigInt(size) ** BigInt(length);
    total += left % 2 === 0 ? term : -term;
  }
  return total;
};

/** log2 of a positive BigInt, accurate to about 15 significant figures. */
export const log2 = (value: bigint) => {
  if (value <= 0n) return -Infinity;
  const bits = value.toString(2).length;
  const shift = Math.max(0, bits - 53);
  return Math.log2(Number(value >> BigInt(shift))) + shift;
};

export interface Generated {
  value: string;
  /** Bits of entropy: log2 of how many equally likely outcomes the options allow. */
  entropy: number;
}

/**
 * A password that uses every selected set at least once. Whole passwords that miss a set are
 * thrown away and redrawn, so every valid password is equally likely and the entropy is exact.
 * Returns undefined when no set is selected or the length can't fit one of each.
 */
export const generatePassword = (options: PasswordOptions, source: RandomSource = cryptoSource) => {
  const alphabets = passwordAlphabets(options);
  const length = Math.round(options.length);
  if (alphabets.length === 0 || length < alphabets.length) return undefined;
  const pool = alphabets.flat();
  const entropy = log2(passwordSpace(length, alphabets));
  for (;;) {
    const chars = Array.from({ length }, () => pool[randomBelow(pool.length, source)]!);
    if (alphabets.every((alphabet) => chars.some((char) => alphabet.includes(char)))) {
      return { value: chars.join(""), entropy } satisfies Generated;
    }
  }
};

export type Capitalisation = "lower" | "title" | "upper";

export interface PassphraseOptions {
  words: number;
  separator: string;
  capitalisation: Capitalisation;
  /** Put one random digit at the end of one randomly chosen word. */
  digit: boolean;
}

export const passphraseLimits = { min: 3, max: 12 } as const;

const capitalise = (word: string, style: Capitalisation) => {
  if (style === "upper") return word.toUpperCase();
  if (style === "title") return word.charAt(0).toUpperCase() + word.slice(1);
  return word;
};

/**
 * Words drawn uniformly, with replacement, from the EFF short wordlist. Capitalisation and the
 * separator are fixed choices, so they add nothing; the optional digit adds log2(10 × words).
 */
export const generatePassphrase = (
  options: PassphraseOptions,
  source: RandomSource = cryptoSource,
  wordlist: readonly string[] = effShortWordlist,
): Generated => {
  const count = Math.round(options.words);
  const words = Array.from({ length: count }, () =>
    capitalise(wordlist[randomBelow(wordlist.length, source)]!, options.capitalisation),
  );
  let entropy = count * Math.log2(wordlist.length);
  if (options.digit && count > 0) {
    const index = randomBelow(count, source);
    words[index] = `${words[index]!}${randomBelow(10, source)}`;
    entropy += Math.log2(10 * count);
  }
  return { value: words.join(options.separator), entropy };
};

/** Clamps a number field's value to a range, falling back to `fallback` when it isn't a number. */
export const clampCount = (value: string, { min, max }: { min: number; max: number }, fallback: number) => {
  const number = Math.round(Number(value));
  if (value.trim() === "" || !Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
};

export type Strength = "veryWeak" | "weak" | "fair" | "strong" | "veryStrong";

/** A plain-English band for an entropy in bits. */
export const strength = (bits: number): Strength => {
  if (bits < 40) return "veryWeak";
  if (bits < 60) return "weak";
  if (bits < 80) return "fair";
  if (bits < 100) return "strong";
  return "veryStrong";
};

/** Guesses a second an attacker with a GPU rig can try offline against a fast, unsalted hash. */
const GUESSES_PER_SECOND = 1e11;

export type CrackTime =
  { unit: "instant" } | { unit: "seconds" | "minutes" | "hours" | "days" | "years"; value: number } | { unit: "aeons" };

/** How long, on average, guessing would take at `GUESSES_PER_SECOND`: half the space. */
export const crackTime = (bits: number, rate = GUESSES_PER_SECOND): CrackTime => {
  const seconds = 2 ** (bits - 1) / rate;
  if (seconds < 1) return { unit: "instant" };
  const units = [
    ["seconds", 1],
    ["minutes", 60],
    ["hours", 3600],
    ["days", 86_400],
    ["years", 31_557_600],
  ] as const;
  // A billion years is beyond any meaningful estimate.
  if (seconds >= 1e9 * 31_557_600) return { unit: "aeons" };
  let chosen: (typeof units)[number] = units[0];
  for (const unit of units) if (seconds >= unit[1]) chosen = unit;
  return { unit: chosen[0], value: Math.floor(seconds / chosen[1]) };
};

export const countLimits = { min: 1, max: 20 } as const;
