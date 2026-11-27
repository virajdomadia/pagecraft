import Link from "next/link";
import { SiteRenderer } from "@/components/renderer/SiteRenderer";
import { Scaled } from "@/components/studio/Scaled";
import type { SiteCard } from "@/lib/api";
import type { SiteContent } from "@/lib/doc/model";
import { timeAgo } from "@/lib/format";
import { prettyHost } from "@/lib/hosts";

export function StatusPill({ status }: { status: "draft" | "published" }) {
  const live = status === "published";
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-xs text-ink-2">
      <i className={`h-1.5 w-1.5 rounded-full ${live ? "bg-mint" : "bg-[#B8B8CC]"}`} aria-hidden="true" />
      {live ? "Published" : "Draft"}
    </span>
  );
}

/** One dashboard card: the site's real nav + hero at 1280 px, scaled (R1 — no screenshots). */
export function SiteCardView({ site }: { site: SiteCard }) {
  const content = site.preview as unknown as SiteContent;
  return (
    <article className="group overflow-hidden rounded-[4px] border border-line bg-paper transition hover:border-guide">
      <div className="relative border-b border-line">
        <Scaled width={1280} height={720} className="bg-desk">
          <SiteRenderer content={content} as="div" />
        </Scaled>
        {/* A sibling, not a wrapper: the preview contains the site's own links. */}
        <Link href={`/sites/${site.id}/edit`} className="absolute inset-0" aria-label={`Edit ${site.name}`} />
      </div>
      <div className="grid gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="truncate text-[17px] font-extrabold tracking-tight">
            <Link href={`/sites/${site.id}/edit`} className="no-underline hover:text-guide">
              {site.name}
            </Link>
          </h2>
          <StatusPill status={site.status} />
        </div>
        <p className="truncate font-mono text-xs text-muted">
          {site.published_url ? (
            <a href={`/s/${site.slug}`} className="text-guide no-underline hover:underline" target="_blank" rel="noopener">
              {prettyHost(site.slug)}
            </a>
          ) : (
            <>{prettyHost(site.slug)} · not published</>
          )}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-ink-2">
          <span>
            Edited {timeAgo(site.updated_at)}
            {site.role === "editor" && <span className="ml-2 rounded-full bg-guide-soft px-2 py-0.5 font-mono text-xs text-guide">Editor</span>}
          </span>
          <span className="flex gap-1">
            <Link href={`/sites/${site.id}/settings`} className="rounded-[3px] px-2 py-1.5 font-semibold no-underline hover:bg-guide-soft">
              Settings
            </Link>
            <Link href={`/sites/${site.id}/edit`} className="rounded-[3px] bg-ink px-2.5 py-1.5 font-semibold text-white no-underline hover:bg-guide">
              Edit
            </Link>
          </span>
        </div>
      </div>
    </article>
  );
}
