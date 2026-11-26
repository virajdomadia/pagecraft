import type { Metadata } from "next";
import { AppBar } from "@/components/studio/AppBar";
import { SiteSettings } from "@/components/studio/SiteSettings";
import type { SiteDetail } from "@/lib/api";
import { loadOr404, requireMe } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Site settings — Pagecraft" };

/** S10: rename, address, SEO defaults, publishing, plan, delete. */
export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireMe(`/sites/${id}/settings`);
  const site = await loadOr404<SiteDetail>(`/sites/${id}`);
  return (
    <>
      <AppBar me={me} crumbs={[{ href: "/sites", label: "Sites" }, { href: `/sites/${id}/edit`, label: site.name }, { label: "Settings" }]} />
      <SiteSettings initial={site} me={me} />
    </>
  );
}
