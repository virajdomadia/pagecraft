# Pagecraft — Technical Design

**Lifecycle step:** 4 of 17 · **Locked:** 2026-09-16 · UI companion: [04-ui-mockups.md](04-ui-mockups.md). Schema and routes: [06-data-and-api.md](06-data-and-api.md).

## 1. Stack (shared stack, no deviations)
| Layer | Choice | Notes |
|---|---|---|
| web/ | Next.js 15 App Router · TypeScript strict · Tailwind 4 · pnpm | UI only; `/api/*` rewritten to the API so cookies are same-origin. New: `yjs`, `y-protocols` (awareness), `@dnd-kit/sortable`, `zod` |
| api/ | FastAPI (Python 3.12, uv) · SQLAlchemy 2.0 async + Alembic · pydantic · pytest | Vercel FastAPI preset, region `bom1`, `maxDuration` 300 for the stream route. New: **`pycrdt`** (Yrs bindings — apply / merge / export Yjs updates in Python) |
| Data | Neon Postgres | Documents (updates + snapshots), publications, users, members |
| Realtime (v2) | Upstash Redis (TCP `redis-py` asyncio) | One capped stream per open site; `XREAD BLOCK` for fan-out |
| Files | Vercel Blob | User-uploaded images; template photos are static files in `web/public/templates/` |
| Email (v2) | Resend + React Email | Invites, forgot-password, (v3) submissions |
| Payments (v3) | Razorpay Subscriptions + webhooks, test mode | Pro plan |
| AI (v3) | pydantic-ai → Claude | Section copy |
| Domains (v4) | Vercel Domains API (`POST /v10/projects/{id}/domains`, `GET …/domains/{domain}/config`) | Free; token scoped to the `pagecraft` project |
| Export (v4) | web Node route renders `SiteRenderer` to a string; API zips (`zipfile`) and streams; GitHub Git Data API via OAuth | No clone, one tree + one commit per publish |
| Contract | `api/openapi.json` → `openapi-typescript` → `web/src/lib/api-types.ts` | Script `pnpm gen:api`; committed; **not** CI-gated |
| CI | GitHub Actions: `web` (typecheck + build), `api` (ruff + pytest with Postgres service; Redis service from v2) | Nothing else |

## 2. The document

One `Y.Doc` per site. Shape (what `doc.toJSON()` looks like; `Y.Text` fields are strings in the export):

```jsonc
{
  "site": { "name": "Kaapi Corner",
            "theme": { "palette": "espresso", "fonts": "fraunces-inter", "radius": "soft" },
            "seo":   { "title": "Kaapi Corner · Indiranagar", "description": "…", "og_image": "/templates/cafe/hero.jpg" } },
  "sections": [
    { "id": "s_8f2k", "type": "hero", "variant": "split",
      "props": { "eyebrow": "Since 2019", "headline": "Filter coffee, done properly.",
                 "body": "…", "image": { "url": "https://…", "alt": "…" },
                 "cta": { "label": "See the menu", "href": "#menu" } } },
    { "id": "s_1q9z", "type": "features", "variant": "grid-3",
      "props": { "heading": "…", "items": [ { "id": "i_1", "title": "…", "body": "…", "icon": "cup" } ] } }
  ]
}
```

- `site` is a `Y.Map`; `sections` a `Y.Array<Y.Map>`; every string prop that a user types into is a **`Y.Text`** (character-level merge — two people can edit one headline); enums, urls and numbers are plain values in the `Y.Map` (last-writer-wins is right for "variant = split"). Lists (`items`, `plans`, `faqs`) are `Y.Array<Y.Map>` so reorders and concurrent adds merge.
- Section ids are client-generated nanoids; selection, awareness and comments (v3) key on them.
- **Section registry** (`web/src/sections/<type>/`): `schema.ts` (zod — props and variants), `defaults.ts`, `<Variant>.tsx` per variant, `thumb.svg`, `fields.ts` (inspector field list derived from the schema). `registry.ts` exports the ten types. The **same components** render in the editor canvas (with `editable` wrappers) and on the published page (plain). The API mirrors the schema as pydantic models (`api/app/sections.py`, hand-kept, validated on publish) — the only duplicated contract, and it is ~80 lines.
- Undo/redo: `Y.UndoManager` over `site` and `sections`, `trackedOrigins = {localOrigin}`, `captureTimeout = 400` so typing groups into words.

