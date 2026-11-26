"""Regenerate `tests/catalog.snapshot.json` from `app/sections.py`:

    uv run python -m tests.write_catalog

The web registry checks itself against the same file (web/src/sections/catalog.test.ts).
"""

import json
from pathlib import Path

from app.sections import catalog_summary

if __name__ == "__main__":
    path = Path(__file__).with_name("catalog.snapshot.json")
    path.write_text(json.dumps(catalog_summary(), indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path}")
