import type { Metadata } from "next";
import { TeammateGate } from "@/components/editor/TeammateGate";
import { ApiError, type Me, type SiteDetail } from "@/lib/api";
import { loadOr404, serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ new?: string; together?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const site = await loadOr404<SiteDetail>(`/sites/${id}`);
    return { title: `${site.name} — editor · Pagecraft` };
  } catch {
    return { title: "Editor · Pagecraft" };
  }
}

/**
 * S5. The page checks access as the cookie's user and passes the site; the document loads in the
 * browser. No access is not final here: a teammate tab (L3) authenticates itself in the browser,
 * so TeammateGate decides between the editor, sign-in and the 404 page.
 */
export default async function EditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { new: fresh, together } = await searchParams;
  let me: Me | null = null;
  let site: SiteDetail | null = null;
  try {
    me = await serverApi<Me>("/auth/me");
    site = await serverApi<SiteDetail>(`/sites/${id}`);
  } catch (err) {
    if (!(err instanceof ApiError && [401, 404, 422].includes(err.status))) throw err;
  }
  return <TeammateGate siteId={id} site={site} me={me} fresh={fresh === "1"} together={together === "1"} />;
}
