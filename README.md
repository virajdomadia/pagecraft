# Pagecraft

**Build it together.** A landing-page builder two people can edit at the same time, then publish to their own subdomain.

> Status: **lifecycle steps 1–7 complete (2026-09-17)** — PRD v1, docs 03–07, direction C · Blueprint and all v1 screens; build starts at milestone 1.0 after Tripsmith v3 (build order 1 → 2 → 4 → 5 → 3 → 6). [Tracker](https://claude.ai/artifact/AxW5iwEzxWmtSdLdfnjQfB) · [Screens](https://claude.ai/artifact/UKnMgDx9dvkEmFUrxWSLjS). One of six portfolio projects by [Viraj Domadia](https://virajdomadia.vercel.app). **Live (landing page):** https://pagecraft-viraj.vercel.app — will move to `pagecraft.virajdomadia.com` later.

## What it proves
CRDT co-editing (Yjs in the browser, **pycrdt** sync server in Python) · live cursors over SSE · a section-based editor that emits Lighthouse-100 sites · multi-tenant subdomain publishing with ISR

Three versions: **v1 Solo studio** (single-user builder + publish, ≈ 18 h) → **v2 Studio session** (live co-editing, invites, history, ≈ 14 h) → **v3 Pro** (Razorpay plan, forms inbox, AI copy, analytics, comments, ≈ 13 h). See [PRD.md](PRD.md) and [docs/](docs/).

## Stack
`web/` Next.js 15 (App Router) · TypeScript · Tailwind 4 · Yjs · `api/` FastAPI (Python 3.12) + pycrdt · SQLAlchemy + Alembic on Neon Postgres · Upstash Redis (v2) · Vercel Blob · Resend (v2) · Razorpay (v3) · pytest + Playwright · Vercel

## In this repo
```
web/        Next.js 15 (App Router, TypeScript, Tailwind 4) — the landing page lives here
  src/app/            layout.tsx, page.tsx, globals.css
  src/components/     landing/ (one component per section), ui/
  src/lib/
api/        FastAPI backend — folder structure only until the build starts
  app/core · routers · models · schemas · services
  tests/
PRD.md      product requirements (v1, locked decisions + versions table)
docs/       03-requirements · 03-user-flows · 04-technical-design · 04-ui-mockups · 05-architecture · 06-data-and-api · 07-plan
mockups/    landing.html (ported to web/) · direction-variants.html · screens.html · tracker.html (+ tracker-build.py) · img/ (CC photos, CREDITS.md)
brand/      logo, mark and favicon
```

### Run the landing page
```
cd web
pnpm install
pnpm dev
```

## Roadmap
The 17-step lifecycle in [`../PROCESS.md`](../PROCESS.md). Steps 1–7 done (2026-09-17); next is [docs/07-plan.md](docs/07-plan.md) milestone 1.0 onward.
