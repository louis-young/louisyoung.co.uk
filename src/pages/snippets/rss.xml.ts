import type { APIRoute } from "astro";

import { useTranslations } from "../../i18n";
import { feedMeta, snippetFeedItems } from "../../lib/feed-items";
import { buildRss } from "../../lib/feeds";

export const GET: APIRoute = async () => {
  const t = useTranslations();
  const meta = feedMeta("/snippets/rss.xml", {
    title: t("nav.snippets"),
    description: t("snippets.description"),
    path: "/snippets/",
  });
  return new Response(buildRss(meta, await snippetFeedItems()), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
