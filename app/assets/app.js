/* Kaufen – Bedienung im Browser: Liste, Katalog, Abgleich mit dem Server, Arbeiten ohne Netz */
(() => {
'use strict';

/* ---------- kleine Helfer ---------- */
const $ = (s, r = document) => r.querySelector(s);
const PROPS = ['value', 'checked', 'disabled', 'selected', 'hidden'];

/** Baut ein Element: h('button', {class: 'btn', onclick: fn}, 'Text', kind, …) */
function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'data') Object.assign(e.dataset, v);
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else if (PROPS.includes(k)) e[k] = v;
        else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c);
    return e;
}
const flat = a => a.flat(Infinity).filter(c => c != null && c !== false);
/** Inhalt ersetzen bzw. anhängen, verschachtelte Listen und leere Werte sind erlaubt */
const fill = (el, ...a) => el.replaceChildren(...flat(a));
const put = (el, ...a) => el.append(...flat(a));
function icon(path) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', path);
    p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
    s.append(p);
    return s;
}
const I = {
    x: 'M6 6l12 12M18 6L6 18', down: 'M6 9l6 6 6-6', up: 'M6 15l6-6 6 6', more: 'M5 12h.01M12 12h.01M19 12h.01',
    edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4', grip: 'M5 9h14M5 15h14',
    tiles: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z', compact: 'M3 6h8M14 6h7M3 12h5M11 12h10M3 18h9M15 18h6',
};

const LS = {
    get(k, d) { try { const v = localStorage.getItem('kf_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kf_' + k, JSON.stringify(v)); } catch (e) {} },
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith('kf_') && k !== 'kf_theme' && k !== 'kf_view').forEach(k => localStorage.removeItem(k)); } catch (e) {} },
};

const low = s => String(s).toLocaleLowerCase('de');
/** Für die Suche: klein, ohne Akzente, ä = a, ß = ss */
const norm = s => low(s).replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');
function newUid() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}
function fmtTime(ts) {
    const d = new Date(ts * 1000), t = new Date();
    const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === t.toDateString()) return 'heute ' + hm;
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: d.getFullYear() === t.getFullYear() ? undefined : 'numeric' }) + ' ' + hm;
}

/* ---------- Zustand ---------- */
let S = LS.get('state', null);            // Konten, Listen, Katalog, Vorlagen (vom Server, zuletzt gesehen)
let cur = LS.get('cur', null);            // Nummer der offenen Liste
let L = cur ? LS.get('list_' + cur, null) : null;   // Inhalt der offenen Liste
let queue = LS.get('queue', []);          // Änderungen, die der Server noch nicht hat
let csrf = '';                            // kommt erst mit der ersten Antwort des Servers
let online = true, flushing = false, timer = 0, iv = S ? S.interval : 5;
const stateListeners = new Set();         // offene Fenster, die bei neuem Stand neu zeichnen
const main = $('#main'), qInput = $('#q');

const saveQueue = () => LS.set('queue', queue);
const curList = () => S && S.lists.find(l => l.id === cur) || null;
const userName = id => { const u = S && S.users.find(u => u.id === id); return u ? u.n : ''; };
const catName = id => { const c = S && S.catalog.cats.find(c => c.id === id); return c ? c.n : 'Sonstiges'; };
const hasCat = id => !!(S && S.catalog.cats.some(c => c.id === id));
const itemByName = n => L ? L.items.find(i => low(i.n) === low(n)) : null;

/** Warengruppen in der Reihenfolge dieser Liste, 0 = Sonstiges steht immer am Ende */
function catOrder() {
    const all = S.catalog.cats.map(c => c.id);
    const first = (L ? L.order : []).filter(id => all.includes(id));
    return [...first, ...all.filter(id => !first.includes(id)), 0];
}

/* ---------- Server ---------- */
function setOnline(v) {
    online = v;
    showNet();
}
function showNet() {
    const el = $('#net');
    const n = queue.length;
    el.hidden = online && !n;
    el.textContent = !online ? (n ? 'Offline · ' + n + ' offen' : 'Offline') : (n ? 'Sende …' : '');
}

async function api(action, body) {
    let r;
    try {
        r = await fetch('?action=' + action, {
            method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
            headers: body ? { 'Content-Type': 'application/json', 'X-CSRF': csrf } : {},
            body: body ? JSON.stringify(body) : undefined,
        });
    } catch (e) {
        setOnline(false);
        throw Object.assign(new Error('Keine Verbindung zum Server.'), { net: true });
    }
    setOnline(true);
    if (r.status === 401) { location.reload(); throw Object.assign(new Error('Abgemeldet.'), { net: true }); }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j) throw Object.assign(new Error(j && j.error || 'Der Server antwortet nicht richtig (' + r.status + ').'), { net: r.status >= 500, status: r.status });
    return j;
}

/** Neuen Stand vom Server übernehmen (kommt als Antwort auf fast jede Aktion) */
function applyState(s) {
    if (S && S.me && S.me.id !== s.me.id) { queue = []; saveQueue(); L = null; cur = null; }   // anderes Konto auf diesem Gerät
    S = s;
    csrf = s.csrf;
    iv = s.interval;
    LS.set('state', S);
    if (!S.lists.some(l => l.id === cur)) {
        cur = S.lists.length ? S.lists[0].id : null;
        LS.set('cur', cur);
        L = cur ? LS.get('list_' + cur, null) : null;
        if (cur) loadList();
    }
    render();
    stateListeners.forEach(fn => fn());
}

async function loadState() {
    applyState(await api('state'));
    flush();
}

function setList(data) {
    if (data.id !== cur) return;
    L = data;
    LS.set('list_' + cur, L);
    const l = curList();
    if (l) l.count = L.items.length;
    render();
}

