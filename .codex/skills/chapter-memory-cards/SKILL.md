---
name: chapter-memory-cards
description: "为逐章拆解文章生成独立的记忆卡片页。把一章里最值得反复拿出来用的判断压成 3-5 张卡片，输出为独立 Markdown 页面，不混回章节正文。"
---

# 章节记忆卡片

把一章里最值得反复拿出来用的判断，压成独立的记忆卡片文章。
它是章节专属产物，不负责整本书层面的句子筛选或原则提取。

## §1 命中判断

当用户要求"把这一章摘成记忆卡片""想要单独的卡片文章""基于现有素材补卡片"时命中。

不命中：

- 整本书的 `02_最值得记住的句子.md` → `book-key-sentences`
- 整本书核心原则或阅读罗盘 → `book-principle-extractor`
- 全书内容压成几张总卡而不围绕单章复习 → 先判断是否更适合原则页、句子页或方法页

## §2 元数据与产出

通用必填字段遵循 `AGENTS.md` base schema。扩展字段：

- `chapter_no`：章节编号
- `chapter_basis`：卡片提取的依据来源（章节正文 / QA 候选稿 / NotebookLM）

`title` 写卡片页的内容判断，不写"记忆卡片"。`summary` 只写这组卡覆盖什么判断，不写推荐语。

输出文件名：原文章旁的同名独立页，例如 `07_第7章_内存.记忆卡.md`。
页面模板见 [assets/memory-cards.template.md](assets/memory-cards.template.md)。

## §3 工作流

### 硬规则

- 默认输出独立文章，不直接修改原章节正文。
- 优先复用站点现有的 `memory-card` shortcode，不自己发明新卡片样式。
- 先吃现有素材再让 NotebookLM 补：章节正文优先，`.qa-candidates.md` 次之，最后才是新增提问。
- 只保留 3 到 5 张卡片；卡片多了就失去"最值得记住"的意义。
- 卡片不是摘要，不要把一章内容平均切块；每张卡都必须对应一个高频误判、关键判断或排障转折。

### 3.1 确认输入

至少读取逐章正文，例如 `07_第7章_内存.md`。同目录下如果有 `.qa-candidates.md` 或已沉淀的候选卡片稿，一起读。

### 3.2 判断现有卡片是否够用

如果正文里已有 `memory-card`，先判断这张卡是不是已经抓住本章最该记住的判断，还缺不缺真正有增量价值的卡。不要机械重做整套。

### 3.3 NotebookLM 补卡

当你不确定该做哪些卡片，或怀疑现有素材覆盖不够时，先按这个标准设计 NotebookLM 问题：

- 先问成立性：这一章有没有足够多可独立记忆的判断，能撑起 3-5 张卡片？
- 再问筛选性：哪些判断最能纠正现场误判，而不只是概念复述？
- 最后问退出性：如果凑不满 3 张高价值卡，是这一章本身偏描述性，还是 source 还没覆盖？

优先问：这一章最容易误判的点是什么？哪些判断读者记住后现场能直接用？
不要问：`这一章的重点是什么？`

让 NotebookLM 按字段直接输出候选：`title`、`phenomenon`、`dont`、`check`、`upgrade`、`why`。
如果已有 `.qa-candidates.md`，让 NotebookLM 优先吸收其中高价值 QA，不从头发散。

### 3.4 筛选，只留高价值卡

筛选标准见 [references/card-rubric.md](references/card-rubric.md)。
文风口径见 [references/card-style.md](references/card-style.md)。

默认保留：能纠正现场高频误判；能把核心判断压成可复用动作；能明确"先别下什么结论 / 先补哪组证据 / 何时才算成立"。

默认丢掉：只是章节摘要换皮；太像背景知识或定义解释；和正文已有卡片重复太高；写成方法论概述而不是判断卡。

### 3.5 输出独立文章

默认用脚本：

```bash
python .codex/skills/chapter-memory-cards/scripts/generate_memory_cards.py \
  --article "site/content/library/.../07_第7章_内存.md" \
  --notebook "<notebook_id>" \
  --source "<source_id>"
```

如需指定输出路径，加 `--output "...07_第7章_内存.记忆卡.md"`。

### 3.6 保持文章形态

输出文章包含：完整 frontmatter；一小段自然开场（不写提示腔）；3 到 5 个 `memory-card` shortcode；必要时每张卡后补一句"为什么留这张卡"。

卡片页不是 QA 列表，也不是候选稿转存。开头要像正常人在整理复习页。

## §4 终检清单

### 卡片质量

- [ ] 3 到 5 张卡片，不硬凑
- [ ] 每张卡对应一个高频误判、关键判断或排障转折
- [ ] 没有摘要换皮或定义解释类卡片
- [ ] 标题像判断，不像目录项
- [ ] 各字段各 1 句，单字段不超过 45 个汉字

### 页面形态

- [ ] 使用 `memory-card` shortcode，不是自造格式
- [ ] 有自然开场，无提示腔
- [ ] 独立文章，没有修改原章节正文
- [ ] 文件名为 `XX_第X章_标题.记忆卡.md`

### 元数据与证据

- [ ] frontmatter 通用字段 + `chapter_no` + `chapter_basis` 齐全
- [ ] `evidence_status` 准确
- [ ] `status`、`evidence_status`、`visibility` 没混用
- [ ] 无 SKILL 内部术语泄露
- [ ] 无文章自我指涉
- [ ] 读起来舒服

## 资源

- 黄金标准：[gold-standard.md](./references/gold-standard.md)
- 卡片筛选口径：[card-rubric.md](./references/card-rubric.md)
- 卡片文风口径：[card-style.md](./references/card-style.md)
- 页面模板：[memory-cards.template.md](./assets/memory-cards.template.md)
