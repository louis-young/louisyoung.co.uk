import type { APIRoute } from "astro";

import { feedItems, feedMeta } from "../lib/feed-items";
import { buildAtom } from "../lib/feeds";

export const GET: APIRoute = async () =>
  new Response(buildAtom(feedMeta("/atom.xml"), await feedItems()), {
    headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
  });
