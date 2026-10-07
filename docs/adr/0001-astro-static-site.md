# 1. Rebuild on Astro as a static site

- Status: accepted
- Date: 2026-10-07

## Context

The site was a Gatsby 4 / React 17 / MDX 1 blog from 2021. Gatsby's ecosystem has stalled, the plugins pinned old majors of React and MDX, and every page shipped the React runtime even though almost nothing on it is interactive.

## Decision

Rebuild on Astro (7.x), rendering everything to static HTML. Use React 19 only for interactive article demos, hydrated as islands with `client:visible`. Keep content in MDX, validated by a Zod schema.

Next.js was the main alternative. It would have meant more client JavaScript, a server runtime we don't need, and more configuration to reach the same static result.

## Consequences

- Article pages ship a few kilobytes of JavaScript, and the React runtime loads only where a demo needs it.
- Every existing URL is preserved (`/<slug>/`, trailing slash), and tests guard it.
- MDX 1 syntax had to be migrated: inline `style` strings, raw iframes and `<a target="_blank">` were replaced with components and Markdown links.
