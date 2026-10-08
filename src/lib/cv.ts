import type { Role } from "./content-types";

/** "2021 — Now", "2019 — 2021", or just "2020" when a role starts and ends in the same year. */
export const formatPeriod = (role: Pick<Role, "start" | "end">, nowLabel: string) => {
  if (!role.end) return `${role.start} — ${nowLabel}`;
  return role.start === role.end ? role.start : `${role.start} — ${role.end}`;
};
