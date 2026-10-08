// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import Counter from "../../content/articles/why-functional-state-updates-are-important/components/counter";

afterEach(cleanup);

const setup = (strategy: "stale" | "functional") => {
  render(<Counter strategy={strategy} />);
  return {
    user: userEvent.setup(),
    value: () => screen.getByRole("status").textContent,
    increment: screen.getByRole("button", { name: "Increment" }),
    reset: screen.getByRole("button", { name: "Reset" }),
  };
};

describe("article demo: <Counter>", () => {
  it("only increments by one with stale updates, which is the article's point", async () => {
    const { user, value, increment } = setup("stale");
    await user.click(increment);
    expect(value()).toBe("1");
    await user.click(increment);
    expect(value()).toBe("2");
  });

  it("increments by two with functional updates", async () => {
    const { user, value, increment } = setup("functional");
    await user.click(increment);
    expect(value()).toBe("2");
  });

  it("resets, and disables reset at zero", async () => {
    const { user, value, increment, reset } = setup("functional");
    expect((reset as HTMLButtonElement).disabled).toBe(true);
    await user.click(increment);
    expect((reset as HTMLButtonElement).disabled).toBe(false);
    await user.click(reset);
    expect(value()).toBe("0");
  });

  it("announces changes politely", () => {
    setup("stale");
    expect(screen.getByRole("status").getAttribute("aria-live")).toBe("polite");
  });
});

describe("article demo: server render", () => {
  it("renders inert buttons as disabled until hydrated", async () => {
    const { renderToString } = await import("react-dom/server");
    const html = renderToString(<Counter strategy="stale" />);
    expect(html.match(/disabled=""/gu)).toHaveLength(2);
  });
});
