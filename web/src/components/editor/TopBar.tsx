"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LogoMark } from "@/components/studio/Logo";
import type { SaveStatus } from "@/lib/doc/persistence";
import type { Width } from "@/components/editor/Canvas";

const PILL: Record<SaveStatus, { text: string; dot: string }> = {
  saved: { text: "Saved", dot: "bg-mint" },
  saving: { text: "Saving…", dot: "bg-[#F59E0B]" },
  offline: { text: "Offline — changes kept locally", dot: "bg-coral" },
  error: { text: "Not saved — reload the page", dot: "bg-coral" },
};

const ib =
  "grid h-8 w-8 place-items-center rounded-[3px] border border-transparent text-ink-2 hover:border-line hover:bg-guide-soft disabled:opacity-35 disabled:hover:bg-transparent";

export function TopBar({
  name,
  siteId,
  slug,
  published,
  protectedSite,
  save,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  width,
  onWidth,
  onPublish,
  onUnpublish,
}: {
  name: string;
  siteId: string;
  slug: string;
  published: boolean;
  protectedSite: boolean;
  save: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  width: Width;
  onWidth: (w: Width) => void;
  onPublish: () => void;
  onUnpublish: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const pill = PILL[save];
  const mac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const mod = mac ? "⌘" : "Ctrl+";

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenu(false);
        setConfirmUnpublish(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menu]);

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-paper px-3">
      <Link href="/sites" className="flex items-center gap-2 rounded-[3px] px-1 py-1 no-underline hover:bg-guide-soft" aria-label="Back to your sites">
        <LogoMark className="h-[22px] w-[22px]" />
      </Link>
      <span className="text-sm text-muted">
        <Link href="/sites" className="no-underline hover:text-ink">
          Sites
        </Link>{" "}
        / <b className="font-semibold text-ink">{name}</b>
      </span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-ink-2" role="status" aria-live="polite">
        <i key={save} className={`pc-dot-pop h-1.5 w-1.5 rounded-full ${pill.dot}`} aria-hidden="true" />
        {pill.text}
      </span>

      <div className="flex items-center gap-0.5 border-l border-line pl-3">
        <button type="button" className={ib} onClick={onUndo} disabled={!canUndo} aria-label="Undo" title={`Undo (${mod}Z)`}>
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5.5 3.5 2.5 6.5l3 3M3 6.5h6.5a4 4 0 0 1 0 8H7" />
          </svg>
        </button>
        <button type="button" className={ib} onClick={onRedo} disabled={!canRedo} aria-label="Redo" title={`Redo (${mod}${mac ? "⇧Z" : "Y"})`}>
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M10.5 3.5l3 3-3 3M13 6.5H6.5a4 4 0 0 0 0 8H9" />
          </svg>
        </button>
      </div>

      <div className="flex flex-1 justify-center">
        <div className="flex overflow-hidden rounded-[3px] border border-line" role="group" aria-label="Preview width">
          {(["desktop", "tablet", "phone"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={width === w}
              onClick={() => onWidth(w)}
              className={`px-3 py-1.5 font-mono text-[11.5px] ${width === w ? "bg-ink text-white" : "bg-paper text-ink-2 hover:bg-guide-soft"}`}
            >
              {w === "desktop" ? "1280" : w === "tablet" ? "834" : "390"}
              <span className="sr-only"> px ({w})</span>
            </button>
          ))}
        </div>
      </div>

      {published && (
        <a href={`/s/${slug}`} target="_blank" rel="noopener" className="hidden rounded-[3px] px-2.5 py-1.5 text-[13px] font-semibold text-ink-2 no-underline hover:bg-guide-soft xl:inline">
          View live ↗
        </a>
      )}
      <div ref={menuRef} className="relative">
        <button type="button" className={ib} aria-label="More" aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
          ⋯
        </button>
        {menu && (
          <div className="pc-rise absolute right-0 top-[calc(100%+6px)] z-40 w-60 rounded-[4px] border border-line bg-paper p-1.5 text-sm shadow-lg">
            <Link href={`/sites/${siteId}/settings`} className="block rounded-[3px] px-2.5 py-2 no-underline hover:bg-guide-soft">
              Site settings
            </Link>
            {published && (
              <a href={`/s/${slug}`} target="_blank" rel="noopener" className="block rounded-[3px] px-2.5 py-2 no-underline hover:bg-guide-soft">
                View live site ↗
              </a>
            )}
            <Link href="/sites" className="block rounded-[3px] px-2.5 py-2 no-underline hover:bg-guide-soft">
              All sites
            </Link>
            {published && !protectedSite && (
              <div className="mt-1 border-t border-line pt-1">
                {confirmUnpublish ? (
                  <div className="grid gap-2 p-2">
                    <p className="text-xs text-ink-2">Visitors will see “not published” at /s/{slug}. You can publish again any time.</p>
                    <div className="flex gap-1.5">
                      <button type="button" onClick={() => setConfirmUnpublish(false)} className="flex-1 rounded-[3px] border border-line px-2 py-1.5 text-xs font-semibold">
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenu(false);
                          setConfirmUnpublish(false);
                          onUnpublish();
                        }}
                        className="flex-1 rounded-[3px] bg-coral px-2 py-1.5 text-xs font-bold text-ink"
                      >
                        Unpublish
                      </button>
                    </div>
                  </div>
                ) : (
                  <button type="button" onClick={() => setConfirmUnpublish(true)} className="block w-full rounded-[3px] px-2.5 py-2 text-left text-coral-ink hover:bg-coral/10">
                    Unpublish…
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <button type="button" onClick={onPublish} className="min-h-9 rounded-[3px] bg-guide px-4 text-sm font-bold text-white hover:bg-guide-hover">
        {published ? "Publish changes" : "Publish"}
      </button>
    </header>
  );
}
