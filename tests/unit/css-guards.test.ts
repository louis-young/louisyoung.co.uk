import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sources = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sources(path);
    return /\.(?:astro|css)$/u.test(entry.name) ? [path] : [];
  });

describe("CSS guards", () => {
  // Live backdrop blurs stall WebKit's software renderer (and cost every scroll frame on low-end
  // devices): CI saw clicks and navigations time out until they were removed. Use a near-opaque
  // background instead.
  it.each(sources(new URL("../../src", import.meta.url).pathname))("%s has no backdrop-filter", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/backdrop-filter\s*:/u);
  });
});
