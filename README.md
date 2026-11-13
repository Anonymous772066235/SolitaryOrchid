# 随手记

个人内容站：技术笔记（三维数据处理与可视化、前端）+ 生活记录（涂鸦、音乐、旅行）。

纯静态站点，手写 HTML / CSS / JS，由一个构建脚本把 Markdown 生成整站，托管于 GitHub Pages。

## 目录结构

```
.
├── index.html            首页（由 src/build.ps1 生成）
├── posts/                文章列表与文章页（生成）
├── gallery/              涂鸦（生成，数据取自 Pages/drawing）
├── music/                听歌看剧（生成，数据取自 src/data/music.json）
├── about/                关于（生成）
├── 404.html              自定义 404（生成）
├── sitemap.xml / feed.xml / robots.txt / favicon.svg（生成）
├── css/
│   ├── site.css          内容站设计系统
│   └── style.css         旧页面样式（Pages/* 仍在用）
├── js/
│   ├── site.js           主题、导航、阅读进度、灯箱、播放器、点云
│   └── main.js 等        旧页面脚本
├── Pages/
│   ├── drawing/          涂鸦原页面与图片（图片被新 gallery 复用）
│   ├── music/            音乐原页面与音频、封面（被新 music 复用）
│   └── enshi/            旅行记录（旧模板页，导航直接链接）
├── src/
│   ├── build.ps1         构建脚本
│   ├── layouts/          base / home / post / post-list / page 模板
│   ├── content/posts/    文章 Markdown
│   ├── content/pages/    独立页面 Markdown（about）
│   └── data/music.json   音乐页数据
└── .nojekyll             跳过 Jekyll，原样发布
```

## 写作流程

1. 在 `src/content/posts/` 新建 `my-post.md`：

```markdown
---
title: 文章标题
date: 2026-11-20
tags: 可视化, 前端
summary: 一句话摘要。
---

## 小节标题

正文……
```

2. 构建：

```powershell
powershell -ExecutionPolicy Bypass -File src\build.ps1
```

3. 本地预览：任意静态服务器打开仓库根目录即可（例如 `python -m http.server` 或 VS Code Live Server）。

4. 提交并推送，GitHub Pages 会自动更新。

## 构建脚本做了什么

- 解析 front matter（title / date / tags / summary）
- 把 Markdown 子集（标题、段落、列表、代码块、引用、分隔线、行内语法）转成 HTML
- 从二级、三级标题生成文章目录
- 按输出深度替换 `{{ROOT}}`，同一套模板可用于任意层级
- 生成文章列表、首页最新文章、`sitemap.xml`、`feed.xml`、`404.html`、`favicon.svg`

支持的 Markdown 语法刻意保持精简，够写博客即可。

## 功能

- 深浅色切换（跟随系统 + 手动记忆）
- 文章阅读进度条、目录跟随高亮
- 涂鸦页年份筛选 + 原生 `<dialog>` 灯箱
- 音乐页底部常驻播放器，记住上次曲目与进度
- 首页 Canvas 2D 点云动画（无 Three.js 依赖，尊重 `prefers-reduced-motion`）

## 部署

推送到 `master` 即自动部署到 GitHub Pages：

```
https://anonymous772066235.github.io/SolitaryOrchid/
```

仓库根目录的 `.nojekyll` 会让 Pages 跳过 Jekyll 构建，直接发布静态文件。

## 许可

代码以 MIT 许可发布；文章与图片内容保留所有权利。
