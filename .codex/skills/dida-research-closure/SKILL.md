---
name: dida-research-closure
description: 为本仓库把研究工作拆成 dida-cli 可持续推进的任务清单，并把收集、阅读、贴源分析、输出、审阅接成闭环。用户要求把研究推进成任务、整理下一步动作、把专题拆成 reading/research/spec/review 四类任务，或希望避免"只收集不推进"时使用。
---

# 研究闭环

把这个 skill 当成推进层，不是写稿层。目标是把研究拆成连续短动作，让阅读、贴源、输出和审阅形成闭环。

## §1 命中判断

出现下面这些情况，按这个 skill 处理：
- 用户要把研究工作拆成可推进的任务
- 用户要整理下一步动作、闭环清单
- 专题已有 `topic.yml` 但迟迟没有推进
- 出现"只收集不推进"的信号
- 用户明确提到 `dida-cli` 或任务拆分

不要落到这个 skill 的情况：
- 需要新建专题骨架：去 `topic-bootstrap`
- 需要贴源核对或多材料比对：去 `notebooklm-source-check`
- 需要直接写单书文稿：去对应的单书槽位 skill
- 需要产出完整研究结论：先确认是否应该在 `outputs/` 落稿

## §2 元数据与产出

### 四类任务

每个研究闭环至少覆盖四类：

| 类型 | 含义 | 典型动作 |
|------|------|----------|
| `reading` | 阅读与摘录 | 浏览目录、抽样正文、整理关键章节 |
| `research` | 贴源核对 | NotebookLM 问答、引文回收、多材料比对 |
| `spec` | 结论输出 | 规范草案、决策记录、单书文稿 |
| `review` | 审阅修正 | 回写判断、复盘指标、修正边界 |

如果当前只剩一种任务，通常说明拆得还不够。

### 每条任务的 5 个要素

- **标题**：一眼看出要做什么
- **状态**：todo / doing / done
- **截止时间或执行窗口**
- **关联文件路径**：做完回写到哪里
- **完成标记**：可判断，不是"更有理解了"

详细口径见 [task-format.md](./references/task-format.md)。

### 每轮回写产物

一轮任务结束后，至少有一个动作落回仓库：
- 更新 `notes/current-judgment.md`
- 更新 `notes/next-actions.md`
- 新增或更新一个 `exports/` 文件
- 新增或更新一个 `outputs/` 文件

任务系统推进了但仓库没更新，研究没有真正积累。

## §3 工作流

### 1. 按四类任务拆分

拿到研究推进需求后，先把当前阶段的工作分到 reading / research / spec / review 四个桶里。每个桶至少一条。

### 2. 先写最短动作

不要一上来就写大任务。下面这些是反例：
- ❌ `完成这个专题`
- ❌ `把这本书研究完`

更好的写法：
- ✅ 整理 3 到 5 份核心材料进入 `sources/`
- ✅ 围绕问题 X 做一轮贴源核对，回写 `exports/01_source-comparison.md`
- ✅ 改写 `outputs/00_规范草案.md` 的适用范围部分

每条任务只对应一个清楚动作，和文件路径绑定。

### 3. 不要发明 dida-cli 语法

如果需要执行 `dida-cli` 命令但不确定语法，先看本地帮助或现有用法。这个 skill 负责任务口径和闭环设计，不凭空猜命令。

### 4. 标明依赖关系

如果一条任务依赖 NotebookLM 贴源输出或其他任务的结果，直接写清依赖。不要让执行者自己猜前置条件。

### 5. 回写后再收工

每轮结束检查：
- 仓库里有没有新增或更新过的文件
- `notes/next-actions.md` 是否反映了最新状态
- 完成标记是否都能判断

## §4 终检清单

- [ ] 四类任务（reading / research / spec / review）至少各一条
- [ ] 每条任务都有标题、状态、文件路径、完成标记
- [ ] 没有出现大口号式任务（"完成这个专题""研究完这本书"）
- [ ] 完成标记可判断，不是"有更多理解""深入了解"
- [ ] 每条任务只对应一个动作，不是一条里塞三件事
- [ ] 依赖关系写清楚，不靠隐形上下文
- [ ] 至少有一个回写动作落回仓库
- [ ] 没有凭空发明 dida-cli 语法

## 资源

- [task-format.md](./references/task-format.md)：研究任务的拆分口径
- [research-checklist.template.md](./assets/research-checklist.template.md)：一轮研究闭环清单模板
- [gold-standard.md](./references/gold-standard.md)：达标参考，对齐任务拆分质量
- [writing-rubric.md](./references/writing-rubric.md)：任务质量评分标准
