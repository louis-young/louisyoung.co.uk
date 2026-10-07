# Overhaul prompt: louisyoung.co.uk

> Paste everything below the line into a fresh Claude Code session on this repo.

---

You are rebuilding **louisyoung.co.uk**, Louis Young's personal site and technical blog, from the ground up. The goal is a site that experienced engineers look at and want to copy. The writing should be excellent, the design distinctive and carefully made, and the engineering exemplary: fast, accessible, well tested, secure, and pleasant to write for and maintain. Treat this as a flagship portfolio piece, not a refactor.

Work autonomously and in phases. Stop only at the **checkpoints** marked below. Each phase must be shippable on its own.

## 1. What exists today (verify, don't trust)

- **Stack:** Gatsby 4, React 17, MDX v1 (`gatsby-plugin-mdx`), Tailwind 3, prism-react-renderer, react-helmet, `gatsby-plugin-google-gtag` (ID `G-CQ5X65RCG6`). It's mostly `.jsx`/`.js`. Only `src/components/container/` is TypeScript.
- **Content:** 8 MDX articles in `content/posts/<slug>/index.mdx` from around 2021. All are React/JS tutorials, each with `introduction.jpg` and frontmatter `title/date/description/image`. Some articles embed live components (for example `why-functional-state-updates-are-important/components/*.js`). The URLs are `/<slug>/` and **must keep working**.
- **Known bugs:**
  - Hand-written tables of contents link to headings that don't exist. For example, `why-functional-state-updates-are-important` links to `#what-is-the-context-api`, `#when-should-i-use-it` and `#what-problems-does-it-solve`.
  - The dark-mode toggle (`src/components/toggle.jsx`) is fully commented out.
  - `npm test` only runs build + serve, so there are no real tests.
- **Tooling:** ESLint (airbnb-typescript, 2021-era), Prettier 2, ls-lint.
- **CI:** one job on `push` using `actions/checkout@v2`. **Dependabot** covers npm only, with no grouping.
- **Hosting:** `static/.htaccess` points to Apache. A Vercel MCP connector is available in some sessions, so check whether a Vercel project already exists before you pick a host.
- **Stale metadata:** `package.json` still names the project `blog` and points at `louis-young/blog`. The README says "old project, does not reflect my current work". Your job is to make that sentence false.

Read the whole repo before you plan anything.

## 2. Checkpoint A: decisions to confirm with the user before writing code

Ask these together in one round, each with a recommended default:

1. **Hosting/deploy target.** Recommend Vercel or Cloudflare Pages with preview deploys per PR. Ask which one actually serves louisyoung.co.uk today.
2. **i18n scope.** Recommend full i18n infrastructure with en-GB as the default locale: locale routing, a typed message catalogue, `Intl` for dates and numbers, hreflang, and RTL-safe CSS using logical properties. Ship one extra locale for UI strings to prove the pipeline. Article translation is opt-in per post, and machine-translated prose is never published without review.
3. **Analytics.** Keep GA4, or switch to a cookieless, privacy-friendly option (recommended), which removes the need for a consent banner.
4. **Content.** Keep all 8 articles as they are (copy-edited, with bugs fixed). Or also refresh them for modern React: React 19, the `use` hook, Actions, the React Compiler. Mark updated posts with an "Updated" date.
5. **Scope of the site.** Blog only, or blog plus home/about, projects, `/uses`, and `/now`.

## 3. Target stack (verify each is current and stable *today* before adopting it)

Check npm, release notes and changelogs for current majors. Don't rely on memory. Prefer boring and stable over beta, unless the beta is clearly the future and is production-ready.

