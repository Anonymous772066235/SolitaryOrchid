# build.ps1 — 极简静态站点构建
# 用法：powershell -ExecutionPolicy Bypass -File src\build.ps1
# 输出：仓库根目录下的 index.html / posts / gallery / music / about / sitemap / feed / 404 / favicon

$ErrorActionPreference = 'Stop'

$src  = $PSScriptRoot
$repo = Split-Path $src -Parent
$enc  = New-Object System.Text.UTF8Encoding($false)

$siteTitle = '随手记'
$siteDesc  = '三维数据处理与可视化 · 生活碎片'
$year      = (Get-Date).Year

function Read-Utf8([string]$p) { [System.IO.File]::ReadAllText($p, [System.Text.Encoding]::UTF8) }

function Write-Utf8([string]$p, [string]$t) {
    $dir = Split-Path $p -Parent
    if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText($p, $t, $enc)
}

function Esc([string]$s) {
    if ($null -eq $s) { return '' }
    return $s.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
}

function Inline-Md([string]$t) {
    $t = [regex]::Replace($t, '!\[([^\]]*)\]\(([^)]+)\)', '<img src="$2" alt="$1" loading="lazy">')
    $t = [regex]::Replace($t, '\[([^\]]+)\]\(([^)]+)\)', '<a href="$2">$1</a>')
    $t = [regex]::Replace($t, '\*\*([^*]+)\*\*', '<strong>$1</strong>')
    $t = [regex]::Replace($t, '(?<!\*)\*([^*]+)\*(?!\*)', '<em>$1</em>')
    $t = [regex]::Replace($t, '`([^`]+)`', '<code>$1</code>')
    return $t
}

function Convert-Markdown([string]$md) {
    $lines = ($md -replace "`r`n", "`n") -split "`n"
    $out   = New-Object System.Collections.Generic.List[string]
    $toc   = New-Object System.Collections.Generic.List[object]
    $para  = New-Object System.Collections.Generic.List[string]
    $i = 0
    $inUl = $false
    $inOl = $false
    $inQuote = $false
    $secNo = 0

    while ($i -lt $lines.Count) {
        $line = $lines[$i]
        $trim = $line.Trim()

        # ---- 代码块 ----
        if ($trim -match '^```') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inUl) { $out.Add('</ul>'); $inUl = $false }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            if ($inQuote) { $out.Add('</blockquote>'); $inQuote = $false }
            $lang = $trim.Substring(3).Trim()
            $code = New-Object System.Collections.Generic.List[string]
            $i++
            while ($i -lt $lines.Count -and $lines[$i].Trim() -notmatch '^```') {
                $code.Add($lines[$i])
                $i++
            }
            $i++
            $cls = ''
            if ($lang) { $cls = ' class="language-' + $lang + '"' }
            $out.Add('<pre><code' + $cls + '>' + (Esc ($code -join "`n")) + '</code></pre>')
            continue
        }

        # ---- 空行 ----
        if ($trim -eq '') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inUl) { $out.Add('</ul>'); $inUl = $false }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            if ($inQuote) { $out.Add('</blockquote>'); $inQuote = $false }
            $i++
            continue
        }

        # ---- 分隔线 ----
        if ($trim -match '^---+$' -and $trim.Length -ge 3) {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inUl) { $out.Add('</ul>'); $inUl = $false }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            $out.Add('<hr>')
            $i++
            continue
        }

        # ---- 标题 ----
        if ($trim -match '^(#{2,4})\s+(.*)$') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inUl) { $out.Add('</ul>'); $inUl = $false }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            if ($inQuote) { $out.Add('</blockquote>'); $inQuote = $false }
            $level = $Matches[1].Length
            $text  = $Matches[2]
            $secNo++
            $id = 'sec-' + $secNo
            $out.Add('<h' + $level + ' id="' + $id + '">' + (Inline-Md $text) + '</h' + $level + '>')
            if ($level -le 3) {
                $toc.Add(@{ Level = $level; Id = $id; Text = ($text -replace '\*', '') })
            }
            $i++
            continue
        }

        # ---- 引用 ----
        if ($trim -match '^>\s?(.*)$') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inUl) { $out.Add('</ul>'); $inUl = $false }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            if (-not $inQuote) { $out.Add('<blockquote>'); $inQuote = $true }
            $out.Add('<p>' + (Inline-Md $Matches[1]) + '</p>')
            $i++
            continue
        } elseif ($inQuote) {
            $out.Add('</blockquote>')
            $inQuote = $false
        }

        # ---- 无序列表 ----
        if ($trim -match '^[-*]\s+(.*)$') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if ($inOl) { $out.Add('</ol>'); $inOl = $false }
            if (-not $inUl) { $out.Add('<ul>'); $inUl = $true }
            $out.Add('<li>' + (Inline-Md $Matches[1]) + '</li>')
            $i++
            continue
        } elseif ($inUl) {
            $out.Add('</ul>')
            $inUl = $false
        }

        # ---- 有序列表 ----
        if ($trim -match '^\d+\.\s+(.*)$') {
            if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>'); $para.Clear() }
            if (-not $inOl) { $out.Add('<ol>'); $inOl = $true }
            $out.Add('<li>' + (Inline-Md $Matches[1]) + '</li>')
            $i++
            continue
        } elseif ($inOl) {
            $out.Add('</ol>')
            $inOl = $false
        }

        # ---- 段落 ----
        $para.Add($trim)
        $i++
    }

    if ($para.Count -gt 0) { $out.Add('<p>' + (Inline-Md ($para -join ' ')) + '</p>') }
    if ($inUl) { $out.Add('</ul>') }
    if ($inOl) { $out.Add('</ol>') }
    if ($inQuote) { $out.Add('</blockquote>') }

    return @{ Html = ($out -join "`n"); Toc = $toc }
}