async function loadList() {
    if (!cur) return;
    if (queue.some(x => x.l === cur)) { flush(); return; }   // erst die eigenen Änderungen abliefern, die Antwort bringt den neuen Stand mit
    const id = cur;
    try {
        const r = await api('list&id=' + id);
        if (id === cur && !queue.some(x => x.l === id)) setList(r);
    } catch (e) {
        if (!e.net) toast(e.message);
    }
}

function openList(id) {
    cur = id;
    LS.set('cur', cur);
    L = LS.get('list_' + cur, null);
    qInput.value = '';
    render();
    loadList();
}

/* ---------- Änderungen an der Liste: sofort anzeigen, merken, im Hintergrund abliefern ---------- */
function applyLocal(o) {
    const now = Math.floor(Date.now() / 1000);
    if (o.t === 'add' || o.t === 'restore') {
        if (L.items.some(i => i.uid === o.uid)) return;
        const same = itemByName(o.n);
        if (same) { if (o.note) same.note = o.note; }
        else L.items.push({ uid: o.uid, n: o.n, c: o.c || 0, note: o.note || '', by: o.by || S.me.id, at: now });
        if (o.t === 'restore') {
            const u = L.usage.find(u => low(u.n) === low(o.n));
            if (u && --u.cnt <= 0) L.usage = L.usage.filter(x => x !== u);
        }
    } else if (o.t === 'done' || o.t === 'remove') {
        const it = L.items.find(i => i.uid === o.uid);
        if (!it) return;
        L.items = L.items.filter(i => i !== it);
        if (o.t === 'done') {
            const u = L.usage.find(u => low(u.n) === low(it.n));
            L.usage = L.usage.filter(x => x !== u);
            L.usage.unshift({ n: it.n, c: it.c, cnt: (u ? u.cnt : 0) + 1, last: now });
        }
    } else if (o.t === 'edit') {
        const it = L.items.find(i => i.uid === o.uid);
        if (it) { it.note = o.note || ''; it.c = o.c || 0; }
    } else if (o.t === 'forget') {
        L.usage = L.usage.filter(u => low(u.n) !== low(o.n));
    }
}

function op(...ops) {
    if (!L || !cur) return;
    for (const o of ops.flat()) {
        applyLocal(o);
        queue.push({ l: cur, o });
    }
    saveQueue();
    LS.set('list_' + cur, L);
    const l = curList();
    if (l) l.count = L.items.length;
    render();
    flush();
}

async function flush() {
    if (flushing || !queue.length || !csrf) { showNet(); return; }
    flushing = true;
    showNet();
    try {
        while (queue.length) {
            const l = queue[0].l;
            let n = 0;
            while (n < queue.length && n < 200 && queue[n].l === l) n++;
            let res;
            try {
                res = await api('ops', { list: l, ops: queue.slice(0, n).map(x => x.o) });
            } catch (e) {
                if (e.net) break;                         // später noch einmal
                queue.splice(0, n);                       // der Server will sie nicht (z. B. Liste gelöscht)
                saveQueue();
                toast(e.message);
                if (e.status === 404 || e.status === 403) { flushing = false; await loadState().catch(() => {}); flushing = true; }
                continue;
            }
            queue.splice(0, n);
            saveQueue();
            if (l === cur && !queue.some(x => x.l === l)) setList(res);
        }
    } finally {
        flushing = false;
        showNet();
    }
}

/** Der regelmäßige Abgleich. Fragt nur drei Zähler ab und lädt erst nach, wenn sich einer geändert hat. */
async function tick() {
    clearTimeout(timer);
    try {
        if (!document.hidden) {
            if (!csrf) await loadState();
            else {
                if (queue.length) flush();
                const r = await api('poll&id=' + (cur || 0));
                if (r.iv) iv = r.iv;
                if (r.cv !== S.cv || r.lv !== S.lv || (cur && r.v === null)) await loadState();
                if (cur && r.v !== null && (!L || r.v !== L.v) && !flushing) await loadList();
            }
        }
    } catch (e) {}
    timer = setTimeout(tick, Math.max(1, iv) * 1000);
}

/* ---------- Meldung unten, mit Knopf (z. B. Rückgängig) ---------- */
let toastTimer = 0;
function toast(text, actionLabel, action) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    fill(el, h('span', null, text), actionLabel && h('button', { type: 'button', onclick: () => { el.hidden = true; action(); } }, actionLabel));
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 3500);
}

/* ---------- Fenster ---------- */
const sheets = [];
function sheet(title, opts = {}) {
    const body = h('div', { class: 'body' });
    const titleEl = h('h3', null, title);
    const box = h('div', { class: 'sheet' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
        h('header', null, titleEl, h('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Schließen', onclick: () => api_.close() }, icon(I.x))), body);
    const ov = h('div', { class: 'ov', onclick: e => { if (e.target === ov) api_.close(); } }, box);
    const api_ = {
        body, titleEl,
        close() {
            const i = sheets.indexOf(api_);
            if (i < 0) return;
            sheets.splice(i, 1);
            ov.remove();
            if (opts.onclose) opts.onclose();
        },
    };
    sheets.push(api_);
    $('#layer').append(ov);
    return api_;
}
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheets.length) sheets[sheets.length - 1].close();
});

/**
 * Kleines Formular. fields: {k, label, type: text|password|number|select|checkbox|textarea|info, value, options: [[wert, text]], …}
 * submit bekommt die Werte, darf einen Fehler werfen (wird im Fenster angezeigt). extra: weitere Knöpfe {label, danger, fn}.
 */
