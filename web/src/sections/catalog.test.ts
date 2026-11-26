import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { SectionJson } from "@/lib/doc/model";
import { catalogSummary, newSection, REGISTRY, validateSection } from "@/sections/registry";
import { SECTION_TYPES } from "@/sections/types";

const API = join(__dirname, "..", "..", "..", "api");
const templatesDir = join(API, "app", "seed", "templates");
const templates = readdirSync(templatesDir).map(
  (f) => JSON.parse(readFileSync(join(templatesDir, f), "utf8")) as { meta: { key: string }; content: { sections: SectionJson[] } },
);

describe("the section registry", () => {
  it("matches the API's pydantic mirror (api/tests/catalog.snapshot.json)", () => {
    const snapshot = JSON.parse(readFileSync(join(API, "tests", "catalog.snapshot.json"), "utf8"));
    expect(catalogSummary()).toEqual(snapshot);
  });

  it.each(templates.map((t) => [t.meta.key, t] as const))("validates every section of the %s template", (_, t) => {
    for (const section of t.content.sections) expect(validateSection(section)).toBeNull();
  });

  it.each(SECTION_TYPES.flatMap((type) => REGISTRY[type].variants.map((v) => [type, v.key] as const)))(
    "%s · %s defaults are publishable",
    (type, variant) => {
      expect(validateSection(newSection(type, variant))).toBeNull();
    },
  );

  it("names the section and the problem when something is wrong", () => {
    const hero = newSection("hero");
    expect(validateSection({ ...hero, variant: "zigzag" })?.message).toMatch(/zigzag/);
    const long = { ...hero, props: { ...hero.props, headline: "x".repeat(91) } };
    expect(validateSection(long)).toEqual({ sectionId: hero.id, message: "Hero: Headline: at most 90 characters" });
    const js = { ...hero, props: { ...hero.props, cta: { label: "Go", href: "javascript:alert(1)" } } };
    expect(validateSection(js)?.message).toMatch(/Links start with/);
  });
});
