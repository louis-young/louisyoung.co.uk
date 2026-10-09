/** How many recently used tools the tools index shows. */
export const RECENT_LIMIT = 4;

/** The `localStorage` key for the list of recently used tool slugs, newest first. */
export const RECENT_KEY = "tools:recent";

const SLUG = /^[a-z0-9-]{1,40}$/u;

/**
 * Reads the stored list, newest first, keeping each slug once and only slugs in `known` when it
 * is given. Anything that isn’t a JSON array of slugs (an old format, a hand edit) counts as
 * empty rather than throwing.
 */
export const parseRecent = (raw: string | null, known?: readonly string[], limit = RECENT_LIMIT): string[] => {
  if (!raw) return [];
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(value)) return [];
  const slugs = value.filter(
    (item): item is string => typeof item === "string" && SLUG.test(item) && (!known || known.includes(item)),
  );
  return [...new Set(slugs)].slice(0, limit);
};

/** Moves `slug` to the front of the list, dropping the oldest beyond `limit`. */
export const addRecent = (list: readonly string[], slug: string, limit = RECENT_LIMIT) =>
  [slug, ...list.filter((item) => item !== slug)].slice(0, limit);
