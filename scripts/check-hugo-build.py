#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a local Hugo build using the repo's standard parameters."
    )
    parser.add_argument(
        "--hugo-bin",
        default=os.environ.get("HUGO_BIN", ""),
        help="Path to the Hugo binary. Defaults to $HUGO_BIN, then local fallbacks, then PATH.",
    )
    parser.add_argument(
        "--site",
        default="site",
        help="Hugo site directory. Defaults to ./site.",
    )
    parser.add_argument(
        "--dest",
        default="/tmp/book-site-public",
        help="Build destination. Defaults to /tmp/book-site-public.",
    )
    parser.add_argument(
        "--base-url",
        default="https://book.zongqir.com/",
        help="Base URL used for validation builds.",
    )
    return parser.parse_args()


def resolve_hugo_bin(requested: str) -> str | None:
    candidates = [
        requested,
        "/tmp/hugo-0.158.0/hugo",
        shutil.which("hugo"),
    ]
    for candidate in candidates:
        if candidate and Path(candidate).exists():
            return candidate
    return None


def main() -> int:
    args = parse_args()
    hugo_bin = resolve_hugo_bin(args.hugo_bin)
    if not hugo_bin:
        print("[ERROR] Hugo binary not found. Set --hugo-bin or HUGO_BIN, or install Hugo in PATH.")
        return 2

    export_result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "export_site_content.py")],
        check=False,
    )
    if export_result.returncode != 0:
        return export_result.returncode

    cmd = [
        hugo_bin,
        "-s",
        args.site,
        "-d",
        args.dest,
        "--baseURL",
        args.base_url,
        "--cleanDestinationDir",
    ]
    result = subprocess.run(cmd, check=False)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
