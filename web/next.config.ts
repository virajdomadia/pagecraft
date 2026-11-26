import type { NextConfig } from "next";

// Trailing slash stripped: `${API_URL}/:path*` would otherwise proxy to `//health`.
const API_URL = (process.env.API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const isDev = process.env.NODE_ENV === "development";

/*
 * One policy for the whole origin: landing, studio and published sites. No third-party scripts,
 * styles, fonts (next/font self-hosts every pair) or frames. 'unsafe-inline' for scripts covers
 * Next's inline hydration payload and the JSON-LD block; no remote script origin is allowed, so
 * an injected <script src> loads nothing. Images: this origin (template photos, /api/media
 * uploads) and the Vercel Blob store once F3's token is set.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.public.blob.vercel-storage.com",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws:" : ""}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Images are pre-sized: template photos are 1000–1600 px JPEGs and uploads are resized to
  // ≤ 2000 px by the API. Off, so no request can spend Vercel Hobby's monthly transformations.
  images: { unoptimized: true },
  async headers() {
    // Not `/api/*`: the rewrite hands those to the API, which sets its own headers.
    return [{ source: "/((?!api/).*)", headers: securityHeaders }];
  },
  async redirects() {
    // Swagger UI through the rewrite would fetch /openapi.json from this origin and 404.
    return [{ source: "/api/docs", destination: `${API_URL}/docs`, permanent: false }];
  },
  async rewrites() {
    // afterFiles (the default): app/api/revalidate is a real route here and wins over the rewrite.
    return [{ source: "/api/:path*", destination: `${API_URL}/:path*` }];
  },
};

export default nextConfig;
