#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

import export_site_content as exporter


def main() -> int:
    expected = exporter.build_bundle()
    output_path = exporter.OUTPUT_PATH

    if not output_path.exists():
        print(f"[FAIL] Missing generated site content export: {relative_to_repo(output_path)}")
        return 1

    actual = json.loads(output_path.read_text(encoding="utf-8"))
    if normalize_bundle(actual) != normalize_bundle(expected):
        print(
            "[FAIL] Site content export is stale: "
            f"{relative_to_repo(output_path)} does not match current content."
        )
        return 1

    print(
        "[OK] Site content export check passed: "
        f"{expected['counts']['sections']} sections, "
        f"{expected['counts']['books']} books, "
        f"{expected['counts']['pages']} pages."
    )
    return 0


def relative_to_repo(path: Path) -> str:
    try:
        return str(path.relative_to(exporter.ROOT))
    except ValueError:
        return str(path)


def normalize_bundle(bundle: dict) -> dict:
    normalized = json.loads(json.dumps(bundle))
    normalized.pop("generated_at", None)
    return normalized


if __name__ == "__main__":
    raise SystemExit(main())
