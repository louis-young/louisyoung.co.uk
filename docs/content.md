# Editing the site's content

Everything about you lives in a handful of files. Anything in `[SQUARE BRACKETS]` is a placeholder; run `pnpm content:todo` to list every one that's left, and `pnpm content:todo --strict` to fail while any remain.

| What                                     | Where                               | Shows up on                              |
| ---------------------------------------- | ----------------------------------- | ---------------------------------------- |
| Name, headline, intro, location, booking | `content/data/profile.ts`           | Header, home hero, hire, CV, footer      |
| Availability (`available`, `limited`, …) | `content/data/profile.ts`           | The signal chip on home and `/hire/`     |
| Roles, skills, education, summary        | `content/data/cv.ts`                | `/cv/`, `/cv.pdf`, the home CV snapshot  |
| Services, process, quotes, FAQ           | `content/data/hire.ts`              | `/hire/` and the orange band on home     |
| Case studies                             | `content/work/<slug>/index.mdx`     | `/work/`, `/work/<slug>/`, home, ⌘K      |
| `/now` and `/uses`                       | `content/pages/now.mdx`, `uses.mdx` | Their pages, and the Now excerpt on home |
| Articles                                 | `content/articles/<slug>/index.mdx` | See [authoring.md](authoring.md)         |
| Snippets                                 | `content/snippets/<slug>/index.mdx` | `/snippets/`, their pages, search, ⌘K    |

The data files are TypeScript checked with `satisfies`, so a typo in a field name or a missing value fails `pnpm check` rather than the live site.

## Availability and booking

Set `profile.availability.status` to `available` (orange chip), `limited` (black chip) or `unavailable` (outlined, "Not taking new work"). `bookingUrl` takes any HTTPS scheduling link (Cal.com, SavvyCal, Calendly). Until it is set, "Book a call" buttons open a pre-filled email instead.

## Case studies

Copy one of the folders in `content/work/`. The frontmatter is validated in `src/content.config.ts`:

```yaml
title: "Checkout rebuild for Acme"
summary: "One sentence: what, for whom, and the headline result."
client: "Acme"
role: "Tech lead"
year: "2025"
order: 1 # position in the work table
stack: ["React", "TypeScript"]
outcomes: # up to four big numbers, shown in a black band
  - value: "38%"
    label: "Faster checkout"
links: # optional, up to four
  - label: "Live site"
    href: "https://example.com"
draft: false
```

## Snippets

Short, copy-pasteable code lives in `content/snippets/<slug>/index.mdx` and is published at `/snippets/<slug>/`, so snippet names never collide with article URLs at the root. Keep the frontmatter to JSON-style values; the content tests read it directly:

```yaml
title: "Exhaustive switch statements with never" # 10–70 characters
description: "One or two sentences on what it does and when to reach for it." # 50–240 characters
language: "ts" # ts, tsx, js, css, html, bash, sql or json: the chip and the language filter
tags: ["typescript", "patterns"] # 1–4 lowercase, kebab-case tags; related snippets share them
date: "2026-09-14"
updated: "2026-10-01" # optional
draft: false
```

Write a short introduction, then one or more code blocks (Expressive Code adds the copy button), then a `## Why it works` and/or `## Gotchas` section. Make every block self-contained: give it a `title="file-name.ts"` and import from earlier blocks by that name (`import { debounce } from "./rate-limit";`). `tests/unit/snippets-content.test.ts` type-checks every `ts` and `tsx` block as its own module under strict settings, with those titles as file names, so a snippet that doesn't compile fails the build.

Snippets have their own feed at `/snippets/rss.xml`; the site feeds stay articles only.

## The enquiry form

There is no backend. The `/hire/` form composes an email with every field labelled and opens the visitor's mail client, so nothing is stored and there's no spam endpoint to maintain.

## GitHub repositories

Production builds on Vercel fetch your public, non-fork, non-archived repositories from the GitHub API and show the top six on home and `/work/`. CI and local builds skip the request so screenshots stay deterministic. Set a `GITHUB_TOKEN` environment variable on Vercel to raise the rate limit.

## The CV PDF

`/cv.pdf` is generated at build time from `content/data/cv.ts` with pdf-lib and the standard PDF fonts, so it always matches the web version. Characters outside Windows-1252 (emoji, arrows) are dropped from the PDF.
