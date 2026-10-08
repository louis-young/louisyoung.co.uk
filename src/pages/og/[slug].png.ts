import type { APIRoute, GetStaticPaths } from "astro";

import { useTranslations, formatDate } from "../../i18n";
import { getArticles, type Article } from "../../lib/articles";
import { cardSvg, pngResponse, svgToPng } from "../../lib/og";

export const getStaticPaths = (async () => [
  { params: { slug: "index" }, props: { article: undefined } },
  ...(await getArticles()).map((article) => ({ params: { slug: article.id }, props: { article } })),
]) satisfies GetStaticPaths;

export const GET: APIRoute<{ article: Article | undefined }> = async ({ props: { article } }) => {
  const t = useTranslations();
  const svg = article
    ? await cardSvg({ title: article.data.title, eyebrow: formatDate(article.data.date) })
    : await cardSvg({ title: t("site.tagline"), eyebrow: t("nav.writing") });
  return pngResponse(svgToPng(svg, 1200));
};
