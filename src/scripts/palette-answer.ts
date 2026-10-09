import type { PaletteIndex } from "../lib/palette";
import { fill, quickAnswer, uuidFromBytes, type QuickAnswer } from "../lib/quick-answers";
import type { PaletteOption } from "./palette";
// Through share-link rather than lib/share-state, so tool pages keep share-state in the share-link
// chunk they already load instead of in a chunk of its own.
import { sharePath } from "./share-link";

/**
 * Quick answers for the ⌘K palette, loaded only once a query looks like it might have one. Builds
 * the answer option (Enter copies it) and, when a tool works it out in full, an option that opens
 * that tool with the input prefilled.
 */

const randomUuid = () => {
  // randomUUID only exists in secure contexts; getRandomValues works everywhere.
  if (typeof (crypto as Partial<Crypto>).randomUUID === "function") return crypto.randomUUID();
  return uuidFromBytes(crypto.getRandomValues(new Uint8Array(16)));
};

const span = (className: string, text?: string) => {
  const element = document.createElement("span");
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

// Answers are worked out when the query changes, not as the selection moves, so a UUID stays put
// while someone arrows to it and copies it.
const answerFor = (query: string, index: PaletteIndex) =>
  quickAnswer(query, index.answers, {
    now: new Date(),
    timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    uuid: randomUuid,
  });

const answerElement = (answer: QuickAnswer, index: PaletteIndex) => {
  const { text } = index;
  const element = document.createElement("div");
  element.setAttribute("role", "option");
  element.id = "palette-answer";
  element.className = "palette__option palette__answer";
  element.dataset["kind"] = answer.kind;
  element.setAttribute("aria-selected", "false");
  element.setAttribute("aria-label", fill(text.answerName, { value: answer.value }));

  const hint = span("palette__hint");
  hint.setAttribute("aria-hidden", "true");
  const key = document.createElement("kbd");
  key.textContent = "↵";
  hint.append(key, span("palette__hint-text", text.answerCopy));

  const main = span("palette__answer-main");
  const description: string[] = [];
  if (answer.swatch) {
    const swatch = span("palette__swatch");
    const alternative = fill(text.answerSwatch, { colour: answer.swatch });
    swatch.setAttribute("role", "img");
    swatch.setAttribute("aria-label", alternative);
    // A CSSOM write rather than a style attribute: the colour is validated hex either way.
    swatch.style.backgroundColor = answer.swatch;
    main.append(swatch);
    description.push(`${alternative}.`);
  }
  main.append(span("palette__answer-value", answer.value));

  const details = span("palette__answer-details");
  details.setAttribute("aria-hidden", "true");
  for (const { label, value } of answer.details) {
    const item = span("");
    item.append(span("label", label), span("", value));
    details.append(item);
    description.push(`${label}: ${value}.`);
  }
  element.append(span("palette__answer-label label", text.answer), hint, main);
  if (answer.details.length > 0) element.append(details);
  if (description.length > 0) {
    // Read after the name, as the option's description; the visible details are hidden from it.
    const described = span("visually-hidden", description.join(" "));
    described.id = "palette-answer-description";
    element.append(described);
    element.setAttribute("aria-describedby", described.id);
  }
  return { element, hintText: hint.lastElementChild as HTMLElement };
};

/**
 * The options to put above the matching pages for `query`: the answer and, if there is one, a
 * way into its tool. Returns none for anything that isn't clearly a quick-answer query.
 */
export const answerOptions = (
  query: string,
  index: PaletteIndex,
  pages: readonly PaletteOption[],
  announce: (message: string) => void,
): PaletteOption[] => {
  const answer = answerFor(query, index);
  if (!answer) return [];
  const { text } = index;
  const { element, hintText } = answerElement(answer, index);
  const path = answer.tool && `/tools/${answer.tool.slug}/`;
  const href = path && answer.tool?.state ? sharePath(path, answer.tool.state) : path;
  const tool = path && pages.find((page) => page.href === path);
  const toolTitle = tool && fill(text.answerOpen, { tool: tool.title });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(answer.copy);
      hintText.textContent = "✓";
      announce(fill(text.answerCopied, { value: answer.copy }));
    } catch {
      announce(text.answerCopyFailed);
    }
  };
  const answerOption: PaletteOption = {
    element,
    title: answer.value,
    keywords: "",
    run: () => {
      void copy();
    },
  };
  if (!href || !toolTitle) return [answerOption];

  const link = document.createElement("div");
  link.setAttribute("role", "option");
  link.id = "palette-answer-tool";
  link.className = "palette__option";
  link.setAttribute("aria-selected", "false");
  const arrow = span("palette__hint", "↗");
  arrow.setAttribute("aria-hidden", "true");
  link.append(span("palette__title", toolTitle), arrow);
  const toolOption: PaletteOption = { element: link, title: toolTitle, keywords: "", href };
  // ⌘/Ctrl+Enter on the answer opens the tool too.
  answerOption.alternate = toolOption;
  return [answerOption, toolOption];
};
