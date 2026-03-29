#!/usr/bin/env python3
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from string import Template
from typing import Iterable
import datetime as dt


DEFAULT_SCOPE_IN = [
    "围绕核心问题的定义、边界和关键判断",
    "首轮强相关材料的收集与整理",
    "可执行输出物的草案结构",
]

DEFAULT_SCOPE_OUT = [
    "与当前核心问题弱相关的扩展话题",
    "没有材料支持的泛化结论",
    "超出本轮交付范围的工具选型或全面实施",
]

DEFAULT_DELIVERABLES = [
    "00_规范草案.md",
    "01_决策记录.md",
    "02_实施清单.md",
]

DEFAULT_SUCCESS_CRITERIA = [
    "专题目标和边界已写清楚",
    "首批材料清单可追溯",
    "已有一版可继续推进的输出骨架",
]

NOTE_FILES = {
    "current-judgment.md": """# 当前判断

## 当前最强结论

- 暂时没有结论。

## 我目前相信什么

- 

## 我还不确定什么

- 

## 哪些结论已经足够稳定

- 

## 哪些地方需要继续贴源核对

- 
""",
    "open-questions.md": """# 未决问题

## 还没回答的问题

- 

## 哪些问题会影响专题边界

- 

## 哪些问题需要 NotebookLM 帮忙核对

- 
""",
    "next-actions.md": """# 下一步行动

## 立即动作

1. 整理 3 到 8 份核心材料进入 `sources/`
2. 在 NotebookLM 做第一轮结构化提问
3. 把结果回写到 `exports/`

## 待补材料

- 

## 待验证判断

- 

## 可以转成行动项的内容

- 
""",
}

EXPORT_FILES = {
    "00_briefing.md": """# Briefing

## 本轮问题

- 

## 关键发现

- 

## 需要继续追问的地方

- 
""",
    "01_source-comparison.md": """# 资料对比

## 一致的地方

- 

## 冲突的地方

- 

## 还需要补什么材料

- 
""",
    "02_key-quotes.md": """# 关键引文

## 可直接回溯的关键原句

- [来源] 

## 暂时只能算判断的转述

- 
""",
}

OUTPUT_FILES = {
    "00_规范草案.md": """# 规范草案

## 适用范围

- 适用对象：
- 生效条件：

## 目标

- 本规范要解决的问题：
- 预期收益：

## 规范条目

### 1. 规则

- 规则：
- 验收标准：
- 例外条件：

## 风险与约束

- 风险：
- 缓解动作：

## 来源追溯

- [来源] 材料标题 / 章节 / 用途说明
""",
    "01_决策记录.md": """# 决策记录

## 当前选择

- 

## 为什么这样选

- 

## 放弃了什么

- 

## 触发回滚的条件

- 
""",
    "02_实施清单.md": """# 实施清单

## 里程碑

1. 
2. 
3. 

## 关键任务

- 

## 验收标准

- 

## 风险与依赖

- 
""",
}


@dataclass
class BootstrapContext:
    topic_name: str
    goal: str
    scope_in: list[str]
    scope_out: list[str]
    deliverables: list[str]
    sources: list[str]
    status: str
    today: str

    @property
    def core_question(self) -> str:
        return f"{self.topic_name}到底要解决什么问题？"

    @property
    def next_step(self) -> str:
        return "先整理 3 到 8 份强相关材料进入 sources/，再进入 NotebookLM 做第一轮贴源分析。"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bootstrap a research topic for this repository.")
    parser.add_argument("topic_name", help="Topic directory name, for example RAG落地")
    parser.add_argument("--repo-root", default=".", help="Repository root. Defaults to current directory.")
    parser.add_argument("--mode", choices=["auto", "repo", "site"], default="auto")
    parser.add_argument("--target-root", help="Override the topic parent directory directly.")
    parser.add_argument("--goal", default="待补充一句话目标")
    parser.add_argument("--scope-in", action="append", default=[], dest="scope_in")
    parser.add_argument("--scope-out", action="append", default=[], dest="scope_out")
    parser.add_argument("--deliverable", action="append", default=[], dest="deliverables")
    parser.add_argument("--source", action="append", default=[], dest="sources")
    parser.add_argument("--status", choices=["draft", "active", "review", "archived"], default="draft")
    parser.add_argument("--force", action="store_true", help="Overwrite existing files in the topic directory.")
    return parser.parse_args()


def choose_target_root(repo_root: Path, mode: str, override: str | None) -> Path:
    if override:
        return Path(override).resolve()

    repo_topic_root = repo_root / "90_专题研究"
    site_topic_root = repo_root / "site" / "content" / "library" / "90_专题研究"

    if mode == "repo":
        return repo_topic_root
    if mode == "site":
        return site_topic_root

    if repo_topic_root.exists():
        return repo_topic_root
    if not repo_topic_root.exists() and (repo_root / "site").exists():
        return repo_topic_root
    if site_topic_root.exists():
        return site_topic_root
    return repo_topic_root


