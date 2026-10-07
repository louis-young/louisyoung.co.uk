/// <reference types="astro/client" />

import type { AnyLocale } from "./i18n";

declare global {
  namespace App {
    interface Locals {
      /** Overrides the render locale; used by tests to render with the pseudo-locale. */
      locale?: AnyLocale;
    }
  }
}
