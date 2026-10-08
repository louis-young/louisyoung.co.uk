import { isPlaceholder } from "./placeholders";

export interface Enquiry {
  name: string;
  email: string;
  company?: string;
  service?: string;
  budget?: string;
  start?: string;
  message: string;
}

/** Composes a `mailto:` URL for an enquiry. The site has no backend, so the visitor's mail client sends it. */
export const enquiryMailto = (to: string, enquiry: Enquiry, labels: Record<keyof Enquiry, string>, subject: string) => {
  const lines = (Object.keys(labels) as (keyof Enquiry)[])
    .filter((key) => key !== "message" && enquiry[key]?.trim())
    .map((key) => `${labels[key]}: ${enquiry[key]!.trim()}`);
  const body = [...lines, "", enquiry.message.trim()].join("\n");
  const params = new URLSearchParams({
    subject: `${subject}${enquiry.company?.trim() ? ` · ${enquiry.company.trim()}` : ""}`,
    body,
  });
  // URLSearchParams encodes spaces as "+", which mail clients show literally.
  return `mailto:${to}?${params.toString().replaceAll("+", "%20")}`;
};

/** The booking link, or a pre-filled email when no scheduling link has been set yet. */
export const bookingHref = (bookingUrl: string, email: string, subject: string) =>
  isPlaceholder(bookingUrl) || !bookingUrl.startsWith("https://")
    ? `mailto:${email}?subject=${encodeURIComponent(subject)}`
    : bookingUrl;
