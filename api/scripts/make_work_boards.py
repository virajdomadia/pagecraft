"""The freelancer template's portfolio pieces: six brand-identity boards for fictional
Bengaluru businesses, drawn with Pillow into `web/public/templates/freelancer/` (07 S2).

    uv run python scripts/make_work_boards.py

Commons has no honest stand-in for "a brand designer's own work" (real studios' work would be
misattributed to the fictional Meera Rao), so the template shows identities Pagecraft drew
itself — wordmark, a one-line brief and the palette as chips — in Manrope (OFL, already in
web/src/assets). Deterministic: re-running rewrites the same files.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "web" / "public" / "templates" / "freelancer"
BOLD = ROOT / "web" / "src" / "assets" / "Manrope-ExtraBold.ttf"
SEMI = ROOT / "web" / "src" / "assets" / "Manrope-SemiBold.ttf"
W, H = 1000, 750

# (file, wordmark, brief, background, ink, chips)
BOARDS = [
    (
        "kaapi.jpg",
        "kaapi corner",
        "Identity · Indiranagar café",
        "#2F5D45",
        "#F7F1E8",
        ["#F7F1E8", "#2B1B12", "#C9A66B"],
    ),
    (
        "loop.jpg",
        "LOOP/studio",
        "Identity · Koramangala salon",
        "#F3E6E1",
        "#9C3D54",
        ["#9C3D54", "#2A1D22", "#FBF5F3"],
    ),
    (
        "ironline.jpg",
        "IRONLINE",
        "Brand system · HSR gym",
        "#0F1115",
        "#D4FF3A",
        ["#D4FF3A", "#F2F3F5", "#2A2E38"],
    ),
    (
        "nimbus.jpg",
        "nimbus",
        "Packaging · pour-over kettle",
        "#E9ECF2",
        "#2346F5",
        ["#2346F5", "#111318", "#FFFFFF"],
    ),
    (
        "bistro.jpg",
        "Bistro Nine",
        "Menus + signage · Jayanagar",
        "#8E2C1D",
        "#FFF9F0",
        ["#FFF9F0", "#2A1510", "#E0B25B"],
    ),
    (
        "hasiru.jpg",
        "hasiru books",
        "Identity · children's publisher",
        "#E6EDE2",
        "#1E2A22",
        ["#3F6B52", "#1E2A22", "#F3B33D"],
    ),
]


def board(name: str, mark: str, brief: str, bg: str, ink: str, chips: list[str]) -> None:
    img = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(img)
    size = 132
    font = ImageFont.truetype(str(BOLD), size)
    while d.textlength(mark, font=font) > W - 160:
        size -= 6
        font = ImageFont.truetype(str(BOLD), size)
    tw = d.textlength(mark, font=font)
    d.text(((W - tw) / 2, H / 2 - size * 0.75), mark, font=font, fill=ink)
    small = ImageFont.truetype(str(SEMI), 26)
    d.text((64, 56), brief.upper(), font=small, fill=ink)
    d.line((64, 100, 64 + 60, 100), fill=ink, width=3)
    for i, chip in enumerate(chips):
        x = 64 + i * 84
        d.rounded_rectangle((x, H - 128, x + 64, H - 64), radius=8, fill=chip, outline=ink, width=2)
    tag = ImageFont.truetype(str(SEMI), 22)
    label = "Meera Rao Studio · 2026"
    d.text((W - 64 - d.textlength(label, font=tag), H - 92), label, font=tag, fill=ink)
    OUT.mkdir(parents=True, exist_ok=True)
    img.save(OUT / name, "JPEG", quality=86, optimize=True, progressive=True)


def main() -> None:
    for spec in BOARDS:
        board(*spec)
        print(f"freelancer/{spec[0]}")


if __name__ == "__main__":
    main()
