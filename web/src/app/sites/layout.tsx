import type { Metadata } from "next";

export const metadata: Metadata = { title: "Your sites — Pagecraft", robots: { index: false } };

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  return <div className="studio min-h-dvh bg-desk text-ink">{children}</div>;
}
