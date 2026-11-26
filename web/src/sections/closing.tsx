import { newId } from "@/lib/doc/model";
import { href, image, link, text } from "@/sections/fields";
import type { SectionDef } from "@/sections/types";
import { Btn, type Common, has, Head, Icon, Img, type ImageValue, type Link, Section, type SectionProps, Txt } from "@/sections/ui";

// --- faq ----------------------------------------------------------------------------------------

type Faq = { id: string; question: string; answer: string };
type FaqProps = Common & { kicker: string; heading: string; items: Faq[] };

function FaqSection({ props, variant, edit }: SectionProps<FaqProps>) {
  const items = props.items ?? [];
  return (
    <Section common={props} type="faq" variant={variant}>
      <div className="pc-wrap pc-faq__wrap">
        <Head edit={edit} kicker={props.kicker} heading={props.heading} />
        {variant === "accordion" && !edit ? (
          <div className="pc-faq__list">
            {items.map((q) => (
              <details key={q.id} className="pc-faq__item">
                <summary>
                  <span>{q.question}</span>
                </summary>
                <p className="pc-body">{q.answer}</p>
              </details>
            ))}
          </div>
        ) : (
          <dl className="pc-faq__list">
            {items.map((q, i) => (
              <div key={q.id} className="pc-faq__item pc-faq__item--open">
                <Txt edit={edit} path={["items", i, "question"]} value={q.question} as="dt" className="pc-h3" placeholder="Question" />
                <Txt edit={edit} path={["items", i, "answer"]} value={q.answer} as="dd" className="pc-body" multiline placeholder="Answer" />
              </div>
            ))}
          </dl>
        )}
      </div>
    </Section>
  );
}

const faqItem = () => ({ id: newId("i"), question: "A question people ask before they buy?", answer: "A clear, friendly answer in two or three sentences." });

export const faq: SectionDef = {
  type: "faq",
  label: "FAQ",
  description: "Answers to the questions people ask before they buy",
  variants: [
    { key: "accordion", label: "Accordion", thumb: [[8, 6, 40, 8, "head"], [8, 22, 104, 10, "box"], [8, 36, 104, 10, "box"], [8, 50, 104, 10, "box"]] },
    { key: "two-column", label: "Two columns", thumb: [[8, 6, 40, 8, "head"], [8, 22, 48, 6, "head"], [8, 31, 48, 10], [64, 22, 48, 6, "head"], [64, 31, 48, 10], [8, 48, 48, 6, "head"], [64, 48, 48, 6, "head"]] },
  ],
  fields: [
    text("kicker", "Kicker", 40),
    text("heading", "Heading", 80),
    {
      kind: "list",
      key: "items",
      label: "Questions",
      max: 12,
      item: [text("question", "Question", 140), text("answer", "Answer", 600, { multiline: true })],
      itemLabel: (it) => String(it.question || "Question"),
      newItem: faqItem,
    },
  ],
  defaults: () => ({ anchor: "faq", tone: "default", kicker: "FAQ", heading: "Questions, answered", items: [faqItem(), faqItem(), faqItem()] }),
  Component: FaqSection,
};

// --- contact ------------------------------------------------------------------------------------

type ContactProps = Common & {
  kicker: string;
  heading: string;
  body: string;
  address: string;
  hours: string;
  phone: string;
  email: string;
  cta: Link;
  image: ImageValue;
};

function Contact({ props, variant, edit }: SectionProps<ContactProps>) {
  const tel = props.phone ? `tel:${props.phone.replace(/[^+0-9]/g, "")}` : undefined;
  const block = (key: "address" | "hours" | "phone" | "email", label: string, icon: string, hrefValue?: string) =>
    has(edit, props[key]) && (
      <div className="pc-contact__item">
        <span className="pc-feature__icon">
          <Icon name={icon} />
        </span>
        <div>
          <p className="pc-contact__label">{label}</p>
          {hrefValue && !edit ? (
            <a href={hrefValue} className="pc-body pc-contact__value">
              {props[key]}
            </a>
          ) : (
            <Txt edit={edit} path={[key]} value={props[key]} as="p" className="pc-body pc-contact__value" multiline={key === "address" || key === "hours"} placeholder={label} />
          )}
        </div>
      </div>
    );
  const info = (
    <div className="pc-contact__info">
      <Head edit={edit} kicker={props.kicker} heading={props.heading} />
      <Txt edit={edit} path={["body"]} value={props.body} as="p" className="pc-intro" multiline placeholder="How to reach you" />
      <div className="pc-contact__grid">
        {block("address", "Address", "pin")}
        {block("hours", "Hours", "clock")}
        {block("phone", "Phone", "phone", tel)}
        {block("email", "Email", "check", props.email ? `mailto:${props.email}` : undefined)}
      </div>
      <Btn link={props.cta} edit={edit} path={["cta"]} />
    </div>
  );
  return (
    <Section common={props} type="contact" variant={variant}>
      <div className={`pc-wrap ${variant === "split" ? "pc-contact__split" : ""}`}>
        {info}
        {variant === "split" && has(edit, props.image?.url) && (
          <Img image={props.image} edit={edit} sizes="(min-width: 900px) 45vw, 92vw" className="pc-contact__img" ratio="4 / 5" />
        )}
      </div>
    </Section>
  );
}

