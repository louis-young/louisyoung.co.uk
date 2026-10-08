export interface FeedItem {
  title: string;
  description: string;
  url: string;
  published: Date;
  updated?: Date | undefined;
  tags: readonly string[];
}

export interface FeedMeta {
  title: string;
  description: string;
  siteUrl: string;
  feedUrl: string;
  author: { name: string; email?: string };
  language: string;
}

const entities: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };

export const escapeXml = (value: string) => value.replace(/[&<>"']/gu, (char) => entities[char] ?? char);

const latest = (items: readonly FeedItem[]) =>
  new Date(Math.max(0, ...items.map((item) => (item.updated ?? item.published).getTime())));

export const buildRss = (meta: FeedMeta, items: readonly FeedItem[]) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(meta.title)}</title>
    <link>${escapeXml(meta.siteUrl)}</link>
    <description>${escapeXml(meta.description)}</description>
    <language>${escapeXml(meta.language)}</language>
    <lastBuildDate>${latest(items).toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(meta.feedUrl)}" rel="self" type="application/rss+xml"/>
${items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.url)}</link>
      <guid isPermaLink="true">${escapeXml(item.url)}</guid>
      <description>${escapeXml(item.description)}</description>
      <pubDate>${item.published.toUTCString()}</pubDate>
${item.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
    </item>`,
  )
  .join("\n")}
  </channel>
</rss>
`;

export const buildAtom = (meta: FeedMeta, items: readonly FeedItem[]) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${escapeXml(meta.language)}">
  <title>${escapeXml(meta.title)}</title>
  <subtitle>${escapeXml(meta.description)}</subtitle>
  <id>${escapeXml(meta.siteUrl)}</id>
  <link href="${escapeXml(meta.siteUrl)}"/>
  <link href="${escapeXml(meta.feedUrl)}" rel="self"/>
  <updated>${latest(items).toISOString()}</updated>
  <author><name>${escapeXml(meta.author.name)}</name></author>
${items
  .map(
    (item) => `  <entry>
    <title>${escapeXml(item.title)}</title>
    <id>${escapeXml(item.url)}</id>
    <link href="${escapeXml(item.url)}"/>
    <published>${item.published.toISOString()}</published>
    <updated>${(item.updated ?? item.published).toISOString()}</updated>
    <summary>${escapeXml(item.description)}</summary>
${item.tags.map((tag) => `    <category term="${escapeXml(tag)}"/>`).join("\n")}
  </entry>`,
  )
  .join("\n")}
</feed>
`;

export const buildJsonFeed = (meta: FeedMeta, items: readonly FeedItem[]) =>
  `${JSON.stringify(
    {
      version: "https://jsonfeed.org/version/1.1",
      title: meta.title,
      description: meta.description,
      home_page_url: meta.siteUrl,
      feed_url: meta.feedUrl,
      language: meta.language,
      authors: [{ name: meta.author.name, url: meta.siteUrl }],
      items: items.map((item) => ({
        id: item.url,
        url: item.url,
        title: item.title,
        summary: item.description,
        content_text: item.description,
        date_published: item.published.toISOString(),
        ...(item.updated && { date_modified: item.updated.toISOString() }),
        tags: item.tags,
      })),
    },
    null,
    2,
  )}\n`;
