from __future__ import annotations

import hashlib
import json
import re
import shutil
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
LIBRARY_ROOT = ROOT / "site" / "content" / "library"
CONFIG_PATH = ROOT / "app" / "content_export_config.json"
ASSET_ROOT = ROOT / "app" / "assets" / "content_bundle"
MANIFEST_OUTPUT_PATH = ASSET_ROOT / "manifest.json"
CONTENT_DB_RELATIVE_PATH = "databases/content.db"
CONTENT_DB_PATH = ASSET_ROOT / CONTENT_DB_RELATIVE_PATH
BUILD_TIMEZONE = timezone(timedelta(hours=8))

SLOT_FILE_PATTERN = re.compile(r"^(?P<slot>\d{2})_.+\.md$")
SHORTCODE_QUOTE_PATTERN = re.compile(r'quote="([^"]+)"')
SENTENCE_OPEN_PATTERN = re.compile(r"\{\{<\s*sentence\b(?P<attrs>[^>]*)>\}\}")
SENTENCE_CLOSE_PATTERN = re.compile(r"\{\{<\s*/sentence\s*>\}\}")
ATTRIBUTE_PATTERN = re.compile(r'(\w+)="([^"]*)"')
FRONTMATTER_PATTERN = re.compile(r"^---\s*\n(.*?)\n---\s*\n?", re.DOTALL)
HEADING_PATTERN = re.compile(r"^#+\s*", re.MULTILINE)
TAG_PATTERN = re.compile(r"<[^>]+>")
SLOT_DIRECTORY_PATTERN = re.compile(r"^\d{2}_.+")

CONTENT_DB_SCHEMA = (
    """
CREATE TABLE books (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  author TEXT,
  category TEXT,
  summary TEXT,
  cover_url TEXT,
  created_at TEXT,
  updated_at TEXT
)
""",
    """
CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  book_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  article_type TEXT NOT NULL,
  summary TEXT,
  source_basis TEXT,
  evidence_status TEXT,
  created_at TEXT,
  updated_at TEXT
)
""",
    "CREATE INDEX idx_articles_book_id ON articles(book_id)",
    """
CREATE TABLE article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  body_markdown TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(article_id, version)
)
""",
    "CREATE INDEX idx_article_versions_article_id ON article_versions(article_id)",
    "CREATE INDEX idx_article_versions_current ON article_versions(article_id, is_current)",
    """
CREATE TABLE article_blocks (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL,
  block_key TEXT NOT NULL,
  block_type TEXT NOT NULL,
  title TEXT,
  body_markdown TEXT NOT NULL,
  plain_text TEXT NOT NULL,
  html TEXT NOT NULL,
  anchor TEXT,
  sort_order INTEGER NOT NULL,
  UNIQUE(article_version_id, block_key)
)
""",
    "CREATE INDEX idx_article_blocks_version_id ON article_blocks(article_version_id)",
    "CREATE INDEX idx_article_blocks_sort ON article_blocks(article_version_id, sort_order)",
    """
CREATE TABLE quotes (
  id TEXT PRIMARY KEY,
  article_version_id TEXT NOT NULL,
  block_id TEXT NOT NULL,
  text TEXT NOT NULL,
  category TEXT,
  weight REAL DEFAULT 1.0,
  is_active INTEGER NOT NULL DEFAULT 1
)
""",
    "CREATE INDEX idx_quotes_version_id ON quotes(article_version_id)",
    "CREATE INDEX idx_quotes_active_weight ON quotes(is_active, weight)",
    """
CREATE TABLE content_bundle (
  bundle_version TEXT PRIMARY KEY,
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  min_app_version TEXT,
  db_sha256 TEXT
)
""",
)


@dataclass(frozen=True)
class ExportConfig:
    book_dirs: tuple[str, ...]
    allowed_slots: tuple[str, ...]


def main() -> None:
    config = load_export_config()
    books = collect_books(config)
    bundle = build_bundle(books)
    write_bundle_assets(bundle)
    print(
        "Generated "
        f"{len(books)} books into {MANIFEST_OUTPUT_PATH} and {CONTENT_DB_PATH}"
    )


