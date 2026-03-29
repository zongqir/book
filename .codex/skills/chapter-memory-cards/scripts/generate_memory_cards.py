#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import locale
import re
import shutil
import subprocess
from datetime import date
from pathlib import Path


def read_markdown(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def strip_frontmatter(text: str) -> str:
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            text = parts[2]
    return text.strip()


def parse_frontmatter(text: str) -> dict[str, str]:
    data: dict[str, str] = {}
    if not text.startswith("---"):
        return data
    parts = text.split("---", 2)
    if len(parts) < 3:
        return data
    for line in parts[1].splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        data[key.strip()] = value.strip().strip('"')
    return data


def sanitize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[\u200b-\u200f\u2060\ufeff]", "", text)
    text = re.sub(r"\{\{[%<].*?[>%]\}\}", " ", text, flags=re.DOTALL)
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = text.replace("`", "")
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def resolve_notebooklm_command() -> str:
    for name in ("notebooklm", "notebooklm.cmd", "notebooklm.exe"):
        candidate = shutil.which(name)
        if candidate:
            return candidate
    raise FileNotFoundError("Cannot find NotebookLM CLI executable in PATH.")


def run_cmd(cmd: list[str], timeout: int) -> subprocess.CompletedProcess[str]:
    encoding = locale.getpreferredencoding(False) or "utf-8"
    return subprocess.run(
        cmd,
        text=True,
        capture_output=True,
        encoding=encoding,
        errors="replace",
        timeout=timeout,
        check=False,
    )


def ask_notebook(prompt: str, notebook: str, source: str, timeout: int) -> str:
    cmd = [
        resolve_notebooklm_command(),
        "ask",
        prompt,
        "--notebook",
        notebook,
        "-s",
        source,
        "--json",
    ]
    proc = run_cmd(cmd, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(f"NotebookLM ask failed:\n{proc.stdout}\n{proc.stderr}")
    payload = json.loads(proc.stdout)
    if payload.get("error"):
        raise RuntimeError(payload.get("message") or "NotebookLM returned an error.")
    answer = payload.get("answer")
    if not answer:
        raise RuntimeError("NotebookLM response did not contain an answer field.")
    return answer.strip()


def build_base_prompt(article_body: str, extra: str, question: str) -> str:
    prompt = (
        "以下是我的文章内容, 请把这段文字当作提问背景, 不是来源资料. "
        "请只基于当前 notebook 中已上传的原始资料回答. "
        f"文章内容: {article_body} "
    )
    if extra:
        prompt += f"以下是补充上下文, 也只作为提问背景, 不是来源资料: {extra} "
    prompt += f"我的问题: {question}"
    return sanitize_text(prompt)


CARD_RE = re.compile(
    r"CARD_START\s*"
    r"title:\s*(?P<title>.*?)\s*"
    r"phenomenon:\s*(?P<phenomenon>.*?)\s*"
    r"dont:\s*(?P<dont>.*?)\s*"
    r"check:\s*(?P<check>.*?)\s*"
    r"upgrade:\s*(?P<upgrade>.*?)\s*"
    r"why:\s*(?P<why>.*?)\s*"
    r"CARD_END",
    flags=re.DOTALL,
)


def parse_cards(text: str) -> list[dict[str, str]]:
    cards: list[dict[str, str]] = []
    for match in CARD_RE.finditer(text):
        card = {k: " ".join(v.strip().split()) for k, v in match.groupdict().items()}
        cards.append(card)
    if not cards:
        raise RuntimeError("No cards were parsed from NotebookLM output.")
    return cards


def escape_param(text: str) -> str:
    return text.replace('"', "'")


def render_card(idx: int, chapter_no: str, card: dict[str, str]) -> str:
    if chapter_no:
        try:
            chapter_label = f"记忆卡 {int(chapter_no):02d}"
        except ValueError:
            chapter_label = f"记忆卡 {chapter_no}"
    else:
        chapter_label = f"记忆卡 {idx:02d}"
    lines = [
        "{{< memory-card",
        f'  chapter="{chapter_label}"',
        f'  title="{escape_param(card["title"])}"',
        f'  phenomenon="{escape_param(card["phenomenon"])}"',
        f'  dont="{escape_param(card["dont"])}"',
        f'  check="{escape_param(card["check"])}"',
        f'  upgrade="{escape_param(card["upgrade"])}"',
        ">}}",
        "",
        f"为什么留这张卡：{card['why']}",
        "",
    ]
    return "\n".join(lines)


def build_output(frontmatter: dict[str, str], cards: list[dict[str, str]]) -> str:
    today = date.today().isoformat()
    title = frontmatter.get("title", "逐章记忆卡片")
    book_title = frontmatter.get("book_title", "")
    chapter_no = frontmatter.get("chapter_no", "")
    chapter_basis = frontmatter.get("chapter_basis", "")
    audience = frontmatter.get("audience", "需要快速回看这一章核心判断的人。")
    summary = f"把这一章最值得反复拿出来用的判断压成独立记忆卡片，供快速复习和现场回看。"

    parts = [
        "---",
        f'title: "{title}：记忆卡"',
        f'book_title: "{book_title}"',
        f'created_at: "{today}"',
        f'updated_at: "{today}"',
        'status: "draft"',
        f'summary: "{summary}"',
        'intent: "把这一章最值得反复拿出来用的判断压成独立记忆卡片，供快速复习和现场回看。"',
        f'audience: "{audience}"',
        'source_basis: "章节正文 + 可选 QA 候选稿 + NotebookLM 原书来源。"',
        'evidence_status: "llm-draft"',
        f'chapter_no: "{chapter_no}"',
        f'chapter_basis: "{chapter_basis}"',
        'confidence: "medium"',
        "---",
        "",
        "这一页单独收几张最该记住的卡。想快速回想这一章时，先翻这里；需要展开，再回正文。",
        "",
    ]
    for idx, card in enumerate(cards, start=1):
        parts.append(render_card(idx, chapter_no, card))
    return "\n".join(parts).strip() + "\n"


def default_candidate_path(article: Path) -> Path:
    return article.with_name(f"{article.stem}.qa-candidates.md")


def default_output_path(article: Path) -> Path:
    return article.with_name(f"{article.stem}.记忆卡.md")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate a standalone chapter memory-cards article using local materials plus NotebookLM.")
    parser.add_argument("--article", required=True, help="Chapter article path.")
    parser.add_argument("--notebook", required=True, help="NotebookLM notebook ID.")
    parser.add_argument("--source", required=True, help="NotebookLM source ID.")
    parser.add_argument("--candidate", help="Optional QA candidates markdown path.")
    parser.add_argument("--output", help="Optional output markdown path.")
    parser.add_argument("--card-count", type=int, default=4, help="Target number of cards.")
    parser.add_argument("--timeout", type=int, default=240, help="Timeout in seconds for each ask.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    article_path = Path(args.article)
    article_text = read_markdown(article_path)
    frontmatter = parse_frontmatter(article_text)
    article_body = strip_frontmatter(article_text)

    candidate_path = Path(args.candidate) if args.candidate else default_candidate_path(article_path)
    extra_context = ""
    if candidate_path.exists():
        extra_context = strip_frontmatter(read_markdown(candidate_path))

    propose_question = (
        f"请只基于当前书籍来源, 结合这篇文章和补充上下文, 为这一章提出 {args.card_count} 张最值得保留的记忆卡片。"
        "每张卡必须聚焦一个高频误判、关键判断或排障转折。"
        "文风要求: 标题要短, 像现有章节卡片那样写成“X 不等于 Y”“先……再……”“X 只能当线索”这类判断句;"
        "不要写成长解释句, 不要写“关于……的说明”“为什么……很重要”;"
        "phenomenon/dont/check/upgrade 各写 1 句, why 只写 1 句。"
        "请严格按下面格式重复输出, 不要添加别的格式: "
        "CARD_START "
        "title: ... "
        "phenomenon: ... "
        "dont: ... "
        "check: ... "
        "upgrade: ... "
        "why: ... "
        "CARD_END"
    )
    proposed = ask_notebook(
        build_base_prompt(article_body, extra_context, propose_question),
        args.notebook,
        args.source,
        args.timeout,
    )

    refine_question = (
        f"请基于你刚才给出的候选卡片, 再筛一轮, 只保留最有价值的 3 到 {args.card_count} 张。"
        "删掉重复、太像摘要、太像背景知识的卡。"
        "顺手继续压文风: 标题更短, 句子更硬, 少解释腔, 更像现场判断卡。"
        "继续严格按同样格式输出: "
        "CARD_START "
        "title: ... "
        "phenomenon: ... "
        "dont: ... "
        "check: ... "
        "upgrade: ... "
        "why: ... "
        "CARD_END"
    )
    refined = ask_notebook(
        build_base_prompt(article_body, proposed, refine_question),
        args.notebook,
        args.source,
        args.timeout,
    )

    cards = parse_cards(refined)
    output_path = Path(args.output) if args.output else default_output_path(article_path)
    output_path.write_text(build_output(frontmatter, cards), encoding="utf-8")
    print(str(output_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