export const contact: SectionDef = {
  type: "contact",
  label: "Contact",
  description: "Address, hours, phone and a way to reach you",
  variants: [
    { key: "details", label: "Details", thumb: [[8, 6, 40, 8, "head"], [8, 22, 50, 18, "box"], [62, 22, 50, 18, "box"], [8, 44, 50, 18, "box"], [62, 44, 50, 18, "box"]] },
    { key: "split", label: "With photo", thumb: [[8, 8, 40, 8, "head"], [8, 22, 48, 5], [8, 32, 48, 5], [8, 42, 48, 5], [8, 54, 24, 10, "btn"], [66, 8, 46, 58, "img"]] },
  ],
  fields: [
    text("kicker", "Kicker", 40),
    text("heading", "Heading", 80),
    text("body", "Body", 240, { multiline: true }),
    text("address", "Address", 200, { multiline: true }),
    text("hours", "Hours", 200, { multiline: true }),
    text("phone", "Phone", 40),
    text("email", "Email", 80),
    link("cta", "Button"),
    image("image", "Photo (With photo layout)"),
  ],
  defaults: () => ({
    anchor: "contact",
    tone: "surface",
    kicker: "Visit",
    heading: "Come and see us",
    body: "",
    address: "Street and number\nArea, Bengaluru 560001",
    hours: "Mon–Sat 9 am – 7 pm",
    phone: "+91 98450 00000",
    email: "hello@example.com",
    cta: { label: "Get directions", href: "https://www.openstreetmap.org/" },
    image: { url: "", alt: "" },
  }),
  Component: Contact,
};

// --- cta ----------------------------------------------------------------------------------------

type CtaProps = Common & { heading: string; body: string; cta: Link };

function Cta({ props, variant, edit }: SectionProps<CtaProps>) {
  return (
    <Section common={props} type="cta" variant={variant}>
      <div className="pc-wrap">
        <div className="pc-cta__box">
          <div>
            <Txt edit={edit} path={["heading"]} value={props.heading} as="h2" className="pc-h2" placeholder="Heading" />
            <Txt edit={edit} path={["body"]} value={props.body} as="p" className="pc-intro" multiline placeholder="One line of detail" />
          </div>
          <Btn link={props.cta} edit={edit} path={["cta"]} />
        </div>
      </div>
    </Section>
  );
}

export const cta: SectionDef = {
  type: "cta",
  label: "Call to action",
  description: "One clear ask: book, call, order",
  variants: [
    { key: "band", label: "Band", thumb: [[0, 16, 120, 40, "box"], [10, 26, 60, 10, "head"], [10, 40, 44, 5], [84, 28, 28, 14, "btn"]] },
    { key: "card", label: "Card", thumb: [[16, 10, 88, 52, "box"], [30, 20, 60, 10, "head"], [36, 34, 48, 5], [46, 44, 28, 10, "btn"]] },
  ],
  fields: [text("heading", "Heading", 90), text("body", "Body", 200, { multiline: true }), link("cta", "Button")],
  defaults: () => ({ anchor: "", tone: "accent", heading: "Ready when you are.", body: "Tell people exactly what to do next.", cta: { label: "Book now", href: "#contact" } }),
  Component: Cta,
};

// --- footer -------------------------------------------------------------------------------------

type FooterLink = { id: string; label: string; href: string };
type FooterProps = Common & { brand: string; tagline: string; links: FooterLink[]; note: string };

function Footer({ props, variant, edit }: SectionProps<FooterProps>) {
  const links = props.links ?? [];
  return (
    <Section common={props} type="footer" variant={variant}>
      <footer className="pc-wrap pc-footer__grid">
        <div className="pc-footer__brand">
          <Txt edit={edit} path={["brand"]} value={props.brand} as="p" className="pc-brand" placeholder="Brand" />
          <Txt edit={edit} path={["tagline"]} value={props.tagline} as="p" className="pc-body" placeholder="A line about you" />
        </div>
        {links.length > 0 && (
          <ul className="pc-footer__links">
            {links.map((l, i) => {
              const external = /^https?:\/\//.test(l.href);
              return (
                <li key={l.id}>
                  <a href={l.href || "#"} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
                    <Txt edit={edit} path={["links", i, "label"]} value={l.label} placeholder="Link" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        <Txt edit={edit} path={["note"]} value={props.note} as="p" className="pc-footer__note" placeholder="© 2026" />
      </footer>
    </Section>
  );
}

export const footer: SectionDef = {
  type: "footer",
  label: "Footer",
  description: "Your name, links and the small print",
  variants: [
    { key: "simple", label: "Simple", thumb: [[8, 26, 30, 8, "head"], [8, 38, 44, 5], [70, 28, 14, 5], [88, 28, 14, 5], [8, 56, 30, 4]] },
    { key: "columns", label: "Columns", thumb: [[8, 14, 30, 8, "head"], [8, 26, 40, 5], [64, 14, 20, 5], [64, 24, 20, 5], [64, 34, 20, 5], [8, 58, 104, 1, "box"]] },
  ],
  fields: [
    text("brand", "Brand", 40),
    text("tagline", "Tagline", 140),
    {
      kind: "list",
      key: "links",
      label: "Links",
      max: 8,
      item: [text("label", "Label", 32), href("href", "Goes to", "https://…, mailto: or tel:")],
      itemLabel: (it) => String(it.label || "Link"),
      newItem: () => ({ id: newId("i"), label: "Instagram", href: "https://www.instagram.com/" }),
    },
    text("note", "Small print", 120),
  ],
  defaults: () => ({
    anchor: "",
    tone: "default",
    brand: "Your business",
    tagline: "Where you are and what you do, in a line.",
    links: [{ id: newId("i"), label: "Instagram", href: "https://www.instagram.com/" }],
    note: `© ${new Date().getFullYear()}`,
  }),
  Component: Footer,
};
