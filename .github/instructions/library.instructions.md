---
applyTo: "site/content/library/**/*"
---

# Library Content Instructions

这组规则只适用于 `site/content/library/` 下的资料库内容。

通用仓库规则仍以 `AGENTS.md` 为准；本文件是给 Copilot 的资料库路径级强化规则。

## 默认工作流

处理单书内容时，按这个顺序：

1. 确认目标书在 `site/content/library/` 下的实际位置
2. 确认单书目录是否已存在
3. 确认当前任务对应哪个固定槽位
4. 打开对应 `.codex/skills/*/SKILL.md`
5. 做差异化诊断
6. 先补 frontmatter，再写正文
7. 提交前跑校验

不要跳过第 4 步。

## 高歧义请求默认解释

这些说法默认都算高歧义：

- 看看某本书
- 分析某本书
- 聊聊某本书
- 先做一下某本书
- 解读某本书

处理方式：

- 不要先脑补成某个槽位
- 先看同分类下是否已有稳定单书样例
- 如果分类和默认套件已经清楚，直接按项目默认套件开工
- 只有分类也不清楚，或同类样例没有稳定落点时，才停在“确认目录 + 明确拟落槽位”

## 默认核心套件

当用户说“按项目约定拆解”“按项目默认来”“直接解读这本书”，且分类已清楚时，默认补：

- `00`
- `02`
- `03`
- `04`
- `05`
- `06`
- `10`

对原则密度和论证密度都明显高的书，再补：

- `01`
- `08`

## 固定槽位映射

- `00_为什么读这本书.md` -> `.codex/skills/book-why-read/SKILL.md`
- `01_核心原则.md` -> `.codex/skills/book-principle-extractor/SKILL.md`
- `02_最值得记住的句子.md` -> `.codex/skills/book-key-sentences/SKILL.md`
- `03_最有价值的案例.md` -> `.codex/skills/book-best-cases/SKILL.md`
- `04_行动指南.md` -> `.codex/skills/book-action-guide/SKILL.md`
- `05_方法论总结.md` -> `.codex/skills/book-methodology/SKILL.md`
- `06_适用边界与失效条件.md` -> `.codex/skills/book-boundaries-and-failure-modes/SKILL.md`
- `08_论证链.md` -> `.codex/skills/book-evidence-chain/SKILL.md`
- `09_迁移地图.md` -> `.codex/skills/book-transfer-map/SKILL.md`
- `10_复盘指标.md` -> `.codex/skills/book-review-metrics/SKILL.md`

## 差异化诊断是硬要求

每本书动笔前都必须先回答这三问，并让结果实际影响输出：

1. 这本书的论证方式是什么
2. 同分类下已有书用了什么结构和切入角度
3. 这本书自己的语气和节奏是什么

如果发现这本书和同分类已有书太像，必须主动换一种组织方式。

## frontmatter 基座

单书正式文稿默认至少包含：

- `title`
- `book_title`
- `created_at`
- `updated_at`
- `status`
- `summary`
- `intent`
- `source_basis`
- `evidence_status`

常用可选字段：

- `author`
- `audience`
- `confidence`
- `visibility`
- `differentiation_notes`

额外要求：

- `created_at` / `updated_at` 默认写“昨天”的带时区完整时间
- `_index.md` 默认只写短 frontmatter，不写正文
- 未贴源时，`evidence_status` 写 `llm-draft`
- `status`、`evidence_status`、`visibility` 不要混用

## 关键槽位边界

- `00` 只回答阅读入口和读完后会留下什么判断，不写成导购稿、摘要稿、方法稿
- `01` 只写原则层，不把观点、方法、步骤混进来
- `02` 必须是 `sentence shortcode + 短解读`
- `03` 写调用场景，不写成观点摘要；标题不要写 `案例一 / 案例二`
- `04` 写执行稿，不写成方法论；标题不要写 `第一步 / 第二步`
- `05` 写方法本身和组织逻辑，不写具体步骤；不要把 `主方法 / 方法强度` 直接端给读者
- `06` 写适用边界、误用和停退换信号，不写成空泛警告
- `08` 写推理链，不写成摘要，不用同一套机械链条模板
- `10` 写场景式自检，不写成 KPI 表或打分表

## 正文表达硬约束

- 直接写判断、结论、动作
- 用具体对象替代“这本书”“很多人”“真正重要的”
- 每段只承载一个核心判断
- 段落长短交替，避免全篇均匀块
- 句子尽量短；术语首次出现时立即自解释
- 小标题写内容本身，不写结构角色
- 不写“这篇文章会”“这页主要回答”“如果把它压成一句话”
- 不把导购分群和加工动作写成正文重心
- 不把工作流内部术语直接给读者看

## 高危反模式

发现这些时，优先改掉：

- `案例一 / 案例二`
- `第一步 / 第二步`
- `主方法 / 方法强度 / 调用信号`
- `适合谁 / 更适合哪种人`
- `这篇文章会 / 这页主要回答 / 这页写的是`
- `如果把……压成……`
- 高频泛指代词：`这本书 / 这套方法 / 整套体系`

## 提交前最少校验

- `python3 scripts/check-frontmatter.py`
- `python3 scripts/check-astro-build.py`

并至少搜索：

- `这本书`
- `这套方法`
- `整套体系`
- `最值得`
- `真正`
- `第一章`
- `第二章`
