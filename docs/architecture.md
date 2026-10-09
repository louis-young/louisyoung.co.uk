# Architecture

A static site: `pnpm build` writes HTML, CSS, a little JavaScript, images, feeds and a search index to `dist/`, and Vercel serves it with the headers in `vercel.json`.

```
content/articles/<slug>/     MDX articles, their images and demo components (the slug is the URL)
content/snippets/<slug>/     Short code snippets, published at /snippets/<slug>/
src/content.config.ts        Content schemas (Zod), validated at build time
src/pages/                   Routes: home, [slug], tags, search, design, 404, feeds, OG images, icons
src/layouts/Base.astro       Document shell: <head>, header, footer, theme and shortcut scripts
src/components/              UI components; components/mdx/ are available inside articles
src/lib/                     Pure, unit-tested logic: articles, toc, reading time, feeds, SEO, OG
src/i18n/                    Typed message catalogue, ICU plural formatting, pseudo-locale
src/scripts/                 Small client modules: theme and keyboard shortcuts
src/styles/                  Tokens (global.css) and long-form typography (prose.css)
tests/                       unit, integration, types, e2e, a11y, visual, synthetic
.github/                     CI, security and maintenance workflows
```

## Rendering

- **Astro 7**, static output, `trailingSlash: "always"` so every pre-existing URL resolves unchanged.
- **MDX** through the `unified` processor (rehype-slug, autolinked headings, external-link marking). Code is highlighted at build time by Expressive Code.
- **React 19** only for interactive article demos, hydrated with `client:visible`.
- **Pagefind** indexes `dist/` after the build. Search runs entirely in the browser.
- **The ⌘K palette** is a dialog shell in every page. Its options come from `/palette.json`, built from the content collections, and are fetched when the palette is first warmed. Queries that look like a timestamp, colour, cron expression, prefixed number, sum, CSS selector or `uuid` get a quick answer from the tool libraries in `src/lib`, which load only for such queries.
- **Satori + resvg** render Open Graph images, the favicon and app icons from the site's own fonts at build time.

## Styling

Tailwind CSS 4 provides the reset and utilities. Most styling is component-scoped CSS that reads design tokens:

- The product-grade dark system: Geist (variable, 100–900) and Geist Mono, hairline `--rule` borders, rounded `.card` surfaces (`--radius-sm/md/lg`), pill buttons and tags, and one violet `--accent`. `.backdrop` paints the glows (`--glow-1`, `--glow-2`) and a masked grid behind the header; `.reveal` staggers entrances by `--reveal-index`. `--ink-faint` is held to 4.5:1 because it sets labels and dates.
- Raw tokens (`--paper`, `--ink`, `--accent` …) are defined on `:root` and overridden for `[data-theme="dark"]` and `prefers-contrast: more`.
- `@theme inline` maps them into Tailwind's colour namespace. `@theme static` defines the type, spacing, radius and motion scales.
- `tests/unit/tokens.test.ts` converts every OKLCH token to sRGB and asserts WCAG contrast for each text/background pairing, in both themes.

Theme choice is applied by a small inline script in `<head>` before first paint, so there is no flash. It follows the system until the reader picks a theme.

## Security

- Astro emits a `<meta>` Content Security Policy with SHA-256 hashes for every script and style it renders. There is no `'unsafe-inline'` for scripts or `<style>`. Attribute styles are allowed (see [ADR 0002](adr/0002-csp-style-attributes.md)).
- `vercel.json` adds HSTS, `frame-ancestors`, COOP/CORP, a referrer policy, a permissions policy and `nosniff`. The synthetic tests assert them in production.
- Third-party embeds load only after an explicit click.

## Internationalisation

Every UI string lives in `src/i18n/en-GB.ts`, and `t()` only accepts keys from it (a type error otherwise). Other locales must satisfy the same type. Dates and numbers use `Intl`, and CSS uses logical properties. The integration suite renders components in a pseudo-locale (`en-XA`) to catch hard-coded strings. See [ADR 0004](adr/0004-internationalisation.md).

## Testing

| Layer             | Where                        | Runs on                                         |
| ----------------- | ---------------------------- | ----------------------------------------------- |
| Unit              | `tests/unit`                 | Vitest                                          |
| Integration       | `tests/integration`          | Vitest + Astro Container API, Testing Library   |
| Types             | `tests/types`                | Vitest typecheck                                |
| Content           | `tests/unit/content.test.ts` | Vitest over the MDX source                      |
| End-to-end        | `tests/e2e`                  | Playwright: Chromium, Firefox, WebKit, Pixel 7  |
| Accessibility     | `tests/a11y`                 | Playwright + axe                                |
| Visual regression | `tests/visual`               | Playwright in the pinned Playwright container   |
| Performance       | `lighthouserc.json`          | Lighthouse CI                                   |
| Budgets           | `tests/e2e/budget.spec.ts`   | Playwright: JS per page type, CLS on every tool |
| Synthetic         | `tests/synthetic`            | Playwright against production, every 30 minutes |
