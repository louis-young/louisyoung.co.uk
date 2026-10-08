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
  paper: "#f4f4f2",
  ink: "#0a0a0a",
  muted: "#4d4d4d",
  signal: "#ff5a1f",
} as const;

/** Resolved from the project root: this module is bundled, so `import.meta.url` moves at build time. */
const fontFile = (pkg: string, file: string) => join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file);

let fonts: Promise<SatoriOptions["fonts"]> | undefined;

const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(fontFile("schibsted-grotesk", "schibsted-grotesk-latin-900-normal.woff")),
    readFile(fontFile("schibsted-grotesk", "schibsted-grotesk-latin-500-normal.woff")),
    readFile(fontFile("jetbrains-mono", "jetbrains-mono-latin-500-normal.woff")),
  ]).then(([black, medium, mono]) => [
    { name: "Schibsted Grotesk", data: black, weight: 900, style: "normal" },
    { name: "Schibsted Grotesk", data: medium, weight: 500, style: "normal" },
    { name: "JetBrains Mono", data: mono, weight: 500, style: "normal" },
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
      background: palette.signal,
      color: palette.ink,
      fontFamily: "Schibsted Grotesk",
      fontWeight: 900,
      fontSize: size * 0.5,
      letterSpacing: "-0.06em",
    },
    "LY",
  );

/** The square brand mark, used for favicons and app icons. */
export const markSvg = async (size = 64) =>
  satori(mark(size) as never, { width: size, height: size, fonts: await loadFonts() });

/** Steps the title size down so long titles still fit in three lines. */
export const titleSize = (title: string) => (title.length > 60 ? 70 : title.length > 40 ? 84 : 100);

const label = (text: string) =>
  h(
    "div",
    {
      display: "flex",
      fontFamily: "JetBrains Mono",
      fontSize: 22,
      letterSpacing: "0.04em",
      textTransform: "uppercase",
    },
    text,
  );

export const cardSvg = async ({ title, eyebrow }: { title: string; eyebrow: string }) =>
  satori(
    h(
      "div",
      {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: palette.paper,
        color: palette.ink,
        fontFamily: "Schibsted Grotesk",
      },
      [
        h(
          "div",
          {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "28px 56px",
            borderBottom: `4px solid ${palette.ink}`,
          },
          [label("Louis Young"), label(eyebrow)],
        ),
        h(
          "div",
          {
            display: "flex",
            flexGrow: 1,
            alignItems: "flex-end",
            padding: "40px 56px 48px",
            fontWeight: 900,
            fontSize: titleSize(title),
            lineHeight: 0.92,
            letterSpacing: "-0.055em",
            textTransform: "uppercase",
          },
          title,
        ),
        h(
          "div",
          {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "26px 56px",
            background: palette.signal,
          },
          [label("louisyoung.co.uk"), mark(56)],
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
