#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path


SHORTCODE_RE = re.compile(r"{{<\s*(/)?([A-Za-z0-9_-]+)(.*?)(/)?\s*>}}")
ESCAPED_SHORTCODE_RE = re.compile(
    r"{{(?:<\s*/\*|\s*/\*)\s*(?P<inner>.*?)(?:\*/\s*>|\*/)\s*}}"
)
VALUE_RE = r'"(?:[^"\\]|\\.)*"|`[^`]*`|\'(?:[^\'\\]|\\.)*\'|[^\s]+'
PARAM_RE = re.compile(
    rf"""
    \s*
    (?:
      (?P<named>[A-Za-z_][A-Za-z0-9_-]*=(?:{VALUE_RE}))
      |
      (?P<positional>{VALUE_RE})
    )
    """,
    re.VERBOSE,
)


@dataclass
class Finding:
    path: Path
    line_no: int
    issue: str
    snippet: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Check markdown files for shortcode formatting issues."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    return parser.parse_args()


def strip_frontmatter(text: str) -> tuple[str, int]:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return text, 0

    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return text, 0

    consumed = match.end()
    skipped_lines = text[:consumed].count("\n")
    return text[consumed:], skipped_lines


def classify_params(raw: str) -> tuple[bool, bool, bool]:
    params = raw.strip()
    if not params:
        return False, False, False

    has_named = False
    has_positional = False
    cursor = 0

    while cursor < len(params):
        match = PARAM_RE.match(params, cursor)
        if not match:
            return has_named, has_positional, True
        if match.group("named"):
            has_named = True
        elif match.group("positional"):
            has_positional = True
        cursor = match.end()

    return has_named, has_positional, False


def audit_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    text = path.read_text(encoding="utf-8")
    body, skipped_lines = strip_frontmatter(text)
    stack: list[tuple[str, int, str]] = []

    for local_line_no, line in enumerate(body.splitlines(), start=1):
        for escaped_match in ESCAPED_SHORTCODE_RE.finditer(line):
            line_no = skipped_lines + local_line_no
            snippet = escaped_match.group(0)
            inner = (escaped_match.group("inner") or "").strip()
            if re.match(r"^/?[A-Za-z0-9_-]+(?:\s|$)", inner):
                findings.append(
                    Finding(
                        path,
                        line_no,
                        "commented shortcode marker found; the site will not render it as a shortcode",
                        snippet,
                    )
                )

        for match in SHORTCODE_RE.finditer(line):
            is_closing = bool(match.group(1))
            name = match.group(2)
            params = match.group(3) or ""
            is_self_closing = bool(match.group(4))
            line_no = skipped_lines + local_line_no
            snippet = match.group(0)

            if is_closing:
                if params.strip() or is_self_closing:
                    findings.append(Finding(path, line_no, "closing shortcode must not have parameters", snippet))
                    continue
                if not stack:
                    findings.append(Finding(path, line_no, "closing shortcode without matching opener", snippet))
                    continue
                open_name, open_line_no, open_snippet = stack.pop()
                if open_name != name:
                    findings.append(
                        Finding(
                            path,
                            line_no,
                            f"shortcode closes '{name}' but last opener was '{open_name}' at line {open_line_no}",
                            snippet,
                        )
                    )
                    stack.append((open_name, open_line_no, open_snippet))
                continue

            has_named, has_positional, parse_failed = classify_params(params)
            if parse_failed:
                findings.append(Finding(path, line_no, "shortcode parameters could not be parsed cleanly", snippet))
            if has_named and has_positional:
                findings.append(Finding(path, line_no, "shortcode mixes named and positional parameters", snippet))

            if not is_self_closing:
                stack.append((name, line_no, snippet))

    for name, line_no, snippet in stack:
        findings.append(Finding(path, line_no, f"shortcode '{name}' is not closed or self-closed", snippet))

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
        findings.extend(audit_file(path))

    if not findings:
        print(f"[OK] Shortcode audit passed: {root}")
        print(f"[OK] Checked {len(files)} Markdown files.")
        return 0

    print(f"[FAIL] Shortcode audit found {len(findings)} issue(s):")
    for finding in findings:
        try:
            rel = finding.path.relative_to(repo_root)
        except ValueError:
            rel = finding.path
        print(f"- {rel}:{finding.line_no}: {finding.issue}: {finding.snippet}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
