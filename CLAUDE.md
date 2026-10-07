# CLAUDE.md

Louis Young's personal site: Astro 7 static site, TypeScript strict, Tailwind 4, MDX articles, React 19 islands for demos. Hosted on Vercel.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm preview`
- `pnpm check` runs all static checks (Prettier, ESLint, `astro check`, ls-lint, cspell, knip). It must pass.
- `pnpm test` runs Vitest: unit, integration, types and content.
- `pnpm test:e2e`, `pnpm test:a11y` and `pnpm test:visual` need `pnpm build` first. In sandboxes without downloaded browsers, set `CHROMIUM_PATH` to a local Chromium and run `--project=chromium`/`mobile`/`a11y`.
- `pnpm new "Title"` scaffolds a draft article.

## Conventions

- Article URLs are folder names under `content/articles/`. Never rename a published one.
- UI text goes in `src/i18n/en-GB.ts` and is read with `t()`. Never hard-code UI strings (the pseudo-locale test catches it). Delete keys you stop using (also tested).
- Colours come from the tokens in `src/styles/global.css`. Add new text/background pairs to `tests/unit/tokens.test.ts`.
- Keep `src/lib` pure and unit-tested; coverage thresholds are enforced.
- No inline `<script>` that isn't processed by Astro; the CSP is hash-based. Third-party embeds must be click-to-load.
- Visual baselines are only generated in CI (see docs/adr/0005). Don't commit locally rendered screenshots.
- Conventional Commits; British English in prose.

See docs/architecture.md and docs/authoring.md.
