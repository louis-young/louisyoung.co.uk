import {
  type Capitalisation,
  type CharacterSet,
  clampCount,
  countLimits,
  crackTime,
  generatePassphrase,
  generatePassword,
  type Generated,
  type RandomSource,
  strength,
} from "../lib/password-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

/** How full the meter is: 128 bits and up reads as full. */
const meterWidth = (bits: number) => `${Math.min(100, Math.max(4, (bits / 128) * 100)).toFixed(1)}%`;

/**
 * The password and passphrase generator on /tools/password/. Deliberately stateless: nothing is
 * stored, shared or put in the URL, and the values only ever live in this page's DOM.
 */
export const initPassword = (root: ParentNode = document, source?: RandomSource) => {
  const tool = root.querySelector<HTMLElement>("[data-password]");
  if (!tool) return;
  const kinds = [...tool.querySelectorAll<HTMLInputElement>("[data-kind]")];
  const panels = [...tool.querySelectorAll<HTMLElement>("[data-panel]")];
  const length = tool.querySelector<HTMLInputElement>("[data-length]")!;
  const lengthOutput = tool.querySelector<HTMLOutputElement>("[data-length-output]")!;
  const sets = [...tool.querySelectorAll<HTMLInputElement>("[data-set]")];
  const ambiguous = tool.querySelector<HTMLInputElement>("[data-ambiguous]")!;
  const words = tool.querySelector<HTMLInputElement>("[data-words]")!;
  const wordsOutput = tool.querySelector<HTMLOutputElement>("[data-words-output]")!;
  const separator = tool.querySelector<HTMLSelectElement>("[data-separator]")!;
  const capitalisation = tool.querySelector<HTMLSelectElement>("[data-capitalisation]")!;
  const digit = tool.querySelector<HTMLInputElement>("[data-digit]")!;
  const count = tool.querySelector<HTMLInputElement>("[data-count]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const meter = tool.querySelector<HTMLElement>("[data-meter]")!;
  const bar = tool.querySelector<HTMLElement>("[data-bar]")!;
  const list = tool.querySelector<HTMLElement>("[data-list]")!;
  const copyAll = tool.querySelector<HTMLButtonElement>("[data-copy-all]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const copied = message("copied");

  const kind = () => (kinds.find((input) => input.checked)?.value === "passphrase" ? "passphrase" : "password");

  const showPanel = () => {
    for (const panel of panels) panel.hidden = panel.dataset["panel"] !== kind();
  };

  const generateOne = (): Generated | undefined =>
    kind() === "password"
      ? generatePassword(
          {
            length: Number(length.value),
            sets: sets.filter((set) => set.checked).map((set) => set.value as CharacterSet),
            excludeAmbiguous: ambiguous.checked,
          },
          source,
        )
      : generatePassphrase(
          {
            words: Number(words.value),
            separator: separator.value,
            capitalisation: capitalisation.value as Capitalisation,
            digit: digit.checked,
          },
          source,
        );

  const showStrength = (bits: number) => {
    const rating = strength(bits);
    const time = crackTime(bits);
    meter.hidden = false;
    meter.dataset["strength"] = rating;
    bar.style.width = meterWidth(bits);
    tool.querySelector("[data-entropy]")!.textContent = fill(message("bits"), { bits: Math.floor(bits) });
    tool.querySelector("[data-rating]")!.textContent = message(rating);
    tool.querySelector("[data-time]")!.textContent = fill(message(time.unit), {
      value: "value" in time ? time.value.toLocaleString("en-GB") : "",
    });
  };

  const generate = () => {
    lengthOutput.value = length.value;
    wordsOutput.value = words.value;
    const total = clampCount(count.value, countLimits, 5);
    const results: Generated[] = [];
    for (let i = 0; i < total; i++) {
      const result = generateOne();
      if (!result) break;
      results.push(result);
    }
    const first = results[0];
    if (!first) {
      list.replaceChildren();
      meter.hidden = true;
      status.textContent = message("noSets");
      status.toggleAttribute("data-invalid", true);
      copyAll.disabled = true;
      return;
    }
    status.removeAttribute("data-invalid");
    copyAll.disabled = false;
    const item = kind() === "password" ? message("itemPassword") : message("itemPassphrase");
    list.replaceChildren(
      ...results.map((result, index) => {
        const row = document.createElement("li");
        const code = document.createElement("code");
        code.translate = false;
        code.textContent = result.value;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "button button--small";
        const label = document.createElement("span");
        label.dataset["copyLabel"] = "";
        label.textContent = message("copy");
        const hidden = document.createElement("span");
        hidden.className = "visually-hidden";
        hidden.textContent = ` ${fill(item, { number: index + 1 })}`;
        button.append(label, hidden);
        button.addEventListener("click", () => {
          void copyText(button, result.value, copied);
        });
        row.append(code, button);
        return row;
      }),
    );
    showStrength(first.entropy);
    status.textContent = fill(message(kind() === "password" ? "generatedPassword" : "generatedPassphrase"), {
      count: results.length,
      bits: Math.floor(first.entropy),
    });
  };

  for (const input of kinds) {
    input.addEventListener("change", () => {
      showPanel();
      generate();
    });
  }
  for (const input of [length, words]) input.addEventListener("input", generate);
  for (const input of [...sets, ambiguous, digit, separator, capitalisation])
    input.addEventListener("change", generate);
  count.addEventListener("change", () => {
    count.value = String(clampCount(count.value, countLimits, 5));
    generate();
  });
  tool.querySelector("[data-generate]")!.addEventListener("click", generate);
  copyAll.addEventListener("click", () => {
    const text = [...list.querySelectorAll("code")].map((code) => code.textContent).join("\n");
    void copyText(copyAll, text, copied);
  });
  showPanel();
  generate();
};
