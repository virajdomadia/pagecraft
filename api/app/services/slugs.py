"""Site addresses (R2, R5): `kaapi-corner` → `/s/kaapi-corner` and
`kaapi-corner.pagecraft.virajdomadia.com`. Unique platform-wide; a few words are reserved
because they are hosts or routes of Pagecraft itself."""

import re
import unicodedata
from collections.abc import Awaitable, Callable

SLUG_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$")
RESERVED = frozenset(
    {
        "www",
        "api",
        "app",
        "admin",
        "s",
        "sites",
        "sign-in",
        "sign-up",
        "docs",
        "static",
        "assets",
        "media",
        "help",
        "mail",
        "blog",
        "status",
        "pagecraft",
        "dashboard",
        "templates",
    }
)


def slugify(text: str) -> str:
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)[:40].strip("-")
    return slug if len(slug) >= 3 else (slug + "-site").strip("-")


def problem(slug: str) -> tuple[str, str] | None:
    """None when the slug is well-formed and free to use; else `(code, message)`."""
    if slug in RESERVED:
        return "reserved_slug", f"“{slug}” is reserved — pick another address"
    if not SLUG_RE.match(slug):
        return (
            "invalid_slug",
            "Use 3–40 lower-case letters, digits and dashes (no dash at either end)",
        )
    return None


async def suggest(slug: str, is_taken: Callable[[str], Awaitable[bool]]) -> str:
    """`kaapi-corner` → `kaapi-corner-2`, `-3`, … — the first one free."""
    base = re.sub(r"-\d+$", "", slug)[:36].strip("-") or "site"
    for n in range(2, 200):
        candidate = f"{base}-{n}"
        if candidate not in RESERVED and not await is_taken(candidate):
            return candidate
    raise RuntimeError("no free slug")
