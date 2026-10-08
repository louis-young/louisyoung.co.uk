# Writing an article

## Start a draft

```sh
pnpm new "How React batches state updates"
pnpm dev
```

This creates `content/articles/how-react-batches-state-updates/` with an `index.mdx` and a placeholder `cover.jpg`. The folder name is the URL: `/how-react-batches-state-updates/`. **Never rename a published article's folder**: its URL would break. The content tests list every published slug to guard against this.

Drafts (`draft: true`) render in `pnpm dev` and are left out of production builds, feeds, the sitemap and search.

## Frontmatter

```yaml
---
title: "How React batches state updates" # 10–90 characters
description: "One or two sentences that make someone want to read it." # 50–240 characters
date: "2026-10-07"
updated: "2026-11-01" # optional; shows "Updated …" and feeds `dateModified`
tags: ["react", "state"] # 1–5 lowercase, kebab-case tags
cover:
  src: "./cover.jpg"
  alt: "" # describe the image, or leave empty if it is purely decorative
draft: true
---
```

The schema in `src/content.config.ts` validates all of this at build time, so a typo fails the build instead of shipping.

## Writing

- Start sections at `##`. The page title is the only `h1`, and heading levels must not skip (`##` → `####`).
- **Don't write a table of contents.** One is generated from your headings, along with self-linking anchors.
- Use Markdown links, not `<a>` tags. External links get a ↗ marker and safe `rel` values automatically.
- Remove every `TODO` before publishing; the content tests fail on leftovers in non-draft articles.
- Spelling is checked in British English (`pnpm check:spelling`). Add genuine terms to `cspell.config.yaml`.

## Code

Fenced code blocks are highlighted at build time by [Expressive Code](https://expressive-code.com/):

````md
```tsx title="counter.tsx" {3}
const [count, setCount] = useState(0);

setCount((previous) => previous + 1);
```
````

`title` adds a file tab, `{3}` highlights a line, and `ins={…}`/`del={…}` mark diffs.

## Components

These are available in every article without importing them.

### `<Callout>`

```mdx
<Callout type="tip" title="Optional title">

Markdown works inside. Leave a blank line after the opening tag.

</Callout>
```

`type` is `note` (default), `tip` or `warning`.

### `<Demo>`

Frames a live, interactive example. Put the component next to the article in `components/` and hydrate it with `client:visible` so its JavaScript only loads when the reader gets there:

```mdx
import Counter from "./components/counter";

<Demo title="Two functional updates">
  <Counter strategy="functional" client:visible />
</Demo>
```

Demo components are React 19 + TypeScript. Render controls as disabled until hydrated (see `why-functional-state-updates-are-important/components/counter.tsx`) so nobody clicks a button that does nothing yet. Test them in `tests/integration/`.

### `<Sandbox>`

Embeds a CodeSandbox behind a click-to-load facade, so readers don't load third-party code or cookies unless they choose to:

```mdx
<Sandbox id="fetch-api-9d09j" title="Fetch API" view="preview" />
```

## Images

Put images next to the article and reference them relatively: `![A diagram of the render cycle](./render-cycle.png)`. Astro generates AVIF and WebP at several sizes. Every content image needs alt text.

## Before you publish

1. Set `draft: false` and check the date.
2. Run `pnpm check && pnpm test`.
3. Run `pnpm build && pnpm preview` and read it through once in each theme.
4. Open a pull request. CI runs the whole suite, and visual baselines can be refreshed by adding the `update-visual-baselines` label.
