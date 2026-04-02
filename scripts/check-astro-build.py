#!/usr/bin/env python3
from __future__ import annotations

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

    result = subprocess.run(["npm", "run", "build"], cwd=ASTRO_ROOT, check=False)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
