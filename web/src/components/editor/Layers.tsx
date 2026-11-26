"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { SectionJson } from "@/lib/doc/model";
import { REGISTRY } from "@/sections/registry";
import type { SectionType } from "@/sections/types";

const iconBtn =
  "grid h-7 w-7 place-items-center rounded-[3px] text-ink-2 hover:bg-paper hover:text-ink focus-visible:bg-paper disabled:opacity-40";

/** The layers pane (S5 left): ordered sections — click to select, drag to reorder, duplicate, delete. */
export function Layers({
  sections,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  onAdd,
  atMax,
}: {
  sections: SectionJson[];
  selected: string | null;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
  atMax: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const from = sections.findIndex((s) => s.id === e.active.id);
    const to = sections.findIndex((s) => s.id === e.over!.id);
    if (from >= 0 && to >= 0) onMove(from, to);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <h2 className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">Layers · {sections.length}</h2>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Sections on this page">
            {sections.map((s, i) => (
              <Row
                key={s.id}
                section={s}
                index={i}
                count={sections.length}
                selected={selected === s.id}
                onSelect={onSelect}
                onMove={onMove}
                onDuplicate={onDuplicate}
                onDelete={onDelete}
                atMax={atMax}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <div className="border-t border-line p-2">
        <button
          type="button"
          onClick={onAdd}
          disabled={atMax}
          className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[3px] border border-dashed border-guide bg-guide-soft font-bold text-guide transition hover:bg-[#e2e5ff] disabled:opacity-50"
        >
          <span aria-hidden="true">+</span> Add section
        </button>
        {atMax && <p className="mt-1 text-center text-[11px] text-muted">30 sections is the most a page can hold.</p>}
      </div>
    </div>
  );
}

function Row({
  section,
  index,
  count,
  selected,
  onSelect,
  onMove,
  onDuplicate,
  onDelete,
  atMax,
}: {
  section: SectionJson;
  index: number;
  count: number;
  selected: boolean;
  onSelect: (id: string) => void;
  onMove: (from: number, to: number) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  atMax: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const def = REGISTRY[section.type as SectionType];
  const variant = def?.variants.find((v) => v.key === section.variant)?.label ?? section.variant;
  const name = def?.label ?? section.type;
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative mb-1 flex items-center gap-1 rounded-[3px] border pl-1 pr-1 ${
        selected ? "border-guide bg-guide-soft" : "border-transparent hover:border-line hover:bg-desk"
      } ${isDragging ? "z-10 shadow-lg" : ""}`}
    >
      <button type="button" className={`${iconBtn} cursor-grab touch-none`} aria-label={`Reorder ${name}`} {...attributes} {...listeners}>
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          {[2, 6, 10].map((y) => [4, 8].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.1" fill="currentColor" />))}
        </svg>
      </button>
      <button type="button" onClick={() => onSelect(section.id)} className="min-w-0 flex-1 py-2 text-left" aria-current={selected || undefined}>
        <span className="block truncate text-[13px] font-semibold">{name}</span>
        <span className="block truncate font-mono text-[10.5px] text-muted">
          {variant} · {section.id}
        </span>
      </button>
      <span
        className={`absolute right-1 top-1/2 -translate-y-1/2 items-center rounded-[3px] pl-2 ${
          selected ? "flex bg-guide-soft" : "hidden bg-desk group-hover:flex group-focus-within:flex"
        }`}
      >
        <button type="button" className={iconBtn} aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => onMove(index, index - 1)}>
          ↑
        </button>
        <button type="button" className={iconBtn} aria-label={`Move ${name} down`} disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
          ↓
        </button>
        <button type="button" className={iconBtn} aria-label={`Duplicate ${name}`} disabled={atMax} onClick={() => onDuplicate(section.id)}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="5" y="5" width="8.5" height="8.5" rx="1" />
            <path d="M3 11V3.5A1 1 0 0 1 4 2.5h7" />
          </svg>
        </button>
        <button type="button" className={`${iconBtn} hover:!text-coral-ink`} aria-label={`Delete ${name}`} onClick={() => onDelete(section.id)}>
          <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 9h5.6l.7-9" />
          </svg>
        </button>
      </span>
    </li>
  );
}
