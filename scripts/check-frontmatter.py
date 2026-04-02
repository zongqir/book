#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml


COMMON_SINGLE_BOOK_FIELDS = [
    "title",
    "book_title",
    "created_at",
    "updated_at",
    "status",
    "summary",
    "intent",
    "source_basis",
    "evidence_status",
]

@dataclass(frozen=True)
class TitleRule:
    required: list[str]
    any_of: tuple[tuple[str, ...], ...] = ()


TITLE_RULES = {
    "00_为什么读这本书": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["audience", "why_now", "confidence"]),
    "02_最值得记住的句子": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["audience", "selection_basis", "ordering_rule", "confidence"]
    ),
    "03_最有价值的案例": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["audience", "case_basis", "selection_basis", "ordering_rule", "confidence"]
    ),
    "04_行动指南": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["audience", "action_scope", "default_horizon", "prerequisites", "confidence"]
    ),
    "05_方法论总结": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["methodology_basis", "confidence"]),
    "06_适用边界与失效条件": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["audience", "guardrail_basis", "confidence"]
    ),
    "06_适用边界": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["audience", "confidence"],
        any_of=(("guardrail_basis", "boundary_basis"),),
    ),
    "07_反例与失败条件": TitleRule(
        COMMON_SINGLE_BOOK_FIELDS + ["confidence"],
        any_of=(("guardrail_basis", "failure_basis"),),
    ),
    "08_论证链": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["evidence_basis", "confidence"]),
    # Backward compatibility for legacy files not yet renamed.
    "08_论证链与证据等级": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["evidence_basis", "confidence"]),
    "09_迁移地图": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["audience", "transfer_basis", "confidence"]),
    "10_复盘指标": TitleRule(COMMON_SINGLE_BOOK_FIELDS + ["audience", "confidence"]),
    "11_贴源核对": TitleRule(
        [
            "title",
            "book_title",
            "created_at",
            "updated_at",
            "status",
            "summary",
            "source_basis",
            "evidence_status",
            "confidence",
        ]
    ),
}


@dataclass
class Finding:
    path: Path
    issue: str


@dataclass(frozen=True)
class FrontmatterParseResult:
    keys: set[str] | None
    error: str | None = None


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


def extract_frontmatter_keys(text: str) -> FrontmatterParseResult:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return FrontmatterParseResult(None)

    match = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", text, re.DOTALL)
    if not match:
        return FrontmatterParseResult(None)

    block = match.group(1)
    try:
        parsed = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        return FrontmatterParseResult(None, f"invalid YAML frontmatter: {exc}")

    if parsed is None:
        return FrontmatterParseResult(set())
    if not isinstance(parsed, dict):
        return FrontmatterParseResult(None, "frontmatter must parse to a mapping")

    keys = {str(key) for key in parsed.keys()}
    return FrontmatterParseResult(keys)


def classify_single_book_doc(path: Path) -> TitleRule | None:
    for prefix, rule in sorted(TITLE_RULES.items(), key=lambda item: len(item[0]), reverse=True):
        if path.name.startswith(prefix):
            return rule
    return None


def is_single_book_doc(path: Path) -> bool:
    parts = path.parts
    if len(parts) < 4:
        return False
    return (
        "site" in parts
        and "content" in parts
        and "library" in parts
        and not any(part == "90_专题研究" for part in parts)
        and path.name != "_index.md"
        and not path.name.endswith(".QA.md")
    )


def audit_markdown_file(path: Path) -> list[Finding]:
    findings: list[Finding] = []
    text = path.read_text(encoding="utf-8")
    parse_result = extract_frontmatter_keys(text)
    keys = parse_result.keys

    if path.name == "_index.md":
        return findings

    if parse_result.error:
        findings.append(Finding(path, parse_result.error))
        return findings

    if keys is None:
        findings.append(Finding(path, "missing valid frontmatter"))
        return findings

    rule = classify_single_book_doc(path) if is_single_book_doc(path) else None
    if rule:
        missing = [field for field in rule.required if field not in keys]
        if missing:
            findings.append(Finding(path, f"missing required fields: {', '.join(missing)}"))
        for options in rule.any_of:
            if not any(field in keys for field in options):
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
    return 1


if __name__ == "__main__":
    sys.exit(main())
