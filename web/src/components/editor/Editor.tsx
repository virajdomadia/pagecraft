"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Canvas, type Width } from "@/components/editor/Canvas";
import { Inspector } from "@/components/editor/Inspector";
import { Layers } from "@/components/editor/Layers";
import { Library } from "@/components/editor/Library";
import { PublishDialog } from "@/components/editor/PublishDialog";
import { ThemePanel } from "@/components/editor/ThemePanel";
import { TopBar } from "@/components/editor/TopBar";
import { SiteRenderer } from "@/components/renderer/SiteRenderer";
import { api, errorMessage, type SiteDetail } from "@/lib/api";
import { roots } from "@/lib/doc/model";
import { deleteSection, duplicateSection, insertSection, moveSection, sectionIndex, setSeo, setTheme } from "@/lib/doc/ops";
import { useSiteDoc } from "@/lib/doc/useSiteDoc";
import { MAX_SECTIONS, newSection, REGISTRY } from "@/sections/registry";
import type { SectionType } from "@/sections/types";
import "./editor.css";

type Toast = { message: string; action?: { label: string; run: () => void }; tone?: "error" };

function useWide(): boolean | null {
  const [wide, setWide] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName));
}

/** S5: the editor — layers · canvas · inspector over one Y.Doc. */
export function Editor({ site, fresh }: { site: SiteDetail; fresh: boolean }) {
  const sd = useSiteDoc(site.id);
  const { content, doc, change } = sd;
  const wide = useWide();
  const [selected, setSelected] = useState<string | null>(null);
  const [width, setWidth] = useState<Width>("desktop");
  const [panel, setPanel] = useState<"layers" | "library">("layers");
  const [drawIn, setDrawIn] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(site.status === "published");
  const [slug, setSlug] = useState(site.slug);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.action ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (fresh && sd.status === "ready") {
      setToast({ message: "Your site is ready — click any text on the page to edit it." });
      window.history.replaceState(null, "", `/sites/${site.id}/edit`);
    }
  }, [fresh, sd.status, site.id]);

  // A selection that no longer exists (undo of an add, deleted elsewhere) clears itself.
  useEffect(() => {
    if (selected && content && !content.sections.some((s) => s.id === selected)) setSelected(null);
  }, [content, selected]);

  const sectionsY = useMemo(() => (doc ? roots(doc).sections : null), [doc]);
  // Stable: draw-in completion must not restart the animation effect.
  const onDrawn = useCallback(() => setDrawIn(null), []);
  const current = content?.sections.find((s) => s.id === selected) ?? null;
  const count = content?.sections.length ?? 0;

  const remove = useCallback(
    (id: string) => {
      const s = content?.sections.find((x) => x.id === id);
      sd.stopCapturing();
      change((r) => deleteSection(r, id));
      setSelected(null);
      const label = s ? (REGISTRY[s.type as SectionType]?.label ?? s.type) : "Section";
      setToast({ message: `Deleted ${label}.`, action: { label: "Undo", run: sd.undo } });
    },
    [change, content, sd],
  );

  const duplicate = useCallback(
    (id: string) => {
      if (count >= MAX_SECTIONS) return;
      let copy: string | null = null;
      sd.stopCapturing();
      change((r) => {
        copy = duplicateSection(r, id);
      });
      if (copy) {
        setSelected(copy);
        setDrawIn(copy);
      }
    },
    [change, count, sd],
  );

  function add(type: SectionType) {
    if (!doc || count >= MAX_SECTIONS) return;
    const section = newSection(type);
    sd.stopCapturing();
    change((r) => {
      const at = selected ? sectionIndex(r, selected) + 1 : type === "footer" || !r.sections.length ? r.sections.length : footerIndex(r);
      insertSection(r, section, at);
    });
    setPanel("layers");
    setSelected(section.id);
    setDrawIn(section.id);
  }

  function footerIndex(r: ReturnType<typeof roots>): number {
    const last = r.sections.length - 1;
    return r.sections.get(last)?.get("type") === "footer" ? last : r.sections.length;
  }

  // Keyboard: ⌘Z / ⌘⇧Z / Ctrl+Y, Esc deselects, Delete removes the selected section.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) sd.redo();
        else sd.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        sd.redo();
        return;
      }
      if (isTyping(e.target) || publishing) return;
      if (e.key === "Escape") setSelected(null);
      if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault();
        remove(selected);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sd, selected, publishing, remove]);

  async function unpublish() {
    try {
      await api(`/sites/${site.id}/unpublish`, { method: "POST" });
      setPublished(false);
      setToast({ message: `Unpublished — /s/${slug} now shows “not published”.` });
    } catch (err) {
      setToast({ message: errorMessage(err), tone: "error" });
    }
  }

  if (sd.status === "error")
    return (
      <div className="grid min-h-dvh place-items-center bg-desk p-6 text-center">
        <div>
          <p className="text-lg font-bold">{sd.error}</p>
          <Link href="/sites" className="mt-3 inline-block font-semibold text-guide">
            Back to your sites
          </Link>
        </div>
      </div>
    );

  if (!content || !sectionsY || wide === null)
    return (
      <div className="bp-grid grid min-h-dvh place-items-center" role="status">
        <p className="font-mono text-xs text-muted">Opening {site.name}…</p>
      </div>
    );

  if (!wide)
    return (
      <div className="min-h-dvh bg-desk">
        <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-paper px-4 py-3">
          <Link href="/sites" className="text-sm font-semibold text-guide no-underline">
            ← Sites
          </Link>
          <p className="min-w-0 flex-1 truncate text-sm">
            <b>{site.name}</b> · preview
          </p>
        </div>
        <p className="border-b border-line bg-guide-soft px-4 py-2.5 text-sm text-ink-2">
          The editor needs a screen at least 1024 px wide. Here&apos;s a live preview — open this page on a desktop to edit.
        </p>
        <SiteRenderer content={content} as="div" />
      </div>
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-desk">
      <TopBar
        name={content.site.name || site.name}
        siteId={site.id}
        slug={slug}
        published={published}
        protectedSite={site.protected}
        save={sd.save}
        canUndo={sd.canUndo}
        canRedo={sd.canRedo}
        onUndo={sd.undo}
        onRedo={sd.redo}
        width={width}
        onWidth={setWidth}
        onPublish={() => setPublishing(true)}
        onUnpublish={unpublish}
      />
      <div className="grid min-h-0 flex-1 grid-cols-[236px_minmax(0,1fr)_300px]">
        <aside className="min-h-0 border-r border-line bg-paper" aria-label="Layers">
          {panel === "library" ? (
            <Library onPick={add} onClose={() => setPanel("layers")} below={selected} />
          ) : (
            <Layers
              sections={content.sections}
              selected={selected}
              onSelect={setSelected}
              onMove={(from, to) => {
                sd.stopCapturing();
                change((r) => moveSection(r, from, to));
              }}
              onDuplicate={duplicate}
              onDelete={remove}
              onAdd={() => setPanel("library")}
              atMax={count >= MAX_SECTIONS}
            />
          )}
        </aside>
        <main id="main" className="min-h-0" aria-label="Canvas">
          <Canvas
            content={content}
            sections={sectionsY}
            width={width}
            selected={selected}
            onSelect={setSelected}
            drawIn={drawIn}
            onDrawn={onDrawn}
          />
        </main>
        <aside className="min-h-0 overflow-y-auto border-l border-line bg-paper" aria-label="Inspector">
          {current ? (
            <Inspector key={current.id} section={current} siteId={site.id} change={change} onDuplicate={() => duplicate(current.id)} onDelete={() => remove(current.id)} />
          ) : (
            <ThemePanel theme={content.site.theme} onChange={(k, v) => change((r) => setTheme(r, k, v))} />
          )}
        </aside>
      </div>

      {publishing && (
        <PublishDialog
          siteId={site.id}
          slug={slug}
          published={published}
          protectedSite={site.protected}
          content={content}
          onClose={() => setPublishing(false)}
          onPublish={async (seo) => {
            sd.stopCapturing();
            change((r) => setSeo(r, seo));
            const ok = await sd.flush();
            return ok;
          }}
          onDone={(res) => {
            setPublished(true);
            setSlug(res.slug);
          }}
          onInvalid={(id, message) => {
            setPublishing(false);
            setSelected(id);
            setToast({ message, tone: "error" });
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`pc-rise fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-[4px] px-4 py-2.5 text-sm shadow-xl ${
            toast.tone === "error" ? "bg-coral text-ink" : "bg-ink text-white"
          }`}
        >
          {toast.message}
          {toast.action && (
            <button
              type="button"
              className="font-bold text-[#a5b4fc] underline-offset-2 hover:underline"
              onClick={() => {
                toast.action?.run();
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
