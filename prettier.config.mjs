/** @type {import("prettier").Config} */
export default {
  printWidth: 120,
  plugins: ["prettier-plugin-astro", "prettier-plugin-tailwindcss"],
  overrides: [
    { files: "*.astro", options: { parser: "astro" } },
    { files: ["*.md", "*.mdx"], options: { printWidth: 100, proseWrap: "preserve" } },
  ],
};
