import {
  Cormorant_Garamond,
  DM_Sans,
  DM_Serif_Display,
  Fraunces,
  Inter,
  Karla,
  Manrope,
  Oswald,
  Playfair_Display,
  Space_Grotesk,
} from "next/font/google";
import type { FontPairKey } from "@/lib/themes";

/*
 * The six font pairs a site can use (R3), self-hosted by next/font — no request to Google from a
 * published page. `preload: false`: a page uses one pair, and preloading all ten families would
 * cost every visitor the other nine. `display: swap` keeps text visible while a face loads.
 */
const fraunces = Fraunces({ subsets: ["latin"], display: "swap", preload: false, weight: ["600", "700"], variable: "--pcf-fraunces" });
const inter = Inter({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pcf-inter" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap", preload: false, weight: ["600", "700"], variable: "--pcf-playfair" });
const karla = Karla({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pcf-karla" });
const dmSerif = DM_Serif_Display({ subsets: ["latin"], display: "swap", preload: false, weight: ["400"], variable: "--pcf-dmserif" });
const dmSans = DM_Sans({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pcf-dmsans" });
const oswald = Oswald({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600"], variable: "--pcf-oswald" });
const grotesk = Space_Grotesk({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600", "700"], variable: "--pcf-grotesk" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], display: "swap", preload: false, weight: ["500", "600"], variable: "--pcf-cormorant" });
const manrope = Manrope({ subsets: ["latin"], display: "swap", preload: false, weight: ["400", "500", "600"], variable: "--pcf-manrope" });

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
