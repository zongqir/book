#!/usr/bin/env python3
from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST_ROOT = ROOT / "astro-site" / "dist"
SITE_CONTENT_PATH = DIST_ROOT / "data" / "site-content.json"
ANCHOR_HREF_PATTERN = re.compile(r"<a\b[^>]*\bhref=[\"']([^\"']+)[\"']", re.IGNORECASE)


def main() -> int:
    problems: list[str] = []

    if not DIST_ROOT.exists():
        print(f"[FAIL] Missing build output: {relative_to_repo(DIST_ROOT)}")
        return 1

    html_files = sorted(DIST_ROOT.rglob("*.html"))
    if not html_files:
        print(f"[FAIL] No HTML files found under {relative_to_repo(DIST_ROOT)}")
        return 1

    for html_file in html_files:
        validate_html_links(html_file, problems)

    validate_site_content_export(problems)

    if problems:
        print("[FAIL] Capacitor internal link check failed:")
        for problem in problems:
            print(f"- {problem}")
        return 1

    print(
        "[OK] Capacitor internal link check passed: "
        f"{len(html_files)} html files, app routes use explicit .html targets."
    )
    return 0


def validate_html_links(html_file: Path, problems: list[str]) -> None:
    content = html_file.read_text(encoding="utf-8")
    for href in ANCHOR_HREF_PATTERN.findall(content):
        validate_internal_href(
            href=href,
            source=relative_to_repo(html_file),
            problems=problems,
        )


def validate_site_content_export(problems: list[str]) -> None:
    if not SITE_CONTENT_PATH.exists():
        problems.append(f"Missing generated site content export: {relative_to_repo(SITE_CONTENT_PATH)}")
        return

    payload = json.loads(SITE_CONTENT_PATH.read_text(encoding="utf-8"))
    for collection_name in ("sections", "books", "pages", "quotes"):
        for item in payload.get(collection_name, []):
            href = str(item.get("url") or "")
            item_id = str(item.get("id") or item.get("key") or "<unknown>")
            validate_internal_href(
                href=href,
                source=f"{relative_to_repo(SITE_CONTENT_PATH)}::{collection_name}::{item_id}",
                problems=problems,
            )


def validate_internal_href(href: str, source: str, problems: list[str]) -> None:
    if not href or not href.startswith("/"):
        return
    if href.startswith("//"):
        return

    clean_href = href.split("#", 1)[0].split("?", 1)[0]
    if not clean_href:
        return

    if clean_href == "/":
        expect_exists(DIST_ROOT / "index.html", href, source, problems)
        return

    if is_static_asset(clean_href):
        expect_exists(DIST_ROOT / clean_href.lstrip("/"), href, source, problems)
        return

    if clean_href.endswith("/"):
        problems.append(
            f"{source} contains directory-style app link {href}. "
            "App navigation must point to explicit .html files."
        )
        return

    if not clean_href.endswith(".html"):
        return

    expect_exists(DIST_ROOT / clean_href.lstrip("/"), href, source, problems)


def expect_exists(path: Path, href: str, source: str, problems: list[str]) -> None:
    if not path.exists():
        problems.append(
            f"{source} points to {href}, but the built file is missing: {relative_to_repo(path)}"
        )


def is_static_asset(clean_href: str) -> bool:
    return bool(
        re.search(r"/[^/]+\.[^/]+$", clean_href)
        and not clean_href.endswith(".html")
    )


def relative_to_repo(path: Path) -> str:
    try:
        return str(path.relative_to(ROOT))
    except ValueError:
        return str(path)


if __name__ == "__main__":
    raise SystemExit(main())
