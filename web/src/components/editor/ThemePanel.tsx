"use client";

import { flushSync } from "react-dom";
import type { CSSProperties } from "react";
import { fontVars, siteFontVariables } from "@/lib/site-fonts";
import { FONT_PAIR_KEYS, FONT_PAIRS, normaliseTheme, PALETTE_KEYS, PALETTES, RADII } from "@/lib/themes";

const lbl = "font-mono text-xs font-medium uppercase tracking-[0.08em] text-muted";

/**
 * The theme panel (S7, nothing selected): 8 palettes, 6 font pairs, radius. A palette change runs
 * the theme ripple — a View Transition whose new canvas grows as a circle from the swatch
 * (04-ui-mockups, D · Theme ripple); instant where unsupported or with reduced motion.
 */
export function ThemePanel({
  theme: raw,
  onChange,
}: {
  theme: Record<string, unknown> | undefined;
  onChange: (key: "palette" | "fonts" | "radius", value: string) => void;
}) {
  const theme = normaliseTheme(raw);

  function ripple(e: React.MouseEvent, key: "palette" | "fonts" | "radius", value: string) {
    const canvas = document.querySelector<HTMLElement>("[data-pc-sheet]");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition;
    if (!start || reduce || !canvas || key !== "palette") {
      onChange(key, value);
      return;
    }
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 100;
    document.documentElement.style.setProperty("--pc-rx", `${Math.max(0, Math.min(100, x)).toFixed(1)}%`);
    document.documentElement.style.setProperty("--pc-ry", `${Math.max(0, y).toFixed(1)}%`);
    start.call(document, () => flushSync(() => onChange(key, value)));
  }

  return (
    <div className="grid gap-6 p-4">
      <header>
        <p className={lbl}>Theme</p>
        <h2 className="text-[17px] font-extrabold tracking-tight">The whole site</h2>
        <p className="mt-1 text-xs text-ink-2">Every section follows. Select a section on the canvas to edit it.</p>
      </header>

      <fieldset className="min-w-0">
        <legend className={lbl}>Palette</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {PALETTE_KEYS.map((k) => {
            const p = PALETTES[k];
            const on = theme.palette === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={(e) => ripple(e, "palette", k)}
                className={`rounded-[3px] border p-1.5 text-left transition ${on ? "border-guide ring-2 ring-guide-soft" : "border-line hover:border-guide/60"}`}
              >
                <span className="flex h-9 overflow-hidden rounded-[2px]" style={{ background: p.bg }} aria-hidden="true">
                  <span className="flex-1" />
                  <span className="w-5" style={{ background: p.surface }} />
                  <span className="w-5" style={{ background: p.accent }} />
                  <span className="w-5" style={{ background: p.ink }} />
                </span>
                <span className="mt-1 block text-xs font-semibold">{p.name}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={lbl}>Font pair</legend>
        <div className={`mt-2 grid gap-1.5 ${siteFontVariables}`}>
          {FONT_PAIR_KEYS.map((k) => {
            const pair = FONT_PAIRS[k];
            const on = theme.fonts === k;
            const vars = fontVars(k) as CSSProperties;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                onClick={(e) => ripple(e, "fonts", k)}
                style={vars}
                className={`flex items-center gap-3 rounded-[3px] border px-2.5 py-2 text-left transition ${on ? "border-guide bg-guide-soft" : "border-line bg-paper hover:border-guide/60"}`}
              >
                <span className="w-9 text-[22px] leading-none" style={{ fontFamily: "var(--pc-font-head)", textTransform: pair.uppercase ? "uppercase" : "none" }} aria-hidden="true">
                  Aa
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] font-semibold" style={{ fontFamily: "var(--pc-font-head)" }}>
                    {pair.heading}
                  </span>
                  <span className="block truncate text-xs text-ink-2" style={{ fontFamily: "var(--pc-font-body)" }}>
                    with {pair.body}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <legend className={lbl}>Corners</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {RADII.map((r) => {
            const on = theme.radius === r;
            const px = r === "sharp" ? 0 : r === "soft" ? 6 : 12;
            return (
              <button
                key={r}
                type="button"
                aria-pressed={on}
                onClick={(e) => ripple(e, "radius", r)}
                className={`grid justify-items-center gap-1 rounded-[3px] border p-2 text-xs font-semibold capitalize ${on ? "border-guide bg-guide-soft" : "border-line bg-paper hover:border-guide/60"}`}
              >
                <span className="h-6 w-10 border-2 border-ink" style={{ borderRadius: px }} aria-hidden="true" />
                {r}
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
