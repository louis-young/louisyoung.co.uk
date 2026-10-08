import {
  base64Decode,
  base64Encode,
  decodeJwt,
  htmlEscape,
  htmlUnescape,
  urlDecode,
  urlEncode,
  type EncodeResult,
} from "../lib/encode-tool";

type Format = "base64" | "url" | "html";

const encoders: Record<Format, { encode: (text: string) => string; decode: (text: string) => EncodeResult }> = {
  base64: { encode: base64Encode, decode: base64Decode },
  url: { encode: urlEncode, decode: urlDecode },
  html: { encode: htmlEscape, decode: (text) => ({ output: htmlUnescape(text) }) },
};

const utc = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium", timeZone: "UTC" });

/** The encoder, decoder and JWT inspector on /tools/encode/. */
export const initEncode = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-encode]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const output = tool.querySelector<HTMLOutputElement>("[data-output]")!;
  const textResult = tool.querySelector<HTMLElement>("[data-text-result]")!;
  const directions = tool.querySelector<HTMLElement>("[data-directions]")!;
  const jwt = tool.querySelector<HTMLElement>("[data-jwt]")!;
  const note = tool.querySelector<HTMLElement>("[data-jwt-note]")!;
  const header = tool.querySelector<HTMLElement>("[data-jwt-header]")!;
  const payload = tool.querySelector<HTMLElement>("[data-jwt-payload]")!;
  const times = tool.querySelector<HTMLElement>("[data-jwt-times]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const copy = tool.querySelector<HTMLButtonElement>("[data-copy]")!;
  const message = (name: string) => tool.dataset[name] ?? "";
  const checked = (name: string) => tool.querySelector<HTMLInputElement>(`[name="${name}"]:checked`)?.value;

  const fail = (code: string) => {
    status.textContent = message(`error${code.charAt(0).toUpperCase()}${code.slice(1)}`);
    input.setAttribute("aria-invalid", "true");
  };

  const showJwt = () => {
    header.textContent = "";
    payload.textContent = "";
    times.replaceChildren();
    if (input.value.trim() === "") {
      status.textContent = message("jwtEmpty");
      return;
    }
    const result = decodeJwt(input.value);
    if ("error" in result) {
      fail(result.error);
      return;
    }
    jwt.hidden = false;
    header.textContent = JSON.stringify(result.header, null, 2);
    payload.textContent = JSON.stringify(result.payload, null, 2);
    for (const { claim, date } of result.times) {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const detail = document.createElement("dd");
      term.textContent = message(claim);
      const expired = claim === "exp" && date.getTime() < Date.now();
      detail.textContent = expired ? `${utc.format(date)} · ${message("expired")}` : utc.format(date);
      row.append(term, detail);
      times.append(row);
    }
  };

  const update = () => {
    const format = checked("format") ?? "base64";
    const isJwt = format === "jwt";
    jwt.hidden = true;
    note.hidden = !isJwt;
    textResult.hidden = isJwt;
    directions.hidden = isJwt;
    status.textContent = "";
    input.setAttribute("aria-invalid", "false");
    copy.textContent = message("copyText");
    output.value = "";
    if (isJwt) {
      showJwt();
      return;
    }
    const encoder = encoders[format as Format];
    const result: EncodeResult =
      checked("direction") === "decode" ? encoder.decode(input.value) : { output: encoder.encode(input.value) };
    if ("error" in result) fail(result.error);
    else output.value = result.output;
    copy.disabled = output.value === "";
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(output.value);
      copy.textContent = message("copied");
    } catch {
      /* Selecting the output by hand still works. */
    }
  };

  tool.addEventListener("input", update);
  tool.addEventListener("change", update);
  copy.addEventListener("click", () => {
    void copyOutput();
  });
  update();
};