function ask(title, fields, okLabel, submit, extra = []) {
    const sh = sheet(title);
    const err = h('p', { class: 'err', role: 'alert', hidden: true });
    const inputs = {};
    const nodes = fields.filter(Boolean).map(f => {
        if (f.type === 'info') return h('p', { class: 'info' }, f.text);
        if (f.type === 'checkbox') {
            const i = inputs[f.k] = h('input', { type: 'checkbox', checked: !!f.value });
            return h('label', { class: 'check' }, i, h('span', null, f.label));
        }
        let i;
        if (f.type === 'select') i = h('select', null, f.options.map(([v, t]) => h('option', { value: String(v), selected: String(v) === String(f.value) }, t)));
        else if (f.type === 'textarea') i = h('textarea', { placeholder: f.placeholder, value: f.value || '' });
        else i = h('input', { type: f.type || 'text', value: f.value == null ? '' : String(f.value), placeholder: f.placeholder, maxlength: f.max, min: f.min, max: f.type === 'number' ? f.maxv : null,
            autocomplete: f.type === 'password' ? (f.auto || 'new-password') : 'off', inputmode: f.type === 'number' ? 'numeric' : null, enterkeyhint: 'done' });
        inputs[f.k] = i;
        return h('label', { class: 'field' }, f.label, i);
    });
    const okBtn = okLabel && h('button', { class: 'btn primary', type: 'submit' }, okLabel);
    const run = async fn => {
        const vals = {};
        for (const k in inputs) vals[k] = inputs[k].type === 'checkbox' ? inputs[k].checked : inputs[k].value;
        err.hidden = true;
        form.querySelectorAll('button').forEach(b => { b.disabled = true; });
        try {
            if (await fn(vals) !== false) sh.close();
        } catch (e) {
            err.textContent = e.message;
            err.hidden = false;
        }
        form.querySelectorAll('button').forEach(b => { b.disabled = false; });
    };
    const form = h('form', { onsubmit: e => { e.preventDefault(); run(submit); } }, nodes, err,
        h('div', { class: 'btns' },
            extra.filter(Boolean).map(x => h('button', { class: 'btn' + (x.danger ? ' danger' : ''), type: 'button', onclick: () => run(x.fn) }, x.label)),
            okBtn));
    put(sh.body, form);
    const first = form.querySelector('input:not([type=checkbox]), textarea');
    if (first && !('ontouchstart' in window)) first.focus();
    return sh;
}
const confirmDlg = (title, text, okLabel, fn) => ask(title, [{ type: 'info', text }], null, null, [{ label: okLabel, danger: true, fn }]);
/** Aktion mit neuem Stand als Antwort */
const act = async (action, body) => applyState(await api(action, body));

/* ---------- Hauptansicht ---------- */
function tile(cls, data, name, note, by) {
    return h('button', { class: 'tile ' + cls, type: 'button', data }, h('span', { class: 'tn' }, name), note && h('span', { class: 'tt' }, note), by && h('span', { class: 'tb' }, by));
}
const prodTile = (n, c, src) => {
    const it = itemByName(n);
    return tile(it ? 'has' : '', { k: 'prod', n, c, src: src || '' }, n, it && it.note);
};

function render() {
    const l = curList();
    $('#listName').textContent = l ? l.n : 'Kaufen';
    document.title = l ? l.n + ' – Kaufen' : 'Kaufen';
    showNet();
    if (!S) { main.replaceChildren(h('p', { class: 'hint' }, online ? 'Lade …' : 'Keine Verbindung. Sobald wieder Netz da ist, geht es weiter.')); return; }
    if (!l) {
        main.replaceChildren(h('p', { class: 'hint' }, 'Du bist noch in keiner Liste. Leg eine eigene an oder lass dich in eine einladen.'),
            h('button', { class: 'btn primary', type: 'button', onclick: newList }, 'Neue Liste anlegen'));
        return;
    }
    if (!L) { main.replaceChildren(h('p', { class: 'hint' }, 'Lade …')); return; }
    const q = norm(qInput.value.trim());
    main.replaceChildren(...(q ? viewSearch(q) : viewHome(l)));
}

function viewHome(l) {
    const out = [];
    const order = catOrder();
    const shared = l.members.length > 1;
    out.push(h('h2', null, 'Noch zu kaufen', h('small', null, L.items.length ? String(L.items.length) : '')));
    if (!L.items.length) out.push(h('p', { class: 'hint' }, 'Alles erledigt. Tippe unten auf ein Produkt oder such oben danach, dann landet es hier.'));
    const groups = new Map(order.map(id => [id, []]));
    for (const it of L.items) groups.get(hasCat(it.c) ? it.c : 0).push(it);
    for (const [id, items] of groups) {
        if (!items.length) continue;
        out.push(h('div', { class: 'grp' }, catName(id)));
        out.push(h('div', { class: 'grid' }, items.map(it => tile('on', { k: 'item', uid: it.uid }, it.n, it.note, shared && it.by !== S.me.id && userName(it.by)))));
    }

    // Zuletzt gekauft: erst die jüngsten, dann aufgefüllt mit den häufigsten
    const free = L.usage.filter(u => !itemByName(u.n));
    const recent = free.slice(0, 8);
    for (const u of [...free].sort((a, b) => b.cnt - a.cnt)) {
        if (recent.length >= 12) break;
        if (!recent.includes(u)) recent.push(u);
    }
    if (recent.length) {
        out.push(h('h2', null, 'Zuletzt gekauft'));
        out.push(h('div', { class: 'grid' }, recent.map(u => prodTile(u.n, hasCat(u.c) ? u.c : 0, 'recent'))));
    }

    out.push(h('h2', null, 'Katalog'));
    if (!S.catalog.cats.length) out.push(h('p', { class: 'hint' }, 'Der Katalog ist leer. Über die Suche oben kannst du trotzdem alles auf die Liste setzen. Unter Menü → Katalog verwalten lassen sich Warengruppen anlegen oder der Standard zurückholen.'));
    const open = LS.get('open', {});
    const byCat = new Map();
    for (const p of S.catalog.products) (byCat.get(p.c) || byCat.set(p.c, []).get(p.c)).push(p);
    for (const id of order) {
        if (!id) continue;
        const prods = byCat.get(id) || [];
        const isOpen = !!open[id];
        out.push(h('button', { class: 'cat' + (isOpen ? ' open' : ''), type: 'button', data: { k: 'cat', id }, 'aria-expanded': String(isOpen) }, catName(id), h('small', null, String(prods.length)), icon(I.down)));
        if (isOpen) out.push(h('div', { class: 'grid' }, prods.map(p => prodTile(p.n, p.c)),
            tile('new', { k: 'newin', id }, '+ Neu')));
    }
    return out;
}

