import type { APIRoute } from "astro";

import { getPaletteIndex } from "../components/palette-index";
import { useTranslations } from "../i18n";

/** The ⌘K palette's options, fetched when the palette is first warmed. See `src/scripts/palette.ts`. */
export const GET: APIRoute = async () =>
  new Response(JSON.stringify(await getPaletteIndex(useTranslations())), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