def load_export_config(path: Path = CONFIG_PATH) -> ExportConfig:
    raw = json.loads(path.read_text(encoding="utf-8"))
    book_dirs = tuple(normalize_config_path(item) for item in raw.get("book_dirs", []))
    allowed_slots = tuple(str(item).strip() for item in raw.get("allowed_slots", []))

    if not book_dirs:
        raise ValueError(f"No book_dirs configured in {path}")
    if not allowed_slots:
        raise ValueError(f"No allowed_slots configured in {path}")

    duplicate_book_dirs = find_duplicates(book_dirs)
    if duplicate_book_dirs:
        raise ValueError(f"Duplicate book_dirs in {path}: {', '.join(duplicate_book_dirs)}")

    duplicate_slots = find_duplicates(allowed_slots)
    if duplicate_slots:
        raise ValueError(f"Duplicate allowed_slots in {path}: {', '.join(duplicate_slots)}")

    return ExportConfig(book_dirs=book_dirs, allowed_slots=allowed_slots)


def collect_books(config: ExportConfig) -> list[dict[str, Any]]:
    books: list[dict[str, Any]] = []
    for relative_book_dir in config.book_dirs:
        validate_book_dir_key(relative_book_dir)
        book_dir = resolve_book_dir(relative_book_dir)
        index_file = book_dir / "_index.md"
        slot_files = list_slot_files(book_dir, config.allowed_slots)
        if not index_file.exists():
            raise FileNotFoundError(f"Missing _index.md for {relative_book_dir}")
        if not slot_files:
            raise ValueError(f"No allowed slot files found for {relative_book_dir}")

        book_meta = read_markdown(index_file)
        slot_entries = [build_slot_entry(path) for path in sorted(slot_files, key=slot_sort_key)]
        books.append(
            build_book_entry(
                relative_book_dir=Path(relative_book_dir),
                book_meta=book_meta,
                slot_entries=slot_entries,
            )
        )
    return books


def resolve_book_dir(relative_book_dir: str) -> Path:
    normalized = normalize_config_path(relative_book_dir)
    return LIBRARY_ROOT.joinpath(*normalized.split("/"))


def list_slot_files(book_dir: Path, allowed_slots: tuple[str, ...]) -> list[Path]:
    return [
        path
        for path in book_dir.glob("*.md")
        if path.name != "_index.md"
        and not path.name.endswith(".QA.md")
        and "记忆卡" not in path.stem
        and extract_slot(path.name) in allowed_slots
    ]


def validate_book_dir_key(relative_book_dir: str) -> None:
    normalized = normalize_config_path(relative_book_dir)
    last_segment = normalized.split("/")[-1]
    if SLOT_DIRECTORY_PATTERN.match(last_segment):
        raise ValueError(
            f"Configured book dir points at a slot/process directory instead of a book: {normalized}"
        )


def normalize_config_path(value: Any) -> str:
    text = str(value).strip().replace("\\", "/").strip("/")
    if not text:
        raise ValueError("Config path cannot be empty")
    return text


def find_duplicates(values: tuple[str, ...]) -> list[str]:
    seen: set[str] = set()
    duplicates: list[str] = []
    for value in values:
        if value in seen and value not in duplicates:
            duplicates.append(value)
        seen.add(value)
    return duplicates


