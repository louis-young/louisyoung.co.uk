/**
 * A deterministic force-directed layout for the content map, computed at build time. A seeded
 * PRNG places the starting points and the simulation runs a fixed number of steps, so the same
 * graph always produces exactly the same picture (and the same HTML).
 */
import { isHub, type ContentGraph, type MapKind, type MapNode } from "./content-map";

/** mulberry32: a tiny, well-distributed 32-bit PRNG. Returns floats in [0, 1). */
export const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
};

/** Node radius in viewBox units: hubs grow with the square root of their degree, items barely. */
export const radiusFor = (kind: MapKind, degree: number) => {
  const root = Math.sqrt(Math.max(degree, 1));
  if (kind === "topic") return round(5 + 3.2 * root);
  if (kind === "category") return round(6 + 2.6 * root);
  return round(4 + 1.1 * root);
};

/** Hub label size in viewBox units: busier hubs read a little larger. */
export const labelSizeFor = (degree: number) => round(Math.min(18, 12.5 + Math.sqrt(degree) * 1.1));

/** Item labels only appear for the node under focus, at one size. */
const ITEM_LABEL_SIZE = 15;

export interface Label {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  size: number;
}

interface PlacedNode extends MapNode {
  x: number;
  y: number;
  r: number;
  /** Where the node's title is drawn. */
  caption: Label;
}

export interface Layout {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: { source: string; target: string; path: string }[];
}

export interface LayoutOptions {
  width?: number;
  height?: number;
  seed?: number;
  iterations?: number;
  padding?: number;
}

const round = (value: number) => Math.round(value * 10) / 10;

interface Body {
  x: number;
  y: number;
  r: number;
  hub: boolean;
}

/**
 * Approximate label box, with a little breathing room. Geist's average advance is a little over
 * half the font size; category labels are set in uppercase Geist Mono, which runs wider.
 */
export const labelBox = (text: string, label: Label, advance = 0.56) => {
  const width = text.length * label.size * advance;
  const left = label.anchor === "start" ? label.x : label.anchor === "end" ? label.x - width : label.x - width / 2;
  const room = 3;
  return {
    left: left - room,
    right: left + width + room,
    top: label.y - label.size * 0.8 - room,
    bottom: label.y + label.size * 0.25 + room,
  };
};

const advanceFor = (kind: MapKind) => (kind === "category" ? 0.68 : 0.56);

type Box = ReturnType<typeof labelBox>;

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

const circleBox = (node: { x: number; y: number; r: number }): Box => ({
  left: node.x - node.r,
  right: node.x + node.r,
  top: node.y - node.r,
  bottom: node.y + node.r,
});

/** The text a hub shows: topics carry a hash so they read as tags. */
export const hubText = (node: Pick<MapNode, "kind" | "label">) =>
  node.kind === "topic" ? `#${node.label}` : node.label;

/**
 * Places hub labels greedily, most connected first: below, above, right or left of the node,
 * whichever overlaps the labels already placed, the nodes and the edges of the frame least.
 */
const placeHubLabels = (nodes: PlacedNode[], width: number, height: number) => {
  const placed: Box[] = [];
  const obstacles = nodes.map(circleBox);
  const hubs = nodes.filter((node) => isHub(node.kind)).sort((a, b) => b.degree - a.degree);
  for (const node of hubs) {
    const size = labelSizeFor(node.degree);
    const gap = 5;
    const candidates: Label[] = [
      { x: node.x, y: node.y + node.r + gap + size * 0.8, anchor: "middle", size },
      { x: node.x, y: node.y - node.r - gap - size * 0.25, anchor: "middle", size },
      { x: node.x + node.r + gap, y: node.y + size * 0.3, anchor: "start", size },
      { x: node.x - node.r - gap, y: node.y + size * 0.3, anchor: "end", size },
    ];
    const text = hubText(node);
    const cost = (label: Label) => {
      const box = labelBox(text, label, advanceFor(node.kind));
      const outside =
        Math.max(0, -box.left) +
        Math.max(0, box.right - width) +
        Math.max(0, -box.top) +
        Math.max(0, box.bottom - height);
      return (
        outside * 1000 +
        placed.reduce((sum, other) => sum + overlap(box, other) * 4, 0) +
        obstacles.reduce((sum, other) => sum + overlap(box, other), 0)
      );
    };
    let best = candidates[0]!;
    let bestCost = cost(best);
    for (const candidate of candidates.slice(1)) {
      const value = cost(candidate);
      if (value < bestCost - 0.01) {
        best = candidate;
        bestCost = value;
      }
    }
    node.caption = { ...best, x: round(best.x), y: round(best.y) };
    placed.push(labelBox(text, node.caption, advanceFor(node.kind)));
  }
};

