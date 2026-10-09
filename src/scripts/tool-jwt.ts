import { decodeJwt, type DecodedJwt, formatClaimDate, type JwtError, type JwtWarning, validity } from "../lib/jwt-tool";
import { relativeTime } from "../lib/timestamp-tool";
import { copyText } from "./tool-copy";

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/gu, (match, name: string) => String(values[name] ?? match));

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const relative = new Intl.RelativeTimeFormat("en-GB", { numeric: "always" });

/** “in 3 hours” or “2 days ago”, from `now`. */
export const fromNow = (date: Date, now: Date) => relative.format(...relativeTime(date, now));

/**
 * The JWT decoder on /tools/jwt/. Tokens are credentials, so this is deliberately stateless:
 * nothing is stored, shared or put in the URL, and nothing is sent anywhere.
 */
export const initJwt = (root: ParentNode = document, clock: () => Date = () => new Date()) => {
  const tool = root.querySelector<HTMLElement>("[data-jwt]");
  if (!tool) return;
  const input = tool.querySelector<HTMLTextAreaElement>("[data-input]")!;
  const status = tool.querySelector<HTMLElement>("[data-status]")!;
  const warnings = tool.querySelector<HTMLElement>("[data-warnings]")!;
  const parts = tool.querySelector<HTMLElement>("[data-parts]")!;
  const header = tool.querySelector<HTMLElement>("[data-header]")!;
  const payload = tool.querySelector<HTMLElement>("[data-payload]")!;
  const claims = tool.querySelector<HTMLElement>("[data-claims]")!;
  const noClaims = tool.querySelector<HTMLElement>("[data-no-claims]")!;
  const alg = tool.querySelector<HTMLElement>("[data-alg]")!;
  const length = tool.querySelector<HTMLElement>("[data-length]")!;
  const signature = tool.querySelector<HTMLElement>("[data-signature]")!;
  const message = (key: string) => tool.dataset[key] ?? "";
  const segmentName = (segment: string) => message(`segment${capitalised(segment)}`);

  const errorText = (error: JwtError) => {
    switch (error.kind) {
      case "empty":
        return message("empty");
      case "encrypted":
        return message("encrypted");
      case "parts":
        return fill(message("partsError"), { count: error.count });
      default:
        return fill(message(`error${capitalised(error.kind)}`), {
          segment: segmentName(error.segment),
        });
    }
  };

  const warningText = (warning: JwtWarning, token: DecodedJwt) => {
    return fill(message(`warning${capitalised(warning.kind)}`), {
      alg: token.alg ?? "",
      claim: "claim" in warning ? warning.claim : "",
    });
  };

  const renderParts = (texts: readonly string[], broken?: string) => {
    const names = ["header", "payload", "signature"];
    const nodes: (Node | string)[] = [];
    texts.forEach((text, index) => {
      if (index > 0) nodes.push(".");
      const span = document.createElement("span");
      const name = names[index];
      if (name) span.dataset["part"] = name;
      span.toggleAttribute("data-broken", name === broken);
      span.textContent = text;
      nodes.push(span);
    });
    parts.replaceChildren(...nodes);
  };

  const row = (term: string, ...details: (Node | string)[]) => {
    const wrapper = document.createElement("div");
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.append(...details);
    wrapper.append(dt, dd);
    return wrapper;
  };

  const update = () => {
    const result = decodeJwt(input.value);
    const now = clock();
    input.setAttribute("aria-invalid", String(!result.ok && result.error.kind !== "empty"));
    status.toggleAttribute("data-invalid", !result.ok);
    status.removeAttribute("data-state");
    for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) button.disabled = !result.ok;
    if (!result.ok) {
      status.textContent = errorText(result.error);
      renderParts(result.parts, "segment" in result.error ? result.error.segment : undefined);
      warnings.replaceChildren();
      warnings.hidden = true;
      for (const output of [header, payload, alg, length, signature]) output.textContent = "";
      claims.replaceChildren();
      noClaims.hidden = true;
      return;
    }
    const { token } = result;
    const state = validity(token, now);
    status.dataset["state"] = state.state;
    status.textContent =
      state.state === "noExpiry" ? message("noExpiry") : fill(message(state.state), { when: fromNow(state.at, now) });
    renderParts(token.parts);
    warnings.replaceChildren(
      ...token.warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = warningText(warning, token);
        return item;
      }),
    );
    warnings.hidden = token.warnings.length === 0;
    header.textContent = token.headerJson;
    payload.textContent = token.payloadJson;
    claims.replaceChildren(
      ...token.claims.map((claim) => row(message(`claim${capitalised(claim.name)}`), claim.value)),
      ...token.times.map((claim) => {
        const time = document.createElement("time");
        time.dateTime = claim.date.toISOString();
        time.textContent = formatClaimDate(claim.date);
        const ago = document.createElement("span");
        ago.className = "jwt__relative";
        ago.textContent = fromNow(claim.date, now);
        return row(message(`claim${capitalised(claim.name)}`), time, ago);
      }),
    );
    noClaims.hidden = claims.childElementCount > 0;
    alg.textContent = token.alg ?? message("noAlg");
    length.textContent = String(token.signatureBytes);
    signature.textContent = token.parts[2];
  };

  input.addEventListener("input", update);
  for (const button of tool.querySelectorAll<HTMLButtonElement>("[data-copy]")) {
    button.addEventListener("click", () => {
      const source = button.dataset["copy"] === "header" ? header : payload;
      void copyText(button, source.textContent, message("copied"));
    });
  }
  update();
};
