import Link from "next/link";
import { LogoMark } from "@/components/studio/Logo";

/** S11 — what a visitor sees at an unpublished or unknown address: honest, small, one way out. */
export default function NotPublished() {
  return (
    <main className="bp-grid grid min-h-dvh place-items-center px-5 py-16 text-ink">
      <div className="w-full max-w-md rounded-[4px] border border-line bg-paper p-8 text-center">
        <LogoMark className="mx-auto h-10 w-10" />
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">404 · not published</p>
        <h1 className="mt-2 text-[26px] font-extrabold tracking-tight">This site is not published</h1>
        <p className="mt-2 text-ink-2">
          Its owner may have taken it down or moved it to a new address. If it&apos;s yours, sign in to publish it again.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="inline-flex min-h-11 items-center rounded-[3px] bg-guide px-4 font-bold text-white no-underline hover:bg-guide-hover">
            Make a site with Pagecraft
          </Link>
          <a href="/sites" className="inline-flex min-h-11 items-center rounded-[3px] border border-line px-4 font-semibold no-underline hover:border-ink">
            Your sites
          </a>
        </div>
      </div>
    </main>
  );
}