function viewSearch(q) {
    const seen = new Map();
    const add = (n, c) => { if (!seen.has(low(n))) seen.set(low(n), { n, c }); };
    for (const p of S.catalog.products) if (norm(p.n).includes(q)) add(p.n, p.c);
    for (const i of L.items) if (norm(i.n).includes(q)) add(i.n, i.c);
    for (const u of L.usage) if (norm(u.n).includes(q)) add(u.n, u.c);
    const hits = [...seen.values()].sort((a, b) => (norm(b.n).startsWith(q) - norm(a.n).startsWith(q)) || a.n.localeCompare(b.n, 'de'));
    const exact = hits.some(x => norm(x.n) === q);
    const raw = qInput.value.trim().replace(/\s+/g, ' ').slice(0, 60);
    const out = [h('h2', null, 'Treffer', h('small', null, String(hits.length)))];
    const tiles = hits.slice(0, 60).map(x => prodTile(x.n, hasCat(x.c) ? x.c : 0));
    if (!exact) tiles.unshift(tile('new', { k: 'new', n: raw }, '„' + raw + '“ hinzufügen'));
    out.push(h('div', { class: 'grid' }, tiles));
    return out;
}

/* ---------- Tippen und lange drücken ---------- */
function tapItem(uid) {
    const it = L.items.find(i => i.uid === uid);
    if (!it) return;
    op({ t: 'done', uid });
    toast(it.n + ' erledigt', 'Rückgängig', () => op({ t: 'restore', uid: it.uid, n: it.n, c: it.c, note: it.note, by: it.by }));
}
function tapProd(n, c) {
    const it = itemByName(n);
    if (it) op({ t: 'remove', uid: it.uid });
    else op({ t: 'add', uid: newUid(), n, c, note: '' });
    if (qInput.value) { qInput.value = ''; render(); }
}
const catOptions = () => [...S.catalog.cats.map(c => [c.id, c.n]), [0, 'Sonstiges']];

function itemDialog(it) {
    const who = userName(it.by);
    ask(it.n, [
        { k: 'note', label: 'Menge oder Hinweis', value: it.note, placeholder: 'z. B. 2 Liter, die grünen', max: 80 },
        { k: 'c', label: 'Warengruppe', type: 'select', value: hasCat(it.c) ? it.c : 0, options: catOptions() },
        { type: 'info', text: 'Auf die Liste gesetzt' + (who ? ' von ' + who : '') + ', ' + fmtTime(it.at) + '.' },
    ], 'Speichern', v => op({ t: 'edit', uid: it.uid, note: v.note.trim(), c: +v.c }),
    [{ label: 'Von der Liste nehmen', danger: true, fn: () => op({ t: 'remove', uid: it.uid }) }]);
}
function prodDialog(n, c, src) {
    const it = itemByName(n);
    if (it) return itemDialog(it);
    ask(n, [{ k: 'note', label: 'Menge oder Hinweis', placeholder: 'z. B. 2 Liter, die grünen', max: 80 }],
        'Auf die Liste', v => op({ t: 'add', uid: newUid(), n, c, note: v.note.trim() }),
        [src === 'recent' && { label: 'Aus „Zuletzt gekauft“ entfernen', fn: () => op({ t: 'forget', n }) }]);
}
/** Neues Produkt aus der Suche oder aus einer Warengruppe heraus */
function newProduct(name, catId) {
    const cats = S.catalog.cats;
    ask('Neues Produkt', [
        { k: 'n', label: 'Name', value: name, max: 60 },
        { k: 'note', label: 'Menge oder Hinweis', placeholder: 'kann leer bleiben', max: 80 },
        { k: 'c', label: 'Warengruppe', type: 'select', value: catId || 0, options: catOptions() },
        cats.length && { k: 'keep', type: 'checkbox', label: 'Auch im Katalog speichern', value: true },
    ], 'Auf die Liste', async v => {
        const n = v.n.trim().replace(/\s+/g, ' ');
        if (!n) throw new Error('Bitte einen Namen eingeben.');
        const c = +v.c;
        if (!itemByName(n)) op({ t: 'add', uid: newUid(), n, c, note: v.note.trim() });
        qInput.value = '';
        render();
        if (v.keep && c) act('prod_add', { name: n, cat: c, quiet: true }).catch(() => {});   // ohne Netz bleibt es beim Eintrag auf der Liste
    });
}

