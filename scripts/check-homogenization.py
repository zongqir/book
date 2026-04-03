#!/usr/bin/env python3
from __future__ import annotations

import argparse
import itertools
import re
import sys
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path


FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", re.DOTALL)
SLOT_FILE_RE = re.compile(r"^\d{2}_.+\.md$")
H2_RE = re.compile(r"^##\s+(.+?)\s*$")
SHORTCODE_ONLY_RE = re.compile(r"^\s*\{\{<.*>\}\}\s*$")
SENTENCE_END_RE = re.compile(r"(?<=[。！？!?；;])")
SHELL_HEADING_PATTERNS = [
    re.compile(r"^这组句子怎么用$"),
    re.compile(r"^调用场景$"),
    re.compile(r"^什么时候翻这页$"),
    re.compile(r"^结构$"),
    re.compile(r"^这些判断在什么场景下最容易被调用$"),
]


@dataclass(frozen=True)
class DocFeatures:
    path: Path
    category: str
    slot: str
    opener: str
    opener_norm: str
    h2_titles: tuple[str, ...]
    h2_norm: tuple[str, ...]
    paragraph_rhythm: tuple[str, ...]
    shell_h2_hits: tuple[str, ...]


@dataclass(frozen=True)
class PairFinding:
    left: Path
    right: Path
    category: str
    slot: str
    opener_score: float
    h2_score: float
    rhythm_score: float
    overall_score: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit same-category same-slot docs for suspicious homogenization."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Markdown root to audit. Defaults to site/content/library.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=80,
        help="Maximum suspicious pairs to print. Defaults to 80.",
    )
    return parser.parse_args()


def strip_frontmatter(text: str) -> str:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return text
    return text[match.end() :]


def normalize_text(text: str) -> str:
    lowered = text.lower()
    kept: list[str] = []
    for char in lowered:
        category = unicodedata.category(char)
        if category.startswith(("L", "N")):
            kept.append(char)
    return "".join(kept)


def ngram_similarity(left: str, right: str, n: int = 3) -> float:
    if left == right:
        return 1.0
    if not left or not right:
        return 0.0
    if len(left) < n or len(right) < n:
        return SequenceMatcher(None, left, right).ratio()
    left_ngrams = {left[index : index + n] for index in range(len(left) - n + 1)}
    right_ngrams = {right[index : index + n] for index in range(len(right) - n + 1)}
    union = left_ngrams | right_ngrams
    if not union:
        return 0.0
    return len(left_ngrams & right_ngrams) / len(union)


def sentence_similarity(left: str, right: str) -> float:
    left_norm = normalize_text(left)
    right_norm = normalize_text(right)
    if not left_norm or not right_norm:
        return 0.0
    return max(
        SequenceMatcher(None, left_norm, right_norm).ratio(),
        ngram_similarity(left_norm, right_norm),
    )


def first_sentence(text: str) -> str:
    cleaned = text.replace("\r", "")
    parts = [part.strip() for part in SENTENCE_END_RE.split(cleaned) if part.strip()]
    if parts:
        return parts[0]
    return cleaned.strip()


def body_lines_without_noise(body: str) -> list[str]:
    result: list[str] = []
    for raw_line in body.splitlines():
        stripped = raw_line.strip()
        if not stripped:
            result.append("")
            continue
        if stripped == "---":
            continue
        if stripped.startswith("# "):
            continue
        if SHORTCODE_ONLY_RE.match(stripped):
            continue
        result.append(raw_line.rstrip())
    return result


def extract_opener(lines: list[str]) -> str:
    paragraph: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if paragraph:
                break
            continue
        if stripped.startswith("## "):
            continue
        paragraph.append(stripped)
    return first_sentence(" ".join(paragraph))


def extract_h2_titles(lines: list[str]) -> tuple[str, ...]:
    titles: list[str] = []
    for line in lines:
        match = H2_RE.match(line.strip())
        if match:
            titles.append(match.group(1).strip())
    return tuple(titles)


def paragraph_bucket(length: int) -> str:
    if length <= 35:
        return "S"
    if length <= 90:
        return "M"
    if length <= 180:
        return "L"
    return "X"


