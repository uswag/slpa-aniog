// effects.js - small visual extras shared by every page. Nothing here touches the database or the server.
//   1) POINTER LIGHT  : a soft light follows the mouse pointer (desktop) and the thumb (phone), only over cards and buttons.
//   2) DELETE CONFETTI: window.uswagPop(element) turns an element into confetti. Use it for EVERY deletion.
//   3) ANNOUNCEMENTS  : marks each announcement on the home page as Upcoming / Today / Ended from its date.
// To switch one off, delete its block (each block starts with "=== N)").
(function () {
    'use strict';
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // === 1) POINTER LIGHT =======================================================
    function initLight() {
        var light = document.createElement('div');
        light.id = 'fxLight';
        light.setAttribute('aria-hidden', 'true');
        document.body.appendChild(light);

        var x = -999, y = -999, queued = false, hideTimer = null;

        function paint() {
            queued = false;
            light.style.transform = 'translate3d(' + (x - 160) + 'px,' + (y - 160) + 'px,0)';
        }
        function move(e) {
            x = e.clientX; y = e.clientY;
            if (!queued) { queued = true; requestAnimationFrame(paint); }
        }
        function show(touch) {
            clearTimeout(hideTimer);
            light.classList.toggle('fx-touch', !!touch);
            light.classList.add('fx-on');
        }
        function hide(delay) {
            clearTimeout(hideTimer);
            hideTimer = setTimeout(function () { light.classList.remove('fx-on'); }, delay || 0);
        }

        // The light only shows over cards, buttons and their edges (not on the plain page background).
        var TARGETS = '.card-box, .btn-submit, button, .btn-inquire, .btn-news-read, .btn-secondary, .btn-label, .authsim-btn, ' +
                      '.announce-item, .nav-bar a, .product-card-link, .custom-modal-box, .sent-message-popup-card, .zoom-ctrl-btn, .dash-tab, .stat';
        function onTarget(e) { return !!(e.target && e.target.closest && e.target.closest(TARGETS)); }

        document.addEventListener('pointermove', function (e) {
            move(e);
            if (onTarget(e)) show(e.pointerType === 'touch' || e.pointerType === 'pen');
            else hide(0);
        }, { passive: true });
        document.addEventListener('pointerdown', function (e) {
            move(e);
            if (onTarget(e)) { show(e.pointerType === 'touch'); light.classList.add('fx-press'); }
            else hide(0);
        }, { passive: true });
        document.addEventListener('pointerup', function (e) {
            light.classList.remove('fx-press');
            if (e.pointerType === 'touch') hide(450);        // the thumb lifted: let the light fade out
        }, { passive: true });
        document.addEventListener('pointercancel', function () { light.classList.remove('fx-press'); hide(150); }, { passive: true });
        document.documentElement.addEventListener('mouseleave', function () { hide(0); });
    }

    // === 2) DELETE CONFETTI =====================================================
    // uswagPop(el)  : the element pops, then bursts into confetti where it stood. Returns a Promise (resolved when the pop ends).
    // uswagBurst(x,y): confetti only, from a point on the screen.
    var COLORS = ['#D31919', '#FFD700', '#3A86FF', '#322D78', '#2E7D32', '#EB820B'];   // the site's own palette

    function loadConfetti(cb) {
        if (typeof window.confetti === 'function') { cb(); return; }
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js';
        s.async = true;
        s.onload = cb;
        s.onerror = cb;   // offline: the fallback below is used
        document.head.appendChild(s);
    }

    // Fallback when the confetti library cannot load: plain coloured bits that fall.
    function fallbackBurst(px, py) {
        for (var i = 0; i < 36; i++) {
            var bit = document.createElement('i');
            bit.className = 'fx-bit';
            bit.style.left = px + 'px';
            bit.style.top = py + 'px';
            bit.style.background = COLORS[i % COLORS.length];
            var angle = Math.random() * Math.PI * 2, dist = 60 + Math.random() * 120;
            bit.style.setProperty('--dx', Math.cos(angle) * dist + 'px');
            bit.style.setProperty('--dy', Math.sin(angle) * dist + 40 + 'px');
            document.body.appendChild(bit);
            setTimeout(function (b) { b.remove(); }.bind(null, bit), 1000);
        }
    }

    window.uswagBurst = function (px, py) {
        if (reduce) return;
        loadConfetti(function () {
            if (typeof window.confetti === 'function') {
                window.confetti({
                    particleCount: 120, spread: 90, startVelocity: 32, gravity: 0.9, ticks: 160, scalar: 0.9,
                    origin: { x: px / window.innerWidth, y: py / window.innerHeight },
                    colors: COLORS, zIndex: 2147483000
                });
            } else {
                fallbackBurst(px, py);
            }
        });
    };

    window.uswagPop = function (el) {
        return new Promise(function (resolve) {
            if (!el || !el.getBoundingClientRect) { resolve(); return; }
            var r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) { resolve(); return; }   // not on screen: nothing to pop
            window.uswagBurst(r.left + r.width / 2, r.top + r.height / 2);
            if (reduce) { resolve(); return; }
            el.classList.add('fx-pop');
            setTimeout(function () { el.classList.remove('fx-pop'); resolve(); }, 380);
        });
    };

    // === 3) ANNOUNCEMENTS (home page) ===========================================
    // Each <article class="announce-item" data-start="YYYY-MM-DD" data-end="YYYY-MM-DD"> gets a badge: Today, In N days, Ongoing or Ended.
    function initAnnouncements() {
        var items = document.querySelectorAll('.announce-item[data-start]');
        if (!items.length) return;
        function day(s) { var p = String(s || '').split('-'); return new Date(+p[0], (+p[1] || 1) - 1, +p[2] || 1); }
        var now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        var MS = 86400000, upcoming = 0;
        items.forEach(function (it) {
            var start = day(it.getAttribute('data-start'));
            var end = it.getAttribute('data-end') ? day(it.getAttribute('data-end')) : start;
            var badge = it.querySelector('.announce-when');
            var text, cls;
            if (today > end) { text = 'Ended'; cls = 'is-ended'; }
            else if (today >= start) { text = (start.getTime() === end.getTime() || today.getTime() === start.getTime()) ? 'Today' : 'Ongoing'; cls = 'is-now'; upcoming++; }
            else { var n = Math.round((start - today) / MS); text = n === 1 ? 'Tomorrow' : 'In ' + n + ' days'; cls = 'is-soon'; upcoming++; }
            it.classList.add(cls);
            if (badge) badge.textContent = text;
        });
        var empty = document.getElementById('announceEmpty');
        if (empty) empty.hidden = upcoming > 0;
    }

    window.uswagAnnouncements = initAnnouncements;   // site.js calls this after it loads the announcements from the database
    function start() { initLight(); initAnnouncements(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
