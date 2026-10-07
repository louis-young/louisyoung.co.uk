import { describe, expectTypeOf, it } from "vitest";

import { useTranslations, type AnyLocale } from "../../src/i18n";
import type { MessageKey, Messages } from "../../src/i18n/en-GB";
import { getAdjacent, getRelated } from "../../src/lib/articles";
import type { FeedItem } from "../../src/lib/feeds";
import { buildToc, type TocItem } from "../../src/lib/toc";
import type { Locale } from "../../src/site.config";

describe("i18n types", () => {
  it("only accepts catalogue keys", () => {
    const t = useTranslations();
    expectTypeOf(t).parameter(0).toEqualTypeOf<MessageKey>();
    expectTypeOf(t("nav.search")).toEqualTypeOf<string>();
    // @ts-expect-error -- unknown keys are a compile error, not a runtime surprise.
    expectTypeOf(t).toBeCallableWith("nav.does-not-exist");
  });

  it("requires every locale catalogue to define every key", () => {
    expectTypeOf<Messages>().toEqualTypeOf<Record<MessageKey, string>>();
    // @ts-expect-error -- a catalogue missing keys does not satisfy Messages.
    const incomplete: Messages = { "nav.search": "Suche" };
    expectTypeOf(incomplete).not.toBeAny();
  });

  it("includes the pseudo-locale in AnyLocale but not in routed locales", () => {
    expectTypeOf<"en-XA">().toExtend<AnyLocale>();
    expectTypeOf<"en-XA">().not.toExtend<Locale>();
    expectTypeOf<"en-GB">().toExtend<Locale>();
  });
});

describe("helper types", () => {
  interface Item {
    id: string;
    data: { tags: readonly string[]; date: Date };
    extra: number;
  }

  it("preserves the caller's item type", () => {
    expectTypeOf(getAdjacent<Item>).returns.toEqualTypeOf<{ previous: Item | undefined; next: Item | undefined }>();
    expectTypeOf(getRelated<Item>).returns.toEqualTypeOf<Item[]>();
  });

  it("returns nested TOC items", () => {
    expectTypeOf(buildToc).returns.toEqualTypeOf<TocItem[]>();
    expectTypeOf<TocItem["children"]>().toEqualTypeOf<TocItem[]>();
  });

  it("makes feed updates optional", () => {
    expectTypeOf<FeedItem["updated"]>().toEqualTypeOf<Date | undefined>();
  });
});
