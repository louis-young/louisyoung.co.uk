import { describe, expect, it } from "vitest";

import {
  binaryParts,
  type Cidr,
  cidrInfo,
  contains,
  formatIPv4,
  maskFromPrefix,
  parseCidr,
  parseIPv4,
  prefixFromMask,
  rangeKind,
} from "../../src/lib/cidr-tool";

const parsed = (text: string): Cidr => {
  const result = parseCidr(text);
  if (!result.ok) throw new Error(`Expected ${text} to parse: ${result.error}`);
  return result.cidr;
};

/** The block's addresses written out, for readable assertions. */
const summary = (text: string) => {
  const cidr = parsed(text);
  return {
    network: formatIPv4(cidr.network),
    broadcast: formatIPv4(cidr.broadcast),
    first: formatIPv4(cidr.first),
    last: formatIPv4(cidr.last),
    mask: formatIPv4(cidr.mask),
    wildcard: formatIPv4(cidr.wildcard),
    total: cidr.total,
    usable: cidr.usable,
    kind: cidr.kind,
  };
};

describe("parseIPv4 and formatIPv4", () => {
  it("round-trips addresses as unsigned 32-bit numbers", () => {
    expect(parseIPv4("0.0.0.0")).toBe(0);
    expect(parseIPv4("10.0.0.1")).toBe(0x0a000001);
    expect(parseIPv4(" 192.168.1.255 ")).toBe(0xc0a801ff);
    expect(parseIPv4("255.255.255.255")).toBe(0xffffffff);
    for (const address of ["0.0.0.0", "1.2.3.4", "128.0.0.0", "255.255.255.255", "172.16.254.1"]) {
      expect(formatIPv4(parseIPv4(address)!)).toBe(address);
    }
  });

  it("formats values with the top bit set without going negative", () => {
    expect(formatIPv4(0xc0a80001)).toBe("192.168.0.1");
    expect(formatIPv4(-1 >>> 0)).toBe("255.255.255.255");
  });

  it("refuses anything that isn’t a dotted quad", () => {
    for (const text of [
      "",
      "1.2.3",
      "1.2.3.4.5",
      "256.0.0.1",
      "1.2.3.-4",
      "01.2.3.4",
      "1.2.3.04",
      "a.b.c.d",
      "1..3.4",
      "1.2.3.4 x",
      "1.2.3.1000",
      "0x1.2.3.4",
    ]) {
      expect(parseIPv4(text), text).toBeUndefined();
    }
  });
});

describe("masks", () => {
  it("builds netmasks for every prefix, including /0 and /32", () => {
    expect(maskFromPrefix(0)).toBe(0);
    expect(maskFromPrefix(1)).toBe(0x80000000);
    expect(maskFromPrefix(8)).toBe(0xff000000);
    expect(maskFromPrefix(22)).toBe(0xfffffc00);
    expect(maskFromPrefix(31)).toBe(0xfffffffe);
    expect(maskFromPrefix(32)).toBe(0xffffffff);
    for (let prefix = 0; prefix <= 32; prefix++) {
      expect(maskFromPrefix(prefix)).toBeGreaterThanOrEqual(0);
      expect(prefixFromMask(maskFromPrefix(prefix))).toBe(prefix);
    }
  });

  it("refuses masks whose ones aren’t contiguous", () => {
    expect(prefixFromMask(parseIPv4("255.0.255.0")!)).toBeUndefined();
    expect(prefixFromMask(parseIPv4("0.255.255.255")!)).toBeUndefined();
    expect(prefixFromMask(parseIPv4("255.255.255.253")!)).toBeUndefined();
  });
});

