import { describe, expect, it } from "vitest";

import { COMMANDS, complete, fill, findArticle, runCommand, type TerminalContext } from "../../src/lib/terminal";

const context: TerminalContext = {
  articles: [
    { slug: "how-to-fetch-data-from-backend-react", title: "How to fetch data", tags: ["react", "hooks"] },
    { slug: "utilising-context-api-react", title: "Utilising the Context API", tags: ["react", "context"] },
    { slug: "implicit-explicit-returns-javascript", title: "Implicit and explicit returns", tags: ["javascript"] },
  ],
  snippets: [
    { slug: "exhaustive-switch", title: "Exhaustive switch statements" },
    { slug: "visually-hidden", title: "A visually hidden utility class" },
  ],
  pages: [
    { name: "writing", href: "/writing/" },
    { name: "hire", href: "/hire/" },
  ],
  email: "me@example.com",
  messages: {
    help: "Commands:",
    whoami: "Louis Young, software engineer",
    notFound: "{command}: command not found",
    openUsage: "Usage: open <number|slug|page>",
    noMatch: "No match for “{query}”",
    opening: "Opening {title}…",
    theme: "Theme changed",
    copied: "Copied {email}",
    sudo: "Nice try",
    searching: "Searching for “{query}”…",
    lsUsage: "Usage: ls [writing|tags|<tag>]",
    noTag: "No articles tagged {tag}",
    date: "It's {date}",
    echoUsage: "Usage: echo <text>",
  },
  descriptions: { help: "List commands", ls: "List pages" },
  now: () => new Date("2026-10-08T12:00:00Z"),
  locale: "en-GB",
};

describe("fill", () => {
  it("fills known placeholders and leaves unknown ones", () => {
    expect(fill("Hi {name}, {missing}", { name: "Ada" })).toBe("Hi Ada, {missing}");
  });
});

describe("findArticle", () => {
  it("finds by list number, slug, or a unique fragment", () => {
    expect(findArticle(context.articles, "2")?.slug).toBe("utilising-context-api-react");
    expect(findArticle(context.articles, "implicit-explicit-returns-javascript")?.title).toBe(
      "Implicit and explicit returns",
    );
    expect(findArticle(context.articles, "context")?.slug).toBe("utilising-context-api-react");
  });

  it("returns nothing for out-of-range numbers or ambiguous fragments", () => {
    expect(findArticle(context.articles, "9")).toBeUndefined();
    expect(findArticle(context.articles, "react")).toBeUndefined();
  });
});

