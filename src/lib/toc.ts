export interface Heading {
  depth: number;
  slug: string;
  text: string;
}

export interface TocItem extends Heading {
  children: TocItem[];
}

/**
 * Builds a nested table of contents from a flat heading list. Only `h2` and `h3` are
 * included; an `h3` before any `h2` is promoted so nothing is silently dropped.
 */
export const buildToc = (headings: readonly Heading[], { minDepth = 2, maxDepth = 3 } = {}): TocItem[] => {
  const toc: TocItem[] = [];
  for (const heading of headings) {
    if (heading.depth < minDepth || heading.depth > maxDepth) continue;
    const item: TocItem = { ...heading, children: [] };
    const parent = toc.at(-1);
    if (heading.depth > minDepth && parent) parent.children.push(item);
    else toc.push(item);
  }
  return toc;
};
