import type { CSSProperties, ReactNode } from "react";
import type { SectionJson, SiteContent } from "@/lib/doc/model";
import { fontVars, siteFontVariables } from "@/lib/site-fonts";
import { normaliseTheme, themeVars } from "@/lib/themes";
import { isSectionType, REGISTRY } from "@/sections/registry";
import type { EditApi } from "@/sections/ui";
import "@/sections/site.css";

/** The theme root: CSS variables + font classes. Shared by the canvas and the published page. */
export function ThemeRoot({
  theme,
  children,
  className = "",
  as: Tag = "div",
  style,
}: {
  theme: Record<string, unknown> | undefined;
  children: ReactNode;
  className?: string;
  as?: "div" | "main";
  style?: CSSProperties;
}) {
  const t = normaliseTheme(theme);
  return (
    <Tag
      className={`pc-site ${siteFontVariables} ${className}`}
      style={{ ...themeVars(t), ...fontVars(t.fonts), ...style } as CSSProperties}
    >
      {children}
    </Tag>
  );
}

export function SectionView({
  section,
  edit,
  priority,
}: {
  section: SectionJson;
  edit?: EditApi;
  priority?: boolean;
}) {
  if (!isSectionType(section.type)) return null;
  const { Component } = REGISTRY[section.type];
  return <Component id={section.id} variant={section.variant} props={section.props} edit={edit} priority={priority} />;
}

/** A whole site, plain (published pages, previews, dashboard cards). */
export function SiteRenderer({
  content,
  as = "main",
  className,
  children,
}: {
  content: Pick<SiteContent, "site" | "sections">;
  as?: "div" | "main";
  className?: string;
  children?: ReactNode;
}) {
  const firstVisual = content.sections.findIndex((s) => s.type === "hero");
  return (
    <ThemeRoot theme={content.site?.theme} as={as} className={className}>
      {content.sections.map((s, i) => (
        <SectionView key={s.id} section={s} priority={i === firstVisual} />
      ))}
      {children}
    </ThemeRoot>
  );
}
