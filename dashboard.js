// dashboard.js - the dashboard changes with the role: Buyer, Seller or SLP Admin. All numbers come from uswag_db through api.php.
(function () {
    'use strict';
    const { $, h, api, money, num, when, stat, statGrid, table, bars, hbars, field, msg } = window.U;
    let me = null;
    let cats = [];
    let current = '';

    const TABS = {
        Buyer: [['overview', 'Overview'], ['market', 'Marketplace'], ['profile', 'My Profile']],
        Seller: [['overview', 'Overview'], ['products', 'My Products'], ['record', 'Record a Sale'], ['sales', 'Sales'], ['expenses', 'Expenses'], ['capital', 'Capital'], ['profile', 'My Profile']],
        'SLP Admin': [['overview', 'Overview'], ['sellers', 'Sellers'], ['profile', 'My Profile']]
    };
    const flash = (t, ok) => { msg($('dashMsg'), t, ok); if (t) window.scrollTo({ top: 0, behavior: 'smooth' }); };
    const input = (id, attrs) => h('input', Object.assign({ id: id, type: 'text', autocomplete: 'off' }, attrs || {}));
    const btn = (text, cls, on, icon) => h('button', { type: 'button', class: cls || 'btn-submit', onclick: on }, icon ? h('i', { class: icon }) : null, icon ? ' ' + text : text);
    const noticeFor = (el, text) => { let n = el.nextElementSibling; if (!n || !n.classList.contains('field-error')) { n = h('small', { class: 'field-error', role: 'alert' }); el.insertAdjacentElement('afterend', n); } n.textContent = text; el.classList.toggle('input-error', !!text); return !text; };
    const numCheck = (el, label, min) => { const v = parseFloat(el.value); return noticeFor(el, el.value.trim() === '' || isNaN(v) ? 'Enter ' + label + '.' : v < (min || 0) ? label.charAt(0).toUpperCase() + label.slice(1) + ' cannot be below ' + (min || 0) + '.' : ''); };
    const textCheck = (el, label, max) => noticeFor(el, !el.value.trim() ? 'Please enter ' + label + '.' : el.value.trim().length > max ? 'Keep ' + label + ' to ' + max + ' characters.' : '');

    function setTabs() {
        const box = $('dashTabs'); box.replaceChildren();
        TABS[me.role].forEach(function (t) {
            box.append(h('button', { type: 'button', class: 'dash-tab', role: 'tab', 'aria-selected': String(t[0] === current), onclick: function () { show(t[0]); } }, t[1]));
        });
        if (me.role === 'SLP Admin') box.append(h('a', { class: 'dash-tab', href: 'admin.html', style: 'text-decoration:none;' }, 'Open Admin Panel →'));
    }
    async function show(tab) {
        current = tab; flash(''); setTabs();
        const body = $('dashBody'); body.replaceChildren(h('p', { class: 'muted', text: 'Loading...' }));
        const fn = VIEWS[me.role + ':' + tab] || VIEWS[tab];
        const out = await fn();
        body.replaceChildren(out);
    }

    // ================= shared: profile =================
    async function profile() {
        const form = h('form', { id: 'profForm', novalidate: true });
        const role = h('select', { id: 'prof-role' }, ['Buyer', 'Seller'].map((r) => h('option', { value: r, text: r, selected: me.role === r })));
        form.append(
            field('prof-name', 'Full name:', input('prof-name', { value: me.username || '', maxlength: 50 })),
            field('prof-address', 'Permanent address:', input('prof-address', { value: me.address || '', maxlength: 150, placeholder: 'Zone, Barangay, Town, Province' })),
            field('prof-phone', 'Contact number (11 digits):', input('prof-phone', { value: me.contact_number || '', maxlength: 11, inputmode: 'numeric', placeholder: '09071128654' })),
            field('prof-email', 'Email (optional):', input('prof-email', { value: me.email || '', maxlength: 100, type: 'email' })),
            me.role === 'SLP Admin' ? null : field('prof-role', 'System role:', role),
            h('div', { class: 'auth-msg', id: 'profMsg' }),
            btn('Save profile', 'btn-submit', null, 'fa-solid fa-floppy-disk'));
        form.lastChild.setAttribute('type', 'submit');
        const pw = h('form', { id: 'pwForm', novalidate: true },
            me.has_password ? field('pw-cur', 'Current password:', h('input', { id: 'pw-cur', type: 'password', autocomplete: 'current-password', maxlength: 200 })) : h('p', { class: 'muted', text: 'You signed in without a password. You can set one so you can also log in with your contact number.' }),
            field('pw-new', 'New password (8 or more characters):', h('input', { id: 'pw-new', type: 'password', autocomplete: 'new-password', maxlength: 72 })),
            h('div', { class: 'auth-msg', id: 'pwMsg' }),
            h('button', { type: 'submit', class: 'btn-submit' }, h('i', { class: 'fa-solid fa-key' }), ' ' + (me.has_password ? 'Change password' : 'Set password')));
        const wrap = h('div', { class: 'two-col' },
            h('div', { class: 'panel' }, h('h3', { text: 'My profile' }), me.needs_profile ? h('p', { class: 'low', text: 'Please complete your contact number and address so buyers and the SLP can reach you.' }) : null, form),
            h('div', { class: 'panel' }, h('h3', { text: 'Password' }), pw));
        setTimeout(function () {
            const v = window.uswagValidate;
            $('prof-phone').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, ''); });
            ['prof-name', 'prof-address', 'prof-phone', 'prof-email'].forEach(function (id) {
                const el = $(id); el.addEventListener('blur', () => v.check(el, true)); el.addEventListener('input', () => { if (el.classList.contains('input-error')) v.check(el, true); });
            });
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                const bad = ['prof-name', 'prof-address', 'prof-phone', 'prof-email'].map((id) => v.check($(id), true)).some(Boolean);
                if (bad) return;
                const body = { username: $('prof-name').value.trim(), address: $('prof-address').value.trim(), contact_number: $('prof-phone').value, email: $('prof-email').value.trim() };
                if (me.role !== 'SLP Admin') body.role = $('prof-role').value;
                const r = await api('profile', body);
                msg($('profMsg'), r.ok ? 'Saved.' : r.error, r.ok);
                if (r.ok) { await load(false); if (body.role && body.role !== current) { setTabs(); } }
            });
            pw.addEventListener('submit', async function (e) {
                e.preventDefault();
                const np = $('pw-new').value;
                const m = v.RULES['password-field'](np);
                if (noticeFor($('pw-new'), m) === false) return;
                const r = await api('profile', { new_password: np, current_password: me.has_password ? $('pw-cur').value : '' });
                msg($('pwMsg'), r.ok ? 'Password saved.' : r.error, r.ok);
                if (r.ok) { $('pw-new').value = ''; if ($('pw-cur')) $('pw-cur').value = ''; await load(false); }
            });
        }, 0);
        return wrap;
    }

    // ================= BUYER =================
    async function buyerOverview() {
        const r = await api('buyer/overview');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        const d = r.data;
        return h('div', {},
            statGrid([['Products in stock', String(d.products_available)], ['Active sellers', String(d.active_sellers)]]),
            h('div', { class: 'two-col' },
                h('div', { class: 'panel' }, h('h3', { text: 'Products by category' }), hbars(d.by_category, 'category_name', 'n')),
                h('div', { class: 'panel' }, h('h3', { text: 'Coming up' }), d.announcements.length ? h('div', {}, d.announcements.map((a) => h('p', {}, h('b', { text: a.title }), h('br'), document.createTextNode(when(a.event_start).replace(/ \d+:\d+ [AP]M/, '') + (a.time_text ? ' · ' + a.time_text : '') + (a.place ? ' · ' + a.place : ''))))) : h('p', { class: 'muted', text: 'No announcements right now.' }))));
    }
    async function market() {
        const box = h('div'); const out = h('div');
        const q = input('mk-q', { placeholder: 'Search product, category or seller...', maxlength: 50 });
        async function go() {
            const r = await api('market', { q: q.value.trim() });
            out.replaceChildren(r.ok ? table([
                { label: 'Product', key: 'product_name' }, { label: 'Category', key: 'category_name' },
                { label: 'Price', render: (p) => money(p.unit_price) + ' / ' + p.unit_of_measure }, { label: 'In stock', render: (p) => num(p.current_stock) + ' ' + p.unit_of_measure },
                { label: 'Seller', key: 'seller_name' }, { label: 'Location', key: 'barangay_zone' }], r.data.products, 'No products match yet.') : h('p', { class: 'low', text: r.error }));
        }
        let t; q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(go, 250); });
        box.append(h('div', { class: 'admin-toolbar' }, q), out, h('p', { class: 'muted', text: 'To buy, send the seller a message through Contact Us or visit the SLP Center.' }));
        go();
        return box;
    }

    // ================= SELLER =================
    async function sellerOverview() {
        const r = await api('seller/summary');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        const d = r.data;
        return h('div', {},
            statGrid([['Current balance', money(d.current_balance)], ['Starting capital', money(d.initial_capital)], ['Total sales (paid)', money(d.sales_total)], ['Expenses', money(d.expenses_total)],
                ['Profit', money(d.profit), d.profit < 0 ? 'low' : ''], ['Products', String(d.products)], ['Low stock', String(d.low_stock), d.low_stock ? 'low' : '']]),
            h('div', { class: 'two-col' },
                h('div', { class: 'panel' }, h('h3', { text: 'Sales, last 7 days' }), bars(d.daily.map((x) => ({ day: x.day, v: x.total })), money)),
                h('div', { class: 'panel' }, h('h3', { text: 'Best sellers' }), hbars(d.top_products, 'product_name', 'total', money))),
            h('div', { class: 'panel', style: 'margin-top:18px;' }, h('h3', { text: 'Running low' }), d.low_items.length ? table([{ label: 'Product', key: 'product_name' }, { label: 'Left', render: (p) => num(p.current_stock) + ' ' + p.unit_of_measure }], d.low_items) : h('p', { class: 'muted', text: 'Nothing is running low.' })));
    }
    async function loadCats() { if (!cats.length) { const r = await api('categories'); cats = r.ok ? r.data.categories : []; } }
    async function products() {
        await loadCats();
        const wrap = h('div'); const listBox = h('div'); const formBox = h('div');
        let editing = null;
        function productForm() {
            const catSel = h('select', { id: 'pf-cat' }, cats.map((c) => h('option', { value: c.category_id, text: c.category_name, selected: editing && editing.category_id == c.category_id })));
            const f = h('form', { class: 'admin-form', novalidate: true },
                h('h3', { text: editing ? 'Edit ' + editing.product_name : 'Add a product' }),
                h('div', { class: 'form-grid' },
                    field('pf-name', 'Product name:', input('pf-name', { maxlength: 100, value: editing ? editing.product_name : '' })),
                    field('pf-cat', 'Category:', catSel),
                    field('pf-unit', 'Unit (kg, pc, sack...):', input('pf-unit', { maxlength: 20, value: editing ? editing.unit_of_measure : 'kg' })),
                    field('pf-price', 'Price per unit (₱):', input('pf-price', { inputmode: 'decimal', value: editing ? editing.unit_price : '' })),
                    editing ? null : field('pf-stock', 'Opening stock:', input('pf-stock', { inputmode: 'decimal', value: '0' })),
                    field('pf-low', 'Warn me when stock is at or below:', input('pf-low', { inputmode: 'decimal', value: editing ? editing.reorder_level : '10' }))),
                h('div', { class: 'auth-msg', id: 'pfMsg' }),
                h('div', { class: 'row-actions' }, h('button', { type: 'submit', class: 'btn-submit', style: 'width:auto;' }, editing ? 'Save changes' : 'Add product'), editing ? btn('Cancel', 'btn-secondary', () => { editing = null; draw(); }) : null));
            f.addEventListener('submit', async function (e) {
                e.preventDefault();
                const ok = [textCheck($('pf-name'), 'the product name', 100), textCheck($('pf-unit'), 'a unit', 20), numCheck($('pf-price'), 'a price', 0), editing ? true : numCheck($('pf-stock'), 'the opening stock', 0), numCheck($('pf-low'), 'a low-stock level', 0)].every(Boolean);
                if (!ok) return;
                const body = { name: $('pf-name').value.trim(), category_id: +$('pf-cat').value, unit: $('pf-unit').value.trim(), price: +$('pf-price').value, reorder_level: +$('pf-low').value };
                let r;
                if (editing) r = await api('seller/products', Object.assign({ action: 'update', product_id: editing.product_id }, body));
                else r = await api('seller/products', Object.assign({ action: 'add', stock: +$('pf-stock').value }, body));
                if (!r.ok) { msg($('pfMsg'), r.error); return; }
                editing = null; draw();
            });
            return f;
        }
        function stockForm(p) {
            const f = h('form', { class: 'admin-form', novalidate: true },
                h('h3', { text: 'Stock for ' + p.product_name + ' (now ' + num(p.current_stock) + ' ' + p.unit_of_measure + ')' }),
                h('div', { class: 'form-grid' },
                    field('sf-type', 'What happened?', h('select', { id: 'sf-type' }, [['Harvest/Restock', 'Harvest / restock (adds)'], ['Spoilage', 'Spoilage / loss (subtracts)'], ['Adjustment', 'Correction (+ or -)']].map((o) => h('option', { value: o[0], text: o[1] })))),
                    field('sf-qty', 'Quantity:', input('sf-qty', { inputmode: 'decimal' })),
                    field('sf-rem', 'Note (optional):', input('sf-rem', { maxlength: 150 }))),
                h('div', { class: 'auth-msg', id: 'sfMsg' }),
                h('div', { class: 'row-actions' }, h('button', { type: 'submit', class: 'btn-submit', style: 'width:auto;' }, 'Save stock'), btn('Cancel', 'btn-secondary', () => draw())));
            f.addEventListener('submit', async function (e) {
                e.preventDefault();
                const q = parseFloat($('sf-qty').value);
                if (!noticeFor($('sf-qty'), isNaN(q) || q === 0 ? 'Enter a quantity (not zero).' : ($('sf-type').value !== 'Adjustment' && q < 0) ? 'Use a positive number here.' : '')) return;
                const r = await api('seller/products', { action: 'stock', product_id: p.product_id, type: $('sf-type').value, qty: q, remarks: $('sf-rem').value.trim() });
                if (!r.ok) { msg($('sfMsg'), r.error); return; }
                draw();
            });
            return f;
        }
        async function draw(stockFor) {
            const r = await api('seller/products');
            formBox.replaceChildren(stockFor ? stockForm(stockFor) : productForm());
            if (!r.ok) { listBox.replaceChildren(h('p', { class: 'low', text: r.error })); return; }
            listBox.replaceChildren(table([
                { label: 'Product', key: 'product_name' }, { label: 'Category', key: 'category_name' },
                { label: 'Price', render: (p) => money(p.unit_price) + ' / ' + p.unit_of_measure },
                { label: 'Stock', render: (p) => h('span', { class: p.current_stock <= p.reorder_level ? 'low' : '', text: num(p.current_stock) + ' ' + p.unit_of_measure + (p.current_stock <= p.reorder_level ? ' (low)' : '') }) },
                { label: '', render: (p) => h('div', { class: 'row-actions' },
                    h('button', { type: 'button', onclick: () => draw(p) }, 'Stock'),
                    h('button', { type: 'button', onclick: () => { editing = p; draw(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Edit'),
                    h('button', { type: 'button', class: 'danger', onclick: async () => { if (!confirm('Remove ' + p.product_name + ' from your list? Past sales stay in your records.')) return; const x = await api('seller/products', { action: 'remove', product_id: p.product_id }); if (!x.ok) flash(x.error); draw(); } }, 'Remove')) }
            ], r.data.products, 'You have no products yet. Add your first one above.'));
        }
        wrap.append(formBox, listBox); draw();
        return wrap;
    }
    async function record() {
        await loadCats();
        const r = await api('seller/products');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        const prods = r.data.products.filter((p) => p.current_stock > 0);
        if (!prods.length) return h('p', { class: 'muted', text: 'You need a product with stock before you can record a sale. Add one in My Products.' });
        const cart = [];
        const sel = h('select', { id: 'rs-prod' }, prods.map((p) => h('option', { value: p.product_id, text: p.product_name + ' — ' + money(p.unit_price) + '/' + p.unit_of_measure + ' (' + num(p.current_stock) + ' left)' })));
        const qty = input('rs-qty', { inputmode: 'decimal', placeholder: 'Quantity' });
        const buyer = input('rs-buyer', { maxlength: 100, placeholder: 'Walk-in buyer' });
        const list = h('div'); const out = h('div', { class: 'auth-msg', id: 'rsMsg' });
        function draw() {
            const total = cart.reduce((s, c) => s + Math.round(c.qty * c.p.unit_price * 100) / 100, 0);
            list.replaceChildren(cart.length ? table([{ label: 'Product', render: (c) => c.p.product_name }, { label: 'Qty', render: (c) => num(c.qty) + ' ' + c.p.unit_of_measure }, { label: 'Amount', render: (c) => money(c.qty * c.p.unit_price) }, { label: '', render: (c) => h('button', { type: 'button', class: 'mini-btn danger', onclick: () => { cart.splice(cart.indexOf(c), 1); draw(); } }, 'Remove') }], cart) : h('p', { class: 'muted', text: 'No items yet.' }), h('p', {}, h('b', { text: 'Total: ' + money(total) })));
        }
        const wrap = h('div', { class: 'admin-form' }, h('h3', { text: 'Record a sale' }),
            h('div', { class: 'form-grid' }, field('rs-prod', 'Product:', sel), field('rs-qty', 'Quantity:', qty), field('rs-buyer', 'Buyer name (optional):', buyer)),
            h('div', { class: 'row-actions' }, btn('Add to sale', 'btn-secondary', function () {
                const p = prods.find((x) => x.product_id == sel.value); const q = parseFloat(qty.value);
                const have = cart.filter((c) => c.p === p).reduce((s, c) => s + c.qty, 0);
                if (!noticeFor(qty, isNaN(q) || q <= 0 ? 'Enter a quantity above 0.' : (q + have) > p.current_stock ? 'You only have ' + num(p.current_stock) + ' ' + p.unit_of_measure + ' of ' + p.product_name + '.' : '')) return;
                cart.push({ p: p, qty: q }); qty.value = ''; draw();
            })), list, out,
            btn('Record sale', 'btn-submit', async function () {
                if (!cart.length) { msg(out, 'Add at least one product first.'); return; }
                const items = {}; cart.forEach((c) => { items[c.p.product_id] = (items[c.p.product_id] || 0) + c.qty; });
                const res = await api('seller/sales', { action: 'record', buyer_name: buyer.value.trim(), items: Object.keys(items).map((k) => ({ product_id: +k, qty: items[k] })) });
                if (!res.ok) { msg(out, res.error); return; }
                await show('sales'); flash('Sale recorded: ' + money(res.data.total) + ' (' + res.data.receipt + ').', true);
            }, 'fa-solid fa-receipt'));
        draw();
        return wrap;
    }
    async function sales() {
        const r = await api('seller/sales');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        return table([{ label: 'Receipt', key: 'receipt_number' }, { label: 'Date', render: (s) => when(s.sale_date) }, { label: 'Buyer', key: 'buyer_name' }, { label: 'Items', key: 'items' }, { label: 'Total', render: (s) => money(s.total) }, { label: 'Status', render: (s) => h('span', { class: 'badge ' + (s.status === 'Paid' ? 'badge-on' : 'badge-Review'), text: s.status }) }], r.data.sales, 'No sales recorded yet.');
    }
    async function expenses() {
        const wrap = h('div'); const listBox = h('div');
        const cat = h('select', { id: 'ex-cat' }, ['Raw Materials/Seeds', 'Labor', 'Equipment', 'Other'].map((c) => h('option', { value: c, text: c })));
        const f = h('form', { class: 'admin-form', novalidate: true }, h('h3', { text: 'Add an expense' }),
            h('div', { class: 'form-grid' }, field('ex-cat', 'Type:', cat), field('ex-desc', 'What was it for?', input('ex-desc', { maxlength: 150 })), field('ex-amt', 'Amount (₱):', input('ex-amt', { inputmode: 'decimal' }))),
            h('div', { class: 'auth-msg', id: 'exMsg' }), h('button', { type: 'submit', class: 'btn-submit', style: 'width:auto;' }, 'Save expense'));
        f.addEventListener('submit', async function (e) {
            e.preventDefault();
            const a = parseFloat($('ex-amt').value);
            const ok = [textCheck($('ex-desc'), 'a description', 150), noticeFor($('ex-amt'), isNaN(a) || a <= 0 ? 'Enter an amount above 0.' : '')].every(Boolean);
            if (!ok) return;
            const r = await api('seller/expenses', { action: 'add', category: cat.value, description: $('ex-desc').value.trim(), amount: a });
            if (!r.ok) { msg($('exMsg'), r.error); return; }
            $('ex-desc').value = ''; $('ex-amt').value = ''; msg($('exMsg'), 'Saved. Your balance went down by ' + money(a) + '.', true); draw();
        });
        async function draw() { const r = await api('seller/expenses'); listBox.replaceChildren(r.ok ? table([{ label: 'Date', render: (x) => when(x.expense_date) }, { label: 'Type', key: 'expense_category' }, { label: 'Description', key: 'description' }, { label: 'Amount', render: (x) => money(x.amount) }], r.data.expenses, 'No expenses yet.') : h('p', { class: 'low', text: r.error })); }
        wrap.append(f, listBox); draw();
        return wrap;
    }
    async function capital() {
        const s = await api('seller/summary'); const wrap = h('div'); const listBox = h('div');
        const f = h('form', { class: 'admin-form', novalidate: true }, h('h3', { text: 'Starting capital' }),
            h('p', { class: 'muted', text: 'Current balance: ' + money(s.data.current_balance) + '. Changing the starting capital adds or subtracts the difference from your balance.' }),
            h('div', { class: 'form-grid' }, field('cp-amt', 'Starting capital (₱):', input('cp-amt', { inputmode: 'decimal', value: s.ok ? s.data.initial_capital : '0' }))),
            h('div', { class: 'auth-msg', id: 'cpMsg' }), h('button', { type: 'submit', class: 'btn-submit', style: 'width:auto;' }, 'Save'));
        f.addEventListener('submit', async function (e) {
            e.preventDefault();
            if (!numCheck($('cp-amt'), 'your starting capital', 0)) return;
            const r = await api('seller/capital', { initial_capital: +$('cp-amt').value });
            if (!r.ok) { msg($('cpMsg'), r.error); return; }
            show('capital');
        });
        const l = await api('seller/capital', { action: 'ledger' });
        listBox.append(h('h3', { text: 'Money trail' }), l.ok ? table([{ label: 'Date', render: (x) => when(x.created_at) }, { label: 'Type', key: 'entry_type' }, { label: 'Amount', render: (x) => h('span', { class: x.amount < 0 ? 'low' : '', text: (x.amount > 0 ? '+' : '') + money(x.amount) }) }, { label: 'Balance after', render: (x) => money(x.balance_after) }, { label: 'Note', key: 'note' }], l.data.ledger, 'No money movement yet.') : h('p', { class: 'low', text: l.error }));
        wrap.append(f, listBox);
        return wrap;
    }

    // ================= ADMIN (summary; full tools are in admin.html) =================
    async function adminOverview() {
        const r = await api('admin/overview');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        const d = r.data; const by = {}; d.accounts.forEach((a) => { by[a.role] = a; }); const msgs = {}; d.messages.forEach((m) => { msgs[m.status] = m.n; });
        const total = d.accounts.reduce((s, a) => s + a.n, 0);
        return h('div', {},
            statGrid([['Accounts', String(total)], ['Buyers', String((by.Buyer || {}).n || 0)], ['Sellers', String((by.Seller || {}).n || 0)], ['SLP Admins', String((by['SLP Admin'] || {}).n || 0)],
                ['Messages waiting', String(msgs.Review || 0), (msgs.Review || 0) ? 'low' : ''], ['Active products', String(d.products)], ['Paid sales', money(d.sales.total)]]),
            h('div', { class: 'two-col' },
                h('div', { class: 'panel' }, h('h3', { text: 'New accounts, last 7 days' }), bars(d.signups.map((x) => ({ day: x.day, v: x.n })))),
                h('div', { class: 'panel' }, h('h3', { text: 'Products by category' }), hbars(d.by_category, 'category_name', 'n'))),
            h('div', { class: 'panel', style: 'margin-top:18px;' }, h('h3', { text: 'Newest accounts' }), table([{ label: 'Name', key: 'username' }, { label: 'Role', key: 'role' }, { label: 'Contact', key: 'contact_number' }, { label: 'Joined', render: (a) => when(a.created_at) }], d.recent_accounts)),
            h('p', { style: 'margin-top:14px;' }, h('a', { class: 'btn-submit', href: 'admin.html', style: 'display:inline-flex;width:auto;text-decoration:none;' }, 'Manage messages, accounts, news, announcements and gallery →')));
    }
    async function adminSellers() {
        const r = await api('admin/sellers');
        if (!r.ok) return h('p', { class: 'low', text: r.error });
        return table([{ label: 'Seller', key: 'seller_name' }, { label: 'Location', key: 'barangay_zone' }, { label: 'Contact', key: 'contact_number' }, { label: 'Products', key: 'products' }, { label: 'Sales', render: (s) => money(s.sales_total) }, { label: 'Expenses', render: (s) => money(s.expenses_total) }, { label: 'Balance', render: (s) => money(s.balance) }], r.data.sellers, 'No sellers yet.');
    }

    const VIEWS = {
        'Buyer:overview': buyerOverview, 'Seller:overview': sellerOverview, 'SLP Admin:overview': adminOverview,
        market: market, products: products, record: record, sales: sales, expenses: expenses, capital: capital, sellers: adminSellers, profile: profile
    };

    async function load(render) {
        const r = await api('me');
        if (!r.ok) { location.href = 'login.html?msg=signin'; return false; }
        me = r.data.user;
        $('dashTitle').textContent = 'Hello, ' + (me.username || 'member');
        $('roleBadge').textContent = me.role;
        if (render !== false) { current = me.needs_profile ? 'profile' : 'overview'; await show(current); if (me.needs_profile) flash('Welcome! Please complete your profile below.', true); }
        return true;
    }
    function start() { $('logoutBtn').addEventListener('click', window.U.logout); load(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
