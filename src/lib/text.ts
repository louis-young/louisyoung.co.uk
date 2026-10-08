import { escapeXml } from "./feeds";

/** Escapes a translated string and turns `*word*` into `<em>word</em>`, so catalogues stay markup-free. */
export const emphasise = (message: string) => escapeXml(message).replace(/\*([^*]+)\*/gu, "<em>$1</em>");
