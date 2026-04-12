#!/usr/bin/env python3
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

from frontmatter_schema import (
    classify_single_book_doc,
    default_frontmatter_value,
    emit_frontmatter,
    extract_frontmatter_keys,
    frontmatter_field_is_missing,
    is_single_book_doc,
    is_single_book_index,
    replace_frontmatter,
)


@dataclass
class Finding:
    path: Path
    issue: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize single-book frontmatter by backfilling autofixable fields."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to normalize. Defaults to site/content/library.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write normalized frontmatter back to disk. Without this flag the script only previews changes.",
    )
    return parser.parse_args()


def normalize_markdown_file(path: Path, write: bool) -> tuple[list[str], list[Finding]]:
    findings: list[Finding] = []
    text = path.read_text(encoding="utf-8")
    parse_result = extract_frontmatter_keys(text)
    data = parse_result.data

    if parse_result.error:
        findings.append(Finding(path, parse_result.error))
        return [], findings

    if data is None:
        findings.append(Finding(path, "missing valid frontmatter"))
        return [], findings

    changes: list[str] = []

    if is_single_book_index(path):
        if frontmatter_field_is_missing(data, "title"):
            title = default_frontmatter_value(path, data, "title")
            if title is not None:
                data["title"] = title
                changes.append("fill title")
        if frontmatter_field_is_missing(data, "summary"):
            summary = default_frontmatter_value(path, data, "summary")
            if summary is not None:
                data["summary"] = summary
                changes.append("fill summary")
    elif is_single_book_doc(path):
        rule = classify_single_book_doc(path)
        if rule:
            for field in rule.required:
                if not frontmatter_field_is_missing(data, field):
                    continue
                default_value = default_frontmatter_value(path, data, field)
                if default_value is None:
                    findings.append(Finding(path, f"missing {field} and no autofill rule is defined"))
                    continue
                data[field] = default_value
                changes.append(f"fill {field}")

            for options in rule.any_of:
                if any(not frontmatter_field_is_missing(data, field) for field in options):
                    continue
                for field in options:
                    default_value = default_frontmatter_value(path, data, field)
                    if default_value is None:
                        continue
                    data[field] = default_value
                    changes.append(f"fill {field}")
                    break
                else:
                    findings.append(Finding(path, f"missing one of required fields: {', '.join(options)}"))

    if changes and write:
        new_text = replace_frontmatter(text, emit_frontmatter(data, is_index=path.name == "_index.md"))
        path.write_text(new_text, encoding="utf-8")

    return changes, findings


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    files = sorted(root.rglob("*.md"))
    pending: list[Finding] = []
    issues: list[Finding] = []

    for path in files:
        changes, findings = normalize_markdown_file(path, args.write)
        issues.extend(findings)
        if changes:
            pending.append(Finding(path, ", ".join(changes)))

    if pending:
        verb = "Updated" if args.write else "Would update"
        print(f"[INFO] {verb} {len(pending)} Markdown file(s):")
        for finding in pending:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}: {finding.issue}")
    else:
        state = "already normalized" if not args.write else "required no changes"
        print(f"[OK] Frontmatter {state}: {root}")

    if issues:
        label = "warnings" if pending else "issues"
        print(f"[WARN] Found {len(issues)} {label}:")
        for finding in issues:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}: {finding.issue}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
