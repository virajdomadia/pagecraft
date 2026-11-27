# Pagecraft — Security & Performance (v1)

**Lifecycle step:** 12 of 17 · **Checked:** 2026-11-26 on the v1 branch (`feat/v1`), production build, local API + Postgres.

## Security checklist
| Area | v1 state |
|---|---|
| Sessions | Own cookie `pc_session`: HttpOnly, SameSite=Lax, Secure on https, host-only; 30 days; only the token's SHA-256 is stored |
| Passwords | argon2id; unknown emails verify against a dummy hash (no timing oracle); email-only normalisation (passwords are never trimmed) |
| Access | Every `/sites/{id}/*` route resolves the membership row first → **404** for non-members (no existence leak); owner-only rename/move/delete → 403 for editors (`test_membership`) |
| Demo logins | Each click on the landing page makes a private sandbox: a fresh Deepa (owner) + Rohan (editor) and their own copy of Kaapi Corner at `demo-xxxxxxxx`. Demo users never see the showcase sites (owned by the platform account), can't choose an address, unpublish or delete; their pages are noindexed with a visible "visitor demo" banner, go dark after 24 h and are deleted at the next demo login |
| Rate limits | Postgres log (`rate_hits`): sign-up 10/h per IP, demo 20/h per IP, sign-in 30/15 min per IP and 10/15 min per email, site creation 20/h and uploads 60/h per user → 429 `rate_limited` |
| Cross-site writes | Non-GET requests the browser marks `Sec-Fetch-Site: cross-site`/`same-site` get 403 (sibling `*.virajdomadia.com` apps are "same site" for SameSite=Lax) |
| Document log | Row lock re-reads the row (`populate_existing`); every save is checked for shape, size (≤ 2 MB) and missing dependencies (409 → the client reloads); `snapshot_seq <= seq` is a DB constraint |
| Document input | Update bodies ≤ 200 updates / 256 KB, base64-checked and decoded by Yrs before they are appended (garbage is a 422, never a corrupt document) |
| Published content | Validated server-side on publish (pydantic mirror): plain text only, length limits, links only `#`, `http(s)://`, `mailto:`, `tel:`; images only template photos, Pagecraft media or the Blob store; alt text required |
| Uploads | ≤ 4 MB on the API (Vercel's body limit is 4.5 MB; the browser shrinks larger photos), sniffed by Pillow (never the filename or Content-Type), JPEG/PNG/WebP only, ≤ 25 MP checked before decoding, decoded off the event loop, resized ≤ 2000 px and re-encoded (EXIF/GPS stripped) |
| Revalidate hook | Secret-checked with a constant-time compare; tags whitelisted to `site:{slug}` |
| Headers | One CSP for the web origin: no remote scripts/styles/fonts/frames, `frame-ancestors 'none'`, `img-src` limited to self + the Blob store; nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy; the API adds nosniff + a request id |
| JSON-LD | Escaped `<`, `>`, `&` so content can't close the script tag |
| Errors | One envelope `{ error: { code, message, details } }`; unhandled errors log server-side and return a generic 500 |

Known gaps (by plan, not oversight): forgot-password arrives with email in v2; published sites share the studio's origin (a separate domain for `/s/*` needs DNS); unreferenced uploads are not garbage-collected.

## Lighthouse — published templates (mobile, production build)
| Site | Accessibility | Best practices | SEO |
|---|---|---|---|
| `/s/kaapi-corner` | 100 | 100 | 100 |
| `/s/loop-studio` | 100 | 100 | 100 |
| `/s/meera-rao` | 100 | 100 | 100 |
| `/s/ironline` | 100 | 100 | 100 |
| `/s/nimbus-kettle` | 100 | 100 | 100 |
| `/s/bistro-nine` | 100 | 100 | 100 |

Performance was not scored in this pass (the audit tool used excludes it, and localhost numbers would not represent Vercel's edge). What the pages do for it: server-rendered from cached ISR HTML, one ~1 KB client script (lightbox), fonts self-hosted by `next/font` with `display: swap` and no preloading of unused pairs, the hero image `fetchpriority="high"` and everything below it lazy, template photos pre-sized to 1000–1600 px JPEGs. **To do on production:** run PageSpeed Insights (mobile) on the six URLs after the first deploy and record the numbers here.

Layout: every template checked for horizontal overflow at 390 / 834 / 1280 px — none.
