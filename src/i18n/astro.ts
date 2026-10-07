import type { AstroGlobal } from "astro";

import { site } from "../site.config";
import { useTranslations, type AnyLocale } from ".";

export const localeOf = (astro: Pick<AstroGlobal, "locals" | "currentLocale">): AnyLocale =>
  astro.locals.locale ?? (astro.currentLocale as AnyLocale | undefined) ?? site.defaultLocale;

export const translatorFor = (astro: Pick<AstroGlobal, "locals" | "currentLocale">) => useTranslations(localeOf(astro));
