"""The six seeded templates (R7): `seed/templates/*.json` → real Yjs snapshots built with pycrdt.

Each JSON file is `{ meta, content }`; `content` is exactly the shape a publication stores,
validated against the section contract before it is turned into a document, so a template that
would not publish never reaches the database.
"""

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path
from typing import Any

from app.sections import validate_content
from app.services import crdt

TEMPLATES_DIR = Path(__file__).resolve().parents[1] / "seed" / "templates"


@dataclass(frozen=True)
class TemplateSpec:
    key: str
    name: str
    business: str
    description: str
    sort: int
    showcase_slug: str
    content: dict[str, Any]

    def snapshot(self) -> bytes:
        return crdt.build_update(self.content)


@cache
def load_templates() -> tuple[TemplateSpec, ...]:
    specs: list[TemplateSpec] = []
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        raw = json.loads(path.read_text(encoding="utf-8"))
        meta, content = raw["meta"], raw["content"]
        validate_content(content)  # raises ContentError naming the section
        specs.append(
            TemplateSpec(
                key=meta["key"],
                name=meta["name"],
                business=meta["business"],
                description=meta["description"],
                sort=int(meta["sort"]),
                showcase_slug=meta["showcase_slug"],
                content=content,
            )
        )
    return tuple(sorted(specs, key=lambda s: s.sort))


def template(key: str) -> TemplateSpec:
    for spec in load_templates():
        if spec.key == key:
            return spec
    raise KeyError(key)
