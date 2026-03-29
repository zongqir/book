# 任务格式

每个专题至少覆盖四类任务：

- `reading`：阅读与摘录
- `research`：NotebookLM 贴源核对、对比、引文回收
- `spec`：规范、结论、提纲或单书文稿输出
- `review`：审阅、修正、回写和复盘

## 每条任务最低字段

- `title`
- `category`
- `status`
- `file_path`
- `done_when`

推荐再补：

- `due_at`
- `owner`
- `depends_on`
- `notes`

## 好任务的标准

好任务应该满足：
- 一眼能看出要做什么
- 做完以后知道该回写到哪里
- 完成与未完成能分清
- 不依赖隐形上下文

## 改写示例

- 差：`研究一下这本书`
- 好：`reading | 浏览目录、序言和结尾，更新 00_为什么读这本书.md 的 summary`

- 差：`做一轮 NotebookLM`
- 好：`research | 围绕“作者如何定义 X”做一轮贴源核对，回写 exports/02_key-quotes.md`

- 差：`继续整理输出`
- 好：`spec | 把当前判断收敛成 outputs/00_规范草案.md 的适用范围与规则条目`

## 一轮最小闭环

至少包含：

1. 一条 `reading`
2. 一条 `research`
3. 一条 `spec`
4. 一条 `review`

如果少于这四类，通常说明闭环还没真正立起来。
