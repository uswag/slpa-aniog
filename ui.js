// ui.js - tiny helpers shared by dashboard.js and admin.js. Everything the database returns is put on the page
// with textContent (never innerHTML), so a name like <script> can never run.
(function () {
    'use strict';
    const U = {};
    U.$ = (id) => document.getElementById(id);
    U.h = function (tag, props) {
        const el = document.createElement(tag);
        Object.entries(props || {}).forEach(function (kv) {
            const k = kv[0], v = kv[1];
            if (k === 'class') el.className = v;
            else if (k === 'text') el.textContent = v;
            else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
            else if (v !== null && v !== undefined && v !== false) el.setAttribute(k, v === true ? '' : v);
        });
        for (let i = 2; i < arguments.length; i++) {
            const c = arguments[i];
            if (Array.isArray(c)) c.forEach((x) => x && el.append(x)); else if (c !== null && c !== undefined && c !== false) el.append(c);
        }
        return el;
    };
    U.api = async function (route, body) {
        try {
            const r = await fetch('api.php?r=' + route, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
            let d = {};
            try { d = await r.json(); } catch (e) { /* not JSON */ }
            if (r.status === 401 && route !== 'me') { location.href = 'login.html?msg=signin'; }
            return { ok: r.ok && d.status === 'success', status: r.status, data: d, error: d.error || d.message || (r.ok ? '' : 'The server did not answer correctly (HTTP ' + r.status + ').') };
        } catch (e) { return { ok: false, status: 0, data: {}, error: 'Cannot reach the server. Is Apache running in Laragon?' }; }
    };
    U.money = (n) => '₱' + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    U.num = (n) => Number(n || 0).toLocaleString('en-PH', { maximumFractionDigits: 3 });
    U.when = function (s) {   // 'YYYY-MM-DD HH:MM:SS' is already Philippine time
        if (!s) return '';
        const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
        if (!m) return s;
        const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m[2] - 1];
        let out = mon + ' ' + (+m[3]) + ', ' + m[1];
        if (m[4]) { const hh = +m[4]; out += ' ' + ((hh % 12) || 12) + ':' + m[5] + (hh >= 12 ? ' PM' : ' AM'); }
        return out;
    };
    U.stat = (label, value, extra) => U.h('div', { class: 'stat' }, U.h('b', { class: extra || '', text: value }), U.h('span', { text: label }));
    U.statGrid = (items) => U.h('div', { class: 'stat-grid' }, items.map((x) => U.stat(x[0], x[1], x[2])));
    U.table = function (cols, rows, empty) {
        if (!rows.length) return U.h('p', { class: 'muted', text: empty || 'Nothing here yet.' });
        return U.h('div', { class: 'table-scroll' }, U.h('table', { class: 'dash-table' },
            U.h('thead', {}, U.h('tr', {}, cols.map((c) => U.h('th', { text: c.label })))),
            U.h('tbody', {}, rows.map((r) => U.h('tr', {}, cols.map((c) => { const v = c.render ? c.render(r) : r[c.key]; return U.h('td', {}, v instanceof Node ? v : document.createTextNode(v === null || v === undefined ? '' : String(v))); }))))));
    };
    // 7 vertical bars (missing days = 0). rows: [{day:'YYYY-MM-DD', v:number}]
    U.bars = function (rows, fmt) {
        const days = [];
        const base = new Date();
        for (let i = 6; i >= 0; i--) { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() - i); days.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')); }
        const map = {}; rows.forEach((r) => { map[String(r.day).slice(0, 10)] = Number(r.v); });
        const max = Math.max(1, ...days.map((d) => map[d] || 0));
        return U.h('div', {}, U.h('div', { class: 'bars' }, days.map((d) => U.h('div', { class: 'bar-col', title: d + ': ' + (fmt ? fmt(map[d] || 0) : (map[d] || 0)) }, U.h('i', { style: 'height:' + Math.round(((map[d] || 0) / max) * 100) + '%' })))),
            U.h('div', { class: 'bar-labels' }, days.map((d) => U.h('span', { text: d.slice(8) + '/' + d.slice(5, 7) }))));
    };
    U.hbars = function (rows, labelKey, valKey, fmt) {
        if (!rows.length) return U.h('p', { class: 'muted', text: 'Nothing here yet.' });
        const max = Math.max(1, ...rows.map((r) => Number(r[valKey])));
        return U.h('div', {}, rows.map((r) => U.h('div', { class: 'hbar' }, U.h('span', { text: r[labelKey] }), U.h('span', { class: 'track' }, U.h('span', { class: 'fill', style: 'width:' + Math.round((Number(r[valKey]) / max) * 100) + '%' })), U.h('b', { text: fmt ? fmt(r[valKey]) : r[valKey] }))));
    };
    U.field = function (id, label, input) { return U.h('div', { class: 'form-group' }, U.h('label', { for: id, text: label }), input); };
    U.msg = function (host, text, ok) { host.textContent = text || ''; host.className = 'auth-msg' + (text ? (ok ? ' is-ok' : ' is-error') : ''); };
    U.logout = async function () { await U.api('logout'); location.href = 'login.html'; };
    window.U = U;
})();
