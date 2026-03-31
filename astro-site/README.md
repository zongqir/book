# Astro Site

这个目录是读书库的新渲染层。

当前策略不是替换 `site/`，而是并行迁移：

- 内容源继续放在 `site/content/library/`
- 站点索引继续复用 `site/static/data/site-content.json`
- 静态资源继续复用 `site/static/`

本地开发：

```bash
cd astro-site
npm install
npm run dev
```

构建：

```bash
cd astro-site
npm run build
```

当前目标：

- 先把内容渲染和路由迁到 Astro
- 保持内容结构不变
- 给后续更复杂的交互留空间
