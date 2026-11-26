"""Template photos from Wikimedia Commons, licence-checked, into `web/public/templates/`
with a credit row appended to `web/public/templates/CREDITS.md` (07 S2).

    uv run python scripts/fetch_photo.py search "barber shop interior"
    uv run python scripts/fetch_photo.py get "File:Some photo.jpg" salon/hero.jpg [--width 1400]

`search` lists candidates (licence, size) so a person picks; `get` refuses anything that is
not CC BY / CC BY-SA / CC0 / public domain, or narrower than the rendition it saves. Photos are
re-encoded by Pillow (progressive JPEG, q 78) at the width the templates need — heroes 1600,
everything else 1000 — so published pages stay light.
"""

import argparse
import html
import io
import re
import sys
from pathlib import Path
from typing import Any

import httpx
from PIL import Image

PHOTOS_DIR = Path(__file__).resolve().parents[2] / "web" / "public" / "templates"
CREDITS = PHOTOS_DIR / "CREDITS.md"
API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "TemplatePhotoFetcher/1.0 (+https://meta.wikimedia.org/wiki/User-Agent_policy) httpx"
ALLOWED = re.compile(r"^(cc-by(-sa)?-\d\.\d|cc0|pd)", re.I)
_TAGS = re.compile(r"<[^>]+>")


def _get(params: dict[str, str]) -> dict[str, Any]:
    res = httpx.get(
        API,
        params={"format": "json", **params},
        headers={"User-Agent": USER_AGENT},
        timeout=30,
        follow_redirects=True,
    )
    res.raise_for_status()
    return res.json()


def search(query: str, limit: int = 12) -> None:
    body = _get(
        {
            "action": "query",
            "generator": "search",
            "gsrnamespace": "6",
            "gsrsearch": f"filetype:bitmap {query}",
            "gsrlimit": str(limit),
            "prop": "imageinfo",
            "iiprop": "size|extmetadata",
        }
    )
    for page in (body.get("query") or {}).get("pages", {}).values():
        info = (page.get("imageinfo") or [{}])[0]
        lic = info.get("extmetadata", {}).get("License", {}).get("value", "?")
        ok = "ok " if ALLOWED.match(lic) else "-- "
        print(f"{ok}{info.get('width')}x{info.get('height')}  {lic:12}  {page['title']}")


def lookup(title: str, width: int) -> dict[str, Any]:
    body = _get(
        {
            "action": "query",
            "titles": title,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": str(width),
        }
    )
    page = next(iter(body["query"]["pages"].values()))
    info = (page.get("imageinfo") or [None])[0]
    if info is None:
        raise SystemExit(f"not found on Commons: {title}")
    return info


def check(info: dict[str, Any], title: str, width: int) -> tuple[str, str]:
    meta = info["extmetadata"]
    licence_id = meta.get("License", {}).get("value", "")
    licence = meta.get("LicenseShortName", {}).get("value", licence_id)
    if not ALLOWED.match(licence_id):
        raise SystemExit(f"licence not allowed for {title}: {licence} ({licence_id!r})")
    if info["width"] < width:
        raise SystemExit(f"too small: {title} is {info['width']} px wide (need >= {width})")
    artist = html.unescape(_TAGS.sub("", meta.get("Artist", {}).get("value", ""))).strip()
    return licence, " ".join(artist.split()) or "see source"


def save(info: dict[str, Any], dest: Path, width: int) -> None:
    data = httpx.get(
        info["thumburl"], headers={"User-Agent": USER_AGENT}, timeout=60, follow_redirects=True
    ).content
    with Image.open(io.BytesIO(data)) as im:
        rgb = im.convert("RGB")
        rgb.thumbnail((width, width * 2))
        dest.parent.mkdir(parents=True, exist_ok=True)
        rgb.save(dest, "JPEG", quality=78, optimize=True, progressive=True)


def credit(dest_rel: str, title: str, licence: str, artist: str, source: str) -> None:
    if not CREDITS.exists():
        CREDITS.write_text(
            "# Template photo credits\n\n"
            "Every photo under `web/public/templates/` is from Wikimedia Commons under the licence "
            "below. The businesses in the templates are fictional; these photos stand in for "
            "their own imagery.\n\n"
            "| File | Title | Licence | Author | Link |\n|---|---|---|---|---|\n",
            encoding="utf-8",
        )
    row = (
        f"| `{dest_rel}` | {title.removeprefix('File:')} | {licence} | {artist} "
        f"| [source]({source}) |\n"
    )
    with CREDITS.open("a", encoding="utf-8") as f:
        f.write(row)


def get(title: str, dest_arg: str, width: int) -> None:
    title = title if title.startswith("File:") else f"File:{title}"
    rel = Path(dest_arg)
    if rel.is_absolute() or ".." in rel.parts or len(rel.parts) != 2 or rel.suffix != ".jpg":
        raise SystemExit(f"dest must be <template>/<name>.jpg, got {dest_arg}")
    dest = PHOTOS_DIR / rel
    if dest.exists():
        raise SystemExit(f"{rel.as_posix()} already exists")
    info = lookup(title, width)
    licence, artist = check(info, title, width)
    save(info, dest, width)
    credit(rel.as_posix(), title, licence, artist, info["descriptionurl"])
    print(f"{rel.as_posix()}  {licence}  by {artist}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    sub = parser.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    g = sub.add_parser("get")
    g.add_argument("title")
    g.add_argument("dest")
    g.add_argument("--width", type=int, default=1000)
    args = parser.parse_args(argv)
    if args.cmd == "search":
        search(args.query)
    else:
        get(args.title, args.dest, args.width)
    return 0


if __name__ == "__main__":
    sys.exit(main())
