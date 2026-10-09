import { clampCount, generateIds, type IdInfo, type IdKind, type IdSource, inspectId } from "../lib/uuid-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const plurals = new Intl.PluralRules("en-GB");

const browserSource: IdSource = {
  now: () => Date.now(),
  random: (length) => crypto.getRandomValues(new Uint8Array(length)),
};

/** The rows the inspector shows for an ID, keyed as their `data-row` attributes; undefined rows are hidden. */
export const inspectRows = (
  info: IdInfo,
  messages: { kind: string; version: string | undefined; variant: string | undefined },
): Record<"kind" | "version" | "variant" | "time" | "uuid" | "ulid", string | undefined> => ({
  kind: messages.kind,
  version: messages.version,
  variant: messages.variant,
  time: info.time?.toISOString(),
  uuid: info.uuid,
  ulid: info.ulid,
});

/** The UUID and ULID generator and inspector on /tools/uuid/. */
export const initUuid = (root: ParentNode = document, source: IdSource = browserSource) => {
  const tool = root.querySelector<HTMLElement>("[data-uuid]");
  if (!tool) return;
  const kinds = [...tool.querySelectorAll<HTMLInputElement>("[data-kind]")];
  const count = tool.querySelector<HTMLInputElement>("[data-count]")!;
  const uppercase = tool.querySelector<HTMLInputElement>("[data-uppercase]")!;
  const output = tool.querySelector<HTMLTextAreaElement>("[data-output]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const generateButton = tool.querySelector<HTMLButtonElement>("[data-generate]")!;
  const copyAll = tool.querySelector<HTMLButtonElement>("[data-copy-all]")!;
  const inspectInput = tool.querySelector<HTMLInputElement>("[data-inspect]")!;
  const inspectStatus = tool.querySelector<HTMLElement>("[data-inspect-status]")!;
  const rows = [...tool.querySelectorAll<HTMLElement>("[data-row]")];
  const message = (key: string) => tool.dataset[key] ?? "";

  const kind = () => (kinds.find((input) => input.checked)?.value ?? "v4") as IdKind;

  const generate = () => {
    const how = clampCount(count.value);
    const ids = generateIds(kind(), how, source);
    output.value = (uppercase.checked && kind() !== "ulid" ? ids.map((id) => id.toUpperCase()) : ids).join("\n");
    status.textContent = fill(message(`generated${capitalised(kind())}${capitalised(plurals.select(how))}`), {
      count: how.toLocaleString("en-GB"),
    });
  };

  const versionText = (version: number) =>
    fill(message(version >= 1 && version <= 8 ? `version${version}` : "versionUnknown"), { version });

  const inspect = () => {
    const result = inspectId(inspectInput.value);
    inspectInput.setAttribute("aria-invalid", String(!result.ok && result.error !== "empty"));
    inspectStatus.toggleAttribute("data-invalid", !result.ok);
    if (!result.ok) {
      inspectStatus.textContent = message(`inspect${capitalised(result.error)}`);
      for (const row of rows) row.hidden = true;
      return;
    }
    const { info } = result;
    inspectStatus.textContent = message(`status${capitalised(info.special ?? info.kind)}`);
    const values = inspectRows(info, {
      kind: message(info.kind === "ulid" ? "kindUlid" : "kindUuid"),
      version: info.version === undefined ? undefined : versionText(info.version),
      variant: info.variant && message(`variant${capitalised(info.variant)}`),
    });
    for (const row of rows) {
      const value = values[row.dataset["row"] as keyof typeof values];
      row.hidden = value === undefined;
      row.querySelector("[data-value]")!.textContent = value ?? "";
    }
  };

  for (const input of kinds) input.addEventListener("change", generate);
  uppercase.addEventListener("change", generate);
  count.addEventListener("change", () => {
    count.value = String(clampCount(count.value));
    generate();
  });
  generateButton.addEventListener("click", generate);
  copyAll.addEventListener("click", () => {
    void copyText(copyAll, output.value, message("copied"));
  });
  inspectInput.addEventListener("input", inspect);
  generateButton.disabled = false;
  copyAll.disabled = false;
  generate();
  inspect();
};