/** Item labels sit beside the node, on whichever side has more room. */
const itemLabel = (node: { x: number; y: number; r: number }, width: number): Label => {
  const right = node.x < width * 0.62;
  return {
    x: round(node.x + (right ? 1 : -1) * (node.r + 7)),
    y: round(node.y + ITEM_LABEL_SIZE * 0.32),
    anchor: right ? "start" : "end",
    size: ITEM_LABEL_SIZE,
  };
};

/**
 * Pushes overlapping nodes apart until every pair is at least `gap` apart (or the passes run
 * out), keeping them inside the padded frame. Runs after fitting, in final units.
 */
const separate = (bodies: Body[], frame: { width: number; height: number; padding: number }, gap = 10) => {
  for (let pass = 0; pass < 80; pass += 1) {
    let moved = false;
    for (let i = 0; i < bodies.length; i += 1) {
      const a = bodies[i]!;
      for (let j = i + 1; j < bodies.length; j += 1) {
        const b = bodies[j]!;
        const x = b.x - a.x;
        const y = b.y - a.y;
        const distance = Math.hypot(x, y);
        const minimum = a.r + b.r + gap;
        if (distance >= minimum) continue;
        moved = true;
        // Coincident points split along a fixed diagonal, so the result stays deterministic.
        const ux = distance > 0.001 ? x / distance : Math.SQRT1_2;
        const uy = distance > 0.001 ? y / distance : Math.SQRT1_2;
        const push = (minimum - distance) / 2;
        // Hubs are anchors: items move out of their way.
        const share = a.hub === b.hub ? 0.5 : a.hub ? 0 : 1;
        a.x -= ux * push * 2 * share;
        a.y -= uy * push * 2 * share;
        b.x += ux * push * 2 * (1 - share);
        b.y += uy * push * 2 * (1 - share);
      }
    }
    for (const body of bodies) {
      body.x = Math.min(Math.max(body.x, frame.padding), frame.width - frame.padding);
      body.y = Math.min(Math.max(body.y, frame.padding), frame.height - frame.padding);
    }
    if (!moved) return;
  }
};

/** A gentle quadratic curve from a to b, always bowing the same way, so bundles read as flow. */
export const edgePath = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const bend = 0.12;
  const cx = mx - (b.y - a.y) * bend;
  const cy = my + (b.x - a.x) * bend;
  return `M${round(a.x)} ${round(a.y)}Q${round(cx)} ${round(cy)} ${round(b.x)} ${round(b.y)}`;
};

/**
 * Lays the graph out in a `width` × `height` box. Hubs start on a ring and items start near the
 * hubs they belong to; then repulsion, edge springs, a weak pull to the centre and collision
 * keep everything apart for `iterations` steps as the temperature cools. Finally the picture is
 * fitted to the box and hub labels are placed.
 */
