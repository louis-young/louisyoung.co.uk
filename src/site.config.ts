export const site = {
  url: "https://louisyoung.co.uk",
  name: "Louis Young",
  author: {
    name: "Louis Young",
    email: "me@louisyoung.co.uk",
  },
  repository: "https://github.com/louis-young/louisyoung.co.uk",
  defaultBranch: "master",
  social: [
    { id: "github", label: "GitHub", href: "https://github.com/louis-young" },
    { id: "linkedin", label: "LinkedIn", href: "https://www.linkedin.com/in/louis-r-young" },
    { id: "x", label: "X", href: "https://x.com/louisryoungg" },
  ],
  defaultLocale: "en-GB",
  locales: ["en-GB"],
} as const;

export type Locale = (typeof site.locales)[number];
