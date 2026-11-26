import type { CSSProperties, ElementType, ReactNode } from "react";
import type { Path } from "@/lib/doc/model";
import { Icon } from "@/sections/icons";

/**
 * Rendering primitives shared by every section. They are plain server-safe components (no hooks,
 * no client imports): the published page renders them as static HTML. The editor passes an
 * `EditApi` down instead, and `Txt` hands its text to `edit.text(...)`, which returns the
 * contentEditable binding to the field's Y.Text (components/editor/Editable.tsx).
 */

export type TextOpts = {
  path: Path;
  value: string;
  as: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
};

export type EditApi = {
  text(opts: TextOpts): ReactNode;
};

export type SectionProps<P> = {
  id: string;
  variant: string;
  props: P;
  edit?: EditApi;
  /** Rendered as the page's first section: the hero image loads eagerly (LCP). */
  priority?: boolean;
};

export type Link = { label: string; href: string };
export type ImageValue = { url: string; alt: string };
export type Common = { anchor: string; tone: "default" | "surface" | "accent" };

export function Txt({
  edit,
  path,
  value,
  as: Tag = "span",
  className,
  multiline,
  placeholder,
}: {
  edit?: EditApi;
  path: Path;
  value: string | undefined;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
  placeholder?: string;
}) {
  if (edit) return <>{edit.text({ path, value: value ?? "", as: Tag, className, multiline, placeholder })}</>;
  if (!value) return null;
  return <Tag className={className}>{value}</Tag>;
}

/** True when the published page should render the element at all. */
export const has = (edit: EditApi | undefined, ...values: (string | undefined)[]) =>
  Boolean(edit) || values.some((v) => Boolean(v && v.trim()));

export function Section({
  common,
  type,
  variant,
  children,
  className = "",
  style,
}: {
  common: Partial<Common>;
  type: string;
  variant: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section
      id={common.anchor || undefined}
      className={`pc-sec pc-${type} pc-${type}--${variant} ${className}`}
      data-tone={common.tone && common.tone !== "default" ? common.tone : undefined}
      style={style}
    >
      {children}
    </section>
  );
}

export function Btn({
  link,
  edit,
  path,
  variant = "solid",
  className = "",
}: {
  link: Link | undefined;
  edit?: EditApi;
  path: Path;
  variant?: "solid" | "line";
  className?: string;
}) {
  if (!link || (!edit && !link.label.trim())) return null;
  const external = /^https?:\/\//.test(link.href);
  return (
    <a
      className={`pc-btn pc-btn--${variant} ${className}`}
      href={link.href || "#"}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      <Txt edit={edit} path={[...path, "label"]} value={link.label} placeholder="Button label" />
    </a>
  );
}

export function Img({
  image,
  className = "",
  sizes,
  priority,
  edit,
  ratio,
}: {
  image: ImageValue | undefined;
  className?: string;
  sizes: string;
  priority?: boolean;
  edit?: EditApi;
  ratio?: string;
}) {
  if (!image?.url) {
    if (!edit) return null;
    return (
      <div className={`pc-img pc-img--empty ${className}`} style={ratio ? { aspectRatio: ratio } : undefined}>
        <span>Add an image in the inspector</span>
      </div>
    );
  }
  // A plain <img> with explicit loading/decoding hints: images are pre-sized at upload (≤ 2000 px)
  // and template photos are 1000–1600 px JPEGs, so no optimizer transformations are spent.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`pc-img ${className}`}
      src={image.url}
      alt={image.alt}
      sizes={sizes}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      decoding={priority ? "sync" : "async"}
      style={ratio ? { aspectRatio: ratio } : undefined}
    />
  );
}

export function Head({
  edit,
  kicker,
  heading,
  intro,
  center,
}: {
  edit?: EditApi;
  kicker?: string;
  heading?: string;
  intro?: string;
  center?: boolean;
}) {
  if (!has(edit, kicker, heading, intro)) return null;
  return (
    <header className={`pc-head ${center ? "pc-head--center" : ""}`}>
      <Txt edit={edit} path={["kicker"]} value={kicker} as="p" className="pc-kicker" placeholder="Kicker" />
      <Txt edit={edit} path={["heading"]} value={heading} as="h2" className="pc-h2" placeholder="Heading" />
      {intro !== undefined && (
        <Txt edit={edit} path={["intro"]} value={intro} as="p" className="pc-intro" multiline placeholder="Intro" />
      )}
    </header>
  );
}

export { Icon };
