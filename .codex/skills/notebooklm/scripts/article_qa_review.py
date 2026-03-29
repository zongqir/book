#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import locale
import shutil
import subprocess
from datetime import date
from pathlib import Path

from prompt_utils import build_article_question, read_markdown_body, sanitize_text


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


def build_followup_prompt(article_text: str, extra_context: str, question: str) -> str:
    prompt = (
        "以下是我的文章内容, 请把这段文字当作提问背景, 不是来源资料. "
        "请只基于当前 notebook 中已上传的原始资料回答. "
        f"文章内容: {article_text} "
        f"以下是上一轮回答, 也只作为分析上下文, 不是来源资料: {extra_context} "
        f"我的问题: {question}"
    )
    return sanitize_text(prompt)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Review an article against NotebookLM sources. Supports a direct revision mode and a legacy QA review mode."
    )
    parser.add_argument("--article", required=True, help="Markdown article path.")
    parser.add_argument("--notebook", required=True, help="NotebookLM notebook ID.")
    parser.add_argument("--source", required=True, help="NotebookLM source ID.")
    parser.add_argument(
        "--mode",
        choices=("revision", "qa"),
        default="revision",
        help="revision: focus on direct next edits to the article; qa: generate high-value Q&A and judge write-back value.",
    )
    parser.add_argument("--question-count", type=int, default=6, help="How many high-value questions to request in qa mode.")
    parser.add_argument("--timeout", type=int, default=240, help="Timeout in seconds for each ask.")
    parser.add_argument("--write-candidates", action="store_true", help="Only in qa mode: write a Markdown candidate draft next to the article.")
    parser.add_argument("--candidate-output", help="Optional output path for the QA candidate Markdown file.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser


def default_candidate_output(article: str) -> Path:
    article_path = Path(article)
    return article_path.with_name(f"{article_path.stem}.qa-candidates.md")


def build_candidate_markdown(article: str, audit: str, qa: str, judge: str) -> str:
    today = date.today().isoformat()
    lines = [
        "---",
        'title: "NotebookLM QA 候选稿"',
        f'article: "{article}"',
        f'generated_at: "{today}"',
        'status: "draft"',
        'source: "notebooklm article_qa_review.py --mode qa"',
        "---",
        "",
        "## 使用说明",
        "",
        "- 这是候选稿，不是正文自动改写结果。",
        "- 只把这里经过筛选的内容人工并回正式文章。",
        "",
        "## 高价值判断",
        "",
        audit,
        "",
        "## 值得追问的问题与回答",
        "",
        qa,
        "",
        "## 筛选与落稿建议",
        "",
        judge,
        "",
    ]
    return "\n".join(lines)


def run_revision_mode(article_text: str, args: argparse.Namespace) -> dict[str, str]:
    review_question = (
        "请只基于当前书籍来源检查这篇文章。"
        "请输出: 1) 已覆盖的关键点; 2) 仍然遗漏的重要内容; 3) 可能不准确、过度概括或证据不足的表述; "
        "4) 如果现在只允许再补 3 处, 最值得补哪里。回答请使用中文。"
    )
    review_answer = ask_notebook(
        sanitize_text(build_article_question(article_text, review_question)),
        args.notebook,
        args.source,
        args.timeout,
    )

    thin_spots_question = (
        "基于这篇文章和上一轮核对结果, 请专门指出正文里哪些地方方向是对的, 但还没说透。"
        "请输出: 1) 哪些段落还虚; 2) 为什么不够扎实; 3) 还缺哪类信息、边界、误判或证据; "
        "4) 哪些地方其实不用再补。回答请使用中文。"
    )
    thin_spots_answer = ask_notebook(
        build_followup_prompt(article_text, review_answer, thin_spots_question),
        args.notebook,
        args.source,
        args.timeout,
    )

    patch_question = (
        "如果现在就要直接修改正文, 而不是继续讨论, 请给出最值得补的 1 到 3 刀。"
        "请逐条输出: 1) 建议补在哪里; 2) 要补的核心判断; 3) 为什么这一刀最值钱; 4) 建议压缩写法。"
        "只保留能明显提高文章判断力和信息密度的补丁, 不要整段重写全文。回答请使用中文。"
    )
    patch_answer = ask_notebook(
        build_followup_prompt(
            article_text,
            f"{review_answer}\n\n{thin_spots_answer}",
            patch_question,
        ),
        args.notebook,
        args.source,
        args.timeout,
    )

    return {
        "review": review_answer,
        "thin_spots": thin_spots_answer,
        "patches": patch_answer,
    }


def run_qa_mode(article_text: str, args: argparse.Namespace) -> dict[str, str]:
    audit_question = (
        "请只基于当前书籍来源检查这篇文章。"
        "请输出: 1) 已覆盖的关键点; 2) 仍然遗漏的重要内容; 3) 可能不准确、过度概括或证据不足的表述; "
        "4) 如果只允许再补 3 处, 最值得补哪里。回答请使用中文。"
    )
    audit_answer = ask_notebook(
        sanitize_text(build_article_question(article_text, audit_question)),
        args.notebook,
        args.source,
        args.timeout,
    )

    qa_question = (
        f"请只基于当前书籍来源, 为这一章提出 {args.question_count} 个最有价值的问题, 并直接逐个回答。"
        "要求: 每个问题都应有现场判断价值, 每个回答尽量短但具体; "
        "每个问题后再补一句“为什么值得问”。回答请使用中文。"
    )
    qa_answer = ask_notebook(
        build_followup_prompt(article_text, audit_answer, qa_question),
        args.notebook,
        args.source,
        args.timeout,
    )

    judge_question = (
        "请基于上一步生成的问题与回答, 评估哪些 QA 值得写回文章。"
        "请逐条输出: 1) 问题; 2) 结论(保留/暂不保留); 3) 价值判断; 4) 建议写到文章哪里; 5) 建议压缩写法。"
        "只保留能帮助读者判断、排障、迁移的内容; 纯背景知识、跑题扩展或和正文重复太高的内容, 一律判为暂不保留。"
    )
    judge_answer = ask_notebook(
        build_followup_prompt(article_text, qa_answer, judge_question),
        args.notebook,
        args.source,
        args.timeout,
    )

    return {
        "audit": audit_answer,
        "qa": qa_answer,
        "judge": judge_answer,
    }


def main() -> int:
    args = build_parser().parse_args()
    article_text = read_markdown_body(args.article)

    if args.mode == "revision":
        result = run_revision_mode(article_text, args)
    else:
        result = run_qa_mode(article_text, args)
        if args.write_candidates or args.candidate_output:
            output_path = Path(args.candidate_output) if args.candidate_output else default_candidate_output(args.article)
            output_path.write_text(
                build_candidate_markdown(args.article, result["audit"], result["qa"], result["judge"]),
                encoding="utf-8",
            )
            result["candidate_output"] = str(output_path)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    elif args.mode == "revision":
        print("## Review\n")
        print(result["review"])
        print("\n## Thin Spots\n")
        print(result["thin_spots"])
        print("\n## Patches\n")
        print(result["patches"])
    else:
        print("## Audit\n")
        print(result["audit"])
        print("\n## QA\n")
        print(result["qa"])
        print("\n## Judge\n")
        print(result["judge"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