function Parse-Post([string]$path) {
    $raw = (Read-Utf8 $path) -replace "`r`n", "`n"
    $lines = $raw -split "`n"
    if ($lines.Count -lt 3 -or $lines[0].Trim() -ne '---') { throw ('缺少 front matter: ' + $path) }
    $meta = @{}
    $i = 1
    while ($i -lt $lines.Count -and $lines[$i].Trim() -ne '---') {
        if ($lines[$i] -match '^([A-Za-z_]+)\s*:\s*(.*)$') { $meta[$Matches[1]] = $Matches[2].Trim() }
        $i++
    }
    $body = ''
    if ($i + 1 -le $lines.Count - 1) { $body = ($lines[($i + 1)..($lines.Count - 1)]) -join "`n" }
    $md = Convert-Markdown $body
    $plain = $body -replace '(?s)```.*?```', ''
    $plain = $plain -replace '[#*>`\[\]()!]', ' '
    $chars = ($plain -replace '\s', '').Length
    $minutes = [Math]::Max(1, [Math]::Ceiling($chars / 400))
    return @{
        Slug    = [System.IO.Path]::GetFileNameWithoutExtension($path)
        Title   = $meta['title']
        Date    = $meta['date']
        Tags    = $meta['tags']
        Summary = $meta['summary']
        Html    = $md.Html.Replace('{{', '&#123;&#123;').Replace('}}', '&#125;&#125;')
        Toc     = $md.Toc
        Minutes = $minutes
    }
}

