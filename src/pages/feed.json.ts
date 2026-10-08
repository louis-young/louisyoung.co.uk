import type { APIRoute } from "astro";

import { feedItems, feedMeta } from "../lib/feed-items";
import { buildJsonFeed } from "../lib/feeds";

export const GET: APIRoute = async () =>
  new Response(buildJsonFeed(feedMeta("/feed.json"), await feedItems()), {
    headers: { "Content-Type": "application/feed+json; charset=utf-8" },
  });
