# Pagecraft — Database + API Design

**Lifecycle step:** 6 of 17 · **Locked:** 2026-09-16 · Behaviour in [04-technical-design.md](04-technical-design.md). Alembic `0001_v1` creates everything under **A**; v2/v3 tables get their own migrations.

## A. Postgres schema (v1)

```sql
create type user_plan   as enum ('free','pro');
create type member_role as enum ('owner','editor');
create type template_key as enum ('cafe','salon','freelancer','gym','launch','restaurant',   -- v3: 'photographer','boutique','clinic'
                                  'photographer','boutique','clinic');

users        (id uuid pk, email citext unique, password_hash text, name text, plan user_plan default 'free',
              avatar_colour text, created_at)
sessions     (id text pk, user_id uuid fk, expires_at timestamptz, created_at)   index (user_id)

templates    (key template_key pk, name text, business text, premium bool, snapshot bytea, preview_url text, sort int)
              -- snapshot = a real Y.Doc update built by services/templates.py from seed/templates/*.json

sites        (id uuid pk, name text, template template_key,
              snapshot bytea,                 -- compacted Y.Doc state (pycrdt get_update())
              snapshot_seq bigint default 0,  -- updates ≤ this are folded into snapshot
              seq bigint default 0,           -- last appended update
              published_slug citext unique null, published_at timestamptz null, published_version int default 0,
              created_at, updated_at)   index (updated_at desc)
site_members (site_id uuid fk, user_id uuid fk, role member_role, created_at, primary key (site_id, user_id))
              index (user_id)
site_updates (site_id uuid fk, seq bigint, update bytea, author_id uuid fk null, created_at,
              primary key (site_id, seq))     -- tail above sites.snapshot_seq; trimmed on compaction
publications (id uuid pk, site_id uuid fk, version int, slug citext, content jsonb, seo jsonb,
              published_by uuid fk, created_at)   unique (site_id, version) · index (slug, version desc)
```

Documents are bytes (Yjs binary updates), never JSON, until publish: `snapshot` + `site_updates` tail = the live document; `publications.content` = the JSON export the renderer reads. `sites.seq` is bumped under the row lock so `site_updates.seq` is gap-free per site. `published_slug` lives on `sites` (unique = platform-wide slug guard) and is copied into each publication for history.

**Row lock recipe** (append and compaction share it):
```sql
begin;  select seq, snapshot_seq from sites where id = $1 for update;
        insert into site_updates (site_id, seq, update, author_id) values ($1, $seq+1, $update, $user);
        update sites set seq = $seq+1, updated_at = now() where id = $1;
        -- if seq+1 - snapshot_seq >= 50: compact (pycrdt) and delete from site_updates where site_id=$1 and seq <= new snapshot_seq
commit;
```

**v2 additions:** `site_snapshots (id, site_id fk, seq bigint, snapshot bytea, label text, author_id, created_at)` index (site_id, created_at desc) — keep 10 per site; `invites (token text pk, site_id fk, email citext, role member_role, invited_by, expires_at, accepted_at null)`; `users.last_seen_at`.
**v3 additions:** `subscriptions (id, user_id fk unique, razorpay_subscription_id text unique, status text, current_end timestamptz, created_at)`; `webhook_events (id text pk, received_at)`; `submissions (id, site_id fk, data jsonb, ip_hash text, created_at)` index (site_id, created_at desc); `page_views (site_id fk, day date, visitor_hash text, primary key (site_id, day, visitor_hash))`; `comments (id, site_id fk, section_id text, author_id, body text, resolved_at null, created_at)` index (site_id, section_id).

**v4 additions:** `sites.custom_domain citext unique null`, `sites.domain_status text`, `sites.github_repo text null`, `sites.github_push bool default false`; `github_connections (user_id fk pk, login text, token_enc bytea, created_at)`.

## B. Redis keys (v2)
| Key | Type | Cap / TTL | Written by |
|---|---|---|---|
| `site:{id}` | stream · entries `kind=update\|aw`, `seq`, `author`/`client`, `data` | `MAXLEN ~ 1000` | append (after Postgres commit), awareness POST |
| `rl:aw:{client}` | int | 1 s | awareness rate limit (10/s) |
| `rl:sub:{ip}` (v3) | int | 60 s | submissions rate limit (5/min) |

## C. REST API (`/api/*` from the browser; FastAPI serves `/docs`)

Error envelope everywhere: `{ "error": { "code": "slug_taken", "message": "…", "details": {…} } }`. Auth via cookie; `🔒` = signed in, `👥` = member of the site (owner or editor; 404 otherwise), `👑` = owner, `⚙` = server-to-server.

### Auth
| Method | Path | Body → Returns |
|---|---|---|
| POST | `/auth/sign-up` | `{ email, password, name }` → `Me` |
| POST | `/auth/sign-in` | `{ email, password }` → `Me` |
| POST | `/auth/sign-out` | → 204 |
| GET | `/auth/me` | `Me { id, name, email, plan, avatar_colour }` · 401 |
| POST | `/auth/demo` | `{ as: 'creator' \| 'collaborator' }` → `Me` (landing demo buttons) |

