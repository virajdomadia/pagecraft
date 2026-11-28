"use client";

import { useEffect, useRef, useState } from "react";
import { api, errorMessage, type Schemas } from "@/lib/api";
import { timeAgo } from "@/lib/format";

export type SnapshotOut = Schemas["SnapshotOut"];
export type SnapshotContent = Schemas["SnapshotContent"];

/** S15: the version list (newest first). Picking one previews it read-only on the canvas. */
export function History({
  siteId,
  previewing,
  onPreview,
  onClose,
}: {
  siteId: string;
  previewing: string | null;
  onPreview: (snap: SnapshotContent) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<SnapshotOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
    api<SnapshotOut[]>(`/sites/${siteId}/snapshots`).then(setItems, (err) => setError(errorMessage(err)));
  }, [siteId]);

  async function open(id: string) {
    setOpening(id);
    try {
      onPreview(await api<SnapshotContent>(`/sites/${siteId}/snapshots/${id}`));
    } catch (err) {
      setError(errorMessage(err));
    }
    setOpening(null);
  }

  return (
    <div className="flex h-full flex-col" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 ref={heading} tabIndex={-1} className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted outline-none">
          Version history
        </h2>
        <button type="button" onClick={onClose} className="rounded-[3px] px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-desk">
          Close
        </button>
      </div>
      <p className="px-3 pb-2 text-xs text-ink-2">Saved on every publish and every 30 minutes of editing. The last 10 are kept.</p>
      {error && (
        <p role="alert" className="px-3 pb-2 text-sm text-coral-ink">
          {error}
        </p>
      )}
      {items === null && !error && (
        <p role="status" className="px-3 font-mono text-xs text-muted">
          Loading…
        </p>
      )}
      {items?.length === 0 && <p className="px-3 text-sm text-ink-2">No versions yet. One is saved as soon as you edit.</p>}
      <ul className="grid flex-1 content-start gap-1.5 overflow-y-auto px-2 pb-3" aria-label="Versions">
        {items?.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => open(s.id)}
              aria-current={previewing === s.id ? "true" : undefined}
              className={`w-full rounded-[3px] border px-3 py-2 text-left transition hover:border-guide hover:bg-guide-soft ${
                previewing === s.id ? "border-guide bg-guide-soft" : "border-line bg-paper"
              }`}
            >
              <span className="block text-[13px] font-bold">{s.label}</span>
              <span className="block text-xs text-ink-2">
                {timeAgo(s.created_at)}
                {s.author ? ` by ${s.author}` : ""}
                {opening === s.id ? " · opening…" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
