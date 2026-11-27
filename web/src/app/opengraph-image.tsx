import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const alt = "Pagecraft: pick a template, publish it in one click";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const dir = join(process.cwd(), "src/assets");
  const [bold, semi] = await Promise.all([
    readFile(join(dir, "Manrope-ExtraBold.ttf")),
    readFile(join(dir, "Manrope-SemiBold.ttf")),
  ]);
  const grid = "#E7E5F0";
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between",
          padding: "64px 72px", background: "#FFFFFF", color: "#1B1B2F", fontFamily: "Manrope",
          backgroundImage: `linear-gradient(${grid} 1px, transparent 1px), linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 40, fontWeight: 800, letterSpacing: "-0.03em" }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#4338CA" />
            <path d="M18 14 h20 l8 8 v28 h-28 z" fill="#FFFFFF" />
            <path d="M38 14 v8 h8" fill="#C7D2FE" />
            <path d="M30 30 l14 6 l-6 2 l-2 6 z" fill="#FF6B6B" stroke="#4338CA" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          Pagecraft
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 84, fontWeight: 800, letterSpacing: "-0.035em", lineHeight: 1.04, maxWidth: 940 }}>
            Pick a template. Publish it in one click.
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#4A4A66", marginTop: 24, maxWidth: 900 }}>
            A landing-page editor two people can use at the same time.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 24, fontWeight: 600 }}>
          <div style={{ display: "flex", background: "#4338CA", color: "#FFFFFF", padding: "10px 18px", borderRadius: 10 }}>
            pagecraft.virajdomadia.com
          </div>
          <div style={{ display: "flex", border: "1.5px solid #FF6B6B", color: "#1B1B2F", padding: "9px 16px", borderRadius: 10 }}>
            In development
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Manrope", data: bold, weight: 800, style: "normal" },
        { name: "Manrope", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
