# Pagecraft — Development Plan

**Lifecycle step:** 7 of 17 · **Written:** 2026-09-16 · **Inputs:** [03-requirements.md](03-requirements.md), [04-technical-design.md](04-technical-design.md), [06-data-and-api.md](06-data-and-api.md).
**Tracker:** row status lives in the tracker artifact (link in [04-ui-mockups.md](04-ui-mockups.md) once published; updated per milestone).
**Budget:** v1 ≈ 18 h · v2 ≈ 14 h · v3 ≈ 13 h. v1 is built on a `Y.Doc` from the first editor row so v2 is additive (stream + awareness), not a rewrite. **Cadence:** evenings/weekends; each row = one branch + one PR, squash-merged, and **every PR shows something in the browser**. Milestones end deployed. **Build starts after Tripsmith v3 and the projects ahead of Pagecraft in build order** (1 → 2 → 4 → 5 → 3 → 6).

**Lean rules in force** (2026-09-15): setup is the minimum to deploy both apps with plain CI; no observability, contract gates, e2e workflows or tracker updates per PR; review findings fixed on the same branch; tests only from 04 §12. Hours saved go to the editor, motion and the templates. **Accounts and keys are created just-in-time** — in the row that first needs them, never in a setup batch: Neon in S2, Vercel Blob in F3, Upstash in L1, Resend in L4, Razorpay in A1, Anthropic in A4. Template photos live in `web/public/templates/` (no Blob needed until a user uploads).

How the lifecycle maps: step 8 = milestone 1.0; steps 9–11 and 14–15 cycle inside every row; step 12 is one checklist row at the end of v1; step 13 is the CI file in 1.0; step 16 is skipped unless something breaks; step 17 is a short doc after v3.

Column key — **Who:** 🟢 creator · 🟣 collaborator · 🔵 visitor (published site) · ⚪ platform. Endpoints from 06 §C; screens from 03-user-flows.

---

## v1 — Solo studio (≈ 18 h)

### Milestone 1.0 — Skeleton + dashboard live (≈ 5 h) — step 8
Goal: both apps deployed, DB seeded with six template docs, direction chosen, a user can sign in and create a site.

| # | Part | Who | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|---|
| S1 | **Direction + tokens** | 🟢 | Variant page per [04-ui-mockups.md](04-ui-mockups.md) (S5 editor + S9 published café, 3–4 directions, live motion candidates, CC photos) → Viraj picks → tokens + fonts in `globals.css`, themed browser surfaces | — | 1.5 h | Chosen direction recorded in 04-ui-mockups; landing restyled only if tokens changed |
| S2 | **API skeleton + DB + templates + seed** | ⚪ | `next.config.ts` rewrite `/api/*`; `lib/api.ts` typed fetch; `pnpm gen:api`; template photos in `public/templates/` + `CREDITS.md` | `pyproject` (uv), `main.py`, settings, error envelope, `/health`; models + Alembic `0001_v1` (06 §A); `sections.py` pydantic mirror; `services/templates.py` builds six template `Y.Doc`s with **pycrdt** from `seed/templates/*.json`; `seed/` — platform + demo creator + collaborator, templates, *Kaapi Corner* site (members: both); **accounts needed here and no others:** Vercel project `pagecraft-api` (FastAPI preset, bom1) + Neon (`DATABASE_URL`); `ci.yml` (web typecheck+build · api ruff+pytest) | 2 h | `api.pagecraft…/docs` opens in prod; seed idempotent; `GET /templates` lists six; CI green |
| S3 | **Auth + dashboard + new site** | 🟢 | S2 sign-in/up + demo buttons on landing; S3 dashboard cards (template thumb, status, URL); S4 template picker with preview image + name + slug suggestion → `POST /sites` → lands on a stub `/sites/[id]/edit` that shows the site name and section list from `/doc` | `/auth/*`, sessions, argon2, `/auth/demo`; `GET /sites`, `POST /sites` (clone template snapshot, plan limit), `GET /sites/{id}`, `GET /sites/{id}/doc`; membership dependency (404) | 1.5 h | Demo creator signs in from landing in one click and creates a café site; the collaborator sees only sites they are a member of |

