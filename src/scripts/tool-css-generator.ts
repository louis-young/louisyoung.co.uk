import {
  clampValue,
  cssRule,
  defaultGradient,
  defaultLayers,
  gradientCss,
  maxLayers,
  maxStops,
  minStops,
  newLayer,
  shadowCss,
  type Gradient,
  type GradientStop,
  type Limited,
  type ShadowLayer,
} from "../lib/css-generator-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

type Item = ShadowLayer | GradientStop;

/** The box-shadow and gradient generator on /tools/css-generator/. */
export const initCssGenerator = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-css-gen]");
  if (!tool) return;
  const layersList = tool.querySelector<HTMLElement>("[data-layers]")!;
  const stopsList = tool.querySelector<HTMLElement>("[data-stops]")!;
  const noLayers = tool.querySelector<HTMLElement>("[data-no-layers]")!;
  const addLayer = tool.querySelector<HTMLButtonElement>("[data-add-layer]")!;
  const addStop = tool.querySelector<HTMLButtonElement>("[data-add-stop]")!;
  const angleField = tool.querySelector<HTMLElement>("[data-angle-field]")!;
  const angles = [...tool.querySelectorAll<HTMLInputElement>("[data-angle]")];
  const preview = tool.querySelector<HTMLElement>("[data-preview]")!;
  const output = tool.querySelector<HTMLElement>("[data-output]")!;
  const announce = tool.querySelector<HTMLElement>("[data-announce]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const layerTemplate = tool.querySelector<HTMLTemplateElement>("[data-layer-template]")!;
  const stopTemplate = tool.querySelector<HTMLTemplateElement>("[data-stop-template]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const layers: ShadowLayer[] = defaultLayers();
  const gradient: Gradient = defaultGradient();

  const update = () => {
    preview.style.background = gradientCss(gradient);
    preview.style.boxShadow = shadowCss(layers);
    output.textContent = cssRule(layers, gradient);
    angleField.hidden = gradient.type !== "linear";
    noLayers.hidden = layers.length > 0;
    addLayer.disabled = layers.length >= maxLayers;
    addStop.disabled = gradient.stops.length >= maxStops;
  };

  /** Builds one fieldset per item from a template, filling in its name and values. */
  const render = (list: HTMLElement, template: HTMLTemplateElement, items: Item[], nameKey: string) => {
    list.replaceChildren(
      ...items.map((item, i) => {
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const fieldset = fragment.firstElementChild as HTMLElement;
        for (const name of fieldset.querySelectorAll("[data-name]")) {
          name.textContent = fill(message(nameKey), { number: i + 1 });
        }
        for (const input of fieldset.querySelectorAll<HTMLInputElement>("[data-prop]")) {
          const value = item[input.dataset["prop"] as keyof Item] as string | number | boolean;
          if (input.type === "checkbox") input.checked = value === true;
          else input.value = String(value);
        }
        const remove = fieldset.querySelector<HTMLButtonElement>("[data-remove]")!;
        remove.disabled = list === stopsList && items.length <= minStops;
        return fieldset;
      }),
    );
  };

  const renderLayers = () => {
    render(layersList, layerTemplate, layers, "layer");
    update();
  };
  const renderStops = () => {
    render(stopsList, stopTemplate, gradient.stops, "stop");
    update();
  };

  /** Reads a control into its item, and mirrors a slider into its number box (and back). */
  const read = (input: HTMLInputElement, item: Item, settle: boolean) => {
    const prop = input.dataset["prop"] ?? "";
    const target = item as unknown as Record<string, string | number | boolean>;
    if (input.type === "checkbox") target[prop] = input.checked;
    else if (input.type === "color") target[prop] = input.value;
    else {
      const value = clampValue(prop as Limited, input.value);
      target[prop] = value;
      const pair = input.closest("[data-pair]");
      for (const twin of pair?.querySelectorAll<HTMLInputElement>(`[data-prop="${prop}"]`) ?? []) {
        // Leave a number box alone while it's being typed in, so “-” or “” can become “-5”.
        if (twin !== input || settle) twin.value = String(value);
      }
    }
    update();
  };

  const listen = (list: HTMLElement, items: () => Item[]) => {
    const handle = (event: Event, settle: boolean) => {
      const input = event.target as HTMLInputElement;
      const fieldset = input.closest<HTMLElement>("fieldset");
      if (!input.dataset["prop"] || !fieldset) return;
      const item = items()[[...list.children].indexOf(fieldset)];
      if (item) read(input, item, settle);
    };
    list.addEventListener("input", (event) => {
      handle(event, false);
    });
    list.addEventListener("change", (event) => {
      handle(event, true);
    });
  };
  listen(layersList, () => layers);
  listen(stopsList, () => gradient.stops);

  const removeFrom = (list: HTMLElement, items: Item[], nameKey: string, rerender: () => void, after: HTMLElement) => {
    list.addEventListener("click", (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove]");
      if (!button) return;
      const index = [...list.children].indexOf(button.closest("fieldset")!);
      items.splice(index, 1);
      rerender();
      announce.textContent = fill(message("removed"), { name: fill(message(nameKey), { number: index + 1 }) });
      after.focus();
    });
  };
  removeFrom(layersList, layers, "layer", renderLayers, addLayer);
  removeFrom(stopsList, gradient.stops, "stop", renderStops, addStop);

  const added = (list: HTMLElement, nameKey: string, count: number) => {
    announce.textContent = fill(message("added"), { name: fill(message(nameKey), { number: count }) });
    list.lastElementChild?.querySelector<HTMLInputElement>("input")?.focus();
  };
  addLayer.addEventListener("click", () => {
    layers.push(newLayer());
    renderLayers();
    added(layersList, "layer", layers.length);
  });
  addStop.addEventListener("click", () => {
    const last = gradient.stops.at(-1);
    gradient.stops.push({ colour: last?.colour ?? "#000000", position: 100 });
    renderStops();
    added(stopsList, "stop", gradient.stops.length);
  });

  for (const radio of tool.querySelectorAll<HTMLInputElement>('[name="css-gen-type"]')) {
    radio.addEventListener("change", () => {
      gradient.type = radio.value === "radial" ? "radial" : "linear";
      update();
    });
  }
  for (const angle of angles) {
    const sync = (settle: boolean) => {
      gradient.angle = clampValue("angle", angle.value);
      for (const twin of angles) if (twin !== angle || settle) twin.value = String(gradient.angle);
      update();
    };
    angle.addEventListener("input", () => {
      sync(false);
    });
    angle.addEventListener("change", () => {
      sync(true);
    });
  }
  copy.addEventListener("click", () => {
    void copyText(copy, output.textContent, message("copied"));
  });

  gradient.type =
    tool.querySelector<HTMLInputElement>('[name="css-gen-type"]:checked')?.value === "radial" ? "radial" : "linear";
  renderLayers();
  renderStops();
};
