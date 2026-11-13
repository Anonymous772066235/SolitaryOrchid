/* site.js — 主题、导航、阅读进度、TOC、灯箱、迷你播放器、3D 点云
   无外部依赖，全部原生实现。 */
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---------------- 主题 ---------------- */
    var THEME_KEY = 'site-theme';
    var root = document.documentElement;

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
        var btn = e.target.closest('.theme-toggle');
        if (!btn) return;
        applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });

    /* ---------------- 移动导航 ---------------- */
    (function initNav() {
        var toggle = document.querySelector('.nav-toggle');
        var nav = document.getElementById('site-nav');
        if (!toggle || !nav) return;
        toggle.addEventListener('click', function () {
            var open = nav.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }());

    /* ---------------- 阅读进度 + TOC 高亮 ---------------- */
    (function initProgress() {
        var bar = document.querySelector('.progress-bar');
        var article = document.querySelector('.prose');
        if (bar && article) {
            var update = function () {
                var rect = article.getBoundingClientRect();
                var total = article.offsetHeight - window.innerHeight;
                var passed = -rect.top;
                var p = total > 0 ? (passed / total) * 100 : 0;
                bar.style.width = Math.min(100, Math.max(0, p)) + '%';
            };
            update();
            window.addEventListener('scroll', update, { passive: true });
            window.addEventListener('resize', update);
        }

        var links = Array.prototype.slice.call(document.querySelectorAll('.toc a'));
        if (!links.length) return;
        var map = {};
        links.forEach(function (a) {
            var id = decodeURIComponent(a.getAttribute('href').slice(1));
            var h = document.getElementById(id);
            if (h) map[id] = a;
        });
        if (!Object.keys(map).length || !('IntersectionObserver' in window)) return;
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (!en.isIntersecting) return;
                links.forEach(function (a) { a.classList.remove('active'); });
                var a = map[en.target.id];
                if (a) a.classList.add('active');
            });
        }, { rootMargin: '-84px 0px -70% 0px' });
        Object.keys(map).forEach(function (id) {
            var h = document.getElementById(id);
            if (h) io.observe(h);
        });
    }());

    /* ---------------- 灯箱 ---------------- */
    (function initLightbox() {
        var dlg = document.querySelector('dialog.lightbox');
        if (!dlg) return;
        var img = dlg.querySelector('img');
        var cap = dlg.querySelector('.lb-caption');
        var closeBtn = dlg.querySelector('.lb-close');

        document.addEventListener('click', function (e) {
            var fig = e.target.closest('.gallery figure');
            if (!fig) return;
            var full = fig.getAttribute('data-full');
            if (!full) return;
            img.src = full;
            var text = fig.getAttribute('data-caption') || '';
            if (cap) { cap.textContent = text; cap.style.display = text ? 'block' : 'none'; }
            if (typeof dlg.showModal === 'function') dlg.showModal();
        });

        if (closeBtn) closeBtn.addEventListener('click', function () { dlg.close(); });
        dlg.addEventListener('click', function (e) {
            if (e.target === dlg) dlg.close();
        });
    }());

    /* ---------------- 迷你播放器 ---------------- */
    (function initPlayer() {
        var player = document.querySelector('.player');
        var tracks = Array.prototype.slice.call(document.querySelectorAll('.track'));
        if (!player || !tracks.length) return;

        var audio = new Audio();
        audio.preload = 'metadata';

        var coverEl = player.querySelector('.player-cover');
        var titleEl = player.querySelector('.player-title');
        var subEl = player.querySelector('.player-sub');
        var seek = player.querySelector('input[type="range"]');
        var curEl = player.querySelector('.t-cur');
        var durEl = player.querySelector('.t-dur');
        var playBtn = player.querySelector('button.play');
        var prevBtn = player.querySelector('button.prev');
        var nextBtn = player.querySelector('button.next');

        var index = 0;
        var STATE_KEY = 'player-state';

        function fmt(s) {
            if (!isFinite(s) || s < 0) s = 0;
            var m = Math.floor(s / 60);
            var sec = Math.floor(s % 60);
            return m + ':' + (sec < 10 ? '0' : '') + sec;
        }

        function save() {
            try {
                localStorage.setItem(STATE_KEY, JSON.stringify({
                    i: index,
                    t: audio.currentTime || 0,
                    v: audio.volume
                }));
            } catch (e) { /* ignore */ }
        }

        function load(i, autoplay, seekTo) {
            index = (i + tracks.length) % tracks.length;
            var el = tracks[index];
            audio.src = el.getAttribute('data-src');
            audio.volume = 0.9;
            coverEl.src = el.getAttribute('data-cover') || '';
            coverEl.style.visibility = el.getAttribute('data-cover') ? 'visible' : 'hidden';
            titleEl.textContent = el.getAttribute('data-title') || '';
            subEl.textContent = el.getAttribute('data-sub') || '';
            tracks.forEach(function (t) { t.classList.remove('playing'); });
            el.classList.add('playing');
            player.classList.add('open');
            if (seekTo && isFinite(seekTo)) {
                audio.addEventListener('loadedmetadata', function once() {
                    audio.removeEventListener('loadedmetadata', once);
                    try { audio.currentTime = seekTo; } catch (e) { /* ignore */ }
                });
            }
            if (autoplay) {
                audio.play().catch(function () { /* 需要用户手势 */ });
            }
        }

        function toggle() {
            if (!audio.src) {
                load(index, true);
                return;
            }
            if (audio.paused) audio.play().catch(function () {});
            else audio.pause();
        }

        tracks.forEach(function (el, i) {
            el.addEventListener('click', function () {
                load(i, true);
            });
        });

        playBtn.addEventListener('click', toggle);
        prevBtn.addEventListener('click', function () { load(index - 1, true); });
        nextBtn.addEventListener('click', function () { load(index + 1, true); });

        audio.addEventListener('play', function () { playBtn.textContent = '❚❚'; });
        audio.addEventListener('pause', function () { playBtn.textContent = '▶'; });
        audio.addEventListener('ended', function () { load(index + 1, true); });
        audio.addEventListener('timeupdate', function () {
            if (audio.duration && isFinite(audio.duration)) {
                seek.max = Math.floor(audio.duration);
                seek.value = Math.floor(audio.currentTime);
                durEl.textContent = fmt(audio.duration);
            }
            curEl.textContent = fmt(audio.currentTime);
            if (Math.floor(audio.currentTime) % 5 === 0) save();
        });
        seek.addEventListener('input', function () {
            audio.currentTime = Number(seek.value);
        });

        // 恢复上次状态（不自动播放，遵守浏览器策略）
        try {
            var st = JSON.parse(localStorage.getItem(STATE_KEY) || 'null');
            if (st && typeof st.i === 'number') {
                load(st.i, false, st.t);
                audio.volume = typeof st.v === 'number' ? st.v : 0.9;
                playBtn.textContent = '▶';
            }
        } catch (e) { /* ignore */ }
    }());

    /* ---------------- 3D 点云 hero ---------------- */
    (function initHero() {
        var canvas = document.getElementById('hero-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        if (!ctx) return;

        var W = 0, H = 0, dpr = 1;
        var pts = [];

        function build() {
            pts = [];
            var N = 620;
            for (var i = 0; i < N; i++) {
                // 球面均匀采样
                var u = Math.random() * 2 - 1;
                var theta = Math.random() * Math.PI * 2;
                var r = Math.sqrt(1 - u * u);
                pts.push({
                    x: r * Math.cos(theta),
                    y: u,
                    z: r * Math.sin(theta),
                    s: 0.5 + Math.random() * 1.5
                });
            }
            // 环状结构，呼应“点云/三维”
            for (var j = 0; j < 260; j++) {
                var a = (j / 260) * Math.PI * 2;
                var rr = 1.35 + Math.random() * 0.08;
                pts.push({
                    x: rr * Math.cos(a),
                    y: (Math.random() - 0.5) * 0.06,
                    z: rr * Math.sin(a),
                    s: 0.6 + Math.random()
                });
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

        var t = 0;
        var mouseX = 0, mouseY = 0;

        function draw() {
            ctx.clearRect(0, 0, W, H);
            var cx = W * 0.68;
            var cy = H * 0.44;
            var scale = Math.min(W, H) * 0.30;
            var sinY = Math.sin(t), cosY = Math.cos(t);
            var tiltX = 0.42 + mouseY * 0.35;
            var sinX = Math.sin(tiltX), cosX = Math.cos(tiltX);

            for (var i = 0; i < pts.length; i++) {
                var p = pts[i];
                var x1 = p.x * cosY - p.z * sinY;
                var z1 = p.x * sinY + p.z * cosY;
                var y1 = p.y * cosX - z1 * sinX;
                var z2 = p.y * sinX + z1 * cosX;

                var persp = 2.6 / (2.6 + z2);
                var sx = cx + x1 * scale * persp + mouseX * 26;
                var sy = cy + y1 * scale * persp + mouseY * 18;
                var depth = Math.max(0, Math.min(1, (1 - z2 / 2.2) / 2));

                var size = p.s * persp * 1.9;
                var alpha = 0.16 + depth * 0.75;
                var hue = 218 + depth * 52;
                ctx.beginPath();
                ctx.fillStyle = 'hsla(' + hue + ', 92%, ' + (58 + depth * 22) + '%, ' + alpha + ')';
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        function loop() {
            t += 0.0035;
            draw();
            requestAnimationFrame(loop);
        }

        build();
        resize();
        draw();

        window.addEventListener('resize', function () {
            resize();
            draw();
        });

        if (!reduceMotion) {
            requestAnimationFrame(loop);
            window.addEventListener('mousemove', function (e) {
                mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
                mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
            }, { passive: true });
        }
    }());

    /* ---------------- 涂鸦年份筛选 ---------------- */
    (function initFilter() {
        var bar = document.querySelector('.filter-bar');
        var gallery = document.querySelector('.gallery');
        if (!bar || !gallery) return;
        var figs = Array.prototype.slice.call(gallery.querySelectorAll('figure'));

        bar.addEventListener('click', function (e) {
            var btn = e.target.closest('button');
            if (!btn) return;
            var y = btn.getAttribute('data-year');
            Array.prototype.forEach.call(bar.querySelectorAll('button'), function (b) {
                b.classList.toggle('active', b === btn);
            });
            figs.forEach(function (f) {
                var show = (y === 'all') || (f.getAttribute('data-year') === y);
                f.style.display = show ? '' : 'none';
            });
        });
    }());

    /* ---------------- 曲目键盘可达 ---------------- */
    (function initTrackKeys() {
        document.addEventListener('keydown', function (e) {
            var t = e.target.closest ? e.target.closest('.track') : null;
            if (!t) return;
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                t.click();
            }
        });
    }());
}());