describe("runCommand", () => {
  it("ignores empty input", () => {
    expect(runCommand("   ", context)).toEqual({ lines: [] });
  });

  it("lists every command in help, with descriptions where given", () => {
    const { lines } = runCommand("help", context);
    expect(lines[0]).toBe("Commands:");
    expect(lines).toHaveLength(COMMANDS.length + 2);
    expect(lines).toContain("  help    List commands");
    expect(lines).toContain("  exit");
  });

  it("is case-insensitive about command names", () => {
    expect(runCommand("WHOAMI", context).lines).toEqual(["Louis Young, software engineer"]);
  });

  it("reports unknown commands", () => {
    expect(runCommand("rm -rf /", context).lines).toEqual(["rm: command not found"]);
  });

  it("lists pages, articles, tags and articles by tag", () => {
    expect(runCommand("ls", context).lines).toEqual(["writing/", "hire/"]);
    expect(runCommand("ls writing", context).lines).toEqual([
      "1  How to fetch data",
      "2  Utilising the Context API",
      "3  Implicit and explicit returns",
    ]);
    expect(runCommand("ls tags", context).lines).toEqual(["#context  #hooks  #javascript  #react"]);
    expect(runCommand("ls #hooks", context).lines).toEqual(["  How to fetch data"]);
    expect(runCommand("ls nope", context).lines).toEqual(["No articles tagged nope", "Usage: ls [writing|tags|<tag>]"]);
  });

  it("lists snippets, and copes when there are none", () => {
    expect(runCommand("ls snippets", context).lines).toEqual([
      "1  Exhaustive switch statements",
      "2  A visually hidden utility class",
    ]);
    expect(runCommand("ls snippets", { ...context, snippets: [] }).lines).toEqual([]);
    const { snippets, ...withoutSnippets } = context;
    expect(snippets).toHaveLength(2);
    expect(runCommand("ls snippets", withoutSnippets).lines).toEqual([]);
    expect(runCommand("open visually-hidden", withoutSnippets).lines).toEqual(["No match for “visually-hidden”"]);
  });

  it("opens snippets by slug, with or without the snippets/ prefix", () => {
    expect(runCommand("open visually-hidden", context)).toEqual({
      lines: ["Opening A visually hidden utility class…"],
      effect: { type: "navigate", href: "/snippets/visually-hidden/" },
    });
    expect(runCommand("open /snippets/exhaustive-switch/", context).effect).toEqual({
      type: "navigate",
      href: "/snippets/exhaustive-switch/",
    });
  });

  it("opens pages and articles", () => {
    expect(runCommand("open", context).lines).toEqual(["Usage: open <number|slug|page>"]);
    expect(runCommand("open hire/", context).effect).toEqual({ type: "navigate", href: "/hire/" });
    expect(runCommand("open 1", context)).toEqual({
      lines: ["Opening How to fetch data…"],
      effect: { type: "navigate", href: "/how-to-fetch-data-from-backend-react/" },
    });
    expect(runCommand("open react", context).lines).toEqual(["No match for “react”"]);
  });

  it("searches, with or without a query", () => {
    expect(runCommand("search use effect", context).effect).toEqual({
      type: "navigate",
      href: "/search/?q=use%20effect",
    });
    expect(runCommand("search", context).effect).toEqual({ type: "navigate", href: "/search/" });
  });

  it("returns effects for theme, email, clear and exit", () => {
    expect(runCommand("theme", context).effect).toEqual({ type: "theme" });
    expect(runCommand("email", context)).toEqual({
      lines: ["Copied me@example.com"],
      effect: { type: "copy", value: "me@example.com" },
    });
    expect(runCommand("clear", context).effect).toEqual({ type: "clear" });
    expect(runCommand("exit", context).effect).toEqual({ type: "close" });
  });

  it("prints the date and echoes text", () => {
    expect(runCommand("date", context).lines[0]).toMatch(/^It's Thursday,? 8 October 2026/u);
    expect(runCommand("echo hello  there", context).lines).toEqual(["hello there"]);
    expect(runCommand("echo", context).lines).toEqual(["Usage: echo <text>"]);
  });

  it("falls back to the current date and en-GB", () => {
    const rest: TerminalContext = { ...context };
    delete rest.now;
    delete rest.locale;
    expect(runCommand("date", rest).lines[0]).toMatch(/^It's /u);
  });

  it("answers sudo with the hire page", () => {
    expect(runCommand("sudo hire-me", context)).toEqual({
      lines: ["Nice try"],
      effect: { type: "navigate", href: "/hire/" },
    });
  });
});

describe("complete", () => {
  it("completes a unique command name", () => {
    expect(complete("wh", context)).toBe("whoami ");
    expect(complete("e", context)).toBe("e");
  });

  it("completes page names and slugs for open, and targets for ls", () => {
    expect(complete("open hi", context)).toBe("open hire");
    expect(complete("open util", context)).toBe("open utilising-context-api-react");
    expect(complete("ls ta", context)).toBe("ls tags");
    expect(complete("ls sn", context)).toBe("ls snippets");
    expect(complete("open exh", context)).toBe("open exhaustive-switch");
    expect(complete("open exh", { articles: [], pages: [] })).toBe("open exh");
    expect(complete("open zzz", context)).toBe("open zzz");
  });
});
