import * as Y from "yjs";

/**
 * The site document (04 §2) — the same two roots and the same JSON → Yjs rule as
 * api/app/services/crdt.py, so a template built by pycrdt opens here and an edit made here
 * exports there:
 *
 * - `site`     Y.Map  { name: Y.Text, theme: Y.Map, seo: Y.Map }
 * - `sections` Y.Array<Y.Map { id, type, variant, props: Y.Map }>
 *
 * Objects → Y.Map, arrays → Y.Array, strings → Y.Text (character merge for anything a person
 * types) except ATOMIC_KEYS, whose strings stay plain values (last writer wins for a variant or
 * a URL). v2 adds a sync provider on top of this; nothing here changes.
 */

export const ATOMIC_KEYS = new Set([
  "id",
  "type",
  "variant",
  "url",
  "href",
  "icon",
  "tone",
  "anchor",
  "palette",
  "fonts",
  "radius",
  "og_image",
]);

/** Origin for every transaction the local user makes: the UndoManager tracks only these. */
export const LOCAL = Symbol("pc-local");
/** Origin for applying the stored document on load — never queued, never undoable. */
export const LOAD = Symbol("pc-load");

export type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
export type SectionJson = { id: string; type: string; variant: string; props: Record<string, Json> };
export type SiteContent = {
  site: { name: string; theme: Record<string, string>; seo: Record<string, string> } & Record<string, Json>;
  sections: SectionJson[];
};

export function toY(value: Json | undefined, key?: string): unknown {
  if (Array.isArray(value)) {
    const arr = new Y.Array();
    arr.push(value.map((v) => toY(v)));
    return arr;
  }
  if (value !== null && typeof value === "object") {
    const map = new Y.Map();
    for (const [k, v] of Object.entries(value)) map.set(k, toY(v, k));
    return map;
  }
  if (typeof value === "string") return key && ATOMIC_KEYS.has(key) ? value : new Y.Text(value);
  return value;
}

export function roots(doc: Y.Doc) {
  return {
    site: doc.getMap<unknown>("site"),
    sections: doc.getArray<Y.Map<unknown>>("sections"),
  };
}

export function exportDoc(doc: Y.Doc): SiteContent {
  const { site, sections } = roots(doc);
  return { site: site.toJSON() as SiteContent["site"], sections: sections.toJSON() as SectionJson[] };
}

export function buildDoc(content: SiteContent): Y.Doc {
  const doc = new Y.Doc();
  const { site, sections } = roots(doc);
  doc.transact(() => {
    for (const [k, v] of Object.entries(content.site)) site.set(k, toY(v as Json, k));
    sections.push(content.sections.map((s) => toY(s as unknown as Json) as Y.Map<unknown>));
  });
  return doc;
}

export type Path = (string | number)[];

/** Walk from a Y.Map / Y.Array along `path`. */
export function getAt(root: unknown, path: Path): unknown {
  let cur: unknown = root;
  for (const part of path) {
    if (cur instanceof Y.Map) cur = cur.get(String(part));
    else if (cur instanceof Y.Array) cur = cur.get(Number(part));
    else return undefined;
  }
  return cur;
}

/**
 * Replace a Y.Text's content with the smallest edit (common prefix / suffix kept), so a
 * concurrent edit elsewhere in the same text survives — the whole point of a CRDT text.
 */
export function replaceText(text: Y.Text, next: string): void {
  const prev = text.toString();
  if (prev === next) return;
  let start = 0;
  while (start < prev.length && start < next.length && prev[start] === next[start]) start++;
  let endPrev = prev.length;
  let endNext = next.length;
  while (endPrev > start && endNext > start && prev[endPrev - 1] === next[endNext - 1]) {
    endPrev--;
    endNext--;
  }
  if (endPrev > start) text.delete(start, endPrev - start);
  if (endNext > start) text.insert(start, next.slice(start, endNext));
}

/** Where index `i` of a Y.Text moves to after a change: a teammate's edit must not move your caret. */
export function shiftIndex(delta: Y.YTextEvent["delta"], i: number): number {
  let pos = 0;
  let out = i;
  for (const op of delta) {
    if (op.retain) pos += op.retain;
    else if (typeof op.insert === "string") {
      if (pos < out) out += op.insert.length;
      pos += op.insert.length;
    } else if (op.delete && pos < out) out -= Math.min(op.delete, out - pos);
  }
  return out;
}

/** Set a field: Y.Text fields get a minimal text edit, atomic fields a plain set. */
export function setField(map: Y.Map<unknown>, key: string, value: Json): void {
  const current = map.get(key);
  if (typeof value === "string" && !ATOMIC_KEYS.has(key)) {
    if (current instanceof Y.Text) replaceText(current, value);
    else map.set(key, new Y.Text(value));
    return;
  }
  if (current !== value) map.set(key, toY(value, key));
}

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Client-generated ids (04 §2): `s_k3x9q2` for sections, `i_…` for list items. */
export function newId(prefix: "s" | "i"): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")}`;
}

/** A deep copy of a section's JSON with fresh ids (duplicate). */
export function withFreshIds(section: SectionJson): SectionJson {
  const fresh = (v: Json): Json => {
    if (Array.isArray(v)) return v.map((x) => fresh(x));
    if (v && typeof v === "object") {
      const out: Record<string, Json> = {};
      for (const [k, x] of Object.entries(v)) out[k] = k === "id" && typeof x === "string" ? newId("i") : fresh(x);
      return out;
    }
    return v;
  };
  return { ...section, id: newId("s"), props: fresh(section.props) as Record<string, Json> };
}
