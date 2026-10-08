import type { CV } from "../../src/lib/content-types";

/** Feeds `/cv/`, the CV snapshot on the home page and the generated `/cv.pdf`. */
export const cv = {
  summary:
    "[Two or three sentences: the kind of engineer you are, the scale you work at and what teams get when they hire you.]",
  roles: [
    {
      company: "[Company]",
      role: "[Role]",
      start: "[FROM]",
      location: "[City / Remote]",
      summary: "[One line on scope and impact: what you own, for whom, and the result.]",
      highlights: [
        "[Shipped X, which moved Y by Z%.]",
        "[Led N engineers through a migration from A to B.]",
        "[Introduced a practice the whole organisation adopted.]",
      ],
      stack: ["React", "TypeScript", "[Node.js]"],
    },
    {
      company: "[Company]",
      role: "[Role]",
      start: "[FROM]",
      end: "[TO]",
      location: "[City / Remote]",
      summary: "[One line on scope and impact.]",
      highlights: ["[Highlight with a measurable outcome.]", "[Highlight with a measurable outcome.]"],
      stack: ["React", "TypeScript", "[GraphQL]"],
    },
    {
      company: "[Company]",
      role: "[Role]",
      start: "[FROM]",
      end: "[TO]",
      location: "[City / Remote]",
      summary: "[One line on scope and impact.]",
      highlights: ["[Highlight with a measurable outcome.]"],
      stack: ["JavaScript", "[Stack]"],
    },
  ],
  skills: [
    { group: "Languages", items: ["TypeScript", "JavaScript", "[Go / Rust / Python]", "SQL"] },
    { group: "Front end", items: ["React", "[Next.js / Astro]", "CSS", "Accessibility", "Web performance"] },
    { group: "Platform", items: ["[Node.js]", "[GraphQL]", "[AWS]", "[Postgres]"] },
    { group: "Practice", items: ["Testing & CI", "Design systems", "Mentoring", "Technical writing"] },
  ],
  education: [{ institution: "[University]", qualification: "[Degree]", years: "[YYYY] — [YYYY]" }],
} satisfies CV;
