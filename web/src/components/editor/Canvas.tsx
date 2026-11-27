"use client";

import { type ReactNode, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { ThemeRoot, SectionView } from "@/components/renderer/SiteRenderer";
import { Editable } from "@/components/editor/Editable";
import { PeerLayer, usePublishPresence } from "@/components/editor/Peers";
import type { Peer, Presence } from "@/lib/doc/awareness";
import { getAt, type SectionJson, type SiteContent } from "@/lib/doc/model";
import { fieldFor, REGISTRY } from "@/sections/registry";
import type { SectionType } from "@/sections/types";
import type { EditApi, TextOpts } from "@/sections/ui";

export const WIDTHS = { desktop: 1280, tablet: 834, phone: 390 } as const;
export type Width = keyof typeof WIDTHS;

/**
 * The canvas (S5): the real section components at the chosen width (1280 / 834 / 390) inside a
 * container-query root, scaled to fit the pane. Not an iframe — one React tree, so selection and
 * inline editing are ordinary DOM events.
 */
export function Canvas({
  content,
  sections,
  width,
  selected,
  onSelect,
  drawIn,
  onDrawn,
  doc,
  presence,
  peers,
  labelFor,
}: {
  content: SiteContent;
  sections: Y.Array<Y.Map<unknown>>;
  width: Width;
  selected: string | null;
  onSelect: (id: string | null) => void;
  drawIn: string | null;
  onDrawn: () => void;
  doc: Y.Doc;
  presence: Presence | null;
  peers: Peer[];
  labelFor: (sectionId: string) => string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  const [sheetH, setSheetH] = useState(0);
  const w = WIDTHS[width];
  usePublishPresence(presence, selected, sheet);

  useLayoutEffect(() => {
    const o = outer.current;
    const s = sheet.current;
    if (!o || !s) return;
    const update = () => {
      setAvail(o.clientWidth);
      setSheetH(s.offsetHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(o);
    ro.observe(s);
    return () => ro.disconnect();
  }, []);

  const pad = width === "desktop" ? 48 : 64;
  const scale = avail ? Math.min(1, (avail - pad) / w) : 1;

  return (
    <div
      ref={outer}
      className="bp-grid relative h-full overflow-auto px-6 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
    >
      <div className="mx-auto" style={{ width: w * scale, height: sheetH * scale || undefined }}>
        <div
          ref={sheet}
          data-pc-sheet
          className="bp-corners relative origin-top-left bg-paper shadow-[0_1px_2px_rgba(27,27,47,.08),0_30px_70px_-40px_rgba(27,27,47,.5)]"
          style={{ width: w, transform: `scale(${scale})`, viewTransitionName: "pc-canvas", ["--pc-scale" as string]: scale }}
          onClickCapture={(e) => {
            // A canvas is for editing: links and buttons inside the site never navigate here.
            if ((e.target as Element).closest("a, summary")) e.preventDefault();
          }}
        >
          <ThemeRoot theme={content.site.theme} className="pc-canvas">
            {content.sections.length === 0 && (
              <div className="grid min-h-[480px] place-items-center p-10 text-center font-sans text-ink-2">
                <p>
                  This page is empty. Use <b>+ Add section</b> in the layers pane to start.
                </p>
              </div>
            )}
            {content.sections.map((s, i) => (
              <SectionFrame
                key={s.id}
                section={s}
                ymap={sections.get(i)}
                selected={selected === s.id}
                onSelect={onSelect}
                drawIn={drawIn === s.id}
                onDrawn={onDrawn}
                priority={i < 2}
              />
            ))}
          </ThemeRoot>
          <PeerLayer peers={peers} sheet={sheet} doc={doc} version={content} labelFor={labelFor} />
        </div>
      </div>
    </div>
  );
}

function SectionFrame({
  section,
  ymap,
  selected,
  onSelect,
  drawIn,
  onDrawn,
  priority,
}: {
  section: SectionJson;
  ymap: Y.Map<unknown> | undefined;
  selected: boolean;
  onSelect: (id: string) => void;
  drawIn: boolean;
  onDrawn: () => void;
  priority: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const def = REGISTRY[section.type as SectionType];
  const variantLabel = def?.variants.find((v) => v.key === section.variant)?.label ?? section.variant;
  const props = ymap?.get("props") as Y.Map<unknown> | undefined;

  const edit = useMemo<EditApi>(
    () => ({
      text: (o: TextOpts): ReactNode => {
        const target = props ? getAt(props, o.path) : undefined;
        const Tag = o.as;
        if (!(target instanceof Y.Text)) return o.value ? <Tag className={o.className}>{o.value}</Tag> : null;
        const field = fieldFor(section.type, o.path);
        return (
          <Editable
            text={target}
            as={o.as}
            className={o.className}
            multiline={o.multiline}
            placeholder={o.placeholder}
            max={field && field.kind === "text" ? field.max : undefined}
            label={field?.label}
          />
        );
      },
    }),
    [props, section.type],
  );

  useLayoutEffect(() => {
    if (selected) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected]);

  return (
    <div
      ref={ref}
      data-section-id={section.id}
      className={`pc-frame ${selected ? "is-selected" : ""}`}
      onClick={() => onSelect(section.id)}
    >
      <span className="pc-frame__label" aria-hidden="true">
        {def?.label ?? section.type} · {variantLabel}
      </span>
      <div className={drawIn ? "pc-drawin-content" : undefined}>
        <SectionView section={section} edit={edit} priority={priority} />
      </div>
      {drawIn && <DrawIn target={ref} onDone={onDrawn} />}
    </div>
  );
}

type Box = { x: number; y: number; w: number; h: number; tag: string };

/**
 * The motion signature (04-ui-mockups "Blueprint draw-in"): a new section traces its layout
 * boxes as a wireframe — stroke-dashoffset 1 → 0, 550 ms, 60 ms stagger, tiny mono labels —
 * then the real content fades into the boxes. Reduced motion: a 150 ms fade (CSS).
 */
function DrawIn({ target, onDone }: { target: React.RefObject<HTMLDivElement | null>; onDone: () => void }) {
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useLayoutEffect(() => {
    const frame = target.current;
    if (!frame) return;
    const fr = frame.getBoundingClientRect();
    const scale = fr.width / frame.offsetWidth || 1;
    const els = Array.from(frame.querySelectorAll(".pc-h1, .pc-h2, .pc-h3, .pc-brand, .pc-lead, .pc-intro, .pc-img, .pc-btn, .pc-feature, .pc-quote, .pc-plan, .pc-photo"));
    const picked = els.slice(0, 16).map((el) => {
      const r = el.getBoundingClientRect();
      const tag = el.classList.contains("pc-img") ? "img" : el.classList.contains("pc-btn") ? "button" : el.tagName.toLowerCase();
      return { x: (r.left - fr.left) / scale, y: (r.top - fr.top) / scale, w: r.width / scale, h: r.height / scale, tag };
    });
    setSize({ w: frame.offsetWidth, h: frame.offsetHeight });
    setBoxes(picked);
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [target, onDone]);

  if (!boxes) return null;
  return (
    <svg className="pc-drawin" width={size.w} height={size.h} viewBox={`0 0 ${size.w} ${size.h}`} aria-hidden="true">
      <rect className="pc-drawin__box" x="1" y="1" width={size.w - 2} height={size.h - 2} pathLength={1} style={{ animationDelay: "0ms" }} />
      {boxes.map((b, i) => (
        <g key={i} style={{ animationDelay: `${(i + 1) * 60}ms` }} className="pc-drawin__g">
          <rect className="pc-drawin__box" x={b.x} y={b.y} width={Math.max(2, b.w)} height={Math.max(2, b.h)} pathLength={1} style={{ animationDelay: `${(i + 1) * 60}ms` }} />
          <text x={b.x + 4} y={b.y - 4} className="pc-drawin__label">
            {b.tag}
          </text>
        </g>
      ))}
    </svg>
  );
}