export const layoutGraph = (graph: ContentGraph, options: LayoutOptions = {}): Layout => {
  const { width = 1000, height = 640, seed = 20_261_009, iterations = 360, padding = 48 } = options;
  const random = seededRandom(seed);
  const count = graph.nodes.length;
  const index = new Map(graph.nodes.map((node, position) => [node.id, position]));
  const links = graph.edges
    .map((edge) => [index.get(edge.source), index.get(edge.target)] as const)
    .filter((pair): pair is readonly [number, number] => pair[0] !== undefined && pair[1] !== undefined);

  const cx = width / 2;
  const cy = height / 2;
  const hubs = graph.nodes.filter((node) => isHub(node.kind));
  const bodies: Body[] = graph.nodes.map((node) => ({
    x: cx,
    y: cy,
    r: radiusFor(node.kind, node.degree),
    hub: isHub(node.kind),
  }));
  // Hubs: evenly round an ellipse, busiest first, so the biggest clusters spread out.
  hubs.forEach((hub, position) => {
    const angle = (position / Math.max(hubs.length, 1)) * Math.PI * 2 + random() * 0.2;
    const body = bodies[index.get(hub.id)!]!;
    body.x = cx + Math.cos(angle) * width * 0.3;
    body.y = cy + Math.sin(angle) * height * 0.3;
  });
  // Items: at the centroid of their hubs, nudged randomly so no two start in the same place.
  const hubsOf = new Map<number, number[]>();
  for (const [source, target] of links) hubsOf.set(source, [...(hubsOf.get(source) ?? []), target]);
  bodies.forEach((body, position) => {
    if (body.hub) return;
    const own = hubsOf.get(position) ?? [];
    const anchorX = own.length ? own.reduce((sum, hub) => sum + bodies[hub]!.x, 0) / own.length : cx;
    const anchorY = own.length ? own.reduce((sum, hub) => sum + bodies[hub]!.y, 0) / own.length : cy;
    const angle = random() * Math.PI * 2;
    const distance = 30 + random() * 50;
    body.x = anchorX + Math.cos(angle) * distance;
    body.y = anchorY + Math.sin(angle) * distance;
  });

  const k = Math.sqrt((width * height) / Math.max(count, 1));
  const reach = k * 2.5;
  const rest = k * 0.35;
  const start = width / 10;
  for (let step = 0; step < iterations; step += 1) {
    const temperature = start * (1 - step / iterations) + 0.5;
    const dx = new Float64Array(count);
    const dy = new Float64Array(count);
    for (let i = 0; i < count; i += 1) {
      const a = bodies[i]!;
      for (let j = i + 1; j < count; j += 1) {
        const b = bodies[j]!;
        const x = a.x - b.x;
        const y = a.y - b.y;
        const distance = Math.max(Math.hypot(x, y), 0.01);
        // Repulsion fades out beyond `reach`, so separate clusters drift back in under gravity
        // instead of being flung to the edges. Hubs push each other harder.
        let force = distance < reach ? ((a.hub && b.hub ? 1.3 : 0.6) * k * k) / distance - (k * k) / reach / 2 : 0;
        const minimum = a.r + b.r + 16;
        if (distance < minimum) force += (minimum - distance) * 2;
        if (force <= 0) continue;
        dx[i]! += (x / distance) * force;
        dy[i]! += (y / distance) * force;
        dx[j]! -= (x / distance) * force;
        dy[j]! -= (y / distance) * force;
      }
    }
    // Springs with a rest length pull each item towards its hubs; hubs give a little.
    for (const [source, target] of links) {
      const a = bodies[source]!;
      const b = bodies[target]!;
      const x = a.x - b.x;
      const y = a.y - b.y;
      const distance = Math.max(Math.hypot(x, y), 0.01);
      const force = (distance - rest - a.r - b.r) * 0.6;
      dx[source]! -= (x / distance) * force;
      dy[source]! -= (y / distance) * force;
      dx[target]! += (x / distance) * force * 0.3;
      dy[target]! += (y / distance) * force * 0.3;
    }
    for (let i = 0; i < count; i += 1) {
      const body = bodies[i]!;
      // Gravity, weaker across than down, so the graph fills a landscape frame.
      dx[i]! -= (body.x - cx) * 0.12 * (height / width);
      dy[i]! -= (body.y - cy) * 0.12;
      const length = Math.max(Math.hypot(dx[i]!, dy[i]!), 0.01);
      const move = Math.min(length, temperature);
      body.x += (dx[i]! / length) * move;
      body.y += (dy[i]! / length) * move;
    }
  }

  // Fit the picture to the frame, keeping its proportions.
  const left = Math.min(...bodies.map((body) => body.x - body.r));
  const right = Math.max(...bodies.map((body) => body.x + body.r));
  const top = Math.min(...bodies.map((body) => body.y - body.r));
  const bottom = Math.max(...bodies.map((body) => body.y + body.r));
  const scale = Math.min((width - padding * 2) / (right - left || 1), (height - padding * 2) / (bottom - top || 1));
  const offsetX = (width - (right - left) * scale) / 2;
  const offsetY = (height - (bottom - top) * scale) / 2;

  for (const body of bodies) {
    body.x = offsetX + (body.x - left) * scale;
    body.y = offsetY + (body.y - top) * scale;
  }
  separate(bodies, { width, height, padding });

  const nodes: PlacedNode[] = graph.nodes.map((node, position) => {
    const body = bodies[position]!;
    const placed = { ...node, x: round(body.x), y: round(body.y), r: body.r };
    return { ...placed, caption: itemLabel(placed, width) };
  });
  placeHubLabels(nodes, width, height);

  const byId = new Map(nodes.map((node) => [node.id, node]));
  const edges = graph.edges.flatMap((edge) => {
    const a = byId.get(edge.source);
    const b = byId.get(edge.target);
    return a && b ? [{ ...edge, path: edgePath(a, b) }] : [];
  });
  return { width, height, nodes, edges };
};

