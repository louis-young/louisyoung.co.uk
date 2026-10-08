import type { Profile } from "../../src/lib/content-types";

/**
 * Who you are, where you are and whether you're taking work. Anything in square brackets
 * is a placeholder: run `pnpm content:todo` to list the ones still to fill in.
 */
export const profile = {
  name: "Louis Young",
  headline: "Software engineer",
  intro:
    "I design and ship fast, accessible products with React and TypeScript, and help teams build the platforms underneath them.",
  location: { city: "[CITY]", country: "UK", timeZone: "Europe/London" },
  availability: {
    status: "available",
    from: "[MONTH YEAR]",
    note: "Contract · Advisory · Side projects",
  },
  bookingUrl: "[BOOKING URL]",
  email: "me@louisyoung.co.uk",
  github: "louis-young",
  principles: [
    {
      title: "Ship small, ship often",
      body: "Thin vertical slices behind flags, in production early, so feedback arrives while it's still cheap to act on.",
    },
    {
      title: "Accessible by default",
      body: "Semantic HTML, keyboard paths and contrast are part of done, checked in CI rather than left for an audit.",
    },
    {
      title: "Performance is a feature",
      body: "Budgets, measurement and less JavaScript. Fast on a mid-range phone on a train, not just on my laptop.",
    },
    {
      title: "Leave it better",
      body: "Clear docs, honest tests and decisions written down, so the team moves faster after I've gone.",
    },
  ],
} satisfies Profile;
