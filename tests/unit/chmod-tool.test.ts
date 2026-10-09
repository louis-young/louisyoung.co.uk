import { describe, expect, it } from "vitest";

import {
  chmodCommand,
  parseOctal,
  parseSymbolic,
  permissionBit,
  permissionsOf,
  shellQuote,
  specialBit,
  specialsOf,
  toOctal,
  toSymbolic,
} from "../../src/lib/chmod-tool";

describe("bits", () => {
  it("places read, write and execute for each class", () => {
    expect(permissionBit("owner", "read")).toBe(0o400);
    expect(permissionBit("group", "write")).toBe(0o20);
    expect(permissionBit("other", "execute")).toBe(0o1);
    expect(specialBit("setuid")).toBe(0o4000);
    expect(specialBit("setgid")).toBe(0o2000);
    expect(specialBit("sticky")).toBe(0o1000);
  });
});

describe("octal", () => {
  it("reads one to four octal digits", () => {
    expect(parseOctal("755")).toBe(0o755);
    expect(parseOctal(" 0644 ")).toBe(0o644);
    expect(parseOctal("4755")).toBe(0o4755);
    expect(parseOctal("7")).toBe(0o7);
  });

  it("rejects anything else", () => {
    for (const text of ["", "8", "789", "12345", "rwx", "-1", "7.5"]) expect(parseOctal(text), text).toBeUndefined();
  });

  it("writes three digits, or four with a special bit", () => {
    expect(toOctal(0)).toBe("000");
    expect(toOctal(0o644)).toBe("644");
    expect(toOctal(0o7)).toBe("007");
    expect(toOctal(0o1777)).toBe("1777");
  });
});

describe("symbolic", () => {
  it.each([
    [0o755, "rwxr-xr-x"],
    [0o644, "rw-r--r--"],
    [0o000, "---------"],
    [0o4755, "rwsr-xr-x"],
    [0o4644, "rwSr--r--"],
    [0o2775, "rwxrwsr-x"],
    [0o2765, "rwxrwSr-x"],
    [0o1777, "rwxrwxrwt"],
    [0o1776, "rwxrwxrwT"],
    [0o7777, "rwsrwsrwt"],
  ])("writes %o as %s and reads it back", (mode, text) => {
    expect(toSymbolic(mode)).toBe(text);
    expect(parseSymbolic(text)).toBe(mode);
  });

  it("accepts the file-type character ls -l prints", () => {
    expect(parseSymbolic("-rwxr-xr-x")).toBe(0o755);
    expect(parseSymbolic("drwxrwxrwt")).toBe(0o1777);
  });

  it("rejects anything else", () => {
    for (const text of ["", "rwx", "rwxr-xr-xx", "rwtr-xr-x", "rwxr-xr-s", "xwrr-xr-x", "755"]) {
      expect(parseSymbolic(text), text).toBeUndefined();
    }
  });
});

describe("permissionsOf and specialsOf", () => {
  it("lists what each class may do and which special bits are set", () => {
    expect(permissionsOf(0o750, "owner")).toEqual(["read", "write", "execute"]);
    expect(permissionsOf(0o750, "group")).toEqual(["read", "execute"]);
    expect(permissionsOf(0o750, "other")).toEqual([]);
    expect(specialsOf(0o755)).toEqual([]);
    expect(specialsOf(0o5755)).toEqual(["setuid", "sticky"]);
  });
});

describe("chmodCommand", () => {
  it("builds the command, quoting paths the shell would split", () => {
    expect(chmodCommand(0o755, "deploy.sh")).toBe("chmod 755 deploy.sh");
    expect(chmodCommand(0o4755, " ./bin/run ")).toBe("chmod 4755 ./bin/run");
    expect(chmodCommand(0o644, "")).toBe("chmod 644");
    expect(chmodCommand(0o600, "my notes.txt")).toBe("chmod 600 'my notes.txt'");
    // Quoting alone doesn't stop chmod reading a leading hyphen as an option; `--` does.
    expect(chmodCommand(0o644, "-rf")).toBe("chmod 644 -- -rf");
    expect(chmodCommand(0o644, "-my file")).toBe("chmod 644 -- '-my file'");
  });

  it("escapes single quotes", () => {
    expect(shellQuote("it's")).toBe(String.raw`'it'\''s'`);
    expect(shellQuote("~/.ssh/id_ed25519")).toBe("'~/.ssh/id_ed25519'");
  });
});