let lpTimer = 0, lpFired = false, lpXY = null;
function detail(t) {
    const d = t.dataset;
    if (d.k === 'item') { const it = L.items.find(i => i.uid === d.uid); if (it) itemDialog(it); }
    else if (d.k === 'prod') prodDialog(d.n, +d.c, d.src);
}
main.addEventListener('pointerdown', e => {
    lpFired = false;
    clearTimeout(lpTimer);
    const t = e.target.closest('.tile');
    if (!t || e.button > 0) return;
    lpXY = [e.clientX, e.clientY];
    lpTimer = setTimeout(() => { lpFired = true; if (navigator.vibrate) navigator.vibrate(15); detail(t); }, 500);
});
main.addEventListener('pointermove', e => {
    if (lpXY && Math.hypot(e.clientX - lpXY[0], e.clientY - lpXY[1]) > 10) clearTimeout(lpTimer);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) main.addEventListener(ev, () => clearTimeout(lpTimer));
main.addEventListener('contextmenu', e => {
    const t = e.target.closest('.tile');
    if (!t) return;
    e.preventDefault();
    clearTimeout(lpTimer);
    if (!lpFired) { lpFired = true; detail(t); }
});
main.addEventListener('click', e => {
    if (lpFired) { lpFired = false; return; }
    const t = e.target.closest('[data-k]');
    if (!t || !L) return;
    const d = t.dataset;
    if (d.k === 'item') tapItem(d.uid);
    else if (d.k === 'prod') tapProd(d.n, +d.c);
    else if (d.k === 'new') newProduct(d.n, 0);
    else if (d.k === 'newin') newProduct('', +d.id);
    else if (d.k === 'cat') {
        const open = LS.get('open', {});
        if (open[d.id]) delete open[d.id]; else open[d.id] = 1;
        LS.set('open', open);
        render();
    }
});
qInput.addEventListener('input', render);
qInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const first = $('.tile', main);   // Enter nimmt den ersten Treffer
    if (qInput.value.trim() && first) first.click();
});

/* ---------- Listen ---------- */
function newList() {
    ask('Neue Liste', [{ k: 'name', label: 'Name', placeholder: 'z. B. Drogerie, Baumarkt, Urlaub', max: 40 }], 'Anlegen', async v => {
        const s = await api('list_create', { name: v.name });
        applyState(s);
        openList(s.created);
        while (sheets.length > 1) sheets[0].close();
    });
}

function showLists() {
    const sh = sheet('Listen', { onclose: () => stateListeners.delete(draw) });
    function draw() {
        fill(sh.body, 
            S.lists.map(l => {
                const others = l.members.filter(id => id !== S.me.id).map(userName).filter(Boolean);
                const sub = (l.count ? l.count + ' offen' : 'leer') + (others.length ? ' · mit ' + others.join(', ') : ' · nur du');
                return h('div', { class: 'row' + (l.id === cur ? ' cur' : ''), role: 'button', tabindex: '0', onclick: e => { if (e.target.closest('.mini')) return; openList(l.id); sh.close(); } },
                    h('span', { class: 'grow' }, l.n, h('small', null, sub)),
                    h('button', { class: 'mini', type: 'button', 'aria-label': 'Liste bearbeiten', onclick: () => listMenu(l) }, icon(I.more)));
            }),
            h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: newList }, 'Neue Liste anlegen')));
    }
    stateListeners.add(draw);
    draw();
    loadState().catch(() => {});
}

function listMenu(l) {
    const mine = l.owner === S.me.id;
    const sh = sheet(l.n);
    const btn = (label, fn, danger) => h('button', { class: 'row' + (danger ? ' danger' : ''), type: 'button', onclick: () => { sh.close(); fn(); } }, label);
    put(sh.body, 
        !mine && h('p', { class: 'info' }, 'Diese Liste gehört ' + (userName(l.owner) || 'jemand anderem') + '.'),
        mine && btn('Teilen mit …', () => shareList(l)),
        mine && btn('Umbenennen', () => ask('Liste umbenennen', [{ k: 'name', label: 'Name', value: l.n, max: 40 }], 'Speichern', v => act('list_rename', { id: l.id, name: v.name }))),
        mine && btn('Liste löschen', () => confirmDlg('Liste löschen', '„' + l.n + '“ wird für alle Mitglieder gelöscht, samt allem, was noch draufsteht.', 'Endgültig löschen', () => act('list_delete', { id: l.id }))),
        !mine && btn('Liste verlassen', () => confirmDlg('Liste verlassen', 'Du siehst „' + l.n + '“ danach nicht mehr. Wieder rein kommst du nur, wenn dich jemand neu einlädt.', 'Verlassen', () => act('list_leave', { id: l.id }))));
}

function shareList(l) {
    const others = S.users.filter(u => u.id !== S.me.id);
    if (!others.length) {
        return ask('Teilen', [{ type: 'info', text: 'Es gibt noch keine weiteren Konten.' + (S.me.admin ? ' Leg unter Menü → Konten welche an.' : ' Neue Konten legt der Administrator an.') }], null, null);
    }
    ask('„' + l.n + '“ teilen mit', others.map(u => ({ k: 'u' + u.id, type: 'checkbox', label: u.n, value: l.members.includes(u.id) })), 'Speichern',
        v => act('list_share', { id: l.id, users: others.filter(u => v['u' + u.id]).map(u => u.id) }));
}

