import { newId } from "@/lib/doc/model";
import { image, link, text } from "@/sections/fields";
import { ICON_KEYS } from "@/sections/icons";
import type { SectionDef } from "@/sections/types";
import { Btn, type Common, has, Head, Icon, Img, type Link, Section, type SectionProps, Txt } from "@/sections/ui";

const ICON_OPTIONS = ICON_KEYS.map((k) => ({ value: k, label: k }));
const heading = [text("kicker", "Kicker", 40), text("heading", "Heading", 80)];

// --- features -----------------------------------------------------------------------------------

type Feature = { id: string; icon: string; title: string; body: string; meta: string };
type FeaturesProps = Common & { kicker: string; heading: string; intro: string; items: Feature[] };

function Features({ props, variant, edit }: SectionProps<FeaturesProps>) {
  const items = props.items ?? [];
  return (
    <Section common={props} type="features" variant={variant}>
      <div className="pc-wrap">
        <Head edit={edit} kicker={props.kicker} heading={props.heading} intro={props.intro} />
        <ul className="pc-features__list">
          {items.map((it, i) => (
            <li key={it.id} className="pc-feature">
              {variant !== "rows" && (
                <span className="pc-feature__icon">
                  <Icon name={it.icon} />
                </span>
              )}
              <div className="pc-feature__top">
                <Txt edit={edit} path={["items", i, "title"]} value={it.title} as="h3" className="pc-h3" placeholder="Title" />
                {variant !== "icons" && (
                  <Txt edit={edit} path={["items", i, "meta"]} value={it.meta} as="span" className="pc-meta" placeholder="₹" />
                )}
              </div>
              <Txt edit={edit} path={["items", i, "body"]} value={it.body} as="p" className="pc-body" multiline placeholder="Describe it" />
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

const feature = () => ({ id: newId("i"), icon: "star", title: "Something you do well", body: "A line about why it matters to the people you serve.", meta: "" });

export const features: SectionDef = {
  type: "features",
  label: "Features",
  description: "Services, menu highlights or reasons to choose you",
  variants: [
    { key: "grid-3", label: "Cards", thumb: [[8, 6, 50, 8, "head"], [8, 22, 32, 44, "box"], [44, 22, 32, 44, "box"], [80, 22, 32, 44, "box"]] },
    { key: "icons", label: "Icons", thumb: [[8, 6, 50, 8, "head"], [10, 26, 10, 10, "img"], [38, 26, 10, 10, "img"], [66, 26, 10, 10, "img"], [94, 26, 10, 10, "img"], [8, 42, 22, 5], [36, 42, 22, 5], [64, 42, 22, 5], [92, 42, 22, 5]] },
    { key: "rows", label: "Menu rows", thumb: [[8, 6, 50, 8, "head"], [8, 24, 46, 5], [8, 36, 46, 5], [8, 48, 46, 5], [66, 24, 46, 5], [66, 36, 46, 5], [66, 48, 46, 5]] },
  ],
  fields: [
    ...heading,
    text("intro", "Intro", 240, { multiline: true }),
    {
      kind: "list",
      key: "items",
      label: "Items",
      max: 12,
      item: [
        { kind: "enum", key: "icon", label: "Icon", options: ICON_OPTIONS, display: "icons" },
        text("title", "Title", 60),
        text("body", "Body", 220, { multiline: true }),
        text("meta", "Price or detail", 32, { placeholder: "₹120 · 45 min" }),
      ],
      itemLabel: (it) => String(it.title || "Item"),
      newItem: feature,
    },
  ],
  defaults: () => ({
    anchor: "",
    tone: "default",
    kicker: "What we do",
    heading: "Three reasons people come back",
    intro: "",
    items: [feature(), feature(), feature()],
  }),
  Component: Features,
};

// --- gallery ------------------------------------------------------------------------------------

type Photo = { id: string; url: string; alt: string; caption: string };
type GalleryProps = Common & { kicker: string; heading: string; images: Photo[] };

function Gallery({ props, variant, edit }: SectionProps<GalleryProps>) {
  const images = (props.images ?? []).filter((p) => edit || p.url);
  const sizes =
    variant === "strip" ? "(min-width: 900px) 40vw, 80vw" : variant === "mosaic" ? "(min-width: 900px) 50vw, 92vw" : "(min-width: 900px) 33vw, 92vw";
  return (
    <Section common={props} type="gallery" variant={variant}>
      <div className="pc-wrap">
        <Head edit={edit} kicker={props.kicker} heading={props.heading} />
        <ul className="pc-gallery__list">
          {images.map((p, i) => (
            <li key={p.id} className="pc-photo">
              <figure>
                {edit || !p.url ? (
                  <Img image={p} edit={edit} sizes={sizes} />
                ) : (
                  <a href={p.url} data-pc-lightbox aria-label={`Open photo: ${p.alt}`}>
                    <Img image={p} sizes={sizes} />
                  </a>
                )}
                {has(edit, p.caption) && (
                  <Txt edit={edit} path={["images", i, "caption"]} value={p.caption} as="figcaption" placeholder="Caption" />
                )}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

const photo = () => ({ id: newId("i"), url: "", alt: "", caption: "" });

export const gallery: SectionDef = {
  type: "gallery",
  label: "Gallery",
  description: "Photos of the place, the food or the work",
  variants: [
    { key: "grid", label: "Grid", thumb: [[8, 6, 40, 8, "head"], [8, 20, 32, 22, "img"], [44, 20, 32, 22, "img"], [80, 20, 32, 22, "img"], [8, 46, 32, 22, "img"], [44, 46, 32, 22, "img"], [80, 46, 32, 22, "img"]] },
    { key: "mosaic", label: "Mosaic", thumb: [[8, 6, 40, 8, "head"], [8, 20, 52, 48, "img"], [64, 20, 22, 22, "img"], [90, 20, 22, 22, "img"], [64, 46, 48, 22, "img"]] },
    { key: "strip", label: "Strip", thumb: [[8, 6, 40, 8, "head"], [8, 20, 34, 46, "img"], [46, 20, 34, 46, "img"], [84, 20, 36, 46, "img"]] },
  ],
  fields: [
    ...heading,
    {
      kind: "list",
      key: "images",
      label: "Photos",
      max: 12,
      item: [image("image", "Photo", true), text("caption", "Caption", 80)],
      itemLabel: (it, i) => String(it.caption || it.alt || `Photo ${i + 1}`),
      newItem: photo,
    },
  ],
  defaults: () => ({ anchor: "", tone: "default", kicker: "Gallery", heading: "Have a look around", images: [photo(), photo(), photo()] }),
  Component: Gallery,
};

// --- testimonials -------------------------------------------------------------------------------

type Quote = { id: string; quote: string; name: string; role: string };
type TestimonialsProps = Common & { kicker: string; heading: string; items: Quote[] };

function Testimonials({ props, variant, edit }: SectionProps<TestimonialsProps>) {
  const items = props.items ?? [];
  return (
    <Section common={props} type="testimonials" variant={variant}>
      <div className="pc-wrap">
        <Head edit={edit} kicker={props.kicker} heading={props.heading} center={variant === "spotlight"} />
        <ul className="pc-quotes">
          {items.map((q, i) => (
            <li key={q.id} className="pc-quote">
              <figure>
                <blockquote>
                  <Txt edit={edit} path={["items", i, "quote"]} value={q.quote} as="p" multiline placeholder="What they said" />
                </blockquote>
                <figcaption>
                  <Txt edit={edit} path={["items", i, "name"]} value={q.name} as="span" className="pc-quote__name" placeholder="Name" />
                  <Txt edit={edit} path={["items", i, "role"]} value={q.role} as="span" className="pc-quote__role" placeholder="Who they are" />
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}

const quote = () => ({ id: newId("i"), quote: "A short, specific quote from a real customer works better than a long one.", name: "Customer name", role: "Regular" });

export const testimonials: SectionDef = {
  type: "testimonials",
  label: "Testimonials",
  description: "What customers say, in their words",
  variants: [
    { key: "cards", label: "Cards", thumb: [[8, 6, 40, 8, "head"], [8, 22, 32, 40, "box"], [44, 22, 32, 40, "box"], [80, 22, 32, 40, "box"]] },
    { key: "spotlight", label: "Spotlight", thumb: [[40, 6, 40, 8, "head"], [18, 22, 84, 10, "head"], [36, 36, 48, 5], [14, 50, 28, 14, "box"], [46, 50, 28, 14, "box"], [78, 50, 28, 14, "box"]] },
  ],
  fields: [
    ...heading,
    {
      kind: "list",
      key: "items",
      label: "Quotes",
      max: 9,
      item: [text("quote", "Quote", 320, { multiline: true }), text("name", "Name", 60), text("role", "Role or source", 60)],
      itemLabel: (it) => String(it.name || "Quote"),
      newItem: quote,
    },
  ],
  defaults: () => ({ anchor: "", tone: "default", kicker: "Reviews", heading: "What people say", items: [quote(), quote(), quote()] }),
  Component: Testimonials,
};

// --- pricing ------------------------------------------------------------------------------------

type Plan = { id: string; name: string; price: string; period: string; features: string; cta: Link; featured: boolean };
type PricingProps = Common & { kicker: string; heading: string; intro: string; plans: Plan[]; note: string };

function Pricing({ props, variant, edit }: SectionProps<PricingProps>) {
  const plans = props.plans ?? [];
  return (
    <Section common={props} type="pricing" variant={variant}>
      <div className="pc-wrap">
        <Head edit={edit} kicker={props.kicker} heading={props.heading} intro={props.intro} />
        <ul className="pc-plans">
          {plans.map((p, i) => {
            const lines = p.features.split("\n").filter((l) => l.trim());
            return (
              <li key={p.id} className={`pc-plan ${p.featured ? "pc-plan--featured" : ""}`}>
                {p.featured && <p className="pc-plan__flag">Most popular</p>}
                <Txt edit={edit} path={["plans", i, "name"]} value={p.name} as="h3" className="pc-h3" placeholder="Plan name" />
                <p className="pc-plan__price">
                  <Txt edit={edit} path={["plans", i, "price"]} value={p.price} as="span" className="pc-plan__amount" placeholder="₹0" />
                  <Txt edit={edit} path={["plans", i, "period"]} value={p.period} as="span" className="pc-plan__period" placeholder="per month" />
                </p>
                {edit ? (
                  <Txt edit={edit} path={["plans", i, "features"]} value={p.features} as="p" className="pc-plan__edit" multiline placeholder="One feature per line" />
                ) : (
                  lines.length > 0 && (
                    <ul className="pc-plan__features">
                      {lines.map((l, j) => (
                        <li key={j}>{l}</li>
                      ))}
                    </ul>
                  )
                )}
                <Btn link={p.cta} edit={edit} path={["plans", i, "cta"]} variant={p.featured ? "solid" : "line"} className="pc-plan__cta" />
              </li>
            );
          })}
        </ul>
        <Txt edit={edit} path={["note"]} value={props.note} as="p" className="pc-note" placeholder="A note under the plans" />
      </div>
    </Section>
  );
}

const plan = (featured = false) => ({
  id: newId("i"),
  name: featured ? "Most chosen" : "Starter",
  price: featured ? "₹2,499" : "₹999",
  period: "per month",
  features: "What's included\nAnother thing\nOne more",
  cta: { label: "Choose", href: "#contact" },
  featured,
});

export const pricing: SectionDef = {
  type: "pricing",
  label: "Pricing",
  description: "Plans, packages or a price list",
  variants: [
    { key: "cards", label: "Cards", thumb: [[8, 6, 40, 8, "head"], [8, 20, 32, 48, "box"], [44, 16, 32, 52, "box"], [80, 20, 32, 48, "box"]] },
    { key: "table", label: "Table", thumb: [[8, 6, 40, 8, "head"], [8, 22, 104, 12, "box"], [8, 38, 104, 12, "box"], [8, 54, 104, 12, "box"]] },
  ],
  fields: [
    ...heading,
    text("intro", "Intro", 240, { multiline: true }),
    {
      kind: "list",
      key: "plans",
      label: "Plans",
      max: 4,
      item: [
        text("name", "Name", 40),
        text("price", "Price", 24),
        text("period", "Period", 24, { placeholder: "per month" }),
        text("features", "Features (one per line)", 400, { multiline: true }),
        link("cta", "Button"),
        { kind: "bool", key: "featured", label: "Highlight this plan" },
      ],
      itemLabel: (it) => String(it.name || "Plan"),
      newItem: () => plan(),
    },
    text("note", "Note", 160),
  ],
  defaults: () => ({ anchor: "pricing", tone: "default", kicker: "Prices", heading: "Simple, honest prices", intro: "", plans: [plan(), plan(true), plan()], note: "" }),
  Component: Pricing,
};
