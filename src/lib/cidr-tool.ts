/**
 * IPv4 subnet maths for CIDR blocks. Addresses are 32-bit unsigned integers; every bitwise result
 * goes through `>>> 0`, because JavaScript's bitwise operators return signed 32-bit numbers.
 */

type CidrError = "empty" | "ipv6" | "address" | "prefix" | "mask";

export type RangeKind =
  | "public"
  | "private"
  | "shared"
  | "loopback"
  | "linkLocal"
  | "documentation"
  | "benchmarking"
  | "multicast"
  | "reserved"
  | "thisNetwork"
  | "broadcast"
  | "mixed";

export interface Cidr {
  /** The address as typed, which may be a host inside the block. */
  address: number;
  prefix: number;
  mask: number;
  wildcard: number;
  network: number;
  broadcast: number;
  first: number;
  last: number;
  /** Every address in the block: 2^(32 − prefix). */
  total: number;
  /** Addresses a host can use: all of them for /31 (RFC 3021) and /32, otherwise two fewer. */
  usable: number;
  /** A /31 is a point-to-point link with no network or broadcast address; a /32 is one host. */
  kind: "subnet" | "pointToPoint" | "host";
  /** True when the address had host bits set, so the block starts somewhere else. */
  normalised: boolean;
  /** True when no prefix was given, so the address was read as a /32. */
  assumedPrefix: boolean;
  range: RangeKind;
}

export type CidrResult = { ok: true; cidr: Cidr } | { ok: false; error: CidrError };

/** Reads a dotted-quad IPv4 address. Leading zeros are refused, since some tools read them as octal. */
export const parseIPv4 = (text: string): number | undefined => {
  const octets = text.trim().split(".");
  if (octets.length !== 4) return undefined;
  let value = 0;
  for (const octet of octets) {
    if (!/^(?:0|[1-9]\d{0,2})$/u.test(octet)) return undefined;
    const number = Number(octet);
    if (number > 255) return undefined;
    value = value * 256 + number;
  }
  return value;
};

export const formatIPv4 = (value: number) =>
  [value >>> 24, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff].join(".");

/** The netmask for a prefix length. `<< 32` is a no-op in JavaScript, so /0 is a special case. */
export const maskFromPrefix = (prefix: number) => (prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0);

/** The prefix length for a netmask, or undefined if its ones aren't contiguous. */
export const prefixFromMask = (mask: number) => {
  const inverted = ~mask >>> 0;
  // A contiguous mask inverts to 2^n − 1, so adding one leaves a single bit set.
  if ((inverted & (inverted + 1)) !== 0) return undefined;
  return 32 - Math.log2(inverted + 1);
};

/** Blocks from the IANA IPv4 Special-Purpose Address Registry (RFC 6890), most specific first. */
const specialBlocks: [string, number, RangeKind][] = [
  ["255.255.255.255", 32, "broadcast"],
  ["192.0.2.0", 24, "documentation"],
  ["198.51.100.0", 24, "documentation"],
  ["203.0.113.0", 24, "documentation"],
  ["169.254.0.0", 16, "linkLocal"],
  ["192.168.0.0", 16, "private"],
  ["198.18.0.0", 15, "benchmarking"],
  ["172.16.0.0", 12, "private"],
  ["100.64.0.0", 10, "shared"],
  ["0.0.0.0", 8, "thisNetwork"],
  ["10.0.0.0", 8, "private"],
  ["127.0.0.0", 8, "loopback"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "reserved"],
];

const blocks = specialBlocks.map(([address, prefix, kind]) => ({
  network: parseIPv4(address)!,
  mask: maskFromPrefix(prefix),
  prefix,
  kind,
}));

/** What a block is for: inside one special-purpose block, overlapping some, or ordinary public space. */
export const rangeKind = (address: number, prefix: number): RangeKind => {
  const mask = maskFromPrefix(prefix);
  const network = (address & mask) >>> 0;
  const inside = blocks.find((block) => block.prefix <= prefix && (network & block.mask) >>> 0 === block.network);
  if (inside) return inside.kind;
  const overlaps = blocks.some((block) => (block.network & mask) >>> 0 === network);
  return overlaps ? "mixed" : "public";
};

/** Works out a block from an address and prefix. */
export const cidrInfo = (address: number, prefix: number, assumedPrefix = false): Cidr => {
  const mask = maskFromPrefix(prefix);
  const wildcard = ~mask >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | wildcard) >>> 0;
  const total = 2 ** (32 - prefix);
  const kind = prefix === 32 ? "host" : prefix === 31 ? "pointToPoint" : "subnet";
  const subnet = kind === "subnet";
  return {
    address,
    prefix,
    mask,
    wildcard,
    network,
    broadcast,
    first: subnet ? network + 1 : network,
    last: subnet ? broadcast - 1 : broadcast,
    total,
    usable: subnet ? total - 2 : total,
    kind,
    normalised: address !== network,
    assumedPrefix,
    range: rangeKind(network, prefix),
  };
};

/**
 * Reads `10.0.0.0/22`, `10.0.0.0/255.255.252.0`, `10.0.0.0 255.255.252.0` or a bare address,
 * which is read as a /32.
 */
export const parseCidr = (input: string): CidrResult => {
  const text = input.trim();
  if (text === "") return { ok: false, error: "empty" };
  if (text.includes(":")) return { ok: false, error: "ipv6" };
  const match = /^([^\s/]+)(?:\s*\/\s*(\S*)|\s+(\S+))?$/u.exec(text);
  const address = match ? parseIPv4(match[1] ?? "") : undefined;
  if (!match || address === undefined) return { ok: false, error: "address" };
  const suffix = match[2] ?? match[3];
  if (suffix === undefined) return { ok: true, cidr: cidrInfo(address, 32, true) };
  if (suffix.includes(".")) {
    const mask = parseIPv4(suffix);
    const prefix = mask === undefined ? undefined : prefixFromMask(mask);
    return prefix === undefined ? { ok: false, error: "mask" } : { ok: true, cidr: cidrInfo(address, prefix) };
  }
  if (!/^\d{1,2}$/u.test(suffix) || Number(suffix) > 32) return { ok: false, error: "prefix" };
  return { ok: true, cidr: cidrInfo(address, Number(suffix)) };
};

/** Whether an address falls inside a block. */
export const contains = (cidr: Cidr, address: number) => (address & cidr.mask) >>> 0 === cidr.network;

/**
 * An address in binary, dotted by octet and split where the prefix ends: the network bits, then
 * the host bits (which take the dot when the split falls between octets).
 */
export const binaryParts = (value: number, prefix: number) => {
  const dotted = (value >>> 0)
    .toString(2)
    .padStart(32, "0")
    .replace(/(.{8})(?!$)/gu, "$1.");
  const split = prefix === 0 ? 0 : prefix + Math.floor((prefix - 1) / 8);
  return { network: dotted.slice(0, split), host: dotted.slice(split) };
};
