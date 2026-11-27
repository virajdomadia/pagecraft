import { newId } from "@/lib/doc/model";
import { href, image, link, text } from "@/sections/fields";
import type { SectionDef } from "@/sections/types";
import { Btn, type Common, has, Img, type ImageValue, type Link, Section, type SectionProps, Txt } from "@/sections/ui";

// --- nav ----------------------------------------------------------------------------------------

type NavLink = { id: string; label: string; href: string };
type NavProps = Common & { brand: string; links: NavLink[]; cta: Link };

function Nav({ props, variant, edit }: SectionProps<NavProps>) {
  const links = props.links ?? [];
  const items = links.map((l, i) => (
    <li key={l.id}>
      <a href={l.href || "#"}>
        <Txt edit={edit} path={["links", i, "label"]} value={l.label} placeholder="Link" />
      </a>
    </li>
  ));
  return (
    <Section common={props} type="nav" variant={variant}>
      <div className="pc-wrap pc-nav__bar">
        <Txt edit={edit} path={["brand"]} value={props.brand} as="p" className="pc-brand" placeholder="Brand" />
        <nav aria-label="Site" className="pc-nav__links">
          <ul>{items}</ul>
        </nav>
        <Btn link={props.cta} edit={edit} path={["cta"]} className="pc-nav__cta" />
        {/* Also in the editor, so the phone preview matches the live site (clicks are swallowed there). */}
        {links.length > 0 && (
          <details className="pc-nav__menu">
            <summary>Menu</summary>
            <ul>
              {links.map((l) => (
                <li key={l.id}>
                  <a href={l.href || "#"}>{l.label}</a>
                </li>
              ))}
              {props.cta?.label && (
                <li>
                  <a href={props.cta.href || "#"}>{props.cta.label}</a>
                </li>
              )}
            </ul>
          </details>
        )}
      </div>
    </Section>
  );
}

const navLink = () => ({ id: newId("i"), label: "Link", href: "#" });

export const nav: SectionDef = {
  type: "nav",
  label: "Navigation",
  description: "Your name, a few links and one button",
  variants: [
    { key: "inline", label: "Inline", thumb: [[8, 30, 26, 10, "head"], [52, 32, 12, 6], [68, 32, 12, 6], [86, 28, 26, 14, "btn"]] },
    { key: "centered", label: "Centered", thumb: [[40, 16, 40, 12, "head"], [28, 40, 14, 6], [46, 40, 14, 6], [64, 40, 14, 6], [82, 38, 12, 10, "btn"]] },
  ],
  fields: [
    text("brand", "Brand", 40),
    {
      kind: "list",
      key: "links",
      label: "Links",
      max: 6,
      item: [text("label", "Label", 32), href("href", "Goes to", "#section, https://… or tel:")],
      itemLabel: (it) => String(it.label || "Link"),
      newItem: navLink,
    },
    link("cta", "Button"),
  ],
  defaults: () => ({
    anchor: "",
    tone: "default",
    brand: "Your business",
    links: [
      { id: newId("i"), label: "About", href: "#about" },
      { id: newId("i"), label: "Contact", href: "#contact" },
    ],
    cta: { label: "Get in touch", href: "#contact" },
  }),
  Component: Nav,
};

// --- hero ---------------------------------------------------------------------------------------

type HeroProps = Common & {
  eyebrow: string;
  headline: string;
  body: string;
  image: ImageValue;
  cta: Link;
  cta2: Link;
};

function Hero({ props, variant, edit, priority }: SectionProps<HeroProps>) {
  const copy = (
    <div className="pc-hero__copy">
      <Txt edit={edit} path={["eyebrow"]} value={props.eyebrow} as="p" className="pc-eyebrow" placeholder="Eyebrow" />
      <Txt edit={edit} path={["headline"]} value={props.headline} as="h1" className="pc-h1" placeholder="Headline" />
      <Txt edit={edit} path={["body"]} value={props.body} as="p" className="pc-lead" multiline placeholder="A sentence or two" />
      {has(edit, props.cta?.label, props.cta2?.label) && (
        <div className="pc-actions">
          <Btn link={props.cta} edit={edit} path={["cta"]} />
          <Btn link={props.cta2} edit={edit} path={["cta2"]} variant="line" />
        </div>
      )}
    </div>
  );
  const img = (sizes: string, ratio?: string) => (
    <Img image={props.image} edit={edit} sizes={sizes} priority={priority} className="pc-hero__img" ratio={ratio} />
  );
  if (variant === "full") {
    return (
      <Section common={props} type="hero" variant="full">
        <div className="pc-hero__media">{img("100vw")}</div>
        <div className="pc-wrap pc-hero__over">{copy}</div>
      </Section>
    );
  }
  if (variant === "centered") {
    return (
      <Section common={props} type="hero" variant="centered">
        <div className="pc-wrap">
          {copy}
          {has(edit, props.image?.url) && <div className="pc-hero__wide">{img("(min-width: 1200px) 1120px, 92vw", "16 / 7")}</div>}
        </div>
      </Section>
    );
  }
  return (
    <Section common={props} type="hero" variant="split">
      <div className="pc-wrap pc-hero__grid">
        {copy}
        {has(edit, props.image?.url) && <div className="pc-hero__side">{img("(min-width: 900px) 46vw, 92vw", "4 / 3")}</div>}
      </div>
    </Section>
  );
}

export const hero: SectionDef = {
  type: "hero",
  label: "Hero",
  description: "The first thing people read: headline, a line, a button",
  variants: [
    { key: "split", label: "Split", thumb: [[8, 14, 44, 6, "text"], [8, 24, 48, 12, "head"], [8, 40, 40, 5], [8, 52, 22, 10, "btn"], [66, 10, 46, 52, "img"]] },
    { key: "full", label: "Full-bleed", thumb: [[0, 0, 120, 72, "img"], [10, 30, 60, 12, "head"], [10, 46, 44, 5], [10, 56, 22, 9, "btn"]] },
    { key: "centered", label: "Centered", thumb: [[30, 8, 60, 12, "head"], [36, 24, 48, 5], [48, 33, 24, 8, "btn"], [12, 46, 96, 22, "img"]] },
  ],
  fields: [
    text("eyebrow", "Eyebrow", 60, { placeholder: "Since 2019 · Indiranagar" }),
    text("headline", "Headline", 90),
    text("body", "Body", 280, { multiline: true }),
    image("image", "Image"),
    link("cta", "Main button"),
    link("cta2", "Second button"),
  ],
  defaults: () => ({
    anchor: "",
    tone: "default",
    eyebrow: "New in Bengaluru",
    headline: "Say what you do in one honest line.",
    body: "Then add a sentence about who it's for and why they'll like it. Keep it short: people scan.",
    image: { url: "", alt: "" },
    cta: { label: "Get started", href: "#contact" },
    cta2: { label: "", href: "" },
  }),
  Component: Hero,
};
