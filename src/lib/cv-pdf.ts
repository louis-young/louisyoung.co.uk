import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

import type { CV, Profile } from "./content-types";
import { formatPeriod } from "./cv";
import { isPlaceholder } from "./placeholders";

export interface CvPdfLabels {
  experience: string;
  skills: string;
  education: string;
  now: string;
  website: string;
}

const ink = rgb(0.04, 0.04, 0.04);
const muted = rgb(0.33, 0.33, 0.33);
const signal = rgb(1, 0.31, 0);

const A4 = { width: 595.28, height: 841.89 };
const margin = 48;
const contentWidth = A4.width - margin * 2;

/** Splits text into lines that fit a width, breaking on spaces. */
export const wrapText = (text: string, width: number, measure: (value: string) => number) => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/u).filter(Boolean)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && measure(candidate) > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
};

/** Standard PDF fonts only cover WinAnsi; swap anything else for a close equivalent. */
const winAnsi = (value: string) =>
  value
    .replaceAll("→", "->")
    .replaceAll("↗", "")
    .replace(/[^\x20-\x7e\xa0-\xff–—‘’“”•…]/gu, "");

/** Renders the CV as an A4 PDF using only built-in fonts, so the build needs no font files. */
export const renderCvPdf = async (profile: Profile, cv: CV, labels: CvPdfLabels, siteUrl: string) => {
  const document = await PDFDocument.create();
  document.setTitle(`${profile.name} — CV`);
  document.setAuthor(profile.name);
  document.setSubject(winAnsi(profile.headline));
  document.setCreator(siteUrl);
  document.setProducer("louisyoung.co.uk");
  document.setCreationDate(new Date(0));
  document.setModificationDate(new Date(0));

  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const mono = await document.embedFont(StandardFonts.Courier);

  let page: PDFPage = document.addPage([A4.width, A4.height]);
  let y = A4.height - margin;

  const ensure = (height: number) => {
    if (y - height < margin) {
      page = document.addPage([A4.width, A4.height]);
      y = A4.height - margin;
    }
  };

  const write = (
    text: string,
    font: PDFFont,
    size: number,
    options: { color?: typeof ink; x?: number; width?: number; leading?: number } = {},
  ) => {
    const { color = ink, x = margin, width = contentWidth, leading = 1.35 } = options;
    for (const line of wrapText(winAnsi(text), width, (value) => font.widthOfTextAtSize(value, size))) {
      ensure(size * leading);
      y -= size;
      page.drawText(line, { x, y, size, font, color });
      y -= size * (leading - 1);
    }
  };

  const rule = (thickness = 1.5) => {
    ensure(thickness + 4);
    page.drawRectangle({ x: margin, y: y - thickness, width: contentWidth, height: thickness, color: ink });
    y -= thickness;
  };

  const heading = (text: string) => {
    ensure(48);
    y -= 22;
    write(text.toUpperCase(), mono, 9, { color: muted });
    y -= 4;
    rule(1);
    y -= 6;
  };

  // Masthead
  page.drawRectangle({ x: 0, y: A4.height - 10, width: A4.width, height: 10, color: signal });
  y -= 10;
  write(profile.name.toUpperCase(), bold, 38, { leading: 1 });
  y -= 8;
  write(profile.headline, regular, 13);
  y -= 6;
  write(
    [
      profile.email,
      siteUrl.replace(/^https:\/\//u, ""),
      `github.com/${profile.github}`,
      isPlaceholder(profile.location.city)
        ? profile.location.country
        : `${profile.location.city}, ${profile.location.country}`,
    ].join("  ·  "),
    mono,
    8.5,
    { color: muted },
  );
  y -= 10;
  rule(2);
  y -= 12;
  if (cv.summary) write(cv.summary, regular, 10.5, { leading: 1.45 });

  if (cv.roles.length > 0) heading(labels.experience);
  for (const role of cv.roles) {
    ensure(70);
    y -= 8;
    const period = formatPeriod(role, labels.now);
    const top = y;
    write(period, mono, 8.5, { color: muted, width: 110 });
    y = top;
    const x = margin + 120;
    const width = contentWidth - 120;
    write(`${role.role}, ${role.company}`, bold, 11.5, { x, width });
    if (role.location) write(role.location, mono, 8, { x, width, color: muted });
    y -= 3;
    if (role.summary) write(role.summary, regular, 9.5, { x, width, leading: 1.4 });
    for (const highlight of role.highlights) {
      ensure(14);
      page.drawRectangle({ x, y: y - 6.5, width: 3, height: 3, color: signal });
      write(highlight, regular, 9.5, { x: x + 10, width: width - 10, leading: 1.4 });
    }
    if (role.stack.length > 0) write(role.stack.join(" · "), mono, 8, { x, width, color: muted });
    y -= 6;
  }

  if (cv.skills.length > 0) heading(labels.skills);
  for (const group of cv.skills) {
    ensure(20);
    y -= 4;
    const top = y;
    write(group.group, bold, 9.5, { width: 110 });
    y = top;
    write(group.items.join(", "), regular, 9.5, { x: margin + 120, width: contentWidth - 120 });
  }

  if (cv.education.length > 0) heading(labels.education);
  for (const item of cv.education) {
    ensure(20);
    y -= 4;
    const top = y;
    write(item.years, mono, 8.5, { color: muted, width: 110 });
    y = top;
    write(`${item.qualification}, ${item.institution}`, regular, 9.5, { x: margin + 120, width: contentWidth - 120 });
  }

  for (const [index, current] of document.getPages().entries()) {
    current.drawText(winAnsi(`${labels.website}: ${siteUrl}/cv/`), {
      x: margin,
      y: 24,
      size: 7.5,
      font: mono,
      color: muted,
    });
    const number = `${index + 1} / ${document.getPageCount()}`;
    current.drawText(number, {
      x: A4.width - margin - mono.widthOfTextAtSize(number, 7.5),
      y: 24,
      size: 7.5,
      font: mono,
      color: muted,
    });
  }

  return document.save();
};
