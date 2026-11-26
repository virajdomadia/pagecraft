/** Client mirror of api/app/services/slugs.py — instant feedback; the API has the last word. */

export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;
export const RESERVED = new Set([
  "www",
  "api",
  "app",
  "admin",
  "s",
  "sites",
  "sign-in",
  "sign-up",
  "docs",
  "static",
  "assets",
  "media",
  "help",
  "mail",
  "blog",
  "status",
  "pagecraft",
  "dashboard",
  "templates",
]);

export function slugify(text: string): string {
  const ascii = text.normalize("NFKD").replace(/[̀-ͯ]/g, "");
  let slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 40)
    .replace(/-+$/g, "");
  if (slug.length < 3) slug = `${slug}-site`.replace(/^-/, "");
  return slug;
}

export function slugProblem(slug: string): string | null {
  if (RESERVED.has(slug)) return `“${slug}” is reserved — pick another address`;
  if (!SLUG_RE.test(slug)) return "Use 3–40 lower-case letters, digits and dashes (no dash at either end)";
  return null;
}
