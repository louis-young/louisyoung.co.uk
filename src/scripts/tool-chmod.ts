import {
  chmodCommand,
  parseOctal,
  parseSymbolic,
  permissionClasses,
  permissionsOf,
  specialsOf,
  toOctal,
  toSymbolic,
} from "../lib/chmod-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => values[name] ?? match);

const list = new Intl.ListFormat("en-GB", { type: "conjunction" });

/** The chmod calculator on /tools/chmod/: checkboxes, octal and symbolic forms kept in step. */
export const initChmod = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-chmod]");
  if (!tool) return;
  const checks = [...tool.querySelectorAll<HTMLInputElement>("[data-bit]")];
  const octal = tool.querySelector<HTMLInputElement>("[data-octal]")!;
  const symbolic = tool.querySelector<HTMLInputElement>("[data-symbolic]")!;
  const octalMessage = tool.querySelector<HTMLElement>("[data-octal-message]")!;
  const symbolicMessage = tool.querySelector<HTMLElement>("[data-symbolic-message]")!;
  const file = tool.querySelector<HTMLInputElement>("[data-file]")!;
  const command = tool.querySelector<HTMLElement>("[data-command]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  let mode = checks.reduce((total, check) => (check.checked ? total | Number(check.dataset["bit"]) : total), 0);

  const setValidity = (input: HTMLInputElement, hint: HTMLElement, valid: boolean, error: string, normal: string) => {
    input.setAttribute("aria-invalid", String(!valid));
    hint.toggleAttribute("data-invalid", !valid);
    hint.textContent = valid ? normal : error;
  };

  const describe = () => {
    const sentences = permissionClasses.map((who) => {
      const kinds = permissionsOf(mode, who);
      const name = message(who);
      return kinds.length === 0
        ? fill(message("nothing"), { who: name })
        : fill(message("can"), { who: name, list: list.format(kinds.map((kind) => message(kind))) });
    });
    const specials = specialsOf(mode);
    if (specials.length > 0) {
      sentences.push(fill(message("specialOn"), { list: list.format(specials.map((bit) => message(bit))) }));
    }
    return sentences.join(" ");
  };

  /** Shows the current mode everywhere except the field being typed in. */
  const render = (source?: HTMLInputElement) => {
    for (const check of checks) check.checked = (mode & Number(check.dataset["bit"])) !== 0;
    const digits = toOctal(mode).padStart(4, "0");
    for (const [i, name] of ["special", ...permissionClasses].entries()) {
      tool.querySelector(`[data-digit="${name}"]`)!.textContent = digits.charAt(i);
    }
    if (source !== octal) octal.value = toOctal(mode);
    if (source !== symbolic) symbolic.value = toSymbolic(mode);
    setValidity(octal, octalMessage, true, "", message("octalHint"));
    setValidity(symbolic, symbolicMessage, true, "", message("symbolicHint"));
    status.textContent = describe();
    command.textContent = chmodCommand(mode, file.value);
  };

  for (const check of checks) {
    check.addEventListener("change", () => {
      const bit = Number(check.dataset["bit"]);
      mode = check.checked ? mode | bit : mode & ~bit;
      render();
    });
  }
  octal.addEventListener("input", () => {
    const parsed = parseOctal(octal.value);
    if (parsed === undefined) {
      setValidity(octal, octalMessage, false, message("errorOctal"), message("octalHint"));
      return;
    }
    mode = parsed;
    render(octal);
  });
  symbolic.addEventListener("input", () => {
    const parsed = parseSymbolic(symbolic.value);
    if (parsed === undefined) {
      setValidity(symbolic, symbolicMessage, false, message("errorSymbolic"), message("symbolicHint"));
      return;
    }
    mode = parsed;
    render(symbolic);
  });
  file.addEventListener("input", () => {
    command.textContent = chmodCommand(mode, file.value);
  });
  copy.addEventListener("click", () => {
    void copyText(copy, command.textContent, message("copied"));
  });
  render();
};
