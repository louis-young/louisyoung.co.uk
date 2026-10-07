import type { APIRoute, GetStaticPaths } from "astro";

import { markSvg, pngResponse, svgToPng } from "../lib/og";

const sizes = { "apple-touch-icon": 180, "icon-192": 192, "icon-512": 512 } as const;

export const getStaticPaths = (() =>
  Object.entries(sizes).map(([icon, size]) => ({ params: { icon }, props: { size } }))) satisfies GetStaticPaths;

export const GET: APIRoute<{ size: number }> = async ({ props: { size } }) =>
  pngResponse(svgToPng(await markSvg(size), size));
