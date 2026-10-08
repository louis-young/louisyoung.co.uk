/**
 * Scaffolds a draft article: `pnpm new "My article title"`.
 * Drafts render in `pnpm dev` and are excluded from production builds and feeds.
 */
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";

export const slugify = (title: string) =>
  title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "");

export const template = (title: string, date: string) => `---
title: ${JSON.stringify(title)}
description: "TODO: one or two sentences that make someone want to read this article."
date: "${date}"
tags: ["todo"]
cover:
  src: "./cover.jpg"
  alt: ""
draft: true
---

TODO: open with the problem this article solves.

## The idea

<Callout type="tip">

Callouts, \`<Demo>\` frames and \`<Sandbox>\` embeds are available without importing them. See docs/authoring.md.

</Callout>

## Conclusion
`;

const main = () => {
  const { positionals } = parseArgs({ allowPositionals: true });
  const title = positionals.join(" ").trim();
  if (!title) {
    console.error('Usage: pnpm new "Article title"');
    process.exit(1);
  }
  const slug = slugify(title);
  const directory = join(process.cwd(), "content", "articles", slug);
  if (existsSync(directory)) {
    console.error(`content/articles/${slug} already exists.`);
    process.exit(1);
  }
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "index.mdx"), template(title, new Date().toISOString().slice(0, 10)));
  copyFileSync(join(process.cwd(), "src", "assets", "default-og.jpg"), join(directory, "cover.jpg"));
  process.stdout.write(`Created content/articles/${slug}/index.mdx (draft). Run \`pnpm dev\` to preview it.\n`);
};

if (import.meta.main) main();
