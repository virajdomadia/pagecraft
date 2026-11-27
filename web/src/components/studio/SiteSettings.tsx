"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { Avatar } from "@/components/studio/UserMenu";
import { StatusPill } from "@/components/studio/SiteCardView";
import { api, ApiError, errorMessage, type InviteCreated, type InviteOut, type Me, type SiteDetail } from "@/lib/api";
import type { Json } from "@/lib/doc/model";
import { prettyHost } from "@/lib/hosts";
import { useSlugCheck } from "@/lib/useSlugCheck";

const lbl = "font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted";
const inp =
  "mt-1.5 block w-full rounded-[3px] border border-line bg-paper px-3 py-2 text-[15px] outline-none focus:border-guide focus:ring-2 focus:ring-guide-soft disabled:bg-desk disabled:text-muted";
const primary = "min-h-10 rounded-[3px] bg-guide px-4 text-sm font-bold text-white hover:bg-guide-hover disabled:bg-line disabled:text-ink-2";

function Card({ id, title, children, intro }: { id: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-20 rounded-[4px] border border-line bg-paper p-5">
      <h2 id={`${id}-h`} className="text-[17px] font-extrabold tracking-tight">
        {title}
      </h2>
      {intro && <p className="mt-1 text-sm text-ink-2">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Notice({ ok, children }: { ok?: boolean; children: ReactNode }) {
  return (
    <p role="status" className={`text-sm ${ok ? "text-mint-ink" : "text-coral-ink"}`}>
      {children}
    </p>
  );
}

/** S10. Owner actions go through `PATCH/DELETE /sites/{id}`; editors see them read-only. */
export function SiteSettings({ initial, me }: { initial: SiteDetail; me: Me }) {
  const router = useRouter();
  const [site, setSite] = useState(initial);
  const owner = site.role === "owner";
  const locked = site.protected;

  return (
    <main id="main" className="mx-auto grid w-full max-w-[1000px] gap-6 px-4 py-8 sm:px-6 md:grid-cols-[200px_1fr]">
      <nav aria-label="Settings sections" className="md:sticky md:top-20 md:self-start">
        <p className={lbl}>Settings</p>
        <h1 className="mt-1 truncate text-[22px] font-extrabold tracking-tight">{site.name}</h1>
        <ul className="mt-4 grid gap-0.5 text-sm">
          {[
            ["general", "General"],
            ["address", "Address"],
            ["publishing", "Publishing"],
            ["seo", "Search & sharing"],
            ["people", "People"],
            ["plan", "Plan"],
            ["danger", "Delete site"],
          ].map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} className="block rounded-[3px] px-2 py-1.5 no-underline hover:bg-guide-soft">
                {label}
              </a>
            </li>
          ))}
        </ul>
        <Link href={`/sites/${site.id}/edit`} className="mt-4 inline-flex min-h-10 items-center rounded-[3px] bg-ink px-3 text-sm font-semibold text-white no-underline hover:bg-guide">
          Open the editor
        </Link>
      </nav>

      <div className="grid content-start gap-5">
        {!owner && (
          <p className="rounded-[3px] border border-line bg-guide-soft px-4 py-3 text-sm text-ink-2">
            You&apos;re an <b>editor</b> on this site: you can edit and publish it, but only its owner can rename, move or delete it.
          </p>
        )}
        {locked && owner && (
          <p className="rounded-[3px] border border-line bg-guide-soft px-4 py-3 text-sm text-ink-2">
            Demo sites keep the address they were given and can&apos;t be unpublished or deleted; the whole sandbox is removed after 24 hours.{" "}
            <Link href="/sign-up" className="font-semibold text-guide">
              Create an account
            </Link>{" "}
            to try those.
          </p>
        )}
        <General site={site} owner={owner} onSaved={setSite} />
        <Address site={site} owner={owner && !locked} onSaved={setSite} />
        <Publishing site={site} locked={locked} onChange={setSite} />
        <Seo site={site} owner={owner} onSaved={setSite} />
        <People site={site} me={me} owner={owner} onChange={setSite} />
        <Card id="plan" title="Plan">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-2">
              <b className="text-ink">Free</b>: up to 3 sites, a Pagecraft address and a small “Made with Pagecraft” badge on the published page.
            </p>
            <span className="rounded-full border border-line px-2.5 py-1 font-mono text-xs text-muted">Pro coming soon</span>
          </div>
        </Card>
        <Danger site={site} owner={owner && !locked} onDeleted={() => router.push("/sites")} />
      </div>
    </main>
  );
}

