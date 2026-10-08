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
  paper: "#0b0c10",
  ink: "#f4f4f6",
  muted: "#9a9ca6",
  violet: "#8b6cf6",
  blue: "#4f8cf7",
} as const;

/** Resolved from the project root: this module is bundled, so `import.meta.url` moves at build time. */
const fontFile = (pkg: string, file: string) => join(process.cwd(), "node_modules", "@fontsource", pkg, "files", file);

let fonts: Promise<SatoriOptions["fonts"]> | undefined;

const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(fontFile("geist", "geist-latin-700-normal.woff")),
    readFile(fontFile("geist", "geist-latin-500-normal.woff")),
    readFile(fontFile("geist-mono", "geist-mono-latin-500-normal.woff")),
  ]).then(([bold, medium, mono]) => [
    { name: "Geist", data: bold, weight: 700, style: "normal" },
    { name: "Geist", data: medium, weight: 500, style: "normal" },
    { name: "Geist Mono", data: mono, weight: 500, style: "normal" },
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
      borderRadius: size * 0.28,
      backgroundImage: `linear-gradient(135deg, ${palette.violet}, ${palette.blue})`,
      color: "#ffffff",
      fontFamily: "Geist",
      fontWeight: 700,
      fontSize: size * 0.42,
      letterSpacing: "-0.05em",
    },
    "LY",
  );

/** The square brand mark, used for favicons and app icons. */
export const markSvg = async (size = 64) =>
  satori(mark(size) as never, { width: size, height: size, fonts: await loadFonts() });

/** Steps the title size down so long titles still fit in three lines. */
export const titleSize = (title: string) => (title.length > 60 ? 60 : title.length > 40 ? 70 : 84);

const label = (text: string) =>
  h(
    "div",
    { display: "flex", fontFamily: "Geist Mono", fontSize: 24, color: palette.muted, letterSpacing: "0.02em" },
    text,
  );

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
        backgroundImage: `radial-gradient(circle at 12% 0%, rgba(139,108,246,0.45), transparent 45%), radial-gradient(circle at 90% 10%, rgba(79,140,247,0.32), transparent 40%)`,
        color: palette.ink,
        fontFamily: "Geist",
      },
      [
        h("div", { display: "flex", alignItems: "center", gap: 20 }, [
          mark(56),
          h("div", { display: "flex", fontSize: 28, fontWeight: 500, color: palette.ink }, "Louis Young"),
        ]),
        h(
          "div",
          {
            display: "flex",
            fontWeight: 700,
            fontSize: titleSize(title),
            lineHeight: 1.05,
            letterSpacing: "-0.04em",
            maxWidth: 1000,
          },
          title,
        ),
        h("div", { display: "flex", justifyContent: "space-between", alignItems: "center" }, [
          label(eyebrow),
          label("louisyoung.co.uk"),
        ]),
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
