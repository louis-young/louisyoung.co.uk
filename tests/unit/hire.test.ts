import { describe, expect, it } from "vitest";

import { bookingHref, enquiryMailto } from "../../src/lib/hire";
import { formatPeriod } from "../../src/lib/cv";
import { formatLocalTime, msToNextMinute } from "../../src/lib/clock";

const labels = {
  name: "Name",
  email: "Email",
  company: "Company",
  service: "Service",
  budget: "Budget",
  start: "Start",
  message: "Message",
};

describe("enquiryMailto", () => {
  it("builds a mailto URL with a subject and a labelled body, skipping empty fields", () => {
    const url = enquiryMailto(
      "me@example.com",
      { name: "Ada", email: "ada@example.com", company: " Analytical ", budget: "", message: " Hello there " },
      labels,
      "Project enquiry",
    );
    const [address, query] = url.split("?");
    expect(address).toBe("mailto:me@example.com");
    expect(url).not.toContain("+");
    const params = new URLSearchParams(query);
    expect(params.get("subject")).toBe("Project enquiry · Analytical");
    expect(params.get("body")).toBe("Name: Ada\nEmail: ada@example.com\nCompany: Analytical\n\nHello there");
  });

  it("omits the company from the subject when there is none", () => {
    const url = enquiryMailto("me@example.com", { name: "A", email: "a@b.c", message: "Hi" }, labels, "Enquiry");
    expect(new URLSearchParams(url.split("?")[1]).get("subject")).toBe("Enquiry");
  });
});

describe("bookingHref", () => {
  it("uses a real HTTPS booking link", () => {
    expect(bookingHref("https://cal.com/louis", "me@example.com", "Intro")).toBe("https://cal.com/louis");
  });

  it.each(["[BOOKING URL]", "", "javascript:alert(1)", "http://insecure.example"])(
    "falls back to email for %j",
    (url) => {
      expect(bookingHref(url, "me@example.com", "Intro call")).toBe("mailto:me@example.com?subject=Intro%20call");
    },
  );
});

describe("formatPeriod", () => {
  it.each([
    [{ start: "2021" }, "2021 — Now"],
    [{ start: "2019", end: "2021" }, "2019 — 2021"],
    [{ start: "2020", end: "2020" }, "2020"],
  ])("formats %j as %s", (role, expected) => {
    expect(formatPeriod(role, "Now")).toBe(expected);
  });
});

describe("clock", () => {
  it("formats 24-hour time in a time zone", () => {
    const date = new Date("2026-07-01T14:05:00Z");
    expect(formatLocalTime(date, "Europe/London")).toBe("15:05");
    expect(formatLocalTime(date, "UTC")).toBe("14:05");
  });

  it("counts down to the next minute", () => {
    expect(msToNextMinute(new Date("2026-01-01T00:00:15.500Z"))).toBe(44_500);
    expect(msToNextMinute(new Date("2026-01-01T00:00:00Z"))).toBe(60_000);
  });
});
