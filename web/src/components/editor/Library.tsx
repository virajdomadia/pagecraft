"use client";

import { useEffect, useRef } from "react";
import { Thumb } from "@/components/editor/Thumb";
import { REGISTRY } from "@/sections/registry";
import { SECTION_TYPES, type SectionType } from "@/sections/types";

/** S6: the section library — ten types, a wireframe each, inserted below the selected section. */
export function Library({ onPick, onClose, below }: { onPick: (type: SectionType) => void; onClose: () => void; below: string | null }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);

  return (
    <div className="flex h-full flex-col" role="dialog" aria-label="Add a section" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted">Add section</h2>
        <button type="button" onClick={onClose} className="rounded-[3px] px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-desk">
          Close
        </button>
      </div>
      <p className="px-3 pb-2 text-xs text-ink-2">{below ? "Inserted below the selected section." : "Added at the end of the page."}</p>
      <ul className="grid flex-1 content-start gap-2 overflow-y-auto px-2 pb-3">
        {SECTION_TYPES.map((t, i) => {
          const def = REGISTRY[t];
          return (
            <li key={t}>
              <button
                ref={i === 0 ? first : undefined}
                type="button"
                onClick={() => onPick(t)}
                className="group grid w-full grid-cols-[84px_1fr] items-center gap-3 rounded-[3px] border border-line bg-paper p-2 text-left transition hover:border-guide hover:bg-guide-soft"
              >
                <Thumb boxes={def.variants[0].thumb} className="transition group-hover:[&_rect:first-child]:stroke-guide" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold">{def.label}</span>
                  <span className="block text-xs leading-snug text-ink-2">{def.description}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted">
                    {def.variants.length} layouts
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
