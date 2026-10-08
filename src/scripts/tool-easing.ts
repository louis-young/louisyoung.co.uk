import {
  clampBezier,
  clampPoint,
  curvePath,
  formatBezier,
  fromGraph,
  graph,
  presetFor,
  presets,
  toGraph,
  type Bezier,
} from "../lib/easing-tool";
import { copyText } from "./tool-copy";

const keySteps: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

/** The cubic-bezier() editor on /tools/easing/. */
export const initEasing = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-easing]");
  if (!tool) return;
  const plot = tool.querySelector<HTMLElement>("[data-plot]")!;
  const curvePathElement = tool.querySelector("[data-curve]")!;
  const output = tool.querySelector<HTMLOutputElement>("[data-output]")!;
  const tracks = tool.querySelector<HTMLElement>("[data-tracks]")!;
  const input = (name: string) => tool.querySelector<HTMLInputElement>(`[name="${name}"]`)!;
  const names = ["x1", "y1", "x2", "y2"] as const;
  const valueText = tool.dataset["valueText"] ?? "{x}, {y}";
  let curve = clampBezier(names.map((name) => Number(input(name).value)) as Bezier);

  const render = (next: Bezier, syncInputs: boolean) => {
    curve = clampBezier(next);
    const css = formatBezier(curve);
    curvePathElement.setAttribute("d", curvePath(curve));
    output.value = css;
    tracks.style.setProperty("--curve", css);
    const ends = [toGraph(0, 0), toGraph(1, 1)];
    for (const index of [1, 2] as const) {
      const [x, y] = index === 1 ? [curve[0], curve[1]] : [curve[2], curve[3]];
      const [gx, gy] = toGraph(x, y);
      const handle = tool.querySelector<HTMLElement>(`[data-handle="${index}"]`)!;
      handle.style.setProperty("left", `${(gx / graph.width) * 100}%`);
      handle.style.setProperty("top", `${(gy / graph.height) * 100}%`);
      handle.setAttribute("aria-valuenow", String(x));
      handle.setAttribute("aria-valuetext", valueText.replace("{x}", String(x)).replace("{y}", String(y)));
      const arm = tool.querySelector(`[data-arm="${index}"]`)!;
      const [fromX, fromY] = ends[index - 1]!;
      arm.setAttribute("x1", String(fromX));
      arm.setAttribute("y1", String(fromY));
      arm.setAttribute("x2", String(gx));
      arm.setAttribute("y2", String(gy));
    }
    const active = presetFor(curve);
    for (const button of tool.querySelectorAll<HTMLElement>("[data-preset]")) {
      button.setAttribute("aria-pressed", String(button.dataset["preset"] === active));
    }
    if (syncInputs) names.forEach((name, index) => (input(name).value = String(curve[index])));
  };

  const movePoint = (index: 1 | 2, x: number, y: number) => {
    const point = clampPoint(x, y);
    render(index === 1 ? [...point, curve[2], curve[3]] : [curve[0], curve[1], ...point], true);
  };

  for (const name of names) {
    input(name).addEventListener("input", () => {
      render(names.map((each) => Number(input(each).value)) as Bezier, false);
    });
    input(name).addEventListener("change", () => {
      render(curve, true);
    });
  }

  for (const handle of tool.querySelectorAll<HTMLElement>("[data-handle]")) {
    const index = handle.dataset["handle"] === "2" ? 2 : 1;
    const current = (): [number, number] => (index === 1 ? [curve[0], curve[1]] : [curve[2], curve[3]]);
    handle.addEventListener("keydown", (event) => {
      const step = keySteps[event.key];
      if (!step) return;
      event.preventDefault();
      const size = event.shiftKey ? 0.1 : 0.01;
      const [x, y] = current();
      movePoint(index, x + step[0] * size, y + step[1] * size);
    });
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      handle.focus();
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const box = plot.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      const [x, y] = fromGraph(
        ((event.clientX - box.left) / box.width) * graph.width,
        ((event.clientY - box.top) / box.height) * graph.height,
      );
      movePoint(index, x, y);
    });
  }

  for (const button of tool.querySelectorAll<HTMLElement>("[data-preset]")) {
    button.addEventListener("click", () => {
      const preset = presets.find((each) => each.name === button.dataset["preset"]);
      if (preset) render(preset.curve, true);
    });
  }

  tool.querySelector<HTMLElement>("[data-copy]")!.addEventListener("click", (event) => {
    void copyText(event.currentTarget as HTMLElement, output.value, tool.dataset["copied"] ?? "");
  });

  render(curve, false);
};
