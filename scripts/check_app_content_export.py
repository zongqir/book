from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import export_app_content as exporter


def main() -> None:
    problems: list[str] = []
    warnings: list[str] = []

    config = exporter.load_export_config()
    validate_config(config, problems, warnings)

    books: list[dict[str, object]] = []
    bundle: dict[str, object] = {}
    if not problems:
        books = exporter.collect_books(config)
        bundle = exporter.build_bundle(books)
        validate_expected_bundle(config, bundle, problems, warnings)
        validate_generated_assets(bundle, problems, warnings)

    if warnings:
        print("Warnings:")
        for warning in warnings:
            print(f"- {warning}")

    if problems:
        print("App content export check failed:")
        for problem in problems:
            print(f"- {problem}")
        raise SystemExit(1)

    print(
        "App content export check passed: "
        f"{len(bundle['books'])} books, "
        f"{len(bundle['articles'])} articles, "
        f"{len(bundle['article_blocks'])} blocks, "
        f"{len(bundle['quotes'])} quotes."
    )


def validate_config(
    config: exporter.ExportConfig,
    problems: list[str],
    warnings: list[str],
) -> None:
    if not config.book_dirs:
        problems.append("content_export_config.json has no book_dirs.")
    if not config.allowed_slots:
        problems.append("content_export_config.json has no allowed_slots.")

    for relative_book_dir in config.book_dirs:
        try:
            exporter.validate_book_dir_key(relative_book_dir)
        except ValueError as exc:
            problems.append(str(exc))
            continue

        book_dir = exporter.resolve_book_dir(relative_book_dir)
        if not book_dir.exists():
            problems.append(f"Configured book dir does not exist: {relative_book_dir}")
            continue
        if not book_dir.is_dir():
            problems.append(f"Configured book dir is not a directory: {relative_book_dir}")
            continue

        if not (book_dir / "_index.md").exists():
            problems.append(f"Missing _index.md: {relative_book_dir}")

        slot_files = exporter.list_slot_files(book_dir, config.allowed_slots)
        if not slot_files:
            problems.append(f"No allowed slot files found: {relative_book_dir}")

        disallowed_slot_files = sorted(
            path.name
            for path in book_dir.glob("*.md")
            if path.name != "_index.md"
            and not path.name.endswith(".QA.md")
            and (slot := exporter.extract_slot(path.name)) is not None
            and slot not in config.allowed_slots
        )
        if disallowed_slot_files:
            warnings.append(
                f"{relative_book_dir} contains non-exported slot/process files: "
                f"{', '.join(disallowed_slot_files)}"
            )


def validate_expected_bundle(
    config: exporter.ExportConfig,
    bundle: dict[str, object],
    problems: list[str],
    warnings: list[str],
) -> None:
    bundle_books = bundle["books"]
    bundle_articles = bundle["articles"]
    bundle_versions = bundle["article_versions"]
    bundle_blocks = bundle["article_blocks"]
    bundle_quotes = bundle["quotes"]
    manifest = bundle["manifest"]

    ensure_unique_ids(bundle_books, "book", problems)
    ensure_unique_ids(bundle_articles, "article", problems)
    ensure_unique_ids(bundle_versions, "article version", problems)
    ensure_unique_ids(bundle_blocks, "block", problems)
    ensure_unique_ids(bundle_quotes, "quote", problems)

    expected_sources = set(config.book_dirs)
    actual_sources = {article["source_basis"] for article in bundle_articles}
    if actual_sources != expected_sources:
        problems.append(
            "Exported article source_basis does not match config book_dirs: "
            f"expected {sorted(expected_sources)}, got {sorted(actual_sources)}"
        )

    block_ids = {block["id"] for block in bundle_blocks}
    for quote in bundle_quotes:
        if quote["block_id"] not in block_ids:
            problems.append(
                f"Quote references missing block: {quote['id']} -> {quote['block_id']}"
            )

    version_hashes = {version["content_hash"] for version in bundle_versions}
    version_bodies = {
        version["content_hash"]: version["body_markdown"] for version in bundle_versions
    }
    if any(not body for body in version_bodies.values()):
        problems.append("Some article_versions rows have empty body_markdown.")

    required_objects = manifest["bundles"][0]["required_objects"]
    if required_objects:
        warnings.append("Manifest still has required_objects entries; current app path no longer needs them.")

    if not bundle_quotes:
        warnings.append("Export produced zero quotes; daily sentence page will be empty.")


