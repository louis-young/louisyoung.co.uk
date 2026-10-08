import type { Profile } from "../../src/lib/content-types";

/**
 * Who you are, where you are and whether you're taking work. Anything in square brackets
 * is a placeholder: run `pnpm content:todo` to list the ones still to fill in.
 */
export const profile = {
  name: "Louis Young",
  headline: "[Senior / Staff] software engineer",
  intro:
    "[Senior / Staff] software engineer. I design and ship fast, accessible products with React and TypeScript, and help teams build the platforms underneath them.",
  location: { city: "[CITY]", country: "UK", timeZone: "Europe/London" },
  availability: {
    status: "available",
    from: "[MONTH YEAR]",
    note: "Contract · Advisory · Side projects",
  },
  bookingUrl: "[BOOKING URL]",
  email: "me@louisyoung.co.uk",
  github: "louis-young",
} satisfies Profile;
