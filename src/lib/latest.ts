/** The item with the latest date. On a tie the one listed last wins; an empty list gives undefined. */
export const newest = <T>(items: readonly T[], dateOf: (item: T) => Date): T | undefined =>
  items.reduce<T | undefined>(
    (best, item) => (best === undefined || dateOf(item).getTime() >= dateOf(best).getTime() ? item : best),
    undefined,
  );

/** Drops missing entries and sorts the rest newest first, keeping the given order on a tie. */
export const newestFirst = <T extends { date: Date }>(items: readonly (T | undefined)[]): T[] =>
  items.filter((item): item is T => item !== undefined).sort((a, b) => b.date.getTime() - a.date.getTime());
