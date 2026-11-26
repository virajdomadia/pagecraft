import type { Metadata } from "next";
import { Editor } from "@/components/editor/Editor";
import type { SiteDetail } from "@/lib/api";
import { loadOr404, requireMe } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const site = await loadOr404<SiteDetail>(`/sites/${id}`);
    return { title: `${site.name} — editor · Pagecraft` };
  } catch {
    return { title: "Editor · Pagecraft" };
  }
}

/** S5. The page only checks access and passes the site; the document loads in the browser. */
export default async function EditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { new: fresh } = await searchParams;
  await requireMe(`/sites/${id}/edit`);
  const site = await loadOr404<SiteDetail>(`/sites/${id}`);
  return <Editor site={site} fresh={fresh === "1"} />;
}
