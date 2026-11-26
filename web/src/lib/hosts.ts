/**
 * Published-site hosts (04 §7): `{slug}.pagecraft.virajdomadia.com` → `/s/{slug}`. The wildcard
 * DNS record is added when the portfolio domain moves to Vercel DNS; until then `/s/{slug}` is
 * the address, and the subdomain branch below simply never matches.
 */

export const DEFAULT_SITE_HOST = "pagecraft.virajdomadia.com";
const RESERVED_LABELS = new Set(["www", "api", "app", "admin"]);

/** The slug a host serves, or null for Pagecraft's own hosts (and anything else). */
export function slugForHost(host: string | null, siteHost: string = DEFAULT_SITE_HOST): string | null {
  if (!host) return null;
  const name = host.toLowerCase().split(":")[0];
  const suffix = `.${siteHost.toLowerCase()}`;
  if (!name.endsWith(suffix)) return null;
  const label = name.slice(0, -suffix.length);
  if (!label || label.includes(".") || RESERVED_LABELS.has(label)) return null;
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/.test(label) ? label : null;
}

export function publishedPath(slug: string): string {
  return `/s/${slug}`;
}

/** What the studio shows as a site's address: the subdomain form (the product's promise). */
export function prettyHost(slug: string, siteHost: string = DEFAULT_SITE_HOST): string {
  return `${slug}.${siteHost}`;
}