function General({ site, owner, onSaved }: { site: SiteDetail; owner: boolean; onSaved: (s: SiteDetail) => void }) {
  const [name, setName] = useState(site.name);
  const [state, setState] = useState<{ busy?: boolean; ok?: string; error?: string }>({});
  async function save(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      onSaved(await api<SiteDetail>(`/sites/${site.id}`, { method: "PATCH", json: { name: name.trim() } }));
      setState({ ok: "Saved. The editor and dashboard show the new name." });
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }
  return (
    <Card id="general" title="General">
      <form onSubmit={save} className="grid gap-3">
        <label className="block">
          <span className={lbl}>Site name</span>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} required disabled={!owner} />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={primary} disabled={!owner || state.busy || !name.trim() || name.trim() === site.name}>
            {state.busy ? "Saving…" : "Save name"}
          </button>
          {state.ok && <Notice ok>{state.ok}</Notice>}
          {state.error && <Notice>{state.error}</Notice>}
        </div>
      </form>
    </Card>
  );
}

function Address({ site, owner, onSaved }: { site: SiteDetail; owner: boolean; onSaved: (s: SiteDetail) => void }) {
  const [slug, setSlug] = useState(site.slug);
  const check = useSlugCheck(slug, { siteId: site.id, current: site.slug });
  const [state, setState] = useState<{ busy?: boolean; ok?: string; error?: string }>({});
  async function save(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      onSaved(await api<SiteDetail>(`/sites/${site.id}`, { method: "PATCH", json: { slug } }));
      setState({ ok: site.status === "published" ? "Moved. The old address now shows “not published”." : "Saved." });
    } catch (err) {
      if (err instanceof ApiError && typeof err.details.suggestion === "string") setSlug(err.details.suggestion);
      setState({ error: errorMessage(err) });
    }
  }
  return (
    <Card id="address" title="Address" intro={<>Where the site lives: <span className="font-mono text-[13px]">{prettyHost(site.slug)}</span> and <span className="font-mono text-[13px]">/s/{site.slug}</span>.</>}>
      <form onSubmit={save} className="grid gap-3">
        <label className="block">
          <span className={lbl}>Slug</span>
          <input className={`${inp} font-mono text-sm`} value={slug} maxLength={40} disabled={!owner} spellCheck={false} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} />
          <span className="mt-1 block min-h-4 text-xs" aria-live="polite">
            {check.state === "bad" ? (
              <span className="text-coral-ink">
                {check.message}
                {check.suggestion && (
                  <>
                    {" "}
                    <button type="button" className="font-semibold text-guide underline" onClick={() => setSlug(check.suggestion!)}>
                      use {check.suggestion}
                    </button>
                  </>
                )}
              </span>
            ) : site.status === "published" && slug !== site.slug ? (
              <span className="text-ink-2">Old links stop working when you move a published site (no redirects).</span>
            ) : null}
          </span>
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={primary} disabled={!owner || state.busy || slug === site.slug || check.state !== "ok"}>
            {state.busy ? "Saving…" : "Change address"}
          </button>
          {state.ok && <Notice ok>{state.ok}</Notice>}
          {state.error && <Notice>{state.error}</Notice>}
        </div>
      </form>
    </Card>
  );
}