describe("parseCidr", () => {
  it("works out a /22", () => {
    expect(summary("10.0.0.0/22")).toEqual({
      network: "10.0.0.0",
      broadcast: "10.0.3.255",
      first: "10.0.0.1",
      last: "10.0.3.254",
      mask: "255.255.252.0",
      wildcard: "0.0.3.255",
      total: 1024,
      usable: 1022,
      kind: "subnet",
    });
    const cidr = parsed("10.0.0.0/22");
    expect(cidr.normalised).toBe(false);
    expect(cidr.assumedPrefix).toBe(false);
    expect(cidr.range).toBe("private");
  });

  it("handles blocks in the top half of the address space", () => {
    expect(summary("192.168.1.0/24")).toMatchObject({
      network: "192.168.1.0",
      broadcast: "192.168.1.255",
      first: "192.168.1.1",
      last: "192.168.1.254",
      usable: 254,
    });
    expect(summary("255.255.255.0/24")).toMatchObject({ broadcast: "255.255.255.255", last: "255.255.255.254" });
  });

  it("covers the whole space at /0", () => {
    expect(summary("0.0.0.0/0")).toEqual({
      network: "0.0.0.0",
      broadcast: "255.255.255.255",
      first: "0.0.0.1",
      last: "255.255.255.254",
      mask: "0.0.0.0",
      wildcard: "255.255.255.255",
      total: 4_294_967_296,
      usable: 4_294_967_294,
      kind: "subnet",
    });
    expect(summary("128.0.0.0/1")).toMatchObject({ network: "128.0.0.0", broadcast: "255.255.255.255" });
  });

  it("treats a /31 as a point-to-point link with two usable hosts (RFC 3021)", () => {
    expect(summary("192.0.2.4/31")).toEqual({
      network: "192.0.2.4",
      broadcast: "192.0.2.5",
      first: "192.0.2.4",
      last: "192.0.2.5",
      mask: "255.255.255.254",
      wildcard: "0.0.0.1",
      total: 2,
      usable: 2,
      kind: "pointToPoint",
    });
  });

  it("treats a /32 as a single host", () => {
    expect(summary("203.0.113.9/32")).toEqual({
      network: "203.0.113.9",
      broadcast: "203.0.113.9",
      first: "203.0.113.9",
      last: "203.0.113.9",
      mask: "255.255.255.255",
      wildcard: "0.0.0.0",
      total: 1,
      usable: 1,
      kind: "host",
    });
    expect(summary("255.255.255.255/32").network).toBe("255.255.255.255");
  });

  it("works out /30, the smallest block with a network and broadcast address", () => {
    expect(summary("10.1.1.5/30")).toMatchObject({
      network: "10.1.1.4",
      first: "10.1.1.5",
      last: "10.1.1.6",
      usable: 2,
    });
  });

  it("normalises a host address to its network", () => {
    const cidr = parsed("192.168.1.130/26");
    expect(formatIPv4(cidr.address)).toBe("192.168.1.130");
    expect(formatIPv4(cidr.network)).toBe("192.168.1.128");
    expect(cidr.normalised).toBe(true);
    expect(parsed("10.0.3.255/22").normalised).toBe(true);
  });

  it("reads a netmask after a slash or a space, and spaces around the slash", () => {
    expect(parsed("10.0.0.0/255.255.252.0").prefix).toBe(22);
    expect(parsed("10.0.0.0 255.255.252.0").prefix).toBe(22);
    expect(parsed("10.0.0.0 / 22").prefix).toBe(22);
    expect(parsed("  10.0.0.0/22  ").prefix).toBe(22);
    expect(parsed("10.0.0.0/0.0.0.0").prefix).toBe(0);
  });

  it("reads a bare address as a /32", () => {
    const cidr = parsed("8.8.8.8");
    expect(cidr.prefix).toBe(32);
    expect(cidr.assumedPrefix).toBe(true);
    expect(cidr.range).toBe("public");
  });

  it("explains what’s wrong", () => {
    const cases: [string, string][] = [
      ["", "empty"],
      ["   ", "empty"],
      ["2001:db8::/32", "ipv6"],
      ["::1", "ipv6"],
      ["10.0.0/8", "address"],
      ["300.0.0.0/8", "address"],
      ["010.0.0.0/8", "address"],
      ["/24", "address"],
      ["10.0.0.0/22/1", "prefix"],
      ["10.0.0.0 22 1", "address"],
      ["10.0.0.0/33", "prefix"],
      ["10.0.0.0/-1", "prefix"],
      ["10.0.0.0/", "prefix"],
      ["10.0.0.0/2x", "prefix"],
      ["10.0.0.0/123", "prefix"],
      ["10.0.0.0/255.0.255.0", "mask"],
      ["10.0.0.0/255.255.252", "mask"],
    ];
    for (const [text, error] of cases) expect(parseCidr(text), text).toEqual({ ok: false, error });
  });
});

