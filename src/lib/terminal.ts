/**
 * The command engine behind the site terminal (` to open). Pure: it takes a line of input and
 * returns lines to print plus, optionally, one effect for the page to carry out.
 */

export interface TerminalArticle {
  slug: string;
  title: string;
  tags: readonly string[];
}

/** A code snippet, listed by `ls snippets` and opened at /snippets/<slug>/. */
interface TerminalSnippet {
  slug: string;
  title: string;
}

interface TerminalPage {
  name: string;
  href: string;
}

type MessageKey =
  | "help"
  | "whoami"
  | "notFound"
  | "openUsage"
  | "noMatch"
  | "opening"
  | "theme"
  | "copied"
  | "sudo"
  | "searching"
  | "lsUsage"
  | "noTag"
  | "date"
  | "echoUsage";

export interface TerminalContext {
  articles: readonly TerminalArticle[];
  snippets?: readonly TerminalSnippet[];
  pages: readonly TerminalPage[];
  email: string;
  /** Translated messages; `{name}` placeholders are filled in by `fill`. */
  messages: Readonly<Record<MessageKey, string>>;
  /** One translated description per command, keyed by command name. */
  descriptions: Readonly<Partial<Record<Command, string>>>;
  now?: () => Date;
  locale?: string;
}

type Effect =
  | { type: "navigate"; href: string }
  | { type: "theme" }
  | { type: "clear" }
  | { type: "close" }
  | { type: "copy"; value: string };

export interface Result {
  lines: string[];
  effect?: Effect;
}

export const COMMANDS = [
  "help",
  "whoami",
  "ls",
  "open",
  "search",
  "theme",
  "email",
  "date",
  "echo",
  "clear",
  "exit",
] as const;

type Command = (typeof COMMANDS)[number];

/** Replaces `{name}` placeholders. Unknown names are left as they are. */
export const fill = (template: string, values: Record<string, string | number> = {}) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => (name in values ? String(values[name]) : match));

const isCommand = (value: string): value is Command => (COMMANDS as readonly string[]).includes(value);

const pad = (value: string | number, width: number) => String(value).padStart(width, " ");

const listNumbered = (items: readonly { title: string }[]) => {
  const width = String(items.length).length;
  return items.map((item, index) => `${pad(index + 1, width)}  ${item.title}`);
};

/** Finds an article by its list number, exact slug, or a unique slug/title fragment. */
export const findArticle = (articles: readonly TerminalArticle[], query: string) => {
  const number = Number(query);
  if (Number.isInteger(number) && number >= 1) return articles[number - 1];
  const needle = query.toLowerCase();
  const exact = articles.find((article) => article.slug === needle);
  if (exact) return exact;
  const matches = articles.filter(
    (article) => article.slug.includes(needle) || article.title.toLowerCase().includes(needle),
  );
  return matches.length === 1 ? matches[0] : undefined;
};

export const runCommand = (input: string, context: TerminalContext): Result => {
  const [name = "", ...args] = input.trim().split(/\s+/u);
  const command = name.toLowerCase();
  const rest = args.join(" ");
  const { messages, articles, pages } = context;

  if (command === "") return { lines: [] };
  if (command === "sudo") return { lines: [messages.sudo], effect: { type: "navigate", href: "/hire/" } };
  if (!isCommand(command)) return { lines: [fill(messages.notFound, { command: name })] };

  switch (command) {
    case "help": {
      const width = Math.max(...COMMANDS.map((item) => item.length));
      return {
        lines: [
          messages.help,
          "",
          ...COMMANDS.map((item) => `  ${item.padEnd(width)}  ${context.descriptions[item] ?? ""}`.trimEnd()),
        ],
      };
    }
    case "whoami":
      return { lines: [messages.whoami] };
    case "ls": {
      const target = (args[0] ?? "").toLowerCase();
      if (target === "") return { lines: pages.map((page) => `${page.name}/`) };
      if (target === "writing" || target === "articles") return { lines: listNumbered(articles) };
      if (target === "snippets") return { lines: listNumbered(context.snippets ?? []) };
      if (target === "tags") {
        const tags = [...new Set(articles.flatMap((article) => article.tags))].sort();
        return { lines: [tags.map((tag) => `#${tag}`).join("  ")] };
      }
      const tag = target.replace(/^#/u, "");
      const tagged = articles.filter((article) => article.tags.includes(tag));
      if (tagged.length > 0) return { lines: tagged.map((article) => `  ${article.title}`) };
      return { lines: [fill(messages.noTag, { tag }), messages.lsUsage] };
    }
    case "open": {
      if (!rest) return { lines: [messages.openUsage] };
      const page = pages.find((item) => item.name === rest.toLowerCase().replace(/\/$/u, ""));
      if (page)
        return { lines: [fill(messages.opening, { title: page.href })], effect: { type: "navigate", href: page.href } };
      const article = findArticle(articles, rest);
      if (!article) {
        const slug = rest
          .toLowerCase()
          .replace(/^\/?snippets\//u, "")
          .replace(/\/$/u, "");
        const snippet = context.snippets?.find((item) => item.slug === slug);
        if (!snippet) return { lines: [fill(messages.noMatch, { query: rest })] };
        return {
          lines: [fill(messages.opening, { title: snippet.title })],
          effect: { type: "navigate", href: `/snippets/${snippet.slug}/` },
        };
      }
      return {
        lines: [fill(messages.opening, { title: article.title })],
        effect: { type: "navigate", href: `/${article.slug}/` },
      };
    }
    case "search":
      return {
        lines: [fill(messages.searching, { query: rest })],
        effect: { type: "navigate", href: rest ? `/search/?q=${encodeURIComponent(rest)}` : "/search/" },
      };
    case "theme":
      return { lines: [messages.theme], effect: { type: "theme" } };
    case "email":
      return {
        lines: [fill(messages.copied, { email: context.email })],
        effect: { type: "copy", value: context.email },
      };
    case "date": {
      const now = (context.now ?? (() => new Date()))();
      return {
        lines: [
          fill(messages.date, {
            date: new Intl.DateTimeFormat(context.locale ?? "en-GB", { dateStyle: "full", timeStyle: "short" }).format(
              now,
            ),
          }),
        ],
      };
    }
    case "echo":
      return { lines: [rest || messages.echoUsage] };
    case "clear":
      return { lines: [], effect: { type: "clear" } };
    case "exit":
      return { lines: [], effect: { type: "close" } };
  }
};

/** Tab completion for a command name, a page name, or an article or snippet slug. Returns the input unchanged when ambiguous. */
export const complete = (input: string, context: Pick<TerminalContext, "articles" | "pages" | "snippets">) => {
  const parts = input.split(" ");
  if (parts.length === 1) {
    const matches = COMMANDS.filter((command) => command.startsWith(input.toLowerCase()));
    return matches.length === 1 ? `${matches[0]} ` : input;
  }
  const [command, ...rest] = parts;
  const partial = rest.join(" ").toLowerCase();
  const candidates =
    command === "ls"
      ? ["writing", "snippets", "tags"]
      : [
          ...context.pages.map((page) => page.name),
          ...context.articles.map((article) => article.slug),
          ...(context.snippets ?? []).map((snippet) => snippet.slug),
        ];
  const matches = candidates.filter((candidate) => candidate.startsWith(partial));
  return matches.length === 1 ? `${command} ${matches[0]}` : input;
};
