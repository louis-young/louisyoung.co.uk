import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { cv } from "../../content/data/cv";
import { profile } from "../../content/data/profile";
import { renderCvPdf, wrapText } from "../../src/lib/cv-pdf";

const labels = { experience: "Experience", skills: "Skills", education: "Education", now: "Now", website: "Online" };

describe("wrapText", () => {
  const measure = (value: string) => value.length;

  it("breaks on spaces within the width", () => {
    expect(wrapText("one two three four", 9, measure)).toEqual(["one two", "three", "four"]);
  });

  it("keeps an over-long word on its own line and ignores extra whitespace", () => {
    expect(wrapText("  supercalifragilistic  ok ", 5, measure)).toEqual(["supercalifragilistic", "ok"]);
    expect(wrapText("", 5, measure)).toEqual([]);
  });
});

describe("renderCvPdf", () => {
  it("renders a valid, deterministic A4 PDF with metadata", async () => {
    const first = await renderCvPdf(profile, cv, labels, "https://louisyoung.co.uk");
    const second = await renderCvPdf(profile, cv, labels, "https://louisyoung.co.uk");
    expect(new TextDecoder().decode(first.slice(0, 5))).toBe("%PDF-");
    expect(first).toEqual(second);
    const document = await PDFDocument.load(first);
    expect(document.getTitle()).toBe("Louis Young — CV");
    expect(document.getAuthor()).toBe("Louis Young");
    expect(document.getPage(0).getSize()).toEqual({ width: 595.28, height: 841.89 });
  });

  it("flows onto more pages and survives characters outside WinAnsi", async () => {
    const long = {
      ...cv,
      summary: "Builds things → ships them ↗ 🚀",
      roles: Array.from({ length: 12 }, (_, index) => ({ ...cv.roles[0]!, company: `Company ${index}` })),
    };
    const bytes = await renderCvPdf(profile, long, labels, "https://example.com");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(1);
  });
});
