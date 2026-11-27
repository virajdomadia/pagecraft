"use client";

import { type RefObject, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import { caretOffsets, elementTexts, textElements } from "@/components/editor/Editable";
import { type Peer, type Presence, type RelPosJson, textOn } from "@/lib/doc/awareness";

/**
 * Live presence (L2), direction C "comet cursors" (04-ui-mockups): teammates' pointers with a
 * name tag and a short fading trail, a breathing outline on the section they selected, and a
 * labelled caret where they type. All drawn in one overlay inside the scaled canvas sheet, from
 * positions that are relative to sections and to Y.Text items, so they land right at any width.
 * Reduced motion: no trail, no breathing, no gliding (editor.css).
 */

const NONE: Peer[] = [];

export function usePeers(presence: Presence | null): Peer[] {
  return useSyncExternalStore(
    (fn) => presence?.subscribe(fn) ?? (() => {}),
    () => presence?.list() ?? NONE,
    () => NONE,
  );
}

/** Publish this tab's selected section, pointer and caret. */
export function usePublishPresence(presence: Presence | null, selected: string | null, sheet: RefObject<HTMLElement | null>) {
  useEffect(() => presence?.set({ section: selected ?? undefined }), [presence, selected]);

  useEffect(() => {
    const el = sheet.current;
    if (!presence || !el) return;
    const onMove = (e: PointerEvent) => {
      const section = (e.target as Element).closest<HTMLElement>("[data-section-id]");
      if (!section) return presence.set({ pointer: undefined });
      const r = section.getBoundingClientRect();
      const clamp = (v: number) => Math.min(1, Math.max(0, v));
      presence.set({
        pointer: { s: section.dataset.sectionId!, x: clamp((e.clientX - r.left) / r.width), y: clamp((e.clientY - r.top) / r.height) },
      });
    };
    const onLeave = () => presence.set({ pointer: undefined });
    const onSelection = () => {
      const node = document.activeElement as HTMLElement | null;
      const text = node ? elementTexts.get(node) : undefined;
      const at = node && text ? caretOffsets(node) : null;
      if (!text || !at) return presence.set({ caret: undefined });
      const rel = (i: number) => Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, i)) as RelPosJson;
      presence.set({ caret: { anchor: rel(at[0]), head: rel(at[1]) } });
    };
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    document.addEventListener("selectionchange", onSelection);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("selectionchange", onSelection);
    };
  }, [presence, sheet]);
}

type Box = { x: number; y: number; w: number; h: number };
type Drawn = { peer: Peer; pointer?: { x: number; y: number }; section?: Box; caret?: Box };

