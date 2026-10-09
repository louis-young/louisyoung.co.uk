import type { APIRoute, GetStaticPaths } from "astro";
import { getCollection } from "astro:content";

import { useTranslations, formatDate } from "../../i18n";
import { getArticles } from "../../lib/articles";
import { cardSvg, pngResponse, svgToPng } from "../../lib/og";
import { getSnippets, languageName } from "../../lib/snippets";
import { tools } from "../../lib/tool-catalogue";
import { getWork, isPagePublished } from "../../lib/work";

interface Card {
  title: string;
  eyebrow: string;
}

export const getStaticPaths = (async () => {
  const t = useTranslations();
  const cards: [string, Card][] = [
    ["index", { title: t("site.tagline"), eyebrow: t("nav.home") }],
    ["work", { title: t("home.selectedWork"), eyebrow: t("nav.work") }],
    ["writing", { title: t("writing.title"), eyebrow: t("nav.writing") }],
    ["hire", { title: t("hire.heading"), eyebrow: t("nav.hire") }],
    ["cv", { title: t("cv.heading"), eyebrow: t("nav.cv") }],
    ["tools", { title: t("tools.heading"), eyebrow: t("nav.tools") }],
    ["snippets", { title: t("snippets.heading"), eyebrow: t("nav.snippets") }],
    ["stats", { title: t("stats.heading"), eyebrow: t("nav.stats") }],
    ["changelog", { title: t("changelog.heading"), eyebrow: t("changelog.title") }],
    ...tools.map((tool): [string, Card] => [`tools-${tool.slug}`, { title: t(tool.title), eyebrow: t("nav.tools") }]),
    ...(await getCollection("pages", isPagePublished)).map((page): [string, Card] => [
      page.id,
      { title: page.data.title, eyebrow: formatDate(page.data.updated) },
    ]),
    ...(await getWork()).map((study): [string, Card] => [
      `work-${study.id}`,
      { title: study.data.title, eyebrow: study.data.year },
    ]),
    ...(await getSnippets()).map((snippet): [string, Card] => [
      `snippets-${snippet.id}`,
      { title: snippet.data.title, eyebrow: `${t("nav.snippets")} · ${languageName(snippet.data.language)}` },
    ]),
    ...(await getArticles()).map((article): [string, Card] => [
      article.id,
      { title: article.data.title, eyebrow: formatDate(article.data.date) },
    ]),
  ];
  return cards.map(([slug, { title, eyebrow }]) => ({ params: { slug }, props: { title, eyebrow } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<Card> = async ({ props }) => pngResponse(svgToPng(await cardSvg(props), 1200));