function Publishing({ site, locked, onChange }: { site: SiteDetail; locked: boolean; onChange: (s: SiteDetail) => void }) {
  const [state, setState] = useState<{ busy?: boolean; error?: string; confirm?: boolean }>({});
  const live = site.status === "published";
  async function unpublish() {
    setState({ busy: true });
    try {
      await api(`/sites/${site.id}/unpublish`, { method: "POST" });
      onChange({ ...site, status: "draft", published_url: null });
      setState({});
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }
  return (
    <Card id="publishing" title="Publishing">
      <div className="flex flex-wrap items-center gap-3">
        <StatusPill status={site.status} />
        <p className="text-sm text-ink-2">
          {live ? (
            <>
              Version {site.published_version} is live at{" "}
              <a href={`/s/${site.slug}`} target="_blank" rel="noopener" className="font-mono text-[13px] text-guide">
                /s/{site.slug} ↗
              </a>
            </>
          ) : site.published_version ? (
            "Unpublished. Visitors see “not published”."
          ) : (
            "Not published yet."
          )}
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Link href={`/sites/${site.id}/edit`} className="inline-flex min-h-10 items-center rounded-[3px] border border-line px-4 text-sm font-semibold no-underline hover:border-ink">
          {live ? "Edit and publish changes" : "Open the editor to publish"}
        </Link>
        {live &&
          !locked &&
          (state.confirm ? (
            <>
              <span className="text-sm text-ink-2">Take it offline?</span>
              <button type="button" className="min-h-10 rounded-[3px] bg-coral px-4 text-sm font-bold text-ink disabled:opacity-60" disabled={state.busy} onClick={unpublish}>
                {state.busy ? "Unpublishing…" : "Yes, unpublish"}
              </button>
              <button type="button" className="min-h-10 px-2 text-sm font-semibold" onClick={() => setState({})}>
                Cancel
              </button>
            </>
          ) : (
            <button type="button" className="min-h-10 rounded-[3px] border border-coral/60 px-4 text-sm font-semibold text-coral-ink hover:bg-coral/10" onClick={() => setState({ confirm: true })}>
              Unpublish
            </button>
          ))}
      </div>
      {state.error && <div className="mt-2"><Notice>{state.error}</Notice></div>}
    </Card>
  );
}

function Seo({ site, owner, onSaved }: { site: SiteDetail; owner: boolean; onSaved: (s: SiteDetail) => void }) {
  const [title, setTitle] = useState(site.seo.title ?? "");
  const [description, setDescription] = useState(site.seo.description ?? "");
  const [state, setState] = useState<{ busy?: boolean; ok?: string; error?: string }>({});
  async function save(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      const seo = { title: title.trim(), description: description.trim(), og_image: site.seo.og_image ?? "" };
      onSaved(await api<SiteDetail>(`/sites/${site.id}`, { method: "PATCH", json: { seo } as Record<string, Json> }));
      setState({ ok: "Saved. Used the next time you publish." });
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }
  return (
    <Card id="seo" title="Search & sharing" intro="The title and description search engines and link previews show. The share image is picked in the publish dialog.">
      <form onSubmit={save} className="grid gap-3">
        <label className="block">
          <span className="flex justify-between">
            <span className={lbl}>Title</span>
            <span className="font-mono text-xs text-muted">{title.length}/70</span>
          </span>
          <input className={inp} value={title} maxLength={70} disabled={!owner} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block">
          <span className="flex justify-between">
            <span className={lbl}>Description</span>
            <span className="font-mono text-xs text-muted">{description.length}/160</span>
          </span>
          <textarea className={`${inp} min-h-[70px]`} value={description} maxLength={160} rows={2} disabled={!owner} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" className={primary} disabled={!owner || state.busy}>
            {state.busy ? "Saving…" : "Save"}
          </button>
          {state.ok && <Notice ok>{state.ok}</Notice>}
          {state.error && <Notice>{state.error}</Notice>}
        </div>
      </form>
    </Card>
  );
}

function Danger({ site, owner, onDeleted }: { site: SiteDetail; owner: boolean; onDeleted: () => void }) {
  const [typed, setTyped] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string }>({});
  async function remove(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    try {
      await api(`/sites/${site.id}`, { method: "DELETE" });
      onDeleted();
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }
  return (
    <section id="danger" aria-labelledby="danger-h" className="scroll-mt-20 rounded-[4px] border border-coral/50 bg-paper p-5">
      <h2 id="danger-h" className="text-[17px] font-extrabold tracking-tight text-coral-ink">
        Delete site
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        Deletes the document, every published version and uploaded image. The address stops working at once. This can&apos;t be undone.
      </p>
      <form onSubmit={remove} className="mt-4 grid gap-3">
        <label className="block">
          <span className={lbl}>Type the site&apos;s name to confirm: {site.name}</span>
          <input className={inp} value={typed} disabled={!owner} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </label>
        <div className="flex items-center gap-3">
          <button type="submit" disabled={!owner || state.busy || typed.trim() !== site.name} className="min-h-10 rounded-[3px] bg-coral px-4 text-sm font-bold text-ink disabled:opacity-40">
            {state.busy ? "Deleting…" : "Delete this site"}
          </button>
          {state.error && <Notice>{state.error}</Notice>}
        </div>
      </form>
    </section>
  );
}

/**
 * L4: members, pending invites and the invite form. With email off (or in the demo, where only
 * @example.com addresses can be invited) the owner gets the link to share instead; it only
 * works for the invited address.
 */
function People({ site, me, owner, onChange }: { site: SiteDetail; me: Me; owner: boolean; onChange: (s: SiteDetail) => void }) {
  const [pending, setPending] = useState<InviteOut[]>([]);
  const [address, setAddress] = useState("");
  const [state, setState] = useState<{ busy?: boolean; error?: string; sent?: InviteCreated }>({});
  const [copied, setCopied] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (owner) api<InviteOut[]>(`/sites/${site.id}/invites`).then(setPending, () => {});
  }, [owner, site.id]);

  async function invite(e: FormEvent) {
    e.preventDefault();
    setState({ busy: true });
    setCopied(false);
    try {
      const sent = await api<InviteCreated>(`/sites/${site.id}/invites`, { method: "POST", json: { email: address } });
      setPending((p) => [...p.filter((i) => i.email !== sent.invite.email), sent.invite]);
      setAddress("");
      setState({ sent });
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/sites/${site.id}/invites/${id}`, { method: "DELETE" });
      setPending((p) => p.filter((i) => i.id !== id));
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }

  async function remove(id: string) {
    try {
      await api(`/sites/${site.id}/members/${id}`, { method: "DELETE" });
      onChange({ ...site, members: site.members.filter((m) => m.id !== id) });
      setConfirm(null);
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }

  const row = "flex items-center gap-3 rounded-[3px] border border-line px-3 py-2";
  const small = "min-h-8 shrink-0 rounded-[3px] border border-line px-2.5 text-xs font-semibold text-ink-2 hover:border-guide";
  return (
    <Card id="people" title="People" intro="Who can open this site in the editor and edit it with you, live.">
      <ul className="grid gap-2" aria-label="Members">
        {site.members.map((m) => (
          <li key={m.id} className={row}>
            <Avatar name={m.name} colour={m.avatar_colour} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">
                {m.name} {m.id === me.id && <span className="font-normal text-muted">(you)</span>}
              </span>
              <span className="block truncate font-mono text-xs text-muted">{m.email}</span>
            </span>
            <span className="rounded-full bg-desk px-2 py-0.5 font-mono text-xs capitalize">{m.role}</span>
            {owner &&
              m.role !== "owner" &&
              (confirm === m.id ? (
                <span className="flex gap-1.5">
                  <button type="button" className={small} onClick={() => setConfirm(null)}>
                    Keep
                  </button>
                  <button type="button" className="min-h-8 rounded-[3px] bg-coral px-2.5 text-xs font-bold text-ink" onClick={() => remove(m.id)}>
                    Remove {m.name.split(" ")[0]}
                  </button>
                </span>
              ) : (
                <button type="button" className={small} onClick={() => setConfirm(m.id)} aria-label={`Remove ${m.name}`}>
                  Remove
                </button>
              ))}
          </li>
        ))}
      </ul>

      {owner && (
        <>
          {pending.length > 0 && (
            <>
              <h3 className={`${lbl} mt-5`}>Invited, not joined yet</h3>
              <ul className="mt-2 grid gap-2" aria-label="Pending invites">
                {pending.map((i) => (
                  <li key={i.id} className={row}>
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">{i.email}</span>
                    <span className="hidden text-xs text-muted sm:inline">
                      until {new Date(i.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                    <button type="button" className={small} onClick={() => revoke(i.id)} aria-label={`Cancel the invite to ${i.email}`}>
                      Cancel invite
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <form onSubmit={invite} className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block">
              <span className={lbl}>Invite an editor by email</span>
              <input
                className={inp}
                type="email"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={site.protected ? "someone@example.com" : "name@company.in"}
                autoComplete="off"
              />
            </label>
            <button type="submit" className={primary} disabled={state.busy || !address.trim()}>
              {state.busy ? "Inviting…" : "Send invite"}
            </button>
          </form>
          {site.protected && <p className="mt-2 text-xs text-muted">In the demo you can invite @example.com addresses only. The link appears here instead of going by email.</p>}
          {state.error && (
            <div className="mt-2">
              <Notice>{state.error}</Notice>
            </div>
          )}
          {state.sent?.emailed && (
            <div className="mt-2">
              <Notice ok>Invite emailed to {state.sent.invite.email}. It works for 7 days.</Notice>
            </div>
          )}
          {state.sent?.link && (
            <div className="mt-3 rounded-[3px] border border-line bg-guide-soft p-3" role="status">
              <p className="text-sm text-ink-2">
                <b className="text-ink">{site.protected ? "Email is off in the demo." : "Email is off right now."}</b> Here&apos;s the link for {state.sent.invite.email}{" "}
                to share yourself. It only works for that address, for 7 days.
              </p>
              <div className="mt-2 flex gap-2">
                <input className={`${inp} !mt-0 font-mono text-xs`} readOnly value={state.sent.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
                <button type="button" className={small} onClick={() => navigator.clipboard?.writeText(state.sent?.link ?? "").then(() => setCopied(true), () => {})}>
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
