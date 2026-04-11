#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import re
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin

try:
    import requests
except ImportError as exc:  # pragma: no cover - dependency check
    raise SystemExit("Missing dependency: requests") from exc

try:
    from bs4 import BeautifulSoup
except ImportError as exc:  # pragma: no cover - dependency check
    raise SystemExit("Missing dependency: beautifulsoup4") from exc


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_LIBRARY_ROOT = ROOT / "site" / "content" / "library"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0 Safari/537.36"
SLOT_DIR_RE = re.compile(r"^\d{2}_.+")
EDITION_SUFFIX_RE = re.compile(
    r"[（(][^）)]*(?:第\s*\d+\s*版|修订(?:第\s*\d+\s*版)?|插图修订(?:第\s*\d+\s*版)?|影印(?:第\s*\d+\s*版)?|团队篇)[^）)]*[）)]"
)
SPACE_RE = re.compile(r"\s+")
CORE_SLOT_FILES = (
    "00_为什么读这本书.md",
    "02_最值得记住的句子.md",
    "03_最有价值的案例.md",
    "04_行动指南.md",
    "05_方法论总结.md",
    "06_适用边界与失效条件.md",
    "10_复盘指标.md",
)
FIT_BONUS_KEYWORDS = {
    "领导力": ("领导协作类，适合做方法型解读", 6),
    "财报": ("财务判断类，适合补方法与动作", 6),
    "税收": ("制度与经济判断类，适合做专题解读", 5),
    "产品": ("产品实践类，适合补实操向内容", 5),
    "创业": ("创业经营类，适合补经营向内容", 4),
    "共享经济": ("新制度/新商业模型题材，适合做判断型解读", 4),
    "服务": ("服务经营类，适合补案例与行动页", 4),
    "心理学": ("行为判断类，适合做可迁移解读", 3),
    "经济史": ("经济史题材，适合进历史/经济交叉书单", 5),
}
FIT_PENALTY_KEYWORDS = {
    "统计学": ("教材/入门型偏强，默认降权", -8),
    "市场营销": ("通识教材型偏强，默认降权", -8),
    "认识商业": ("通识教材型偏强，默认降权", -8),
    "认识管理": ("通识教材型偏强，默认降权", -8),
    "图解": ("图解/速览型偏强，默认降权", -5),
    "地图看懂": ("图解/速览型偏强，默认降权", -5),
    "讲稿": ("讲义/教材型偏强，默认降权", -4),
    "通史": ("大部头通史型偏强，默认降权", -4),
    "小学": ("泛科普/低门槛入门型，默认降权", -6),
}


@dataclass
class RawDoulistItem:
    position: int
    title: str
    normalized_title: str
    rating: float
    rating_count: int
    author: str
    publisher: str
    year: str
    url: str


@dataclass
class DoulistBook:
    title: str
    normalized_title: str
    variants: list[str] = field(default_factory=list)
    positions: list[int] = field(default_factory=list)
    rating: float = 0.0
    rating_count: int = 0
    author: str = ""
    publisher: str = ""
    year: str = ""
    url: str = ""


@dataclass(frozen=True)
class LibraryBook:
    title: str
    normalized_title: str
    path: Path
    core_slots_present: int


@dataclass
class MatchResult:
    doulist_title: str
    normalized_title: str
    variants: list[str]
    positions: list[int]
    rating: float
    rating_count: int
    author: str
    publisher: str
    year: str
    url: str
    status: str
    action: str
    priority_score: float
    priority_reasons: list[str]
    matched_title: str | None
    matched_path: str | None
    core_slots_present: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit a Douban doulist against local library coverage."
    )
    parser.add_argument("url", help="Douban doulist URL, e.g. https://www.douban.com/doulist/1973941/")
    parser.add_argument(
        "--root",
        default=str(DEFAULT_LIBRARY_ROOT),
        help="Library root to compare against. Defaults to site/content/library.",
    )
    parser.add_argument(
        "--format",
        choices=("markdown", "json"),
        default="markdown",
        help="Output format. Defaults to markdown.",
    )
    parser.add_argument(
        "--top",
        type=int,
        default=15,
        help="How many high-priority candidates to show in markdown output. Defaults to 15.",
    )
    parser.add_argument(
        "--output",
        help="Optional file path to write the report to.",
    )
    return parser.parse_args()


def normalize_title(title: str) -> str:
    normalized = title.strip()
    normalized = EDITION_SUFFIX_RE.sub("", normalized)
    normalized = normalized.replace("：", ":")
    normalized = normalized.replace("（", "(").replace("）", ")")
    normalized = normalized.replace("·", "·")
    normalized = normalized.replace(" ", " ")
    normalized = SPACE_RE.sub(" ", normalized)
    return normalized.strip(" -_:;")


def fetch_html(url: str) -> str:
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    response.raise_for_status()
    return response.text


