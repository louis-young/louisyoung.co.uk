import { escapeXml } from "./feeds";

/** Escapes a translated string and turns `*word*` into `<em>word</em>`, so catalogues stay markup-free. */
export const emphasise = (message: string) => escapeXml(message).replace(/\*([^*]+)\*/gu, "<em>$1</em>");

/**
 * Words to search for when a page is missing, from its URL: `/react-hooks_guide.html` becomes
 * `react hooks guide`. The 404 page itself, and the home page, give nothing to search for.
 */
export const queryFromPath = (pathname: string) => {
  let path = pathname;
  try {
    path = decodeURIComponent(pathname);
  } catch {
    // A malformed escape: search for the raw path instead.
  }
  const last = path.split("/").findLast(Boolean) ?? "";
  const words = last
    .replace(/\.[a-z0-9]+$/iu, "")
    .replace(/[-_+.]+/gu, " ")
    .trim();
  return words === "404" ? "" : words;
};
