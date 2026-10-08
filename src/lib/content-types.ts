/**
 * Shapes of the editable content in `content/*.ts`. Anything in square brackets, like
 * `[COMPANY]`, is a placeholder: `pnpm content:todo` lists every one still to fill in.
 */

export interface Profile {
  name: string;
  /** One line, e.g. "Staff software engineer". */
  headline: string;
  /** The home page's opening paragraph. */
  intro: string;
  location: { city: string; country: string; timeZone: string };
  availability: {
    /** `available` shows the signal chip; `limited` a softer note; `unavailable` hides "Hire me" prompts. */
    status: "available" | "limited" | "unavailable";
    from: string;
    note: string;
  };
  /** A scheduling link (Cal.com, SavvyCal, Calendly…). A placeholder falls back to email. */
  bookingUrl: string;
  email: string;
  github: string;
  /** "How I work": three or four short principles shown on the home page. */
  principles: { title: string; body: string }[];
}

export interface Role {
  company: string;
  role: string;
  /** "YYYY" or "YYYY-MM". */
  start: string;
  /** Omit for the current role. */
  end?: string;
  location: string;
  summary: string;
  highlights: string[];
  stack: string[];
}

export interface CV {
  summary: string;
  roles: Role[];
  skills: { group: string; items: string[] }[];
  education: { institution: string; qualification: string; years: string }[];
}

interface Service {
  id: string;
  name: string;
  summary: string;
  price: string;
  details: string[];
}

export interface Hire {
  services: Service[];
  process: { title: string; body: string }[];
  terms: { label: string; value: string }[];
  faq: { question: string; answer: string }[];
  /** Short quotes from people you have worked with. Leave empty to hide the section. */
  testimonials: { quote: string; name: string; role: string }[];
}
