/**
 * Site themes (R3): 8 palettes × 6 font pairs × 3 radii. A theme is applied as CSS variables on
 * the site root, so a palette change re-renders every section with no per-section work. Every
 * palette is checked for ≥ 4.5:1 on each text/background pairing the sections use
 * (themes.test.ts) — published sites aim for Lighthouse a11y 100.
 *
 * Keys are mirrored in api/app/sections.py (PALETTES, FONT_PAIRS, RADII).
 */

export type Palette = {
  key: PaletteKey;
  name: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentInk: string;
  line: string;
};

export const PALETTE_KEYS = [
  "espresso",
  "blush",
  "paper",
  "iron",
  "graphite",
  "bistro",
  "sage",
  "midnight",
] as const;
export type PaletteKey = (typeof PALETTE_KEYS)[number];

export const PALETTES: Record<PaletteKey, Palette> = {
  espresso: { key: "espresso", name: "Espresso", bg: "#F7F1E8", surface: "#EFE5D6", ink: "#2B1B12", muted: "#6B5548", accent: "#2F5D45", accentInk: "#F7F1E8", line: "#E1D3BF" },
  blush: { key: "blush", name: "Blush", bg: "#FBF5F3", surface: "#F3E6E1", ink: "#2A1D22", muted: "#6E5560", accent: "#9C3D54", accentInk: "#FFFFFF", line: "#EAD6D0" },
  paper: { key: "paper", name: "Paper", bg: "#FFFFFF", surface: "#F3F2EE", ink: "#161616", muted: "#585858", accent: "#C2410C", accentInk: "#FFFFFF", line: "#E4E2DC" },
  iron: { key: "iron", name: "Iron", bg: "#0F1115", surface: "#1A1D24", ink: "#F2F3F5", muted: "#A3A8B4", accent: "#D4FF3A", accentInk: "#0F1115", line: "#2A2E38" },
  graphite: { key: "graphite", name: "Graphite", bg: "#F5F6F8", surface: "#FFFFFF", ink: "#111318", muted: "#555B66", accent: "#2346F5", accentInk: "#FFFFFF", line: "#E1E4EA" },
  bistro: { key: "bistro", name: "Bistro", bg: "#FFF9F0", surface: "#F6EBDA", ink: "#2A1510", muted: "#6D4C41", accent: "#8E2C1D", accentInk: "#FFF9F0", line: "#ECDCC4" },
  sage: { key: "sage", name: "Sage", bg: "#F3F6F1", surface: "#E6EDE2", ink: "#1E2A22", muted: "#4F6156", accent: "#3F6B52", accentInk: "#FFFFFF", line: "#D3DECF" },
  midnight: { key: "midnight", name: "Midnight", bg: "#0E1330", surface: "#161C40", ink: "#EEF0FF", muted: "#A9B0D6", accent: "#FFB547", accentInk: "#0E1330", line: "#262E5C" },
};

export const FONT_PAIR_KEYS = [
  "fraunces-inter",
  "playfair-karla",
  "dmserif-dmsans",
  "oswald-inter",
  "spacegrotesk-inter",
  "cormorant-manrope",
] as const;
export type FontPairKey = (typeof FONT_PAIR_KEYS)[number];

/** Display names; the font objects themselves live in lib/site-fonts.ts (next/font). */
export const FONT_PAIRS: Record<FontPairKey, { heading: string; body: string; uppercase?: boolean }> = {
  "fraunces-inter": { heading: "Fraunces", body: "Inter" },
  "playfair-karla": { heading: "Playfair Display", body: "Karla" },
  "dmserif-dmsans": { heading: "DM Serif Display", body: "DM Sans" },
  "oswald-inter": { heading: "Oswald", body: "Inter", uppercase: true },
  "spacegrotesk-inter": { heading: "Space Grotesk", body: "Inter" },
  "cormorant-manrope": { heading: "Cormorant Garamond", body: "Manrope" },
};

export const RADII = ["sharp", "soft", "round"] as const;
export type Radius = (typeof RADII)[number];
export const RADIUS_PX: Record<Radius, { box: string; button: string }> = {
  sharp: { box: "0px", button: "0px" },
  soft: { box: "12px", button: "10px" },
  round: { box: "22px", button: "999px" },
};

export type Theme = { palette: PaletteKey; fonts: FontPairKey; radius: Radius };

export const DEFAULT_THEME: Theme = { palette: "graphite", fonts: "spacegrotesk-inter", radius: "soft" };

export function normaliseTheme(theme: Partial<Record<keyof Theme, unknown>> | undefined): Theme {
  const palette = PALETTE_KEYS.includes(theme?.palette as PaletteKey)
    ? (theme!.palette as PaletteKey)
    : DEFAULT_THEME.palette;
  const fonts = FONT_PAIR_KEYS.includes(theme?.fonts as FontPairKey)
    ? (theme!.fonts as FontPairKey)
    : DEFAULT_THEME.fonts;
  const radius = RADII.includes(theme?.radius as Radius) ? (theme!.radius as Radius) : DEFAULT_THEME.radius;
  return { palette, fonts, radius };
}

/** The CSS variables a site root carries. Font families come from lib/site-fonts.ts. */
export function themeVars(theme: Theme): Record<string, string> {
  const p = PALETTES[theme.palette];
  const r = RADIUS_PX[theme.radius];
  return {
    "--pc-bg": p.bg,
    "--pc-surface": p.surface,
    "--pc-ink": p.ink,
    "--pc-muted": p.muted,
    "--pc-accent": p.accent,
    "--pc-accent-ink": p.accentInk,
    "--pc-line": p.line,
    "--pc-radius": r.box,
    "--pc-btn-radius": r.button,
    "--pc-head-transform": FONT_PAIRS[theme.fonts].uppercase ? "uppercase" : "none",
  };
}

// --- contrast (WCAG 2.x) ------------------------------------------------------------------------

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
