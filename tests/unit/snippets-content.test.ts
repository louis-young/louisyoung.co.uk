import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { snippetSchema } from "../../src/content.config";
import { findPlaceholdersInText } from "../../src/lib/placeholders";

const projectRoot = new URL("../../", import.meta.url).pathname;
const root = join(projectRoot, "content/snippets");
const slugs = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

interface Block {
  language: string;
  title: string | undefined;
  code: string;
}

const read = (slug: string) => readFileSync(join(root, slug, "index.mdx"), "utf8");

/** The frontmatter, which snippets keep to JSON-compatible YAML: `key: "string"`, `key: [...]`, `key: true`. */
const frontmatter = (source: string) => {
  const yaml = /^---\n(?<body>[\s\S]*?)\n---\n/u.exec(source)?.groups?.["body"] ?? "";
  return Object.fromEntries(
    yaml.split("\n").map((line) => {
      const [, key = line, value = ""] = /^(\w+):\s*(.+)$/u.exec(line) ?? [];
      return [key, JSON.parse(value) as unknown];
    }),
  );
};

const bodyOf = (source: string) => source.slice(source.indexOf("\n---\n", 3) + 5);

const blocksOf = (body: string): Block[] =>
  [...body.matchAll(/^```(?<language>\w+)(?<meta>[^\n]*)\n(?<code>[\s\S]*?)^```$/gmu)].map(({ groups }) => ({
    language: groups!["language"]!,
    title: /title="(?<title>[^"]+)"/u.exec(groups!["meta"]!)?.groups?.["title"],
    code: groups!["code"]!,
  }));

/** Prose only: fenced code and inline code removed, so code samples don't trip prose rules. */
const proseOf = (body: string) => body.replace(/```[\s\S]*?```/gu, "").replace(/`[^`\n]*`/gu, "");

describe("snippets", () => {
  it("has some to show", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(10);
  });

  describe.each(slugs)("%s", (slug) => {
    const path = join(root, slug, "index.mdx");
    const source = existsSync(path) ? read(slug) : "";
    const body = bodyOf(source);
    const blocks = blocksOf(body);

    it("has an index.mdx with a kebab-case folder name", () => {
      expect(existsSync(path)).toBe(true);
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
    });

    it("has valid frontmatter", () => {
      const result = snippetSchema.safeParse(frontmatter(source));
      expect(result.error?.issues ?? []).toEqual([]);
    });

    it("opens with an introduction, then code, then explains itself", () => {
      const intro = body.slice(0, body.indexOf("```")).trim();
      expect(intro.length, "an intro paragraph before the first code block").toBeGreaterThan(80);
      expect(blocks.length).toBeGreaterThan(0);
      expect(body).toMatch(/^## (?:Why it works|Gotchas)$/mu);
    });

    it("files the snippet under a language its code actually uses", () => {
      const { language } = frontmatter(source) as { language: string };
      expect(blocks.map((block) => block.language)).toContain(language);
    });

    it("starts sections at h2 and never skips a level", () => {
      const levels = [...proseOf(body).matchAll(/^(#{1,6}) /gmu)].map(([, hashes]) => hashes!.length);
      expect(levels).not.toContain(1);
      levels.forEach((level, index) => {
        expect(level - (levels[index - 1] ?? 1), `heading ${index + 1}`).toBeLessThanOrEqual(1);
      });
    });

    it("has no placeholders or TODOs in its prose", () => {
      expect(findPlaceholdersInText(proseOf(body))).toEqual([]);
      expect(source).not.toMatch(/\bTODO\b/u);
    });

    it("uses Markdown links rather than raw HTML, and https for external ones", () => {
      const prose = proseOf(body);
      expect(prose).not.toMatch(/<a\s/u);
      expect(prose).not.toMatch(/\]\(http:\/\//u);
    });
  });
});

describe("snippet schema", () => {
  const valid = {
    title: "A perfectly good title",
    description: "A description that is long enough to pass the minimum length rule, comfortably.",
    language: "ts",
    tags: ["typescript"],
    date: "2026-10-01",
  };

  it("accepts a valid snippet and defaults draft to false", () => {
    expect(snippetSchema.parse(valid).draft).toBe(false);
  });

  it.each([
    ["an unknown language", { language: "cobol" }],
    ["a tag that isn't kebab-case", { tags: ["TypeScript"] }],
    ["no tags", { tags: [] }],
    ["too many tags", { tags: ["a", "b", "c", "d", "e"] }],
    ["a short description", { description: "Too short." }],
    ["an update before it was published", { updated: "2026-09-01" }],
  ])("rejects %s", (_name, change) => {
    expect(snippetSchema.safeParse({ ...valid, ...change }).success).toBe(false);
  });
});

/**
 * Every TypeScript block must compile under strict settings, as a module of its own. Blocks with
 * a `title` are written to that file name in the snippet's folder (in memory), so a usage example
 * can `import` from the block before it exactly as a reader would.
 */
describe("snippet code compiles", () => {
  const options: ts.CompilerOptions = {
    strict: true,
    noUncheckedIndexedAccess: true,
    exactOptionalPropertyTypes: true,
    noImplicitOverride: true,
    noImplicitReturns: true,
    noFallthroughCasesInSwitch: true,
    verbatimModuleSyntax: true,
    isolatedModules: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    lib: ["lib.es2023.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
    types: [],
    skipLibCheck: true,
    noEmit: true,
  };

  const files = new Map<string, { slug: string; code: string }>();
  for (const slug of slugs) {
    blocksOf(bodyOf(read(slug)))
      .filter((block) => block.language === "ts" || block.language === "tsx")
      .forEach((block, index) => {
        const name = block.title ?? `block-${index + 1}.${block.language}`;
        files.set(join(root, slug, name), { slug, code: block.code });
      });
  }

  const host = ts.createCompilerHost(options);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  const getSourceFile = host.getSourceFile.bind(host);
  host.fileExists = (file) => files.has(file) || fileExists(file);
  host.readFile = (file) => files.get(file)?.code ?? readFile(file);
  host.getSourceFile = (file, version, ...rest) => {
    const virtual = files.get(file);
    return virtual ? ts.createSourceFile(file, virtual.code, version, true) : getSourceFile(file, version, ...rest);
  };
  const program = ts.createProgram([...files.keys()], options, host);
  const format = (diagnostic: ts.Diagnostic) => {
    const where = diagnostic.file
      ? `${diagnostic.file.fileName.slice(root.length + 1)}:${diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1}`
      : "";
    return `${where} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`;
  };

  it("finds TypeScript to check", () => {
    expect(files.size).toBeGreaterThan(5);
  });

  it.each([...new Set([...files.values()].map((file) => file.slug))])("%s type-checks under strict mode", (slug) => {
    const diagnostics = [...files]
      .filter(([, file]) => file.slug === slug)
      .flatMap(([name]) => ts.getPreEmitDiagnostics(program, program.getSourceFile(name)));
    expect(diagnostics.map(format)).toEqual([]);
  });
});