def format_list_block(items: Iterable[str], fallback: str) -> str:
    values = [item.strip() for item in items if item.strip()]
    if not values:
        values = [fallback]
    return "\n".join(f"    - \"{escape_double_quotes(value)}\"" for value in values)


def format_sources(items: Iterable[str]) -> str:
    values = [item.strip() for item in items if item.strip()]
    if not values:
        return "  []"
    blocks = []
    for value in values:
        blocks.extend(
            [
                f"  - title: \"{escape_double_quotes(value)}\"",
                "    path: \"sources/待补材料\"",
                "    reason: \"待补充纳入原因\"",
            ]
        )
    return "\n".join(blocks)


def format_bullets(items: Iterable[str], fallback: str) -> str:
    values = [item.strip() for item in items if item.strip()]
    if not values:
        values = [fallback]
    return "\n".join(f"- {value}" for value in values)


def escape_double_quotes(value: str) -> str:
    return value.replace('"', '\\"')


def load_template(script_dir: Path, relative_path: str) -> Template:
    return Template((script_dir.parent / relative_path).read_text(encoding="utf-8"))


def render_topic_yml(context: BootstrapContext, script_dir: Path) -> str:
    template = load_template(script_dir, "assets/topic.yml.template")
    return template.substitute(
        topic_name=context.topic_name,
        goal=context.goal,
        scope_in=format_list_block(context.scope_in, DEFAULT_SCOPE_IN[0]),
        scope_out=format_list_block(context.scope_out, DEFAULT_SCOPE_OUT[0]),
        sources=format_sources(context.sources),
        deliverables=format_list_block(context.deliverables, DEFAULT_DELIVERABLES[0]),
        status=context.status,
        today=context.today,
        core_question=context.core_question,
        success_criteria=format_list_block(DEFAULT_SUCCESS_CRITERIA, DEFAULT_SUCCESS_CRITERIA[0]),
        next_step=context.next_step,
    )


def render_readme(context: BootstrapContext, script_dir: Path) -> str:
    template = load_template(script_dir, "assets/README.template.md")
    return template.substitute(
        topic_name=context.topic_name,
        goal=context.goal,
        scope_in_bullets=format_bullets(context.scope_in, DEFAULT_SCOPE_IN[0]),
        scope_out_bullets=format_bullets(context.scope_out, DEFAULT_SCOPE_OUT[0]),
        deliverable_bullets=format_bullets(context.deliverables, DEFAULT_DELIVERABLES[0]),
    )


def maybe_frontmatter(title: str, body: str, site_mode: bool, today: str) -> str:
    if not site_mode:
        return body
    safe_title = title.replace("'", "''")
    return (
        "---\n"
        f"title: '{safe_title}'\n"
        f"date: {today}T00:00:00+08:00\n"
        "draft: false\n"
        "---\n"
        f"{body}"
    )


def write_text(path: Path, content: str, force: bool) -> None:
    if path.exists() and not force:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.strip() + "\n", encoding="utf-8")


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    target_root = choose_target_root(repo_root, args.mode, args.target_root)
    topic_dir = target_root / args.topic_name
    site_mode = "site" in topic_dir.parts

    today = dt.date.today().isoformat()
    context = BootstrapContext(
        topic_name=args.topic_name,
        goal=args.goal.strip(),
        scope_in=args.scope_in or DEFAULT_SCOPE_IN,
        scope_out=args.scope_out or DEFAULT_SCOPE_OUT,
        deliverables=args.deliverables or DEFAULT_DELIVERABLES,
        sources=args.sources,
        status=args.status,
        today=today,
    )

    script_dir = Path(__file__).resolve().parent

    readme_name = "_index.md" if site_mode else "README.md"
    write_text(topic_dir / "topic.yml", render_topic_yml(context, script_dir), args.force)
    write_text(
        topic_dir / readme_name,
        maybe_frontmatter(context.topic_name, render_readme(context, script_dir), site_mode, today),
        args.force,
    )

    for subdir in ("sources", "notes", "exports", "outputs"):
        (topic_dir / subdir).mkdir(parents=True, exist_ok=True)

    if site_mode:
        for subdir in ("sources", "notes", "exports", "outputs"):
            write_text(
                topic_dir / subdir / "_index.md",
                maybe_frontmatter(subdir, "", True, today),
                args.force,
            )

    for filename, content in NOTE_FILES.items():
        title = filename.removesuffix(".md")
        write_text(topic_dir / "notes" / filename, maybe_frontmatter(title, content, site_mode, today), args.force)

    for filename, content in EXPORT_FILES.items():
        title = filename.removesuffix(".md")
        write_text(topic_dir / "exports" / filename, maybe_frontmatter(title, content, site_mode, today), args.force)

    for filename, content in OUTPUT_FILES.items():
        title = filename.removesuffix(".md")
        write_text(topic_dir / "outputs" / filename, maybe_frontmatter(title, content, site_mode, today), args.force)

    print(f"Created topic scaffold: {topic_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
