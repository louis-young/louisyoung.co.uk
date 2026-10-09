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
import { headingLinkOptions } from "./src/lib/heading-links";
import { rehypeExternalLinks } from "./src/lib/rehype-external-links";
import { isListed, readContentIndex, withLastmod } from "./src/lib/sitemap";

const content = readContentIndex(new URL("./content/", import.meta.url));

const fontsource = (pkg: string, file: string) => `./node_modules/@fontsource-variable/${pkg}/files/${file}`;

export default defineConfig({
  site: site.url,
  trailingSlash: "always",
  // External stylesheets are covered by `style-src 'self'`; WebKit refused some hashed inline
  // <style> blocks on some pages, and files cache across pages.
  build: { format: "directory", inlineStylesheets: "never" },
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
        "form-action 'self' mailto:",
      ],
      scriptDirective: { resources: ["'self'", "'wasm-unsafe-eval'"] },
      // Expressive Code sets token colours and view transitions use names via style attributes.
      // Attribute styles cannot execute script; <style> elements stay hash-locked.
      // 'report-sample' only adds the first characters of anything blocked to violation reports.
      styleDirective: { resources: ["'self'", "'report-sample'", { resource: "'unsafe-inline'", kind: "attribute" }] },
    },
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Geist",
      cssVariable: "--font-geist",
      fallbacks: ["ui-sans-serif", "system-ui", "sans-serif"],
      options: {
        variants: [{ src: [fontsource("geist", "geist-latin-wght-normal.woff2")], weight: "100 900", style: "normal" }],
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
      rehypePlugins: [rehypeSlug, [rehypeAutolinkHeadings, headingLinkOptions()], rehypeExternalLinks],
    }),
  },
  integrations: [
    expressiveCode(),
    mdx(),
    react({ include: ["**/demos/**", "content/**/components/**"] }),
    sitemap({
      filter: (page) => isListed(content, page),
      serialize: (item) => withLastmod(content, item),
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
});
