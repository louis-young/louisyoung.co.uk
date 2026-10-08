const placeholderPattern = /\[[A-Z0-9][^\]]*\]/gu;

/** True when a value still contains a `[PLACEHOLDER]`. Markdown links (`[text](url)`) are not placeholders. */
export const isPlaceholder = (value: string) => findInText(value).length > 0;

const findInText = (value: string) =>
  [...value.matchAll(placeholderPattern)]
    .filter((match) => value[match.index + match[0].length] !== "(")
    .map((match) => match[0]);

export interface PlaceholderHit {
  /** Dotted path into the data, e.g. `roles.0.company`, or `line 12` for text. */
  path: string;
  placeholders: string[];
}

/** Walks any JSON-like value and reports every string that still contains a placeholder. */
export const findPlaceholders = (value: unknown, path = ""): PlaceholderHit[] => {
  if (typeof value === "string") {
    const placeholders = findInText(value);
    return placeholders.length > 0 ? [{ path: path || "(root)", placeholders }] : [];
  }
  if (Array.isArray(value)) return value.flatMap((item, index) => findPlaceholders(item, join(path, String(index))));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) => findPlaceholders(item, join(path, key)));
  return [];
};

/** Reports placeholders in a text file, by line. */
export const findPlaceholdersInText = (text: string): PlaceholderHit[] =>
  text.split("\n").flatMap((line, index) => {
    const placeholders = findInText(line);
    return placeholders.length > 0 ? [{ path: `line ${index + 1}`, placeholders }] : [];
  });

const join = (path: string, key: string) => (path ? `${path}.${key}` : key);