### Milestone 1.1 — The editor (≈ 8.5 h) 🟢 — the project's core
| # | Part | Who | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|---|
| F1 | **Section registry + published renderer** | 🔵 | `sections/` — 10 types × 2–3 variants with zod schemas, defaults, thumbnails; container queries; theme as CSS variables (`lib/themes.ts` 8 palettes · 6 font pairs · radius); `SiteRenderer` + `SiteScript` (nav, FAQ, lightbox); `/s/[slug]` ISR with tags; `middleware.ts` host rewrite; `app/api/revalidate`; badge; JSON-LD; S11 not-published | `GET /public/sites/{slug}` (`s-maxage=60`); seed publishes *Kaapi Corner* through `services/publish.py` (export + validate) so the demo site is live before the editor exists | 3 h | `/s/kaapi-corner` renders the seeded café; all six templates published from seed render at 390 / 834 / 1280; Lighthouse mobile 100 / 100 / 100 on each |
| F2 | **Editor shell + document + autosave** | 🟢 | `lib/doc/useSiteDoc` (Y.Doc, load from `/doc`, `UndoManager`); `persistence.ts` (300 ms queue, `Y.mergeUpdates`, `sendBeacon`, `localStorage` offline queue); S5 three-pane shell with width toggle; layers pane (`@dnd-kit` reorder, duplicate, delete); S6 section library; canvas selection outline + label; status pill; **the chosen motion signature (section draw-in)**; phone → read-only preview | `POST /sites/{id}/updates` with the `sites` row lock + gap-free seq; `services/crdt.py` compaction every 50 updates; **tests:** `text_converges`, `compaction_equivalent` | 3 h | Add / reorder / delete ten sections, reload → same order; undo restores a deleted section; tests green in CI |
| F3 | **Inline text + inspector + theme + uploads** | 🟢 | `Editable` (`contentEditable` ↔ `Y.Text`, plain text + `\n`); S7 inspector fields from `fields.ts` incl. list add/remove/reorder; theme panel live; image field → drag-drop / picker → `POST /uploads` → `{url, alt}` into the doc | **Vercel Blob store created here** (`BLOB_READ_WRITE_TOKEN`); `POST /uploads` (Pillow sniff + resize ≤ 2000 px, ≤ 5 MB, jpeg/png/webp) | 2.5 h | Type in the hero headline, reload → it is there; swap a gallery photo; change palette and font pair and every section follows; a 6 MB upload is refused with a message |

### Milestone 1.2 — Publish + close v1 (≈ 4 h) 🟢
| # | Part | Who | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|---|
| F4 | **Publish** | 🟢 | S8 publish dialog (slug, SEO title/description, OG picker), success state with the URL + copy; **publish-moment motion if chosen**; unpublish in the top-bar menu | `POST /sites/{id}/publish` (compact → pycrdt export → pydantic validation → `publications` v(n) → revalidate hook), `POST …/unpublish`, reserved slugs; **tests:** `publish_export`, `slug_unique_and_reserved` | 2 h | Edit → Publish → the published URL shows the change within 5 s; a taken slug shows the suggestion; 422 selects the offending section |
| F5 | **Settings + v1 close** | 🟢 | S10 settings (rename, slug, unpublish, delete with name confirm); dashboard cards render a live 320 px hero from `/doc`; README "how the document pipeline works" with diagram; `docs/12-security-performance.md` one-page checklist + Lighthouse numbers | `PATCH/DELETE /sites/{id}` (updates, publications, Blob prefix); **test:** `membership` | 2 h | v1 tagged; every template publishes at Lighthouse 100s; portfolio case-study entry drafted |

**v1 total ≈ 17.5 h**

---

## v2 — Studio session (≈ 14 h)

### Milestone 2.0 — Live (≈ 7 h) 🟢🟣
| # | Part | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|
| L1 | **Stream + fan-out** | `lib/doc/stream.ts`: `EventSource` on `/stream`, apply `update` events, `Last-Event-ID`, `resync` → refetch `/doc`, polling fallback `/doc?since=`; presence-less "someone else is editing" pill | **Upstash Redis created here** (`REDIS_URL`); `XADD` after the Postgres commit in `/updates`; `services/stream.py` generator (`XREAD BLOCK 1000`, hello, ping 20 s, close at 280 s, resync when trimmed); `vercel.json` maxDuration 300; **test:** `stream_replays_after_reconnect` | 3 h | Two tabs (creator + collaborator): text typed in one appears in the other ≤ 250 ms; kill the stream → resumes without reload |
| L2 | **Awareness: cursors, selection, carets, presence** | `lib/doc/awareness.ts` (`y-protocols`, 100 ms throttle, pagehide cleanup); `Cursors.tsx` (name tag + colour, **comet trail if chosen**), coloured outline on the other's selected section, remote caret inside `Editable`; `Presence.tsx` avatars in the top bar; `UndoManager` `trackedOrigins` = local only | `POST /sites/{id}/awareness` (XADD `kind=aw`, 10/s rate limit); user `avatar_colour` on sign-up; **Playwright:** two pages, type in one → other shows ≤ 500 ms; both type into one word → equal | 2.5 h | The two-tab wow works on production; undo in one tab never undoes the other's edit |
| L3 | **Try it live + open as teammate** | Landing section: two embedded canvases of a scratch copy of the demo site, driven by the real stream; "Open as your teammate" button on the editor top bar (opens a new tab via `/auth/demo?as=collaborator`) | Scratch-site reset job (lazy: recreate when older than 1 h on first hit) | 1.5 h | The wow works without opening two tabs; reviewer opens the second tab in one click |

