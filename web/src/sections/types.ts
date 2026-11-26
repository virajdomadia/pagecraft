import type { ComponentType } from "react";
import type { Json } from "@/lib/doc/model";
import type { Field } from "@/sections/fields";
import type { SectionProps } from "@/sections/ui";

export const SECTION_TYPES = [
  "nav",
  "hero",
  "features",
  "gallery",
  "testimonials",
  "pricing",
  "faq",
  "contact",
  "cta",
  "footer",
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/** A wireframe box in a 120 × 72 thumbnail: [x, y, w, h, kind]. */
export type ThumbBox = [number, number, number, number, ("text" | "head" | "img" | "btn" | "box")?];

export type Variant = { key: string; label: string; thumb: ThumbBox[] };

export type SectionDef = {
  type: SectionType;
  label: string;
  description: string;
  variants: Variant[];
  /** Props fields without COMMON (anchor, tone), which every section gets. */
  fields: Field[];
  defaults: () => Record<string, Json>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: ComponentType<SectionProps<any>>;
};
