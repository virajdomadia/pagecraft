import type { PublishedSite } from "@/lib/api";
import type { SiteContent } from "@/lib/doc/model";

/** schema.org type per template (R5: `LocalBusiness` when the template is a business). */
const TYPES: Record<string, string> = {
  cafe: "CafeOrCoffeeShop",
  restaurant: "Restaurant",
  salon: "BeautySalon",
  gym: "ExerciseGym",
  freelancer: "ProfessionalService",
  launch: "Product",
};

/** JSON-LD for a published site, escaped for an inline <script> (no `</script>` breakout). */
export function jsonLd(site: PublishedSite, url: string): string {
  const content = site.content as unknown as SiteContent;
  const type = TYPES[site.template] ?? "WebSite";
  const contact = content.sections.find((s) => s.type === "contact")?.props as Record<string, string> | undefined;
  const hero = content.sections.find((s) => s.type === "hero")?.props as { image?: { url?: string } } | undefined;
  const image = site.seo.og_image || hero?.image?.url;
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": type,
    name: content.site.name,
    url,
    ...(site.seo.description ? { description: site.seo.description } : {}),
    ...(image ? { image: image.startsWith("http") ? image : new URL(image, url).toString() } : {}),
  };
  if (type !== "Product" && contact) {
    if (contact.address) data.address = contact.address.replace(/\n/g, ", ");
    if (contact.phone) data.telephone = contact.phone;
    if (contact.email) data.email = contact.email;
    if (contact.hours) data.openingHours = contact.hours.replace(/\n/g, "; ");
  }
  return JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
