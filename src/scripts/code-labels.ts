/**
 * Expressive Code turns overflowing code blocks into focusable `role="region"` elements so
 * keyboard users can scroll them. Regions need distinct names, so number each one using the
 * `data-code-label` template ("Code sample {index}") on the element that contains them.
 */
export const labelCodeRegions = (root: ParentNode = document) => {
  const body = root.querySelector<HTMLElement>("[data-code-label]");
  if (!body) return undefined;
  const template = body.dataset["codeLabel"] ?? "";
  const blocks = [...body.querySelectorAll<HTMLPreElement>(".expressive-code pre")];
  const label = (pre: HTMLPreElement) => {
    if (pre.getAttribute("role") === "region") {
      pre.setAttribute("aria-label", template.replace("{index}", String(blocks.indexOf(pre) + 1)));
    } else pre.removeAttribute("aria-label");
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) label(record.target as HTMLPreElement);
  });
  for (const pre of blocks) {
    label(pre);
    observer.observe(pre, { attributes: true, attributeFilter: ["role"] });
  }
  return observer;
};
