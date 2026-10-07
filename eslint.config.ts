import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import astro from "eslint-plugin-astro";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", ".astro/", "coverage/", "playwright-report/", "test-results/", ".lighthouseci/"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": ["error", { fixStyle: "inline-type-imports" }],
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // `noPropertyAccessFromIndexSignature` in tsconfig decides between `a.b` and `a["b"]`.
      "@typescript-eslint/dot-notation": "off",
      eqeqeq: ["error", "always"],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    // `role="list"` restores list semantics that Safari drops when `list-style: none` is set.
    files: ["**/*.astro"],
    rules: { "astro/jsx-a11y/no-redundant-roles": ["error", { ul: ["list"], ol: ["list"] }] },
  },
  ...astro.configs["flat/recommended"],
  ...astro.configs["flat/jsx-a11y-strict"],
  {
    files: ["**/*.astro"],
    rules: {
      // Astro templates are typed by `astro check`; type-aware lint rules misread `Astro.props`.
      ...tseslint.configs.disableTypeChecked.rules,
    },
    languageOptions: { parserOptions: { projectService: false, project: false } },
  },
  { files: ["**/*.tsx"], ...reactHooks.configs.flat["recommended-latest"] },
  { files: ["**/*.tsx"], ...jsxA11y.flatConfigs.strict },
  {
    // typescript-eslint cannot type `.astro` imports from `.ts` files; `astro check` covers them.
    files: ["tests/integration/**"],
    rules: { "@typescript-eslint/no-unsafe-argument": "off" },
  },
  {
    files: ["**/*.{js,mjs,cjs}"],
    ...tseslint.configs.disableTypeChecked,
  },
);
