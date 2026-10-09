import { describe, expect, it } from "vitest";

import {
  clampCount,
  countLimits,
  generateIds,
  type IdInfo,
  type IdSource,
  inspectId,
  ulid,
  uuidV4,
  uuidV7,
} from "../../src/lib/uuid-tool";

const bytes = (length: number, fill = 0) => new Uint8Array(length).fill(fill);
const counting = (length: number) => Uint8Array.from({ length }, (_, index) => index);

const info = (text: string): IdInfo => {
  const result = inspectId(text);
  if (!result.ok) throw new Error(`Expected ${text} to inspect: ${result.error}`);
  return result.info;
};

/** A source that hands out 0, 1, 2 … as bytes and a fixed time. */
const source = (ms = 1_760_000_000_000): IdSource => {
  let next = 0;
  return {
    now: () => ms,
    random: (length) => Uint8Array.from({ length }, () => next++ % 256),
  };
};

describe("clampCount", () => {
  it("keeps counts within the limits", () => {
    expect(clampCount("5")).toBe(5);
    expect(clampCount("7.9")).toBe(7);
    expect(clampCount("0")).toBe(countLimits.min);
    expect(clampCount("-3")).toBe(countLimits.min);
    expect(clampCount("100000")).toBe(countLimits.max);
    expect(clampCount("")).toBe(countLimits.min);
    expect(clampCount("lots")).toBe(countLimits.min);
  });
});

describe("uuidV4", () => {
  it("sets the version and variant bits and keeps the rest", () => {
    expect(uuidV4(bytes(16))).toBe("00000000-0000-4000-8000-000000000000");
    expect(uuidV4(bytes(16, 255))).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
    expect(uuidV4(counting(16))).toBe("00010203-0405-4607-8809-0a0b0c0d0e0f");
  });

  it("doesn’t change the bytes it’s given", () => {
    const random = bytes(16, 255);
    uuidV4(random);
    expect(random).toEqual(bytes(16, 255));
  });
});