## 3. Editor (web)
- Route `app/(studio)/sites/[id]/edit`; the whole editor is one client component tree over a `useSiteDoc(siteId)` hook that owns the `Y.Doc`, the persistence queue (§4) and, in v2, the stream.
- **Layers pane:** `useSyncExternalStore` over `sections` (observeDeep); `@dnd-kit/sortable` reorder = `Y.Array` delete + insert inside one `doc.transact`. Add section → registry defaults → new `Y.Map`.
- **Canvas:** renders `sections` through the registry inside a `<div>` whose width is the toggle (1280 / 834 / 390) with `container-type: inline-size` so sections use container queries, not viewport queries — the same CSS works on the published page. Selected section: outline + label; hover: faint outline. Not an iframe: same React tree, simpler selection and inline editing, and Tailwind classes are shared.
- **Inline text:** `<Editable text={yText}>` — a `contentEditable` span bound to `Y.Text` through `y-textarea`-style binding (observe → DOM, `beforeinput` → `yText.insert/delete`); plain text and `\n` only. In v2 the caret position is published in awareness and drawn for others.
- **Inspector:** fields generated from `fields.ts`; each field writes to the `Y.Map` / `Y.Text`. Theme panel writes `site.theme`; theme is applied as CSS variables on the canvas root, so a palette change re-renders everything with no per-section work.
- **Width toggle and phone:** below 1024 px the route renders the canvas only, read-only, with "Edit on a desktop".
- **Motion signature and visual direction:** decided in [04-ui-mockups.md](04-ui-mockups.md) from 3–4 variants. On the table: a new section drawing in as a wireframe before it fills; publish stamping and sliding the page out; comet cursors (v2); theme ripple from the swatch.

## 4. Persistence (v1)
- `doc.on('update', (u, origin) => queue.push(u))` for local origin; the queue flushes every 300 ms, on `blur`, and on `visibilitychange`/`pagehide` via `navigator.sendBeacon` → `POST /sites/{id}/updates` `{ updates: base64[] }`. Updates are merged client-side with `Y.mergeUpdates` before sending so a flush is one blob.
- API: `INSERT INTO site_updates (site_id, seq, update, author_id)` with `seq = max+1` under the site's row lock (`SELECT … FOR UPDATE` on `sites`) — the lock is held for ~1 ms and serialises seq; returns `{ seq }`.
- **Compaction:** if `seq − sites.snapshot_seq ≥ 50` → `Doc()` (pycrdt) → `apply_update(snapshot)` → apply each tail update → `sites.snapshot = doc.get_update()`, `snapshot_seq = seq`, delete tail rows ≤ seq. Runs inline in the request (tens of ms for a page-sized doc); publish always compacts first.
- Load: `GET /sites/{id}/doc` → `{ snapshot: base64, updates: base64[], seq }`; the client applies both. State vector isn't needed: the client always starts from empty.
- Offline: the queue persists to `localStorage` (`pc:queue:{siteId}`) and drains on the next flush; the status pill reflects it.

## 5. Realtime (v2): SSE on Vercel, `XREAD BLOCK`

```
POST /sites/{id}/updates            (unchanged) + XADD site:{id} MAXLEN ~1000 * kind=update seq=… data=<bytes> author=<user>
POST /sites/{id}/awareness          body { state } → XADD site:{id} kind=aw client=<clientID> data=<awareness update>   (never stored in Postgres)
GET  /sites/{id}/stream?from=<id>   text/event-stream, maxDuration 300
  event: hello   data: { seq, stream_id, server_time }
  event: update  id: <stream_id>  data: { seq, author, data: base64 }
  event: aw      data: { client, data: base64 }
  event: ping    every 20 s
```

Loop: `entries = XREAD BLOCK 1000 STREAMS site:{id} last_id` → emit each → repeat; after ~280 s close; `EventSource` reconnects with `Last-Event-ID`. If the id is older than the stream's first entry (trimmed), the server sends `event: resync` and the client refetches `/doc` and re-applies (Yjs makes replaying idempotent). Cursor latency = POST round trip + XREAD wake + SSE push ≈ 100–250 ms from `bom1`.

The client ignores `update` events whose `author` is itself only when `seq` ≤ its last acked seq (its own updates come back but are no-ops for Yjs anyway). Awareness: `y-protocols/awareness` `Awareness` instance; `encodeAwarenessUpdate` on change, throttled to 100 ms; `removeAwarenessStates` on `pagehide`; remote states expire after 30 s.