- **Framework:** **Astro** (latest stable). It's static-first, has content collections with Zod-typed frontmatter, MDX, and zero JS by default. Interactive demos are **React 19 islands**. Justify any deviation, such as Next.js, in an ADR.
- **Language:** TypeScript everywhere, strictest settings (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`). No `.js` source files.
- **Styling:** Tailwind CSS v4 (CSS-first config), plus design tokens as CSS custom properties. Use OKLCH colour, fluid type and space via `clamp()`, container queries, logical properties, `prefers-reduced-motion`, `prefers-contrast`, and View Transitions.
- **Code blocks:** Shiki via Expressive Code. Support light and dark themes, line highlights, diffs, file names, copy button and word wrap. Highlighting happens at build time, with no runtime JS.
- **Content pipeline:**
  - MDX with remark/rehype plugins for heading slugs and autolinks, a **generated** table of contents (delete the hand-written ones), reading time, and footnotes.
  - Callouts/admonitions, and figures with captions.
  - Responsive AVIF/WebP images via `astro:assets`.
  - Generated OG images per post (Satori/resvg).
  - RSS + Atom + JSON Feed, sitemap, `robots.txt`, JSON-LD (`BlogPosting`, `Person`, `BreadcrumbList`), canonical URLs, and a 404 page with suggestions.
- **Features:**
  - Dark/light/system theme with no flash of the wrong theme.
  - Reading progress bar as a CSS scroll-driven animation, not a JS scroll listener.
  - Client-side search (Pagefind), tags, series, and previous/next post links.
  - Related posts, "edit on GitHub", last-updated from git, and a print stylesheet.
  - Keyboard shortcuts with a discoverable help dialog.
- **Package manager/runtime:** pnpm (pinned via `packageManager` and corepack) on the current Node LTS (`.nvmrc` + `engines`).
- **Lint/format:** ESLint flat config (typescript-eslint strict-type-checked, eslint-plugin-astro, jsx-a11y), Prettier with the Astro and Tailwind plugins, and ls-lint for file names.
  - Add `knip` for dead code and deps, `publint`/`attw` only if anything is published, and `markdownlint` + `cspell` (en-GB dictionary) + Vale (prose style) for articles.
- **Git hooks:** lefthook running lint-staged-style checks, plus commitlint (Conventional Commits).

## 4. Design: do this before building pages

The current site is a generic Tailwind blog. The new one needs a clear point of view.

1. **Explore with Claude Design.** Run `Artifact` `quickstart` with `intent: "design"`, then produce **2–3 distinct visual directions**. Cover the home page, article page (with code, callout, figure and table of contents) and the dark-mode variant of each. Make every direction responsive (360px → 1440px). Directions should differ in typography pairing, colour system, layout grid and motion language. Avoid the default "Inter + slate + rounded cards" look.
2. **Checkpoint B:** share the design artifact links. The user picks or merges a direction.
3. **Codify the chosen direction as a design system before any page is built:**
   - tokens (colour in OKLCH with checked AA/AAA contrast pairs, type scale, space scale, radii, shadows, motion durations and easings, z-index)
   - self-hosted variable fonts with `font-display: swap`, size-adjusted fallbacks and subsetting
   - component primitives
   - a living style guide page at `/design` (or Storybook, if the component count justifies it)
4. **Article design should get the most attention:**
   - a measure of about 65–75ch
   - a hanging-punctuation-aware heading rhythm
   - a sticky table of contents with scroll-spy on wide screens
   - margin notes or sidenotes on wide screens
   - code blocks that break out of the text column
   - accessible interactive demos with a visible "live demo" frame and reset
   - every small detail handled: selection colour, focus rings, link underlines (`text-underline-offset`, `text-decoration-thickness`), `text-wrap: balance`/`pretty`, and correct ’ “ ” — … typography

## 5. Testing: every layer, all enforced in CI

| Layer | Tool | What it covers |
|---|---|---|
| Unit | Vitest | utilities (slugs, reading time, date formatting per locale, feed builders, TOC builder, i18n lookup), with coverage thresholds of at least 90% on `src/lib` |
| Component/integration | Vitest + Astro Container API; Testing Library for React islands | rendered HTML of layouts, components and MDX components; island behaviour (each article demo works) |
| Content | Vitest over the content collection | frontmatter validates against Zod; every TOC/anchor/internal link resolves; every image has alt text; no duplicate slugs; dates are sane |
| Type tests | `expectTypeOf` (Vitest typecheck) | public helper and content-schema types; `astro check` + `tsc --noEmit` with zero errors |
| E2E | Playwright (Chromium, Firefox, WebKit, plus mobile viewports) | navigation, theme toggle persistence with no flash, search, keyboard-only flows, feeds, 404, **every legacy URL still resolves** |
| Accessibility | `@axe-core/playwright` on every route in both themes; Playwright keyboard/focus-order tests; pa11y-ci as a second opinion | zero violations against WCAG 2.2 AA |
| Visual regression | Playwright `toHaveScreenshot` inside the pinned official Playwright Docker image, so snapshots are deterministic | every page × light/dark × 3 viewports; fonts loaded, animations disabled; snapshots updated via a labelled workflow, never blindly |
| Performance | Lighthouse CI with budgets; bundle-size budgets (size-limit) | 100/100/100/100 on key pages, JS per article page under 10 kB beyond islands, CLS = 0, LCP < 1.5s on simulated mobile |
| Links | lychee | internal and external links, on PRs and weekly |
| HTML/SEO | html-validate; structured-data checks | valid HTML, valid JSON-LD, OG/Twitter meta present on every page |
| Synthetics | scheduled GitHub Actions workflow (every 30 min) running a Playwright smoke suite against **production** (or Checkly, if the user prefers) | homepage, a random article, feed, search, TLS/security headers; opens or updates an issue on failure |
| i18n | Vitest + Playwright | catalogue keys match across locales (type-enforced), no hard-coded UI strings (lint rule), pseudo-locale build shows no truncation/overflow in screenshots, hreflang correct |

Tests must be fast, isolated and non-flaky. Don't add retries to hide flakes. Deterministic dates go through an injected clock.

## 6. Security and supply chain

- **Dependabot:**
  - ecosystems: `npm` (pnpm), `github-actions` and `docker`
  - grouped minor/patch updates, separate majors
  - a cooldown for fresh releases
  - auto-merge for passing patch updates via a workflow
- **CodeQL:** `javascript-typescript` and `actions` languages, on PRs + weekly.
- **Dependency review action on PRs:** fail on high-severity issues or disallowed licences.
- **OSSF Scorecard workflow**, with the badge in the README.
- **Secret scanning + push protection:** these are repo settings you can't toggle. Give the user exact instructions, and add `gitleaks` in CI as a backstop.
- **Hardened workflows:**
  - every third-party action pinned to a full commit SHA (Dependabot keeps them updated)
  - `permissions: {}` at the top level, granted per job
  - `persist-credentials: false`
  - concurrency groups
  - zizmor or actionlint to lint the workflows themselves
- **HTTP headers on the host:**
  - strict CSP: hash-based, no `unsafe-inline`
  - HSTS preload, `Permissions-Policy`, `Referrer-Policy`, COOP/CORP, `X-Content-Type-Options`
  - an E2E test asserting each header
- **`SECURITY.md`, `security.txt`** (`/.well-known/security.txt`), and a `CODEOWNERS`.

## 7. Developer experience and authoring

- **One-command setup:** `pnpm i && pnpm dev`. Add a devcontainer and a Claude Code SessionStart hook so cloud sessions can run every check.
- **`pnpm new:post "Title"`:** scaffolds a post folder with valid frontmatter, a draft flag and a placeholder image.
- **Drafts:** visible in dev, excluded from prod builds and feeds.
- **Typed MDX components** for authors: `<Callout>`, `<Figure>`, `<Demo>`, `<Aside>`, `<Kbd>`, `<Steps>`, `<Tabs>`. Document each one in the style guide with an example.
- **One `pnpm check`:** runs format, lint, types, unit tests, content validation, prose lint and spellcheck. The pre-push hook runs the same.
- **CI:** a single fast pipeline with cached pnpm store, Playwright browsers and Astro build, with jobs fanned out in parallel. Required checks go into a branch-protection guide in `CONTRIBUTING.md`. Preview deploy URL commented on each PR, and E2E/visual/Lighthouse run **against the preview**.
- **Docs:**
  - rewritten README (what it is, stack, screenshots, badges, scripts table)
  - `CONTRIBUTING.md`, `docs/authoring.md`, `docs/architecture.md`
  - ADRs in `docs/adr/` for each major choice
  - a `CLAUDE.md` covering commands, conventions and how to add a post
- **Releases:** changesets or release-please for a human-readable changelog.

## 8. Migration rules

- **Preserve every URL.** Generate a redirect map for anything that changes, and test it in E2E.
- **Preserve article content.** Fix factual errors, broken anchors, typos and outdated APIs, but keep Louis's voice. List every prose change in the PR description so it can be reviewed.
- **Re-encode images; don't lose quality.** Every image needs meaningful alt text (write it from the image and its context, and flag any you're unsure of).
- **Remove dead code and dependencies as you go.** `knip` must pass with zero findings.

## 9. Process

1. **Planning:**
   - Explore the repo.
   - Present the Checkpoint A questions.
   - Write `docs/adr/0001-*` onwards.
   - Run the design phase (Checkpoint B).
2. **Build in vertical phases. Each phase is its own commit series and leaves CI green:**
   1. Scaffold the Astro/TS/tooling/CI skeleton, with security workflows from day one.
   2. Design system + style guide.
   3. Content collections + migrate all 8 posts + redirects.
   4. Article page + MDX components + demos as islands.
   5. Home, tags, series, search, feeds, OG images, SEO.
   6. i18n.
   7. Full test matrix, visual baselines, Lighthouse budgets, synthetics.
   8. Docs, polish pass, launch checklist.
3. **Verify everything before you call it done.**
   - Run the site and look at it. Screenshot every page in both themes at 360/768/1440 and inspect the screenshots yourself.
   - Tab through every page with the keyboard. Run with reduced motion.
   - Fix everything that looks even slightly off: alignment, spacing rhythm, orphans, focus states, overflow, contrast.
4. **Final polish pass.** Re-read the whole diff and the whole site as a sceptical senior reviewer and a design lead would. Cut anything gratuitous. The bar is "nothing to nitpick".
5. **Commit and pull request.** Use Conventional Commits, small and logical. Push to the designated branch and open a PR (only when the user asks) with:
   - before/after screenshots
   - the Lighthouse report
   - the list of prose edits
   - a checklist of repo settings the user must enable (secret scanning, push protection, branch protection, required checks, Pages/DNS changes)

## 10. Definition of done

- [ ] `pnpm check`, `pnpm test`, `pnpm test:e2e`, `pnpm test:visual`, `pnpm test:a11y` and `pnpm build` all pass locally and in CI.
- [ ] Zero axe violations across all routes, themes and locales. Fully keyboard-operable. Respects reduced motion.
- [ ] Lighthouse 100 ×4 on home and a representative article (mobile); budgets enforced.
- [ ] All 8 legacy article URLs return 200 with the same content. TOC anchors all resolve.
- [ ] CodeQL, dependency review, Scorecard, gitleaks, Dependabot (npm + actions + docker) and synthetics are all live. All actions are pinned by SHA.
- [ ] No `.js` source, no `any`, no lint suppressions without a justification comment, knip clean.
- [ ] Writing a new post takes one command and needs no knowledge of the codebase beyond `docs/authoring.md`.
- [ ] The README no longer says this is an old project. It isn't.
