# 随手记

个人站点：技术笔记 + 生活记录（涂鸦、音乐、旅行）。

**入口**：[线上站点](https://anonymous772066235.github.io/SolitaryOrchid/) · [本地首页](index.html) · [RSS](feed.xml)

纯静态，手写 HTML / CSS / JS，无第三方库；Markdown 由 `src/build.ps1` 生成页面，托管于 GitHub Pages。

## 页面

| 路径 | 内容 |
|---|---|
| `index.html` | 首页：点云动画、唱机、画廊入口、旅行照片 |
| `posts/` | 文章归档与文章页（已搭好，暂未启用） |
| `gallery/` | 涂鸦：年份筛选 + 灯箱 |
| `music/` | 听歌：曲目列表 |
| `travel/` | 旅行记录 |
| `about/` | 关于 |

## 构建

首页、涂鸦、听歌、旅行、关于、404 等页面都由 `src/build.ps1` 生成：

```powershell
powershell -ExecutionPolicy Bypass -File src\build.ps1
```

改动 `src/data/*.json`（曲目、涂鸦、景点）或 `src/layouts/` 后重跑一次即可。

本地预览用静态服务器打开仓库根目录（VS Code Live Server、`python -m http.server` 均可）；直接双击 html 时浏览器会禁止无刷新导航，换页时音乐会中断，这是 `file://` 的限制。

## 结构

```
index.html posts/ gallery/ music/ travel/ about/   生成的页面
css/site.css  js/site.js                          全局样式与脚本
src/build.ps1                                     构建脚本
src/layouts/                                      模板（base / home / post / post-list / page）
src/content/posts/  src/content/pages/            文章与独立页面的 Markdown
src/data/                                         gallery.json / music.json / travel.json
Pages/                                            旧地址跳转页 + 图片、音频资源
.nojekyll                                         跳过 Jekyll，原样发布
```

## 说明

- 播放器与 `<audio>` 放在 `<main>` 之外，Pjax 只替换正文，换页时音乐不中断、自动续播下一首
- `src/build.ps1` 需保持 **UTF-8 with BOM**，否则 PowerShell 5.1 读中文会乱码
- 换自定义域名时，改 `src/build.ps1` 里的 `$siteBase`

## 许可

代码 MIT；文章与图片内容保留所有权利。
