import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { site } from "@/lib/site";
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
import "./globals.css";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