def build_book_entry(
    *,
    relative_book_dir: Path,
    book_meta: dict[str, Any],
    slot_entries: list[dict[str, Any]],
) -> dict[str, Any]:
    relative_key = relative_book_dir.as_posix()
    book_hash = stable_hash(relative_key)
    book_id = f"book-{book_hash[:12]}"
    slug = f"{safe_slug(relative_book_dir.name)}-{book_hash[:6]}"
    title = str(book_meta["frontmatter"].get("title") or relative_book_dir.name)
    summary = first_non_empty(
        book_meta["frontmatter"].get("summary"),
        *(entry["summary"] for entry in slot_entries),
        default="",
    )
    author = first_non_empty(
        book_meta["frontmatter"].get("author"),
        *(entry["author"] for entry in slot_entries),
        default="",
    )
    category = normalize_label(
        relative_book_dir.parts[-2] if len(relative_book_dir.parts) > 1 else relative_book_dir.parts[0]
    )
    article_id = f"{book_id}-overview"
    article_markdown = assemble_article_markdown(slot_entries)
    content_hash = hashlib.sha1(article_markdown.encode("utf-8")).hexdigest()
    article_version_id = f"{article_id}@{content_hash[:8]}"
    built_at = build_timestamp()

    blocks = []
    quotes = []
    for index, slot_entry in enumerate(slot_entries, start=1):
        block_id = f"block-{stable_hash(slot_entry['relative_path'])[:16]}"
        blocks.append(
            {
                "id": block_id,
                "article_version_id": article_version_id,
                "block_key": slot_entry["slot_name"],
                "block_type": block_type_for_slot(slot_entry["slot"]),
                "title": slot_entry["title"],
                "body_markdown": slot_entry["body_markdown"],
                "plain_text": slot_entry["plain_text"],
                "html": f"<p>{html_escape(slot_entry['plain_text'])}</p>",
                "anchor": block_id,
                "sort_order": index,
            }
        )

        if slot_entry["slot"] == "02":
            for quote_index, quote_text in enumerate(slot_entry["quotes"], start=1):
                quotes.append(
                    {
                        "id": f"quote-{stable_hash(f'{block_id}:{quote_index}')[:16]}",
                        "article_version_id": article_version_id,
                        "block_id": block_id,
                        "text": quote_text,
                        "category": category,
                        "weight": round(max(0.2, 1.0 - ((quote_index - 1) * 0.05)), 2),
                        "is_active": 1,
                    }
                )

    if not quotes and blocks:
        fallback_text = fallback_quote_text(slot_entries, summary, title)
        quotes.append(
            {
                "id": f"quote-{stable_hash(article_id)[:16]}",
                "article_version_id": article_version_id,
                "block_id": blocks[0]["id"],
                "text": fallback_text,
                "category": category,
                "weight": 1.0,
                "is_active": 1,
            }
        )

    return {
        "book": {
            "id": book_id,
            "slug": slug,
            "title": title,
            "author": author,
            "category": category,
            "summary": summary,
            "created_at": built_at,
            "updated_at": built_at,
        },
        "article": {
            "id": article_id,
            "book_id": book_id,
            "slug": f"{slug}-overview",
            "title": title,
            "article_type": "overview",
            "summary": summary,
            "source_basis": relative_key,
            "evidence_status": str(
                first_non_empty(
                    book_meta["frontmatter"].get("evidence_status"),
                    *(entry["evidence_status"] for entry in slot_entries),
                    default="llm-draft",
                )
            ),
            "created_at": built_at,
            "updated_at": built_at,
        },
        "article_version": {
            "id": article_version_id,
            "article_id": article_id,
            "version": content_hash[:8],
            "content_hash": content_hash,
            "body_markdown": article_markdown,
            "is_current": 1,
            "created_at": built_at,
            "updated_at": built_at,
        },
        "blocks": blocks,
        "quotes": quotes,
    }


def build_slot_entry(path: Path) -> dict[str, Any]:
    parsed = read_markdown(path)
    body = cleanup_markdown(parsed["body"])
    slot = extract_slot(path.name)
    if slot is None:
        raise ValueError(f"Invalid slot file name: {path}")
    title = str(parsed["frontmatter"].get("title") or normalize_label(path.stem))
    return {
        "relative_path": path.relative_to(LIBRARY_ROOT).as_posix(),
        "slot": slot,
        "slot_name": path.stem,
        "title": title,
        "summary": parsed["frontmatter"].get("summary"),
        "author": parsed["frontmatter"].get("author"),
        "evidence_status": parsed["frontmatter"].get("evidence_status"),
        "body_markdown": strip_duplicate_heading(body, title),
        "plain_text": to_plain_text(body),
        "quotes": extract_quotes(body),
    }


def build_bundle(books: list[dict[str, Any]]) -> dict[str, Any]:
    published_at = build_timestamp()
    bundle_fingerprint = stable_hash(
        json.dumps(
            [
                {
                    "book_id": book["book"]["id"],
                    "content_hash": book["article_version"]["content_hash"],
                }
                for book in books
            ],
            ensure_ascii=False,
            sort_keys=True,
        )
    )
    bundle_version = f"content-{bundle_fingerprint[:10]}"
    manifest = {
        "schema_version": 1,
        "published_at": published_at,
        "bundles": [
            {
                "bundle_id": "main",
                "bundle_type": "full",
                "bundle_version": bundle_version,
                "min_app_version": "1.0.0",
                "db_url": CONTENT_DB_RELATIVE_PATH,
                "db_sha256": "",
                "required_objects": [],
            }
        ],
    }

    return {
        "manifest": manifest,
        "books": [book["book"] for book in books],
        "articles": [book["article"] for book in books],
        "article_versions": [book["article_version"] for book in books],
        "article_blocks": [block for book in books for block in book["blocks"]],
        "quotes": [quote for book in books for quote in book["quotes"]],
    }


