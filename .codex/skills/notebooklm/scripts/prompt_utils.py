from __future__ import annotations

import re
from pathlib import Path


def read_markdown_body(path: str) -> str:
    text = Path(path).read_text(encoding="utf-8")
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) == 3:
            text = parts[2]
    text = re.sub(r"\{\{[%<].*?[>%]\}\}", " ", text, flags=re.DOTALL)
    return text.strip()


def sanitize_text(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\u00a0", " ")
    text = re.sub(r"[\u200b-\u200f\u2060\ufeff]", "", text)
    text = re.sub(r"```.*?```", " ", text, flags=re.DOTALL)
    text = text.replace("`", "")
    text = re.sub(r"^\s{0,3}#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)
    text = text.replace("### ", "")
    text = text.replace("## ", "")
    text = text.replace("# ", "")
    for src, dst in (
        ("“", '"'),
        ("”", '"'),
        ("‘", "'"),
        ("’", "'"),
        ("（", "("),
        ("）", ")"),
        ("【", "["),
        ("】", "]"),
        ("：", ":"),
        ("；", ";"),
        ("，", ","),
        ("。", "."),
        ("？", "?"),
        ("！", "!"),
        ("\t", " "),
    ):
        text = text.replace(src, dst)
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def build_article_question(article_text: str, question: str) -> str:
    return (
        "以下是我的文章内容, 请把这段文字当作提问背景, 不是来源资料. "
        "请只基于当前 notebook 中已上传的原始资料回答. "
        f"文章内容: {article_text} "
        f"我的问题: {question}"
    )