def parse_float(text: str | None) -> float:
    if text is None:
        return 0.0
    cleaned = text.strip()
    if not cleaned:
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def collect_page_urls(start_url: str) -> tuple[str, list[str]]:
    urls: list[str] = []
    title = ""
    next_url = start_url
    seen: set[str] = set()

    while next_url and next_url not in seen:
        seen.add(next_url)
        urls.append(next_url)
        soup = BeautifulSoup(fetch_html(next_url), "html.parser")
        if not title:
            title_node = soup.select_one("h1 span")
            title = title_node.get_text(strip=True) if title_node else start_url
        next_link = soup.select_one(".paginator .next a[href]")
        next_url = urljoin(next_url, next_link["href"]) if next_link else ""

    return title, urls


def parse_abstract_text(item_soup: BeautifulSoup) -> tuple[str, str, str]:
    abstract = item_soup.select_one("div.abstract")
    if abstract is None:
        return "", "", ""

    author = ""
    publisher = ""
    year = ""

    for line in abstract.stripped_strings:
        text = line.strip()
        if text.startswith("作者:"):
            author = text.removeprefix("作者:").strip()
        elif text.startswith("出版社:"):
            publisher = text.removeprefix("出版社:").strip()
        elif text.startswith("出版年:"):
            year = text.removeprefix("出版年:").strip()

    return author, publisher, year


def parse_doulist_items(urls: Iterable[str]) -> list[DoulistBook]:
    by_title: dict[str, DoulistBook] = {}

    for url in urls:
        soup = BeautifulSoup(fetch_html(url), "html.parser")
        for item in soup.select("div.doulist-item"):
            title_node = item.select_one("div.title a")
            if title_node is None:
                continue

            title = title_node.get_text(strip=True)
            normalized_title = normalize_title(title)
            pos_text = item.select_one("span.pos")
            position = int(pos_text.get_text(strip=True)) if pos_text else 0
            rating_node = item.select_one("span.rating_nums")
            rating = parse_float(rating_node.get_text(strip=True) if rating_node else None)

            rating_count = 0
            rating_box = item.select_one("div.rating")
            if rating_box:
                rating_text = rating_box.get_text(" ", strip=True)
                match = re.search(r"\((\d+)人评价\)", rating_text)
                if match:
                    rating_count = int(match.group(1))

            author, publisher, year = parse_abstract_text(item)
            raw = RawDoulistItem(
                position=position,
                title=title,
                normalized_title=normalized_title,
                rating=rating,
                rating_count=rating_count,
                author=author,
                publisher=publisher,
                year=year,
                url=title_node.get("href", ""),
            )

            entry = by_title.get(normalized_title)
            if entry is None:
                entry = DoulistBook(
                    title=raw.title,
                    normalized_title=raw.normalized_title,
                    rating=raw.rating,
                    rating_count=raw.rating_count,
                    author=raw.author,
                    publisher=raw.publisher,
                    year=raw.year,
                    url=raw.url,
                )
                by_title[normalized_title] = entry

            entry.variants.append(raw.title)
            entry.positions.append(raw.position)

            # Keep the strongest variant as the representative row.
            if (raw.rating, raw.rating_count, -raw.position) > (
                entry.rating,
                entry.rating_count,
                -min(entry.positions),
            ):
                entry.title = raw.title
                entry.rating = raw.rating
                entry.rating_count = raw.rating_count
                entry.author = raw.author
                entry.publisher = raw.publisher
                entry.year = raw.year
                entry.url = raw.url

    for entry in by_title.values():
        entry.variants = sorted(set(entry.variants))
        entry.positions = sorted(set(entry.positions))

    return sorted(by_title.values(), key=lambda item: min(item.positions))


def is_book_dir(path: Path, root: Path) -> bool:
    if path == root:
        return False
    if path.name.startswith("."):
        return False
    if SLOT_DIR_RE.match(path.name):
        return False
    if not (path / "_index.md").exists():
        return False
    try:
        parts = path.relative_to(root).parts
    except ValueError:
        return False
    return len(parts) >= 2


def build_library_index(root: Path) -> tuple[dict[str, list[LibraryBook]], dict[str, list[LibraryBook]]]:
    exact: dict[str, list[LibraryBook]] = {}
    normalized: dict[str, list[LibraryBook]] = {}

    for index_file in root.rglob("_index.md"):
        book_dir = index_file.parent
        if not is_book_dir(book_dir, root):
            continue
        book = LibraryBook(
            title=book_dir.name,
            normalized_title=normalize_title(book_dir.name),
            path=book_dir,
            core_slots_present=sum((book_dir / slot).exists() for slot in CORE_SLOT_FILES),
        )
        exact.setdefault(book.title, []).append(book)
        normalized.setdefault(book.normalized_title, []).append(book)

    return exact, normalized


def pick_best_match(candidates: list[LibraryBook]) -> LibraryBook:
    return sorted(candidates, key=lambda item: (item.core_slots_present, str(item.path)), reverse=True)[0]


def classify_status(book: LibraryBook | None) -> tuple[str, str, int]:
    if book is None:
        return "missing", "review", 0
    if book.core_slots_present >= 6:
        return "interpreted", "skip", book.core_slots_present
    if book.core_slots_present >= 1:
        return "seeded", "complete_existing", book.core_slots_present
    return "indexed", "complete_existing", book.core_slots_present