/** The path for each node's shape, centred on 0,0, so the kinds differ by more than colour. */
export const shapePath = (kind: MapKind, r: number) => {
  const p = (value: number) => round(value);
  switch (kind) {
    case "article": {
      // A rounded square.
      const s = r * 0.9;
      const c = r * 0.3;
      return `M${p(-s + c)} ${p(-s)}H${p(s - c)}Q${p(s)} ${p(-s)} ${p(s)} ${p(-s + c)}V${p(s - c)}Q${p(s)} ${p(s)} ${p(s - c)} ${p(s)}H${p(-s + c)}Q${p(-s)} ${p(s)} ${p(-s)} ${p(s - c)}V${p(-s + c)}Q${p(-s)} ${p(-s)} ${p(-s + c)} ${p(-s)}Z`;
    }
    case "snippet": {
      const s = r * 1.2;
      return `M0 ${p(-s)}L${p(s)} 0L0 ${p(s)}L${p(-s)} 0Z`;
    }
    case "tool":
    case "category": {
      const points = Array.from({ length: 6 }, (_, corner) => {
        const angle = (Math.PI / 3) * corner + Math.PI / 6;
        return `${p(Math.cos(angle) * r * 1.08)} ${p(Math.sin(angle) * r * 1.08)}`;
      });
      return `M${points.join("L")}Z`;
    }
    case "topic":
      return `M${p(-r)} 0A${p(r)} ${p(r)} 0 1 0 ${p(r)} 0A${p(r)} ${p(r)} 0 1 0 ${p(-r)} 0Z`;
  }
};

export type Direction = "up" | "down" | "left" | "right";

const vectors: Record<Direction, readonly [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/**
 * Spatial keyboard navigation: the nearest point in a direction, favouring points straight
 * ahead over ones off to the side. Returns `from` when nothing lies that way.
 */
export const nearestInDirection = (
  points: readonly { x: number; y: number }[],
  from: number,
  direction: Direction,
  allowed: (index: number) => boolean = () => true,
) => {
  const origin = points[from];
  if (!origin) return from;
  const [vx, vy] = vectors[direction];
  // First look within a cone either side of the direction; only if that's empty, anywhere ahead.
  const search = (cone: number) => {
    let best = from;
    let bestScore = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      if (index === from || !allowed(index)) return;
      const x = point.x - origin.x;
      const y = point.y - origin.y;
      const ahead = x * vx + y * vy;
      const aside = Math.abs(x * vy - y * vx);
      if (ahead <= 0.5 || aside > ahead * cone) return;
      const score = ahead + aside * 2.5;
      if (score < bestScore) {
        bestScore = score;
        best = index;
      }
    });
    return best;
  };
  const best = search(2);
  return best === from ? search(Number.POSITIVE_INFINITY) : best;
};