def extract_paragraph_rhythm(lines: list[str]) -> tuple[str, ...]:
    paragraphs: list[str] = []
    current: list[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        if stripped.startswith("## "):
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        current.append(stripped)
    if current:
        paragraphs.append(" ".join(current))
    buckets = [paragraph_bucket(len(normalize_text(paragraph))) for paragraph in paragraphs[:10]]
    return tuple(buckets)


def shell_h2_hits(titles: tuple[str, ...]) -> tuple[str, ...]:
    hits: list[str] = []
    for title in titles:
        for pattern in SHELL_HEADING_PATTERNS:
            if pattern.match(title):
                hits.append(title)
                break
    return tuple(hits)


def collect_features(root: Path) -> list[DocFeatures]:
    features: list[DocFeatures] = []
    for path in sorted(root.rglob("*.md")):
        if path.name == "_index.md" or path.name.endswith(".QA.md") or not SLOT_FILE_RE.match(path.name):
            continue
        rel = path.relative_to(root)
        if len(rel.parts) < 3:
            continue
        category = rel.parts[0]
        slot = path.name
        body = strip_frontmatter(path.read_text(encoding="utf-8"))
        lines = body_lines_without_noise(body)
        opener = extract_opener(lines)
        h2_titles = extract_h2_titles(lines)
        features.append(
            DocFeatures(
                path=path,
                category=category,
                slot=slot,
                opener=opener,
                opener_norm=normalize_text(opener),
                h2_titles=h2_titles,
                h2_norm=tuple(normalize_text(title) for title in h2_titles),
                paragraph_rhythm=extract_paragraph_rhythm(lines),
                shell_h2_hits=shell_h2_hits(h2_titles),
            )
        )
    return features


def h2_similarity(left: DocFeatures, right: DocFeatures) -> float:
    if not left.h2_norm or not right.h2_norm:
        return 0.0
    joined_left = "|".join(left.h2_norm)
    joined_right = "|".join(right.h2_norm)
    seq_ratio = SequenceMatcher(None, joined_left, joined_right).ratio()
    set_ratio = ngram_similarity(joined_left, joined_right)
    count_penalty = min(len(left.h2_norm), len(right.h2_norm)) / max(len(left.h2_norm), len(right.h2_norm))
    return max(seq_ratio, set_ratio) * count_penalty


def rhythm_similarity(left: DocFeatures, right: DocFeatures) -> float:
    if len(left.paragraph_rhythm) < 4 or len(right.paragraph_rhythm) < 4:
        return 0.0
    return SequenceMatcher(None, "".join(left.paragraph_rhythm), "".join(right.paragraph_rhythm)).ratio()


def pair_findings(features: list[DocFeatures]) -> list[PairFinding]:
    grouped: dict[tuple[str, str], list[DocFeatures]] = {}
    for feature in features:
        grouped.setdefault((feature.category, feature.slot), []).append(feature)

    findings: list[PairFinding] = []
    for (category, slot), docs in grouped.items():
        if len(docs) < 2:
            continue
        for left, right in itertools.combinations(docs, 2):
            opener_score = sentence_similarity(left.opener, right.opener)
            h2_score = h2_similarity(left, right)
            rhythm_score = rhythm_similarity(left, right)
            overall_score = opener_score * 0.45 + h2_score * 0.4 + rhythm_score * 0.15

            if (
                opener_score >= 0.86
                or (h2_score >= 0.92 and min(len(left.h2_titles), len(right.h2_titles)) >= 2)
                or (overall_score >= 0.83 and (opener_score >= 0.72 or h2_score >= 0.8))
            ):
                findings.append(
                    PairFinding(
                        left=left.path,
                        right=right.path,
                        category=category,
                        slot=slot,
                        opener_score=opener_score,
                        h2_score=h2_score,
                        rhythm_score=rhythm_score,
                        overall_score=overall_score,
                    )
                )
    findings.sort(key=lambda item: (-item.overall_score, -item.h2_score, -item.opener_score, str(item.left), str(item.right)))
    return findings


def repeated_shell_h2(features: list[DocFeatures]) -> list[tuple[str, str, str, int, list[Path]]]:
    grouped: dict[tuple[str, str], dict[str, list[Path]]] = {}
    for feature in features:
        if not feature.shell_h2_hits:
            continue
        slot_group = grouped.setdefault((feature.category, feature.slot), {})
        for title in feature.shell_h2_hits:
            slot_group.setdefault(title, []).append(feature.path)

    hits: list[tuple[str, str, str, int, list[Path]]] = []
    for (category, slot), title_map in grouped.items():
        for title, paths in title_map.items():
            if len(paths) >= 2:
                hits.append((category, slot, title, len(paths), sorted(paths)))
    hits.sort(key=lambda item: (-item[3], item[0], item[1], item[2]))
    return hits


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    repo_root = Path.cwd().resolve()

    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    features = collect_features(root)
    findings = pair_findings(features)
    shell_hits = repeated_shell_h2(features)

    if not findings and not shell_hits:
        print(f"[OK] Homogenization audit found no high-risk same-slot pairs: {root}")
        print(f"[OK] Checked {len(features)} slot files.")
        return 0

    print(f"[WARN] Homogenization audit checked {len(features)} slot files.")
    if shell_hits:
        print(f"[WARN] Repeated structural-shell H2 hits: {len(shell_hits)}")
        for category, slot, title, count, paths in shell_hits[: args.top]:
            print(f"- {category} / {slot}: repeated H2 '{title}' appears in {count} files")
            for path in paths[:5]:
                print(f"  - {path.relative_to(repo_root)}")
    if findings:
        print(f"[WARN] Suspicious same-slot pairs: {len(findings)}")
        for finding in findings[: args.top]:
            print(
                f"- {finding.category} / {finding.slot}: overall={finding.overall_score:.2f} "
                f"opener={finding.opener_score:.2f} h2={finding.h2_score:.2f} rhythm={finding.rhythm_score:.2f}"
            )
            print(f"  - {finding.left.relative_to(repo_root)}")
            print(f"  - {finding.right.relative_to(repo_root)}")
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
