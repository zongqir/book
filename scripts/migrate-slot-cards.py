#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import re
import sys
from pathlib import Path


FRONTMATTER_RE = re.compile(r"^---\r?\n(.*?)\r?\n---(?:\r?\n|$)", re.DOTALL)
ATTR_RE = re.compile(r'([A-Za-z_][A-Za-z0-9_-]*)=(?:"([^"]*)"|\'([^\']*)\'|`([^`]*)`)')
PRINCIPLE_PAIR_RE = re.compile(
    r"(?P<open>\{\{<\s*principle\b(?P<attrs>[^>]*)>\}\})(?P<inner>[\s\S]*?)(?P<close>\{\{<\s*/principle\s*>\}\})",
    re.DOTALL,
)

PRINCIPLE_TYPE_MAP = {
    "regular": "support",
    "extended": "support",
    "supporting": "support",
}
SECTION_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$")
STATEMENT_PREFIX_RE = re.compile(r"^(?:原则|核心原则|支撑原则)\s*[一二三四五六七八九十百零0-9]+[：:、.\s-]*")

BLOCKQUOTE_RE = re.compile(r"^\s*>\s*(.+?)\s*$")
BOLD_QUOTE_RE = re.compile(r"^\s*\*\*(.+?)\*\*\s*$")
BOLD_NUMBERED_RE = re.compile(r"^\s*\*\*(?P<no>\d+)\.\*\*\s*(?P<quote>.+?)\s*$")
NUMBERED_QUOTE_RE = re.compile(r"^\s*\d+\.\s+(.+?)\s*$")
H2_RE = re.compile(r"^\s*##\s+(.+?)\s*$")
PLAIN_QUOTED_RE = re.compile(r'^\s*["“].+["”]\s*$')


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate legacy 01/02 slot files to standard principle/sentence shortcode cards."
    )
    parser.add_argument(
        "--root",
        default="site/content/library",
        help="Content root to scan. Defaults to site/content/library.",
    )
    parser.add_argument(
        "--write",
        action="store_true",
        help="Write changes to disk. Without this flag, run in dry mode.",
    )
    return parser.parse_args()


def split_frontmatter(text: str) -> tuple[str, str]:
    match = FRONTMATTER_RE.match(text)
    if not match:
        return "", text
    return text[: match.end()], text[match.end() :]


def parse_attrs(raw: str) -> dict[str, str]:
    attrs: dict[str, str] = {}
    for match in ATTR_RE.finditer(raw):
        value = match.group(2) or match.group(3) or match.group(4) or ""
        attrs[match.group(1)] = value
    return attrs


def parse_frontmatter_int(frontmatter: str, key: str) -> int | None:
    match = re.search(rf"(?m)^{re.escape(key)}:\s*\"?(\d+)\"?\s*$", frontmatter)
    if not match:
        return None
    return int(match.group(1))


def trim_blank_lines(lines: list[str]) -> list[str]:
    start = 0
    end = len(lines)
    while start < end and not lines[start].strip():
        start += 1
    while end > start and not lines[end - 1].strip():
        end -= 1
    return lines[start:end]


def clean_statement(text: str) -> str:
    cleaned = STATEMENT_PREFIX_RE.sub("", text.strip())
    return cleaned or text.strip()


def escape_attr(value: str) -> str:
    return html.escape(value, quote=True)


def rebuild_principle_open(attrs: dict[str, str]) -> str:
    ordered_keys = ["no", "type", "statement"]
    chunks: list[str] = []
    for key in ordered_keys:
        if key in attrs and attrs[key] != "":
            chunks.append(f'{key}="{escape_attr(attrs[key])}"')
    for key in sorted(k for k in attrs if k not in ordered_keys):
        chunks.append(f'{key}="{escape_attr(attrs[key])}"')
    joined = " ".join(chunks)
    return f"{{{{< principle {joined} >}}}}"


def migrate_existing_principle_cards(body: str) -> tuple[str, bool]:
    changed = False

    def replace(match: re.Match[str]) -> str:
        nonlocal changed
        attrs = parse_attrs(match.group("attrs") or "")
        inner = match.group("inner")
        original_inner = inner
        original_type = attrs.get("type", "")

        if original_type in PRINCIPLE_TYPE_MAP:
            attrs["type"] = PRINCIPLE_TYPE_MAP[original_type]
            changed = True

        if not attrs.get("statement", "").strip():
            heading_match = re.match(r"\s*##\s+(.+?)\s*\n+", inner)
            if heading_match:
                attrs["statement"] = clean_statement(heading_match.group(1))
                inner = inner[heading_match.end() :]
                changed = True

        if not changed and inner == original_inner:
            return match.group(0)

        inner = inner.lstrip("\n")
        if inner and not inner.endswith("\n"):
            inner = inner + "\n"
        return f"{rebuild_principle_open(attrs)}\n{inner}{{{{< /principle >}}}}"

    updated = PRINCIPLE_PAIR_RE.sub(replace, body)
    return updated, changed


