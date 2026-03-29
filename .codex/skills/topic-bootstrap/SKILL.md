---
name: topic-bootstrap
description: 为本仓库的新研究专题建立中文专题骨架、topic.yml、README、sources/notes/exports/outputs 目录和首轮研究问题。用户要求新建专题、初始化 topic.yml、开始一个研究主题、搭专题目录、给某个问题开题，或需要先明确 goal、scope、deliverables、status 再接 NotebookLM 与 dida-cli 时使用。
---

# 专题启动

把这个 skill 当成研究启动层，不是写稿层。目标是把模糊问题压成正式专题，建好骨架，给后续贴源分析和任务推进留出接口。

## §1 命中判断

按这个 skill 处理：
- 用户要新建一个研究专题
- 用户要初始化 `topic.yml`、搭专题目录
- 用户说"给某个问题开题""开始研究某个方向"
- 用户需要先明确 goal、scope、deliverables 再接后续流程

不要落到这个 skill：
- 专题已启动，需要拆任务推进：去 `dida-research-closure`
- 需要贴源核对或多材料比对：去 `notebooklm-source-check`
- 需要直接写单书文稿：去对应的单书槽位 skill
- 需要产出完整研究结论：这个 skill 只负责开题

## §2 元数据与产出

### 5 个元素

真正动手前，先把模糊话题压成这 5 件事：

1. **专题名**：简短，和目录名一致
2. **一句话 goal**：这轮研究要完成什么
3. **scope.in**：当前轮次真正要做的，3 到 6 条
4. **scope.out**：当前轮次明确不做的
5. **deliverables**：输出物清单，和专题类型一致

用户只给了大方向也不空等。先写最小可用版本，不确定项留在 `draft` 状态。

### topic.yml 规格

没有 `topic.yml` 的专题不算正式启动。字段口径见 [topic-yml-schema.md](./references/topic-yml-schema.md)。

最低要求：
- `goal` 只写一件事
- `scope.in` 只保留当前轮次真正要解决的
- `scope.out` 明确写出这轮故意不做什么
- `deliverables` 和专题类型一致
- `status` 从 `draft` 开始，除非材料已够进入分析

### 目录结构

```
专题名/
├── topic.yml
├── README.md（或 _index.md）
├── sources/
├── notes/
│   ├── current-judgment.md
│   ├── open-questions.md
│   └── next-actions.md
├── exports/
└── outputs/
```

### 产出位置

默认创建在仓库根目录 `90_专题研究/`。用户明确要求时才写到 `site/content/library/90_专题研究/`。

## §3 工作流

### 1. 压缩 5 元素

拿到用户的模糊需求，先提取专题名、goal、scope.in、scope.out、deliverables。能推断的直接填，推断不了的写占位并标 `draft`。

### 2. 运行脚手架脚本

默认先运行 [scripts/init_topic.py](./scripts/init_topic.py)：

```powershell
python .codex/skills/topic-bootstrap/scripts/init_topic.py "专题名" --repo-root .
python .codex/skills/topic-bootstrap/scripts/init_topic.py "专题名" --repo-root . --goal "一句话目标"
python .codex/skills/topic-bootstrap/scripts/init_topic.py "专题名" --repo-root . --scope-in "范围1" --scope-out "排除项"
```

Hugo 内容目录用 `--mode site`。

### 3. 收紧 topic.yml

脚手架生成后立刻检查，不要把模板值原样留着。按 [topic-yml-schema.md](./references/topic-yml-schema.md) 逐字段收紧。

### 4. 补首页和首轮动作

脚手架只搭骨架，生成后尽快补：
- `README.md`：这个专题为什么存在
- `notes/next-actions.md`：第一轮收集、贴源、收敛动作

用户给了足够上下文时，顺手补 `sources/` 首批候选材料、`notes/current-judgment.md` 初步判断、`outputs/` 里的专题标题和适用范围。

### 5. 不越界

这个 skill 只负责启动，不负责：
- 替代 NotebookLM 做贴源分析
- 替代 `dida-cli` 长期跟踪任务
- 直接产出完整研究结论

正确顺序：启动专题 → 收集材料 → NotebookLM 贴源 → 回写结果。

## §4 终检清单

- [ ] `topic.yml` 已生成且不是模板原样
- [ ] `goal` 只写了一件事，不是口号
- [ ] `scope.in` 在 3 到 6 条之间
- [ ] `scope.out` 至少有一条明确排除项
- [ ] `deliverables` 和专题类型一致
- [ ] `status` 是 `draft`（除非材料已足够进入分析）
- [ ] 目录骨架完整：`sources/`、`notes/`、`exports/`、`outputs/`
- [ ] `README.md` 写了这个专题为什么存在，不是模板占位
- [ ] `notes/next-actions.md` 有具体的首轮动作
- [ ] 没有越界做贴源分析或产出完整结论

## 资源

- [scripts/init_topic.py](./scripts/init_topic.py)：专题脚手架脚本
- [references/topic-yml-schema.md](./references/topic-yml-schema.md)：`topic.yml` 字段口径
- [assets/topic.yml.template](./assets/topic.yml.template)：`topic.yml` 模板
- [assets/README.template.md](./assets/README.template.md)：专题首页模板
- [gold-standard.md](./references/gold-standard.md)：达标参考，对齐启动质量
- [writing-rubric.md](./references/writing-rubric.md)：任务质量评分标准