def validate_generated_assets(
    bundle: dict[str, object],
    problems: list[str],
    warnings: list[str],
) -> None:
    manifest_path = exporter.MANIFEST_OUTPUT_PATH
    db_path = exporter.CONTENT_DB_PATH

    if not manifest_path.exists():
        problems.append(f"Generated manifest is missing: {relative_to_repo(manifest_path)}")
        return
    if not db_path.exists():
        problems.append(f"Generated content DB is missing: {relative_to_repo(db_path)}")
        return

    actual_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    expected_manifest = json.loads(json.dumps(bundle["manifest"]))
    expected_manifest["bundles"][0]["db_sha256"] = exporter.sha256_of_file(db_path)
    if actual_manifest != expected_manifest:
        problems.append(
            f"Generated manifest is stale: {relative_to_repo(manifest_path)} does not match current export output."
        )

    actual_sha = exporter.sha256_of_file(db_path)
    manifest_sha = actual_manifest["bundles"][0]["db_sha256"]
    if actual_sha != manifest_sha:
        problems.append("Manifest db_sha256 does not match the generated content DB hash.")

    validate_generated_database(bundle, db_path, problems, warnings)


def validate_generated_database(
    bundle: dict[str, object],
    db_path: Path,
    problems: list[str],
    warnings: list[str],
) -> None:
    connection = sqlite3.connect(db_path)
    try:
        counts = {
            "books": fetch_count(connection, "books"),
            "articles": fetch_count(connection, "articles"),
            "article_versions": fetch_count(connection, "article_versions"),
            "article_blocks": fetch_count(connection, "article_blocks"),
            "quotes": fetch_count(connection, "quotes"),
        }

        for table_name, expected_rows in [
            ("books", bundle["books"]),
            ("articles", bundle["articles"]),
            ("article_versions", bundle["article_versions"]),
            ("article_blocks", bundle["article_blocks"]),
            ("quotes", bundle["quotes"]),
        ]:
            expected_count = len(expected_rows)
            actual_count = counts[table_name]
            if actual_count != expected_count:
                problems.append(
                    f"Content DB table count mismatch for {table_name}: expected "
                    f"{expected_count}, got {actual_count}."
                )

        bundle_row = connection.execute(
            """
SELECT bundle_version, schema_version, created_at, min_app_version
FROM content_bundle
LIMIT 1
"""
        ).fetchone()
        if bundle_row is None:
            problems.append("content_bundle table is empty.")
        else:
            manifest_bundle = bundle["manifest"]["bundles"][0]
            if bundle_row[0] != manifest_bundle["bundle_version"]:
                problems.append("content_bundle.bundle_version does not match manifest.")
            if bundle_row[1] != bundle["manifest"]["schema_version"]:
                problems.append("content_bundle.schema_version does not match manifest.")
            if bundle_row[2] != bundle["manifest"]["published_at"]:
                warnings.append("content_bundle.created_at differs from the expected manifest timestamp.")
            if bundle_row[3] != manifest_bundle["min_app_version"]:
                problems.append("content_bundle.min_app_version does not match manifest.")

        actual_versions = connection.execute(
            """
SELECT id, article_id, version, content_hash, body_markdown, is_current
FROM article_versions
ORDER BY id
"""
        ).fetchall()
        expected_versions = sorted(
            bundle["article_versions"],
            key=lambda item: item["id"],
        )
        if len(actual_versions) != len(expected_versions):
            problems.append("article_versions row count changed during DB validation.")
        else:
            for index, row in enumerate(actual_versions):
                expected = expected_versions[index]
                actual = {
                    "id": row[0],
                    "article_id": row[1],
                    "version": row[2],
                    "content_hash": row[3],
                    "body_markdown": row[4],
                    "is_current": row[5],
                }
                for key, actual_value in actual.items():
                    if actual_value != expected[key]:
                        problems.append(
                            f"article_versions mismatch for {expected['id']} field {key}."
                        )
                        break
    finally:
        connection.close()


def fetch_count(connection: sqlite3.Connection, table_name: str) -> int:
    row = connection.execute(f"SELECT COUNT(*) FROM {table_name}").fetchone()
    return int(row[0]) if row else 0


def ensure_unique_ids(items: object, label: str, problems: list[str]) -> None:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for item in items:
        item_id = item["id"]
        if item_id in seen:
            duplicates.add(str(item_id))
        seen.add(str(item_id))
    if duplicates:
        problems.append(f"Duplicate {label} ids found: {', '.join(sorted(duplicates))}")


def relative_to_repo(path: Path) -> str:
    return path.relative_to(exporter.ROOT).as_posix()


if __name__ == "__main__":
    main()
