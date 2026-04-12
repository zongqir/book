#!/usr/bin/env python3
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping

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

FRONTMATTER_FIELD_ORDER = [
    *COMMON_SINGLE_BOOK_FIELDS,
    "author",
    "audience",
    "confidence",
    "visibility",
    "differentiation_notes",
    "why_now",
    "selection_basis",
    "ordering_rule",
    "doc_style",
    "case_basis",
    "action_scope",
    "default_horizon",
    "prerequisites",
    "activation_signals",
    "start_state",
    "target_state",
    "methodology_basis",
    "guardrail_basis",
    "boundary_basis",
    "failure_basis",
    "evidence_basis",
    "transfer_basis",
]

INDEX_FIELD_ORDER = ["title", "created_at", "updated_at", "status", "summary"]

FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", re.DOTALL)


@dataclass(frozen=True)
class TitleRule:
    required: tuple[str, ...]
    any_of: tuple[tuple[str, ...], ...] = ()


@dataclass(frozen=True)
class FrontmatterParseResult:
    data: dict[str, object] | None
    error: str | None = None


TITLE_RULES = {
    "00_为什么读这本书": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "why_now", "confidence"])),
    "02_最值得记住的句子": TitleRule(
        tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "selection_basis", "ordering_rule", "confidence"])
    ),
    "03_最有价值的案例": TitleRule(
        tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "case_basis", "selection_basis", "ordering_rule", "confidence"])
    ),
    "04_行动指南": TitleRule(
        tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "action_scope", "default_horizon", "prerequisites", "confidence"])
    ),
    "05_方法论总结": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["methodology_basis", "confidence"])),
    "06_适用边界与失效条件": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "guardrail_basis", "confidence"])),
    "06_适用边界": TitleRule(
        tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "confidence"]),
        any_of=(("guardrail_basis", "boundary_basis"),),
    ),
    "07_反例与失败条件": TitleRule(
        tuple(COMMON_SINGLE_BOOK_FIELDS + ["confidence"]),
        any_of=(("guardrail_basis", "failure_basis"),),
    ),
    "08_论证链": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["evidence_basis", "confidence"])),
    "08_论证链与证据等级": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["evidence_basis", "confidence"])),
    "09_迁移地图": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "transfer_basis", "confidence"])),
    "10_复盘指标": TitleRule(tuple(COMMON_SINGLE_BOOK_FIELDS + ["audience", "confidence"])),
    "11_贴源核对": TitleRule(
        (
            "title",
            "book_title",
            "created_at",
            "updated_at",
            "status",
            "summary",
            "source_basis",
            "evidence_status",
            "confidence",
        )
    ),
}


def extract_frontmatter_keys(text: str) -> FrontmatterParseResult:
    if not text.startswith("---\n") and not text.startswith("---\r\n"):
        return FrontmatterParseResult(None)

    match = FRONTMATTER_RE.match(text)
    if not match:
        return FrontmatterParseResult(None)

    block = match.group(1)
    try:
        parsed = yaml.safe_load(block)
    except yaml.YAMLError as exc:
        return FrontmatterParseResult(None, f"invalid YAML frontmatter: {exc}")

    if parsed is None:
        return FrontmatterParseResult({})
    if not isinstance(parsed, dict):
        return FrontmatterParseResult(None, "frontmatter must parse to a mapping")

    normalized = {str(key): value for key, value in parsed.items()}
    return FrontmatterParseResult(normalized)


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
        and not path.name.endswith(".review.md")
    )


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


def is_non_empty_string(value: object | None) -> bool:
    return isinstance(value, str) and bool(value.strip())


def frontmatter_field_is_missing(data: Mapping[str, object], field: str) -> bool:
    value = data.get(field)
    if value is None:
        return True
    if isinstance(value, str):
        return not value.strip()
    return False


def replace_frontmatter(text: str, new_block: str) -> str:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return text
    body = text[match.end() :].lstrip("\r\n")
    return f"{new_block}{body}"


def emit_frontmatter(data: Mapping[str, object], *, is_index: bool) -> str:
    order = INDEX_FIELD_ORDER if is_index else FRONTMATTER_FIELD_ORDER
    ordered: dict[str, object] = {}

    for key in order:
        if key in data:
            ordered[key] = data[key]

    for key, value in data.items():
        if key not in ordered:
            ordered[key] = value

    dumped = yaml.safe_dump(
        ordered,
        allow_unicode=True,
        sort_keys=False,
        default_flow_style=False,
        width=1000,
    ).strip()
    return f"---\n{dumped}\n---\n"


def default_frontmatter_value(path: Path, data: Mapping[str, object], field: str) -> str | None:
    book_title = str(data.get("book_title") or path.parent.name)
    index_title = str(data.get("title") or path.parent.name)

    if field == "title" and path.name == "_index.md":
        return index_title
    if field == "summary" and path.name == "_index.md":
        return f"围绕《{index_title}》的拆解入口，收录为什么读、行动指南、方法论和复盘等页面。"
    if field == "book_title":
        return book_title
    if field == "status":
        return "draft"
    if field == "source_basis":
        return "模型先验 + 公共知识"
    if field == "evidence_status":
        return "llm-draft"
    if field == "audience":
        return f"适合想把《{book_title}》的判断转成实际动作和长期提醒的读者"
    if field == "why_now":
        return f"当你正想判断《{book_title}》是否值得投入时间，或需要把其中判断转成当前行动时再读这一页"
    if field == "selection_basis":
        return f"优先保留最能代表《{book_title}》核心判断、离开原段落也能独立成立的内容"
    if field == "ordering_rule":
        return "按调用频率、解释力度和对现实决策的触发强度排序"
    if field == "case_basis":
        return f"优先选择最能体现《{book_title}》论证方式、适用场景和误判代价的案例"
    if field == "action_scope":
        return "个人实践 + 日常决策 + 小范围试错"
    if field == "default_horizon":
        return "先用两周到四周做小范围实践，再按结果扩展"
    if field == "prerequisites":
        return "先理解书中的核心判断，再结合自己的处境决定怎么用、用到哪里"
    if field == "methodology_basis":
        return f"基于《{book_title}》正文里的问题拆解、关键动作和因果关系提炼"
    if field in {"guardrail_basis", "boundary_basis"}:
        return f"基于《{book_title}》的方法前提、常见误用和失效信号整理"
    if field in {"failure_basis"}:
        return f"基于《{book_title}》常见误用、反复失手场景和回退信号整理"
    if field == "evidence_basis":
        return f"基于《{book_title}》核心结论的论据、推理顺序和关键支撑整理"
    if field == "transfer_basis":
        return f"基于《{book_title}》底层机制与外部场景之间的对应关系整理"
    if field == "confidence":
        return "medium"
    return None
