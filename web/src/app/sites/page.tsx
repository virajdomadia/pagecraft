import Link from "next/link";
import { SiteCardView } from "@/components/studio/SiteCardView";
import { AppBar } from "@/components/studio/AppBar";
import type { SitesOut } from "@/lib/api";
import { requireMe, serverApi } from "@/lib/server-api";

export const dynamic = "force-dynamic";

/** S3: the user's sites as live mini-renders, status, address and last edit. */
export default async function Dashboard() {
  const me = await requireMe("/sites");
  const { sites, limit, owned } = await serverApi<SitesOut>("/sites");
  const full = owned >= limit;

  return (
    <>
      <AppBar me={me} crumbs={[{ label: "Sites" }]} />
      <main id="main" className="mx-auto w-full max-w-[1180px] px-4 py-8 sm:px-6 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.08em] text-muted">Dashboard</p>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight">Your sites</h1>
            <p className="mt-1 text-sm text-ink-2">
              {me.demo
                ? `Private demo sandbox: only you see it, and it is deleted 24 hours after you opened it. ${owned} of ${limit} sites.`
                : `${owned} of ${limit} sites on the ${me.plan === "pro" ? "Pro" : "Free"} plan.`}
            </p>
            {me.demo && (
              <p className="mt-1 text-sm text-ink-2">
                <b>What to try:</b>{" "}
                {sites.some((s) => s.role === "editor")
                  ? "you're an editor here, so open the site, change a headline and publish it; only its owner can rename, move or delete it."
                  : "open the site, click the headline and type, switch the palette in the right panel, then Publish."}
              </p>
            )}
          </div>
          {full && (
            <p className="max-w-xs text-right text-sm text-ink-2">
              You&apos;ve used all {limit} free sites. Delete one in its settings to make room. Pro (20 sites) is coming soon.
            </p>
          )}
        </div>

        {sites.length === 0 ? (
          <div className="bp-grid bp-corners mt-10 grid place-items-center rounded-[4px] border border-dashed border-guide/50 px-6 py-16 text-center">
            <div className="max-w-md">
              <h2 className="text-xl font-extrabold">No sites yet</h2>
              <p className="mt-2 text-ink-2">Start from one of six templates (a café, a salon, a portfolio and more) and make it yours.</p>
              <Link
                href="/sites/new"
                className="mt-5 inline-flex min-h-11 items-center rounded-[3px] bg-guide px-4 font-bold text-white no-underline hover:bg-guide-hover"
              >
                Pick a template
              </Link>
            </div>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {sites.map((s) => (
              <li key={s.id}>
                <SiteCardView site={s} />
              </li>
            ))}
            {!full && (
              <li>
                <Link
                  href="/sites/new"
                  className="grid h-full min-h-48 place-items-center rounded-[4px] border border-dashed border-guide/60 bg-guide-soft/40 font-bold text-guide no-underline transition hover:border-guide hover:bg-guide-soft"
                >
                  <span>
                    <span aria-hidden="true">+</span> New site
                  </span>
                </Link>
              </li>
            )}
          </ul>
        )}
      </main>
    </>
  );
}