/* ---------- Reihenfolge der Warengruppen ---------- */
function showOrder() {
    if (!L) return;
    const sh = sheet('Reihenfolge im Laden');
    const box = h('div');
    const row = id => h('div', { class: 'row', data: { id } },
        h('span', { class: 'mini grip', 'aria-hidden': 'true' }, icon(I.grip)),
        h('span', { class: 'grow' }, catName(id)),
        h('button', { class: 'mini', type: 'button', 'aria-label': 'nach oben', onclick: e => { const r = e.currentTarget.parentNode; if (r.previousSibling) box.insertBefore(r, r.previousSibling); } }, icon(I.up)),
        h('button', { class: 'mini', type: 'button', 'aria-label': 'nach unten', onclick: e => { const r = e.currentTarget.parentNode; if (r.nextSibling) box.insertBefore(r.nextSibling, r); } }, icon(I.down)));
    box.append(...catOrder().filter(Boolean).map(row));
    box.addEventListener('pointerdown', e => {
        const grip = e.target.closest('.grip');
        if (!grip) return;
        e.preventDefault();
        const r = grip.parentNode;
        r.classList.add('drag');
        let y = e.clientY;
        const place = () => {
            for (const o of box.children) {
                if (o === r) continue;
                const b = o.getBoundingClientRect();
                if (y >= b.top && y <= b.bottom) { box.insertBefore(r, y < b.top + b.height / 2 ? o : o.nextSibling); break; }
            }
        };
        const move = ev => { y = ev.clientY; place(); };
        // Am oberen und unteren Rand rollt die Liste von selbst weiter
        const scroller = setInterval(() => {
            const b = sh.body.getBoundingClientRect();
            const d = y < b.top + 50 ? -10 : y > b.bottom - 50 ? 10 : 0;
            if (d) { sh.body.scrollTop += d; place(); }
        }, 16);
        const up = () => {
            clearInterval(scroller);
            r.classList.remove('drag');
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            document.removeEventListener('pointercancel', up);
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up);
        document.addEventListener('pointercancel', up);
    });
    const save = async order => {
        try { setList(await api('list_order', { id: cur, order })); sh.close(); }
        catch (e) { toast(e.message); }
    };
    put(sh.body, 
        h('p', { class: 'info' }, 'Zieh die Warengruppen in die Reihenfolge, in der du durch deinen Laden läufst. Das gilt nur für die Liste „' + curList().n + '“.'),
        box,
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => save([]) }, 'Standard'),
            h('button', { class: 'btn primary', type: 'button', onclick: () => save([...box.children].map(r => +r.dataset.id)) }, 'Speichern')));
}

/* ---------- Vorlagen ---------- */
function showTemplates() {
    const sh = sheet('Vorlagen', { onclose: () => stateListeners.delete(draw) });
    function draw() {
        fill(sh.body, 
            h('p', { class: 'info' }, 'Antippen setzt alle Produkte der Vorlage auf die Liste' + (curList() ? ' „' + curList().n + '“.' : '.')),
            S.templates.map(t => h('div', { class: 'row', role: 'button', tabindex: '0', onclick: e => { if (e.target.closest('.mini')) return; applyTemplate(t); sh.close(); } },
                h('span', { class: 'grow' }, t.n, h('small', null, t.items.map(i => i.n).join(', '))),
                h('button', { class: 'mini', type: 'button', 'aria-label': 'Vorlage bearbeiten', onclick: () => editTemplate(t) }, icon(I.edit)))),
            h('div', { class: 'btns' },
                L && L.items.length > 0 && h('button', { class: 'btn', type: 'button', onclick: () => editTemplate(null, L.items) }, 'Aktuelle Liste als Vorlage'),
                h('button', { class: 'btn primary', type: 'button', onclick: () => editTemplate(null) }, 'Neue Vorlage')));
    }
    stateListeners.add(draw);
    draw();
}
function applyTemplate(t) {
    if (!L) return;
    const ops = t.items.filter(i => !itemByName(i.n)).map(i => ({ t: 'add', uid: newUid(), n: i.n, c: hasCat(i.c) ? i.c : 0, note: i.note || '' }));
    op(ops);
    toast(ops.length ? ops.length + (ops.length === 1 ? ' Produkt' : ' Produkte') + ' aus „' + t.n + '“ hinzugefügt' : 'Alles aus „' + t.n + '“ steht schon auf der Liste');
}
function editTemplate(t, preset) {
    const items = t ? t.items : (preset || []);
    ask(t ? 'Vorlage bearbeiten' : 'Neue Vorlage', [
        { k: 'name', label: 'Name', value: t ? t.n : '', placeholder: 'z. B. Wocheneinkauf', max: 40 },
        { k: 'items', label: 'Produkte, eines pro Zeile. Menge nach einem Semikolon.', type: 'textarea', placeholder: 'Milch; 2 Liter\nBrot\nÄpfel', value: items.map(i => i.n + (i.note ? '; ' + i.note : '')).join('\n') },
    ], 'Speichern', v => {
        const list = v.items.split('\n').map(line => {
            const [n, ...rest] = line.split(';');
            const name = n.trim();
            const known = S.catalog.products.find(p => low(p.n) === low(name)) || items.find(i => low(i.n) === low(name));
            return { n: name, note: rest.join(';').trim(), c: known ? known.c : 0 };
        }).filter(i => i.n);
        return act('tpl_save', { id: t ? t.id : 0, name: v.name, items: list });
    }, [t && { label: 'Löschen', danger: true, fn: () => act('tpl_delete', { id: t.id }) }]);
}

