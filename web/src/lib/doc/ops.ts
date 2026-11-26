import * as Y from "yjs";
import { getAt, type Json, type Path, type roots, type SectionJson, setField, toY, withFreshIds } from "@/lib/doc/model";

/**
 * Document operations. Every one runs inside the caller's `change(...)` transaction (origin
 * LOCAL), so each is a single undo step and a single autosave update.
 */

type Roots = ReturnType<typeof roots>;

export function sectionIndex(r: Roots, id: string): number {
  return r.sections.toArray().findIndex((m) => m.get("id") === id);
}

export function propsMap(r: Roots, id: string): Y.Map<unknown> | undefined {
  const i = sectionIndex(r, id);
  return i < 0 ? undefined : (r.sections.get(i).get("props") as Y.Map<unknown>);
}

export function insertSection(r: Roots, section: SectionJson, index: number): void {
  r.sections.insert(Math.max(0, Math.min(index, r.sections.length)), [toY(section as unknown as Json) as Y.Map<unknown>]);
}

export function deleteSection(r: Roots, id: string): void {
  const i = sectionIndex(r, id);
  if (i >= 0) r.sections.delete(i, 1);
}

export function duplicateSection(r: Roots, id: string): string | null {
  const i = sectionIndex(r, id);
  if (i < 0) return null;
  const copy = withFreshIds(r.sections.get(i).toJSON() as SectionJson);
  insertSection(r, copy, i + 1);
  return copy.id;
}

/** Y.Array has no move: delete and re-insert a copy (ids are kept, so selection follows). */
export function moveSection(r: Roots, from: number, to: number): void {
  if (from === to || from < 0 || to < 0 || from >= r.sections.length || to >= r.sections.length) return;
  const json = r.sections.get(from).toJSON() as SectionJson;
  r.sections.delete(from, 1);
  insertSection(r, json, to);
}

export function setVariant(r: Roots, id: string, variant: string): void {
  const i = sectionIndex(r, id);
  if (i >= 0) r.sections.get(i).set("variant", variant);
}

/** Set any prop by path: `["headline"]`, `["cta", "href"]`, `["items", 2, "title"]`. */
export function setProp(r: Roots, id: string, path: Path, value: Json): void {
  const props = propsMap(r, id);
  if (!props) return;
  const parent = path.length > 1 ? getAt(props, path.slice(0, -1)) : props;
  const key = path[path.length - 1];
  if (parent instanceof Y.Map) setField(parent, String(key), value);
}

export function listOf(r: Roots, id: string, path: Path): Y.Array<Y.Map<unknown>> | null {
  const props = propsMap(r, id);
  const arr = props ? getAt(props, path) : undefined;
  return arr instanceof Y.Array ? (arr as Y.Array<Y.Map<unknown>>) : null;
}

export function addItem(r: Roots, id: string, path: Path, item: Record<string, Json>): void {
  listOf(r, id, path)?.push([toY(item) as Y.Map<unknown>]);
}

export function removeItem(r: Roots, id: string, path: Path, index: number): void {
  const arr = listOf(r, id, path);
  if (arr && index >= 0 && index < arr.length) arr.delete(index, 1);
}

export function moveItem(r: Roots, id: string, path: Path, from: number, to: number): void {
  const arr = listOf(r, id, path);
  if (!arr || to < 0 || to >= arr.length || from === to) return;
  const json = arr.get(from).toJSON() as Json;
  arr.delete(from, 1);
  arr.insert(to, [toY(json) as Y.Map<unknown>]);
}

export function setTheme(r: Roots, key: "palette" | "fonts" | "radius", value: string): void {
  let theme = r.site.get("theme");
  if (!(theme instanceof Y.Map)) {
    theme = new Y.Map();
    r.site.set("theme", theme);
  }
  (theme as Y.Map<unknown>).set(key, value);
}

export function setSeo(r: Roots, seo: { title: string; description: string; og_image: string }): void {
  let map = r.site.get("seo");
  if (!(map instanceof Y.Map)) {
    map = new Y.Map();
    r.site.set("seo", map);
  }
  const m = map as Y.Map<unknown>;
  setField(m, "title", seo.title);
  setField(m, "description", seo.description);
  setField(m, "og_image", seo.og_image);
}
