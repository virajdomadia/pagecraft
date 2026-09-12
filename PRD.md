# PRD — Pagecraft: Website builder with live co-editing

**Status:** draft v0 (basic) · to be detailed together
**Name:** Pagecraft · *build it together*
**URL:** https://pagecraft.virajdomadia.com
**Slot:** #3 · Budget ~45 h · Build fifth

## One-liner
A Framer-lite: build a landing page from sections, edit text/images/colours together with a teammate in real time (live cursors), and publish it to `name.pagecraft.virajdomadia.com`.

## Who it's for
- **Creator:** small business / freelancer who needs a one-page site fast.
- **Collaborator:** a second person editing the same site at the same time.
- **Admin (you):** plan limits, published sites.

## Why this project
- Figma-style engineering (editor, selection, layers, presence, CRDT) with a real publishing pipeline on top.
- Employers on Next.js get "a tool that emits websites" immediately; small clients see a product.

## Core features (thin vertical slice)
**Editor**
- Create site from a template; page = ordered list of sections (hero, features, gallery, pricing, contact, footer)
- Add/reorder/delete sections; edit text inline, swap images, pick theme colours & font pair
- Live co-editing: multiple users, live cursors + selection highlights, changes merge without conflict
- Undo/redo, autosave, version history (last 10)

**Publishing**
- Publish → served at `slug.pagecraft.virajdomadia.com` (wildcard `*.pagecraft.virajdomadia.com` → Vercel) or `/s/slug` fallback, fast and SEO-friendly
- Unpublish, custom slug

**Account**
- Sites list, invite collaborator by email, free vs Pro (Razorpay subscription — Pro removes badge + unlocks templates)

## The wow moment
Two people editing the same page, cursors flying, then hitting Publish and opening the live URL.

## Out of scope (v1)
Free-form canvas positioning, custom domains, forms backend, multi-page sites, code export.

## Tech notes (to discuss)
- CRDT: Yjs document per site; provider = y-websocket on a small Node service (or Liveblocks/PartyKit — decide)
- Rendering published sites: RSC + ISR, revalidate on publish; subdomain routing via middleware
- Images: upload to Cloudinary/UploadThing with transforms
- Section schema as typed JSON so the editor and renderer share one source of truth

## Success criteria
- Two users edit the same text simultaneously with no lost updates
- Published page scores 100/100/100 on Lighthouse

## Open questions
- Self-hosted y-websocket vs managed (Liveblocks) — cost vs "I built it"?
- Subdomains (needs wildcard DNS) vs path-based for v1?
