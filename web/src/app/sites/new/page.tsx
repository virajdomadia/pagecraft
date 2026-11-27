import type { Metadata } from "next";
import { AppBar } from "@/components/studio/AppBar";
import { TemplatePicker } from "@/components/studio/TemplatePicker";
import type { SitesOut, TemplateOut } from "@/lib/api";
import { requireMe, serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New site — Pagecraft" };

/** S4: six templates, the chosen one rendered live, name + address. */
export default async function NewSite() {
  const me = await requireMe("/sites/new");
  const [templates, sites] = await Promise.all([serverApi<TemplateOut[]>("/templates"), serverApi<SitesOut>("/sites")]);
  return (
    <>
      <AppBar me={me} crumbs={[{ href: "/sites", label: "Sites" }, { label: "New site" }]} />
      <TemplatePicker templates={templates} atLimit={sites.owned >= sites.limit} limit={sites.limit} demo={me.demo} />
    </>
  );
}
