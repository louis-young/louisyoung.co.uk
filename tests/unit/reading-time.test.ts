import { describe, expect, it } from "vitest";

import { estimateReadingTime } from "../../src/lib/reading-time";

const words = (count: number) => Array.from({ length: count }, () => "word").join(" ");

describe("estimateReadingTime", () => {
  it("never returns less than a minute", () => {
    expect(estimateReadingTime("")).toBe(1);
    expect(estimateReadingTime("Hello")).toBe(1);
  });

  it("rounds prose to the nearest minute at 230 words per minute", () => {
    expect(estimateReadingTime(words(460))).toBe(2);
    expect(estimateReadingTime(words(1150))).toBe(5);
  });

  it("counts code lines rather than code words", () => {
    const code = `\`\`\`ts\n${Array.from({ length: 115 }, () => "const a = someFunctionCall(withArguments, andMore);").join("\n")}\n\`\`\``;
    // 115 lines × 6 words = 690 word-equivalents = 3 minutes.
    expect(estimateReadingTime(code)).toBe(3);
  });

  it("ignores MDX imports and component tags", () => {
    expect(estimateReadingTime(`import Counter from "./counter";\n<Demo title="x">\n${words(230)}\n</Demo>`)).toBe(1);
  });

  it("respects a custom reading speed", () => {
    expect(estimateReadingTime(words(600), 200)).toBe(3);
  });
});
