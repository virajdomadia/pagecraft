"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, errorMessage, type InvitePreview, type Me, type SiteCard } from "@/lib/api";

const card = "pc-rise w-full max-w-[440px] rounded-[4px] border border-line bg-paper p-7 shadow-[0_30px_60px_-40px_rgba(27,27,47,.45)]";
const link = "font-semibold text-guide underline-offset-2 hover:underline";
const button = "min-h-11 w-full rounded-[3px] bg-guide px-4 py-2.5 font-bold text-white transition hover:bg-guide-hover disabled:opacity-60";

/**
 * S12: accept an invite to edit a site. Bound to the invited address. Loaded in the browser, so
 * the API's per-IP limit sees the visitor (through the /api rewrite), not this app's server.
 */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<{ invite: InvitePreview | null; me: Me | null; failed?: boolean } | null>(null);
  useEffect(() => {
    Promise.all([
      api<InvitePreview>(`/invites/${token}`).catch((err) => {
        if (err instanceof ApiError && err.status === 404) return null;
        throw err;
      }),
      api<Me>("/auth/me").catch(() => null),
    ]).then(
      ([invite, me]) => setLoaded({ invite, me }),
      () => setLoaded({ invite: null, me: null, failed: true }),
    );
  }, [token]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const here = `/invites/${token}`;

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      const site = await api<SiteCard>(`/invites/${token}/accept`, { method: "POST" });
      router.push(`/sites/${site.id}/edit`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  if (!loaded)
    return (
      <p className="font-mono text-xs text-muted" role="status">
        Opening the invite…
      </p>
    );
  const { invite, me } = loaded;
  let body: React.ReactNode;
  if (loaded.failed) body = <p className="mt-3 text-ink-2" role="alert">Couldn&apos;t reach Pagecraft. Reload the page to try again.</p>;
  else if (!invite) body = <p className="mt-3 text-ink-2">This invite link doesn&apos;t work. Ask whoever sent it for a new one.</p>;
  else if (invite.status !== "pending")
    body = (
      <p className="mt-3 text-ink-2">
        This invite has {invite.status === "used" ? "already been used" : "expired"}. Ask {invite.invited_by ?? "the owner"} for a new one.
      </p>
    );
  else if (invite.demo)
    body = (
      <p className="mt-3 text-ink-2">
        This invite was made in the Pagecraft demo. Demo invites show how inviting works but can&apos;t be accepted.{" "}
        <Link className={link} href="/sign-up">
          Create an account
        </Link>{" "}
        to invite real teammates.
      </p>
    );
  else if (!me)
    body = (
      <div className="mt-5 grid gap-2">
        <p className="text-ink-2">
          Sign in or create an account as <b className="text-ink">{invite.email}</b> to join.
        </p>
        <Link href={`/sign-up?next=${encodeURIComponent(here)}`} className={`${button} grid place-items-center no-underline`}>
          Create an account
        </Link>
        <Link href={`/sign-in?next=${encodeURIComponent(here)}`} className={`${link} mt-1 text-center text-sm`}>
          I already have one: sign in
        </Link>
      </div>
    );
  else if (me.email !== invite.email)
    body = (
      <p className="mt-3 text-ink-2">
        You&apos;re signed in as <b className="text-ink">{me.email}</b>, but this invite is for <b className="text-ink">{invite.email}</b>.{" "}
        <Link className={link} href={`/sign-in?next=${encodeURIComponent(here)}`}>
          Sign in with that email
        </Link>
        .
      </p>
    );
  else
    body = (
      <div className="mt-5 grid gap-3">
        <button type="button" onClick={accept} disabled={busy} className={button}>
          {busy ? "Joining…" : `Join and open ${invite.site_name}`}
        </button>
        {error && (
          <p role="alert" className="text-sm text-coral-ink">
            {error}
          </p>
        )}
      </div>
    );

  return (
    <div className={card}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Invite</p>
      <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">
        {invite ? `${invite.invited_by ?? "Someone"} invited you to edit ${invite.site_name}` : "Invite not found"}
      </h1>
      {body}
    </div>
  );
}
