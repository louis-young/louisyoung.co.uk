import { binaryParts, type Cidr, contains, formatIPv4, parseCidr, parseIPv4 } from "../lib/cidr-tool";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const count = (value: number) => value.toLocaleString("en-GB");

/** The values the results list shows for a block, keyed as its `data-value` attributes. */
export const cidrValues = (cidr: Cidr, messages: { noBroadcast: string; range: string }) => ({
  block: `${formatIPv4(cidr.network)}/${cidr.prefix}`,
  network: formatIPv4(cidr.network),
  broadcast: cidr.kind === "subnet" ? formatIPv4(cidr.broadcast) : messages.noBroadcast,
  first: formatIPv4(cidr.first),
  last: formatIPv4(cidr.last),
  usable: count(cidr.usable),
  total: count(cidr.total),
  netmask: formatIPv4(cidr.mask),
  wildcard: formatIPv4(cidr.wildcard),
  range: messages.range,
});

/** The binary rows, keyed as their `data-bits` attributes. */
export const binaryRows = (cidr: Cidr) => ({
  address: binaryParts(cidr.address, cidr.prefix),
  netmask: binaryParts(cidr.mask, cidr.prefix),
  network: binaryParts(cidr.network, cidr.prefix),
  broadcast: binaryParts(cidr.broadcast, cidr.prefix),
});

/** The subnet calculator on /tools/cidr/. */
export const initCidr = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-cidr]");
  if (!tool) return;
  const input = tool.querySelector<HTMLInputElement>("[data-input]")!;
  const check = tool.querySelector<HTMLInputElement>("[data-check]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const note = tool.querySelector<HTMLElement>("[data-note]")!;
  const checkStatus = tool.querySelector<HTMLElement>("[data-check-status]")!;
  const results = tool.querySelector<HTMLElement>("[data-results]")!;
  const bitsNote = tool.querySelector<HTMLElement>("[data-bits-note]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  let current: Cidr | undefined;

  const noteText = (cidr: Cidr) => {
    if (cidr.assumedPrefix) return message("assumed");
    if (cidr.normalised) {
      return fill(message("normalised"), {
        address: formatIPv4(cidr.address),
        block: `${formatIPv4(cidr.network)}/${cidr.prefix}`,
      });
    }
    if (cidr.kind === "pointToPoint") return message("pointToPoint");
    return cidr.kind === "host" ? message("host") : "";
  };

  const updateCheck = () => {
    checkStatus.removeAttribute("data-in");
    if (!current) {
      checkStatus.textContent = "";
      return;
    }
    const text = check.value.trim();
    const address = parseIPv4(text);
    check.setAttribute("aria-invalid", String(text !== "" && address === undefined));
    if (address === undefined) {
      checkStatus.textContent = message(text === "" ? "checkEmpty" : "checkInvalid");
      return;
    }
    const inside = contains(current, address);
    checkStatus.dataset["in"] = String(inside);
    checkStatus.textContent = fill(message(inside ? "inside" : "outside"), {
      address: formatIPv4(address),
      block: `${formatIPv4(current.network)}/${current.prefix}`,
    });
  };

  const update = () => {
    const result = parseCidr(input.value);
    input.setAttribute("aria-invalid", String(!result.ok && result.error !== "empty"));
    status.toggleAttribute("data-invalid", !result.ok);
    results.hidden = !result.ok;
    if (!result.ok) {
      current = undefined;
      status.textContent = message(`error${capitalised(result.error)}`);
      note.textContent = "";
      note.hidden = true;
      updateCheck();
      return;
    }
    const { cidr } = result;
    current = cidr;
    status.textContent = fill(message(cidr.usable === 1 ? "summaryOne" : "summary"), {
      block: `${formatIPv4(cidr.network)}/${cidr.prefix}`,
      total: count(cidr.total),
      usable: count(cidr.usable),
    });
    note.textContent = noteText(cidr);
    note.hidden = note.textContent === "";
    const values = cidrValues(cidr, {
      noBroadcast: message(cidr.kind === "host" ? "noBroadcastHost" : "noBroadcastLink"),
      range: message(`range${capitalised(cidr.range)}`),
    });
    for (const output of tool.querySelectorAll<HTMLElement>("[data-value]")) {
      output.textContent = values[output.dataset["value"] as keyof typeof values];
    }
    for (const [key, { network, host }] of Object.entries(binaryRows(cidr))) {
      const [networkBits, hostBits] = tool.querySelectorAll(`[data-bits="${key}"] span`);
      networkBits!.textContent = network;
      hostBits!.textContent = host;
    }
    bitsNote.textContent = fill(message("bitsSummary"), { network: cidr.prefix, host: 32 - cidr.prefix });
    updateCheck();
  };

  input.addEventListener("input", update);
  check.addEventListener("input", updateCheck);
  update();
};
