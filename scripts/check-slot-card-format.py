#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", re.DOTALL)
ATTR_RE = re.compile(r'([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|\'([^\']*)\'|`([^`]*)`)')

PRINCIPLE_PAIR_RE = re.compile(
    r"\{\{<\s*principle\b(?P<attrs>[^>]*)>\}\}(?P<inner>[\s\S]*?)\{\{<\s*/principle\s*>\}\}",
    re.DOTALL,
)
PRINCIPLE_SELF_RE = re.compile(r"\{\{<\s*principle\b(?P<attrs>[^>]*)/\s*>\}\}")
SENTENCE_PAIR_RE = re.compile(
    r"\{\{<\s*sentence\b(?P<attrs>[^>]*)>\}\}(?P<inner>[\s\S]*?)\{\{<\s*/sentence\s*>\}\}",
    re.DOTALL,
)
SENTENCE_SELF_RE = re.compile(r"\{\{<\s*sentence\b(?P<attrs>[^>]*)/\s*>\}\}")

RAW_SHORTCODE_RE = re.compile(r"\{\{<|\{\{</|@@sentence\|")
EMPTY_SENTENCE_CARD_RE = re.compile(r'<div class="sentence-card-quote">\s*</div>')
EMPTY_PRINCIPLE_STATEMENT_RE = re.compile(r'<div class="principle-card-statement">\s*</div>')

SUPPORTED_PRINCIPLE_TYPES = {"core", "support"}


@dataclass(frozen=True)
class Finding:
    path: Path
    line_no: int
    severity: str
    issue: str
    snippet: str


@dataclass(frozen=True)
class ShortcodeMatch:
    line_no: int
    attrs: dict[str, str]
    raw: str
    inner: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check 01_核心原则.md and 02_最值得记住的句子.md for slot-card formatting and render failures."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    parser.add_argument(
        "--dist-root",
        default="astro-site/dist/library",
        help="Built site root for render checks. Defaults to astro-site/dist/library.",
    )
    return parser.parse_args()


def strip_frontmatter(text: str) -> tuple[str, int]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return text, 0
    consumed = match.end()
    skipped_lines = text[:consumed].count("\n")
    return text[consumed:], skipped_lines


