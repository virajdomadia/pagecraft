"""04 §12: `test_text_converges` and `test_compaction_equivalent`, plus the JSON ↔ Yjs rule."""

from pycrdt import Array, Doc, Map, Text

from app.services import crdt

CONTENT = {
    "site": {
        "name": "Kaapi Corner",
        "theme": {"palette": "espresso", "fonts": "fraunces-inter", "radius": "soft"},
        "seo": {"title": "Kaapi Corner", "description": "Filter coffee", "og_image": ""},
    },
    "sections": [
        {
            "id": "s_hero",
            "type": "hero",
            "variant": "split",
            "props": {
                "headline": "Filter coffee, done properly.",
                "image": {"url": "/templates/cafe/hero.jpg", "alt": "A steel tumbler"},
                "cta": {"label": "See the menu", "href": "#menu"},
            },
        }
    ],
}


def _headline(doc: Doc) -> Text:
    _, sections = crdt.roots(doc)
    return sections[0]["props"]["headline"]


def test_text_converges() -> None:
    """Two docs insert at the same offset of one `Text`; exchanging updates in either order
    gives identical strings with both insertions present."""
    base = crdt.build_update(CONTENT)
    a, b = crdt.load(base), crdt.load(base)

    before_a, before_b = a.get_state(), b.get_state()
    _headline(a).insert(7, "BRASS ")
    _headline(b).insert(7, "steel ")
    ua, ub = a.get_update(before_a), b.get_update(before_b)

    a.apply_update(ub)
    b.apply_update(ua)
    assert str(_headline(a)) == str(_headline(b))
    assert "BRASS " in str(_headline(a)) and "steel " in str(_headline(a))

    # The same two updates applied to a third replica in the other order agree too.
    c = crdt.load(base)
    c.apply_update(ub)
    c.apply_update(ua)
    assert str(_headline(c)) == str(_headline(a))


def test_compaction_equivalent() -> None:
    """Snapshot + 60 updates → compact → export equals applying everything to an empty doc."""
    snapshot = crdt.build_update(CONTENT)
    doc = crdt.load(snapshot)
    updates: list[bytes] = []
    for i in range(60):
        before = doc.get_state()
        _, sections = crdt.roots(doc)
        if i % 3 == 0:
            _headline(doc).insert(0, f"{i}")
        elif i % 3 == 1:
            sections.append(
                crdt.to_y(
                    {
                        "id": f"s_{i}",
                        "type": "cta",
                        "variant": "band",
                        "props": {"heading": f"CTA {i}"},
                    }
                )
            )
        else:
            del sections[len(sections) - 1]
        updates.append(doc.get_update(before))

    compacted = crdt.compact(snapshot, updates)
    replay = crdt.load(None, [snapshot, *updates])
    assert crdt.export(crdt.load(compacted)) == crdt.export(replay)
    assert crdt.export(crdt.load(compacted)) == crdt.export(doc)


def test_json_round_trip_and_atomic_keys() -> None:
    doc = crdt.build_doc(CONTENT)
    assert crdt.export(doc) == CONTENT
    site, sections = crdt.roots(doc)
    assert isinstance(site["seo"]["title"], Text)  # typed by people → character merge
    assert site["theme"]["palette"] == "espresso"  # an enum → plain value
    section = sections[0]
    assert isinstance(section, Map) and section["variant"] == "split"
    assert isinstance(section["props"]["image"]["alt"], Text)
    assert section["props"]["image"]["url"] == "/templates/cafe/hero.jpg"
    assert isinstance(sections, Array)


def test_server_edit_merges_with_a_concurrent_client_edit() -> None:
    snapshot = crdt.build_update(CONTENT)
    client = crdt.load(snapshot)
    before = client.get_state()
    _headline(client).insert(0, "Hot ")
    client_update = client.get_update(before)

    def rename(site: Map, _: Array) -> None:
        crdt.set_text(site, "name", "Kaapi Corner Indiranagar")

    server_update = crdt.server_edit(snapshot, [], rename)
    assert server_update is not None
    merged = crdt.export(crdt.load(snapshot, [client_update, server_update]))
    assert merged["site"]["name"] == "Kaapi Corner Indiranagar"
    assert merged["sections"][0]["props"]["headline"].startswith("Hot ")
    assert crdt.server_edit(snapshot, [server_update], rename) is None  # no-op → no update


def test_invalid_update_is_rejected() -> None:
    assert crdt.is_valid_update(crdt.build_update(CONTENT))
    assert not crdt.is_valid_update(b"\xff\x00garbage")
