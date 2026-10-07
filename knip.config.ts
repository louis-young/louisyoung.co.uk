import type { KnipConfig } from "knip";

export default {
  entry: ["src/pages/**/*.{astro,ts}", "content/**/*.tsx", "tests/**/*.{ts,tsx}"],
  project: ["src/**/*.{astro,ts,tsx}", "content/**/*.tsx", "tests/**/*.{ts,tsx}"],
  ignoreDependencies: [
    // Loaded by the Astro Fonts API and satori from node_modules paths, not imports.
    "@fontsource-variable/geist-mono",
    "@fontsource-variable/instrument-sans",
    "@fontsource-variable/newsreader",
    "@fontsource/instrument-sans",
    "@fontsource/newsreader",
  ],
} satisfies KnipConfig;