**Why a stream and not the version-counter poll Frontrow uses:** documents change many times a second while someone types; `XREAD BLOCK` delivers each change as it lands with no interval, and the stream doubles as the awareness channel. Capped at 1000 entries per site (`MAXLEN ~`), so memory is bounded; Postgres remains the durable log.

**Upstash budget (free tier 500k commands/month):** idle open tab = 1 `XREAD` per second (3,600/h); typing = 1 `XADD` per 300 ms flush + awareness ≤ 10/s. A 30-minute two-tab demo ≈ 25k commands. Fine.

Why not WebSockets / Liveblocks: Vercel functions can't hold WebSockets; a free always-on host cold-starts mid-demo; a hosted CRDT provider hides the part this project proves.

## 6. Publish pipeline (api)
1. `POST /sites/{id}/publish` `{ slug, seo }` → owner or editor check → compaction (§4) → `doc = Doc(); doc.apply_update(snapshot)`.
2. `content = doc.to_py()`-style export (pycrdt `Map`/`Array`/`Text` → plain JSON) → `SiteContent` pydantic validation (types, variants, prop shapes, ≤ 30 sections, image urls on the Blob host or under `/templates/`) → 422 naming the section on failure.
3. One transaction: `INSERT publications (site_id, version = last+1, content, slug, seo, published_by)`, `UPDATE sites SET published_slug = slug, published_at = now()`. Slug uniqueness = `sites.published_slug UNIQUE` (409 `slug_taken`).
4. `POST {WEB_URL}/api/revalidate` `{ tag: "site:{slug}", secret }` → web calls `revalidateTag`. If web is unreachable the publish still succeeds; ISR's 60 s revalidate catches up.
5. Unpublish: `published_slug = NULL` + revalidate.

## 7. Serving published sites (web)
- `app/s/[slug]/page.tsx`: `fetch(API/public/sites/{slug}, { next: { tags: ['site:'+slug], revalidate: 60 } })` → `<SiteRenderer content>` → registry components with `editable=false`, theme as CSS variables on `<main>`, `next/font` for the pair (the six font pairs are preloaded via `next/font/google` and picked by name), `next/image` with `remotePatterns` for the Blob host, `generateMetadata` from `seo`, JSON-LD `LocalBusiness` for business templates. One client component (`SiteScript`) for nav toggle, FAQ accordion, gallery lightbox.
- `middleware.ts`: if `host` ends with `.pagecraft.virajdomadia.com` and the first label is not `www`/`api` → `NextResponse.rewrite('/s/'+label + pathname)`. `/s/{slug}` stays reachable so the demo works before wildcard DNS. Wildcard: `*.pagecraft.virajdomadia.com` added to the Vercel project when `virajdomadia.com` moves to Vercel DNS.
- Badge: `content.plan !== 'pro'` → fixed "Made with Pagecraft" pill (v3 removes it).
- Lighthouse 100s: no third-party scripts, images sized via `sizes`, fonts self-hosted through `next/font`, `<h1>` from the hero, alt text required in the schema, colour palettes pre-checked for ≥ 4.5:1 ink-on-bg and accent-ink-on-accent.

## 8. Uploads
`POST /uploads` (multipart, ≤ 5 MB, jpeg/png/webp, owner/editor of `site_id`) → Pillow check + resize to ≤ 2000 px → `vercel_blob.put('sites/{site_id}/{uuid}.{ext}')` → `{ url, width, height }`. The client writes `{url, alt}` into the doc. Deleting a site deletes its Blob prefix.

## 9. Auth & access
Own session auth (as Tripsmith / Frontrow): `users(email, password_hash argon2, name, plan)`, `sessions(id, user_id, expires_at)`, cookie `pc_session` HttpOnly SameSite=Lax. Access to a site = `site_members(site_id, user_id, role owner|editor)` — every `/sites/{id}/*` route resolves the member row first (404 if none). `POST /auth/demo` signs in as the seeded creator or collaborator.

## 10. Caching & rendering
Editor routes: dynamic, `no-store`. Dashboard: dynamic. Published sites: ISR 60 s + tag revalidation on publish. Landing: static. API `GET /public/sites/{slug}`: `Cache-Control: s-maxage=60, stale-while-revalidate=300`.

