import { unified } from "@astrojs/markdown-remark";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import expressiveCode from "astro-expressive-code";
import { defineConfig, fontProviders } from "astro/config";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeSlug from "rehype-slug";

import { site } from "./src/site.config";
import { rehypeExternalLinks } from "./src/lib/rehype-external-links";

const fontsource = (pkg: string, file: string) => `./node_modules/@fontsource-variable/${pkg}/files/${file}`;

export default defineConfig({
  site: site.url,
  trailingSlash: "always",
  build: { format: "directory" },
  prefetch: { prefetchAll: true, defaultStrategy: "hover" },
  i18n: {
    locales: [...site.locales],
    defaultLocale: site.defaultLocale,
    routing: { prefixDefaultLocale: false },
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self' data:",
        "font-src 'self'",
        "connect-src 'self'",
        "frame-src https://codesandbox.io",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      // Expressive Code sets token colours and view transitions use names via style attributes.
      // Attribute styles cannot execute script; <style> elements stay hash-locked.
      styleDirective: { resources: [{ resource: "'unsafe-inline'", kind: "attribute" }] },
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Newsreader",
      cssVariable: "--font-newsreader",
      fallbacks: ["Georgia", "serif"],
      options: {
        variants: [
          {
            src: [fontsource("newsreader", "newsreader-latin-wght-normal.woff2")],
            weight: "200 800",
            style: "normal",
          },
          {
            src: [fontsource("newsreader", "newsreader-latin-wght-italic.woff2")],
            weight: "200 800",
            style: "italic",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Instrument Sans",
      cssVariable: "--font-instrument-sans",
      fallbacks: ["system-ui", "sans-serif"],
      options: {
        variants: [
          {
            src: [fontsource("instrument-sans", "instrument-sans-latin-wght-normal.woff2")],
            weight: "400 700",
            style: "normal",
          },
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: "Geist Mono",
      cssVariable: "--font-geist-mono",
      fallbacks: ["ui-monospace", "monospace"],
      options: {
        variants: [
          { src: [fontsource("geist-mono", "geist-mono-latin-wght-normal.woff2")], weight: "100 900", style: "normal" },
        ],
      },
    },
  ],
  markdown: {
    syntaxHighlight: false,
    processor: unified({
      rehypePlugins: [
        rehypeSlug,
        [
          rehypeAutolinkHeadings,
          {
            behavior: "wrap",
            properties: { className: ["heading-anchor"] },
            test: ["h2", "h3", "h4"],
          },
        ],
        rehypeExternalLinks,
      ],
    }),
  },
  integrations: [
    expressiveCode(),
    mdx(),
    react({ include: ["**/demos/**", "content/**/components/**"] }),
    sitemap({ filter: (page) => !page.includes("/design/") }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
