#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


HEADING_RE = re.compile(r"^(#{1,6})\s+\S")
FENCE_RE = re.compile(r"^(```|~~~)")


@dataclass
class Finding:
    path: Path
    line_no: int
    issue: str
    snippet: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check markdown files for structural formatting issues."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    return parser.parse_args()


def strip_frontmatter(text: str) -> tuple[list[str], int]:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return text.splitlines(), 0

    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return text.splitlines(), 0

    consumed = match.end()
    skipped_lines = text[:consumed].count("\n")
    return text[consumed:].splitlines(), skipped_lines


def audit_file(path: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []
    lines, skipped_lines = strip_frontmatter(path.read_text(encoding="utf-8"))

    in_fence = False
    fence_marker = ""
    h1_lines: list[int] = []
    previous_heading_level: int | None = None

    for local_line_no, line in enumerate(lines, start=1):
        line_no = skipped_lines + local_line_no
        stripped = line.strip()

        fence_match = FENCE_RE.match(stripped)
        if fence_match:
            marker = fence_match.group(1)
            if not in_fence:
                in_fence = True
                fence_marker = marker
            elif marker == fence_marker:
                in_fence = False
                fence_marker = ""
            continue

        if in_fence:
            continue

        heading_match = HEADING_RE.match(stripped)
        if not heading_match:
            continue

        level = len(heading_match.group(1))
        if level == 1:
            h1_lines.append(line_no)
        if previous_heading_level is not None and level > previous_heading_level + 1:
            warnings.append(
                Finding(path, line_no, f"heading level jumps from H{previous_heading_level} to H{level}", stripped)
            )
        previous_heading_level = level

    if in_fence:
        errors.append(Finding(path, len(lines) + skipped_lines, "unclosed fenced code block", fence_marker))

    if len(h1_lines) > 1:
        errors.append(
            Finding(
                path,
                h1_lines[1],
                f"multiple H1 headings detected ({len(h1_lines)} total)",
                "#",
            )
        )

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
        print(f"[FAIL] Markdown-structure audit found {len(errors)} error(s):")
        for finding in errors:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}:{finding.line_no}: {finding.issue}: {finding.snippet}")
        if warnings:
            print(f"[WARN] Also found {len(warnings)} warning(s).")
        return 1

    print(f"[OK] Markdown-structure audit passed: {root}")
    print(f"[OK] Checked {len(files)} Markdown files.")
    if warnings:
        print(f"[WARN] Found {len(warnings)} warning(s):")
        for finding in warnings:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}:{finding.line_no}: {finding.issue}: {finding.snippet}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
