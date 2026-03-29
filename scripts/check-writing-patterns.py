#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ERROR_HEADING_RULES = [
    (re.compile(r"^#{1,6}\s*(这本书)?更?适合哪种人现在读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*哪种人现在最该读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*(这本书)?适合谁\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*哪些人适合读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*主要价值\s*$"), "generic value heading"),
    (re.compile(r"^#{1,6}\s*本章定位\s*$"), "structural shell heading"),
    (re.compile(r"^#{1,6}\s*问题驱动\s*$"), "structural shell heading"),
]

WARN_HEADING_RULES = [
    (re.compile(r"^#\s*为什么读这本书\s*$"), "generic slot H1 heading"),
    (re.compile(r"^#\s*为什么读《.+》\s*$"), "generic book-title H1 heading"),
]

WARN_PATTERNS = [
    re.compile(r"这本书讲了"),
    re.compile(r"作者介绍了"),
    re.compile(r"这一节会先"),
    re.compile(r"这份指南适合用在这样的时候"),
    re.compile(r"这篇文章会"),
    re.compile(r"这页主要回答"),
    re.compile(r"把《.+》压成"),
    re.compile(r"把这本书压成"),
    re.compile(r"入口稿"),
    re.compile(r"判断稿"),
    re.compile(r"执行稿"),
]


@dataclass
class Finding:
    path: Path
    line_no: int
    issue: str
    line: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check markdown files for banned writing patterns."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    return parser.parse_args()


def audit_file(path: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []
    lines = path.read_text(encoding="utf-8").splitlines()

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        for pattern, issue in ERROR_HEADING_RULES:
            if pattern.match(stripped):
                errors.append(Finding(path, index, issue, stripped))
        for pattern, issue in WARN_HEADING_RULES:
            if pattern.match(stripped):
                warnings.append(Finding(path, index, issue, stripped))
        for pattern in WARN_PATTERNS:
            if pattern.search(stripped):
                warnings.append(Finding(path, index, "template-like body phrasing", stripped))

    return errors, warnings


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    files = sorted(root.rglob("*.md"))
    errors: list[Finding] = []
    warnings: list[Finding] = []

    for path in files:
        file_errors, file_warnings = audit_file(path)
        errors.extend(file_errors)
        warnings.extend(file_warnings)

    if errors:
        print(f"[FAIL] Writing-pattern audit found {len(errors)} error(s):")
        for finding in errors:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}:{finding.line_no}: {finding.issue}: {finding.line}")
        if warnings:
            print(f"[WARN] Also found {len(warnings)} warning(s).")
        return 1

    print(f"[OK] Writing-pattern audit passed: {root}")
    print(f"[OK] Checked {len(files)} Markdown files.")
    if warnings:
        print(f"[WARN] Found {len(warnings)} warning(s):")
        for finding in warnings:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}:{finding.line_no}: {finding.line}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