def compute_priority_score(title: str, status: str, rating: float, rating_count: int) -> tuple[float, list[str]]:
    score = rating * 3 + min(math.log10(rating_count + 1) * 8, 30)
    reasons: list[str] = []
    if status == "missing":
        score += 18
    elif status in {"seeded", "indexed"}:
        score += 10
    else:
        score -= 50

    for keyword, (reason, delta) in FIT_BONUS_KEYWORDS.items():
        if keyword in title:
            score += delta
            reasons.append(reason)

    for keyword, (reason, delta) in FIT_PENALTY_KEYWORDS.items():
        if keyword in title:
            score += delta
            reasons.append(reason)

    return round(score, 1), reasons


def build_matches(items: list[DoulistBook], root: Path) -> list[MatchResult]:
    exact, normalized = build_library_index(root)
    results: list[MatchResult] = []

    for item in items:
        candidates = exact.get(item.title) or exact.get(item.normalized_title) or normalized.get(item.normalized_title) or []
        match = pick_best_match(candidates) if candidates else None
        status, action, slots = classify_status(match)
        priority_score, priority_reasons = compute_priority_score(
            item.title,
            status,
            item.rating,
            item.rating_count,
        )
        results.append(
            MatchResult(
                doulist_title=item.title,
                normalized_title=item.normalized_title,
                variants=item.variants,
                positions=item.positions,
                rating=item.rating,
                rating_count=item.rating_count,
                author=item.author,
                publisher=item.publisher,
                year=item.year,
                url=item.url,
                status=status,
                action=action,
                priority_score=priority_score,
                priority_reasons=priority_reasons,
                matched_title=match.title if match else None,
                matched_path=str(match.path.relative_to(ROOT)) if match else None,
                core_slots_present=slots,
            )
        )

    return sorted(results, key=lambda item: (min(item.positions), item.doulist_title))


def build_markdown_report(doulist_title: str, source_url: str, results: list[MatchResult], top: int) -> str:
    counts = {
        "interpreted": sum(item.status == "interpreted" for item in results),
        "seeded": sum(item.status == "seeded" for item in results),
        "indexed": sum(item.status == "indexed" for item in results),
        "missing": sum(item.status == "missing" for item in results),
    }

    high_priority = sorted(
        (
            item
            for item in results
            if item.action in {"review", "complete_existing"}
        ),
        key=lambda item: (item.priority_score, item.rating, item.rating_count),
        reverse=True,
    )[:top]

    already_done = [item for item in results if item.status == "interpreted"]

    lines = [
        f"# 豆列解读审计: {doulist_title}",
        "",
        f"- 来源: {source_url}",
        f"- 去重后条目: {len(results)}",
        f"- 已完整解读: {counts['interpreted']}",
        f"- 已建目录但未补齐: {counts['seeded'] + counts['indexed']}",
        f"- 仓库未收录: {counts['missing']}",
        "",
        "## 建议优先处理",
        "",
        "| 标题 | 动作 | 仓库状态 | 评分 | 评价数 | 说明 |",
        "| --- | --- | --- | --- | --- | --- |",
    ]

    for item in high_priority:
        action_desc = {
            "review": "新进候选",
            "complete_existing": "补齐现有目录",
        }.get(item.action, item.action)
        status_desc = {
            "missing": "未收录",
            "seeded": f"已有 {item.core_slots_present} 个核心槽位",
            "indexed": "只有目录入口",
        }.get(item.status, item.status)
        note = "；".join(
            part
            for part in (
                f"匹配到 {item.matched_title}" if item.matched_title and item.matched_title != item.doulist_title else "",
                f"别名 {', '.join(v for v in item.variants if v != item.doulist_title)}" if len(item.variants) > 1 else "",
                "；".join(item.priority_reasons) if item.priority_reasons else "",
            )
            if part
        ) or "-"
        lines.append(
            f"| {item.doulist_title} | {action_desc} | {status_desc} | {item.rating:.1f} | {item.rating_count} | {note} |"
        )

    if already_done:
        lines.extend(
            [
                "",
                "## 已完整解读",
                "",
                ", ".join(item.doulist_title for item in already_done),
            ]
        )

    return "\n".join(lines) + "\n"


def build_json_report(doulist_title: str, source_url: str, results: list[MatchResult]) -> str:
    payload = {
        "doulist_title": doulist_title,
        "source_url": source_url,
        "deduplicated_count": len(results),
        "results": [asdict(item) for item in results],
    }
    return json.dumps(payload, ensure_ascii=False, indent=2) + "\n"


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()

    if not root.exists():
        print(f"[ERROR] Library root does not exist: {root}")
        return 2

    try:
        doulist_title, page_urls = collect_page_urls(args.url)
        items = parse_doulist_items(page_urls)
        results = build_matches(items, root)
    except requests.RequestException as exc:
        print(f"[ERROR] Failed to fetch doulist: {exc}")
        return 1

    if args.format == "json":
        output = build_json_report(doulist_title, args.url, results)
    else:
        output = build_markdown_report(doulist_title, args.url, results, args.top)

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(output, encoding="utf-8")
    else:
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):
            pass
        sys.stdout.write(output)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
