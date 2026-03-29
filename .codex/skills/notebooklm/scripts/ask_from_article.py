#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import locale
import shutil
import subprocess
import sys
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


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Read a markdown article, strip frontmatter, sanitize text, then ask NotebookLM."
    )
    parser.add_argument("--article", required=True, help="Markdown article path.")
    parser.add_argument("--question", required=True, help="Question to append after article text.")
    parser.add_argument("--notebook", required=True, help="NotebookLM notebook ID.")
    parser.add_argument("--source", required=True, help="NotebookLM source ID.")
    parser.add_argument("--json", action="store_true", help="Pass --json to notebooklm ask.")
    parser.add_argument("--timeout", type=int, default=240, help="Timeout in seconds.")
    parser.add_argument("--print-prompt", action="store_true", help="Print the sanitized prompt before running.")
    return parser


def main() -> int:
    args = build_parser().parse_args()

    article_text = read_markdown_body(args.article)
    prompt = build_article_question(article_text, args.question)
    prompt = sanitize_text(prompt)

    if args.print_prompt:
        print(prompt)

    cmd = [
        resolve_notebooklm_command(),
        "ask",
        prompt,
        "--notebook",
        args.notebook,
        "-s",
        args.source,
    ]
    if args.json:
        cmd.append("--json")

    print("RUNNING:", json.dumps(cmd, ensure_ascii=False))
    proc = run_cmd(cmd, timeout=args.timeout)

    print("\n=== RETURN CODE ===")
    print(proc.returncode)
    print("\n=== STDOUT ===")
    print(proc.stdout)
    print("\n=== STDERR ===")
    print(proc.stderr)
    return proc.returncode


if __name__ == "__main__":
    raise SystemExit(main())
