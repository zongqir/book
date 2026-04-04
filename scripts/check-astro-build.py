#!/usr/bin/env python3
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASTRO_ROOT = ROOT / "astro-site"


def main() -> int:
    export_result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "export_site_content.py")],
        cwd=ROOT,
        check=False,
    )
    if export_result.returncode != 0:
        return export_result.returncode

    page_content_result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / "export_site_page_content.py")],
        cwd=ROOT,
        check=False,
    )
    if page_content_result.returncode != 0:
        return page_content_result.returncode

    npm_command = "npm.cmd" if os.name == "nt" else "npm"
    result = subprocess.run([npm_command, "run", "build"], cwd=ASTRO_ROOT, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
