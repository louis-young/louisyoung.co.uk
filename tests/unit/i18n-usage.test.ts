import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { enGB } from "../../src/i18n/en-GB";

const root = new URL("../../src/", import.meta.url).pathname;

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(astro|ts|tsx)$/u.test(name) && !path.includes("/i18n/") ? [path] : [];
  });

const source = files(root)
  .map((path) => readFileSync(path, "utf8"))
  .join("\n");

/** Keys built from a template literal, e.g. t(`callout.${type}`). */
const dynamicPrefixes = ["callout."];

describe("message catalogue", () => {
  it.each(Object.keys(enGB))("%s is used", (key) => {
    const used = source.includes(`"${key}"`) || dynamicPrefixes.some((prefix) => key.startsWith(prefix));
    expect(used, `"${key}" is defined but never used; delete it`).toBe(true);
  });

  it("does not use curly apostrophe substitutes or straight quotes in prose", () => {
    for (const [key, message] of Object.entries(enGB)) {
      expect(message, key).not.toMatch(/(?<=\w)'(?=\w)/u);
    }
  });
});
