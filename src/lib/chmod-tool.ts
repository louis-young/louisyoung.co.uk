/** Who a permission applies to, in the order `ls -l` shows them. */
export const permissionClasses = ["owner", "group", "other"] as const;
export type PermissionClass = (typeof permissionClasses)[number];

const permissionKinds = ["read", "write", "execute"] as const;
export type PermissionKind = (typeof permissionKinds)[number];

const specialBits = ["setuid", "setgid", "sticky"] as const;
export type SpecialBit = (typeof specialBits)[number];

const kindValue: Record<PermissionKind, number> = { read: 4, write: 2, execute: 1 };
const classShift: Record<PermissionClass, number> = { owner: 6, group: 3, other: 0 };
const specialValue: Record<SpecialBit, number> = { setuid: 0o4000, setgid: 0o2000, sticky: 0o1000 };
/** The special bit shown in each class’s execute slot. */
const slotBit: Record<PermissionClass, SpecialBit> = { owner: "setuid", group: "setgid", other: "sticky" };

/** The bit a permission sets in a mode. */
export const permissionBit = (who: PermissionClass, kind: PermissionKind) => kindValue[kind] << classShift[who];

export const specialBit = (bit: SpecialBit) => specialValue[bit];

/** Reads 1 to 4 octal digits, e.g. `755` or `4755`. */
export const parseOctal = (text: string) => {
  const trimmed = text.trim();
  if (!/^[0-7]{1,4}$/u.test(trimmed)) return undefined;
  return Number.parseInt(trimmed, 8);
};

/** Three digits, or four when a special bit is set: `755`, `4755`. */
export const toOctal = (mode: number) => mode.toString(8).padStart(mode > 0o777 ? 4 : 3, "0");

/**
 * The nine-character form `ls -l` prints, e.g. `rwxr-xr-x`. Setuid and setgid show as `s` in the
 * owner’s or group’s execute slot (`S` without execute), and sticky as `t` (`T`) in others’.
 */
export const toSymbolic = (mode: number) =>
  permissionClasses
    .map((who) => {
      const read = mode & permissionBit(who, "read") ? "r" : "-";
      const write = mode & permissionBit(who, "write") ? "w" : "-";
      const execute = (mode & permissionBit(who, "execute")) !== 0;
      const special = (mode & specialValue[slotBit[who]]) !== 0;
      const letter = who === "other" ? "t" : "s";
      const slot = special ? (execute ? letter : letter.toUpperCase()) : execute ? "x" : "-";
      return `${read}${write}${slot}`;
    })
    .join("");

const symbolicPattern = /^[-dlcbps]?([r-][w-][xsS-])([r-][w-][xsS-])([r-][w-][xtT-])$/u;

/**
 * Reads the symbolic form, with or without the file-type character `ls -l` puts in front
 * (`-rwxr-xr-x`, `drwxr-xr-x`).
 */
export const parseSymbolic = (text: string) => {
  const match = symbolicPattern.exec(text.trim());
  if (!match) return undefined;
  let mode = 0;
  permissionClasses.forEach((who, i) => {
    const part = match[i + 1]!;
    const slot = part.charAt(2);
    if (part.startsWith("r")) mode |= permissionBit(who, "read");
    if (part.charAt(1) === "w") mode |= permissionBit(who, "write");
    if ("xst".includes(slot)) mode |= permissionBit(who, "execute");
    if ("sStT".includes(slot)) mode |= specialValue[slotBit[who]];
  });
  return mode;
};

/** The permissions a class has, e.g. `["read", "execute"]`. */
export const permissionsOf = (mode: number, who: PermissionClass) =>
  permissionKinds.filter((kind) => (mode & permissionBit(who, kind)) !== 0);

/** The special bits that are set. */
export const specialsOf = (mode: number) => specialBits.filter((bit) => (mode & specialValue[bit]) !== 0);

/** Quotes a path for a POSIX shell when it needs it. */
export const shellQuote = (path: string) =>
  /^[\w@%+=:,./-]+$/u.test(path) ? path : `'${path.replaceAll("'", String.raw`'\''`)}'`;

/**
 * The command to run, e.g. `chmod 755 deploy.sh`. A blank path is left out, and a path starting
 * with a hyphen goes after `--` so chmod doesn't read it as an option (quoting alone doesn't stop that).
 */
export const chmodCommand = (mode: number, path: string) => {
  const target = path.trim();
  if (target === "") return `chmod ${toOctal(mode)}`;
  return `chmod ${toOctal(mode)} ${target.startsWith("-") ? "-- " : ""}${shellQuote(target)}`;
};
