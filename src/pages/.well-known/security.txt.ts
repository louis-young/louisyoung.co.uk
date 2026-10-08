import type { APIRoute } from "astro";

import { site } from "../../site.config";

/** RFC 9116. The expiry is a year from each build, so it stays valid while the site is deployed. */
export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  return new Response(
    [
      `Contact: mailto:${site.author.email}`,
      `Contact: ${site.repository}/security/advisories/new`,
      `Expires: ${expires}`,
      `Preferred-Languages: en`,
      `Canonical: ${site.url}/.well-known/security.txt`,
      `Policy: ${site.repository}/blob/${site.defaultBranch}/SECURITY.md`,
      "",
    ].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } },
  );
};
