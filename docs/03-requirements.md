# Pagecraft — Requirements & Scope

**Lifecycle step:** 3 of 17 · **Locked:** 2026-09-16 · **Source:** [PRD.md](../PRD.md) locked decisions. Flows and screen index: [03-user-flows.md](03-user-flows.md).

Actors: **Creator** (owns sites), **Collaborator** (editor on someone else's site, v2), **Visitor** (reads a published site; not signed in). Each requirement ends with **Accept:** — the check that closes it. Ids: R = v1, R2 = v2, R3 = v3.

---

## v1 — Solo studio (base, ≈ 18 h)

### R1. Auth & sites dashboard
- Email + password, cookie session (`pc_session`), sign up / sign in / sign out; forgot-password arrives with Resend in v2 (v1 shows "contact us"). Two demo logins on the landing page (creator, collaborator).
- `/sites`: the user's sites as cards (screenshot-less: a live mini render of the hero at 320 px), status draft / published, last edited, published URL; **New site** button. Free plan: 3 sites.
- **Accept:** protected routes redirect to sign-in and back; a user never sees another user's site (404, not 403, on direct URL).

### R2. New site from a template
- `/sites/new`: six templates (café, salon, freelancer, gym, product launch, restaurant) with a live preview panel; pick → name the site → the API clones the template's `Y.Doc` snapshot into a new site and opens the editor.
- Slug defaults to a slugified name and must be unique across the platform; reserved words (`www`, `api`, `app`, `admin`) rejected.
- **Accept:** create → editor in one round trip; slug collision shows an inline suggestion (`kaapi-corner-2`).

### R3. Editor — document & sections
- `/sites/[id]/edit`: three panes on ≥ 1024 px — **layers** (ordered sections, drag to reorder, duplicate, delete), **canvas** (the real section components rendered at the chosen width), **inspector** (variant, props of the selected section; theme when nothing is selected). Top bar: site name, undo / redo, width toggle (desktop 1280 / tablet 834 / phone 390), **Publish**.
- Section library (from the layers pane): nav, hero, features, gallery, testimonials, pricing, FAQ, contact, CTA, footer — each with 2–3 variants and a thumbnail; add inserts below the selected section.
- Click a section on the canvas → selected (outline + label); click text → inline edit bound to the `Y.Text`; Esc deselects; Delete removes the section (with undo).
- Inspector fields per section come from its zod schema: text, textarea, image, colour override, link, list (features / FAQ items / plans / testimonials with add / remove / reorder).
- Images: click → upload (drag-drop or file picker, ≤ 5 MB, jpeg / png / webp) → Vercel Blob → URL into the doc; alt text field. Template images are static files under `web/public/templates/` (same host as published sites); user uploads go to Blob.
- Theme panel: 8 palettes (each = bg, surface, ink, accent, accent-ink) + 6 font pairs (heading / body from Google Fonts) + radius (sharp / soft / round). A change re-renders every section live.
- Undo / redo via Yjs `UndoManager` (own edits only, once v2 lands), keyboard `⌘Z` / `⌘⇧Z`.
- Under 1024 px the editor shows the canvas as a preview with "Edit on a desktop" — no mobile editing.
- **Accept:** every section type renders every variant at 390 / 834 / 1280 without overflow; any edit is undoable; reordering ten sections never loses one; an upload over 5 MB is rejected with a message.

### R4. Autosave & document persistence
- The client encodes Yjs updates and posts them in batches every 300 ms (or on blur / before unload) to `POST /sites/{id}/updates`; the API appends to `site_updates`. Loading the editor fetches `GET /sites/{id}/doc` (snapshot + tail updates) and applies them.
- Every 50 appended updates the API compacts snapshot + tail with pycrdt into `sites.snapshot` and trims the tail.
- Status pill in the top bar: *Saved* / *Saving…* / *Offline — changes kept locally* (the queue is retried; the doc lives in the tab until it drains).
- **Accept:** test — two `Y.Text` inserts at the same offset applied in either order converge (pycrdt); reload after an edit shows the edit; closing the tab mid-batch loses at most 300 ms of typing.

### R5. Publish
- Publish dialog: slug (editable), SEO title, description, OG image (pick from site images or upload), then **Publish**. The API compacts the doc, exports it to JSON with pycrdt, validates it against the section schema, stores it as `publications(version n)`, marks the site published, and calls web's revalidate hook.
- The published page is served at `/s/{slug}` and at `{slug}.pagecraft.virajdomadia.com` (middleware rewrite on `Host`). Unpublish → 404 page with "This site is not published". Republish creates version n+1.
- Published pages: server-rendered from `content`, `next/image` for every image, fonts via `next/font`, one small script for nav toggle / FAQ accordion / gallery lightbox, JSON-LD `LocalBusiness` when the template is a business, `robots` allowed, a "Made with Pagecraft" badge (free plan).
- **Accept:** test — `publications.content` equals pycrdt's export of the doc; publish → the URL shows the change within 5 s; Lighthouse mobile 100 / 100 / 100 on all six seeded templates; slug change keeps the old slug 404 (no redirects in v1).

### R6. Site settings
- `/sites/[id]/settings`: rename, slug, SEO defaults, unpublish, delete site (type the name). Free-plan badge notice with "Pro coming soon" (v3 wires it).
- **Accept:** delete removes the site, its updates and publications; the published URL 404s.

### R7. Seed & content
- Seed script (idempotent): platform user, demo creator, demo collaborator, six template docs (built by a Python script that constructs the `Y.Doc` with pycrdt from a JSON description, so templates are real CRDT snapshots), the *Kaapi Corner* demo site owned by the creator with the collaborator as editor, published at `kaapi-corner`. Template photos from Wikimedia Commons in `web/public/templates/` with `CREDITS.md`.
- **Accept:** `seed` runs twice without duplicates; every template opens in the editor and publishes with Lighthouse 100s.

---

## v2 — Studio session (mid, ≈ 14 h)

### R2-1. Live co-editing
- `GET /sites/{id}/stream` (SSE): on connect, the current stream position; then every update `XADD`ed by any client, as it arrives (`XREAD BLOCK`); reconnect via `Last-Event-ID`. The client applies remote updates to its `Y.Doc`; its own updates are echoed and ignored by origin.
- Yjs awareness (cursor position, selected section, text caret, user name + colour) is published to the same stream as ephemeral `aw` entries, throttled to 10/s per client, expiring when the client disconnects or after 30 s of silence.
- Canvas shows collaborator cursors (name tag, colour), their selected section (coloured outline), and their text caret inside inline edits. Top bar shows presence avatars.
- Undo only undoes the local user's changes (`UndoManager` with `trackedOrigins`).
- **Accept:** e2e — two pages, type in one, the other shows the text ≤ 250 ms (500 ms tolerance in CI); both type into the same word → identical text in both, no loss; a dropped stream resumes without a reload.

### R2-2. Invite collaborators
- Settings → Members: invite by email (role editor) → Resend email with a link → accept (sign up / in) → `site_members` row. Owner can remove; editor can edit and publish but not delete the site or manage members.
- **Accept:** email arrives with a working link; a removed editor's stream closes and the editor page 404s on reload.

### R2-3. Version history
- Every publish and every 30 min of activity writes a snapshot (`site_snapshots`, keep last 10). History panel: list with author + time, preview a snapshot read-only on the canvas, **Restore** (applies as a new update, so it is undoable and synced).
- **Accept:** restore reproduces the snapshot exactly; more than 10 snapshots trims the oldest.

### R2-4. Publish diff
- Publish dialog shows "N sections changed since v{last}" with the section names, computed by comparing the current export with the last publication.
- **Accept:** editing one section's text shows exactly that section as changed.

### R2-5. Try it live (landing)
- Landing section with two embedded editor canvases of a scratch copy of the demo site side by side, driven by the real stream, reset hourly.
- **Accept:** the wow works without opening two tabs.

---

## v3 — Pro (advanced, ≈ 13 h)

### R3-1. Pro plan
- Razorpay subscription (test mode, ₹299/month): removes the badge, unlocks three premium templates (photographer, boutique, clinic), raises the site limit to 20. Webhook `subscription.activated / charged / cancelled` deduped by event id; plan state on `users`.
- **Accept:** test — webhook replay is a no-op; downgrade re-adds the badge on next publish.

### R3-2. Contact-form backend
- The contact section posts to `POST /public/sites/{slug}/submissions` (rate-limited, honeypot); submissions inbox at `/sites/[id]/inbox`; email notification to the owner (Resend).
- **Accept:** a submission from the published page appears in the inbox and the owner's email within a minute.

### R3-3. AI copy
- Inspector: "Rewrite with AI" on any text field → pydantic-ai (Claude) with the site's business context → three suggestions → pick one → applied as a normal edit (synced, undoable).
- **Accept:** suggestions respect the field's length limit; nothing is applied without a click.

### R3-4. Analytics
- Published pages beacon a page view (`POST /public/sites/{slug}/views`, deduped per visitor per day); dashboard card: views last 7 / 30 days as a sparkline.
- **Accept:** views appear within a minute; reloads by the same visitor don't double count.

### R3-5. Comments
- Collaborators leave comments anchored to a section (thread, resolve); comment pins on the canvas; count in the layers pane.
- **Accept:** a comment posted in one tab appears in the other (over the same stream).

### R3-6. Duplicate site
- `Duplicate` on the dashboard clones the doc into a new draft site.

---

## Out of scope (all versions)
Free-form canvas · custom domains · multi-page sites · code export · rich-text formatting inside fields · custom CSS · e-commerce sections · real-money billing · mobile editing · redirects from old slugs · team workspaces (membership is per site).
