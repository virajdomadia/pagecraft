import localFont from "next/font/local";
import type { FontPairKey } from "@/lib/themes";

/*
 * The six font pairs a site can use (R3), self-hosted from src/assets/fonts (Latin woff2, OFL —
 * committed so a build never depends on fetching Google Fonts). `preload: false`: a page uses
 * one pair, and preloading all ten families would cost every visitor the other nine.
 * `display: swap` keeps text visible while a face loads. Weight ranges are variable fonts.
 */
const fraunces = localFont({ src: "../assets/fonts/fraunces-600-700.woff2", weight: "600 700", display: "swap", preload: false, variable: "--pcf-fraunces" });
const inter = localFont({ src: "../assets/fonts/inter-400-600.woff2", weight: "400 600", display: "swap", preload: false, variable: "--pcf-inter" });
const playfair = localFont({ src: "../assets/fonts/playfair-600-700.woff2", weight: "600 700", display: "swap", preload: false, variable: "--pcf-playfair" });
const karla = localFont({ src: "../assets/fonts/karla-400-600.woff2", weight: "400 600", display: "swap", preload: false, variable: "--pcf-karla" });
const dmSerif = localFont({ src: "../assets/fonts/dmserif-400.woff2", weight: "400", display: "swap", preload: false, variable: "--pcf-dmserif" });
const dmSans = localFont({ src: "../assets/fonts/dmsans-400-600.woff2", weight: "400 600", display: "swap", preload: false, variable: "--pcf-dmsans" });
const oswald = localFont({ src: "../assets/fonts/oswald-500-600.woff2", weight: "500 600", display: "swap", preload: false, variable: "--pcf-oswald" });
const grotesk = localFont({ src: "../assets/fonts/grotesk-500-700.woff2", weight: "500 700", display: "swap", preload: false, variable: "--pcf-grotesk" });
const cormorant = localFont({ src: "../assets/fonts/cormorant-500-600.woff2", weight: "500 600", display: "swap", preload: false, variable: "--pcf-cormorant" });
const manrope = localFont({ src: "../assets/fonts/manrope-400-800.woff2", weight: "400 800", display: "swap", preload: false, variable: "--pcf-manrope" });

/** Class names that define every pair's CSS variables (put on the site root). */
export const siteFontVariables = [
  fraunces,
  inter,
  playfair,
  karla,
  dmSerif,
  dmSans,
  oswald,
  grotesk,
  cormorant,
  manrope,
]
  .map((f) => f.variable)
  .join(" ");

const PAIR_VARS: Record<FontPairKey, { head: string; body: string }> = {
  "fraunces-inter": { head: "--pcf-fraunces", body: "--pcf-inter" },
  "playfair-karla": { head: "--pcf-playfair", body: "--pcf-karla" },
  "dmserif-dmsans": { head: "--pcf-dmserif", body: "--pcf-dmsans" },
  "oswald-inter": { head: "--pcf-oswald", body: "--pcf-inter" },
  "spacegrotesk-inter": { head: "--pcf-grotesk", body: "--pcf-inter" },
  "cormorant-manrope": { head: "--pcf-cormorant", body: "--pcf-manrope" },
};

export function fontVars(pair: FontPairKey): Record<string, string> {
  const v = PAIR_VARS[pair];
  return {
    "--pc-font-head": `var(${v.head}), Georgia, serif`,
    "--pc-font-body": `var(${v.body}), system-ui, sans-serif`,
  };
}
