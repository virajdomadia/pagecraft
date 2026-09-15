# Pagecraft — UI Mockups

**Lifecycle step:** 4 of 17 (UX companion to the technical design) · **Brief locked:** 2026-09-16 · **Variants:** built 2026-09-16 — `mockups/direction-variants.html`, published at https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo · **Chosen:** — (pending Viraj's letter)
**Pairs with:** [03-user-flows.md](03-user-flows.md) — one mockup per v1 screen (S1–S11) after the direction is chosen.
**Files:** `mockups/landing.html` (exists, already ported to `web/`) → `mockups/direction-variants.html` (S5 editor with the café site on the canvas + S9 the published café on a 390 px phone, four directions) → `mockups/screens.html` (every v1 screen in the chosen direction).
**Published:** [Direction variants](https://claude.ai/artifact/EiUg98AJqi2ZH5UnR71CJo) · screens and tracker added when built.

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

Recommendation: **A + D** for v1 (both are editor moments a reviewer sees in the first minute), C when v2 lands, B if hours remain.

## Variant page (`mockups/direction-variants.html`) — round 1, built
Four full-size directions of S5 (the editor at 1280 px, scaled to fit, with the *Kaapi Corner* doc loaded, the hero selected, inspector + theme panel open) and S9 on a 390 px phone, behind an A/B/C/D tab strip (keys 1–4). The café site is one container-query template reused by every canvas and phone; only the chrome changes. Each direction demonstrates one motion candidate live:

| Direction | Chrome | Canvas | Idea |
|---|---|---|---|
| **A · Studio** | Dark ink chrome (`#1B1B2F`), light text, indigo accents — Figma-like | The site sits on a mid-grey desk with a soft shadow | The tool recedes; the site is the bright object. **Demonstrates C · Comet cursors:** Ananya's cursor trails, her selected section breathes, her caret types into the eyebrow |
| **B · Paper desk** | Warm off-white chrome, hairline borders, ink buttons | Site on a cream desk with the faint brand grid | Calm, print-like; the editor feels like a layout table. **Demonstrates B · Press:** Publish lifts the page, stamps LIVE, slides it out, success card rises |
| **C · Blueprint** | White chrome with the brand grid everywhere, indigo dashed guides, monospace labels + section ids | Site drawn on grid paper; selection = indigo dashed, corner marks | Engineering drawing. **Demonstrates A · Blueprint draw-in:** + Add section traces a CTA band as a wireframe, then fills it |
| **D · Glass** | Translucent panels over a soft indigo→mint wash, blurred | Site floats on the wash with a coloured shadow | Modern-app look; loudest. **Demonstrates D · Theme ripple:** palette swatches send a clip-path wave across the canvas; font pairs cross-fade |

Each variant carries the same tokens for the *published site* (the café's own theme: cream `#F7F1E8`, coffee ink `#2B1B12`, leaf green `#2F5D45`, Fraunces + Inter, radius 14), so only the chrome changes between tabs. Photos: `mockups/img/` (credits in `CREDITS.md`). `prefers-reduced-motion` respected in all four.

## Chosen direction — pending
Tokens, motion spec and browser surfaces are recorded here once Viraj picks a letter.

## Screens (`mockups/screens.html`) — to build after the direction is chosen
S1 landing (demo logins), S2 sign in/up, S3 dashboard, S4 template picker, S5 editor (desktop; phone = read-only preview), S6 section library, S7 inspector + theme, S8 publish dialog (+ success), S9 published site (café + salon, desktop + phone), S10 settings, S11 not published.
