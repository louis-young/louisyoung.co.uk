import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import { Resvg } from "@resvg/resvg-js";
import type * as SatoriModule from "satori";
import type { SatoriOptions } from "satori";

/** satori's ESM build reads `__dirname`, which does not exist in ESM; its CommonJS build works. */
const satori = (createRequire(import.meta.url)("satori") as typeof SatoriModule).default;

/** sRGB approximations of the OKLCH tokens; Satori does not parse `oklch()`. */
const palette = {
  paper: "#fbf9f4",
  ink: "#151a27",
  muted: "#596071",
  rule: "#e3dfd6",
  accent: "#b8381e",
} as const;

/** Resolved from the project root: this module is bundled, so `import.meta.url` moves at build time. */
const fontFile = (pkg: string, file: string) => join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file);

let fonts: Promise<SatoriOptions["fonts"]> | undefined;

const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(fontFile("newsreader", "newsreader-latin-500-normal.woff")),
    readFile(fontFile("newsreader", "newsreader-latin-500-italic.woff")),
    readFile(fontFile("instrument-sans", "instrument-sans-latin-500-normal.woff")),
  ]).then(([serif, serifItalic, sans]) => [
    { name: "Newsreader", data: serif, weight: 500, style: "normal" },
    { name: "Newsreader", data: serifItalic, weight: 500, style: "italic" },
    { name: "Instrument Sans", data: sans, weight: 500, style: "normal" },
  ]));

interface Node {
  type: string;
  props: Record<string, unknown> & { children?: unknown };
}

const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style, children },
});

const mark = (size: number) =>
  h(
    "div",
    {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: size,
      height: size,
      borderRadius: size * 0.27,
      background: palette.ink,
      color: palette.paper,
      fontFamily: "Newsreader",
      fontStyle: "italic",
      fontSize: size * 0.46,
      letterSpacing: "-0.04em",
    },
    "LY",
  );

/** The square brand mark, used for favicons and app icons. */
export const markSvg = async (size = 64) =>
  satori(mark(size) as never, { width: size, height: size, fonts: await loadFonts() });

/** Clamps the title size so long titles still fit in three lines. */
export const titleSize = (title: string) => (title.length > 60 ? 64 : title.length > 40 ? 76 : 88);

export const cardSvg = async ({ title, eyebrow }: { title: string; eyebrow: string }) =>
  satori(
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "64px 72px",
        background: palette.paper,
        color: palette.ink,
        fontFamily: "Instrument Sans",
        borderBottom: `14px solid ${palette.accent}`,
      },
      [
        h("div", { display: "flex", alignItems: "center", gap: 20 }, [
          mark(64),
          h(
            "div",
            { display: "flex", fontFamily: "Newsreader", fontSize: 34, letterSpacing: "-0.02em" },
            "Louis Young",
          ),
        ]),
        h(
          "div",
          {
            display: "flex",
            fontFamily: "Newsreader",
            fontSize: titleSize(title),
            lineHeight: 1.04,
            letterSpacing: "-0.035em",
            maxWidth: 1000,
          },
          title,
        ),
        h(
          "div",
          {
            display: "flex",
            justifyContent: "space-between",
            fontSize: 26,
            color: palette.muted,
            paddingTop: 28,
            borderTop: `2px solid ${palette.rule}`,
          },
          [h("div", { display: "flex" }, eyebrow), h("div", { display: "flex" }, "louisyoung.co.uk")],
        ),
      ],
    ) as never,
    { width: 1200, height: 630, fonts: await loadFonts() },
  );

export const svgToPng = (svg: string, width: number) =>
  new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng();

export const pngResponse = (png: Uint8Array) =>
  new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
