import { nearestInDirection, type Direction } from "../lib/graph-layout";

const directions: Partial<Record<string, Direction>> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

/**
 * Enhances the /map/ figure. Every node is already a link and the list below the map holds the
 * same graph, so this only adds: highlighting a node's neighbours on hover and focus, a roving
 * tab stop with arrow-key movement between nodes, the kind filter and the focus-topic select.
 * Safe to call more than once.
 */
export const initContentMap = (root: ParentNode = document) => {
  const map = root.querySelector<HTMLElement>("[data-map]");
  if (!map || map.hasAttribute("data-ready")) return;
  map.setAttribute("data-ready", "");

  const svg = map.querySelector<SVGSVGElement>("[data-map-svg]")!;
  const nodes = [...map.querySelectorAll<SVGAElement>("[data-node]")];
  const edges = [...map.querySelectorAll<SVGPathElement>("[data-edge]")];
  const callout = map.querySelector<SVGTextElement>("[data-map-callout]")!;
  const inspector = map.querySelector<HTMLElement>("[data-map-inspector]")!;
  const status = map.querySelector<HTMLElement>("[data-map-status]")!;
  const select = map.querySelector<HTMLSelectElement>("[data-map-focus]")!;
  const filters = [...map.querySelectorAll<HTMLInputElement>("[data-map-filter]")];

  const byId = new Map(nodes.map((node) => [node.dataset["id"] ?? "", node]));
  const points = nodes.map((node) => ({ x: Number(node.dataset["x"]), y: Number(node.dataset["y"]) }));
  const adjacent = new Map<string, Set<string>>();
  for (const edge of edges) {
    const source = edge.dataset["source"] ?? "";
    const target = edge.dataset["target"] ?? "";
    adjacent.set(source, (adjacent.get(source) ?? new Set()).add(target));
    adjacent.set(target, (adjacent.get(target) ?? new Set()).add(source));
  }

  const isShown = (node: SVGAElement) => !map.hasAttribute(`data-hide-${node.dataset["filter"] ?? ""}`);

  /** The topic chosen in the select: the highlight falls back to it when nothing is hovered. */
  let pinned = "";
  let current = 0;

  const overview = inspector.querySelector<HTMLElement>("[data-inspector-overview]")!;
  const detail = inspector.querySelector<HTMLElement>("[data-inspector-detail]")!;
  /** The side panel: an overview until a node is active, then that node and its neighbours. */
  const renderInspector = (node: SVGAElement | undefined) => {
    overview.hidden = Boolean(node);
    detail.hidden = !node;
    if (!node) return;
    detail.querySelector("[data-inspector-kind]")!.textContent = node.dataset["kindName"] ?? "";
    detail.querySelector("[data-inspector-title]")!.textContent = node.dataset["label"] ?? "";
    detail.querySelector("[data-inspector-meta]")!.textContent = node.dataset["meta"] ?? "";
    detail.querySelector("[data-inspector-list]")!.replaceChildren(
      ...[...(adjacent.get(node.dataset["id"] ?? "") ?? [])]
        .map((id) => byId.get(id))
        .filter((neighbour): neighbour is SVGAElement => neighbour !== undefined && isShown(neighbour))
        .map((neighbour) => {
          const item = document.createElement("li");
          item.dataset["kind"] = neighbour.dataset["kind"] ?? "";
          item.textContent = neighbour.dataset["label"] ?? "";
          return item;
        }),
    );
  };

  const highlight = (id: string) => {
    const active = byId.get(id);
    const near = adjacent.get(id) ?? new Set<string>();
    map.toggleAttribute("data-highlighting", Boolean(active));
    for (const node of nodes) {
      const nodeId = node.dataset["id"] ?? "";
      node.classList.toggle("is-active", nodeId === id);
      node.classList.toggle("is-near", near.has(nodeId));
    }
    for (const edge of edges) {
      edge.classList.toggle("is-lit", edge.dataset["source"] === id || edge.dataset["target"] === id);
    }
    if (active && isShown(active)) {
      callout.textContent = active.dataset["calloutText"] ?? "";
      callout.setAttribute("x", active.dataset["lx"] ?? "0");
      callout.setAttribute("y", active.dataset["ly"] ?? "0");
      callout.setAttribute("text-anchor", active.dataset["anchor"] ?? "start");
      callout.toggleAttribute("data-hub", active.dataset["hub"] === "true");
    } else callout.textContent = "";
    renderInspector(active && isShown(active) ? active : undefined);
  };

  const reset = () => {
    highlight(pinned);
  };

  /** One node is in the Tab order at a time; the arrow keys move between them. */
  const setCurrent = (index: number, focus = false) => {
    nodes[current]?.setAttribute("tabindex", "-1");
    current = index;
    nodes[current]?.setAttribute("tabindex", "0");
    if (focus) nodes[current]?.focus();
  };
  const firstShown = () => Math.max(0, nodes.findIndex(isShown));
  // The keyboard hint only becomes true once this has run.
  svg.setAttribute("aria-describedby", "map-hint");
  for (const node of nodes) node.setAttribute("tabindex", "-1");
  setCurrent(0);

  svg.addEventListener("pointerover", (event) => {
    const node = (event.target as Element).closest<SVGAElement>("[data-node]");
    if (node) highlight(node.dataset["id"] ?? "");
  });
  svg.addEventListener("pointerleave", () => {
    const focused = document.activeElement?.closest<SVGAElement>("[data-node]");
    if (focused && svg.contains(focused)) highlight(focused.dataset["id"] ?? "");
    else reset();
  });
  svg.addEventListener("focusin", (event) => {
    const node = (event.target as Element).closest<SVGAElement>("[data-node]");
    if (!node) return;
    setCurrent(nodes.indexOf(node));
    highlight(node.dataset["id"] ?? "");
  });
  svg.addEventListener("focusout", (event) => {
    if (!svg.contains(event.relatedTarget as Node | null)) reset();
  });
  svg.addEventListener("keydown", (event) => {
    const direction = directions[event.key];
    const allowed = (index: number) => isShown(nodes[index]!);
    let next: number | undefined;
    if (direction) next = nearestInDirection(points, current, direction, allowed);
    else if (event.key === "Home") next = firstShown();
    else if (event.key === "End") next = nodes.findLastIndex(isShown);
    else if (event.key === "Escape") {
      pinned = "";
      select.value = "";
      reset();
      event.preventDefault();
      return;
    }
    if (next === undefined || next < 0) return;
    event.preventDefault();
    setCurrent(next, true);
  });

  const total = nodes.length;
  const applyFilters = () => {
    for (const input of filters) map.toggleAttribute(`data-hide-${input.value}`, !input.checked);
    const shown = nodes.filter(isShown).length;
    const text = (status.dataset["template"] ?? "").replace("{shown}", String(shown)).replace("{total}", String(total));
    if (status.textContent !== text) status.textContent = text;
    // Topics hidden: there is nothing to focus on.
    const topicsShown = filters.find((input) => input.value === "topic")?.checked !== false;
    select.disabled = !topicsShown;
    if (!topicsShown) {
      select.value = "";
      pinned = "";
    }
    if (!isShown(nodes[current]!)) setCurrent(firstShown());
    reset();
  };
  for (const input of filters) input.addEventListener("change", applyFilters);

  select.addEventListener("change", () => {
    pinned = select.value;
    const index = nodes.findIndex((node) => node.dataset["id"] === pinned);
    // The next Tab into the map lands on the chosen topic.
    if (index >= 0) setCurrent(index);
    map.toggleAttribute("data-pinned", Boolean(pinned));
    reset();
  });

  applyFilters();
  // Someone may already be pointing at or focused on a node by the time this loads.
  const focused = document.activeElement?.closest<SVGAElement>("[data-node]");
  if (focused && svg.contains(focused)) {
    setCurrent(nodes.indexOf(focused));
    highlight(focused.dataset["id"] ?? "");
  }
};