### Sites 🔒
| Method | Path | Body → Returns |
|---|---|---|
| GET | `/sites` | `SiteCard[]` (id, name, template, status draft\|published, published_url, updated_at, role) |
| GET | `/templates` | `Template[]` (key, name, business, premium, preview_url, locked for free plan) |
| POST | `/sites` | `{ name, template }` → 201 `SiteCard` · 402 `plan_limit` (free: 3 sites) · 402 `premium_template` |
| GET 👥 | `/sites/{id}` | `Site` (card + seo + published_slug + members[]) |
| GET 👥 | `/sites/{id}/doc?since=` | `{ snapshot: base64, updates: base64[], seq }` — `since` returns only updates > seq (polling fallback) |
| POST 👥 | `/sites/{id}/updates` | `{ updates: base64[] }` (≤ 200, ≤ 256 KB) → `{ seq }` |
| POST 👥 | `/sites/{id}/publish` | `{ slug, seo: { title, description, og_image } }` → `{ version, url }` · 409 `slug_taken` · 422 `invalid_content { section_id, message }` · 422 `reserved_slug` |
| POST 👥 | `/sites/{id}/unpublish` | → 204 |
| PATCH 👑 | `/sites/{id}` | `{ name?, seo? }` → `Site` |
| DELETE 👑 | `/sites/{id}` | → 204 (updates, publications, Blob prefix) |
| POST 👥 | `/uploads` | multipart `file`, `site_id` → `{ url, width, height }` · 413 · 415 |

### Public (no auth)
| Method | Path | Returns |
|---|---|---|
| GET | `/public/sites/{slug}` | `PublishedSite { slug, version, content, seo, plan, template }` · 404 `not_published` · `s-maxage=60` |
| GET | `/home` | landing: template previews + demo-site URL |

### Server-to-server ⚙
| Method | Path | Notes |
|---|---|---|
| POST (web) | `{WEB_URL}/api/revalidate` | `{ tag, secret }` — web route, called by the API on publish/unpublish |

### v2
| Method | Path | Notes |
|---|---|---|
| GET 👥 | `/sites/{id}/stream?from=` | SSE — `hello` / `update` / `aw` / `resync` / `ping`; `Last-Event-ID` honoured |
| POST 👥 | `/sites/{id}/awareness` | `{ data: base64 }` → 204 (XADD only; rate-limited) |
| GET/POST 👑 | `/sites/{id}/invites` | POST `{ email }` → sends Resend mail; GET pending |
| POST 🔒 | `/invites/{token}/accept` | → `SiteCard` (creates the member row) |
| DELETE 👑 | `/sites/{id}/members/{user_id}` | → 204 |
| GET 👥 | `/sites/{id}/snapshots` · POST `/sites/{id}/snapshots/{id}/restore` | list · restore (applies a "replace" update, synced + undoable) |
| GET 👥 | `/sites/{id}/publish/diff` | `{ changed: [{ section_id, type, change: added\|removed\|edited }] }` vs last publication |
| POST | `/auth/forgot` · `/auth/reset` | Resend link |

### v4 (sketch; detailed when v4 starts)
`POST/GET/DELETE /sites/{id}/domain` 👑 (POST `{ domain }` → `{ status, record: { type, name, value } }` · 409 `domain_taken` · 402 `pro_required`) · `GET /public/hosts/{host}` → `{ slug }` (`s-maxage=300`) · `GET /sites/{id}/export.zip` 👥 · `GET /auth/github` + `/auth/github/callback` 🔒 · `DELETE /auth/github` 🔒 · `POST /sites/{id}/github` 👑 `{ repo, push_on_publish }` · `POST /sites/{id}/github/push` 👑 · `POST /sites/import` 🔒 (multipart) → `SiteCard` · 422 `invalid_export`.

### v3 (sketch; detailed when v3 starts)
`POST /billing/subscribe` → Razorpay subscription params · `POST /webhooks/razorpay` ⚙ · `POST /public/sites/{slug}/submissions` · `GET /sites/{id}/submissions` 👥 · `POST /public/sites/{slug}/views` · `GET /sites/{id}/analytics` 👥 · `POST /sites/{id}/ai/rewrite` 👥 `{ section_id, field, brief }` → `{ suggestions: string[3] }` · `GET/POST /sites/{id}/comments` 👥 · `POST /sites/{id}/duplicate` 🔒.

## D. Payload shapes that matter
```ts
type SiteContent = {
  site: { name: string; theme: { palette: PaletteKey; fonts: FontPairKey; radius: 'sharp'|'soft'|'round' };
          seo: { title: string; description: string; og_image?: string } };
  sections: Section[];                       // ≤ 30
};
type Section = { id: string; type: SectionType; variant: string; props: Record<string, unknown> };  // props typed per section by zod
type SectionType = 'nav'|'hero'|'features'|'gallery'|'testimonials'|'pricing'|'faq'|'contact'|'cta'|'footer';
type DocResponse = { snapshot: string; updates: string[]; seq: number };     // base64 Yjs binary
type StreamUpdate = { seq: number; author: string | null; data: string };   // SSE `update` event
type StreamAwareness = { client: number; data: string };                     // SSE `aw` event
type PublishedSite = { slug: string; version: number; content: SiteContent; seo: SiteContent['site']['seo']; plan: 'free'|'pro'; template: string };
```
