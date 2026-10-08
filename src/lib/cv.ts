import type { CV, Role } from "./content-types";
import { isPlaceholder, withoutPlaceholders } from "./placeholders";

/** "2021 — Now", "2019 — 2021", or just "2020" when a role starts and ends in the same year. */
export const formatPeriod = (role: Pick<Role, "start" | "end">, nowLabel: string) => {
  if (!role.end) return `${role.start} — ${nowLabel}`;
  return role.start === role.end ? role.start : `${role.start} — ${role.end}`;
};

const blank = (value: string) => (isPlaceholder(value) ? "" : value);

/**
 * The CV with every unfinished `[PLACEHOLDER]` taken out: roles without a real company or title,
 * bracketed skills and education, and any half-written text. Empty sections are left empty.
 */
export const publishableCv = (cv: CV): CV => ({
  summary: blank(cv.summary),
  roles: cv.roles
    .filter((role) => !isPlaceholder(role.company) && !isPlaceholder(role.role))
    .map((role) => ({
      ...role,
      location: blank(role.location),
      summary: blank(role.summary),
      highlights: withoutPlaceholders(role.highlights),
      stack: withoutPlaceholders(role.stack),
    })),
  skills: cv.skills
    .map((group) => ({ ...group, items: withoutPlaceholders(group.items) }))
    .filter((group) => group.items.length > 0),
  education: cv.education.filter((item) => !isPlaceholder(`${item.years} ${item.qualification} ${item.institution}`)),
});
