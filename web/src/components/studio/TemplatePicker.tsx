"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { SiteRenderer } from "@/components/renderer/SiteRenderer";
import { Scaled } from "@/components/studio/Scaled";
import { api, ApiError, errorMessage, type SiteCard, type TemplateOut } from "@/lib/api";
import type { SiteContent } from "@/lib/doc/model";
import { prettyHost } from "@/lib/hosts";
import { slugify } from "@/lib/slug";
import { PALETTES, type PaletteKey } from "@/lib/themes";
import { REGISTRY } from "@/sections/registry";
import type { SectionType } from "@/sections/types";
import { useSlugCheck } from "@/lib/useSlugCheck";

const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted";
const input =
  "mt-1.5 block w-full rounded-[3px] border border-line bg-paper px-3 py-2.5 text-[15px] outline-none focus:border-guide focus:ring-2 focus:ring-guide-soft";

export function TemplatePicker({
  templates,
  atLimit,
  limit,
  demo,
}: {
  templates: TemplateOut[];
  atLimit: boolean;
  limit: number;
  demo: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState(templates[0]?.key ?? "cafe");
  const [name, setName] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugInput, setSlugInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slug = slugEdited ? slugInput : name.trim() ? slugify(name) : "";
  const check = useSlugCheck(slug);
  const tpl = templates.find((t) => t.key === key) ?? templates[0];
  const content = tpl?.content as unknown as SiteContent | undefined;

  const sectionsLine = useMemo(
    () =>
      (content?.sections ?? [])
        .map((s) => REGISTRY[s.type as SectionType]?.label.toLowerCase())
        .filter(Boolean)
        .join(" · "),
    [content],
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give your site a name — you can change it later.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const site = await api<SiteCard>("/sites", { method: "POST", json: { name: name.trim(), template: key, slug } });
      router.push(`/sites/${site.id}/edit?new=1`);
    } catch (err) {
      setBusy(false);
      if (err instanceof ApiError && err.code === "slug_taken" && typeof err.details.suggestion === "string") {
        setSlugEdited(true);
        setSlugInput(err.details.suggestion);
        setError(`${slug} is taken — we've suggested ${err.details.suggestion}.`);
        return;
      }
      setError(errorMessage(err));
    }
  }

  return (
    <main id="main" className="mx-auto grid w-full max-w-[1400px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:py-8">
      <div className="grid content-start gap-5">
        <div>
          <p className={label}>New site</p>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight">Pick a template</h1>
          <p className="mt-1 text-sm text-ink-2">Every section, photo and word can be changed afterwards.</p>
        </div>

        <form onSubmit={submit} className="grid gap-4 rounded-[4px] border border-line bg-paper p-4" noValidate>
          <label className="block">
            <span className={label}>Site name</span>
            <input
              className={input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tpl?.business.split(",")[0] ?? "Your business"}
              maxLength={60}
              required
            />
          </label>
          <label className="block">
            <span className={label}>Address</span>
            <span className="mt-1.5 flex items-stretch overflow-hidden rounded-[3px] border border-line focus-within:border-guide focus-within:ring-2 focus-within:ring-guide-soft">
              <input
                className="min-w-0 flex-1 bg-paper px-3 py-2.5 font-mono text-sm outline-none"
                value={slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                }}
                placeholder="your-site"
                maxLength={40}
                aria-describedby="slug-help"
                spellCheck={false}
              />
              <span className="hidden items-center bg-desk px-2 font-mono text-[11px] text-muted sm:flex">.pagecraft…</span>
            </span>
            <span id="slug-help" className="mt-1.5 block min-h-5 text-xs" aria-live="polite">
              {check.state === "checking" && <span className="text-muted">Checking…</span>}
              {check.state === "ok" && <span className="text-mint-ink">✓ {prettyHost(slug)} is available</span>}
              {check.state === "bad" && (
                <span className="text-coral-ink">
                  {check.message}
                  {check.suggestion && (
                    <>
                      {" — "}
                      <button
                        type="button"
                        className="font-semibold text-guide underline underline-offset-2"
                        onClick={() => {
                          setSlugEdited(true);
                          setSlugInput(check.suggestion!);
                        }}
                      >
                        use {check.suggestion}
                      </button>
                    </>
                  )}
                </span>
              )}
              {check.state === "idle" && <span className="text-muted">Lower-case letters, digits and dashes.</span>}
            </span>
          </label>
          {error && (
            <p role="alert" className="rounded-[3px] border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-coral-ink">
              {error}
            </p>
          )}
          {atLimit ? (
            <p className="rounded-[3px] bg-guide-soft px-3 py-2 text-sm text-ink-2">
              The free plan includes {limit} sites and you&apos;re using all of them.{" "}
              <Link href="/sites" className="font-semibold text-guide">
                Back to your sites
              </Link>{" "}
              to delete one.
            </p>
          ) : (
            <button
              type="submit"
              disabled={busy || check.state === "bad"}
              className="min-h-11 rounded-[3px] bg-guide px-4 font-bold text-white transition hover:bg-guide-hover disabled:opacity-60"
            >
              {busy ? "Creating…" : `Create from ${tpl?.name ?? "template"}`}
            </button>
          )}
          {demo && <p className="text-xs text-muted">Demo account: the oldest site you made is recycled when you hit the limit.</p>}
        </form>

        <fieldset>
          <legend className={label}>Templates</legend>
          <div className="mt-2 grid gap-2" role="radiogroup" aria-label="Templates">
            {templates.map((t) => {
              const c = t.content as unknown as SiteContent;
              const p = PALETTES[(c.site.theme.palette as PaletteKey) ?? "graphite"] ?? PALETTES.graphite;
              const on = t.key === key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKey(t.key)}
                  className={`flex min-h-14 items-center gap-3 rounded-[4px] border px-3 py-2.5 text-left transition ${
                    on ? "border-guide bg-guide-soft" : "border-line bg-paper hover:border-guide/60"
                  }`}
                >
                  <span className="flex shrink-0 overflow-hidden rounded-[3px] border border-line" aria-hidden="true">
                    <i className="h-8 w-3" style={{ background: p.bg }} />
                    <i className="h-8 w-3" style={{ background: p.accent }} />
                    <i className="h-8 w-3" style={{ background: p.ink }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">{t.name}</span>
                    <span className="block truncate text-xs text-ink-2">{t.business}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>

      <section aria-label={`${tpl?.name} preview`} className="min-w-0">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm">
            <b>{tpl?.business}</b> <span className="text-ink-2">— {tpl?.description}</span>
          </p>
          {tpl?.preview_url && (
            <a href={tpl.preview_url} target="_blank" rel="noopener" className="font-mono text-[11px] text-guide">
              Open the live example ↗
            </a>
          )}
        </div>
        <p className="mb-3 font-mono text-[11px] text-muted">{sectionsLine}</p>
        <div key={key} className="pc-rise bp-grid rounded-[4px] border border-line p-3 sm:p-5">
          <div className="max-h-[78vh] overflow-y-auto rounded-[3px] bg-paper shadow-[0_20px_50px_-30px_rgba(27,27,47,.5)]">
            {content && (
              <Scaled width={1280} label={`Live preview of the ${tpl?.name} template`}>
                <SiteRenderer content={content} as="div" />
              </Scaled>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