/* ---------- Katalog verwalten ---------- */
function showCatalog() {
    const sh = sheet('Katalog verwalten', { wide: true, onclose: () => stateListeners.delete(draw) });
    function draw() {
        const byCat = new Map();
        for (const p of S.catalog.products) (byCat.get(p.c) || byCat.set(p.c, []).get(p.c)).push(p);
        fill(sh.body, 
            h('p', { class: 'info' }, S.catalog.products.length + ' Produkte in ' + S.catalog.cats.length + ' Warengruppen. Der Katalog gilt für alle Listen und alle Konten. Tippe ein Produkt an, um es zu ändern oder zu löschen.'),
            h('div', { class: 'btns' },
                h('button', { class: 'btn small', type: 'button', onclick: () => ask('Neue Warengruppe', [{ k: 'name', label: 'Name', max: 60 }], 'Anlegen', v => act('cat_add', { name: v.name })) }, '+ Warengruppe'),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: showBackups }, 'Sicherungen'),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: () => confirmDlg('Standard wiederherstellen',
                    'Der ganze Katalog wird durch den mitgelieferten Standard ersetzt. Eigene Produkte und Warengruppen gehen dabei verloren. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.',
                    'Standard wiederherstellen', () => act('catalog_reset', {})) }, 'Standard wiederherstellen'),
                S.me.admin && h('button', { class: 'btn small danger', type: 'button', onclick: () => confirmDlg('Alles löschen',
                    'Alle Produkte und Warengruppen werden gelöscht, der Katalog ist danach leer. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.',
                    'Alles löschen', () => act('catalog_clear', {})) }, 'Alles löschen')),
            S.catalog.cats.map(c => [
                h('div', { class: 'mcat' }, h('h4', null, c.n, h('span', { class: 'badge' }, String((byCat.get(c.id) || []).length))),
                    h('button', { class: 'btn small', type: 'button', onclick: () => editCat(c, (byCat.get(c.id) || []).length) }, 'Ändern')),
                h('div', { class: 'chips' },
                    (byCat.get(c.id) || []).map(p => h('button', { class: 'chip', type: 'button', onclick: () => editProd(p) }, p.n)),
                    h('button', { class: 'chip add', type: 'button', onclick: () => addProd(c) }, '+ Produkt')),
            ]));
    }
    stateListeners.add(draw);
    draw();
}
const realCats = () => S.catalog.cats.map(c => [c.id, c.n]);
function addProd(c) {
    ask('Neues Produkt', [{ k: 'name', label: 'Name', max: 60 }, { k: 'cat', label: 'Warengruppe', type: 'select', value: c.id, options: realCats() }],
        'Anlegen', v => act('prod_add', { name: v.name, cat: +v.cat }));
}
function editProd(p) {
    ask('Produkt ändern', [{ k: 'name', label: 'Name', value: p.n, max: 60 }, { k: 'cat', label: 'Warengruppe', type: 'select', value: p.c, options: realCats() }],
        'Speichern', v => act('prod_edit', { id: p.id, name: v.name, cat: +v.cat }),
        [{ label: 'Löschen', danger: true, fn: () => act('prod_delete', { id: p.id }) }]);
}
function editCat(c, count) {
    ask('Warengruppe ändern', [{ k: 'name', label: 'Name', value: c.n, max: 60 }], 'Speichern', v => act('cat_rename', { id: c.id, name: v.name }),
        [{ label: 'Löschen', danger: true, fn: () => {
            confirmDlg('Warengruppe löschen', '„' + c.n + '“ wird gelöscht' + (count ? ', samt ' + count + (count === 1 ? ' Produkt' : ' Produkten') : '') + '. Vorher wird eine Sicherung angelegt.',
                'Löschen', () => act('cat_delete', { id: c.id }));
        } }]);
}
async function showBackups() {
    let list;
    try { list = (await api('catalog_backups')).backups; } catch (e) { return toast(e.message); }
    const sh = sheet('Sicherungen des Katalogs');
    put(sh.body, 
        h('p', { class: 'info' }, list.length ? 'Vor jeder großen Änderung wird der Katalog gesichert, die letzten 10 Stände bleiben erhalten. Antippen holt einen Stand zurück.' : 'Noch keine Sicherungen. Sie entstehen automatisch vor jeder großen Änderung.'),
        list.map(b => h('button', { class: 'row', type: 'button', onclick: () => confirmDlg('Sicherung zurückholen',
            'Der Katalog wird durch den Stand vom ' + fmtTime(b.at) + ' ersetzt (' + b.products + ' Produkte). Der jetzige Stand wird vorher gesichert.', 'Zurückholen',
            async () => { await act('catalog_restore', { id: b.id }); sh.close(); }) },
            h('span', { class: 'grow' }, fmtTime(b.at), h('small', null, b.reason + ' · ' + b.products + ' Produkte in ' + b.cats + ' Warengruppen')))));
}

/* ---------- Konten (nur Administrator) ---------- */
function showUsers() {
    const sh = sheet('Konten', { onclose: () => stateListeners.delete(draw) });
    function draw() {
        const myLists = S.lists.filter(l => l.owner === S.me.id);
        fill(sh.body, 
            h('p', { class: 'info' }, 'Konten legst nur du an, eine offene Registrierung gibt es nicht. Gib Name und Passwort einfach weiter, jeder kann sein Passwort danach selbst ändern.'),
            S.users.map(u => h('div', { class: 'row' },
                h('span', { class: 'grow' }, u.n, u.admin && h('span', { class: 'badge' }, 'Administrator')),
                h('button', { class: 'btn small', type: 'button', onclick: () => ask('Neues Passwort für ' + u.n, [{ k: 'pass', label: 'Neues Passwort (mindestens 8 Zeichen)', type: 'password' }], 'Setzen',
                    async v => { await act('user_pass', { id: u.id, pass: v.pass }); toast('Passwort geändert'); }) }, 'Passwort'),
                u.id !== S.me.id && h('button', { class: 'btn small danger', type: 'button', onclick: () => confirmDlg('Konto löschen',
                    'Das Konto „' + u.n + '“ wird gelöscht. Listen, die ' + u.n + ' angelegt hat, gehen an dich über.', 'Konto löschen', () => act('user_delete', { id: u.id })) }, 'Löschen'))),
            h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => ask('Konto anlegen', [
                { k: 'name', label: 'Name', max: 30 },
                { k: 'pass', label: 'Passwort (mindestens 8 Zeichen)', type: 'text' },
                ...myLists.map(l => ({ k: 'l' + l.id, type: 'checkbox', label: 'In die Liste „' + l.n + '“ einladen', value: l.id === S.startList })),
            ], 'Anlegen', v => act('user_add', { name: v.name, pass: v.pass, lists: myLists.filter(l => v['l' + l.id]).map(l => l.id) })) }, 'Konto anlegen')));
    }
    stateListeners.add(draw);
    draw();
}

