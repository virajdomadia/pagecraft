# Pagecraft — Security & Performance (v1)

**Lifecycle step:** 12 of 17 · **Checked:** 2026-11-26 on the v1 branch (`feat/v1`), production build, local API + Postgres.

## Security checklist
| Area | v1 state |
|---|---|
| Sessions | Own cookie `pc_session`: HttpOnly, SameSite=Lax, Secure on https, host-only; 30 days; only the token's SHA-256 is stored |
| Passwords | argon2id; unknown emails verify against a dummy hash (no timing oracle); email-only normalisation (passwords are never trimmed) |
| Access | Every `/sites/{id}/*` route resolves the membership row first → **404** for non-members (no existence leak); owner-only rename/move/delete → 403 for editors (`test_membership`) |
| Shared demo logins | The seeded showcase sites can be edited and republished by demo users but not renamed, moved, unpublished or deleted; the demo creator's extra sites are recycled instead of hitting the plan limit |
| Document input | Update bodies ≤ 200 updates / 256 KB, base64-checked and decoded by Yrs before they are appended (garbage is a 422, never a corrupt document) |
| Published content | Validated server-side on publish (pydantic mirror): plain text only, length limits, links only `#`, `http(s)://`, `mailto:`, `tel:`; images only template photos, Pagecraft media or the Blob store; alt text required |
| Uploads | ≤ 5 MB, sniffed by Pillow (never the filename or Content-Type), JPEG/PNG/WebP only, decompression-bomb cap, resized ≤ 2000 px and re-encoded (EXIF/GPS stripped) |
| Revalidate hook | Secret-checked with a constant-time compare; tags whitelisted to `site:{slug}` |
| Headers | One CSP for the web origin: no remote scripts/styles/fonts/frames, `frame-ancestors 'none'`, `img-src` limited to self + the Blob store; nosniff, Referrer-Policy, X-Frame-Options DENY, Permissions-Policy; the API adds nosniff + a request id |
| JSON-LD | Escaped `<`, `>`, `&` so content can't close the script tag |
| Errors | One envelope `{ error: { code, message, details } }`; unhandled errors log server-side and return a generic 500 |

Known gaps (by plan, not oversight): no rate limiting on sign-in in v1; forgot-password arrives with email in v2; the demo site's content can be changed by any visitor (re-run the `db` workflow with `reset` to restore it).

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