describe("contains", () => {
  it("checks membership by masking, at the edges of the block", () => {
    const cidr = parsed("10.0.0.0/22");
    expect(contains(cidr, parseIPv4("10.0.0.0")!)).toBe(true);
    expect(contains(cidr, parseIPv4("10.0.2.15")!)).toBe(true);
    expect(contains(cidr, parseIPv4("10.0.3.255")!)).toBe(true);
    expect(contains(cidr, parseIPv4("10.0.4.0")!)).toBe(false);
    expect(contains(cidr, parseIPv4("9.255.255.255")!)).toBe(false);
  });

  it("works for /0, /32 and the top half of the space", () => {
    expect(contains(parsed("0.0.0.0/0"), 0xffffffff)).toBe(true);
    expect(contains(parsed("1.2.3.4/32"), parseIPv4("1.2.3.4")!)).toBe(true);
    expect(contains(parsed("1.2.3.4/32"), parseIPv4("1.2.3.5")!)).toBe(false);
    expect(contains(parsed("200.0.0.0/8"), parseIPv4("200.255.0.1")!)).toBe(true);
  });
});

describe("rangeKind", () => {
  it("names special-purpose blocks", () => {
    const cases: [string, string][] = [
      ["10.1.2.0/24", "private"],
      ["172.16.0.0/12", "private"],
      ["172.31.255.0/24", "private"],
      ["172.32.0.0/16", "public"],
      ["192.168.0.0/16", "private"],
      ["100.64.0.0/10", "shared"],
      ["127.0.0.1/32", "loopback"],
      ["169.254.1.0/24", "linkLocal"],
      ["192.0.2.0/24", "documentation"],
      ["198.51.100.7/32", "documentation"],
      ["203.0.113.0/25", "documentation"],
      ["198.18.0.0/15", "benchmarking"],
      ["224.0.0.251/32", "multicast"],
      ["240.0.0.0/4", "reserved"],
      ["255.255.255.255/32", "broadcast"],
      ["0.0.0.0/8", "thisNetwork"],
      ["8.8.8.0/24", "public"],
      ["0.0.0.0/0", "mixed"],
      ["10.0.0.0/7", "mixed"],
      ["192.0.0.0/8", "mixed"],
    ];
    for (const [text, kind] of cases) expect(parsed(text).range, text).toBe(kind);
  });

  it("works from the network and prefix alone", () => {
    expect(rangeKind(parseIPv4("172.16.0.0")!, 11)).toBe("mixed");
    expect(rangeKind(parseIPv4("172.16.0.0")!, 12)).toBe("private");
  });
});

describe("binaryParts", () => {
  it("splits the bits where the prefix ends, dotted by octet", () => {
    const address = parseIPv4("10.0.2.15")!;
    expect(binaryParts(address, 22)).toEqual({ network: "00001010.00000000.000000", host: "10.00001111" });
    expect(binaryParts(address, 24)).toEqual({ network: "00001010.00000000.00000010", host: ".00001111" });
    expect(binaryParts(address, 8)).toEqual({ network: "00001010", host: ".00000000.00000010.00001111" });
    expect(binaryParts(address, 9)).toEqual({ network: "00001010.0", host: "0000000.00000010.00001111" });
  });

  it("puts everything on one side at /0 and /32", () => {
    expect(binaryParts(0xffffffff, 0)).toEqual({ network: "", host: "11111111.11111111.11111111.11111111" });
    expect(binaryParts(0xffffffff, 32)).toEqual({ network: "11111111.11111111.11111111.11111111", host: "" });
  });
});

describe("cidrInfo", () => {
  it("can be called directly", () => {
    const cidr = cidrInfo(parseIPv4("10.0.0.1")!, 8, true);
    expect(cidr.assumedPrefix).toBe(true);
    expect(cidr.normalised).toBe(true);
  });
});
