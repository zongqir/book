#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import export_site_content as site_export

ROOT = Path(__file__).resolve().parents[1]
LIBRARY_ROOT = ROOT / "site" / "content" / "library"
OUTPUT_DIR = ROOT / "site" / "static" / "data"
OUTPUT_PATH = OUTPUT_DIR / "site-page-content.json"


def main() -> None:
    bundle = build_bundle()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {OUTPUT_PATH.relative_to(ROOT)} with {len(bundle['pages'])} page bodies.")


def build_bundle() -> dict[str, Any]:
    pages: dict[str, dict[str, str]] = {}
    generated_at = ""

    for book in site_export.collect_book_dirs():
        for page in site_export.collect_book_pages(book):
            file_path = resolve_page_file(book.path, page["slot"])
            body = site_export.read_body(file_path)
            key = make_page_content_key(page["id"])
            pages[key] = {
                "page_id": page["id"],
                "book_id": page["book_id"],
                "slot": page["slot"],
                "updated_at": page["updated_at"],
                "markdown": body,
            }
            generated_at = max(generated_at, str(page["updated_at"] or ""))

    return {
        "schema_version": 2,
        "generated_at": generated_at,
        "pages": pages,
    }


def make_page_content_key(page_id: str) -> str:
    return page_id


def resolve_page_file(book_dir: Path, slot: str) -> Path:
    matches = sorted(
        path
        for path in book_dir.glob("*.md")
        if path.name != "_index.md"
        and not path.name.endswith(".QA.md")
        and site_export.extract_slot(path.name) == slot
    )
    if not matches:
        raise FileNotFoundError(
            f"Missing markdown file for {book_dir.relative_to(LIBRARY_ROOT)} / {slot}"
        )
    return matches[0]


if __name__ == "__main__":
    main()
