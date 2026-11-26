import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { site } from "@/lib/site";
import "./globals.css";

// Product chrome type (Blueprint): Manrope for everything, JetBrains Mono for ids, slugs, labels.
// Self-hosted from src/assets/fonts (OFL), so builds never fetch from Google. Not preloaded:
// published sites share this root layout and use their own pair (lib/site-fonts.ts).
const sans = localFont({ src: "../assets/fonts/manrope-400-800.woff2", weight: "400 800", variable: "--font-manrope", display: "swap", preload: false });
const mono = localFont({ src: "../assets/fonts/jetbrains-400-500.woff2", weight: "400 500", variable: "--font-jetbrains", display: "swap", preload: false });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  openGraph: {
    title: site.title,
    description: site.description,
    url: "/",
    siteName: site.name,
    type: "website",
    locale: "en_IN",
  },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
