# 单书 review 分发与落盘规范

## 目标

把单书 review 从 main 的职责里拿出来。

- `main` 只负责按书分发
- `subagent` 只负责按篇 review 并落盘
- review 结果默认持久化，但不进入默认展示流
- `subagent` 完成后，只回给 `main` 一句结果

这份规范解决的不是正文怎么写，而是：单书正文写完后，谁负责审、审什么、结果落到哪里。

## 角色分工

### main 只做分发，不做审查

`main` 只负责这几件事：

1. 找到还没处理或还没 review 的书
2. 按**书籍维度**把目录交给某个 `subagent`
3. 维持 **5 个并发 subagent**；谁先完成，就立刻补发下一本可用的书
4. 检查这本书下每篇正式文稿是否都有对应的 `.review.md`
5. 如果缺 review 文件，再次分发该书目录

`main` 不负责：

- 判断 slot 是否成立
- 判断正文是否过度压缩
- 判断是否该拆页、转 `.QA.md` 或改走逐章
- 阅读长篇 review 说明

`main` 的判断只有一个：**有没有 review 文件。**

并发默认值固定为 **5**。`main` 不需要等一轮全部结束再统一补发；哪个 `subagent` 先完成，就把下一本可用的书递过去。

### subagent 负责逐篇 review

`subagent` 接到的是**一本书目录**，不是单篇文章。

它要在这本书内部完成：

1. 找出需要 review 的正式文稿
2. 对每篇正文生成对应 `.review.md`
3. 在每个 review 文件里完成三类判定：
   - `slot-fit`：这页是不是这个 slot；是否符合该 slot 对应 skill 的规范
   - `coverage`：有没有压缩过头，导致内容只剩摘要感，撑不起正式展示
   - `granularity`：这一页是否已经装不下；如果继续塞在一篇里，会不会读起来发硬、发满、AI 味很重
4. 把详细判断写进 `.review.md`
5. 最后只给 `main` 回一条一句话结果

## review 文件命名

每篇正文对应一个同名 review 文件。

正文：

- `00_为什么读这本书.md`
- `05_方法论总结.md`
- `08_论证链.md`

对应 review：

- `00_为什么读这本书.review.md`
- `05_方法论总结.review.md`
- `08_论证链.review.md`


## review 文件属性

review 文件是过程材料，不进入默认展示流。

统一使用：

```yaml
visibility: "internal"
```

## review 文件建议 frontmatter

review 文件使用 Markdown + frontmatter，而不是纯 yaml。

推荐字段：

```yaml
---
title: "《书名》05_方法论总结 review"
book_title: "书名"
created_at: "2026-04-05T10:00:00+08:00"
updated_at: "2026-04-05T10:00:00+08:00"
visibility: "internal"
review_target: "05_方法论总结.md"
slot: "05"
review_verdict: "rewrite-required"
review_scope:
  - slot-fit
  - coverage
  - granularity
---
```

## review_verdict 取值

统一只用这几类：

- `pass`
- `rewrite-required`
- `qa-only`
- `split-recommended`
- `chapter-breakdown-recommended`

不要临时发明新 verdict。

## subagent 必做的三类审查

### 1. slot-fit

先判断这页是不是它自己。

必查：

- 当前稿有没有准确回答该 slot 的核心问题
- 有没有串到别的 slot
- 有没有把 skill 骨架直接写成输出结构
- 有没有真正符合该 slot 对应 skill 的规范标准
- 去掉文件名后，这篇稿还能不能被认出是这个 slot

如果一个稿子同时像两个 slot，默认不过，不能直接算通过。

### 2. coverage

再判断有没有压缩过头。

必查：

- 读完后，读者能不能直接拿去理解、判断或执行
- 有没有只报产物名，不展开内容
- 有没有只剩“知道主题”，没有“可用内容”
- 有没有为了收短篇幅，把最值钱的细节削平

如果正文只能让人知道“这页在讲什么”，还不能让人拿来用，默认不过。

### 3. granularity

最后判断一页是否已经装不下。优先考虑能不能在原文里补足；只有补不动了，再判断是否该拆页或逐章。

必查：

- 是否塞进了多个相互独立的大判断
- H2 之间是否已经不是并列，而是不同层级
- 任一段或任一 H2 是否已经足够单独成文
- 当前书是否属于 00-10 压不住的类型

如果单页明显装不下，不要靠压缩硬过。应在 review 中明确给出：

- 优先考虑在当前正文内补足关键缺口
- 如果补足后仍然装不下，再建议拆页
- 如果这本书整体就不是单页能压住的，再建议逐章


## main 的并发调度方式

默认并发数是 **5**。

调度原则只有两条：

1. 尽量让 5 个 `subagent` 一直有书可做
2. 任何一个 `subagent` 完成后，马上补发下一本可用的书，不等其他 agent

这里的“可用”指的是：

- 这本书目录已经存在
- 这本书下还有正式文稿缺 `.review.md`
- 当前没有被另一个 `subagent` 重复处理

`main` 的职责是维持队列，不是理解 review 内容。

## subagent 交回给 main 的格式

详细判断写进 `.review.md`。

交回 `main` 的结果只保留**一句话**。

允许的风格：

- `《书名》review 已补齐。`
- `《书名》缺失 review 已生成，详细结果已写入各篇 .review.md。`

不要给 `main` 回传：

- 长段总结
- 每篇 verdict 列表
- 大段问题说明
- review 正文内容

因为 `main` 只负责分发，不负责读长说明。

## main 的最小检查逻辑

对一本书目录，逐篇检查正式文稿是否存在同名 `.review.md`。

### 通过条件

- 每篇正式文稿都有对应 `.review.md`

### 不通过条件

- 任一正式文稿缺少同名 `.review.md`

一旦缺失，`main` 只做一件事：**把整本书目录重新交给某个 subagent。**



## 推荐工作流

1. `main` 发现一本书缺 review
2. `main` 把该书目录分发给 `subagent`
3. `subagent` 逐篇生成 `.review.md`
4. `subagent` 只回一句话给 `main`
5. `main` 继续检查下一本书

## 这份规范的核心句

- `main` 按书分发，只查 review 是否存在
- `subagent` 按篇 review，详细结果写入 `.review.md`
- review 文件统一 `visibility: internal`
- 回传给 `main` 的结果只保留一句话
