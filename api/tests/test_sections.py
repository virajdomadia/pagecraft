"""The section contract: every seeded template validates and round-trips through a real Y.Doc;
invalid content names the section; the catalog matches the snapshot the web also checks."""

import copy
import json
from pathlib import Path

import pytest

from app.models import TEMPLATE_KEYS
from app.sections import ContentError, catalog_summary, validate_content
from app.services import crdt
from app.services.templates import load_templates

SNAPSHOT = Path(__file__).with_name("catalog.snapshot.json")
WEB_PUBLIC = Path(__file__).resolve().parents[2] / "web" / "public"


def test_six_templates_in_order() -> None:
    specs = load_templates()
    assert [s.key for s in specs] == list(TEMPLATE_KEYS)
    assert len({s.showcase_slug for s in specs}) == 6


@pytest.mark.parametrize("spec", load_templates(), ids=lambda s: s.key)
def test_template_is_a_real_crdt_snapshot(spec) -> None:  # type: ignore[no-untyped-def]
    doc = crdt.load(spec.snapshot())
    assert crdt.export(doc) == spec.content
    assert validate_content(crdt.export(doc))["site"]["name"] == spec.content["site"]["name"]


@pytest.mark.parametrize("spec", load_templates(), ids=lambda s: s.key)
def test_template_images_exist(spec) -> None:  # type: ignore[no-untyped-def]
    text = json.dumps(spec.content)
    urls = {u for u in _strings(spec.content) if u.startswith("/templates/")}
    assert urls, "every template ships photos"
    for url in urls:
        assert (WEB_PUBLIC / url.lstrip("/")).is_file(), url
    assert "lorem" not in text.lower()


def _strings(value):  # type: ignore[no-untyped-def]
    if isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)
    elif isinstance(value, str):
        yield value


def _cafe() -> dict:
    return copy.deepcopy(load_templates()[0].content)


def test_invalid_variant_names_the_section() -> None:
    content = _cafe()
    content["sections"][1]["variant"] = "diagonal"
    with pytest.raises(ContentError) as info:
        validate_content(content)
    assert info.value.section_id == "s_hero01"
    assert "diagonal" in info.value.message


def test_too_long_headline_names_the_section_and_field() -> None:
    content = _cafe()
    content["sections"][1]["props"]["headline"] = "x" * 91
    with pytest.raises(ContentError) as info:
        validate_content(content)
    assert info.value.section_id == "s_hero01"
    assert info.value.field == "headline"


@pytest.mark.parametrize(
    "href",
    ["javascript:alert(1)", "data:text/html,hi", "ftp://x", "//evil.example"],
)
def test_unsafe_links_are_rejected(href: str) -> None:
    content = _cafe()
    content["sections"][1]["props"]["cta"]["href"] = href
    with pytest.raises(ContentError):
        validate_content(content)


def test_foreign_images_and_missing_alt_are_rejected() -> None:
    content = _cafe()
    content["sections"][1]["props"]["image"]["url"] = "https://evil.example/x.jpg"
    with pytest.raises(ContentError):
        validate_content(content)
    content = _cafe()
    content["sections"][1]["props"]["image"]["alt"] = " "
    with pytest.raises(ContentError) as info:
        validate_content(content)
    assert "alt" in info.value.message


def test_unknown_props_and_too_many_sections_are_rejected() -> None:
    content = _cafe()
    content["sections"][1]["props"]["html"] = "<script>"
    with pytest.raises(ContentError):
        validate_content(content)
    content = _cafe()
    content["sections"] = [dict(content["sections"][6], id=f"s_{i}") for i in range(31)]
    with pytest.raises(ContentError):
        validate_content(content)


def test_duplicate_section_ids_are_rejected() -> None:
    content = _cafe()
    content["sections"][2]["id"] = "s_hero01"
    with pytest.raises(ContentError) as info:
        validate_content(content)
    assert info.value.section_id == "s_hero01"


def test_catalog_matches_snapshot() -> None:
    """If this fails after an intentional change, regenerate the snapshot with
    `uv run python -m tests.write_catalog` and update web/src/sections to match."""
    assert catalog_summary() == json.loads(SNAPSHOT.read_text(encoding="utf-8"))
