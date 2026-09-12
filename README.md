# Pagecraft

**Build it together.** A landing-page builder two people can edit at the same time, then publish to their own subdomain.

> Status: in progress — planning and design stage. One of six portfolio projects by [Viraj Domadia](https://virajdomadia.vercel.app). Will go live at `pagecraft.virajdomadia.com`.

## What it proves
CRDT co-editing (Yjs) · live cursors · multi-tenant publishing · ISR

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) + Drizzle · Better Auth · Razorpay · Vitest + Playwright · Sentry · Vercel

## In this repo
- [`PRD.md`](PRD.md) — product requirements (v0, being refined)
- [`mockups/landing.html`](mockups/landing.html) — landing-page design mockup (open in a browser)
- [`brand/`](brand/) — logo, mark and favicon

## Roadmap
1. Finalise the PRD
2. Scaffold the Next.js app
3. Build the thin vertical slice described in the PRD
4. Tests, CI, Lighthouse, deploy
5. Case study on the portfolio
