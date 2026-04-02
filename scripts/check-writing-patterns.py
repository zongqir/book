#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml


ERROR_HEADING_RULES = [
    (re.compile(r"^#{1,6}\s*(这本书)?更?适合哪种人现在读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*哪种人现在最该读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*(这本书)?适合谁\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*哪些人适合读\s*$"), "guide-like audience heading"),
    (re.compile(r"^#{1,6}\s*主要价值\s*$"), "generic value heading"),
    (re.compile(r"^#{1,6}\s*本章定位\s*$"), "structural shell heading"),
    (re.compile(r"^#{1,6}\s*问题驱动\s*$"), "structural shell heading"),
]

ERROR_BODY_RULES = [
    (
        re.compile(r"以下句子基于模型|以下判断从.+提炼，基于模型先验|以下句子基于模型先验"),
        "process disclaimer leaked into body",
    ),
    (
        re.compile(r"以下案例基于.+(?:重建|重述|重构)"),
        "process disclaimer leaked into body",
    ),
    (
        re.compile(r"措辞可能与原文不完全一致|措辞可能与原文有出入"),
        "process disclaimer leaked into body",
    ),
    (
        re.compile(r"贴源核对留待后续|精确引文需贴源核对|具体细节待贴源核对|具体档案引用需贴源核对|具体档案引用和细节需贴源核对|需贴源核对"),
        "process disclaimer leaked into body",
    ),
    (
        re.compile(r"不是逐字引文|非逐字引用|非原文逐字引用"),
        "process disclaimer leaked into body",
    ),
    (
        re.compile(r"基于模型先验和公开材料重构|基于模型先验对.+复原|基于模型先验的意译与复述|模型先验重构"),
        "process disclaimer leaked into body",
    ),
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

INDEX_SUMMARY_WARN_RULES = [
    (
        re.compile(r"把一本.+(?:拆成|压成|整理成)"),
        "index summary uses processing-language template",
    ),
    (
        re.compile(r"把这本书.+(?:拆成|压成|整理成)"),
        "index summary uses processing-language template",
    ),
    (
        re.compile(r"把.+(?:拆成|压成|整理成).*(?:文稿|书稿|卡片|功能文档|正文)"),
        "index summary uses processing-language template",
    ),
    (
        re.compile(r"这组文稿"),
        "index summary describes repository output instead of book judgment",
    ),
    (
        re.compile(r"这本书|本书"),
        "index summary uses generic pronoun",
    ),
    (
        re.compile(r"会告诉你|会带你|帮助读者|帮你理解|帮你"),
        "index summary uses guide-like phrasing",
    ),
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


def extract_frontmatter(path: Path) -> dict[str, object] | None:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.DOTALL)
    if not match:
        return None
    try:
        parsed = yaml.safe_load(match.group(1))
    except yaml.YAMLError:
        return None
    if not isinstance(parsed, dict):
        return None
    return {str(key): value for key, value in parsed.items()}


def frontmatter_end_line(lines: list[str]) -> int:
    if not lines or lines[0].strip() != "---":
        return 0
    for index, line in enumerate(lines[1:], start=2):
        if line.strip() == "---":
            return index
    return 0


def is_single_book_index(path: Path) -> bool:
    if path.name != "_index.md":
        return False
    parts = path.parts
    if len(parts) < 4:
        return False
    if not ("site" in parts and "content" in parts and "library" in parts):
        return False
    if any(part == "90_专题研究" for part in parts):
        return False
    return any(
        child.is_file()
        and child.suffix == ".md"
        and child.name != "_index.md"
        and not child.name.endswith(".QA.md")
        for child in path.parent.iterdir()
    )


def find_frontmatter_key_line_no(lines: list[str], key: str) -> int:
    prefix = f"{key}:"
    for index, line in enumerate(lines, start=1):
        if line.startswith(prefix):
            return index
    return 1


def audit_file(path: Path) -> tuple[list[Finding], list[Finding]]:
    errors: list[Finding] = []
    warnings: list[Finding] = []
    lines = path.read_text(encoding="utf-8").splitlines()
    body_starts_after = frontmatter_end_line(lines)

    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        for pattern, issue in ERROR_HEADING_RULES:
            if pattern.match(stripped):
                errors.append(Finding(path, index, issue, stripped))
        if index > body_starts_after and not path.name.endswith(".QA.md"):
            for pattern, issue in ERROR_BODY_RULES:
                if pattern.search(stripped):
                    errors.append(Finding(path, index, issue, stripped))
                    break
        for pattern, issue in WARN_HEADING_RULES:
            if pattern.match(stripped):
                warnings.append(Finding(path, index, issue, stripped))
        for pattern in WARN_PATTERNS:
            if pattern.search(stripped):
                warnings.append(Finding(path, index, "template-like body phrasing", stripped))

    if is_single_book_index(path):
        data = extract_frontmatter(path)
        summary = str((data or {}).get("summary") or "").strip()
        if summary:
            line_no = find_frontmatter_key_line_no(lines, "summary")
            for pattern, issue in INDEX_SUMMARY_WARN_RULES:
                if pattern.search(summary):
                    warnings.append(Finding(path, line_no, issue, summary))

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
