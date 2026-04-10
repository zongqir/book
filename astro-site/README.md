# Astro Site

这个目录是“今天读什么”的新渲染层。

当前策略不是替换 `site/`，而是并行迁移：

- 内容源继续放在 `site/content/library/`
- 站点索引继续复用 `site/static/data/site-content.json`
- 静态资源继续复用 `site/static/`
- Web 继续走 Astro，App 壳改为 `Capacitor + Android`

本地开发：

```bash
cd astro-site
npm install
npm run dev
```

站点构建：

```bash
cd astro-site
npm run build:site
```

同步 Android 壳：

```bash
cd astro-site
npm run sync:android
```

本地生成调试包：

```bash
cd astro-site
npm run build:android:debug
```

GitHub Actions：

- `deploy-cloudflare-pages.yml` 继续负责网站部署
- `build-capacitor-android.yml` 只在推送 `app-v*` tag 时触发，构建 Android `debug APK`，发布到 GitHub Release，并在配置了 R2 后同步一份稳定的 `latest` 下载地址

当前目标：

- 先把内容渲染和路由迁到 Astro
- 保持内容结构不变
- 给后续更复杂的交互留空间
- 给 PWA 之外补一条最小可用的 App 分发路径

发布 Android 调试包：

```bash
git tag app-v0.1.0
git push origin app-v0.1.0
```

产物会出现在对应的 GitHub Release 页面，同时保留一份 Actions artifact。

如果要把 APK 同步到 Cloudflare R2，并让站点出现桌面端下载入口，需要额外配置：

- GitHub Secret `CLOUDFLARE_API_TOKEN`
- GitHub Secret `CLOUDFLARE_ACCOUNT_ID`
- GitHub Variable `CLOUDFLARE_R2_ANDROID_BUCKET`
- GitHub Variable `ANDROID_APP_DOWNLOAD_BASE_URL`

推荐把 `ANDROID_APP_DOWNLOAD_BASE_URL` 指到你的 R2 自定义域名根地址，例如 `https://downloads.example.com`。Workflow 会自动写入：

- `android/<tag>/book-<tag>-android-debug.apk`
- `android/latest/book-android-latest-debug.apk`
- `android/latest/latest.json`
