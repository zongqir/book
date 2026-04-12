#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from frontmatter_schema import (
    classify_single_book_doc,
    extract_frontmatter_keys,
    frontmatter_field_is_missing,
    is_non_empty_string,
    is_single_book_doc,
    is_single_book_index,
)

@dataclass
class Finding:
    path: Path
    issue: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit Markdown frontmatter completeness for this repository."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    return parser.parse_args()


def audit_markdown_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    text = path.read_text(encoding="utf-8")
    parse_result = extract_frontmatter_keys(text)
    data = parse_result.data
    keys = set(data.keys()) if data is not None else None

    if parse_result.error:
        findings.append(Finding(path, parse_result.error))
        return findings

    if keys is None:
        findings.append(Finding(path, "missing valid frontmatter"))
        return findings

    if path.name == "_index.md":
        if is_single_book_index(path):
            if "title" not in keys or not is_non_empty_string(data.get("title")):
                findings.append(Finding(path, "book index missing non-empty title"))
            if "summary" not in keys or not is_non_empty_string(data.get("summary")):
                findings.append(Finding(path, "book index missing non-empty summary"))
        return findings

    rule = classify_single_book_doc(path) if is_single_book_doc(path) else None
    if rule:
        missing = [field for field in rule.required if frontmatter_field_is_missing(data, field)]
        if missing:
            findings.append(Finding(path, f"missing required fields: {', '.join(missing)}"))
        for options in rule.any_of:
            if not any(not frontmatter_field_is_missing(data, field) for field in options):
                findings.append(Finding(path, f"missing one of required fields: {', '.join(options)}"))

    thin_stub = {"title", "created_at", "updated_at", "status"}
    if is_single_book_doc(path) and thin_stub.issubset(keys) and len(keys) <= 4:
        findings.append(Finding(path, "frontmatter is a thin stub; expected full metadata"))

    return findings


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    files = sorted(root.rglob("*.md"))
    findings: list[Finding] = []

    for path in files:
        findings.extend(audit_markdown_file(path))

    if not findings:
        print(f"[OK] Frontmatter audit passed: {root}")
        print(f"[OK] Checked {len(files)} Markdown files.")
        return 0

    print(f"[FAIL] Frontmatter audit found {len(findings)} issue(s):")
    for finding in findings:
        try:
            rel = finding.path.relative_to(repo_root)
        except ValueError:
            rel = finding.path
        print(f"- {rel}: {finding.issue}")
    print("[HINT] Run `python scripts/normalize-frontmatter.py --write` before pushing to backfill autofixable fields.")
    return 1

if __name__ == "__main__":
    sys.exit(main())
