# PRD — Pagecraft: Website builder with live co-editing

**Status:** v1 · lifecycle steps 1–7 complete (2026-09-17) — see [docs/](docs/) · next: step 8 Project Setup (= milestone 1.0), **after Tripsmith v3 and the projects ahead of it in build order**
**Name:** Pagecraft · *build it together*
**URL:** https://pagecraft.virajdomadia.com (landing live at https://pagecraft-viraj.vercel.app until DNS) · published sites at `{slug}.pagecraft.virajdomadia.com` (and `/s/{slug}` until the wildcard DNS exists)
**Slot:** #3 · Budget ~45 h (v1 18 · v2 14 · v3 13) · Build fifth
**Live artifacts:** [Tracker](https://claude.ai/artifact/AxW5iwEzxWmtSdLdfnjQfB) (plan rows with status, all docs, mockups, project facts) · [Screens](https://claude.ai/artifact/UKnMgDx9dvkEmFUrxWSLjS) (all 11 v1 screens, direction C) · [Direction variants](https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo) (A–D, C chosen) · Landing: https://pagecraft-viraj.vercel.app

## One-liner
A Framer-lite for one-page websites: pick a template, edit sections inline with a teammate in the same page at the same time (live cursors, nothing ever lost), hit Publish and the site is live on its own subdomain — fast, SEO-clean, Lighthouse 100s.

## Who it's for
- **Creator:** a small business or freelancer who needs a one-page site tonight — a café, a salon, a designer, a gym.
- **Collaborator:** the friend, partner or client editing the same page at the same time (v2).
- **Platform (Pagecraft):** owns templates, plan limits and the publishing pipeline.

## Why this project
- It is the "Figma-type realtime" slot: a CRDT document, a selection model, presence, undo/redo, and a publishing pipeline that emits real websites — the editor-engineering story Next.js employers recognise at once.
- The two-tab demo (two cursors, one headline, both people typing) needs no explanation, and the output is a website anyone can open on their phone.

## Locked decisions (2026-09-16) — follow these until the project ends

### 1. Identity: a one-page builder, sections not canvas
Pagecraft builds **one-page sites from sections** (nav, hero, features, gallery, testimonials, pricing, FAQ, contact, CTA, footer — ~10 types, 2–3 layout variants each). No free-form canvas: sections are what people actually finish, and they keep published pages fast and responsive by construction. Three sides — creator, collaborator (v2), platform. Audience voice: Indian small businesses; prices in ₹; the demo is set in Bengaluru.

### 2. Seed content: six templates, one demo site, two demo logins
Templates are **fictional but plausible Bengaluru businesses** with CC photos from Wikimedia Commons (credits kept):

| Template | Business | Sections it ships with |
|---|---|---|
| Café | *Kaapi Corner*, Indiranagar | nav · hero · features (menu highlights) · gallery · testimonials · contact · footer |
| Salon | *Loop Studio*, Koramangala | nav · hero · features (services) · pricing · gallery · CTA · footer |
| Freelancer portfolio | *Meera Rao — brand designer* | nav · hero · gallery (work) · testimonials · CTA · footer |
| Gym | *Ironline*, HSR | nav · hero · features · pricing · FAQ · CTA · footer |
| Product launch | *Nimbus — a pour-over kettle* | nav · hero · features · gallery · pricing · FAQ · footer |
| Restaurant | *Bistro Nine*, Jayanagar | nav · hero · gallery · features (menu) · testimonials · contact · footer |

The demo site is *Kaapi Corner*, already published. Landing page has two demo logins — **creator** (owner of the demo site) and **collaborator** (editor on it) — and, from v2, an "Open as your teammate" button that opens a second tab signed in as the collaborator. v3 adds three premium templates (photographer, boutique, clinic). No wedding or event template (Zapigo overlap).

### 3. Versions — base → mid → advanced
Every project is cut base → mid → advanced (rule set 2026-09-15). v1 alone is a complete, sellable page builder.

| Version | Ships | Proves | ~Hours |
|---|---|---|---|
| **v1 Solo studio** (base) | Auth · sites dashboard · new site from one of 6 templates · section editor: add / reorder / delete from a section library, inline text editing, image upload (Vercel Blob), theme = colour palette + font pair · undo/redo · autosave · desktop / tablet / phone preview · publish to `/s/{slug}` **and** `{slug}.pagecraft.virajdomadia.com` (middleware; wildcard DNS flipped when the domain moves) · unpublish, custom slug, SEO title / description / OG image · "Made with Pagecraft" badge | A real builder that emits fast, SEO-clean sites (Lighthouse 100s on published pages). The document is a Yjs `Y.Doc` from day one, so v2 adds sync, not a rewrite | 18 |
| **v2 Studio session** (mid) | Live co-editing: Yjs + pycrdt sync server over SSE, live cursors, selection highlights, presence avatars · invite a collaborator by email (Resend) · version history (last 10 snapshots, restore) · publish diff ("3 sections changed since last publish") · "Try it live" on the landing | CRDT sync on serverless — the two-tab wow | 14 |
| **v3 Pro** (advanced) | Pro plan via Razorpay subscription (removes the badge, unlocks 3 premium templates) · contact-form backend with a submissions inbox + email notification · AI section copy (pydantic-ai: "rewrite this hero for a bakery in Indiranagar") · per-site page-view analytics · section-level comments for collaborators · duplicate site | Features that make it a product, not a demo | 13 |

### 4. The engine: Yjs document, Python CRDT sync, SSE fan-out, server-side publish
- **Document:** one `Y.Doc` per site — a `site` map (theme, SEO meta) and a `sections` `Y.Array` of `Y.Map`s (`type`, `variant`, `props`), every text field a `Y.Text` (character-level merge), images as URLs (Blob for uploads; template photos are static files in `web/`). The section catalog lives in `web/src/sections/` as one registry (React component + zod schema + defaults + thumbnail); **the editor canvas and the published page render the same components.** Undo/redo = Yjs `UndoManager`.
- **Persist (v1):** the client batches updates (300 ms) → `POST /sites/{id}/updates`; the API appends them to `site_updates(site_id, seq, update bytea)`. `GET /sites/{id}/doc` returns the last snapshot + tail. Every 50 updates (and on publish) the API **compacts with pycrdt** (Python bindings to Yrs) into `sites.snapshot`. Serverless-safe: no in-memory document anywhere.
- **Fan-out (v2):** after persisting, the API `XADD`s the update to a capped Upstash Redis stream `site:{id}`; `GET /sites/{id}/stream` (SSE, `maxDuration` 300) loops `XREAD BLOCK 1000` — it wakes on arrival, so update latency ≈ one round trip, no polling interval. Cursors and selection (Yjs awareness) travel through the same stream as ephemeral entries (throttled to 10/s per client) and are never written to Postgres. Reconnect with `Last-Event-ID` = last stream id. Budget ≈ 1 Redis command/s per idle tab.
- **Publish:** the API loads the CRDT with pycrdt and **exports the JSON server-side** into `publications(site_id, version, content jsonb)` — the published page is computed from the CRDT, never trusted from the client — then calls web's revalidate hook.
- **Serve:** `web/app/s/[slug]` renders `publications.content` with ISR + tag revalidation; `middleware.ts` rewrites `Host: {slug}.pagecraft.virajdomadia.com` → `/s/{slug}`. `next/image` on Blob URLs, no client JS beyond a tiny interaction script → Lighthouse 100s. Free plan renders a "Made with Pagecraft" badge; Pro (v3) removes it.
- **Why not WebSockets / a hosted realtime service:** Vercel functions can't hold WebSockets, a free always-on host cold-starts in the middle of the demo, and Liveblocks would hide the part this project is meant to prove. Same reasoning as Frontrow; same SSE-on-Vercel envelope.

### 5. Stack and setup — lean
Shared stack from [`projects/README.md`](../README.md): `web/` Next.js App Router + Tailwind 4, `api/` FastAPI on Vercel (FastAPI preset), Neon Postgres, Upstash Redis (v2), Vercel Blob, own cookie-session auth (`pc_session`), Resend (v2), Razorpay subscriptions (v3), pydantic-ai (v3). New deps: `yjs` + `y-protocols` (awareness) + `@dnd-kit` in web; `pycrdt` + `redis-py` asyncio in api. Setup is the minimum to deploy both apps with plain CI (web typecheck + build, api ruff + pytest). OpenAPI → TS types generated by a script and committed; no CI freshness gate, no Sentry, no uptime monitor. Accounts and keys are created just-in-time in the plan row that first needs them.

Tests only where a demo bug would embarrass: two `Y.Text` edits at the same offset converge (pycrdt, two docs); published JSON equals the CRDT export; slug uniqueness; site membership 403; v2 Playwright two-page edit test; v3 subscription webhook replay.

## The wow moment (v2)
Open the demo site in two tabs — one as the creator, one as the teammate. Type into the headline in one; the letters appear in the other with a coloured cursor next to them. Both of you edit the same sentence at once and nobody's words vanish. Hit **Publish** and open `kaapi-corner.pagecraft.virajdomadia.com` on your phone.

## Out of scope (all versions)
Free-form canvas positioning · custom domains (subdomains only) · multi-page sites · code export · rich-text formatting inside text fields (plain text + line breaks only) · custom CSS · e-commerce sections · real-money billing · mobile editing (phone = preview only, "edit on desktop").

## Success criteria
- Two clients editing the same `Y.Text` concurrently always converge to the same document with neither edit lost — covered by a test in CI, and (v2) by a two-page Playwright test.
- The published page is a pure function of the CRDT: `publications.content` equals pycrdt's export of the site document at publish time (tested).
- Published sites score Lighthouse mobile 100 perf / 100 a11y / 100 SEO on every seeded template; the editor's own pages stay ≥ 90 perf.
- v2: a text edit or cursor move is visible in the other tab within ~250 ms.
- A visible frontend signature: the Blueprint draw-in (every new section traces itself as a wireframe before it fills — chosen in step 4), themed browser surfaces, reduced-motion fallbacks.

## Resolved questions
- *Self-hosted y-websocket vs Liveblocks?* Neither — own Python sync (pycrdt) over SSE on Vercel; see decision 4 (Viraj, 2026-09-16).
- *Subdomains vs path?* Both from v1: middleware handles the subdomain, `/s/{slug}` works until the wildcard DNS exists on `virajdomadia.com`.
- *Co-editing in v1?* No — v1 is the complete single-user builder (base of the niche); co-editing is the v2 distinguishing feature, but v1 is built on `Y.Doc` so v2 is additive.
- *Images?* Vercel Blob (as Tripsmith), not Cloudinary — one less account.
- *Who is the admin?* There is no admin console; the platform side is templates + plan limits in code and seed. Creators own sites; collaborators are `site_members`.
