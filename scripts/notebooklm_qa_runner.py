#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import locale
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path


@dataclass
class QueueItem:
    raw: dict

    @property
    def status(self) -> str:
        return self.raw.get("status", "pending")

    @status.setter
    def status(self, value: str) -> None:
        self.raw["status"] = value


def load_queue(path: Path) -> list[QueueItem]:
    items: list[QueueItem] = []
    if not path.exists():
        return items
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        items.append(QueueItem(json.loads(line)))
    return items


def save_queue(path: Path, items: list[QueueItem]) -> None:
    lines = [json.dumps(item.raw, ensure_ascii=False) for item in items]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def extract_answer(stdout: str) -> str:
    if not stdout:
        return ""
    text = stdout.strip()
    if text.startswith("Answer:"):
        text = text[len("Answer:"):].strip()
    marker = "\nConversation:"
    if marker in text:
        text = text.split(marker, 1)[0].rstrip()
    return text.strip()


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


def resolve_notebooklm_command() -> str:
    candidates = [
        shutil.which("notebooklm"),
        shutil.which("notebooklm.cmd"),
        shutil.which("notebooklm.exe"),
    ]
    for candidate in candidates:
        if candidate:
            return candidate
    scripts_dir = Path(sys.executable).resolve().parent / "Scripts"
    for name in ("notebooklm.cmd", "notebooklm.exe", "notebooklm"):
        candidate = scripts_dir / name
        if candidate.exists():
            return str(candidate)
    path_value = os.environ.get("PATH", "")
    raise FileNotFoundError(
        "Cannot find NotebookLM CLI executable. "
        f"Current PATH={path_value}"
    )


def append_result(path: Path, item: QueueItem, answer: str, error: str | None = None) -> None:
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            "---\n"
            "title: '03_notebooklm-qa-log'\n"
            f"date: {datetime.now().astimezone().isoformat(timespec='seconds')}\n"
            "draft: false\n"
            "---\n"
            "# NotebookLM QA Log\n\n"
            "这份文件用于收集逐章提问队列的原始问答结果，后续可以再重组成章节结论。\n\n",
            encoding="utf-8",
        )

    lines = [
        f"## {item.raw['id']} {item.raw['chapter_label']} / {item.raw['title']}",
        "",
        f"- asked_at: `{datetime.now().astimezone().isoformat(timespec='seconds')}`",
        f"- status: `{item.raw['status']}`",
        "",
        "### Question",
        "",
        item.raw["question"],
        "",
    ]
    if error:
        lines.extend(["### Error", "", error.strip(), ""])
    else:
        lines.extend(["### Answer", "", answer.strip(), ""])

    with path.open("a", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Run queued NotebookLM Q&A items sequentially.")
    parser.add_argument("--queue", required=True, help="Path to queue JSONL file.")
    parser.add_argument("--results", required=True, help="Path to markdown log file.")
    parser.add_argument("--notebook", required=True, help="NotebookLM notebook ID.")
    parser.add_argument("--source", required=True, help="NotebookLM source ID.")
    parser.add_argument("--limit", type=int, default=1, help="How many pending items to process.")
    parser.add_argument("--timeout", type=int, default=240, help="Per-question timeout in seconds.")
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="Also process items currently marked as failed.",
    )
    parser.add_argument(
        "--reset-running",
        action="store_true",
        help="Convert running items back to pending before processing.",
    )
    parser.add_argument(
        "--clear-history",
        action="store_true",
        help="Clear local NotebookLM history before each ask to reduce context contamination.",
    )
    args = parser.parse_args()
    notebooklm_cmd = resolve_notebooklm_command()

    queue_path = Path(args.queue)
    results_path = Path(args.results)
    items = load_queue(queue_path)

    if args.reset_running:
        for item in items:
            if item.status == "running":
                item.status = "pending"
                item.raw.pop("started_at", None)
        save_queue(queue_path, items)

    processed = 0
    for item in items:
        if processed >= args.limit:
            break
        allowed_statuses = {"pending"}
        if args.retry_failed:
            allowed_statuses.add("failed")
        if item.status not in allowed_statuses:
            continue

        item.status = "running"
        item.raw["started_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
        save_queue(queue_path, items)

        if args.clear_history:
            run_cmd(
                [notebooklm_cmd, "history", "--clear", "--notebook", args.notebook],
                timeout=min(args.timeout, 30),
            )

        cmd = [
            notebooklm_cmd,
            "ask",
            item.raw["question"],
            "--notebook",
            args.notebook,
            "-s",
            args.source,
        ]
        proc = run_cmd(cmd, timeout=args.timeout)

        item.raw["finished_at"] = datetime.now().astimezone().isoformat(timespec="seconds")
        item.raw["exit_code"] = proc.returncode

        if proc.returncode == 0:
            answer = extract_answer(proc.stdout)
            item.status = "completed"
            item.raw.pop("error", None)
            item.raw["answer_preview"] = answer[:160]
            append_result(results_path, item, answer)
        else:
            item.status = "failed"
            error = proc.stderr.strip() or proc.stdout.strip() or "unknown error"
            item.raw["error"] = error[:500]
            append_result(results_path, item, "", error=error)

        save_queue(queue_path, items)
        processed += 1

    print(f"Processed {processed} item(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