/** Where a peer's things are, in the sheet's own (unscaled) pixels. */
function measure(peer: Peer, sheet: HTMLElement, doc: Y.Doc): Drawn {
  const origin = sheet.getBoundingClientRect();
  const scale = origin.width / sheet.offsetWidth || 1;
  const local = (r: DOMRect): Box => ({ x: (r.left - origin.left) / scale, y: (r.top - origin.top) / scale, w: r.width / scale, h: r.height / scale });
  const sectionEl = (id?: string) => (id ? sheet.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`) : null);
  const out: Drawn = { peer };

  const sel = sectionEl(peer.state.section);
  if (sel) out.section = local(sel.getBoundingClientRect());

  const p = peer.state.pointer;
  const ps = sectionEl(p?.s);
  if (p && ps) {
    const b = local(ps.getBoundingClientRect());
    out.pointer = { x: b.x + p.x * b.w, y: b.y + p.y * b.h };
  }

  const c = peer.state.caret;
  if (c) {
    try {
      const abs = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(c.head), doc);
      const el = abs && abs.type instanceof Y.Text ? textElements.get(abs.type) : undefined;
      if (abs && el) {
        const node = el.firstChild;
        const range = document.createRange();
        if (node?.nodeType === Node.TEXT_NODE) {
          const at = Math.min(abs.index, node.textContent?.length ?? 0);
          range.setStart(node, at);
          range.setEnd(node, at);
        } else range.selectNodeContents(el);
        const rects = range.getClientRects();
        const r = rects[rects.length - 1] ?? el.getBoundingClientRect();
        const b = local(r);
        out.caret = { x: b.x, y: b.y, w: 0, h: Math.max(b.h, 14) };
      }
    } catch {
      /* a caret in text this tab doesn't have yet: skip it until it does */
    }
  }
  return out;
}

export function PeerLayer({
  peers,
  sheet,
  doc,
  version,
  labelFor,
}: {
  peers: Peer[];
  sheet: RefObject<HTMLDivElement | null>;
  doc: Y.Doc;
  /** Changes whenever the document does, so carets and outlines follow edits. */
  version: unknown;
  labelFor: (sectionId: string) => string;
}) {
  const [drawn, setDrawn] = useState<Drawn[]>([]);
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const el = sheet.current;
    if (!el || peers.length === 0) setDrawn((d) => (d.length ? [] : d)); // alone: no layout reads
    else setDrawn(peers.map((p) => measure(p, el, doc)));
  }, [peers, sheet, doc, version, tick]);

  useEffect(() => {
    const el = sheet.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, [sheet]);

  return (
    <div className="pc-peers" aria-hidden="true">
      {drawn.map(({ peer, section, pointer, caret }) => {
        const style = { "--peer": peer.user.colour, "--peer-ink": textOn(peer.user.colour) } as React.CSSProperties;
        const first = peer.user.name.split(" ")[0];
        return (
          <div key={peer.client} style={style}>
            {section && (
              <div className="pc-peer-section" style={{ left: section.x, top: section.y, width: section.w, height: section.h }}>
                <span className="pc-peer-tag pc-peer-tag--section">
                  {first} · {labelFor(peer.state.section!)}
                </span>
              </div>
            )}
            {caret && (
              <div className="pc-peer-caret" style={{ left: caret.x, top: caret.y, height: caret.h }}>
                <span className="pc-peer-tag pc-peer-tag--caret">{first}</span>
              </div>
            )}
            {pointer && <Cursor x={pointer.x} y={pointer.y} name={first} />}
          </div>
        );
      })}
    </div>
  );
}

/** A pointer that glides to each new position and leaves a short comet trail behind it. */
function Cursor({ x, y, name }: { x: number; y: number; name: string }) {
  const [trail, setTrail] = useState<{ x: number; y: number; k: number }[]>([]);
  const last = useRef<{ x: number; y: number; k: number } | null>(null);
  useEffect(() => {
    const prev = last.current;
    last.current = { x, y, k: (prev?.k ?? 0) + 1 };
    if (prev) setTrail((t) => [...t.slice(-5), prev]);
  }, [x, y]);
  return (
    <>
      {trail.map((t) => (
        <i key={t.k} className="pc-peer-trail" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(calc(1 / var(--pc-scale, 1)))` }} />
      ))}
      <div className="pc-peer-cursor" style={{ transform: `translate(${x}px, ${y}px) scale(calc(1 / var(--pc-scale, 1)))` }}>
        <svg width="16" height="18" viewBox="0 0 16 18">
          <path d="M1 1l13 7.2-5.6 1.4L5.8 16z" fill="var(--peer)" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
        <span className="pc-peer-tag">{name}</span>
      </div>
    </>
  );
}

/** S5 top bar: who else is in the editor, and a polite announcement when someone comes or goes. */
export function PresenceList({ peers, meId, labelFor }: { peers: Peer[]; meId: string; labelFor: (sectionId: string) => string }) {
  const people = new Map<string, Peer>();
  for (const p of peers) if (!people.has(p.user.id) || p.state.section) people.set(p.user.id, p);
  const list = [...people.values()];
  const names = list.map((p) => (p.user.id === meId ? "Your other tab" : p.user.name)).join("|");
  const [said, setSaid] = useState("");
  const prev = useRef<string[]>([]);
  useEffect(() => {
    const now = names ? names.split("|") : [];
    const came = now.filter((n) => !prev.current.includes(n));
    const went = prev.current.filter((n) => !now.includes(n));
    if (came.length || went.length) setSaid([...came.map((n) => `${n} joined`), ...went.map((n) => `${n} left`)].join(". "));
    prev.current = now;
  }, [names]);

  return (
    <>
      <p className="sr-only" role="status" aria-live="polite">
        {said}
      </p>
      {list.length > 0 && (
        <ul className="flex items-center" aria-label="Also editing">
          {list.map((p) => {
            const name = p.user.id === meId ? "Your other tab" : p.user.name;
            const where = p.state.section ? `, on ${labelFor(p.state.section)}` : "";
            const initials = p.user.name
              .split(" ")
              .map((w) => w[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li
                key={p.user.id}
                className="pc-avatar -ml-1.5 grid h-7 w-7 place-items-center rounded-full border-2 border-paper text-[11px] font-bold first:ml-0"
                style={{ background: p.user.colour, color: textOn(p.user.colour) }}
                title={`${name}${where}`}
              >
                <span aria-hidden="true">{initials}</span>
                <span className="sr-only">
                  {name}
                  {where}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
