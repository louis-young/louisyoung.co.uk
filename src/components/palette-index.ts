import { getEntry } from "astro:content";

import { cv } from "../../content/data/cv";
import type { useTranslations } from "../i18n";
import { articlePath, getArticles } from "../lib/articles";
import type { PaletteIndex, PaletteOptionData } from "../lib/palette";
import { filled } from "../lib/placeholders";
import { getSnippets, languageName, snippetPath } from "../lib/snippets";
import { toolPath, tools } from "../lib/tool-catalogue";
import { getWork, isPagePublished, workPath } from "../lib/work";
import { site } from "../site.config";

type Translate = ReturnType<typeof useTranslations>;

/** Which optional pages are live: case studies, /now, /uses and the CV's roles may still be drafts. */
export const getSections = async () => {
  const [work, nowPage, usesPage] = await Promise.all([getWork(), getEntry("pages", "now"), getEntry("pages", "uses")]);
  return {
    work: work.length > 0,
    now: Boolean(nowPage && isPagePublished(nowPage)),
    cv: cv.roles.some((role) => filled(role.company)),
    uses: Boolean(usesPage && isPagePublished(usesPage)),
  };
};

/**
 * Every page, tool, action, case study, article and snippet the ⌘K palette lists. Served as
 * `/palette.json` and fetched when the palette is first warmed, so it isn't repeated in every page.
 */
export const getPaletteIndex = async (t: Translate): Promise<PaletteIndex> => {
  const [sections, work, articles, snippets] = await Promise.all([
    getSections(),
    getWork(),
    getArticles(),
    getSnippets(),
  ]);
  const hidden = [
    ...(sections.work ? [] : ["/work/"]),
    ...(sections.now ? [] : ["/now/"]),
    ...(sections.cv ? [] : ["/cv/"]),
    ...(sections.uses ? [] : ["/uses/"]),
  ];
  const pages: PaletteOptionData[] = [
    { title: t("nav.home"), href: "/", hint: "/" },
    { title: t("nav.work"), href: "/work/", hint: "/work" },
    { title: t("nav.writing"), href: "/writing/", hint: "/writing" },
    { title: t("nav.snippets"), href: "/snippets/", hint: "/snippets", keywords: "code copy paste toolbox" },
    { title: t("nav.hire"), href: "/hire/", hint: "/hire" },
    { title: t("nav.cv"), href: "/cv/", hint: "/cv" },
    { title: t("nav.now"), href: "/now/", hint: "/now" },
    { title: t("nav.uses"), href: "/uses/", hint: "/uses" },
    { title: t("tags.title"), href: "/tags/", hint: "/tags" },
    { title: t("nav.tools"), href: "/tools/", hint: "/tools" },
    ...tools.map((tool) => ({ title: t(tool.title), href: toolPath(tool.slug), keywords: tool.keywords })),
    { title: t("nav.stats"), href: "/stats/", hint: "/stats" },
    { title: t("map.title"), href: "/map/", hint: "/map", keywords: "graph knowledge topics connections tags network" },
    {
      title: t("changelog.title"),
      href: "/changelog/",
      hint: "/changelog",
      keywords: "new release notes updates history",
    },
    { title: t("nav.colophon"), href: "/colophon/", hint: "/colophon" },
    {
      title: t("nav.accessibility"),
      href: "/accessibility/",
      hint: "/accessibility",
      keywords: "a11y wcag statement keyboard screen reader",
    },
  ];
  const actions: PaletteOptionData[] = [
    { title: t("palette.search"), action: "search", hint: "/" },
    { title: t("hire.book"), href: "/hire/#book" },
    {
      title: t("palette.copyEmail"),
      action: "copy",
      value: site.author.email,
      done: t("palette.copied"),
      keywords: site.author.email,
    },
    { title: t("palette.downloadCv"), href: "/cv.pdf", action: "download" },
    { title: t("palette.theme"), action: "theme", hint: "T" },
    { title: t("palette.terminal"), action: "terminal", hint: "`", keywords: "terminal shell cli console" },
    { title: t("shortcuts.title"), action: "shortcuts", hint: "?", keywords: "keys keyboard hotkeys help" },
  ];
  return {
    groups: [
      { id: "pages", options: pages.filter((option) => !hidden.includes(option.href ?? "")) },
      { id: "actions", options: actions },
      {
        id: "work",
        options: work.map((study) => ({
          title: study.data.title,
          href: workPath(study),
          keywords: `${study.data.client} ${study.data.stack.join(" ")}`,
        })),
      },
      {
        id: "writing",
        options: articles.map((article) => ({
          title: article.data.title,
          href: articlePath(article),
          keywords: article.data.tags.join(" "),
        })),
      },
      {
        id: "snippets",
        options: snippets.map((snippet) => ({
          title: snippet.data.title,
          href: snippetPath(snippet),
          keywords: `snippet ${languageName(snippet.data.language)} ${snippet.data.tags.join(" ")}`,
        })),
      },
    ].filter((group) => group.options.length > 0),
    text: {
      answer: t("palette.answer"),
      answerName: t("palette.answerName"),
      answerCopy: t("palette.answerCopy"),
      answerCopied: t("palette.answerCopied"),
      answerCopyFailed: t("palette.answerCopyFailed"),
      answerOpen: t("palette.answerOpen"),
      answerSwatch: t("palette.answerSwatch"),
    },
    answers: {
      local: t("tools.timestamp.local"),
      iso: t("tools.timestamp.iso"),
      seconds: t("tools.timestamp.seconds"),
      hex: t("tools.colour.hex"),
      rgb: t("tools.colour.rgb"),
      hsl: t("tools.colour.hsl"),
      oklch: t("tools.colour.oklch"),
      onWhite: t("tools.colour.onWhite"),
      onBlack: t("tools.colour.onBlack"),
      decimal: t("tools.base.decimal"),
      hexadecimal: t("tools.base.hex"),
      binary: t("tools.base.binary"),
      octal: t("tools.base.octal"),
      nextRun: t("palette.answerNextRun"),
      cron: {
        at: t("tools.cron.at"),
        everyMinute: t("tools.cron.everyMinute"),
        everyMinutes: t("tools.cron.everyMinutes"),
        minuteOne: t("tools.cron.minuteOne"),
        minuteOther: t("tools.cron.minuteOther"),
        during: t("tools.cron.during"),
        dayOne: t("tools.cron.dayOne"),
        dayOther: t("tools.cron.dayOther"),
        months: t("tools.cron.months"),
        days: t("tools.cron.days"),
        weekdays: t("tools.cron.weekdays"),
        weekends: t("tools.cron.weekends"),
        either: t("tools.cron.either"),
      },
    },
  };
};
