# Content to do before publishing `/uses` and `/now`

Both pages are drafted from what the repository shows and are still `draft: true`, so production serves only a short "still being written" notice (`noindex`, left out of the navigation, footer, ⌘K, terminal and sitemap). They render in full with `pnpm dev` or `SHOW_DRAFTS=true pnpm build`. Run `pnpm content:todo` to list what's left.

To publish a page: fill in or delete every `[PLACEHOLDER: …]`, check the drafted text, set `updated` to the day you publish, and remove the `draft: true` line (and the comment above it).

## `/uses` (`content/pages/uses.mdx`)

Fill in:

- [ ] **Hardware:** computer, display, keyboard and pointer, audio. Delete any line that doesn't apply.
- [ ] **Editor:** editor, colour theme and font.
- [ ] **Terminal:** terminal app and shell, and any prompt or plugins.
- [ ] **AI:** other AI tools you use day to day, if any.
- [ ] **Languages:** anything you use regularly besides TypeScript, or delete the placeholder.
- [ ] **Browsers:** the browser you use day to day.
- [ ] **Services:** apps you'd recommend (password manager, notes, calendar), or delete the line.

Confirm:

- [ ] The AI line: "I used it heavily to rebuild this site", about Claude Code (drawn from `CLAUDE.md`, `docs/overhaul-prompt.md` and the commit trailers).
- [ ] The summary and description read the way you'd say them.
- [ ] "This site" and "Writing about" match how you'd describe your choices. They're drawn from `package.json`, `docs/architecture.md`, `docs/adr/`, the CI workflows and the articles.

## `/now` (`content/pages/now.mdx`)

Fill in:

- [ ] **Work:** what you're working on right now, in a sentence or two.
- [ ] **Writing:** the next article you're planning, or delete the line.
- [ ] **Learning:** a language, technique or book.
- [ ] **Reading:** one to three books, or delete the section.
- [ ] **Elsewhere:** where you're based and anything outside work, or delete the section.

Confirm:

- [ ] "I'm open to contract and advisory work" still matches `profile.availability` in `content/data/profile.ts`.
- [ ] The summary. It also appears in the Now card on the home page once the page is published.
- [ ] The "Building" and "Writing" sections are still current. A `/now` page dates quickly, so update `updated` every time you edit it.