def migrate_legacy_principles(body: str, principle_count: int, core_count: int) -> tuple[str, bool]:
    if "{{< principle" in body:
        return body, False

    lines = body.splitlines()
    heading_positions = [idx for idx, line in enumerate(lines) if SECTION_HEADING_RE.match(line)]
    if not heading_positions:
        return body, False

    limit = min(principle_count, len(heading_positions))
    if limit <= 0:
        return body, False

    prefix_lines = lines[: heading_positions[0]]
    out_blocks: list[str] = []
    prefix_text = "\n".join(prefix_lines).rstrip()
    if prefix_text:
        out_blocks.append(prefix_text)

    for seq, start in enumerate(heading_positions[:limit], start=1):
        end = heading_positions[seq] if seq < len(heading_positions[:limit]) else None
        if end is None:
            end = len(lines)
        heading_match = SECTION_HEADING_RE.match(lines[start])
        if not heading_match:
            continue
        statement = clean_statement(heading_match.group(1))
        content_lines = trim_blank_lines(lines[start + 1 : end])
        content = "\n".join(content_lines).rstrip()
        principle_type = "core" if seq <= core_count else "support"
        card = f'{{{{< principle no="{seq}" type="{principle_type}" statement="{escape_attr(statement)}" >}}}}'
        if content:
            card = f"{card}\n{content}\n{{{{< /principle >}}}}"
        else:
            card = f"{card}\n{{{{< /principle >}}}}"
        out_blocks.append(card)

    last_converted_end = (
        heading_positions[limit] if limit < len(heading_positions) else len(lines)
    )
    suffix_lines = lines[last_converted_end:]
    suffix_text = "\n".join(suffix_lines).strip()
    if suffix_text:
        out_blocks.append(suffix_text)

    result = "\n\n".join(block for block in out_blocks if block.strip())
    if body.endswith("\n"):
        result += "\n"
    return result, True


def extract_quote(line: str) -> str | None:
    stripped = line.strip()

    blockquote_match = BLOCKQUOTE_RE.match(line)
    if blockquote_match:
        return blockquote_match.group(1).strip()

    numbered_bold_match = BOLD_NUMBERED_RE.match(line)
    if numbered_bold_match:
        return numbered_bold_match.group("quote").strip()

    bold_match = BOLD_QUOTE_RE.match(line)
    if bold_match:
        inner = bold_match.group(1).strip()
        if inner:
            return inner

    numbered_match = NUMBERED_QUOTE_RE.match(line)
    if numbered_match:
        inner = numbered_match.group(1).strip()
        if inner.startswith(("\"", "“", "'", "‘")):
            return inner

    if PLAIN_QUOTED_RE.match(stripped):
        return stripped

    heading_match = H2_RE.match(line)
    if heading_match:
        inner = heading_match.group(1).strip()
        if inner.startswith(("\"", "“", "'", "‘")):
            return inner

    return None


def strip_outer_quotes(text: str) -> str:
    stripped = text.strip()
    pairs = [
        ('"', '"'),
        ("“", "”"),
        ("'", "'"),
        ("‘", "’"),
    ]
    for left, right in pairs:
        if stripped.startswith(left) and stripped.endswith(right) and len(stripped) >= 2:
            return stripped[1:-1].strip()
    return stripped


