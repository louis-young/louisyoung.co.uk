import type { APIRoute } from "astro";

import { useTranslations } from "../i18n";
import { site } from "../site.config";

export const GET: APIRoute = () => {
  const t = useTranslations();
  return new Response(
    JSON.stringify({
      name: site.name,
      short_name: "Louis Young",
      description: t("site.description"),
      lang: site.defaultLocale,
      start_url: "/",
      display: "minimal-ui",
      background_color: "#fbf9f4",
      theme_color: "#fbf9f4",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/favicon.svg", sizes: "any", type: "image/svg+xml" },
      ],
    }),
    { headers: { "Content-Type": "application/manifest+json" } },
  );
};
