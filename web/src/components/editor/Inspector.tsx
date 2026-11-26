"use client";

import { useState } from "react";
import { ImageField } from "@/components/editor/ImageField";
import { Thumb } from "@/components/editor/Thumb";
import type { Json, Path, roots, SectionJson } from "@/lib/doc/model";
import { addItem, moveItem, removeItem, setProp, setVariant } from "@/lib/doc/ops";
import { COMMON, type Field, LINK_RE, type ListField } from "@/sections/fields";
import { Icon } from "@/sections/icons";
import { REGISTRY, validateSection } from "@/sections/registry";
import type { SectionType } from "@/sections/types";

type Change = (fn: (r: ReturnType<typeof roots>) => void) => void;

const lbl = "font-mono text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted";
const inp =
  "mt-1 block w-full rounded-[3px] border border-line bg-paper px-2.5 py-1.5 text-[13px] text-ink outline-none transition focus:border-guide focus:ring-2 focus:ring-guide-soft";

/** S7: the selected section's fields, generated from its registry definition. */
export function Inspector({
  section,
  siteId,
  change,
  onDuplicate,
  onDelete,
}: {
  section: SectionJson;
  siteId: string;
  change: Change;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const def = REGISTRY[section.type as SectionType];
  if (!def) return <p className="p-4 text-sm">Unknown section.</p>;
  const issue = validateSection(section);
  const set = (path: Path, value: Json) => change((r) => setProp(r, section.id, path, value));

  return (
    <div className="grid gap-5 p-4">
      <header>
        <p className={lbl}>Section</p>
        <h2 className="text-[17px] font-extrabold tracking-tight">{def.label}</h2>
        <p className="font-mono text-[10.5px] text-muted">{section.id}</p>
      </header>

      {issue && (
        <p role="status" className="rounded-[3px] border border-coral/40 bg-coral/10 px-2.5 py-2 text-xs text-coral-ink">
          Won&apos;t publish yet — {issue.message.replace(`${def.label}: `, "")}
        </p>
      )}

      <fieldset>
        <legend className={lbl}>Layout</legend>
        <div className="mt-1.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Layout">
          {def.variants.map((v) => {
            const on = v.key === section.variant;
            return (
              <button
                key={v.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => change((r) => setVariant(r, section.id, v.key))}
                className={`grid gap-1 rounded-[3px] border p-1 text-center transition ${on ? "border-guide bg-guide-soft" : "border-line bg-paper hover:border-guide/60"}`}
              >
                <Thumb boxes={v.thumb} />
                <span className="text-[11px] font-semibold">{v.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <Fields fields={def.fields} value={section.props} path={[]} set={set} change={change} section={section} siteId={siteId} />

      <details className="group rounded-[3px] border border-line bg-paper">
        <summary className="cursor-pointer list-none px-3 py-2 text-[13px] font-semibold">Section settings</summary>
        <div className="grid gap-4 border-t border-line p-3">
          <Fields fields={COMMON} value={section.props} path={[]} set={set} change={change} section={section} siteId={siteId} />
        </div>
      </details>

      <div className="flex gap-2 border-t border-line pt-4">
        <button type="button" onClick={onDuplicate} className="flex-1 rounded-[3px] border border-line bg-paper px-3 py-2 text-xs font-semibold hover:border-guide">
          Duplicate
        </button>
        <button type="button" onClick={onDelete} className="flex-1 rounded-[3px] border border-coral/50 px-3 py-2 text-xs font-semibold text-coral-ink hover:bg-coral/10">
          Delete section
        </button>
      </div>
    </div>
  );
}

function Fields({
  fields,
  value,
  path,
  set,
  change,
  section,
  siteId,
}: {
  fields: Field[];
  value: Record<string, Json>;
  path: Path;
  set: (path: Path, value: Json) => void;
  change: Change;
  section: SectionJson;
  siteId: string;
}) {
  return (
    <div className="grid gap-4">
      {fields.map((f) => (
        <FieldInput key={f.key} field={f} value={value} path={path} set={set} change={change} section={section} siteId={siteId} />
      ))}
    </div>
  );
}

function FieldInput({
  field: f,
  value,
  path,
  set,
  change,
  section,
  siteId,
}: {
  field: Field;
  value: Record<string, Json>;
  path: Path;
  set: (path: Path, value: Json) => void;
  change: Change;
  section: SectionJson;
  siteId: string;
}) {
  const here = [...path, f.key];
  const v = value[f.key];
  switch (f.kind) {
    case "text": {
      const s = typeof v === "string" ? v : "";
      const Tag = f.multiline ? "textarea" : "input";
      return (
        <label className="block">
          <span className="flex justify-between">
            <span className={lbl}>{f.label}</span>
            <span className={`font-mono text-[10px] ${s.length > f.max * 0.9 ? "text-coral-ink" : "text-muted"}`}>
              {s.length}/{f.max}
            </span>
          </span>
          <Tag
            className={`${inp} ${f.multiline ? "min-h-[72px] resize-y" : ""}`}
            value={s}
            maxLength={f.max}
            placeholder={f.placeholder}
            rows={f.multiline ? 3 : undefined}
            onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(here, e.target.value)}
          />
        </label>
      );
    }
    case "href": {
      const s = typeof v === "string" ? v : "";
      const bad = s !== "" && !LINK_RE.test(s);
      return <HrefInput label={f.label} hint={f.hint} value={s} bad={bad} onChange={(x) => set(here, x)} />;
    }
    case "anchor": {
      const s = typeof v === "string" ? v : "";
      return (
        <label className="block">
          <span className={lbl}>{f.label}</span>
          <span className="mt-1 flex items-center rounded-[3px] border border-line bg-paper focus-within:border-guide">
            <span className="pl-2.5 font-mono text-[13px] text-muted">#</span>
            <input
              className="min-w-0 flex-1 bg-transparent px-1 py-1.5 font-mono text-[13px] outline-none"
              value={s}
              maxLength={40}
              onChange={(e) => set(here, e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
            />
          </span>
          {f.hint && <span className="mt-1 block text-[11px] text-muted">{f.hint}</span>}
        </label>
      );
    }
    case "link": {
      const l = (v ?? {}) as { label?: string; href?: string };
      const bad = !!l.href && !LINK_RE.test(l.href);
      return (
        <div className="grid gap-2 rounded-[3px] border border-line bg-desk/60 p-2.5">
          <span className={lbl}>{f.label}</span>
          <label className="block">
            <span className="text-[11px] text-ink-2">Label {f.key !== "cta" && "(leave empty to hide)"}</span>
            <input className={inp} value={l.label ?? ""} maxLength={32} onChange={(e) => set([...here, "label"], e.target.value)} />
          </label>
          <HrefInput label="Goes to" value={l.href ?? ""} bad={bad} onChange={(x) => set([...here, "href"], x)} small />
        </div>
      );
    }
    case "image": {
      const img = (f.flat ? value : (v ?? {})) as { url?: string; alt?: string };
      const base = f.flat ? path : here;
      return (
        <ImageField
          siteId={siteId}
          label={f.label}
          url={img.url ?? ""}
          alt={img.alt ?? ""}
          compact={f.flat}
          onChange={(next) =>
            change((r) => {
              setProp(r, section.id, [...base, "url"], next.url);
              setProp(r, section.id, [...base, "alt"], next.alt);
            })
          }
        />
      );
    }
    case "enum": {
      const s = typeof v === "string" ? v : f.options[0].value;
      if (f.display === "icons")
        return (
          <fieldset>
            <legend className={lbl}>{f.label}</legend>
            <div className="mt-1 grid grid-cols-8 gap-1">
              {f.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-label={o.label}
                  aria-pressed={o.value === s}
                  onClick={() => set(here, o.value)}
                  className={`grid aspect-square place-items-center rounded-[3px] border ${o.value === s ? "border-guide bg-guide-soft text-guide" : "border-line bg-paper text-ink-2 hover:border-guide/60"}`}
                >
                  <Icon name={o.value} className="h-4 w-4" />
                </button>
              ))}
            </div>
          </fieldset>
        );
      return (
        <fieldset>
          <legend className={lbl}>{f.label}</legend>
          <div className="mt-1 flex overflow-hidden rounded-[3px] border border-line">
            {f.options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={o.value === s}
                onClick={() => set(here, o.value)}
                className={`flex-1 px-2 py-1.5 font-mono text-[11px] ${o.value === s ? "bg-guide text-white" : "bg-paper text-ink-2 hover:bg-guide-soft"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
      );
    }
    case "bool":
      return (
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={v === true} onChange={(e) => set(here, e.target.checked)} className="h-4 w-4 accent-[#4338CA]" />
          {f.label}
        </label>
      );
    case "list":
      return <ListInput field={f} items={(Array.isArray(v) ? v : []) as Record<string, Json>[]} path={here} set={set} change={change} section={section} siteId={siteId} />;
  }
}

function HrefInput({
  label,
  hint,
  value,
  bad,
  onChange,
  small,
}: {
  label: string;
  hint?: string;
  value: string;
  bad: boolean;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <label className="block">
      <span className={small ? "text-[11px] text-ink-2" : lbl}>{label}</span>
      <input
        className={`${inp} font-mono ${bad ? "border-coral" : ""}`}
        value={value}
        maxLength={300}
        placeholder="#section, https://…, mailto: or tel:"
        spellCheck={false}
        onChange={(e) => onChange(e.target.value.trim())}
        aria-invalid={bad}
      />
      {bad ? (
        <span className="mt-1 block text-[11px] text-coral-ink">Links start with #, https://, mailto: or tel:</span>
      ) : (
        hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>
      )}
    </label>
  );
}

function ListInput({
  field,
  items,
  path,
  set,
  change,
  section,
  siteId,
}: {
  field: ListField;
  items: Record<string, Json>[];
  path: Path;
  set: (path: Path, value: Json) => void;
  change: Change;
  section: SectionJson;
  siteId: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const full = items.length >= field.max;
  const btn = "grid h-6 w-6 place-items-center rounded-[3px] text-xs text-ink-2 hover:bg-desk disabled:opacity-30";
  return (
    <fieldset>
      <legend className={`${lbl} flex w-full justify-between`}>
        <span>{field.label}</span>
        <span>
          {items.length}/{field.max}
        </span>
      </legend>
      <ol className="mt-1.5 grid gap-1.5">
        {items.map((item, i) => {
          const id = String(item.id);
          const expanded = open === id;
          return (
            <li key={id} className={`rounded-[3px] border bg-paper ${expanded ? "border-guide" : "border-line"}`}>
              <div className="flex items-center gap-1 pl-2 pr-1">
                <button type="button" className="min-w-0 flex-1 truncate py-1.5 text-left text-[12.5px] font-semibold" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : id)}>
                  <span className="mr-1.5 font-mono text-[10px] text-muted">{String(i + 1).padStart(2, "0")}</span>
                  {field.itemLabel(item, i)}
                </button>
                <button type="button" className={btn} aria-label="Move up" disabled={i === 0} onClick={() => change((r) => moveItem(r, section.id, path, i, i - 1))}>
                  ↑
                </button>
                <button type="button" className={btn} aria-label="Move down" disabled={i === items.length - 1} onClick={() => change((r) => moveItem(r, section.id, path, i, i + 1))}>
                  ↓
                </button>
                <button type="button" className={`${btn} hover:!text-coral-ink`} aria-label="Remove" onClick={() => change((r) => removeItem(r, section.id, path, i))}>
                  ✕
                </button>
              </div>
              {expanded && (
                <div className="border-t border-line p-2.5">
                  <Fields fields={field.item} value={item} path={[...path, i]} set={set} change={change} section={section} siteId={siteId} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        disabled={full}
        onClick={() => {
          const item = field.newItem() as Record<string, Json>;
          change((r) => addItem(r, section.id, path, item));
          setOpen(String(item.id));
        }}
        className="mt-1.5 w-full rounded-[3px] border border-dashed border-line px-2 py-1.5 text-xs font-semibold text-ink-2 hover:border-guide hover:text-guide disabled:opacity-50"
      >
        {full ? `${field.max} is the most this section holds` : `+ Add ${field.label.toLowerCase().replace(/s$/, "")}`}
      </button>
    </fieldset>
  );
}