/* ---------- Einstellungen ---------- */
function applyTheme() {
    const t = LS.get('theme', 'auto');
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
}
let wakeLock = null;
async function wake() {
    const want = LS.get('wake', true) && !document.hidden && 'wakeLock' in navigator;
    try {
        if (want && !wakeLock) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { wakeLock = null; });
        } else if (!want && wakeLock) {
            await wakeLock.release();
            wakeLock = null;
        }
    } catch (e) {}
}

/** Zwei Ansichten: kleine Kacheln oder kompakte Schildchen. Gemerkt pro Gerät. */
function applyView() {
    const compact = LS.get('view', 'tiles') === 'compact';
    main.classList.toggle('compact', compact);
    const btn = $('#viewBtn');
    fill(btn, icon(compact ? I.tiles : I.compact));   // der Knopf zeigt, wohin er umschaltet
    btn.title = compact ? 'Zur Kachel-Ansicht' : 'Zur kompakten Ansicht';
}

function showSettings() {
    const sh = sheet('Einstellungen');
    const theme = h('select', { onchange: () => { LS.set('theme', theme.value); applyTheme(); } },
        [['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, t]) => h('option', { value: v, selected: LS.get('theme', 'auto') === v }, t)));
    const wakeBox = h('input', { type: 'checkbox', checked: LS.get('wake', true), onchange: () => { LS.set('wake', wakeBox.checked); wake(); } });
    const ivInput = h('input', { type: 'number', min: '1', max: '60', inputmode: 'numeric', value: String(S.interval) });
    const view = h('select', { onchange: () => { LS.set('view', view.value); applyView(); } },
        [['tiles', 'Kleine Kacheln'], ['compact', 'Kompakt']].map(([v, t]) => h('option', { value: v, selected: LS.get('view', 'tiles') === v }, t)));
    put(sh.body,
        h('label', { class: 'field' }, 'Ansicht (nur dieses Gerät)', view),
        h('label', { class: 'field' }, 'Design (nur dieses Gerät)', theme),
        h('label', { class: 'check' }, wakeBox, h('span', null, 'Bildschirm anlassen, solange Kaufen offen ist')),
        h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => ask('Passwort ändern', [
            { k: 'old', label: 'Bisheriges Passwort', type: 'password', auto: 'current-password' },
            { k: 'pass', label: 'Neues Passwort (mindestens 8 Zeichen)', type: 'password' },
            { k: 'pass2', label: 'Neues Passwort wiederholen', type: 'password' },
        ], 'Ändern', async v => {
            if (v.pass !== v.pass2) throw new Error('Die beiden neuen Passwörter stimmen nicht überein.');
            await api('me_pass', { old: v.old, pass: v.pass });
            toast('Passwort geändert, andere Geräte wurden abgemeldet');
        }) }, 'Passwort ändern')),
        S.me.admin && h('h2', null, 'Für alle'),
        S.me.admin && h('label', { class: 'field' }, 'Abgleich alle … Sekunden (1 bis 60)', ivInput),
        S.me.admin && h('p', { class: 'info' }, 'So oft fragt jedes Gerät nach, ob sich an der Liste etwas geändert hat. Kleiner heißt schneller, größer schont Server und Akku.'),
        S.me.admin && h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            try { await act('settings_save', { interval: +ivInput.value }); ivInput.value = String(S.interval); toast('Gespeichert: alle ' + S.interval + ' Sekunden'); }
            catch (e) { toast(e.message); }
        } }, 'Speichern')),
        h('p', { class: 'info' }, 'Angemeldet als ' + S.me.n + ' · Kaufen ' + S.version));
}

async function logout() {
    const go = async () => {
        try { await api('logout', {}); } catch (e) { if (e.net) throw new Error('Abmelden geht nur mit Verbindung zum Server.'); }
        LS.clear();
        location.reload();
    };
    if (queue.length) confirmDlg('Abmelden', queue.length + ' Änderungen sind noch nicht beim Server angekommen und gehen beim Abmelden verloren.', 'Trotzdem abmelden', go);
    else go().catch(e => toast(e.message));
}

function showMenu() {
    const sh = sheet('Menü');
    const btn = (label, fn) => h('button', { class: 'row', type: 'button', onclick: () => { sh.close(); fn(); } }, label);
    put(sh.body, 
        btn('Listen', showLists),
        L && btn('Vorlagen', showTemplates),
        L && btn('Reihenfolge im Laden', showOrder),
        btn('Katalog verwalten', showCatalog),
        S.me.admin && btn('Konten', showUsers),
        btn('Einstellungen', showSettings),
        btn('Abmelden', logout));
}

/* ---------- Start ---------- */
$('#menuBtn').addEventListener('click', () => { if (S) showMenu(); });
$('#viewBtn').addEventListener('click', () => { LS.set('view', LS.get('view', 'tiles') === 'compact' ? 'tiles' : 'compact'); applyView(); });
$('#listBtn').addEventListener('click', () => { if (S) showLists(); });
document.addEventListener('visibilitychange', () => { wake(); if (!document.hidden) tick(); });
window.addEventListener('online', tick);
window.addEventListener('offline', () => setOnline(false));

applyTheme();
applyView();
render();
tick();
wake();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('./?action=sw', { scope: './' }).then(() => navigator.serviceWorker.ready).then(reg => {
        const urls = ['./', ...[...document.querySelectorAll('link[rel=stylesheet], script[src]')].map(e => e.getAttribute('href') || e.getAttribute('src'))];
        if (reg.active) reg.active.postMessage({ precache: urls });
    }).catch(() => {});
}
})();
