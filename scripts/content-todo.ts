/**
 * Lists every `[PLACEHOLDER]` still in the site's content: `pnpm content:todo`.
 * Pass `--strict` to exit non-zero while any remain (e.g. before launch).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";

import { cv } from "../content/data/cv.ts";
import { hire } from "../content/data/hire.ts";
import { profile } from "../content/data/profile.ts";
import { findPlaceholders, findPlaceholdersInText, type PlaceholderHit } from "../src/lib/placeholders.ts";

const mdxFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return mdxFiles(path);
    return name.endsWith(".mdx") ? [path] : [];
  });

export const collect = (root = process.cwd()) => {
  const report = new Map<string, PlaceholderHit[]>([
    ["content/data/profile.ts", findPlaceholders(profile)],
    ["content/data/cv.ts", findPlaceholders(cv)],
    ["content/data/hire.ts", findPlaceholders(hire)],
  ]);
  for (const directory of ["work", "pages"]) {
    for (const file of mdxFiles(join(root, "content", directory))) {
      report.set(relative(root, file), findPlaceholdersInText(readFileSync(file, "utf8")));
    }
  }
  return [...report].filter(([, hits]) => hits.length > 0);
};

export const format = (report: ReturnType<typeof collect>) => {
  const total = report.reduce((sum, [, hits]) => sum + hits.length, 0);
  if (total === 0) return "No placeholders left. Ship it.\n";
  const lines = report.flatMap(([file, hits]) => [
    `\n${file}`,
    ...hits.map((hit) => `  ${hit.path.padEnd(28)} ${hit.placeholders.join(" ")}`),
  ]);
  return `${lines.join("\n")}\n\n${total} placeholder${total === 1 ? "" : "s"} in ${report.length} file${report.length === 1 ? "" : "s"}.\n`;
};

const main = () => {
  const { values } = parseArgs({ options: { strict: { type: "boolean", default: false } } });
  const report = collect();
  process.stdout.write(format(report));
  if (values.strict && report.length > 0) process.exit(1);
};

if (import.meta.main) main();
