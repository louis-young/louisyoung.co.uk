import { formatSpecificity, type LineError, rankSelectors, type Weight } from "../lib/specificity-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const capitalised = (code: string) => code.charAt(0).toUpperCase() + code.slice(1);

/** The specificity calculator on /tools/specificity/. */
export const initSpecificity = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-specificity]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const errorList = tool.querySelector<HTMLElement>("[data-errors]")!;
  const list = tool.querySelector<HTMLElement>("[data-list]")!;
  const template = tool.querySelector<HTMLTemplateElement>("[data-item-template]")!;
  const message = (key: string) => tool.dataset[key] ?? "";

  const describeError = (error: LineError) => {
    const reason =
      error.code === "unexpected" && error.text === ""
        ? message("errorEnd")
        : fill(message(`error${capitalised(error.code)}`), { text: error.text });
    return fill(message("error"), { line: error.line, column: error.column, message: reason });
  };

  const update = () => {
    const { ranked, errors, tie } = rankSelectors(input.value);
    const [winner, runnerUp] = ranked;

    errorList.replaceChildren(
      ...errors.map((error) => {
        const item = document.createElement("li");
        item.textContent = describeError(error);
        return item;
      }),
    );
    errorList.hidden = errors.length === 0;

    const sentences: string[] = [];
    if (winner) {
      const values = {
        count: ranked.length,
        selector: winner.selector,
        specificity: formatSpecificity(winner.specificity),
      };
      sentences.push(fill(message(ranked.length === 1 ? "countOne" : "countOther"), values));
      if (tie && runnerUp) sentences.push(fill(message("tie"), { other: runnerUp.selector }));
    } else if (errors.length === 0) sentences.push(message("empty"));
    if (errors.length > 0) {
      sentences.push(fill(message(errors.length === 1 ? "invalidOne" : "invalidOther"), { count: errors.length }));
    }
    status.textContent = sentences.join(" ");
    status.toggleAttribute("data-invalid", errors.length > 0);

    list.replaceChildren(
      ...ranked.map((result, index) => {
        const item = (template.content.cloneNode(true) as DocumentFragment).firstElementChild as HTMLElement;
        item.querySelector("[data-rank]")!.textContent = String(index + 1);
        item.querySelector("[data-selector]")!.replaceChildren(
          ...result.parts.map((part) => {
            if (part.kind === "plain") return document.createTextNode(part.text);
            const span = document.createElement("span");
            span.dataset["kind"] = part.kind;
            span.textContent = part.text;
            return span;
          }),
        );
        const winning = index === 0 && ranked.length > 1;
        item.toggleAttribute("data-winning", winning);
        item.querySelector<HTMLElement>("[data-winner]")!.hidden = !winning;
        const weights: Weight[] = ["id", "class", "type"];
        for (const [i, weight] of weights.entries()) {
          item.querySelector(`.spec__score [data-weight="${weight}"] [data-score]`)!.textContent = String(
            result.specificity[i],
          );
          const items = result.contributions.filter((contribution) => contribution.weight === weight);
          const cell = item.querySelector(`.spec__breakdown [data-weight="${weight}"] [data-items]`)!;
          if (items.length === 0) {
            cell.textContent = message("none");
            continue;
          }
          cell.replaceChildren(
            ...items.flatMap((contribution, n) => {
              const code = document.createElement("code");
              code.textContent = contribution.text;
              const nodes: Node[] = n > 0 ? [document.createTextNode(", "), code] : [code];
              if (contribution.via) {
                const via = document.createElement("span");
                via.className = "spec__via";
                via.textContent = ` ${fill(message("via"), { name: contribution.via })}`;
                nodes.push(via);
              }
              return nodes;
            }),
          );
        }
        item.querySelector("[data-line]")!.textContent = fill(message("lineLabel"), { line: result.line });
        return item;
      }),
    );
  };

  input.addEventListener("input", update);
  update();
};
