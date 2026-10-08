import { expect, test } from "./fixtures";

test.describe("hire", () => {
  test("the enquiry form composes an email with everything filled in", async ({ page }) => {
    await page.goto("/hire/");
    await page.getByLabel("Your name").fill("Ada Lovelace");
    await page.getByLabel("Your email").fill("ada@example.com");
    await page.getByLabel("Company").fill("Analytical Engines");
    await page.getByLabel("What do you need?").selectOption({ index: 1 });
    await page.getByLabel("About the project").fill("We need a hand with our front end.");
    await page.getByRole("button", { name: /Compose email/u }).click();
    const href = (await page.locator("[data-enquiry]").getAttribute("data-mailto")) ?? "";
    expect(href).toMatch(/^mailto:me@louisyoung\.co\.uk\?/u);
    const params = new URLSearchParams(href.split("?")[1]);
    expect(params.get("subject")).toBe("Project enquiry · Analytical Engines");
    expect(params.get("body")).toContain("Your name: Ada Lovelace");
    expect(params.get("body")).toContain("We need a hand with our front end.");
  });

  test("required fields are enforced before composing", async ({ page }) => {
    await page.goto("/hire/");
    await page.getByRole("button", { name: /Compose email/u }).click();
    await expect(page).toHaveURL("/hire/");
    expect(await page.getByLabel("Your name").evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(
      true,
    );
  });

  test("FAQ answers expand", async ({ page }) => {
    await page.goto("/hire/");
    const question = page.locator(".faq__question").first();
    await question.click();
    await expect(page.locator(".faq__answer").first()).toBeVisible();
  });
});

test.describe("CV", () => {
  test("the PDF is generated and linked", async ({ page, request }) => {
    await page.goto("/cv/");
    await expect(page.getByRole("link", { name: /Download PDF/u })).toHaveAttribute("href", "/cv.pdf");
    const response = await request.get("/cv.pdf");
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("the print stylesheet hides the site chrome", async ({ page }) => {
    await page.goto("/cv/");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator(".site-header")).toBeHidden();
    await expect(page.locator(".site-footer")).toBeHidden();
    await expect(page.locator(".cv__online")).toBeVisible();
  });
});

test.describe("header", () => {
  test("shows a ticking local clock", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-01-15T10:05:30Z") });
    await page.goto("/");
    const clock = page.locator("time[data-clock]");
    await expect(clock).toHaveText("10:05");
    await page.clock.runFor(60_000);
    await expect(clock).toHaveText("10:06");
  });
});
