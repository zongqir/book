#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import timedelta, timezone
from pathlib import Path
from typing import Any

import yaml


ROOT = Path(__file__).resolve().parents[1]
LIBRARY_ROOT = ROOT / "site" / "content" / "library"
OUTPUT_DIR = ROOT / "site" / "static" / "data"
OUTPUT_PATH = OUTPUT_DIR / "site-content.json"
BUILD_TIMEZONE = timezone(timedelta(hours=8))

FRONTMATTER_PATTERN = re.compile(r"^---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+(.+?)\s*$", re.MULTILINE)
SENTENCE_PATTERN = re.compile(r'\{\{<\s*sentence\b[^>]*quote="([^"]+)"[^>]*>\}\}')


@dataclass(frozen=True)
class BookDir:
    path: Path
    relative_dir: str
    section_key: str
    section_title: str
    book_title: str


def main() -> None:
    bundle = build_bundle()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(bundle, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(
        f"Generated {OUTPUT_PATH.relative_to(ROOT)} "
        f"with {len(bundle['sections'])} sections, "
        f"{len(bundle['books'])} books, {len(bundle['pages'])} pages."
    )


def build_bundle() -> dict[str, Any]:
    books = collect_book_dirs()
    section_lookup = collect_section_lookup()

    pages: list[dict[str, Any]] = []
    books_payload: list[dict[str, Any]] = []
    section_counts: dict[str, dict[str, int]] = {
        key: {"book_count": 0, "page_count": 0} for key in section_lookup
    }

    for book in books:
        page_entries = collect_book_pages(book)
        if not page_entries:
            continue

        section_counts[book.section_key]["book_count"] += 1
        section_counts[book.section_key]["page_count"] += len(page_entries)
        pages.extend(page_entries)

        first_updated = max(
            (
                page["updated_at"]
                for page in page_entries
                if isinstance(page.get("updated_at"), str) and page["updated_at"]
            ),
            default="",
        )
        summary = read_summary(book.path / "_index.md")
        tags = read_tags(book.path / "_index.md")

        books_payload.append(
            {
                "id": book.relative_dir,
                "title": book.book_title,
                "section_key": book.section_key,
                "section_title": book.section_title,
                "summary": summary,
                "tags": tags,
                "page_count": len(page_entries),
                "updated_at": first_updated,
                "url": to_site_url(book.relative_dir),
            }
        )

    sections = []
    for key, title in section_lookup.items():
        counts = section_counts[key]
        if counts["book_count"] == 0 and counts["page_count"] == 0:
            continue
        sections.append(
            {
                "key": key,
                "title": title,
                "book_count": counts["book_count"],
                "page_count": counts["page_count"],
                "url": f"/library/{key}/",
            }
        )

    quotes = collect_quotes(pages)
    generated_at = max(
        (
            page["updated_at"]
            for page in pages
            if isinstance(page.get("updated_at"), str) and page["updated_at"]
        ),
        default="",
    )

    return {
        "schema_version": 1,
        "generated_at": generated_at,
        "counts": {
            "sections": len(sections),
            "books": len(books_payload),
            "pages": len(pages),
            "quotes": len(quotes),
        },
        "sections": sorted(sections, key=lambda item: item["key"]),
        "books": sorted(books_payload, key=lambda item: item["id"]),
        "pages": sorted(pages, key=lambda item: item["url"]),
        "quotes": quotes,
    }


def collect_section_lookup() -> dict[str, str]:
    lookup: dict[str, str] = {}
    for path in sorted(LIBRARY_ROOT.glob("*")):
        if not path.is_dir():
            continue
        if not (path / "_index.md").exists():
            continue
        frontmatter = read_frontmatter(path / "_index.md")
        lookup[path.name] = str(frontmatter.get("title") or normalize_title(path.name))
    return lookup


def collect_book_dirs() -> list[BookDir]:
    books: list[BookDir] = []
    for index_file in sorted(LIBRARY_ROOT.rglob("_index.md")):
        book_dir = index_file.parent
        if book_dir == LIBRARY_ROOT:
            continue

        relative = book_dir.relative_to(LIBRARY_ROOT)
        parts = relative.parts
        if not parts:
            continue

        section_key = parts[0]
        md_files = [
            path
            for path in book_dir.glob("*.md")
            if path.name != "_index.md" and not path.name.endswith(".QA.md")
        ]
        if not md_files:
            continue

        section_title = collect_section_lookup().get(section_key, normalize_title(section_key))
        frontmatter = read_frontmatter(index_file)
        books.append(
            BookDir(
                path=book_dir,
                relative_dir=relative.as_posix(),
                section_key=section_key,
                section_title=section_title,
                book_title=str(frontmatter.get("title") or book_dir.name),
            )
        )
    return books


def collect_book_pages(book: BookDir) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in sorted(book.path.glob("*.md")):
        if path.name == "_index.md" or path.name.endswith(".QA.md"):
            continue

        frontmatter = read_frontmatter(path)
        if frontmatter.get("visibility") == "internal":
            continue

        body = read_body(path)
        headings = extract_headings(body)
        entries.append(
            {
                "id": f"{book.relative_dir}/{path.stem}",
                "book_id": book.relative_dir,
                "book_title": str(frontmatter.get("book_title") or book.book_title),
                "section_key": book.section_key,
                "section_title": book.section_title,
                "slot": extract_slot(path.name),
                "title": str(frontmatter.get("title") or normalize_title(path.stem)),
                "summary": str(frontmatter.get("summary") or ""),
                "intent": str(frontmatter.get("intent") or ""),
                "status": str(frontmatter.get("status") or ""),
                "evidence_status": str(frontmatter.get("evidence_status") or ""),
                "updated_at": str(frontmatter.get("updated_at") or frontmatter.get("created_at") or ""),
                "tags": read_tags(book.path / "_index.md"),
                "headings": headings,
                "url": to_site_url(f"{book.relative_dir}/{path.stem}"),
            }
        )
    return entries


def collect_quotes(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    quotes: list[dict[str, Any]] = []
    for page in pages:
        file_path = LIBRARY_ROOT / f"{page['book_id']}/{Path(page['url']).name}.md"
        if not file_path.exists():
            file_path = LIBRARY_ROOT / f"{page['book_id']}/{page['slot']}_{page['title']}.md"
        # Fall back to scanning the real markdown file by slot prefix.
        if not file_path.exists():
            matching_files = sorted(
                path
                for path in (LIBRARY_ROOT / page["book_id"]).glob("*.md")
                if path.name != "_index.md" and extract_slot(path.name) == page["slot"]
            )
            if matching_files:
                file_path = matching_files[0]
        if not file_path.exists():
            continue

        body = read_body(file_path)
        for index, match in enumerate(SENTENCE_PATTERN.findall(body), start=1):
            quote = match.strip()
            if not quote:
                continue
            quotes.append(
                {
                    "id": f"{page['id']}#quote-{index}",
                    "page_id": page["id"],
                    "book_title": page["book_title"],
                    "page_title": page["title"],
                    "quote": quote,
                    "url": page["url"],
                }
            )
    return quotes


def read_frontmatter(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(text)
    if not match:
        return {}
    parsed = yaml.safe_load(match.group(1)) or {}
    return parsed if isinstance(parsed, dict) else {}


def read_body(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = FRONTMATTER_PATTERN.match(text)
    if not match:
        return text
    return text[match.end():]


def read_summary(path: Path) -> str:
    return str(read_frontmatter(path).get("summary") or "")


def read_tags(path: Path) -> list[str]:
    raw = read_frontmatter(path).get("book_tags") or []
    if not isinstance(raw, list):
        return []
    return [str(item).strip() for item in raw if str(item).strip()]


def extract_headings(body: str) -> list[dict[str, Any]]:
    headings = []
    for match in HEADING_PATTERN.finditer(body):
        level = len(match.group(1))
        title = match.group(2).strip()
        if not title:
            continue
        headings.append({"level": level, "title": title})
    return headings


def extract_slot(filename: str) -> str:
    match = re.match(r"^(\d{2})_", filename)
    return match.group(1) if match else ""


def normalize_title(value: str) -> str:
    return re.sub(r"^\d{2}_", "", value).replace("_", " ").strip()


def to_site_url(relative: str) -> str:
    return f"/library/{relative.strip('/')}/"


if __name__ == "__main__":
    main()
