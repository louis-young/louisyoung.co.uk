import {
  bitsNeeded,
  bitsOf,
  byteOrder,
  fits,
  formatInteger,
  groupDigits,
  isBase,
  narrowestWidth,
  parseInteger,
  toggleBit,
  type Width,
  widthViews,
} from "../lib/base-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** The number base converter on /tools/base/: every base, the bits and the bytes kept in step. */
export const initBase = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-base-tool]");
  if (!tool) return;
  const fields = [...tool.querySelectorAll<HTMLInputElement>("[data-value]")];
  const radix = tool.querySelector<HTMLInputElement>("[data-radix]")!;
  const radixError = tool.querySelector<HTMLElement>("[data-radix-error]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const widthInputs = [...tool.querySelectorAll<HTMLInputElement>("[data-width]")];
  const signedInput = tool.querySelector<HTMLInputElement>("[data-signed]")!;
  const grid = tool.querySelector<HTMLElement>("[data-grid]")!;
  const gridNote = tool.querySelector<HTMLElement>("[data-grid-note]")!;
  const big = tool.querySelector<HTMLElement>("[data-big]")!;
  const little = tool.querySelector<HTMLElement>("[data-little]")!;
  const scroll = tool.querySelector<HTMLElement>("[data-scroll]")!;
  const message = (key: string) => tool.dataset[key] ?? "";

  const baseOf = (field: HTMLInputElement) =>
    field.dataset["value"] === "custom" ? Number(radix.value) : Number(field.dataset["value"]);
  const errorOf = (field: HTMLInputElement) => tool.querySelector<HTMLElement>(`#${field.id}-error`)!;

  let value = parseInteger(fields.find((field) => field.dataset["value"] === "10")!.value, 10) ?? 0n;
  let width: Width | undefined = Number(widthInputs.find((input) => input.checked)?.value ?? 16) as Width;
  let signed = signedInput.checked;
  let gridWidth: Width | undefined;

  const setError = (field: HTMLInputElement, error: HTMLElement, text: string) => {
    field.setAttribute("aria-invalid", String(text !== ""));
    error.textContent = text;
    error.hidden = text === "";
  };

  /** Picks a width (and whether it is signed) that holds the value, keeping the current one if it can. */
  const fitWidth = () => {
    if (value < 0n) signed = true;
    if (width !== undefined && fits(value, width, signed)) return;
    width = narrowestWidth(value, signed);
    if (width === undefined && signed && value >= 0n) {
      signed = false;
      width = narrowestWidth(value, false);
    }
  };

  const buildGrid = (bits: Width) => {
    gridWidth = bits;
    const bytes = Array.from({ length: bits / 8 }, (_, byte) => {
      const high = bits - 1 - byte * 8;
      const fieldset = document.createElement("fieldset");
      fieldset.className = "base__byte";
      const legend = document.createElement("legend");
      legend.textContent = fill(message("byteLabel"), { high, low: high - 7 });
      const row = document.createElement("div");
      row.className = "base__bits";
      for (let index = high; index > high - 8; index -= 1) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "base__bit";
        button.dataset["bit"] = String(index);
        const digit = document.createElement("span");
        digit.setAttribute("aria-hidden", "true");
        const name = document.createElement("span");
        name.className = "visually-hidden";
        name.textContent = fill(message("bitLabel"), { index });
        button.append(digit, name);
        row.append(button);
      }
      fieldset.append(legend, row);
      return fieldset;
    });
    grid.replaceChildren(...bytes);
  };

  const renderGrid = (tooWide: string) => {
    gridNote.hidden = width !== undefined;
    if (width === undefined) {
      gridWidth = undefined;
      grid.replaceChildren();
      gridNote.textContent = tooWide;
      return;
    }
    if (gridWidth !== width) buildGrid(width);
    const bits = bitsOf(value, width);
    for (const button of grid.querySelectorAll<HTMLButtonElement>("[data-bit]")) {
      const on = bits[width - 1 - Number(button.dataset["bit"])]!;
      button.setAttribute("aria-pressed", String(on));
      button.firstElementChild!.textContent = on ? "1" : "0";
    }
  };

  /** Shows the current value everywhere except the field being typed in. */
  const render = (source?: HTMLInputElement) => {
    for (const field of fields) {
      if (field !== source && isBase(baseOf(field))) {
        field.value = formatInteger(value, baseOf(field));
        setError(field, errorOf(field), "");
      }
    }
    for (const input of widthInputs) {
      const bits = Number(input.value);
      input.checked = bits === width;
      input.disabled = !fits(value, bits, signed);
    }
    signedInput.checked = signed;
    const needed = bitsNeeded(value);
    const tooWide = fill(message("tooWide"), { bits: needed });
    renderGrid(tooWide);

    const order = byteOrder(value, width);
    big.textContent = order ? order.big.join(" ") : message("noBytes");
    little.textContent = order ? order.little.join(" ") : message("noBytes");

    for (const view of widthViews(value)) {
      const row = tool.querySelector<HTMLElement>(`[data-row="${view.bits}"]`)!;
      row.toggleAttribute("data-invalid", !view.fits);
      row.querySelector("[data-hex]")!.textContent = view.fits ? `0x${groupDigits(view.hex, 4)}` : message("noFit");
      row.querySelector("[data-signed-value]")!.textContent = view.fits ? view.signed.toString() : "–";
      row.querySelector("[data-unsigned-value]")!.textContent = view.fits ? view.unsigned.toString() : "–";
    }

    status.textContent =
      width === undefined
        ? tooWide
        : fill(message("statusText"), {
            bits: needed,
            width,
            kind: message(signed ? "signedWord" : "unsignedWord"),
            hex: groupDigits(widthViews(value).find((view) => view.bits === width)!.hex, 4),
          });
  };

  for (const field of fields) {
    field.addEventListener("input", () => {
      const base = baseOf(field);
      const parsed = parseInteger(field.value, base);
      if (parsed === undefined) {
        if (isBase(base)) setError(field, errorOf(field), fill(message("invalidNumber"), { base }));
        return;
      }
      setError(field, errorOf(field), "");
      value = parsed;
      fitWidth();
      render(field);
    });
  }

  radix.addEventListener("input", () => {
    const base = Number(radix.value);
    const valid = isBase(base);
    setError(radix, radixError, valid ? "" : message("invalidBase"));
    const custom = fields.find((field) => field.dataset["value"] === "custom")!;
    if (valid) {
      custom.value = formatInteger(value, base);
      setError(custom, errorOf(custom), "");
    }
  });

  for (const input of widthInputs) {
    input.addEventListener("change", () => {
      width = Number(input.value) as Width;
      render();
    });
  }

  signedInput.addEventListener("change", () => {
    signed = signedInput.checked;
    // Reading the same bits the other way: 0xff is 255 unsigned or -1 signed.
    if (width !== undefined) value = signed ? BigInt.asIntN(width, value) : BigInt.asUintN(width, value);
    fitWidth();
    render();
  });

  grid.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-bit]");
    if (!button || width === undefined) return;
    value = toggleBit(value, Number(button.dataset["bit"]), width, signed);
    render();
  });

  /** The two’s complement table scrolls on narrow screens; only then does it need to take focus to scroll by keyboard. */
  const updateScroll = () => {
    if (scroll.scrollWidth > scroll.clientWidth) scroll.tabIndex = 0;
    else scroll.removeAttribute("tabindex");
  };
  window.addEventListener("resize", updateScroll);

  fitWidth();
  render();
  updateScroll();
};
