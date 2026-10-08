import type { APIRoute } from "astro";

import { feedItems, feedMeta } from "../lib/feed-items";
import { buildRss } from "../lib/feeds";

export const GET: APIRoute = async () =>
  new Response(buildRss(feedMeta("/rss.xml"), await feedItems()), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
