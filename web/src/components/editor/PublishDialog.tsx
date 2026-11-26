"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, ApiError, errorMessage, type PublishOut } from "@/lib/api";
import type { Json, SiteContent } from "@/lib/doc/model";
import { prettyHost } from "@/lib/hosts";
import { useSlugCheck } from "@/lib/useSlugCheck";
import { validateSection } from "@/sections/registry";

const lbl = "font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted";
const inp =
  "mt-1 block w-full rounded-[3px] border border-line bg-paper px-3 py-2 text-[14px] outline-none focus:border-guide focus:ring-2 focus:ring-guide-soft";

function imagesIn(value: Json | undefined, out = new Map<string, string>()): Map<string, string> {
  if (Array.isArray(value)) value.forEach((v) => imagesIn(v, out));
  else if (value && typeof value === "object") {
    const o = value as Record<string, Json>;
    if (typeof o.url === "string" && o.url && !out.has(o.url)) out.set(o.url, typeof o.alt === "string" ? o.alt : "");
    Object.values(o).forEach((v) => imagesIn(v, out));
  }
  return out;
}

/**
 * S8: slug, SEO title / description with counts, OG image from the site's photos → Publish.
 * Publishing first drains the autosave queue (the API publishes what it has, never what the
 * browser says), writes the SEO fields into the document, then calls `POST /sites/{id}/publish`.
 */
