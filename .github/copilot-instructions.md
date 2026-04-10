# GitHub Copilot Repository Instructions

本仓库的仓库级真源规则在 `AGENTS.md`。

- 先读 `AGENTS.md`
- 如果任务落在 `site/content/library/`，再读 `.github/instructions/library.instructions.md`
- 如果任务是单书固定槽位写作，再打开对应 `.codex/skills/*/SKILL.md`

## 仓库定位

- 这是一个读书拆解和站点内容生产仓库，不是通用应用代码仓库
- 默认工作重心在 `site/content/library/`
- 站点展示层在 `astro-site/`
- 静态资源和导出数据在 `site/static/`
- 项目级槽位 skills 在 `.codex/skills/`

## 默认行为

- 用户让你“看看某本书”“按项目约定拆解一本书”“补齐某本书文稿”“改写资料库某篇正式文章”时，默认直接修改 `site/content/library/` 下对应内容
- 不要在根目录维护一套平行正文树
- 如果用户明确处理展示层、页面收录、图文件引用、PWA 或评论开关，再改 `astro-site/src/`、`site/static/`、`astro-site/astro.config.mjs`

## 批量任务先避开限流

- 批量写作时，主 agent 先统一读规则、样例和差异化结果，再把压缩后的上下文发给 subagent
- 重型写作 subagent 默认同时只开 2 个，最多 3 个；不要一次性铺开更多长上下文 agent
- 单个 subagent 默认只写 1 本书的核心套件；只有任务明显更轻时，才让一个 agent 处理 2 本书
- subagent 默认直接落盘，只回一句状态和缺失文件列表；不要回传长过程
- 按波次推进，每波结束先查落盘文件，再开下一波
- 触发 429 或类似限流时，先补缺文件，不整批重跑
- frontmatter 校验、astro build 等重检查默认放在写作波次之后，不和大批写作 agent 长时间重叠

## 单书固定槽位必须先路由

不要对这些文件直接凭习惯写作。先定位槽位，再读对应 skill：

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

## 要守住的边界

- `04_行动指南.md` 写执行动作、判断点、完成标准，不写成方法说明书
- `05_方法论总结.md` 写方法本身和组织逻辑，不写具体执行步骤
- `03_最有价值的案例.md` 写可调用场景，不写成观点摘要
- `00_为什么读这本书.md` 写阅读入口和留下来的判断，不写成导购稿或摘要稿

## frontmatter 基本要求

正式单书文稿默认至少包含：

- `title`
- `book_title`
- `created_at`
- `updated_at`
- `status`
- `summary`
- `intent`
- `source_basis`
- `evidence_status`

额外要求：

- `created_at` / `updated_at` 默认写“昨天”的带时区完整时间
- 未贴源时，`evidence_status` 默认写 `llm-draft`
- 不要混用 `status`、`evidence_status`、`visibility`

## 文风与结构硬约束

- 直接写判断、结论、动作，不写“这篇文章会”“这页主要回答”
- 用具体对象替代泛指
- 每段只说一件事
- 标题写内容判断，不写结构壳
- 不要用 `案例一 / 案例二 / 第一步 / 第二步`
- 不要把 `主方法 / 方法强度 / 调用信号` 这类内部工作术语直接放进正文
- 不要把“适合谁”“更适合哪种人”写成正文重心

## 提交前最少校验

- `python3 scripts/check-frontmatter.py`
- `python3 scripts/check-astro-build.py`

如果只改了 `site/content/library/`，也应额外搜索高频反模式，例如：

- `这本书`
- `这套方法`
- `整套体系`
- `最值得`
- `真正`

## 维护原则

如果这里与 `AGENTS.md` 冲突，以 `AGENTS.md` 为准。

如果规则只对资料库内容成立，优先改 `.github/instructions/library.instructions.md`。
