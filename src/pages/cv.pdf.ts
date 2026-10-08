import type { APIRoute } from "astro";

import { cv } from "../../content/data/cv";
import { profile } from "../../content/data/profile";
import { useTranslations } from "../i18n";
import { publishableCv } from "../lib/cv";
import { renderCvPdf } from "../lib/cv-pdf";
import { site } from "../site.config";

export const GET: APIRoute = async () => {
  const t = useTranslations();
  const bytes = await renderCvPdf(
    profile,
    publishableCv(cv),
    {
      experience: t("cv.experience"),
      skills: t("cv.skills"),
      education: t("cv.education"),
      now: t("cv.present"),
      website: t("cv.online"),
    },
    site.url,
  );
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="louis-young-cv.pdf"`,
    },
  });
};