def parse_attrs(raw: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in ATTR_RE.finditer(raw):
        value = match.group(2) or match.group(3) or match.group(4) or ""
        attrs[match.group(1)] = value
    return attrs


def line_no_from_offset(text: str, offset: int, skipped_lines: int) -> int:
    return skipped_lines + text[:offset].count("\n") + 1


def collect_matches(
    body: str,
    skipped_lines: int,
    pair_re: re.Pattern[str],
    self_re: re.Pattern[str],
) -> tuple[list[ShortcodeMatch], list[ShortcodeMatch]]:
    pair_matches: list[ShortcodeMatch] = []
    self_matches: list[ShortcodeMatch] = []

    for match in pair_re.finditer(body):
        pair_matches.append(
            ShortcodeMatch(
                line_no=line_no_from_offset(body, match.start(), skipped_lines),
                attrs=parse_attrs(match.group("attrs") or ""),
                raw=match.group(0),
                inner=(match.group("inner") or "").strip(),
            )
        )

    for match in self_re.finditer(body):
        self_matches.append(
            ShortcodeMatch(
                line_no=line_no_from_offset(body, match.start(), skipped_lines),
                attrs=parse_attrs(match.group("attrs") or ""),
                raw=match.group(0),
            )
        )

    return pair_matches, self_matches


def expected_dist_path(source_path: Path, root: Path, dist_root: Path) -> Path:
    relative = source_path.relative_to(root)
    return dist_root / relative.parent / source_path.stem / "index.html"


def audit_principle_file(path: Path, root: Path, dist_root: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []

    text = path.read_text(encoding="utf-8")
    body, skipped_lines = strip_frontmatter(text)
    pair_matches, self_matches = collect_matches(body, skipped_lines, PRINCIPLE_PAIR_RE, PRINCIPLE_SELF_RE)

    if not pair_matches and not self_matches:
        errors.append(Finding(path, skipped_lines + 1, "error", "missing principle shortcode cards", path.name))

    for match in self_matches:
        errors.append(
            Finding(
                path,
                match.line_no,
                "error",
                "principle shortcode is self-closing; Astro only renders paired principle blocks",
                match.raw,
            )
        )

    for match in pair_matches + self_matches:
        for field in ("no", "type", "statement"):
            if not match.attrs.get(field, "").strip():
                errors.append(
                    Finding(
                        path,
                        match.line_no,
                        "error",
                        f"principle shortcode missing required attribute '{field}'",
                        match.raw,
                    )
                )
        principle_type = match.attrs.get("type", "").strip()
        if principle_type and principle_type not in SUPPORTED_PRINCIPLE_TYPES:
            warnings.append(
                Finding(
                    path,
                    match.line_no,
                    "warning",
                    f"principle shortcode uses non-standard type '{principle_type}'",
                    match.raw,
                )
            )

    dist_path = expected_dist_path(path, root, dist_root)
    if dist_path.exists():
        html = dist_path.read_text(encoding="utf-8", errors="ignore")
        if RAW_SHORTCODE_RE.search(html):
            errors.append(
                Finding(
                    dist_path,
                    1,
                    "error",
                    "built HTML still contains raw shortcode markers",
                    dist_path.name,
                )
            )
        if EMPTY_PRINCIPLE_STATEMENT_RE.search(html):
            errors.append(
                Finding(
                    dist_path,
                    1,
                    "error",
                    "built HTML contains empty principle statement cards",
                    dist_path.name,
                )
            )

    return errors, warnings


def audit_sentence_file(path: Path, root: Path, dist_root: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []

    text = path.read_text(encoding="utf-8")
    body, skipped_lines = strip_frontmatter(text)
    pair_matches, self_matches = collect_matches(body, skipped_lines, SENTENCE_PAIR_RE, SENTENCE_SELF_RE)

    if not pair_matches and not self_matches:
        errors.append(Finding(path, skipped_lines + 1, "error", "missing sentence shortcode cards", path.name))

    for match in pair_matches + self_matches:
        quote = match.attrs.get("quote", "").strip()
        text_attr = match.attrs.get("text", "").strip()
        uses_unsupported_text_attr = bool(text_attr and not quote)
        if uses_unsupported_text_attr:
            errors.append(
                Finding(
                    path,
                    match.line_no,
                    "error",
                    "sentence shortcode uses unsupported 'text' attribute; renderer only reads 'quote' or inner content",
                    match.raw,
                )
            )
        if not uses_unsupported_text_attr and not quote and not match.inner.strip():
            errors.append(
                Finding(
                    path,
                    match.line_no,
                    "error",
                    "sentence shortcode has no quote text to render",
                    match.raw,
                )
            )
        if match.attrs.get("show_no") == "true" and not match.attrs.get("no", "").strip():
            warnings.append(
                Finding(
                    path,
                    match.line_no,
                    "warning",
                    "sentence shortcode sets show_no=\"true\" without a no attribute",
                    match.raw,
                )
            )

    dist_path = expected_dist_path(path, root, dist_root)
    if dist_path.exists():
        html = dist_path.read_text(encoding="utf-8", errors="ignore")
        if RAW_SHORTCODE_RE.search(html):
            errors.append(
                Finding(
                    dist_path,
                    1,
                    "error",
                    "built HTML still contains raw shortcode markers",
                    dist_path.name,
                )
            )
        if EMPTY_SENTENCE_CARD_RE.search(html):
            errors.append(
                Finding(
                    dist_path,
                    1,
                    "error",
                    "built HTML contains empty sentence cards",
                    dist_path.name,
                )
            )

    return errors, warnings


def audit_files(root: Path, dist_root: Path) -> tuple[list[Finding], list[Finding], int]:
    errors: list[Finding] = []
    warnings: list[Finding] = []
    checked = 0

    principle_files = sorted(root.rglob("01_核心原则.md"))
    sentence_files = sorted(root.rglob("02_最值得记住的句子.md"))

    for path in principle_files:
        checked += 1
        file_errors, file_warnings = audit_principle_file(path, root, dist_root)
        errors.extend(file_errors)
        warnings.extend(file_warnings)

    for path in sentence_files:
        checked += 1
        file_errors, file_warnings = audit_sentence_file(path, root, dist_root)
        errors.extend(file_errors)
        warnings.extend(file_warnings)

    return errors, warnings, checked


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    dist_root = Path(args.dist_root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    errors, warnings, checked = audit_files(root, dist_root)

    if errors:
        print(f"[FAIL] Slot-card audit found {len(errors)} error(s):")
        for finding in errors:
            try:
                rel = finding.path.relative_to(repo_root)
            except ValueError:
                rel = finding.path
            print(f"- {rel}:{finding.line_no}: {finding.issue}: {finding.snippet}")
        if warnings:
            print(f"[WARN] Also found {len(warnings)} warning(s).")
        return 1

    print(f"[OK] Slot-card audit passed: {root}")
    print(f"[OK] Checked {checked} slot files.")
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
