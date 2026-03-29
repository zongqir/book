# 命令速查

## 前置检查

```bash
notebooklm status
notebooklm source list --json
```

来源为空时先上传书籍原始资料，不要上传你的文章草稿。

## 正文迭代（默认模式）

```bash
python .codex/skills/notebooklm/scripts/article_revision_loop.py \
  --article "site/content/library/.../你的文章.md" \
  --notebook "<notebook_id>" \
  --source "<source_id>" \
  --json
```

一次调用完成三步串行提问：覆盖检查 → 深度检查 → 最值钱的几刀。

## QA 审查模式

```bash
python .codex/skills/notebooklm/scripts/article_qa_review.py \
  --article "site/content/library/.../你的文章.md" \
  --notebook "<notebook_id>" \
  --source "<source_id>" \
  --json
```

加 `--write-candidates` 直接输出 `.qa-candidates.md`。

## 单次提问

```bash
python .codex/skills/notebooklm/scripts/ask_from_article.py \
  --article "site/content/library/.../你的文章.md" \
  --question "你的问题" \
  --notebook "<notebook_id>" \
  --source "<source_id>" \
  --json
```

加 `--print-prompt` 只看清洗后的 prompt，不实际执行。

## 深挖某个遗漏

```bash
notebooklm ask "针对遗漏点 '<遗漏点>', 请给出: 重要性、补写方式、自检方法。" --json
```

## 常见问题

| 问题 | 处理 |
|------|------|
| 鉴权失败 | `notebooklm auth check --test`，必要时 `notebooklm login` |
| 没有 notebook | `notebooklm use <notebook_id>` |
| 没有来源 | `notebooklm source add` 书籍材料 |
| prompt 被截断 | 用 `ask_from_article.py`，不要手工贴长 prompt |
| 回答增量小 | 停止追问，收稿 |

## 脚本内置清洗

`ask_from_article.py` 和相关脚本自动处理：

- 去掉 frontmatter
- 去掉 Hugo shortcode
- 零宽字符、BOM、NBSP 清洗
- 多空白合并
