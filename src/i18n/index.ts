import { site, type Locale } from "../site.config";
import { enGB, type MessageKey, type Messages } from "./en-GB";
import { pseudoMessages } from "./pseudo";

/** `en-XA` is the conventional pseudo-locale. It is used by tests, never routed. */
export type AnyLocale = Locale | "en-XA";

const catalogues: Record<AnyLocale, Messages> = {
  "en-GB": enGB,
  "en-XA": pseudoMessages(enGB),
};

type Values = Record<string, string | number>;

const pluralBlock = /\{(\w+),\s*plural,\s*((?:[^{}]*\{[^{}]*\})+)\s*\}/gu;
const pluralOption = /(=?\w+)\s*\{([^{}]*)\}/gu;

/** Formats the subset of ICU MessageFormat this site needs: `{name}` and `{n, plural, …}`. */
export const formatMessage = (locale: AnyLocale, message: string, values: Values = {}): string => {
  const intlLocale = locale === "en-XA" ? "en-GB" : locale;
  const numbers = new Intl.NumberFormat(intlLocale);
  const plurals = new Intl.PluralRules(intlLocale);

  const withPlurals = message.replace(pluralBlock, (_match, name: string, body: string) => {
    const count = Number(values[name] ?? 0);
    const options = new Map([...body.matchAll(pluralOption)].map(([, selector, text]) => [selector, text ?? ""]));
    const chosen = options.get(`=${count}`) ?? options.get(plurals.select(count)) ?? options.get("other") ?? "";
    return chosen.replaceAll("#", numbers.format(count));
  });

  return withPlurals.replace(/\{(\w+)\}/gu, (match, name: string) => {
    const value = values[name];
    if (value === undefined) return match;
    return typeof value === "number" ? numbers.format(value) : value;
  });
};

export const useTranslations = (locale: AnyLocale = site.defaultLocale) => {
  const messages = catalogues[locale];
  return (key: MessageKey, values?: Values) => formatMessage(locale, messages[key], values);
};

export const formatDate = (date: Date, locale: AnyLocale = site.defaultLocale) =>
  new Intl.DateTimeFormat(locale === "en-XA" ? "en-GB" : locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);
