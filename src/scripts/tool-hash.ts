import { hashAlgorithms, toBase64, toHex, uuidCount } from "../lib/hash-tool";
import { copyText } from "./tool-copy";

/** The hash and UUID generator on /tools/hash/. */
export const initHash = (root: ParentNode = document) => {
  const tool = root.querySelector<HTMLElement>("[data-hash]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const uppercase = tool.querySelector<HTMLInputElement>("[data-uppercase]")!;
  const unsupported = tool.querySelector<HTMLElement>("[data-unsupported]")!;
  const count = tool.querySelector<HTMLInputElement>("[data-count]")!;
  const uuids = tool.querySelector<HTMLElement>("[data-uuids]")!;
  const copied = tool.dataset["copied"] ?? "";
  const encoder = new TextEncoder();
  // Each input starts a new round of digests; a slower, older round must not overwrite a newer one.
  let round = 0;

  const value = (algorithm: string, kind: string) =>
    tool.querySelector<HTMLElement>(`[data-algorithm="${algorithm}"] [data-value="${kind}"]`)!;

  const hash = async () => {
    const current = ++round;
    const subtle = crypto.subtle as SubtleCrypto | undefined;
    if (!subtle) {
      unsupported.hidden = false;
      return;
    }
    const data = encoder.encode(input.value);
    const digests = await Promise.all(hashAlgorithms.map((algorithm) => subtle.digest(algorithm, data)));
    if (current !== round) return;
    hashAlgorithms.forEach((algorithm, i) => {
      const digest = digests[i] ?? new ArrayBuffer(0);
      value(algorithm, "hex").textContent = toHex(digest, uppercase.checked);
      value(algorithm, "base64").textContent = toBase64(digest);
    });
  };

  const generate = () => {
    // Like crypto.subtle, randomUUID only exists in secure contexts.
    if (typeof (crypto as Partial<Crypto>).randomUUID !== "function") {
      unsupported.hidden = false;
      return;
    }
    const items = Array.from({ length: uuidCount(count.value) }, () => {
      const item = document.createElement("li");
      const code = document.createElement("code");
      code.textContent = crypto.randomUUID();
      item.append(code);
      return item;
    });
    uuids.replaceChildren(...items);
  };

  const run = () => {
    void hash();
  };
  input.addEventListener("input", run);
  uppercase.addEventListener("change", run);
  tool.querySelector("[data-generate]")!.addEventListener("click", generate);
  count.addEventListener("change", () => {
    count.value = String(uuidCount(count.value));
  });
  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      const [algorithm = "", kind = ""] = (button.dataset["copy"] ?? "").split(" ");
      void copyText(button, value(algorithm, kind).textContent, copied);
    });
  }
  const copyAll = tool.querySelector<HTMLButtonElement>("[data-copy-all]")!;
  copyAll.addEventListener("click", () => {
    const text = [...uuids.querySelectorAll("code")].map((code) => code.textContent).join("\n");
    void copyText(copyAll, text, copied);
  });
  run();
  generate();
};