describe("uuidV7", () => {
  it("puts the millisecond time first, big-endian", () => {
    expect(uuidV7(1_760_000_000_000, bytes(10))).toBe("0199c82c-c000-7000-8000-000000000000");
    expect(uuidV7(0, bytes(10, 255))).toBe("00000000-0000-7fff-bfff-ffffffffffff");
    expect(uuidV7(2 ** 48 - 1, counting(10))).toBe("ffffffff-ffff-7001-8203-040506070809");
  });

  it("clamps times outside 48 bits and drops fractions of a millisecond", () => {
    expect(uuidV7(-5, bytes(10)).slice(0, 13)).toBe("00000000-0000");
    expect(uuidV7(2 ** 50, bytes(10)).slice(0, 13)).toBe("ffffffff-ffff");
    expect(uuidV7(1.9, bytes(10)).slice(0, 13)).toBe("00000000-0001");
  });

  it("matches the RFC 9562 appendix A.6 example", () => {
    const random = Uint8Array.from([0x0c, 0xc3, 0x18, 0xc4, 0xdc, 0x0c, 0x0c, 0x07, 0x39, 0x8f]);
    expect(uuidV7(0x017f22e279b0, random)).toBe("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
  });
});

describe("ulid", () => {
  it("encodes 48 bits of time and 80 of randomness as 26 Crockford characters", () => {
    expect(ulid(0, bytes(10))).toBe("00000000000000000000000000");
    expect(ulid(2 ** 48 - 1, bytes(10, 255))).toBe("7ZZZZZZZZZZZZZZZZZZZZZZZZZ");
    expect(ulid(1_469_918_176_385, bytes(10))).toMatch(/^01ARYZ6S41/u);
  });

  it("only uses Crockford’s alphabet", () => {
    for (let fill = 0; fill < 256; fill += 17)
      expect(ulid(fill * 1e9, bytes(10, fill))).toMatch(/^[0-7][0-9A-HJKMNP-TV-Z]{25}$/u);
  });
});

describe("generateIds", () => {
  it("makes the requested number of each kind", () => {
    expect(generateIds("v4", 3, source())).toEqual([
      "00010203-0405-4607-8809-0a0b0c0d0e0f",
      "10111213-1415-4617-9819-1a1b1c1d1e1f",
      "20212223-2425-4627-a829-2a2b2c2d2e2f",
    ]);
    expect(generateIds("v7", 2, source())).toEqual([
      "0199c82c-c000-7001-8203-040506070809",
      "0199c82c-c000-7a0b-8c0d-0e0f10111213",
    ]);
    const ulids = generateIds("ulid", 4, source());
    expect(ulids).toHaveLength(4);
    for (const id of ulids) expect(id).toMatch(/^01K742SG00/u);
  });

  it("sorts time-ordered batches made in the same millisecond", () => {
    // Random bytes that count down, so unsorted IDs would come out in reverse.
    let next = 255;
    const falling: IdSource = { now: () => 1000, random: (length) => Uint8Array.from({ length }, () => next--) };
    for (const kind of ["v7", "ulid"] as const) {
      next = 255;
      const ids = generateIds(kind, 5, falling);
      expect(ids).toEqual([...ids].sort());
      expect(new Set(ids).size).toBe(5);
    }
  });
});

describe("inspectId", () => {
  it("reads a version 4 UUID in any of its spellings", () => {
    const expected = { kind: "uuid", uuid: "f47ac10b-58cc-4372-a567-0e02b2c3d479", variant: "rfc", version: 4 };
    for (const text of [
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "F47AC10B-58CC-4372-A567-0E02B2C3D479",
      "f47ac10b58cc4372a5670e02b2c3d479",
      "{f47ac10b-58cc-4372-a567-0e02b2c3d479}",
      "urn:uuid:f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "  f47ac10b-58cc-4372-a567-0e02b2c3d479\n",
    ]) {
      expect(info(text), text).toEqual(expected);
    }
  });

  it("reads the time from a version 7 UUID", () => {
    const uuid = info("017f22e2-79b0-7cc3-98c4-dc0c0c07398f");
    expect(uuid.version).toBe(7);
    expect(uuid.time?.toISOString()).toBe("2022-02-22T19:22:22.000Z");
    expect(info(uuidV7(1_760_000_000_123, bytes(10))).time?.getTime()).toBe(1_760_000_000_123);
  });

  it("reads the time from version 1 and version 6 UUIDs (RFC 9562 appendix A.1 and A.5)", () => {
    const v1 = info("c232ab00-9414-11ec-b3c8-9f6bdeced846");
    expect(v1.version).toBe(1);
    expect(v1.time?.toISOString()).toBe("2022-02-22T19:22:22.000Z");
    const v6 = info("1ec9414c-232a-6b00-b3c8-9f6bdeced846");
    expect(v6.version).toBe(6);
    expect(v6.time?.toISOString()).toBe("2022-02-22T19:22:22.000Z");
  });

  it("reads times before 1970 in version 1 UUIDs", () => {
    expect(info("00000000-0000-1000-8000-000000000000").time?.getUTCFullYear()).toBe(1582);
  });

  it("has no time for the other versions", () => {
    for (const version of [2, 3, 4, 5, 8]) {
      const uuid = info(`00000000-0000-${version}000-8000-000000000000`);
      expect(uuid.version).toBe(version);
      expect(uuid.time).toBeUndefined();
    }
    expect(info("00000000-0000-0000-8000-000000000001").version).toBe(0);
    expect(info("00000000-0000-f000-8000-000000000001").version).toBe(15);
  });

  it("names the variant, and only gives a version for the RFC 9562 one", () => {
    const variant = (digit: string) => info(`12345678-1234-4234-${digit}234-123456789abc`);
    for (const digit of ["0", "7"]) expect(variant(digit)).toMatchObject({ variant: "ncs" });
    for (const digit of ["8", "9", "a", "b"]) expect(variant(digit)).toMatchObject({ variant: "rfc", version: 4 });
    for (const digit of ["c", "d"]) expect(variant(digit)).toMatchObject({ variant: "microsoft" });
    for (const digit of ["e", "f"]) expect(variant(digit)).toMatchObject({ variant: "future" });
    expect(variant("c").version).toBeUndefined();
  });

  it("recognises the nil and max UUIDs", () => {
    expect(info("00000000-0000-0000-0000-000000000000")).toEqual({
      kind: "uuid",
      uuid: "00000000-0000-0000-0000-000000000000",
      special: "nil",
    });
    expect(info("FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF")).toMatchObject({ special: "max" });
  });

  it("reads a ULID’s time and gives its UUID form", () => {
    const id = info("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(id.kind).toBe("ulid");
    expect(id.ulid).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
    expect(id.time?.toISOString()).toBe("2016-07-30T23:54:10.259Z");
    expect(id.uuid).toBe("01563e3a-b5d3-d676-4c61-efb99302bd5b");
    expect(info("01arz3ndektsv4rrffq69g5fav").ulid).toBe("01ARZ3NDEKTSV4RRFFQ69G5FAV");
  });

  it("round-trips generated ULIDs", () => {
    const id = ulid(1_760_000_000_123, counting(10));
    expect(info(id)).toMatchObject({ kind: "ulid", ulid: id, uuid: "0199c82c-c07b-0001-0203-040506070809" });
    expect(info(id).time?.getTime()).toBe(1_760_000_000_123);
  });

  it("explains what’s wrong", () => {
    expect(inspectId("")).toEqual({ ok: false, error: "empty" });
    expect(inspectId("  ")).toEqual({ ok: false, error: "empty" });
    for (const text of [
      "f47ac10b-58cc-4372-a567-0e02b2c3d47",
      "f47ac10b-58cc-4372-a567-0e02b2c3d4790",
      "g47ac10b-58cc-4372-a567-0e02b2c3d479",
      "01ARZ3NDEKTSV4RRFFQ69G5FAU",
      "01ARZ3NDEKTSV4RRFFQ69G5FA",
      "{f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "hello",
    ]) {
      expect(inspectId(text), text).toEqual({ ok: false, error: "invalid" });
    }
    expect(inspectId("80000000000000000000000000")).toEqual({ ok: false, error: "overflow" });
  });
});
