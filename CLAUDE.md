@AGENTS.md

# Claude Code Compatibility

这个文件是给 Claude Code 的兼容入口。

- 仓库通用规则、目录真相、默认路由、frontmatter 基座真源：以 `AGENTS.md` 为准
- 单书固定槽位的具体写法：以 `.codex/skills/*/SKILL.md` 为准
- 如果本文件与 `AGENTS.md` 冲突，优先遵循 `AGENTS.md`

## 你在这个仓库里默认要做什么

- 这是一个读书拆解和站点内容生产仓库，不是应用代码仓库
- 默认围绕 `site/content/library/` 工作
- 用户要求“看看某本书”“按项目约定拆解一本书”“补齐某本书文稿”“改写资料库某篇正式文章”时，默认目标是直接修改 `site/content/library/` 下对应目录与文稿，而不是只给建议
- 如果任务明确是展示层、页面收录、图文件引用、PWA 或评论开关，再改 `astro-site/src/`、`site/static/`、`astro-site/astro.config.mjs`

## 处理单书内容时的必走顺序

1. 先确认目标书在 `site/content/library/` 下的实际位置
2. 再确认单书目录是否已经存在
3. 缺什么补什么，不重复造轮子
4. 动笔前先做差异化诊断
5. 先读 `AGENTS.md` 里对应的槽位路由，再打开对应 `SKILL.md`
6. 先补 frontmatter，再写正文
7. 提交前跑校验命令

## 差异化诊断是硬要求

写任何单书槽位前，都必须先完成这三问，并让结果实际影响产出：

1. 这本书的论证方式是什么
2. 同分类下已有书用了什么结构和切入角度
3. 这本书自己的语气和节奏是什么

不要把诊断写成形式化汇报，但必须真的执行。批量生成多本书时，还要回看前面已生成书的开头句式、H2 序列和段落节奏，避免同质化。

## 单书固定槽位映射

处理这些文件时，不要靠习惯直接写；先读对应 skill：

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

其他常见任务：

- 逐章拆解 -> `.codex/skills/engineering-book-chapter-breakdown/SKILL.md`
- 贴源分析 / 原文核对 / 书里具体怎么说 -> `.codex/skills/notebooklm/SKILL.md`
- 降低模板感 / 去 AI 味 / 读起来更松 -> `.codex/skills/writing-de-fatigue/SKILL.md`

## 处理高歧义请求时

这些默认都算高歧义请求：

- 看看某本书
- 分析某本书
- 聊聊某本书
- 先做一下某本书
- 解读某本书

处理方式：

- 不要先脑补成某个槽位
- 先看同分类下是否已有稳定单书样例
- 如果分类和默认套件已经清楚，就直接开工，不要把“高歧义”当停工理由
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

## library 正文的硬约束

- 默认中文
- 默认成熟读者视角，但不要假装掌握未提供的细节
- `_index.md` 默认只写短 frontmatter，不写正文
- 正式文稿至少包含：`title`、`book_title`、`created_at`、`updated_at`、`status`、`summary`、`intent`、`source_basis`、`evidence_status`
- `created_at` / `updated_at` 默认写“昨天”的带时区完整时间，不写今天
- 只基于模型先验、目录、抽样或未核对材料时，明确写 `evidence_status: llm-draft`
- `status`、`evidence_status`、`visibility` 不要混用
- `04_行动指南.md` 和 `05_方法论总结.md` 不要写成互相重复的变体
- 改写现有稿时，优先保留已经成立的有效段落，不要为了重写而全量推倒

## 绝对不要忽略的表达规则

- 直接写判断、结论、动作，不写导游词
- 用具体对象替代“这本书”“很多人”“真正重要的”这类泛指
- 段落长短交替，每段只说一件事
- 句子尽量短；术语首次出现时立刻用日常话解释
- 不要写“这篇文章会”“这页主要回答”“如果把它压成一句话”这类过程暴露句
- 不要用结构壳标题，例如“案例一”“第一步”“方法强度判断”“一句话总结”
- 不要把 skill 内部术语直接端给读者，例如“主方法”“方法强度”“调用信号”
- 不要把导购分群写成正文重心，例如“适合谁”“更适合哪种人”

## Claude Code 在这里要特别补的一步

Claude Code 不会自动理解 `.codex/skills/` 是技能系统。

所以只要任务落到单书槽位，必须显式打开对应 `SKILL.md` 再写。不要只读 `AGENTS.md` 就直接动笔。

## 提交前校验

至少运行：

- `python3 scripts/check-frontmatter.py`
- `python3 scripts/check-astro-build.py`

如果任务是库内容改写，还应搜索常见反模式，例如：

- `这本书`
- `这套方法`
- `整套体系`
- `最值得`
- `真正`
- `第一章`
- `第二章`

## 本文件的定位

这个文件的目标不是替代 `AGENTS.md`，而是让 Claude Code 稳定读到同一套仓库规则。

如果需要补充 Claude 专属规则，优先追加在本文件；如果是所有工具都该共用的仓库规则，优先改 `AGENTS.md`。
