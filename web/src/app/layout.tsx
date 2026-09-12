import type { Metadata } from "next";
import { Manrope } from "next/font/google";
const sans = Manrope({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
import "./globals.css";

export const metadata: Metadata = {
  title: "Pagecraft \u2014 build it together",
  description: "A landing-page editor two people can use at the same time, published to its own address in one click.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
