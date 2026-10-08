import type { KnipConfig } from "knip";

export default {
  entry: ["src/pages/**/*.{astro,ts}", "content/**/*.mdx", "tests/**/*.{ts,tsx}", "scripts/*.ts"],
  project: ["src/**/*.{astro,ts,tsx,css}", "content/**/*.{ts,tsx,mdx}", "tests/**/*.{ts,tsx}", "scripts/*.ts"],
  ignoreDependencies: [
    // Loaded by the Astro Fonts API and satori from node_modules paths, not imports.
    "@fontsource-variable/geist",
    "@fontsource-variable/geist-mono",
    "@fontsource/geist",
    "@fontsource/geist-mono",
  ],
} satisfies KnipConfig;
