import type { APIRoute } from "astro";

import { markSvg } from "../lib/og";

export const GET: APIRoute = async () =>
  new Response(await markSvg(64), { headers: { "Content-Type": "image/svg+xml" } });