def write_bundle_assets(bundle: dict[str, Any]) -> None:
    if ASSET_ROOT.exists():
        shutil.rmtree(ASSET_ROOT)
    ASSET_ROOT.mkdir(parents=True, exist_ok=True)
    CONTENT_DB_PATH.parent.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(json.dumps(bundle["manifest"]))
    write_content_database(CONTENT_DB_PATH, bundle, manifest)
    manifest["bundles"][0]["db_sha256"] = sha256_of_file(CONTENT_DB_PATH)
    MANIFEST_OUTPUT_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def write_content_database(
    output_path: Path,
    bundle: dict[str, Any],
    manifest: dict[str, Any],
) -> None:
    if output_path.exists():
        output_path.unlink()

    connection = sqlite3.connect(output_path)
    try:
        cursor = connection.cursor()
        for statement in CONTENT_DB_SCHEMA:
            cursor.execute(statement)

        cursor.execute(
            """
INSERT INTO content_bundle (
  bundle_version,
  schema_version,
  created_at,
  min_app_version,
  db_sha256
)
VALUES (?, ?, ?, ?, ?)
""",
            (
                manifest["bundles"][0]["bundle_version"],
                manifest["schema_version"],
                manifest["published_at"],
                manifest["bundles"][0]["min_app_version"],
                "",
            ),
        )

        insert_rows(cursor, "books", bundle["books"])
        insert_rows(cursor, "articles", bundle["articles"])
        insert_rows(cursor, "article_versions", bundle["article_versions"])
        insert_rows(cursor, "article_blocks", bundle["article_blocks"])
        insert_rows(cursor, "quotes", bundle["quotes"])
        connection.commit()
    finally:
        connection.close()


