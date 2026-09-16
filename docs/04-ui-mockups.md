# Pagecraft — UI Mockups

**Lifecycle step:** 4 of 17 (UX companion to the technical design) · **Brief locked:** 2026-09-16 · **Variants:** built 2026-09-16 — `mockups/direction-variants.html`, published at https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo · **Chosen: C · Blueprint** (Viraj, 2026-09-17)
**Pairs with:** [03-user-flows.md](03-user-flows.md) — one mockup per v1 screen (S1–S11) after the direction is chosen.
**Files:** `mockups/landing.html` (exists, already ported to `web/`) → `mockups/direction-variants.html` (S5 editor with the café site on the canvas + S9 the published café on a 390 px phone, four directions) → `mockups/screens.html` (every v1 screen in the chosen direction).
**Published:** [Direction variants](https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo) · [Screens](https://claude.ai/artifact/UKnMgDx9dvkEmFUrxWSLjS) · [Tracker](https://claude.ai/artifact/AxW5iwEzxWmtSdLdfnjQfB) (Plan rows with status, all docs, mockups, project facts).

## Brief
**Style:** the existing landing sets the brand — Manrope, ink `#1B1B2F`, indigo `#4338CA` for actions, coral `#FF6B6B` and mint `#2EC4B6` as accents, a faint grid `#E7E5F0` on white. Keep it for the *product chrome*. The variants explore the one question that matters for a builder: **how does the editor chrome relate to the canvas** — and, since the canvas shows the *user's* site in the *user's* theme, the chrome has to recede while still feeling crafted.

**The editor is the product.** Three panes at 1280+: layers (left, 240 px), canvas (centre, fluid, the real site at the toggled width), inspector (right, 300 px). The canvas must read as "a website, being edited" at a glance: selection outline + label, hover hint, inline caret. Published sites are the *output* — they use the user's palette and font pair, not Pagecraft's, and must look like a real café site a customer would trust (photo hero, menu highlights, hours, map/contact, reviews).

**Real content:** the *Kaapi Corner* café doc (hero, features, gallery, testimonials, contact, footer) with CC photos of filter coffee, a café interior, a barista — Wikimedia Commons, credits in `mockups/img/CREDITS.md`.

## Motion signature — pick one in the variant page
| Candidate | What happens | Reduced-motion fallback |
|---|---|---|
| **A · Blueprint** | Adding a section draws it in as a wireframe (SVG strokes trace the layout boxes, 500 ms) and then the real content fades into the boxes. Reordering slides neighbours with the same line-trace. | Section fades in, 150 ms |
| **B · Press** | Publish: the canvas lifts, a "LIVE" stamp hits (scale 1.4 → 1 with a 2° tilt), and the page slides out of the frame like a print, revealing the success card with the URL. | Cross-fade to the success card |
| **C · Comet cursors** (v2) | Collaborator cursors leave a short colour trail as they move; their selected section gets a breathing coloured outline; their caret pulses once when they start typing. | Static cursor + outline |
| **D · Theme ripple** | Picking a palette swatch sends a circular ripple from the swatch across the canvas; sections recolour as the wave passes (`clip-path: circle()` transition, 700 ms). Font pairs cross-fade. | Instant recolour |

Recommendation was A + D; **Viraj chose direction C (2026-09-17)**, whose moment is A · Blueprint draw-in. Signature = **the page is drawn before it is built**: every new section traces itself as a wireframe and fills; D's theme ripple stays as the v1 theme-panel touch; C's comet cursors arrive with v2; B's press is dropped (publish gets a plain success card).

## Variant page (`mockups/direction-variants.html`) — round 1, built
Four full-size directions of S5 (the editor at 1280 px, scaled to fit, with the *Kaapi Corner* doc loaded, the hero selected, inspector + theme panel open) and S9 on a 390 px phone, behind an A/B/C/D tab strip (keys 1–4). The café site is one container-query template reused by every canvas and phone; only the chrome changes. Each direction demonstrates one motion candidate live:

| Direction | Chrome | Canvas | Idea |
|---|---|---|---|
| **A · Studio** | Dark ink chrome (`#1B1B2F`), light text, indigo accents — Figma-like | The site sits on a mid-grey desk with a soft shadow | The tool recedes; the site is the bright object. **Demonstrates C · Comet cursors:** Ananya's cursor trails, her selected section breathes, her caret types into the eyebrow |
| **B · Paper desk** | Warm off-white chrome, hairline borders, ink buttons | Site on a cream desk with the faint brand grid | Calm, print-like; the editor feels like a layout table. **Demonstrates B · Press:** Publish lifts the page, stamps LIVE, slides it out, success card rises |
| **C · Blueprint** | White chrome with the brand grid everywhere, indigo dashed guides, monospace labels + section ids | Site drawn on grid paper; selection = indigo dashed, corner marks | Engineering drawing. **Demonstrates A · Blueprint draw-in:** + Add section traces a CTA band as a wireframe, then fills it |
| **D · Glass** | Translucent panels over a soft indigo→mint wash, blurred | Site floats on the wash with a coloured shadow | Modern-app look; loudest. **Demonstrates D · Theme ripple:** palette swatches send a clip-path wave across the canvas; font pairs cross-fade |

Each variant carries the same tokens for the *published site* (the café's own theme: cream `#F7F1E8`, coffee ink `#2B1B12`, leaf green `#2F5D45`, Fraunces + Inter, radius 14), so only the chrome changes between tabs. Photos: `mockups/img/` (credits in `CREDITS.md`). `prefers-reduced-motion` respected in all four.

## Chosen direction — C · Blueprint (locked 2026-09-17)
**Idea:** the editor is an engineering drawing of a website. White chrome on the brand grid (12 px minor, 96 px major), indigo dashed guides and corner marks around the sheet, monospace labels that show section ids — the tool says "precise instrument", while the canvas shows the user's site in the user's own theme. Published sites carry none of the chrome.

### Tokens (→ `web/src/app/globals.css`)
| Token | Value | Use |
|---|---|---|
| `--paper` / `--desk` | `#FFFFFF` / `#F7F7FC` | panels, cards / the canvas desk and app background |
| `--grid` / `--grid-major` | `#E7E5F0` / `#DCDAE8` | 12 px and 96 px grid lines (desk, landing hero, empty states) |
| `--ink` / `--ink-2` / `--muted` | `#1B1B2F` / `#4A4A66` / `#6E6E8C` | text / secondary / labels (≥ 4.5:1 on paper) |
| `--line` | `#DCDAE8` | hairline borders, field borders |
| `--guide` / `--guide-soft` | `#4338CA` / `#EEF0FF` | primary action, selection, dashed guides / selected row, hover fills |
| `--coral` | `#FF6B6B` | destructive, attention (delete, unpublish, errors); collaborator colours in v2 start here |
| `--mint` | `#2EC4B6` | saved / published state, focus ring |
| radii | fields 3 px · buttons 3 px · cards 4 px · phone 38 px | deliberately square — it is a drawing |
| type | **Manrope** 500/600/700/800 for headings, buttons, body · **JetBrains Mono** 400/500 for section ids, field labels, status pill, slugs, URLs | `next/font/google`, `display: swap` |
| grid chrome | panels 236 / fluid / 300 px at ≥ 1280; ≥ 1024 collapses the inspector to a drawer; < 1024 = preview only | |

### Motion (all with `prefers-reduced-motion` fallbacks)
| Moment | Spec | Reduced |
|---|---|---|
| **Section draw-in (signature)** | new section mounts with an SVG overlay of its layout boxes: `stroke-dashoffset` 1 → 0, 550 ms ease-out, stagger 60 ms per box, tiny mono labels (`h2`, `button`, `img`); content fades in at 550 ms over 450 ms; lines fade 400 ms after | 150 ms fade |
| Reorder | neighbours slide 220 ms with the same trace on the moved section | instant |
| Select | dashed outline 2 px + id label snaps in (no animation); hover = 1 px solid at 55 % | — |
| Theme change | clip-path circle from the swatch, 750 ms cubic-bezier(.2,.7,.2,1); font pair cross-fade 250 ms | instant |
| Autosave pill | *Saving…* → *Saved* with the mint dot scaling 1.4 → 1, 180 ms | — |
| Publish | dialog → success card rises 12 px / 300 ms; URL row highlights once | instant |
| Template picker | preview cross-fades 200 ms; hovering a template card traces its outline | — |
| v2 cursors | comet trail (8 px dots, 700 ms fade), breathing outline on the peer's section, labelled caret | static |

### Browser surfaces
`::selection` guide-soft with ink · scrollbar: desk track, line thumb, 8 px · focus ring mint 3 px offset 2 px · `caret-color` guide · `theme-color` white · favicon = brand mark. Published sites: the user's theme decides these (accent selection, accent caret).

## Screens (`mockups/screens.html`) — built 2026-09-17
Every v1 screen from the screen index in direction C: S1 landing (demo logins), S2 sign in/up, S3 dashboard, S4 template picker with live preview, S5 editor (desktop with the draw-in live; phone = read-only preview), S6 section library, S7 inspector + theme (1:1), S8 publish dialog + success, S9 published sites (Kaapi Corner café and Nimbus product launch, desktop + phone), S10 settings, S11 not published. Published at https://claude.ai/artifact/UKnMgDx9dvkEmFUrxWSLjS. **Step 4 complete.** v4 screens (S16 Domain, S17 Export, S18 Import) are settings tabs and a dashboard dialog in the same chrome — mocked when v4 starts, not before.
