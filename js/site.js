/* site.js — 主题、Pjax 导航、阅读增强、灯箱、全局播放器、3D 点云
   无外部依赖。播放器与 Pjax 配合，页面跳转不中断播放。 */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var root = document.documentElement;

    /* ================= 主题 ================= */
    var THEME_KEY = 'site-theme';

    function applyTheme(t) {
        root.setAttribute('data-theme', t);
        try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
    }

    (function initTheme() {
        var saved = null;
        try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }
        if (saved === 'dark' || saved === 'light') {
            root.setAttribute('data-theme', saved);
        } else {
            root.setAttribute('data-theme', window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
        }
    }());

    document.addEventListener('click', function (e) {
        if (!e.target.closest('.theme-toggle')) return;
        applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ================= 移动导航（事件委托，Pjax 替换 header 后仍有效） ================= */
    document.addEventListener('click', function (e) {
        var toggle = e.target.closest('.nav-toggle');
        if (!toggle) return;
        var nav = document.getElementById('site-nav');
        if (!nav) return;
        var open = nav.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    /* ================= 全局播放器 ================= */
    var Player = (function () {
        var audio = null;
        var bar = null;
        var playlist = [];
        var items = [];
        var index = 0;
        var subs = [];
        var KEY = 'player-state';

        var ui = {};

        function el(s, ctx) { return (ctx || document).querySelector(s); }

        function ready() {
            if (audio) return true;
            audio = document.getElementById('gaudio');
            bar = document.getElementById('gplayer');
            if (!audio || !bar) return false;

            ui.cover = el('.gp-cover', bar);
            ui.mini = el('.gp-mini-cover', bar);
            ui.title = el('.gp-title', bar);
            ui.sub = el('.gp-sub', bar);
            ui.seek = el('input[type="range"]', bar);
            ui.cur = el('.gp-cur', bar);
            ui.dur = el('.gp-dur', bar);
            ui.play = el('button.play', bar);
            ui.prev = el('button.prev', bar);
            ui.next = el('button.next', bar);
            ui.toggle = el('.gp-toggle', bar);
            ui.fold = el('.gp-fold', bar);
            ui.drag = el('.gp-drag', bar);

            ui.play.addEventListener('click', toggle);
            ui.prev.addEventListener('click', function () { load(index - 1, true); });
            ui.next.addEventListener('click', function () { load(index + 1, true); });
            ui.seek.addEventListener('input', function () { audio.currentTime = Number(ui.seek.value); });

            ui.toggle.addEventListener('click', function () { setFold(false); });
            ui.fold.addEventListener('click', function () { setFold(true); });

            try {
                if (localStorage.getItem('player-fold') === '0') { bar.setAttribute('data-folded', 'false'); }
            } catch (e) { /* ignore */ }
            restorePos();
            bindDrag();

            audio.addEventListener('play', function () { ui.play.textContent = '❚❚'; emit(); });
            audio.addEventListener('pause', function () { ui.play.textContent = '▶'; emit(); });
            audio.addEventListener('ended', function () { load(index + 1, true); });
            audio.addEventListener('timeupdate', function () {
                if (isFinite(audio.duration) && audio.duration > 0) {
                    ui.seek.max = Math.floor(audio.duration);
                    ui.seek.value = Math.floor(audio.currentTime);
                    ui.dur.textContent = fmt(audio.duration);
                }
                ui.cur.textContent = fmt(audio.currentTime);
                if (Math.floor(audio.currentTime) % 5 === 0) { save(); }
                emit();
            });
            window.addEventListener('resize', restorePos);
            return true;
        }

        function setFold(folded) {
            bar.setAttribute('data-folded', folded ? 'true' : 'false');
            try { localStorage.setItem('player-fold', folded ? '1' : '0'); } catch (e) { /* ignore */ }
        }

        function clampPos(x, y) {
            var w = bar.offsetWidth || 80;
            var h = bar.offsetHeight || 60;
            return {
                x: Math.max(6, Math.min(window.innerWidth - w - 6, x)),
                y: Math.max(6, Math.min(window.innerHeight - h - 6, y))
            };
        }

        function restorePos() {
            try {
                var p = JSON.parse(localStorage.getItem('player-pos') || 'null');
                if (p && typeof p.x === 'number' && typeof p.y === 'number') {
                    var c = clampPos(p.x, p.y);
                    bar.style.right = 'auto';
                    bar.style.bottom = 'auto';
                    bar.style.left = c.x + 'px';
                    bar.style.top = c.y + 'px';
                }
            } catch (e) { /* ignore */ }
        }

        function bindDrag() {
            if (!ui.drag) return;
            var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
            ui.drag.addEventListener('pointerdown', function (e) {
                if (e.target.closest('button')) return;
                dragging = true;
                var r = bar.getBoundingClientRect();
                sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
                bar.style.right = 'auto';
                bar.style.bottom = 'auto';
                bar.style.left = ox + 'px';
                bar.style.top = oy + 'px';
                try { ui.drag.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                e.preventDefault();
            });
            ui.drag.addEventListener('pointermove', function (e) {
                if (!dragging) return;
                var c = clampPos(ox + (e.clientX - sx), oy + (e.clientY - sy));
                bar.style.left = c.x + 'px';
                bar.style.top = c.y + 'px';
            });
            ui.drag.addEventListener('pointerup', function (e) {
                if (!dragging) return;
                dragging = false;
                try { ui.drag.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
                var r = bar.getBoundingClientRect();
                try { localStorage.setItem('player-pos', JSON.stringify({ x: r.left, y: r.top })); } catch (err) { /* ignore */ }
            });
        }

        function fmt(s) {
            if (!isFinite(s) || s < 0) s = 0;
            var m = Math.floor(s / 60);
            var sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        }

        function normUrl(u) {
            try { return decodeURIComponent(new URL(u, location.href).href); } catch (e) { return u; }
        }

        function save() {
            try {
                localStorage.setItem(KEY, JSON.stringify({ i: index, t: audio.currentTime || 0, playing: !audio.paused }));
            } catch (e) { /* ignore */ }
        }

        function readState() {
            try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; }
        }

        function state() {
            return {
                index: index,
                playing: audio ? !audio.paused : false,
                time: audio ? audio.currentTime : 0,
                duration: audio && isFinite(audio.duration) ? audio.duration : 0,
                item: playlist[index] || null,
                items: items
            };
        }

        function emit() {
            var s = state();
            for (var i = 0; i < subs.length; i++) {
                try { subs[i](s); } catch (e) { /* ignore */ }
            }
        }

        function paint() {
            var it = playlist[index];
            if (!it) return;
            if (ui.title) ui.title.textContent = it.title || '';
            if (ui.sub) ui.sub.textContent = it.sub || '';
            if (it.cover) {
                if (ui.cover) ui.cover.src = it.cover;
                if (ui.mini) ui.mini.src = it.cover;
            }
            bar.classList.add('ready');
            items.forEach(function (x, i) { x.classList.toggle('playing', i === index); });
            emit();
        }

        function load(i, autoplay, seekTo) {
            if (!playlist.length) return;
            index = (i + playlist.length) % playlist.length;
            var it = playlist[index];
            audio.src = it.src;
            if (seekTo && isFinite(seekTo)) {
                audio.addEventListener('loadedmetadata', function once() {
                    audio.removeEventListener('loadedmetadata', once);
                    try { audio.currentTime = seekTo; } catch (e) { /* ignore */ }
                });
            }
            paint();
            if (autoplay) { audio.play().catch(function () { /* 需手势 */ }); }
        }

        function toggle() {
            if (!audio.src && playlist.length) { load(index, true); return; }
            if (audio.paused) { audio.play().catch(function () { }); } else { audio.pause(); }
        }

        return {
            mount: function (list, els) {
                if (!ready()) return;
                playlist = (list || []).map(function (it) {
                    return {
                        src: normUrl(it.src),
                        title: it.title,
                        sub: it.sub,
                        cover: it.cover ? normUrl(it.cover) : ''
                    };
                });
                items = els || [];
                if (!audio.src) {
                    var st = readState();
                    var i0 = (st && typeof st.i === 'number' && st.i < playlist.length) ? st.i : 0;
                    index = i0;
                    load(i0, !!(st && st.playing), st ? st.t : 0);
                } else {
                    // 播放中跨页：按 src 找回当前索引，不打断播放
                    var cur = normUrl(audio.src);
                    var found = -1;
                    for (var k = 0; k < playlist.length; k++) {
                        if (normUrl(playlist[k].src) === cur) { found = k; break; }
                    }
                    if (found >= 0) { index = found; }
                    if (index >= playlist.length) { index = 0; }
                    paint();
                }
            },
            subscribe: function (fn) { subs.push(fn); fn(state()); return fn; },
            clearSubs: function () { subs = []; },
            toggle: toggle,
            load: load,
            state: state
        };
    }());

    /* ================= 播放列表（每页注入，Pjax 后随内容更新） ================= */
    function readPlaylist(doc) {
        var el = (doc || document).getElementById('site-playlist');
        if (!el) return [];
        try { return JSON.parse(el.textContent) || []; } catch (e) { return []; }
    }
    var currentList = readPlaylist(document);

    /* ================= 页面级初始化（Pjax 后重复执行） ================= */
    var scrollBound = false;
    var tocIO = null;
    var revealIO = null;
    var heroStop = null;

    function initProgress() {
        var bar = document.querySelector('.progress-bar');
        var article = document.querySelector('.prose');
        if (!bar || !article) return;
        var update = function () {
            var a = document.querySelector('.prose');
            var b = document.querySelector('.progress-bar');
            if (!a || !b) return;
            var rect = a.getBoundingClientRect();
            var total = a.offsetHeight - window.innerHeight;
            var p = total > 0 ? (-rect.top / total) * 100 : 0;
            b.style.width = Math.min(100, Math.max(0, p)) + '%';
        };
        update();
        if (!scrollBound) {
            scrollBound = true;
            window.addEventListener('scroll', function () {
                var a = document.querySelector('.prose');
                var b = document.querySelector('.progress-bar');
                if (!a || !b) return;
                var rect = a.getBoundingClientRect();
                var total = a.offsetHeight - window.innerHeight;
                var p = total > 0 ? (-rect.top / total) * 100 : 0;
                b.style.width = Math.min(100, Math.max(0, p)) + '%';
            }, { passive: true });
        }
    }

    function initToc() {
        if (tocIO) { tocIO.disconnect(); tocIO = null; }
        var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
        if (!links.length || !('IntersectionObserver' in window)) return;
        var map = {};
        links.forEach(function (a) {
            var id = decodeURIComponent(a.getAttribute('href').slice(1));
            var h = document.getElementById(id);
            if (h) map[id] = a;
        });
        tocIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                links.forEach(function (a) { a.classList.remove('active'); });
                var a = map[en.target.id];
                if (a) a.classList.add('active');
            });
        }, { rootMargin: '-84px 0px -70% 0px' });
        Object.keys(map).forEach(function (id) {
            var h = document.getElementById(id);
            if (h) tocIO.observe(h);
        });
    }

    function initReveal() {
        if (revealIO) { revealIO.disconnect(); revealIO = null; }
        var els = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
        if (!els.length) return;
        if (reduceMotion || !('IntersectionObserver' in window)) {
            els.forEach(function (el) { el.classList.add('in'); });
            return;
        }
        revealIO = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                en.target.classList.add('in');
                revealIO.unobserve(en.target);
            });
        }, { threshold: 0.12 });
        els.forEach(function (el) { revealIO.observe(el); });
    }

    function initLightbox() {
        var dlg = document.querySelector('dialog.lightbox');
        if (!dlg) return;
        if (dlg.dataset.bound === '1') return;
        dlg.dataset.bound = '1';
        var closeBtn = dlg.querySelector('.lb-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', function () { dlg.close(); });
        }
        dlg.addEventListener('click', function (e) {
            if (e.target === dlg) dlg.close();
        });
    }

    function initFilter() {
        var bar = document.querySelector('.filter-bar');
        var grid = document.querySelector('.mosaic');
        if (!bar || !grid) return;
        if (bar.dataset.bound === '1') return;
        bar.dataset.bound = '1';
        var figs = Array.prototype.slice.call(grid.querySelectorAll('figure'));
        bar.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn) return;
            var y = btn.getAttribute('data-year');
            Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
                b.classList.toggle('active', b === btn);
            });
            figs.forEach(function (f) {
                f.style.display = (y === 'all' || f.getAttribute('data-year') === y) ? '' : 'none';
            });
        });
    }

    /* 首页唱机：注册到全局播放器，并订阅状态更新 UI */
    function initStudio() {
        var box = document.querySelector('.studio');
        if (!box) return;
        var btns = Array.prototype.slice.call(box.querySelectorAll('.studio-item'));
        if (!btns.length) return;

        var list = btns.map(function (b) {
            return {
                src: b.getAttribute('data-src'),
                title: b.getAttribute('data-title'),
                sub: b.getAttribute('data-sub'),
                cover: b.getAttribute('data-cover')
            };
        });

        btns.forEach(function (b, i) {
            b.addEventListener('click', function () { Player.load(i, true); });
        });

        var cover = box.querySelector('.studio-cover');
        var titleEl = box.querySelector('.studio-title');
        var subEl = box.querySelector('.studio-sub');
        var playBtn = box.querySelector('button.play');
        var prevBtn = box.querySelector('button.prev');
        var nextBtn = box.querySelector('button.next');
        var seek = box.querySelector('.studio-seek input');
        var curEl = box.querySelector('.sp-cur');
        var durEl = box.querySelector('.sp-dur');

        playBtn.addEventListener('click', function () { Player.toggle(); });
        prevBtn.addEventListener('click', function () { Player.load(Player.state().index - 1, true); });
        nextBtn.addEventListener('click', function () { Player.load(Player.state().index + 1, true); });

        Player.mount(list, btns);
        Player.subscribe(function (s) {
            if (s.item) {
                if (titleEl) titleEl.textContent = s.item.title;
                if (subEl) subEl.textContent = s.item.sub;
                if (cover && s.item.cover) cover.src = s.item.cover;
            }
            if (playBtn) playBtn.textContent = s.playing ? '❚❚' : '▶';
            if (cover) cover.classList.toggle('playing', s.playing);
            if (seek && s.duration > 0) {
                seek.max = Math.floor(s.duration);
                seek.value = Math.floor(s.time);
                durEl.textContent = fmtTime(s.duration);
            }
            if (curEl) curEl.textContent = fmtTime(s.time);
            btns.forEach(function (b, i) { b.classList.toggle('active', i === s.index); });
        });
        if (seek) {
            seek.addEventListener('input', function () {
                var a = document.getElementById('gaudio');
                if (a) a.currentTime = Number(seek.value);
            });
        }
    }

    function fmtTime(s) {
        if (!isFinite(s) || s < 0) s = 0;
        var m = Math.floor(s / 60);
        var sec = Math.floor(s % 60);
        return m + ':' + (sec < 10 ? '0' : '') + sec;
    }

    /* 音乐页曲目列表 */
    function initTracks() {
        var rows = Array.prototype.slice.call(document.querySelectorAll('.track-list .track'));
        if (!rows.length) return;
        var list = rows.map(function (r) {
            return {
                src: r.getAttribute('data-src'),
                title: r.getAttribute('data-title'),
                sub: r.getAttribute('data-sub'),
                cover: r.getAttribute('data-cover')
            };
        });
        rows.forEach(function (r, i) {
            r.addEventListener('click', function () { Player.load(i, true); });
            r.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Player.load(i, true); }
            });
        });
        Player.mount(list, rows);
        Player.subscribe(function (s) {
            rows.forEach(function (r, i) { r.classList.toggle('playing', i === s.index); });
        });
    }

    /* 首页点云 */
    function initHero() {
        if (heroStop) { heroStop(); heroStop = null; }
        var canvas = document.getElementById('hero-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var W = 0, H = 0, dpr = 1, pts = [], t = 0, mx = 0, my = 0, raf = 0;

        function build() {
            pts = [];
            for (var i = 0; i < 620; i++) {
                var u = Math.random() * 2 - 1;
                var th = Math.random() * Math.PI * 2;
                var r = Math.sqrt(1 - u * u);
                pts.push({ x: r * Math.cos(th), y: u, z: r * Math.sin(th), s: 0.5 + Math.random() * 1.5 });
            }
            for (var j = 0; j < 260; j++) {
                var a = (j / 260) * Math.PI * 2;
                var rr = 1.35 + Math.random() * 0.08;
                pts.push({ x: rr * Math.cos(a), y: (Math.random() - 0.5) * 0.06, z: rr * Math.sin(a), s: 0.6 + Math.random() });
            }
        }

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            var rect = canvas.parentElement.getBoundingClientRect();
            W = rect.width;
            H = rect.height;
            canvas.width = Math.floor(W * dpr);
            canvas.height = Math.floor(H * dpr);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function draw() {
            ctx.clearRect(0, 0, W, H);
            var cx = W * 0.68, cy = H * 0.44, scale = Math.min(W, H) * 0.30;
            var sinY = Math.sin(t), cosY = Math.cos(t);
            var tilt = 0.42 + my * 0.35;
            var sinX = Math.sin(tilt), cosX = Math.cos(tilt);
            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];
                var x1 = p.x * cosY - p.z * sinY;
                var z1 = p.x * sinY + p.z * cosY;
                var y1 = p.y * cosX - z1 * sinX;
                var z2 = p.y * sinX + z1 * cosX;
                var persp = 2.6 / (2.6 + z2);
                var sx = cx + x1 * scale * persp + mx * 26;
                var sy = cy + y1 * scale * persp + my * 18;
                var depth = Math.max(0, Math.min(1, (1 - z2 / 2.2) / 2));
                ctx.beginPath();
                ctx.fillStyle = 'hsla(' + (218 + depth * 52) + ', 92%, ' + (58 + depth * 22) + '%, ' + (0.16 + depth * 0.75) + ')';
                ctx.arc(sx, sy, p.s * persp * 1.9, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function loop() { t += 0.0035; draw(); raf = requestAnimationFrame(loop); }

        build();
        resize();
        draw();
        window.addEventListener('resize', function () { resize(); draw(); });

        if (!reduceMotion) {
            raf = requestAnimationFrame(loop);
            window.addEventListener('mousemove', function (e) {
                mx = (e.clientX / window.innerWidth - 0.5) * 2;
                my = (e.clientY / window.innerHeight - 0.5) * 2;
            }, { passive: true });
        }

        heroStop = function () { if (raf) cancelAnimationFrame(raf); };
    }

    function initPage() {
        Player.clearSubs();
        initProgress();
        initToc();
        initLightbox();
        initReveal();
        initFilter();
        initStudio();
        initTracks();
        initHero();
        bindLightboxOpen();
        // 页面自身没有曲目列表时，用注入的全局列表自举播放器（任意页面都能看到并控制）
        var hasPageList = document.querySelector('.studio') || document.querySelector('.track-list');
        if (!hasPageList && currentList.length) {
            Player.mount(currentList, []);
        }
    }

    /* 灯箱打开：委托一次即可，动态查询 dialog */
    function bindLightboxOpen() {
        if (window.__lbOpen) return;
        window.__lbOpen = true;
        document.addEventListener('click', function (e) {
            var fig = e.target.closest('.mosaic figure, .travel-grid figure');
            if (!fig) return;
            var dlg = document.querySelector('dialog.lightbox');
            if (!dlg) return;
            var img = dlg.querySelector('img');
            var cap = dlg.querySelector('.lb-caption');
            if (img) img.src = fig.getAttribute('data-full');
            var text = fig.getAttribute('data-caption') || '';
            if (cap) { cap.textContent = text; cap.style.display = text ? 'block' : 'none'; }
            if (typeof dlg.showModal === 'function') dlg.showModal();
        });
    }

    /* ================= Pjax 导航 ================= */
    function updateNav(url) {
        var path = new URL(url, location.href).pathname;
        var links = document.querySelectorAll('#site-nav a');
        var best = null, bestLen = -1;
        Array.prototype.forEach.call(links, function (a) {
            var href = new URL(a.href, location.href).pathname;
            var match = (href === path) || (href.endsWith('/') && path.indexOf(href) === 0);
            var len = href.length;
            if (match && len > bestLen) { best = a; bestLen = len; }
            a.classList.remove('active');
        });
        if (best) best.classList.add('active');
    }

    function pjax(url, push) {
        var settled = false;
        // 超时兜底：网络/服务端卡住时也能完成跳转
        var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            if (window.console) console.warn('[pjax] timeout, full reload');
            location.href = url;
        }, 3000);

        fetch(url, { credentials: 'same-origin' }).then(function (r) {
            if (!r.ok) throw new Error('fetch status ' + r.status);
            return r.text();
        }).then(function (html) {
            var doc = new DOMParser().parseFromString(html, 'text/html');
            var newMain = doc.querySelector('main');
            var oldMain = document.querySelector('main');
            if (!newMain || !oldMain) throw new Error('no main element');
            oldMain.replaceWith(document.importNode(newMain, true));

            // header / footer 里的链接是相对各自页面的，必须同步，否则换页后相对路径会错位
            ['header.site-header', 'footer.site-footer'].forEach(function (sel) {
                var nb = doc.querySelector(sel);
                var ob = document.querySelector(sel);
                if (nb && ob) { ob.innerHTML = nb.innerHTML; }
            });

            document.title = doc.title;
            currentList = readPlaylist(doc);
            if (push) {
                try { history.pushState({ pjax: url }, '', url); } catch (e) { /* ignore */ }
            }
            window.scrollTo(0, 0);
            initPage();
            updateNav(location.href);
            settled = true;
            clearTimeout(timer);
        }).catch(function (err) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            if (window.console) console.warn('[pjax] fallback to full reload:', err && err.message ? err.message : err);
            location.href = url;
        });
    }

    function isPjaxLink(a) {
        if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
        var href = a.getAttribute('href');
        if (!href || href.charAt(0) === '#' || /^(mailto|tel|javascript):/i.test(href)) return false;
        var url;
        try { url = new URL(a.href); } catch (e) { return false; }
        if (url.origin !== location.origin) return false;
        var p = url.pathname;
        // 旧模板页与跳转页走普通导航
        if (p.indexOf('/Pages/') !== -1) return false;
        // 只接管 .html 或不带扩展名的目录路径
        if (!/\.html?$/.test(p) && !/\/$/.test(p)) return false;
        return true;
    }

    document.addEventListener('click', function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        // file:// 下 fetch 被浏览器禁止，直接走普通跳转
        if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
        var a = e.target.closest('a');
        if (!isPjaxLink(a)) return;
        e.preventDefault();
        pjax(a.href, true);
    });

    window.addEventListener('popstate', function () {
        if (window.__pjaxReady) pjax(location.href, false);
    });

    /* ================= 启动 ================= */
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { initPage(); });
    } else {
        initPage();
    }
    try { history.replaceState({ pjax: 1 }, '', location.href); window.__pjaxReady = true; } catch (e) { /* ignore */ }
}());