export function PublishDialog({
  siteId,
  slug: currentSlug,
  published,
  protectedSite,
  content,
  onClose,
  onPublish,
  onInvalid,
  onDone,
}: {
  siteId: string;
  slug: string;
  published: boolean;
  protectedSite: boolean;
  content: SiteContent;
  onClose: () => void;
  /** Persist SEO into the doc and wait for autosave; returns false if saving failed. */
  onPublish: (seo: { title: string; description: string; og_image: string }) => Promise<boolean>;
  onInvalid: (sectionId: string, message: string) => void;
  onDone: (res: PublishOut) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const seo = content.site.seo ?? {};
  const [slug, setSlug] = useState(currentSlug);
  const [title, setTitle] = useState(String(seo.title ?? content.site.name ?? ""));
  const [description, setDescription] = useState(String(seo.description ?? ""));
  const [og, setOg] = useState(String(seo.og_image ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<PublishOut | null>(null);
  const [copied, setCopied] = useState(false);
  const check = useSlugCheck(slug, { siteId, current: currentSlug });
  const images = useMemo(() => [...imagesIn(content.sections as unknown as Json).entries()], [content.sections]);
  const firstIssue = useMemo(() => content.sections.map(validateSection).find(Boolean) ?? null, [content.sections]);

  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  async function publish() {
    if (firstIssue?.sectionId) {
      onInvalid(firstIssue.sectionId, firstIssue.message);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const seoNext = { title: title.trim(), description: description.trim(), og_image: og };
      if (!(await onPublish(seoNext))) throw new ApiError(0, "offline", "Your latest changes haven't saved yet — check your connection and try again.");
      const res = await api<PublishOut>(`/sites/${siteId}/publish`, { method: "POST", json: { slug, seo: seoNext } });
      setDone(res);
      onDone(res);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "invalid_content" && typeof err.details.section_id === "string") {
        onInvalid(err.details.section_id, err.message);
        return;
      }
      if (err instanceof ApiError && err.code === "slug_taken" && typeof err.details.suggestion === "string") {
        setError(`${slug} is taken — try ${err.details.suggestion}.`);
        setSlug(err.details.suggestion);
        return;
      }
      setError(errorMessage(err));
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the link is still on screen */
    }
  }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(560px,calc(100vw-32px))] rounded-[4px] border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/40"
      aria-labelledby="publish-title"
    >
      {done ? (
        <div className="pc-rise p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mint-ink">● Live · version {done.version}</p>
          <h2 id="publish-title" className="mt-1 text-[22px] font-extrabold tracking-tight">
            Your site is published
          </h2>
          <p className="mt-1 text-sm text-ink-2">Anyone with the link can see it now. Publish again whenever you change something.</p>
          <div className="mt-4 flex items-center gap-2 rounded-[3px] border border-guide bg-guide-soft p-2 pl-3">
            <a href={done.path} target="_blank" rel="noopener" className="min-w-0 flex-1 truncate font-mono text-[13px] font-medium text-guide">
              {done.url.replace(/^https?:\/\//, "")}
            </a>
            <button type="button" onClick={() => copy(done.url)} className="rounded-[3px] bg-paper px-2.5 py-1.5 text-xs font-semibold hover:bg-desk" aria-live="polite">
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
          <p className="mt-2 font-mono text-[11px] text-muted">
            Also at {prettyHost(done.slug)} once Pagecraft&apos;s wildcard domain is switched on.
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-[3px] border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
              Keep editing
            </button>
            <a href={done.path} target="_blank" rel="noopener" className="rounded-[3px] bg-guide px-4 py-2 text-sm font-bold text-white no-underline hover:bg-guide-hover">
              View site ↗
            </a>
          </div>
        </div>
      ) : (
        <form
          method="dialog"
          className="grid gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault();
            void publish();
          }}
        >
          <div>
            <p className={lbl}>{published ? "Publish changes" : "First publish"}</p>
            <h2 id="publish-title" className="mt-1 text-[22px] font-extrabold tracking-tight">
              Publish {content.site.name}
            </h2>
          </div>

          <label className="block">
            <span className={lbl}>Address</span>
            <span className="mt-1 flex items-stretch overflow-hidden rounded-[3px] border border-line focus-within:border-guide">
              <span className="flex items-center bg-desk px-2 font-mono text-[12px] text-muted">/s/</span>
              <input
                className="min-w-0 flex-1 px-2 py-2 font-mono text-[13px] outline-none disabled:bg-desk disabled:text-muted"
                value={slug}
                disabled={protectedSite}
                maxLength={40}
                spellCheck={false}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              />
            </span>
            <span className="mt-1 block min-h-4 text-[11.5px]" aria-live="polite">
              {protectedSite ? (
                <span className="text-muted">The demo site&apos;s address stays fixed.</span>
              ) : check.state === "bad" ? (
                <span className="text-coral-ink">
                  {check.message}
                  {check.suggestion && (
                    <>
                      {" — "}
                      <button type="button" className="font-semibold text-guide underline" onClick={() => setSlug(check.suggestion!)}>
                        use {check.suggestion}
                      </button>
                    </>
                  )}
                </span>
              ) : check.state === "checking" ? (
                <span className="text-muted">Checking…</span>
              ) : published && slug !== currentSlug ? (
                <span className="text-ink-2">The old address will stop working (no redirects).</span>
              ) : (
                <span className="text-muted">{prettyHost(slug)}</span>
              )}
            </span>
          </label>

          <label className="block">
            <span className="flex justify-between">
              <span className={lbl}>Search title</span>
              <span className="font-mono text-[10px] text-muted">{title.length}/70</span>
            </span>
            <input className={inp} value={title} maxLength={70} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="block">
            <span className="flex justify-between">
              <span className={lbl}>Search description</span>
              <span className="font-mono text-[10px] text-muted">{description.length}/160</span>
            </span>
            <textarea className={`${inp} min-h-[64px]`} value={description} maxLength={160} rows={2} onChange={(e) => setDescription(e.target.value)} />
          </label>

          <fieldset>
            <legend className={lbl}>Share image</legend>
            <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                aria-pressed={og === ""}
                onClick={() => setOg("")}
                className={`grid h-14 w-20 shrink-0 place-items-center rounded-[3px] border-2 font-mono text-[10px] text-muted ${og === "" ? "border-guide" : "border-line"}`}
              >
                none
              </button>
              {images.map(([url, alt]) => (
                <button
                  key={url}
                  type="button"
                  aria-pressed={og === url}
                  aria-label={`Use as share image: ${alt || url}`}
                  onClick={() => setOg(url)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-[3px] border-2 ${og === url ? "border-guide" : "border-transparent hover:border-guide/50"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </fieldset>

          {firstIssue && (
            <p className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
              {firstIssue.message}.{" "}
              <button type="button" className="font-semibold underline" onClick={() => firstIssue.sectionId && onInvalid(firstIssue.sectionId, firstIssue.message)}>
                Show me
              </button>
            </p>
          )}
          {error && (
            <p role="alert" className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-[3px] border border-line px-4 py-2 text-sm font-semibold hover:border-ink">
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || check.state === "bad" || check.state === "checking"}
              className="min-w-28 rounded-[3px] bg-guide px-4 py-2 text-sm font-bold text-white hover:bg-guide-hover disabled:opacity-60"
            >
              {busy ? "Publishing…" : published ? "Publish changes" : "Publish"}
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
