import { describe, expect, it } from "vitest";

import { moveIndex, rankCommands, scoreCommand } from "../../src/lib/palette";

const commands = [
  { title: "Home" },
  { title: "Hire" },
  { title: "Why functional state updates are important", keywords: "react state" },
  { title: "Copy email address", keywords: "me@louisyoung.co.uk" },
  { title: "Crème brûlée" },
];

describe("scoreCommand", () => {
  it("ranks prefix over word start over substring over keywords over fuzzy", () => {
    const command = { title: "Utilising the Context API", keywords: "react" };
    expect(scoreCommand(command, "util")).toBe(100);
    expect(scoreCommand(command, "cont")).toBe(80);
    expect(scoreCommand(command, "ising")).toBe(60);
    expect(scoreCommand(command, "react")).toBe(40);
    expect(scoreCommand(command, "uca")).toBe(20);
    expect(scoreCommand(command, "xyz")).toBe(0);
    expect(scoreCommand(command, "   ")).toBe(1);
    expect(scoreCommand({ title: "Plain" }, "zz")).toBe(0);
  });

  it("ignores case and accents", () => {
    expect(scoreCommand({ title: "Crème brûlée" }, "CREME")).toBe(100);
  });
});

describe("rankCommands", () => {
  it("returns everything in order for an empty query", () => {
    expect(rankCommands(commands, "")).toEqual(commands);
  });

  it("filters and orders by score, keeping authored order for ties", () => {
    expect(rankCommands(commands, "h").map((command) => command.title)).toEqual([
      "Home",
      "Hire",
      "Why functional state updates are important",
    ]);
    expect(rankCommands(commands, "louisyoung").map((command) => command.title)).toEqual(["Copy email address"]);
  });
});

describe("moveIndex", () => {
  it("wraps in both directions", () => {
    expect(moveIndex(0, -1, 3)).toBe(2);
    expect(moveIndex(2, 1, 3)).toBe(0);
    expect(moveIndex(1, 1, 3)).toBe(2);
    expect(moveIndex(0, 1, 0)).toBe(-1);
  });
});