function Render([string]$layout, [hashtable]$vars) {
    $t = Read-Utf8 (Join-Path $src ('layouts\' + $layout + '.html'))
    foreach ($k in $vars.Keys) { $t = $t.Replace('{{' + $k + '}}', [string]$vars[$k]) }
    $left = [regex]::Matches($t, '\{\{[A-Z_]+\}\}') | ForEach-Object { $_.Value } | Select-Object -Unique
    if ($left) { Write-Warning ('未替换的占位符: ' + ($left -join ', ')) }
    return $t
}

function Get-Nav([string]$root, [string]$active) {
    $items = @(
        @{ k = 'home';    t = '首页'; h = $root + 'index.html' },
        @{ k = 'gallery'; t = '涂鸦'; h = $root + 'gallery/index.html' },
        @{ k = 'music';   t = '听歌'; h = $root + 'music/index.html' },
        @{ k = 'travel';  t = '旅行'; h = $root + 'travel/index.html' },
        @{ k = 'about';   t = '关于'; h = $root + 'about/index.html' }
    )
    $sb = New-Object System.Text.StringBuilder
    foreach ($it in $items) {
        $cls = ''
        if ($it.k -eq $active) { $cls = ' class="active"' }
        [void]$sb.Append('<a' + $cls + ' href="' + $it.h + '">' + $it.t + '</a>')
    }
    return $sb.ToString()
}

function Wrap([string]$root, [string]$title, [string]$desc, [string]$body, [string]$active) {
    $pl = @()
    foreach ($t in $tracks) {
        $pl += [pscustomobject]@{
            src   = $root + 'Pages/music/music/' + [uri]::EscapeDataString($t.file)
            title = $t.title
            sub   = $t.sub
            cover = $root + 'Pages/music/img/' + [uri]::EscapeDataString($t.cover)
        }
    }
    $playlistJson = '[]'
    if ($pl.Count -gt 0) { $playlistJson = ($pl | ConvertTo-Json -Compress -Depth 3) }

    return Render 'base' @{
        SITE_TITLE = $siteTitle
        TITLE      = $title
        DESC       = $desc
        ROOT       = $root
        NAV        = (Get-Nav $root $active)
        BODY       = $body
        YEAR       = [string]$year
        EXTRA_HEAD = ''
        EXTRA_FOOT = ''
        PLAYLIST   = $playlistJson
    }
}

function Toc-Html($toc) {
    if ($toc.Count -eq 0) { return '' }
    $sb = New-Object System.Text.StringBuilder
    [void]$sb.Append('<ol>')
    foreach ($t in $toc) {
        [void]$sb.Append('<li class="lvl-' + $t.Level + '"><a href="#' + $t.Id + '">' + (Esc $t.Text) + '</a></li>')
    }
    [void]$sb.Append('</ol>')
    return $sb.ToString()
}

function Tag-Chips([string]$tags) {
    if (-not $tags) { return '' }
    return (($tags -split ',' | ForEach-Object { '<span class="chip">' + (Esc $_.Trim()) + '</span>' }) -join ' ')
}

# --------------------------------------------------------------------------
# 读取文章
# --------------------------------------------------------------------------
$postFiles = Get-ChildItem -LiteralPath (Join-Path $src 'content\posts') -Filter *.md -File
$posts = @()
foreach ($f in $postFiles) { $posts += (Parse-Post $f.FullName) }
$posts = @($posts | Sort-Object { [datetime]$_.Date } -Descending)
Write-Host ('读取文章: {0} 篇' -f $posts.Count)

# 页面数据（涂鸦 / 音乐）提前加载，首页与列表页共用
$works  = Get-Content -LiteralPath (Join-Path $src 'data\gallery.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$tracks = Get-Content -LiteralPath (Join-Path $src 'data\music.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$travel = Get-Content -LiteralPath (Join-Path $src 'data\travel.json') -Raw -Encoding UTF8 | ConvertFrom-Json

# --------------------------------------------------------------------------
# 文章页
# --------------------------------------------------------------------------
for ($i = 0; $i -lt $posts.Count; $i++) {
    $p = $posts[$i]
    $root = '../../'

    $prev = ''
    $next = ''
    if ($i -lt $posts.Count - 1) {
        $nx = $posts[$i + 1]
        $next = '<a href="' + $root + 'posts/' + $nx.Slug + '/index.html"><span>← 上一篇</span>' + (Esc $nx.Title) + '</a>'
    }
    if ($i -gt 0) {
        $pv = $posts[$i - 1]
        $prev = '<a href="' + $root + 'posts/' + $pv.Slug + '/index.html"><span>下一篇 →</span>' + (Esc $pv.Title) + '</a>'
    }

    $body = Render 'post' @{
        DATE     = (Esc $p.Date)
        READTIME = ('约 ' + $p.Minutes + ' 分钟')
        TAGS     = (Tag-Chips $p.Tags)
        TITLE    = (Esc $p.Title)
        SUMMARY  = (Esc $p.Summary)
        CONTENT  = $p.Html
        TOC      = (Toc-Html $p.Toc)
        PREV     = $prev
        NEXT     = $next
    }

    $html = Wrap $root ($p.Title + ' · ' + $siteTitle) ([string]$p.Summary) $body 'posts'
    Write-Utf8 (Join-Path $repo ('posts\' + $p.Slug + '\index.html')) $html
}

# --------------------------------------------------------------------------
# 文章列表
# --------------------------------------------------------------------------
$listSb = New-Object System.Text.StringBuilder
foreach ($p in $posts) {
    [void]$listSb.Append('<a class="post-item" href="../posts/' + $p.Slug + '/index.html">')
    [void]$listSb.Append('<h3>' + (Esc $p.Title) + '</h3>')
    [void]$listSb.Append('<p>' + (Esc $p.Summary) + '</p>')
    [void]$listSb.Append('<div class="post-meta"><span>' + (Esc $p.Date) + '</span><span>约 ' + $p.Minutes + ' 分钟</span>' + (Tag-Chips $p.Tags) + '</div>')
    [void]$listSb.Append('</a>')
}
$listBody = Render 'post-list' @{ COUNT = [string]$posts.Count; LIST = $listSb.ToString() }
$listHtml = Wrap '../' ('文章 · ' + $siteTitle) '全部文章归档' $listBody 'posts'
Write-Utf8 (Join-Path $repo 'posts\index.html') $listHtml

# --------------------------------------------------------------------------
# 首页
# --------------------------------------------------------------------------
# 首页：唱机（全部曲目，默认第一首）
$studioListSb = New-Object System.Text.StringBuilder
$n = 0
foreach ($t in $tracks) {
    $n++
    $audio = './Pages/music/music/' + [uri]::EscapeDataString($t.file)
    $cover = './Pages/music/img/' + [uri]::EscapeDataString($t.cover)
    $cls = ''
    if ($n -eq 1) { $cls = ' active' }
    [void]$studioListSb.Append('<button type="button" class="studio-item' + $cls + '" data-src="' + $audio + '" data-title="' + (Esc $t.title) + '" data-sub="' + (Esc $t.sub) + '" data-cover="' + $cover + '">')
    [void]$studioListSb.Append('<span class="idx">' + ('{0:D2}' -f $n) + '</span>' + (Esc $t.title))
    [void]$studioListSb.Append('</button>')
}
$firstTrack  = $tracks[0]
$studioCover = './Pages/music/img/' + [uri]::EscapeDataString($firstTrack.cover)
$studioTitle = Esc $firstTrack.title
$studioSub   = Esc $firstTrack.sub

# 首页：画廊入口拼贴（最新 4 张）
$collageSb = New-Object System.Text.StringBuilder
foreach ($w in @($works | Sort-Object { [int]$_.num } -Descending | Select-Object -First 4)) {
    $img = './Pages/drawing/images/' + $w.num + '-small.jpg'
    [void]$collageSb.Append('<img src="' + $img + '" alt="' + (Esc $w.name) + '" loading="lazy">')
}

# 首页：去过的地方（3 张）
$photoSb = New-Object System.Text.StringBuilder
$photos = @(
    @{ f = '大峡谷01.jpg'; t = '大峡谷' },
    @{ f = '女儿城01.jpg'; t = '女儿城' },
    @{ f = '屏山01.jpg'; t = '屏山' }
)
foreach ($ph in $photos) {
    $photoUrl = './Pages/enshi/images/' + [uri]::EscapeDataString($ph.f)
    [void]$photoSb.Append('<a class="thumb" href="./travel/index.html"><img src="' + $photoUrl + '" alt="' + (Esc $ph.t) + '" loading="lazy"><span>' + (Esc $ph.t) + '</span></a>')
}

$homeBody = Render 'home' @{
    ROOT         = './'
    STUDIO_COVER = $studioCover
    STUDIO_TITLE = $studioTitle
    STUDIO_SUB   = $studioSub
    STUDIO_LIST  = $studioListSb.ToString()
    COLLAGE      = $collageSb.ToString()
    PHOTOS       = $photoSb.ToString()
    WORKCOUNT    = [string]$works.Count
    TRACKCOUNT   = [string]$tracks.Count
}
$homeHtml = Wrap './' ($siteTitle + ' · ' + $siteDesc) $siteDesc $homeBody 'home'
Write-Utf8 (Join-Path $repo 'index.html') $homeHtml

# --------------------------------------------------------------------------
# 关于页
# --------------------------------------------------------------------------
$about = Parse-Post (Join-Path $src 'content\pages\about.md')
$aboutBody = Render 'page' @{
    TITLE   = (Esc $about.Title)
    SUMMARY = (Esc $about.Summary)
    CONTENT = $about.Html
}
$aboutHtml = Wrap '../' ($about.Title + ' · ' + $siteTitle) ([string]$about.Summary) $aboutBody 'about'
Write-Utf8 (Join-Path $repo 'about\index.html') $aboutHtml

# --------------------------------------------------------------------------
# 涂鸦页
# --------------------------------------------------------------------------
$figures = New-Object System.Text.StringBuilder
$years = @{}
foreach ($m in $works) {
    $num = $m.num
    $cap = $m.caption
    $name = $m.name
    $y = $m.year
    if ($y) { $years[$y] = $true }
    $imgUrl = '../Pages/drawing/images/' + $num + '-small.jpg'
    [void]$figures.Append('<figure data-year="' + $y + '" data-full="' + $imgUrl + '" data-caption="' + (Esc ($name + ' · ' + $cap)) + '">')
    [void]$figures.Append('<img src="' + $imgUrl + '" alt="' + (Esc $name) + '" loading="lazy">')
    [void]$figures.Append('<figcaption>' + (Esc $name) + ' · ' + (Esc $y) + '</figcaption>')
    [void]$figures.Append('</figure>')
}
$filterSb = New-Object System.Text.StringBuilder
[void]$filterSb.Append('<button class="active" type="button" data-year="all">全部</button>')
foreach ($y in ($years.Keys | Sort-Object)) {
    [void]$filterSb.Append('<button type="button" data-year="' + $y + '">' + $y + '</button>')
}
$galleryBody = @'
<div class="wrap">
    <header class="article-head">
        <h1>乱涂乱画</h1>
        <p class="muted">全是手绘和数位板上的随手涂，点任意一张看大图。</p>
    </header>
    <div class="filter-bar" role="group" aria-label="按年份筛选">
__FILTER__
    </div>
    <div class="mosaic">
__FIGURES__
    </div>
</div>
<dialog class="lightbox">
    <button class="lb-close" type="button" aria-label="关闭">×</button>
    <img alt="">
    <div class="lb-caption"></div>
</dialog>
'@
$galleryBody = $galleryBody.Replace('__FILTER__', $filterSb.ToString()).Replace('__FIGURES__', $figures.ToString())
$galleryHtml = Wrap '../' ('乱涂乱画 · ' + $siteTitle) '手绘与数位板涂鸦合集，按年份筛选，点击查看大图。' $galleryBody 'gallery'
Write-Utf8 (Join-Path $repo 'gallery\index.html') $galleryHtml
Write-Host ('涂鸦: {0} 张, 年份 {1}' -f $works.Count, (($years.Keys | Sort-Object) -join '/'))

# --------------------------------------------------------------------------
# 听歌页
# --------------------------------------------------------------------------
$trackSb = New-Object System.Text.StringBuilder
foreach ($t in $tracks) {
    $audio = '../Pages/music/music/' + [uri]::EscapeDataString($t.file)
    $cover = '../Pages/music/img/' + [uri]::EscapeDataString($t.cover)
    [void]$trackSb.Append('<div class="track" role="button" tabindex="0" data-src="' + $audio + '" data-title="' + (Esc $t.title) + '" data-sub="' + (Esc $t.sub) + '" data-cover="' + $cover + '">')
    [void]$trackSb.Append('<img src="' + $cover + '" alt="' + (Esc $t.title) + ' 封面" loading="lazy">')
    [void]$trackSb.Append('<div><h3>' + (Esc $t.title) + '</h3><p>' + (Esc $t.note) + '</p></div>')
    [void]$trackSb.Append('<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>')
    [void]$trackSb.Append('</div>')
}
$musicBody = @'
<div class="wrap">
    <header class="article-head">
        <h1>听歌看剧</h1>
        <p class="muted">八首循环过很久的歌。点任意一首开始，播放条固定在底部，并记住上次听到的位置。</p>
    </header>
    <div class="track-list">
__TRACKS__
    </div>
</div>
'@
$musicBody = $musicBody.Replace('__TRACKS__', $trackSb.ToString())
$musicHtml = Wrap '../' ('听歌看剧 · ' + $siteTitle) '循环过的歌与反复看的电影，内置底部播放器。' $musicBody 'music'
Write-Utf8 (Join-Path $repo 'music\index.html') $musicHtml
Write-Host ('曲目: {0} 首' -f $tracks.Count)

# --------------------------------------------------------------------------
# 旅行页
# --------------------------------------------------------------------------
$spotFigs = New-Object System.Text.StringBuilder
$spotText = New-Object System.Text.StringBuilder
foreach ($s in $travel.spots) {
    $img = '../Pages/enshi/images/' + [uri]::EscapeDataString($s.image)
    [void]$spotFigs.Append('<figure data-full="' + $img + '" data-caption="' + (Esc $s.name) + '">')
    [void]$spotFigs.Append('<img src="' + $img + '" alt="' + (Esc $s.name) + '" loading="lazy">')
    [void]$spotFigs.Append('<figcaption>' + (Esc $s.name) + '</figcaption>')
    [void]$spotFigs.Append('</figure>')
    [void]$spotText.Append('<div class="spot"><h2>' + (Esc $s.name) + '</h2><p>' + (Esc $s.text) + '</p></div>')
}
$travelBody = @'
<div class="wrap">
    <header class="article-head">
        <h1>__TITLE__</h1>
        <p class="muted">__LEAD__</p>
    </header>
    <div class="prose" style="padding-bottom:22px">
        <p>__INTRO__</p>
    </div>
    <div class="travel-grid">
__FIGURES__
    </div>
    <div style="padding-bottom:64px">
__SPOTS__
    </div>
</div>
<dialog class="lightbox">
    <button class="lb-close" type="button" aria-label="关闭">×</button>
    <img alt="">
    <div class="lb-caption"></div>
</dialog>
'@
$travelBody = $travelBody.Replace('__TITLE__', (Esc $travel.title)).Replace('__LEAD__', (Esc $travel.lead)).Replace('__INTRO__', (Esc $travel.intro)).Replace('__FIGURES__', $spotFigs.ToString()).Replace('__SPOTS__', $spotText.ToString())
$travelHtml = Wrap '../' ($travel.title + ' · ' + $siteTitle) ([string]$travel.lead) $travelBody 'travel'
Write-Utf8 (Join-Path $repo 'travel\index.html') $travelHtml
Write-Host ('旅行: {0} 个景点' -f $travel.spots.Count)

# --------------------------------------------------------------------------
# 404 / robots / sitemap / feed / favicon
# --------------------------------------------------------------------------
$nfBody = @'
<div class="wrap" style="padding:90px 0 110px;text-align:center">
    <h1 style="font-size:64px;margin:0">404</h1>
    <p class="muted">这个地址没有内容，可能被移动或删除了。</p>
    <p style="margin-top:26px"><a class="btn btn-primary" href="./index.html">回到首页</a></p>
</div>
'@
Write-Utf8 (Join-Path $repo '404.html') (Wrap './' ('页面不存在 · ' + $siteTitle) '404' $nfBody '')

Write-Utf8 (Join-Path $repo 'robots.txt') ("User-agent: *`nAllow: /`n`nSitemap: /sitemap.xml`n")

$siteBase = 'https://anonymous772066235.github.io/SolitaryOrchid/'
$sm = New-Object System.Text.StringBuilder
[void]$sm.Append('<?xml version="1.0" encoding="UTF-8"?>' + "`n")
[void]$sm.Append('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + "`n")
foreach ($u in @('', 'posts/', 'gallery/', 'music/', 'travel/', 'about/')) {
    [void]$sm.Append('  <url><loc>' + $siteBase + $u + '</loc></url>' + "`n")
}
foreach ($p in $posts) {
    [void]$sm.Append('  <url><loc>' + $siteBase + 'posts/' + $p.Slug + '/</loc><lastmod>' + $p.Date + '</lastmod></url>' + "`n")
}
[void]$sm.Append('</urlset>' + "`n")
Write-Utf8 (Join-Path $repo 'sitemap.xml') $sm.ToString()

$updated = '2026-01-01T00:00:00+08:00'
if ($posts.Count -gt 0) { $updated = $posts[0].Date + 'T00:00:00+08:00' }
$fe = New-Object System.Text.StringBuilder
[void]$fe.Append('<?xml version="1.0" encoding="utf-8"?>' + "`n")
[void]$fe.Append('<feed xmlns="http://www.w3.org/2005/Atom">' + "`n")
[void]$fe.Append('  <title>' + (Esc $siteTitle) + '</title>' + "`n")
[void]$fe.Append('  <subtitle>' + (Esc $siteDesc) + '</subtitle>' + "`n")
[void]$fe.Append('  <link href="' + $siteBase + 'feed.xml" rel="self"/>' + "`n")
[void]$fe.Append('  <link href="' + $siteBase + '"/>' + "`n")
[void]$fe.Append('  <updated>' + $updated + '</updated>' + "`n")
[void]$fe.Append('  <id>' + $siteBase + '</id>' + "`n")
foreach ($p in $posts) {
    $url = $siteBase + 'posts/' + $p.Slug + '/'
    [void]$fe.Append('  <entry>' + "`n")
    [void]$fe.Append('    <title>' + (Esc $p.Title) + '</title>' + "`n")
    [void]$fe.Append('    <link href="' + $url + '"/>' + "`n")
    [void]$fe.Append('    <id>' + $url + '</id>' + "`n")
    [void]$fe.Append('    <updated>' + $p.Date + 'T00:00:00+08:00</updated>' + "`n")
    [void]$fe.Append('    <summary>' + (Esc $p.Summary) + '</summary>' + "`n")
    [void]$fe.Append('  </entry>' + "`n")
}
[void]$fe.Append('</feed>' + "`n")
Write-Utf8 (Join-Path $repo 'feed.xml') $fe.ToString()

$favicon = @'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6b8afd"/>
      <stop offset="1" stop-color="#b06bff"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="#0d1117"/>
  <circle cx="22" cy="26" r="4" fill="url(#g)"/>
  <circle cx="42" cy="20" r="3" fill="#3fd0c9"/>
  <circle cx="34" cy="40" r="5" fill="url(#g)"/>
  <circle cx="46" cy="44" r="3" fill="#3fd0c9"/>
  <path d="M22 26 L42 20 L34 40 Z" fill="none" stroke="#6b8afd" stroke-opacity=".55" stroke-width="2"/>
  <path d="M34 40 L46 44" stroke="#3fd0c9" stroke-opacity=".55" stroke-width="2"/>
</svg>
'@
Write-Utf8 (Join-Path $repo 'favicon.svg') $favicon

Write-Host '构建完成。'
