"""pycrdt (Python bindings to Yrs, Yjs's Rust port): build, merge, compact and export site
documents (04 §2, §4). Serverless-safe: a `Doc` lives only for the length of one call.

The document is two root types, the same names `web/src/lib/doc/model.ts` uses:

- `site`     — `Y.Map`: `name` (Y.Text), `theme` (Y.Map of plain values), `seo` (Y.Map).
- `sections` — `Y.Array` of `Y.Map { id, type, variant, props: Y.Map }`.

The JSON → Yjs rule is shared with the browser: objects become `Y.Map`, arrays `Y.Array`,
strings `Y.Text` (character-level merge for anything a person types) — except the keys in
`ATOMIC_KEYS`, whose strings stay plain values (last-writer-wins is right for "variant = split"
or a URL). Exporting is the inverse: `Y.Text` → `str`.
"""

from collections.abc import Callable, Iterable, Sequence
from typing import Any

from pycrdt import Array, Doc, Map, Text, merge_updates

ATOMIC_KEYS = frozenset(
    {
        "id",
        "type",
        "variant",
        "url",
        "href",
        "icon",
        "tone",
        "anchor",
        "palette",
        "fonts",
        "radius",
        "og_image",
    }
)

SITE = "site"
SECTIONS = "sections"


def to_y(value: Any, key: str | None = None) -> Any:
    """A plain JSON value → its prelim Yjs form (see the module docstring)."""
    if isinstance(value, dict):
        return Map({k: to_y(v, k) for k, v in value.items()})
    if isinstance(value, list):
        return Array([to_y(v) for v in value])
    if isinstance(value, str):
        return value if key in ATOMIC_KEYS else Text(value)
    return value  # bool / number / None


def roots(doc: Doc) -> tuple[Map, Array]:
    return doc.get(SITE, type=Map), doc.get(SECTIONS, type=Array)


def build_doc(content: dict[str, Any]) -> Doc:
    """A fresh document holding `content` (templates, seed, tests)."""
    doc = Doc()
    site, sections = roots(doc)
    with doc.transaction():
        for key, value in content["site"].items():
            site[key] = to_y(value, key)
        for section in content["sections"]:
            sections.append(to_y(section))
    return doc


def build_update(content: dict[str, Any]) -> bytes:
    return build_doc(content).get_update()


def load(snapshot: bytes | None, updates: Iterable[bytes] = ()) -> Doc:
    doc = Doc()
    roots(doc)  # declare the root types before integrating, so they decode as Map / Array
    if snapshot:
        doc.apply_update(snapshot)
    for update in updates:
        doc.apply_update(update)
    return doc


def export(doc: Doc) -> dict[str, Any]:
    """The document as plain JSON — what a publication stores and the renderer reads."""
    site, sections = roots(doc)
    return {"site": site.to_py() or {}, "sections": sections.to_py() or []}


def compact(snapshot: bytes | None, updates: Sequence[bytes]) -> bytes:
    """Snapshot + tail → one update equivalent to all of them (04 §4)."""
    return load(snapshot, updates).get_update()


def merge(updates: Sequence[bytes]) -> bytes:
    return merge_updates(*updates) if len(updates) > 1 else updates[0]


def is_valid_update(update: bytes) -> bool:
    """A cheap sanity check before an update is appended to the log: Yrs must decode it.
    (Missing dependencies are fine — they wait in the pending set — garbage is not.)"""
    try:
        Doc().apply_update(update)
    except Exception:
        return False
    return True


def server_edit(
    snapshot: bytes | None, updates: Sequence[bytes], edit: Callable[[Map, Array], None]
) -> bytes | None:
    """Apply an edit on the server (rename, SEO defaults from settings) as a normal Yjs update,
    so it merges with whatever the browser holds. Returns the update, or None if nothing
    changed."""
    doc = load(snapshot, updates)
    before = doc.get_state()
    site, sections = roots(doc)
    with doc.transaction():
        edit(site, sections)
    if doc.get_state() == before:
        return None
    return doc.get_update(before)


def set_text(container: Map, key: str, value: str) -> None:
    """Replace a `Y.Text` field's contents (or create it)."""
    current = container.get(key)
    if isinstance(current, Text):
        if str(current) == value:
            return
        del current[:]
        current += value
    else:
        container[key] = Text(value)
