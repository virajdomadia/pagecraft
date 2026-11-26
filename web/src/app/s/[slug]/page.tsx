import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/renderer/Badge";
import { SiteRenderer } from "@/components/renderer/SiteRenderer";
import { SiteScript } from "@/components/renderer/SiteScript";
import type { PublishedSite } from "@/lib/api";
import type { SiteContent } from "@/lib/doc/model";
import { jsonLd } from "@/lib/jsonld";
import { normaliseTheme, PALETTES } from "@/lib/themes";
import { site as pagecraft } from "@/lib/site";

/*
 * S9 — a published site (04 §7). ISR: rendered on first visit, cached, refreshed every 60 s and
 * immediately when the API's publish calls /api/revalidate with the `site:{slug}` tag.
 */
export const revalidate = 60;
export const dynamicParams = true;

export async function generateStaticParams() {
  return []; // on demand: a site is rendered on its first visit, then served from cache
}

type Props = { params: Promise<{ slug: string }> };

async function load(slug: string): Promise<PublishedSite | null> {
  if (!/^[a-z0-9-]{1,40}$/.test(slug)) return null;
  const api = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
  const res = await fetch(`${api}/public/sites/${slug}`, { next: { tags: [`site:${slug}`], revalidate: 60 } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`API answered ${res.status} for ${slug}`);
  return (await res.json()) as PublishedSite;
}

function absolute(url: string): string {
  return url.startsWith("http") ? url : `${pagecraft.url}${url}`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const site = await load(slug);
  if (!site) return { title: "Not published", robots: { index: false } };
  const content = site.content as unknown as SiteContent;
  const title = site.seo.title || content.site.name;
  const description = site.seo.description || undefined;
  const image = site.seo.og_image ? absolute(site.seo.og_image) : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/s/${slug}` },
    icons: { icon: "/icon.svg" },
    openGraph: { title, description, type: "website", url: `/s/${slug}`, siteName: content.site.name, images: image ? [image] : undefined },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, images: image ? [image] : undefined },
  };
}

export async function generateViewport({ params }: Props): Promise<Viewport> {
  const { slug } = await params;
  const site = await load(slug);
  const theme = normaliseTheme((site?.content as unknown as SiteContent | undefined)?.site.theme);
  return { themeColor: PALETTES[theme.palette].bg };
}

export default async function PublishedPage({ params }: Props) {
  const { slug } = await params;
  const site = await load(slug);
  if (!site) notFound();
  const content = site.content as unknown as SiteContent;
  return (
    <>
      <SiteRenderer content={content}>
        {site.plan !== "pro" && <Badge />}
      </SiteRenderer>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(site, `${pagecraft.url}/s/${slug}`) }} />
      <SiteScript />
    </>
  );
}
