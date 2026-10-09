# Performance audit

October 2026, at about 80 pages (26 tools, the map, 12 snippets, 8 articles). I measured first, changed only what the measurements justified, and then measured again.

## Method

- **Build:** `SHOW_DRAFTS=true pnpm build`, timed from a cold asset cache (`node_modules/.astro/assets` removed) so image optimisation is counted on both sides.
- **Serve:** `astro preview --port 4424`. This is static and uncompressed, so text sizes below are gzip (level 9) computed from the served bytes. Vercel serves Brotli, which is a little smaller. Fonts and images are counted as served.
- **Browser:** the sandbox's Chromium (build 1194) through Playwright, with a fresh context and an empty cache for every load.
  - Desktop: the `Desktop Chrome` profile, without throttling.
  - Mobile: the `Pixel 7` profile with 4× CPU throttling.
  - Each page was loaded three times per profile, and LCP is the median.
- **Metrics:** all collected in the page.
  - LCP element and time, CLS (ignoring input-driven shifts) and long tasks come from `PerformanceObserver`s registered before any page script runs.
  - Render-blocking resources come from `renderBlockingStatus` in Resource Timing.
  - Requests and bytes come from Playwright's finished requests.
  - Long tasks, CSS coverage and style/layout costs were traced with `page.coverage` and Chrome tracing.
- **Lighthouse:** not installed locally. CI runs Lighthouse CI 0.15.1 through `pnpm test:lighthouse` (see `lighthouserc.json`: performance ≥ 0.95, LCP ≤ 1500 ms, CLS ≤ 0.01, TBT ≤ 50 ms on `/`, two articles and `/tags/`). These numbers come from the Playwright metrics instead. The pages Lighthouse covers sit inside its budgets here too: `/tags/` LCP is 1,044 ms and CLS is 0.

There is no QR tool, so `/tools/diff/` stands in as the third heavy tool alongside SQL and the CSS generator.

The JS column below counts the module scripts a page requests (gzip -9). The budget test also counts inline scripts and uses Node's default gzip level, so its figures are a few hundred bytes higher.

## Before

Sizes are in kB with file counts in brackets. Times are in ms.

| Page                                     | Requests |      JS |      CSS | Fonts | Images | HTML | Render-blocking | LCP desktop | LCP mobile 4× | LCP element                       | CLS (desktop / mobile) |
| ---------------------------------------- | -------: | ------: | -------: | ----: | -----: | ---: | --------------: | ----------: | ------------: | --------------------------------- | ---------------------: |
| `/`                                      |       16 | 3.8 (4) | 15.9 (8) |  51.3 |    1.1 | 14.9 |               8 |        1136 |          1364 | `p.hero__intro`                   |          0.000 / 0.000 |
| `/how-to-fetch-data-from-backend-react/` |       21 | 6.5 (9) | 18.8 (7) |  51.3 |   61.7 | 22.7 |               6 |         164 |           332 | `img.article__cover-image` (AVIF) |          0.000 / 0.000 |
| `/writing/`                              |       12 | 3.8 (4) | 11.5 (4) |  51.3 |    1.1 | 11.9 |               4 |        1000 |           376 | `p.page-lede`                     |          0.000 / 0.000 |
| `/tools/`                                |       13 | 4.8 (6) | 11.4 (3) |  51.3 |    1.1 | 13.6 |               3 |         984 |          1088 | `h1.page-title`                   |          0.000 / 0.000 |
| `/tools/sql/`                            |       17 | 9.5 (9) | 11.3 (4) |  51.3 |    1.1 | 11.8 |               4 |         176 |           348 | (replaced by script)              |          0.001 / 0.000 |
| `/tools/css-generator/`                  |       16 | 7.4 (9) | 11.4 (3) |  51.3 |    1.1 | 11.6 |               3 |         992 |          1040 | `h1.page-title`                   |      **0.080** / 0.000 |
| `/tools/diff/`                           |       16 | 7.8 (8) | 11.6 (4) |  51.3 |    1.1 | 11.5 |               4 |        1032 |           328 | `p.page-lede`                     |          0.000 / 0.000 |
| `/map/`                                  |       13 | 5.7 (6) | 12.6 (3) |  51.3 |    1.1 | 21.9 |               3 |        1160 |          1240 | `h1.page-title`                   |          0.000 / 0.004 |
| `/snippets/`                             |       13 | 4.2 (5) | 11.7 (4) |  51.3 |    1.1 | 12.6 |               4 |        1008 |          1088 | `h1.page-title`                   |          0.000 / 0.000 |
| `/snippets/debounce-and-throttle/`       |       19 | 6.5 (9) | 16.1 (6) |  51.3 |    1.1 | 15.4 |               5 |         140 |           236 | `p`                               |          0.000 / 0.000 |