### Milestone 2.1 — Collaboration around the document (≈ 7 h) 🟢🟣
| # | Part | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|
| L4 | **Invites + members + forgot password** | S10 Members tab (invite by email, pending list, remove); S12 accept-invite page; forgot/reset pages | **Resend key created here**; `invites` table, `/sites/{id}/invites`, `/invites/{token}/accept`, `DELETE …/members/{id}` (closes their stream on next event); `/auth/forgot` + `/auth/reset` (React Email) | 2.5 h | Invite email arrives with a working link; accepted editor appears in presence; removed editor is 404'd |
| L5 | **Version history** | S15 history panel: list (author, time, label), read-only preview on the canvas, Restore | `site_snapshots` (on publish + every 30 min of activity, keep 10); `GET /sites/{id}/snapshots`, `POST …/restore` (applies as a synced update) | 2.5 h | Restore reproduces the snapshot exactly and is undoable; 11th snapshot trims the oldest |
| L6 | **Publish diff + polish** | S8 shows "N sections changed since v{last}" with names; unchanged → "Nothing changed"; motion polish for cursors/presence | `GET /sites/{id}/publish/diff` (export vs last publication, per section) | 1.5 h | Editing one section's headline lists exactly that section |

**v2 total ≈ 14 h**

---

## v3 — Pro (≈ 13 h)

### Milestone 3.0 — Money + forms + numbers (≈ 6 h) 🟢🔵
| # | Part | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|
| A1 | **Pro plan** | S13 upgrade page with Razorpay subscription modal; plan badge on dashboard; premium templates unlocked in S4; badge removal on published sites | **Razorpay test account + webhook created here** (`RAZORPAY_*`); `subscriptions`, `POST /billing/subscribe`, `POST /webhooks/razorpay` (HMAC, event-id dedupe, activated / charged / cancelled), plan on `users`, site limit 20; three premium template JSONs + photos; **test:** `subscription_webhook_replay` | 3 h | Test-mode subscription flips the plan; next publish has no badge; replaying the webhook does nothing |
| A2 | **Contact-form backend + inbox** | Contact section posts for real (honeypot, success state); S14 inbox with unread count | `submissions`, `POST /public/sites/{slug}/submissions` (rate limit 5/min/IP), `GET /sites/{id}/submissions`, Resend notification to the owner | 2 h | A form sent from the published page lands in the inbox and the owner's email within a minute |
| A3 | **Analytics** | Dashboard card: views last 7 / 30 days sparkline | `page_views` (per visitor per day), `POST /public/sites/{slug}/views` beacon from `SiteScript`, `GET /sites/{id}/analytics` | 1 h | Reloads by one visitor count once per day |

### Milestone 3.1 — Smart + social (≈ 7 h) 🟢🟣
| # | Part | web/ | api/ | Est. | Done when |
|---|---|---|---|---|---|
| A4 | **AI copy** | "Rewrite with AI" on text fields → three suggestions → pick → applied as a normal (synced, undoable) edit; brief input ("for a bakery in Indiranagar") | **Anthropic key created here**; `POST /sites/{id}/ai/rewrite` via pydantic-ai with the site's business context and the field's length limit | 2.5 h | Suggestions respect limits; nothing changes without a click |
| A5 | **Comments** | Comment pins on the canvas, thread panel, resolve, count in layers | `comments` table, `GET/POST /sites/{id}/comments`, new comments broadcast over the site stream | 2.5 h | A comment posted in one tab appears in the other |
| A6 | **Duplicate + v3 close** | Duplicate on the dashboard; final motion/polish pass; `docs/17-post-launch.md` (½ page); case study | `POST /sites/{id}/duplicate` | 1.5 h | v3 tagged; case study live |

**v3 total ≈ 12.5 h** · **Project total ≈ 44 h**