def insert_rows(cursor: sqlite3.Cursor, table: str, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return

    columns = list(rows[0].keys())
    placeholders = ", ".join("?" for _ in columns)
    column_list = ", ".join(columns)
    values = [tuple(row[column] for column in columns) for row in rows]
    cursor.executemany(
        f"INSERT INTO {table} ({column_list}) VALUES ({placeholders})",
        values,
    )


def sha256_of_file(path: Path) -> str:
    hasher = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


def build_timestamp() -> str:
    now = datetime.now(BUILD_TIMEZONE)
    return now.replace(hour=12, minute=0, second=0, microsecond=0).isoformat()


def read_markdown(path: Path) -> dict[str, Any]:
    text = path.read_text(encoding="utf-8")
    frontmatter: dict[str, Any] = {}
    body = text

    match = FRONTMATTER_PATTERN.match(text)
    if match:
        frontmatter = parse_frontmatter(match.group(1))
        body = text[match.end() :]

    return {"frontmatter": frontmatter, "body": body}


def parse_frontmatter(raw: str) -> dict[str, Any]:
    result: dict[str, Any] = {}
    current_key: str | None = None
    list_items: list[str] | None = None

    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue

        if line.startswith("  - ") and current_key and list_items is not None:
            list_items.append(strip_yaml_value(line.split("-", 1)[1].strip()))
            continue

        if ":" not in line:
            continue

        key, value = line.split(":", 1)
        current_key = key.strip()
        value = value.strip()
        if value == "":
            list_items = []
            result[current_key] = list_items
            continue

        list_items = None
        result[current_key] = strip_yaml_value(value)

    return result


def strip_yaml_value(value: str) -> str:
    value = value.strip()
    if (value.startswith('"') and value.endswith('"')) or (
        value.startswith("'") and value.endswith("'")
    ):
        return value[1:-1]
    return value


def slot_sort_key(path: Path) -> tuple[int, str]:
    slot_value = extract_slot(path.name)
    slot = int(slot_value) if slot_value is not None else 99
    return slot, path.name


def extract_slot(file_name: str) -> str | None:
    match = SLOT_FILE_PATTERN.match(file_name)
    if not match:
        return None
    return match.group("slot")


def normalize_label(label: str) -> str:
    return re.sub(r"^\d+_", "", label).replace("_", " ").strip()


def safe_slug(label: str) -> str:
    lowered = normalize_label(label).lower()
    lowered = re.sub(r"[^a-z0-9]+", "-", lowered)
    lowered = lowered.strip("-")
    return lowered or "book"


def stable_hash(value: str) -> str:
    return hashlib.sha1(value.encode("utf-8")).hexdigest()


def first_non_empty(*values: Any, default: str = "") -> str:
    for value in values:
        if value is None:
            continue
        text = str(value).strip()
        if text:
            return text
    return default


def cleanup_markdown(text: str) -> str:
    text = replace_sentence_shortcodes(text)
    text = re.sub(r"\{\{<[^>]+>\}\}", "", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def strip_duplicate_heading(body: str, title: str) -> str:
    lines = body.splitlines()
    if not lines:
        return body
    first_non_empty_index = next((index for index, line in enumerate(lines) if line.strip()), None)
    if first_non_empty_index is None:
        return body
    first_line = lines[first_non_empty_index].strip()
    normalized_title = title.replace("《", "").replace("》", "")
    if first_line.startswith("#") and normalized_title in first_line:
        lines = lines[first_non_empty_index + 1 :]
    return "\n".join(lines).strip()


def assemble_article_markdown(slot_entries: list[dict[str, Any]]) -> str:
    sections: list[str] = []
    for entry in slot_entries:
        heading = f"## {entry['title']}"
        body = entry["body_markdown"].strip()
        if not body:
            continue
        sections.append(f"{heading}\n\n{body}")
    return "\n\n".join(sections).strip()


def extract_quotes(body: str) -> list[str]:
    candidates: list[str] = []

    for sentence in extract_sentence_lines(body):
        candidates.append(sentence["quote"])

    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("> "):
            candidates.append(stripped[2:].strip())
        elif re.match(r"^[-*]\s+", stripped):
            candidates.append(re.sub(r"^[-*]\s+", "", stripped).strip())
        elif re.match(r"^\d+\.\s+", stripped):
            candidates.append(re.sub(r"^\d+\.\s+", "", stripped).strip())

    normalized: list[str] = []
    seen: set[str] = set()
    for candidate in candidates:
        plain = to_plain_text(candidate)
        if len(plain) < 8 or len(plain) > 120:
            continue
        if plain in seen:
            continue
        seen.add(plain)
        normalized.append(plain)
        if len(normalized) == 3:
            break

    return normalized


def fallback_quote_text(slot_entries: list[dict[str, Any]], summary: str, title: str) -> str:
    for entry in slot_entries:
        text = entry["plain_text"]
        if len(text) >= 18:
            return first_sentence(text)
    if summary:
        return first_sentence(summary)
    return title


def first_sentence(text: str) -> str:
    stripped = to_plain_text(text)
    match = re.match(r"^(.{8,120}?[。！？!?])", stripped)
    if match:
        return match.group(1)
    return stripped[:80].strip()


def to_plain_text(text: str) -> str:
    for sentence in extract_sentence_lines(text):
        text = text.replace(sentence["marker"], sentence["quote"])
    text = re.sub(r"\{\{<[^>]+>\}\}", "", text)
    text = HEADING_PATTERN.sub("", text)
    text = re.sub(r"^>\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = TAG_PATTERN.sub("", text)
    text = re.sub(r"\[(.*?)\]\(.*?\)", r"\1", text)
    text = re.sub(r"\n{2,}", "\n", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def replace_sentence_shortcodes(text: str) -> str:
    def replacer(match: re.Match[str]) -> str:
        attrs = {
            key: value for key, value in ATTRIBUTE_PATTERN.findall(match.group("attrs") or "")
        }
        quote = attrs.get("quote", "").strip()
        no = attrs.get("no", "").strip()
        if not quote:
            return ""
        marker = f"@@sentence|{no}|{quote}" if no else f"@@sentence||{quote}"
        return marker

    text = SENTENCE_OPEN_PATTERN.sub(replacer, text)
    text = SENTENCE_CLOSE_PATTERN.sub("", text)
    return text


def extract_sentence_lines(text: str) -> list[dict[str, str]]:
    sentences: list[dict[str, str]] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("@@sentence|"):
            continue
        parts = stripped.split("|", 2)
        if len(parts) != 3:
            continue
        sentences.append(
            {
                "marker": stripped,
                "no": parts[1],
                "quote": parts[2].strip(),
            }
        )
    return sentences


def block_type_for_slot(slot: str) -> str:
    return {
        "00": "hook",
        "01": "principle",
        "02": "hook",
        "03": "caseStudy",
        "04": "action",
        "05": "principle",
        "06": "principle",
        "07": "principle",
        "08": "principle",
        "09": "action",
        "10": "action",
    }.get(slot, "principle")


def html_escape(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


if __name__ == "__main__":
    main()