## 11. Failure modes worth handling
| Failure | Behaviour |
|---|---|
| Update POST fails | Queue keeps the merged update in `localStorage`, retries with backoff, pill shows *Offline*; nothing is lost while the tab lives |
| Two tabs, same user (v1, no stream) | Each tab's edits persist; the other sees them on reload — v1 is single-session by design, v2 fixes it |
| Stream trimmed past `Last-Event-ID` (v2) | `resync` → client refetches `/doc`; Yjs replay is idempotent |
| Redis down (v2) | Updates still persist to Postgres; stream returns 503 and the client falls back to polling `/doc?since=seq` every 3 s |
| Publish validation fails | 422 names the section; the editor selects it and shows the message |
| Web revalidate hook unreachable | Publish succeeds; ISR catches up within 60 s |
| Compaction races with a concurrent append | Compaction runs under the same `sites` row lock as appends; tail rows above `snapshot_seq` are never deleted |

## 12. Testing (only these)
- `test_text_converges`: two pycrdt docs insert at the same offset of one `Text`; exchange updates in both orders → identical strings, both insertions present.
- `test_compaction_equivalent`: snapshot + 60 updates → compact → export equals the export of applying all updates to an empty doc.
- `test_publish_export`: publish → `publications.content` equals a fresh pycrdt export of the site doc; invalid variant → 422 naming the section.
- `test_slug_unique_and_reserved`: second site with the same slug → 409; `www` → 422.
- `test_membership`: non-member → 404 on doc, updates, publish; editor → cannot delete or manage members.
- v2: `test_stream_replays_after_reconnect` (XADD three, connect from id 2 → receives 3); one Playwright test — two pages, type in one, assert text in the other ≤ 500 ms, both type into one word → equal.
- v3: `test_subscription_webhook_replay`.

## 12b. v4 — domains, export, import
- **Custom domains:** `sites.custom_domain` (unique) + `domain_status` (`pending_dns` | `pending_ssl` | `live` | `error`). `POST /sites/{id}/domain` validates the hostname, stores it, returns the DNS instruction; `GET /sites/{id}/domain` is polled by the panel and does the work: `dns.resolver` check → Vercel `add domain` (idempotent) → `config` until `misconfigured = false` → `live`. `www` handled by adding both names with a redirect on the apex. `DELETE` detaches. Host resolution for the middleware: `GET /public/hosts/{host}` → `{ slug }` with `s-maxage=300`; `middleware.ts` treats any host that is not `pagecraft.virajdomadia.com`/`*.pagecraft…`/`localhost` as custom and rewrites to `/s/{slug}` (404 page if unknown). `<link rel="canonical">` prefers the custom domain.
- **Static export:** the renderer must run in Node, so `web/app/api/export/route.ts` (secret-checked, called by the API) renders `<SiteRenderer content>` with `renderToStaticMarkup`, collects the CSS the sections need (one static `styles.css` built at deploy time from the registry — the same Tailwind output the site uses) and returns `{ html, css }`. The API (`services/export.py`) downloads every image referenced in the content into `/images/`, rewrites the URLs, writes `sitemap.xml`, `robots.txt`, `pagecraft.json` (= `publications.content` + `seo` + `version` + `exported_at`), zips in memory and streams `application/zip`. Badge included on Free.
- **GitHub push:** OAuth app (scope `repo`), token encrypted with `SESSION_SECRET`-derived key in `github_connections`. `services/github.py`: get ref → create blobs (base64 for images) → create tree → create commit → update ref. Runs after a successful publish when `sites.github_push = true`; failures are logged to the publish response, never block it.
- **Import:** `POST /sites/import` (multipart zip or json) → find `pagecraft.json` → `SiteContent` validation → `services/templates.py.build_doc(content)` (the same function that builds template docs) → images in the zip uploaded to Blob and URLs rewritten → `sites` + `site_members` rows → editor. Slug from the export, suggestion on collision.
- **Tests (only these):** `test_host_resolution` (custom host → slug, unknown → 404, taken → 409), `test_export_import_roundtrip` (export → import → export equal modulo ids/timestamps), `test_export_contains` (index.html, styles.css, images, pagecraft.json present; no Blob URLs left).
- **Failure modes:** Vercel API error → `domain_status = error` with the message in the panel; DNS never resolving → stays `pending_dns` with the instruction shown (no timeout); GitHub token revoked → push skipped with a notice and `github_push` turned off.

## 13. Environment
`api/`: `DATABASE_URL`, `SESSION_SECRET`, `WEB_URL`, `REVALIDATE_SECRET`, `BLOB_READ_WRITE_TOKEN`; v2: `REDIS_URL`, `RESEND_API_KEY`; v3: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`; v4: `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. `web/`: `API_URL`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_SITE_HOST` (= `pagecraft.virajdomadia.com`), v3: `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
