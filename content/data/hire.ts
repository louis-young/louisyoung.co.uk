import type { Hire } from "../../src/lib/content-types";

/** Everything on `/hire/`: what you offer, how an engagement runs and the small print. */
export const hire = {
  services: [
    {
      id: "contract",
      name: "Contract engineering",
      summary: "Embedded with your team, shipping product. Front-end architecture, React, TypeScript, performance.",
      price: "[DAY RATE] / day · Outside IR35",
      details: [
        "Minimum engagement of [N] weeks",
        "Remote first, on site in [CITY] by arrangement",
        "Works inside your rituals, repos and tooling",
      ],
    },
    {
      id: "review",
      name: "Architecture review",
      summary: "A fixed-scope audit of your codebase, delivery and DX, with a written plan you can act on.",
      price: "From [PRICE] · [N] days",
      details: [
        "Codebase, CI and delivery walkthrough",
        "Written report with prioritised recommendations",
        "Follow-up session with your team",
      ],
    },
    {
      id: "advisory",
      name: "Side projects & advisory",
      summary: "Founders and small teams: technical direction, hiring help and hands-on prototypes.",
      price: "By arrangement",
      details: ["Monthly retainer or one-off sessions", "Technical due diligence", "Interview loops and hiring bars"],
    },
  ],
  process: [
    {
      title: "Intro call",
      body: "Twenty minutes to talk through the problem, the team and the timeline. No prep needed.",
    },
    {
      title: "Proposal",
      body: "A short written scope with options, a price and what done looks like, within two working days.",
    },
    {
      title: "Kick-off",
      body: "Access, context and a first small change shipped in week one, so we both know it's working.",
    },
    {
      title: "Delivery",
      body: "Weekly written updates, demos over decks, and a clean handover when the work is finished.",
    },
  ],
  terms: [
    { label: "Day rate", value: "[DAY RATE]" },
    { label: "IR35", value: "Outside, via my limited company" },
    { label: "Notice", value: "[N] weeks either way" },
    { label: "Invoicing", value: "Monthly, 14-day terms" },
    { label: "Location", value: "Remote · [CITY] on site" },
    { label: "Availability", value: "From [MONTH YEAR]" },
  ],
  testimonials: [
    {
      quote: "[A sentence or two from a client or colleague about the impact of your work.]",
      name: "[Name]",
      role: "[Role, Company]",
    },
    {
      quote: "[Another short quote: what it was like to work with you, and what changed.]",
      name: "[Name]",
      role: "[Role, Company]",
    },
  ],
  faq: [
    {
      question: "Do you work outside IR35?",
      answer: "Yes. I contract through my own limited company and am happy to share a status determination.",
    },
    {
      question: "Can you start at short notice?",
      answer: "Often. Check the availability date above, or get in touch and I'll tell you honestly.",
    },
    {
      question: "Do you take on fixed-price projects?",
      answer:
        "For well-scoped work such as architecture reviews, yes. Open-ended product work is better on a day rate.",
    },
    {
      question: "Will you work with an agency?",
      answer: "Yes, though I prefer to talk to the hiring team directly where I can.",
    },
  ],
} satisfies Hire;
