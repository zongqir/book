#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


SLOT_DIR_RE = re.compile(r"^\d{2}_.+")


@dataclass(frozen=True)
class Finding:
    path: Path
    issue: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check required slot presence against repository routing rules."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Library root to audit. Defaults to site/content/library.",
    )
    return parser.parse_args()


def is_book_dir(path: Path, root: Path) -> bool:
    if path.name.startswith("."):
        return False
    if SLOT_DIR_RE.match(path.name):
        return False
    if not (path / "_index.md").exists():
        return False
    if path == root:
        return False
    markdown_children = [
        child
        for child in path.iterdir()
        if child.is_file()
        and child.suffix == ".md"
        and child.name != "_index.md"
        and not child.name.endswith(".QA.md")
    ]
    return bool(markdown_children)


def has_slot_or_qa(book_dir: Path, slot_name: str) -> bool:
    return (book_dir / f"{slot_name}.md").exists() or (book_dir / f"{slot_name}.QA.md").exists()


def audit_book_dir(book_dir: Path, root: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []

    if not has_slot_or_qa(book_dir, "02_最值得记住的句子"):
        errors.append(Finding(book_dir, "missing required slot 02_最值得记住的句子.md or 02_最值得记住的句子.QA.md"))

    if "05_思想方法" in book_dir.parts and not has_slot_or_qa(book_dir, "01_核心原则"):
        errors.append(Finding(book_dir, "思想方法目录缺少 01_核心原则.md 或 01_核心原则.QA.md"))

    if (book_dir / "01_核心原则.md").exists() and (book_dir / "01_核心原则.QA.md").exists():
        warnings.append(Finding(book_dir, "01_核心原则.md and 01_核心原则.QA.md both exist"))

    if (book_dir / "02_最值得记住的句子.md").exists() and (book_dir / "02_最值得记住的句子.QA.md").exists():
        warnings.append(Finding(book_dir, "02_最值得记住的句子.md and 02_最值得记住的句子.QA.md both exist"))

    return errors, warnings


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    book_dirs = sorted(path for path in root.rglob("*") if path.is_dir() and is_book_dir(path, root))
    errors: list[Finding] = []
    warnings: list[Finding] = []

    for book_dir in book_dirs:
        dir_errors, dir_warnings = audit_book_dir(book_dir, root)
        errors.extend(dir_errors)
        warnings.extend(dir_warnings)

    if errors:
        print(f"[FAIL] Slot-presence audit found {len(errors)} issue(s):")
        for finding in errors:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}: {finding.issue}")
        if warnings:
            print(f"[WARN] Also found {len(warnings)} warning(s):")
            for finding in warnings:
                try:
                    rel = finding.path.relative_to(repo_root)
                except ValueError:
                    rel = finding.path
                print(f"- {rel}: {finding.issue}")
        return 1

    print(f"[OK] Slot-presence audit passed: {root}")
    print(f"[OK] Checked {len(book_dirs)} book directories.")
    if warnings:
        print(f"[WARN] Found {len(warnings)} warning(s):")
        for finding in warnings:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}: {finding.issue}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