A sweep of every other page (all 26 tools, `/hire/`, `/cv/`, `/work/`, `/stats/`, `/changelog/`, `/tags/`, `/search/`, `/design/`, `/colophon/`, `/now/`, `/uses/`, `/accessibility/`) found no other CLS above 0.006.

**Build:** 81 s cold. Of that, 48.9 s was static generation, and 46.3 s of that was the 60 Open Graph images (about 770 ms each). Image optimisation took 21.4 s for 73 images.

## Findings

1. **Open Graph images dominated the build.** Satori takes about 10 ms per card. resvg took about 760 ms to rasterise it, nearly all of it in the two backdrop glows. Satori draws each CSS gradient as a pattern holding a circle under a `<mask>` that is a plain white rectangle covering the whole canvas. That mask changes nothing, but resvg composites it at full size. Rendering the same SVG without those masks takes about 140 ms. The pixels match except for 6 of 3,024,000 channels, which differ by 1/255 through rounding, and the PNG size changes by a single byte.
2. **The CSS generator shifted its own layout (CLS 0.080, eight times Lighthouse's 0.01 budget).** Its shadow-layer and gradient-stop lists were empty in the HTML and were filled in by the script about 240 ms after load. That pushed the "Add stop" button and the gradient card down the page. Lighthouse never sees it because it only checks four URLs.
3. **The JavaScript budget test undercounted.** It summed inline scripts and `<script src>` only, missing the chunks those modules import. Every page imports `lazy.js` and Vite's `preload-helper.js` (about 1 kB gzipped together). Counted fully, home loads 4,403 B against its 4,000 B budget, and the article loads 7,631 B. The test passed only because it never saw those chunks.
4. **The reveal animation sets LCP on text-hero pages.** `.reveal` fades opacity from 0 over 800 ms with a 70 ms stagger. Chromium only records an LCP candidate once it is painted visibly, so LCP lands at about 1,000 ms on desktop, against about 150 ms for pages whose LCP element doesn't animate. With `prefers-reduced-motion`, `/writing/` LCP drops from 1,036 ms to 172 ms. It's still within Lighthouse's 1,500 ms and Core Web Vitals' 2,500 ms, but it is the single biggest LCP cost on the site. **Not changed**, because it's a visual design decision; see Recommendations.
5. **Fonts are already right.** Each family is one variable, latin-subset WOFF2 (Geist 28.7 kB, Geist Mono 22.6 kB). Both use `font-display: swap` with metric-matched fallbacks (`size-adjust` and ascent/descent overrides), so the swap causes no measurable CLS. Only Geist, the body face, is preloaded. Mono is requested on every page but never sets the LCP element, so preloading it too would only compete with the LCP resource. Nothing is unused: the static `@fontsource/geist*` weights are read only by the OG renderer at build time and are never shipped.
6. **Images are already right.** Covers go through Astro assets as AVIF, then WebP, then JPEG at 640, 960 and 1280 widths. They have explicit `width`/`height`, `loading="eager"`, `fetchpriority="high"` and `decoding="async"`. `sizes` matches the rendered width: 1,150 px on a 1,184 px (74 rem) slot. Other images are lazy.
7. **Caching is already right.** `vercel.json` gives `/_astro/(.*)` `public, max-age=31536000, immutable`, which covers hashed scripts, styles, fonts and images. Nothing without a content hash is marked immutable. No test guarded this, though.
8. **Prefetch does not fetch too much.** `prefetchAll` uses the `hover` strategy, so a page is fetched only when a link is hovered or focused. Nothing is prefetched on load.
9. **CSS:** `Base.css` (47 kB raw, about 10 kB gzipped) loads on every page, and 46 to 54% of it is used on a given page. The rest is mostly the palette, terminal and shortcuts dialogs, dark and contrast themes, and breakpoints. Splitting it would mean another request on first use for little gain, so it stays. Home has eight render-blocking stylesheets because `inlineStylesheets: "never"` is required by the CSP (see `astro.config.ts`). `CvRoles.css` and `Availability.css` load at 0% use only because their content is still `[PLACEHOLDER]`.
10. **JavaScript is small and lazy.** Module scripts range from 3.8 kB gzipped (home) to 9.8 kB (the specificity tool), or 4.2 to 10.3 kB counting inline scripts as the budget test does. The palette, terminal and shortcuts help are dynamic imports loaded only on first open, and no code is duplicated across the 57 chunks (no 160-character run appears in two of them). `preload-helper.js` (805 B gzipped) loads eagerly on every page because Vite wraps those dynamic imports in `__vitePreload`. Setting `vite.build.modulePreload: false` still emitted the same helper chunk (same content hash) and the same wrapped imports, so I reverted it.
11. **Main-thread work:** desktop shows at most one long task per page (≤ 166 ms, on the article). Under 4× mobile throttling the article runs several 100–600 ms tasks. Tracing shows these are style recalculation and layout over its 3,356 elements, mostly Expressive Code token spans, not script. Those figures vary a lot from run to run in this sandbox.
12. **HTML:** the palette, terminal and shortcuts dialogs add about 5.5 kB gzipped to every page, 35 to 45% of each document. The palette's list alone is about 3.4 kB. They sit at the end of `<body>`, so they do not delay FCP or LCP. See Recommendations.

## Changes

1. **`src/lib/og.ts`: `withoutCanvasMasks()`** strips references to masks that are a white rectangle covering the whole canvas before resvg renders the card. Masks covering part of the canvas, and canvases of other sizes, are left alone. It is unit-tested in `tests/unit/og.test.ts`. There is no visual change.
2. **`/tools/css-generator/`** now renders the default shadow layers and gradient stops in the HTML. The script clones the first rendered item as the pattern for new ones instead of reading a `<template>`, so its first render swaps in identical nodes and nothing moves. The markup still has one source, and the two `<template>`s are gone. The DOM test fixture now matches this. There is no visual change: the final layout is the same, it just no longer arrives in two steps.
3. **`tests/e2e/budget.spec.ts`** is rewritten:
   - **JavaScript budgets per page type** now count inline scripts plus every script response up to network idle: entry modules, the chunks they import, and anything imported on load. Every tool page is covered, read from `src/pages/tools/`. Budgets are the largest measured size for each type plus about 10%, rounded up to 100 B. The test also checks that every same-origin script is a hashed `/_astro/` asset, which is what makes the immutable cache rule safe.
   - **A layout-stability check** asserts CLS < 0.01 (Lighthouse's own budget) on every budgeted page, all tools included. I confirmed it fails on the old CSS generator (0.080).
4. **`tests/unit/caching.test.ts`** asserts that `/_astro/(.*)` is served `public, immutable, max-age ≥ 31536000`, and that it is the only immutable rule.

| Page type   | Paths                                         | Measured (B) | Budget (B) |
| ----------- | --------------------------------------------- | -----------: | ---------: |
| home        | `/`                                           |        4,403 |      4,900 |
| article     | `/how-to-fetch-data-from-backend-react/`      |        7,631 |      8,400 |
| listing     | `/writing/`, `/tags/`, `/snippets/`           |  4,186–4,682 |      5,200 |
| tools index | `/tools/`                                     |        5,127 |      5,700 |
| tool        | all 26 (`/tools/specificity/` is the largest) | 5,470–10,307 |     11,400 |
| map         | `/map/`                                       |        6,072 |      6,700 |
| snippet     | `/snippets/debounce-and-throttle/`            |        7,139 |      7,900 |
| search      | `/search/` (Pagefind UI bundled)              |       30,811 |     34,000 |

The old budgets (`/` and `/tags/` 4,000 B, the article 8,000 B) were set against the narrower count. These are the first budgets measured against the full module graph.

## After

| Page                                     | Requests |      JS |      CSS | Fonts | Images | HTML | Render-blocking | LCP desktop | LCP mobile 4× | LCP element                       | CLS (desktop / mobile) |
| ---------------------------------------- | -------: | ------: | -------: | ----: | -----: | ---: | --------------: | ----------: | ------------: | --------------------------------- | ---------------------: |
| `/`                                      |       16 | 3.8 (4) | 15.9 (8) |  51.3 |    1.1 | 14.9 |               8 |        1128 |          1300 | `p.hero__intro`                   |          0.000 / 0.000 |
| `/how-to-fetch-data-from-backend-react/` |       21 | 6.5 (9) | 18.8 (7) |  51.3 |   61.7 | 22.7 |               6 |         180 |           356 | `img.article__cover-image` (AVIF) |          0.000 / 0.000 |
| `/writing/`                              |       12 | 3.8 (4) | 11.5 (4) |  51.3 |    1.1 | 11.9 |               4 |         980 |           276 | `p.page-lede`                     |          0.000 / 0.000 |
| `/tools/`                                |       13 | 4.8 (6) | 11.4 (3) |  51.3 |    1.1 | 13.6 |               3 |         980 |          1076 | `h1.page-title`                   |          0.000 / 0.000 |
| `/tools/sql/`                            |       17 | 9.5 (9) | 11.3 (4) |  51.3 |    1.1 | 11.8 |               4 |         144 |           312 | (replaced by script)              |          0.001 / 0.000 |
| `/tools/css-generator/`                  |       16 | 7.4 (9) | 11.4 (3) |  51.3 |    1.1 | 11.7 |               3 |         992 |           996 | `h1.page-title`                   |      **0.000** / 0.000 |
| `/tools/diff/`                           |       16 | 7.8 (8) | 11.6 (4) |  51.3 |    1.1 | 11.5 |               4 |         976 |           284 | `p.page-lede`                     |          0.000 / 0.000 |
| `/map/`                                  |       13 | 5.7 (6) | 12.6 (3) |  51.3 |    1.1 | 21.9 |               3 |        1100 |          1156 | `h1.page-title`                   |          0.000 / 0.004 |
| `/snippets/`                             |       13 | 4.2 (5) | 11.7 (4) |  51.3 |    1.1 | 12.6 |               4 |         972 |          1076 | `h1.page-title`                   |          0.000 / 0.000 |
| `/snippets/debounce-and-throttle/`       |       19 | 6.5 (9) | 16.1 (6) |  51.3 |    1.1 | 15.4 |               5 |         196 |           248 | `p`                               |          0.000 / 0.000 |

The CSS generator's HTML grows by 0.1 kB gzipped because it now holds the default items. Other differences are run-to-run noise.

| Build (cold asset cache)       | Before |  After |
| ------------------------------ | -----: | -----: |
| Total `pnpm build`             |   81 s |   43 s |
| Static generation              | 48.9 s | 11.8 s |
| 60 OG images                   | 46.3 s |  8.9 s |
| Mean per OG image              | 772 ms | 149 ms |
| Image optimisation (73 images) | 21.4 s | 21.5 s |

## Recommendations (not changed)

- **Reveal and LCP:** leave opacity out of the reveal for the LCP element (the page title, or the hero intro on home) and keep the rise and blur. That would take about 850 ms off desktop LCP on most pages. It changes the entrance, so it is a design decision.
- **Palette data:** the palette's list of every page could be fetched as JSON when the palette first opens instead of being inlined, saving about 3.4 kB gzipped of HTML on every page. It needs care so the palette still opens instantly and keeps its accessibility behaviour.
- **`preload-helper.js`:** if a future Astro or Vite version lets the client build skip `__vitePreload` for dynamic imports with no CSS dependencies, that saves 805 B and one request on every page. Lower the budgets when that happens.
