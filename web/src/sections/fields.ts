import { z } from "zod";

/**
 * Field specs: one description per section prop that drives three things —
 * the inspector form (components/editor/Inspector.tsx), the zod schema (`schemaFor`) and the
 * catalog summary compared with the API's pydantic mirror (catalog.test.ts ↔
 * api/tests/catalog.snapshot.json). Change a limit here and in api/app/sections.py together.
 */

export type TextField = {
  kind: "text";
  key: string;
  label: string;
  max: number;
  multiline?: boolean;
  placeholder?: string;
  hint?: string;
};
export type HrefField = { kind: "href"; key: string; label: string; hint?: string };
export type AnchorField = { kind: "anchor"; key: string; label: string; hint?: string };
export type ImageField = { kind: "image"; key: string; label: string; flat?: boolean };
export type LinkField = { kind: "link"; key: string; label: string };
export type EnumField = {
  kind: "enum";
  key: string;
  label: string;
  options: readonly { value: string; label: string }[];
  display?: "select" | "segmented" | "icons";
};
export type BoolField = { kind: "bool"; key: string; label: string };
export type ListField = {
  kind: "list";
  key: string;
  label: string;
  max: number;
  item: Field[];
  itemLabel: (item: Record<string, unknown>, index: number) => string;
  newItem: () => Record<string, unknown>;
};
export type Field =
  | TextField
  | HrefField
  | AnchorField
  | ImageField
  | LinkField
  | EnumField
  | BoolField
  | ListField;

export const LINK_RE = /^(#[A-Za-z0-9_-]*|https?:\/\/[^\s<>"]+|mailto:[^\s<>"]+|tel:[+0-9 ()-]+)$/;
export const IMAGE_RE =
  /^(\/templates\/[A-Za-z0-9/_.-]+|\/api\/media\/[A-Za-z0-9_.-]+|https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/[A-Za-z0-9/_.%-]+)$/;
export const ANCHOR_RE = /^[a-z0-9-]{0,40}$/;
export const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const LINK_MESSAGE = "Links start with #, https://, mailto: or tel:";

export const hrefSchema = z
  .string()
  .max(300)
  .refine((v) => v === "" || LINK_RE.test(v), LINK_MESSAGE);
export const imageUrlSchema = z
  .string()
  .max(300)
  .refine((v) => v === "" || IMAGE_RE.test(v), "Upload the image or pick one from the library");

const imageObject = z
  .object({ url: imageUrlSchema, alt: z.string().max(140) })
  .strict()
  .refine((v) => !v.url || v.alt.trim() !== "", { message: "Every image needs alt text", path: ["alt"] });

function fieldSchema(f: Field): z.ZodTypeAny {
  switch (f.kind) {
    case "text":
      return z.string().max(f.max, `${f.label}: at most ${f.max} characters`);
    case "href":
      return hrefSchema;
    case "anchor":
      return z.string().regex(ANCHOR_RE, "Anchors are lower-case letters, digits and dashes");
    case "image":
      return imageObject;
    case "link":
      return z.object({ label: z.string().max(32), href: hrefSchema }).strict();
    case "enum":
      return z.enum(f.options.map((o) => o.value) as [string, ...string[]]);
    case "bool":
      return z.boolean();
    case "list":
      return z.array(itemSchema(f.item)).max(f.max, `${f.label}: at most ${f.max}`);
  }
}

function itemSchema(fields: Field[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = { id: z.string().regex(ID_RE) };
  let flatImage = false;
  for (const f of fields) {
    if (f.kind === "image" && f.flat) {
      flatImage = true;
      shape.url = imageUrlSchema;
      shape.alt = z.string().max(140);
    } else shape[f.key] = fieldSchema(f);
  }
  const obj = z.object(shape).strict();
  return flatImage
    ? obj.refine((v) => !v.url || String(v.alt).trim() !== "", {
        message: "Every image needs alt text",
        path: ["alt"],
      })
    : obj;
}

export function schemaFor(fields: Field[]): z.ZodTypeAny {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) shape[f.key] = fieldSchema(f);
  return z.object(shape).strict();
}

// --- catalog summary (must equal app.sections.catalog_summary) ---------------------------------

type Summary = Record<string, unknown>;

function summarise(f: Field): Summary | Record<string, Summary> {
  switch (f.kind) {
    case "text":
      return { kind: "text", max: f.max };
    case "href":
      return { kind: "text", max: 300 };
    case "anchor":
      return { kind: "text", max: null };
    case "image":
      return {
        kind: "object",
        fields: { url: { kind: "text", max: 300 }, alt: { kind: "text", max: 140 } },
      };
    case "link":
      return {
        kind: "object",
        fields: { label: { kind: "text", max: 32 }, href: { kind: "text", max: 300 } },
      };
    case "enum":
      return { kind: "enum", values: f.options.map((o) => o.value) };
    case "bool":
      return { kind: "bool" };
    case "list": {
      const item: Record<string, unknown> = { id: { kind: "text", max: null } };
      for (const sub of f.item) {
        if (sub.kind === "image" && sub.flat) {
          item.url = { kind: "text", max: 300 };
          item.alt = { kind: "text", max: 140 };
        } else item[sub.key] = summarise(sub);
      }
      return { kind: "list", max: f.max, item };
    }
  }
}

export function summaryFor(fields: Field[]): Record<string, unknown> {
  return Object.fromEntries(fields.map((f) => [f.key, summarise(f)]));
}

// --- builders -----------------------------------------------------------------------------------

export const text = (key: string, label: string, max: number, extra: Partial<TextField> = {}): TextField => ({
  kind: "text",
  key,
  label,
  max,
  ...extra,
});
export const href = (key: string, label: string, hint?: string): HrefField => ({ kind: "href", key, label, hint });
export const image = (key: string, label: string, flat = false): ImageField => ({ kind: "image", key, label, flat });
export const link = (key: string, label: string): LinkField => ({ kind: "link", key, label });

export const TONES = [
  { value: "default", label: "Page" },
  { value: "surface", label: "Tint" },
  { value: "accent", label: "Accent" },
] as const;

/** Every section carries these two (Common in api/app/sections.py). */
export const COMMON: Field[] = [
  { kind: "anchor", key: "anchor", label: "Anchor", hint: "Lets links jump here, e.g. #menu" },
  { kind: "enum", key: "tone", label: "Background", options: TONES, display: "segmented" },
];

/** Find a field by a props path (`["items", 2, "title"]` → the list item's `title` field). */
export function fieldAt(fields: Field[], path: (string | number)[]): Field | undefined {
  let list = fields;
  let found: Field | undefined;
  for (const part of path) {
    if (typeof part === "number") continue;
    found = list.find((f) => f.key === part);
    if (!found) {
      // a flat image inside a list item contributes `url` / `alt` at the item level
      if ((part === "alt" || part === "url") && list.some((f) => f.kind === "image" && f.flat))
        return part === "alt" ? { kind: "text", key: "alt", label: "Alt text", max: 140 } : undefined;
      return undefined;
    }
    if (found.kind === "list") list = found.item;
    if (found.kind === "link") list = [{ kind: "text", key: "label", label: "Label", max: 32 }];
    if (found.kind === "image") list = [{ kind: "text", key: "alt", label: "Alt text", max: 140 }];
  }
  return found;
}
