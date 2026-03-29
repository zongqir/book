# 达标参考：RAG 落地最佳实践
假设用户说：帮我开一个关于 RAG 落地的研究专题。

## topic.yml 好写法

```yaml
title: "RAG落地"
goal: "形成一版可落地的 RAG pipeline 选型与配置规范"
scope:
  in:
    - "检索层架构选型：向量数据库、chunk 策略、retriever 实现"
    - "生成层集成：prompt 组装、上下文窗口管理、幻觉控制"
    - "评估方法：召回率、准确率、端到端效果度量"
  out:
    - "通用 LLM 微调和预训练"
    - "前端交互和产品设计"
    - "成本核算和商业模式"
sources: []
deliverables:
  - "00_规范草案.md"
  - "01_决策记录.md"
  - "02_实施清单.md"
status: "draft"
created_at: "2026-03-24"
updated_at: "2026-03-24"
question:
  core: "在当前技术栈下，RAG pipeline 各环节怎么选型和配置才能稳定交付？"
success_criteria:
  - "检索层选型有对比依据，不是拍脑袋"
  - "生成层集成有可复现的 prompt 方案"
  - "评估指标能跑通，不只是理论指标"
next_step: "整理 3 到 5 份 RAG 架构类材料进入 sources/"
```

### 好在哪里

- `goal` 只写了一件事：形成规范
- `scope.in` 按技术层分三条，每条可独立推进
- `scope.out` 排除了三个容易跑偏的方向
- `question.core` 能影响材料选择和输出结构
- `next_step` 是最短动作，不是口号

## README 好写法

> 当前项目需要上线 RAG 能力，但检索层选型没有对比依据，生成层集成全靠试错。
> 这个专题要形成一版可落地的 pipeline 规范，让选型和配置有据可依。

- 第一段直接交代痛点和目标，不是"本专题旨在研究……"
- 纳入和排除都具体，不是"RAG 相关的一切"
- 预期输出和 `deliverables` 对齐

## 首轮动作好写法

```markdown
## 立即动作

1. 整理 3 到 5 份 RAG 架构类文章进入 `sources/`
2. 在 NotebookLM 围绕"chunk 策略对召回率的影响"做第一轮提问
3. 把核对结果回写到 `exports/00_briefing.md`

## 待验证判断

- 固定 chunk size 是否真的不如语义切分
- 向量数据库选型是否需要区分在线和离线场景
```
### 好在哪里

- 每条都是最短动作，不是"全面调研 RAG"
- 有明确的文件路径
- 待验证判断可以直接转成下一轮 research 任务
