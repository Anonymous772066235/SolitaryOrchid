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
├── travel/               旅行记录（生成，数据取自 src/data/travel.json）
├── css/site.css          内容站设计系统（唯一全局样式）
├── js/site.js            主题、Pjax 导航、阅读增强、灯箱、播放器、点云
├── Pages/
│   ├── drawing/          跳转页 + 涂鸦图片（图片被 gallery 复用）
│   ├── music/            跳转页 + 音频与封面（被 music 复用）
│   └── enshi/            跳转页 + 风景照（图片被 travel 复用）
├── src/
│   ├── build.ps1         构建脚本
│   ├── layouts/          base / home / post / post-list / page 模板
│   ├── content/posts/    文章 Markdown
│   ├── content/pages/    独立页面 Markdown（about）
│   └── data/             页面数据（gallery.json / music.json）
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

- Pjax 无刷新导航：页面切换只替换 `<main>`，**音乐不中断**、自动续播下一首
- 全站常驻浮动播放器（单曲切换、进度拖动、曲目记忆）
- 首页唱机：封面随播放旋转，曲目列表一键切换
- 深浅色切换（跟随系统 + 手动记忆）
- 文章阅读进度条、目录跟随高亮
- 涂鸦页年份筛选 + 马赛克错落布局 + 原生 `<dialog>` 灯箱
- 旅行页图片网格与灯箱，景点图文分节
- 首页 Canvas 2D 点云动画（无 Three.js 依赖，尊重 `prefers-reduced-motion`）

## 部署

推送到 `master` 即自动部署到 GitHub Pages：

```
https://anonymous772066235.github.io/SolitaryOrchid/
```

仓库根目录的 `.nojekyll` 会让 Pages 跳过 Jekyll 构建，直接发布静态文件。

## 许可

代码以 MIT 许可发布；文章与图片内容保留所有权利。
