import { contact, cta, faq, footer } from "@/sections/closing";
import { features, gallery, pricing, testimonials } from "@/sections/content";
import { COMMON, type Field, fieldAt, schemaFor, summaryFor } from "@/sections/fields";
import { ICON_KEYS } from "@/sections/icons";
import { hero, nav } from "@/sections/nav-hero";
import type { SectionDef, SectionType } from "@/sections/types";
import { SECTION_TYPES } from "@/sections/types";
import { FONT_PAIR_KEYS, PALETTE_KEYS, RADII } from "@/lib/themes";
import { newId, type SectionJson } from "@/lib/doc/model";

/**
 * The section registry (04 §2): one definition per type — components, variants with wireframe
 * thumbnails, inspector fields, zod schema, defaults. The editor canvas and the published page
 * render the same components.
 */
export const REGISTRY: Record<SectionType, SectionDef> = {
  nav,
  hero,
  features,
  gallery,
  testimonials,
  pricing,
  faq,
  contact,
  cta,
  footer,
};

export const MAX_SECTIONS = 30;

export function isSectionType(t: string): t is SectionType {
  return (SECTION_TYPES as readonly string[]).includes(t);
}

export function allFields(type: SectionType): Field[] {
  return [...COMMON, ...REGISTRY[type].fields];
}

export function fieldFor(type: string, path: (string | number)[]): Field | undefined {
  return isSectionType(type) ? fieldAt(allFields(type), path) : undefined;
}

export function newSection(type: SectionType, variant?: string): SectionJson {
  const def = REGISTRY[type];
  return { id: newId("s"), type, variant: variant ?? def.variants[0].key, props: def.defaults() } as SectionJson;
}

export type Issue = { sectionId: string | null; message: string };

/** Client-side mirror of the API's publish validation, for instant feedback in the editor. */
export function validateSection(section: SectionJson): Issue | null {
  if (!isSectionType(section.type)) return { sectionId: section.id, message: `Unknown section “${section.type}”` };
  const def = REGISTRY[section.type];
  if (!def.variants.some((v) => v.key === section.variant))
    return { sectionId: section.id, message: `${def.label} has no “${section.variant}” layout` };
  const result = schemaFor(allFields(section.type)).safeParse(section.props);
  if (result.success) return null;
  const err = result.error.issues[0];
  return { sectionId: section.id, message: `${def.label}: ${err.message}` };
}

export function catalogSummary() {
  return {
    palettes: [...PALETTE_KEYS],
    fonts: [...FONT_PAIR_KEYS],
    radii: [...RADII],
    icons: [...ICON_KEYS],
    max_sections: MAX_SECTIONS,
    sections: Object.fromEntries(
      SECTION_TYPES.map((t) => [t, { variants: REGISTRY[t].variants.map((v) => v.key), props: summaryFor(allFields(t)) }]),
    ),
  };
}