def is_sentence_boundary(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return False
    if stripped == "---":
        return True
    if re.match(r"^#{1,6}\s+", stripped) and extract_quote(line) is None:
        return True
    return False


def migrate_legacy_sentences(body: str) -> tuple[str, bool]:
    if "{{< sentence" in body:
        return body, False

    lines = body.splitlines()
    heading_texts = [match.group(1).strip() for line in lines if (match := H2_RE.match(line))]
    explicit_quote_lines = sum(1 for line in lines if extract_quote(line) is not None)

    if heading_texts and explicit_quote_lines == 0 and min(len(text) for text in heading_texts) >= 9:
        out_blocks: list[str] = []
        sentence_no = 1
        heading_positions = [idx for idx, line in enumerate(lines) if H2_RE.match(line)]
        prefix_text = "\n".join(lines[: heading_positions[0]]).rstrip()
        if prefix_text:
            out_blocks.append(prefix_text)

        for pos, start in enumerate(heading_positions):
            end = heading_positions[pos + 1] if pos + 1 < len(heading_positions) else len(lines)
            heading_match = H2_RE.match(lines[start])
            if not heading_match:
                continue
            quote = strip_outer_quotes(heading_match.group(1).strip())
            content_lines = trim_blank_lines(lines[start + 1 : end])
            content = "\n".join(content_lines).rstrip()
            block = f'{{{{< sentence no="{sentence_no}" quote="{escape_attr(quote)}" >}}}}'
            block = f"{block}\n{{{{< /sentence >}}}}"
            if content:
                block = f"{block}\n\n{content}"
            out_blocks.append(block)
            sentence_no += 1

        result = "\n\n".join(block for block in out_blocks if block.strip())
        if body.endswith("\n"):
            result += "\n"
        return result, True

    out: list[str] = []
    changed = False
    sentence_no = 1
    index = 0

    while index < len(lines):
        quote = extract_quote(lines[index])
        if quote is None:
            out.append(lines[index])
            index += 1
            continue

        changed = True
        clean_quote = strip_outer_quotes(quote)
        out.append(f'{{{{< sentence no="{sentence_no}" quote="{escape_attr(clean_quote)}" >}}}}')
        out.append("{{< /sentence >}}")
        sentence_no += 1
        index += 1

        content_lines: list[str] = []
        while index < len(lines):
            if extract_quote(lines[index]) is not None or is_sentence_boundary(lines[index]):
                break
            content_lines.append(lines[index])
            index += 1

        content_lines = trim_blank_lines(content_lines)
        if content_lines:
            out.append("")
            out.extend(content_lines)

    result = "\n".join(out)
    if body.endswith("\n"):
        result += "\n"
    return result, changed


def migrate_file(path: Path) -> bool:
    original = path.read_text(encoding="utf-8")
    frontmatter, body = split_frontmatter(original)

    if path.name == "01_核心原则.md":
        principle_count = parse_frontmatter_int(frontmatter, "principle_count") or 0
        if principle_count <= 0:
            heading_count = len(re.findall(r"(?m)^##\s+", body))
            principle_count = heading_count
        core_count = parse_frontmatter_int(frontmatter, "core_principle_count")
        if core_count is None:
            core_count = 2 if principle_count >= 2 else principle_count

        body, migrated_legacy = migrate_legacy_principles(body, principle_count, core_count)
        body, migrated_existing = migrate_existing_principle_cards(body)
        changed = migrated_legacy or migrated_existing
    elif path.name == "02_最值得记住的句子.md":
        body, changed = migrate_legacy_sentences(body)
    else:
        return False

    if not changed:
        return False

    updated = f"{frontmatter}{body}" if frontmatter else body
    path.write_text(updated, encoding="utf-8")
    return True


def main() -> int:
    args = parse_args()
    root = Path(args.root).resolve()
    if not root.exists():
        print(f"[ERROR] Root does not exist: {root}")
        return 2

    paths = sorted(root.rglob("01_核心原则.md")) + sorted(root.rglob("02_最值得记住的句子.md"))
    changed_paths: list[Path] = []

    for path in paths:
        if not args.write:
            original = path.read_text(encoding="utf-8")
            frontmatter, body = split_frontmatter(original)
            if path.name == "01_核心原则.md":
                principle_count = parse_frontmatter_int(frontmatter, "principle_count") or len(
                    re.findall(r"(?m)^##\s+", body)
                )
                core_count = parse_frontmatter_int(frontmatter, "core_principle_count")
                if core_count is None:
                    core_count = 2 if principle_count >= 2 else principle_count
                migrated_legacy_body, migrated_legacy = migrate_legacy_principles(
                    body, principle_count, core_count
                )
                _, migrated_existing = migrate_existing_principle_cards(migrated_legacy_body)
                if migrated_legacy or migrated_existing:
                    changed_paths.append(path)
            else:
                _, changed = migrate_legacy_sentences(body)
                if changed:
                    changed_paths.append(path)
            continue

        if migrate_file(path):
            changed_paths.append(path)

    mode = "write" if args.write else "dry-run"
    print(f"[OK] Slot-card migration {mode} complete.")
    print(f"[OK] Changed {len(changed_paths)} file(s).")
    for path in changed_paths:
        print(path.relative_to(Path.cwd()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
