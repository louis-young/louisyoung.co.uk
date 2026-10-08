import type { APIRoute } from "astro";

import { useTranslations } from "../i18n";
import { changelogFeedItems, getHistory } from "../lib/changelog";
import { feedMeta } from "../lib/feed-items";
import { buildAtom } from "../lib/feeds";
import { absoluteUrl } from "../lib/seo";
import { site } from "../site.config";

export const GET: APIRoute = () => {
  const t = useTranslations();
  const labels = {
    feature: t("changelog.feature"),
    fix: t("changelog.fix"),
    performance: t("changelog.performance"),
    accessibility: t("changelog.accessibility"),
  };
  const meta = {
    ...feedMeta("/changelog.xml"),
    title: `${site.name} · ${t("changelog.title")}`,
    description: t("changelog.description"),
    siteUrl: absoluteUrl("/changelog/"),
  };
  return new Response(
    buildAtom(
      meta,
      changelogFeedItems(getHistory().changes, (kind) => labels[kind]),
    ),
    {
      headers: { "Content-Type": "application/atom+xml; charset=utf-8" },
    },
  );
};
