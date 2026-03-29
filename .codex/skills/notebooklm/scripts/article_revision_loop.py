#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json

from article_qa_review import run_revision_mode
from prompt_utils import read_markdown_body


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run one direct-revision round against NotebookLM sources and return what to fix in the article next."
    )
    parser.add_argument("--article", required=True, help="Markdown article path.")
    parser.add_argument("--notebook", required=True, help="NotebookLM notebook ID.")
    parser.add_argument("--source", required=True, help="NotebookLM source ID.")
    parser.add_argument("--timeout", type=int, default=240, help="Timeout in seconds for each ask.")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    article_text = read_markdown_body(args.article)
    result = run_revision_mode(article_text, args)

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("## Review\n")
        print(result["review"])
        print("\n## Thin Spots\n")
        print(result["thin_spots"])
        print("\n## Patches\n")
        print(result["patches"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
