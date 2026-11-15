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
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith('kf_') && !['kf_theme', 'kf_view', 'kf_palL', 'kf_palD', 'kf_look', 'kf_paint'].includes(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} },
};

const low = s => String(s).toLocaleLowerCase('de');
/** Für die Suche: klein, ohne Akzente, ä = a, ß = ss */
const norm = s => low(s).replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '');

/* ---------- Sprache: Deutsch oder Englisch. Der deutsche Text ist der Schlüssel, die Übersetzungen stehen in i18n.js. ---------- */
const EN = self.KF_EN || { ui: {}, cats: {}, prods: {}, tpls: {} };
let lang = 'de';
/** Text in der Sprache des Kontos, {0} und {1} sind Platzhalter */
function tr(s, ...a) {
    const x = lang === 'en' && EN.ui[s] || s;
    return a.length ? x.replace(/\{(\d)\}/g, (m, i) => a[i] == null ? '' : String(a[i])) : x;
}
const lowMap = (o, rev) => new Map(Object.entries(o).map(([k, v]) => rev ? [low(v), k] : [low(k), v]));
const EN_P = lowMap(EN.prods), EN_C = lowMap(EN.cats), EN_T = lowMap(EN.tpls), DE_P = lowMap(EN.prods, true), DE_C = lowMap(EN.cats, true);
/* Der mitgelieferte Katalog liegt deutsch in der Datenbank und wird nur für die Anzeige übersetzt: dn = Produkt, dc = Warengruppe, dt = Vorlage.
   canon geht den Weg zurück, damit „Milk“ und „Milch“ dasselbe Produkt bleiben. Selbst Angelegtes bleibt, wie es getippt wurde. */
const enName = n => EN_P.get(low(n)) || '';
const dn = n => lang === 'en' && EN_P.get(low(n)) || n;
const dc = n => lang === 'en' && EN_C.get(low(n)) || n;
const dt = n => lang === 'en' && EN_T.get(low(n)) || n;
const canon = n => lang === 'en' && DE_P.get(low(n)) || n;
const canonC = n => lang === 'en' && DE_C.get(low(n)) || n;

function newUid() {
    const a = new Uint8Array(12);
    crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}
function fmtTime(ts) {
    const d = new Date(ts * 1000), now = new Date(), loc = lang === 'en' ? 'en-US' : 'de-DE';
    const hm = d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === now.toDateString()) return tr('heute {0}', hm);
    return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }) + ' ' + hm;
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
const catName = id => { const c = S && S.catalog.cats.find(c => c.id === id); return c ? dc(c.n) : tr('Sonstiges'); };
const hasCat = id => !!(S && S.catalog.cats.some(c => c.id === id));
const itemByName = n => L ? L.items.find(i => low(i.n) === low(n)) : null;
/** Die Menge, die beim letzten Abhaken an diesem Produkt stand (pro Liste). Leer, wenn das Konto das Merken abgeschaltet hat. */
const memMaps = new WeakMap();
function memOf(n, always) {
    if (!L || !L.mem || !(look.keep || always)) return '';
    let m = memMaps.get(L.mem);
    if (!m) memMaps.set(L.mem, m = new Map(L.mem.map(x => [low(x[0]), x[1]])));
    return m.get(low(n)) || '';
}
const setMem = (n, note) => { L.mem = [...(L.mem || []).filter(x => low(x[0]) !== low(n)), ...(note ? [[n, note]] : [])]; };

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
    el.textContent = !online ? (n ? tr('Offline · {0} offen', n) : tr('Offline')) : (n ? tr('Sende …') : '');
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
        throw Object.assign(new Error(tr('Keine Verbindung zum Server.')), { net: true });
    }
    setOnline(true);
    rest();
    if (r.status === 401) { location.reload(); throw Object.assign(new Error(tr('Abgemeldet.')), { net: true }); }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!r.ok || !j) throw Object.assign(new Error(j && j.error || tr('Der Server antwortet nicht richtig ({0}).', r.status)), { net: r.status >= 500, status: r.status });
    return j;
}

/** Neuen Stand vom Server übernehmen (kommt als Antwort auf fast jede Aktion). oldLook: die Antwort war schon unterwegs, als hier
    Aussehen oder Sprache geändert wurden. Dann gilt, was das Gerät hat, der nächste Abgleich bringt beides wieder zusammen. */
function applyState(s, oldLook) {
    if (S && S.me && S.me.id !== s.me.id) { queue = []; saveQueue(); L = null; cur = null; }   // anderes Konto auf diesem Gerät
    S = s;
    csrf = s.csrf;
    iv = s.interval;
    if (s.me.look && !oldLook && !LS.get('lookDirty', false)) { look = normLook(s.me.look); LS.set('look', look); applyTheme(); applyLang(); }   // das Aussehen gehört zum Konto
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
    const e = lookEpoch;
    applyState(await api('state'), e !== lookEpoch);
    flush();
    if (!pushSynced) { pushSynced = true; pushRefresh(); }
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
            setMem(it.n, it.note);
        }
    } else if (o.t === 'edit') {
        const it = L.items.find(i => i.uid === o.uid);
        if (it) { it.note = o.note || ''; it.c = o.c || 0; }
    } else if (o.t === 'forget') {
        L.usage = L.usage.filter(u => low(u.n) !== low(o.n));
        setMem(o.n, '');
    } else if (o.t === 'unmem') {
        setMem(o.n, '');
    }
}

function op(...ops) {
    if (!L || !cur) return;
    for (const o of ops.flat()) {
        applyLocal(o);
        queue.push({ l: cur, o });
        if (o.t === 'add') pushDirty = true;   // beim Verlassen erfahren es die anderen, siehe pushDone
    }
    saveQueue();
    LS.set('list_' + cur, L);
    const l = curList();
    if (l) l.count = L.items.length;
    render();
    rest();
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

/**
 * Die Wartezeit bis zum nächsten Abgleich neu starten. Passiert bei jeder eigenen Aktion und nach jeder Antwort des Servers,
 * nachgefragt wird also nur, wenn so lange nichts los war. Ist Kaufen nicht zu sehen, läuft gar keine Uhr.
 */
function rest() {
    clearTimeout(timer);
    if (!document.hidden) timer = setTimeout(tick, Math.max(1, iv) * 1000);
}

/** Der regelmäßige Abgleich. Fragt nur drei Zähler ab und lädt erst nach, wenn sich einer geändert hat. */
async function tick() {
    clearTimeout(timer);
    if (document.hidden) return;
    try {
        if (!csrf) await loadState();
        else {
            if (queue.length) flush();
            if (LS.get('lookDirty', false)) saveLook();
            const r = await api('poll&id=' + (cur || 0));
            if (r.iv) iv = r.iv;
            if (r.cv !== S.cv || r.lv !== S.lv || (cur && r.v === null)) await loadState();
            if (cur && r.v !== null && (!L || r.v !== L.v) && !flushing) await loadList();
        }
    } catch (e) {}
    rest();
}

/* ---------- Mitteilungen aufs Handy (Web Push). Ob ein Gerät welche will, entscheidet jedes Konto pro Gerät in den Einstellungen. ---------- */
let pushDirty = false, pushSynced = false;
/** Kann der Server verschicken (S.push = sein öffentlicher Schlüssel) und dieses Gerät empfangen? Das iPhone nur als installierte App. */
const pushCan = () => !!(S && S.push) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const b64uBytes = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const bytesB64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
/** Die Anmeldung dieses Geräts beim Mitteilungsdienst, oder null */
async function pushSub() {
    try {
        const reg = await navigator.serviceWorker.getRegistration();
        return reg ? await reg.pushManager.getSubscription() : null;
    } catch (e) { return null; }
}
async function pushOn() {
    if (await Notification.requestPermission() !== 'granted') throw new Error(tr('Mitteilungen sind für Kaufen gesperrt. Bitte in den Einstellungen des Geräts erlauben.'));
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription() || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(S.push) });
    const r = await api('push_sub', { ...sub.toJSON(), test: true });   // der Server schickt gleich eine Probe
    toast(r.sent >= 200 && r.sent < 300 ? tr('Mitteilungen eingeschaltet, eine Probe ist unterwegs')
        : tr('Eingeschaltet, aber der Server erreicht den Mitteilungsdienst nicht (Antwort {0}). Vermutlich sperrt der Webspace ausgehende Verbindungen.', r.sent || 0));
}
async function pushOff() {
    const sub = await pushSub();
    if (!sub) return;
    const endpoint = sub.endpoint;
    try { await sub.unsubscribe(); } catch (e) {}
    try { await api('push_unsub', { endpoint }); } catch (e) {}
}
/** Beim Start und nach einem Sprachwechsel: der Server erfährt, welches Konto und welche Sprache zu diesem Gerät gehören */
async function pushRefresh() {
    if (!pushCan() || !csrf) return;
    let sub = await pushSub();
    if (!sub) return;
    try {
        // Hat der Server inzwischen einen anderen Schlüssel (neu aufgesetzt), gilt die alte Anmeldung nicht mehr: neu anmelden
        const key = sub.options && sub.options.applicationServerKey;
        if (key && bytesB64u(key) !== S.push) {
            await sub.unsubscribe();
            sub = await (await navigator.serviceWorker.ready).pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(S.push) });
        }
        await api('push_sub', sub.toJSON());
    } catch (e) {}
}
/**
 * Kaufen verschwindet vom Bildschirm: dem Server sagen, dass dieses Gerät fertig ist. Er schickt dann eine einzige Mitteilung
 * mit allem, was hier auf Listen gesetzt wurde, an die anderen Mitglieder. Kommt das nicht an (kein Netz), holt der Server es
 * ein paar Minuten später von selbst nach.
 */
async function pushDone() {
    if (!pushDirty || !S || !S.push || !csrf) return;
    pushDirty = false;
    for (let i = 0; i < 40 && online && (flushing || queue.length); i++) {   // erst müssen die Änderungen selbst beim Server sein
        if (!flushing) flush();
        await new Promise(r => setTimeout(r, 50));
    }
    if (queue.length) { pushDirty = true; return; }
    try {
        fetch('?action=push_done', { method: 'POST', credentials: 'same-origin', cache: 'no-store', keepalive: true,
            headers: { 'Content-Type': 'application/json', 'X-CSRF': csrf }, body: '{}' }).catch(() => {});
    } catch (e) {}
}
if ('serviceWorker' in navigator) {
    // Mitteilung angetippt: der Service Worker holt Kaufen nach vorn und nennt die Liste
    navigator.serviceWorker.addEventListener('message', e => {
        const id = e.data && e.data.kfList;
        if (id && S && id !== cur && S.lists.some(l => l.id === id)) openList(id);
        else if (id) loadList();
    });
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
        h('header', null, titleEl, h('button', { class: 'iconbtn', type: 'button', 'aria-label': tr('Schließen'), onclick: () => api_.close() }, icon(I.x))), body);
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
        if (f.type === 'qty') {
            const q = qtyField(f.value);
            inputs[f.k] = q;
            return q.node;
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
/* ---------- Menge: Zähler, Einheit zum Antippen, freier Hinweis. Gespeichert wird schlichter Text wie „2 Liter, die grünen“,
   immer in deutscher Schreibweise. Für die Anzeige auf Englisch wird er übersetzt (dnote), Eingaben auf Englisch gehen den Weg zurück (canonNote). ---------- */
// Einheit: deutsch Einzahl und Mehrzahl, Schrittweite, englisch Einzahl und Mehrzahl
const UNITS = [['Stück', 'Stück', 1, 'piece', 'pieces'], ['Packung', 'Packungen', 1, 'pack', 'packs'], ['Flasche', 'Flaschen', 1, 'bottle', 'bottles'],
    ['Dose', 'Dosen', 1, 'can', 'cans'], ['Glas', 'Gläser', 1, 'jar', 'jars'], ['Bund', 'Bund', 1, 'bunch', 'bunches'],
    ['Liter', 'Liter', .5, 'liter', 'liters'], ['ml', 'ml', 50, 'ml', 'ml'], ['kg', 'kg', .5, 'kg', 'kg'], ['g', 'g', 50, 'g', 'g']];
const unitName = (i, n, lg) => UNITS[i][(lg === 'en' ? 3 : 0) + (n > 1 ? 1 : 0)];
const unitIndex = w => UNITS.findIndex(x => [x[0], x[1], x[3], x[4]].some(s => low(s) === low(w)));
const fmtNum = (n, lg = lang) => String(Math.round(n * 100) / 100).replace('.', lg === 'en' ? '.' : ',');
/** Zerlegt einen Hinweis in Zahl, Einheit (u = mitgelieferte, cu = eigene des Kontos) und Rest. Passt er nicht ins Muster, bleibt er als Ganzes der freie Hinweis. */
function parseQty(note) {
    const raw = String(note || '').trim();
    const m = /^(\d{1,4}(?:[.,]\d{1,2})?)\s*([^\d\s,]*)\s*(?:,\s*(.*))?$/.exec(raw);
    if (m) {
        const u = m[2] ? unitIndex(m[2]) : -1;
        const cu = m[2] && u < 0 ? look.units.find(s => low(s) === low(m[2])) || '' : '';
        const n = parseFloat(m[1].replace(',', '.'));
        if (n > 0 && (!m[2] || u >= 0 || cu)) return { n, u, cu, hint: m[3] || '' };
    }
    return { n: 0, u: -1, cu: '', hint: raw };
}
const fmtQty = (st, lg, hint) => [st.n ? fmtNum(st.n, lg) + (st.u >= 0 ? ' ' + unitName(st.u, st.n, lg) : st.cu ? ' ' + st.cu : '') : '', hint].filter(Boolean).join(', ');
/** Menge für die Anzeige. Auf Deutsch bleibt der gespeicherte Text, wie er ist. */
function dnote(note) {
    if (lang === 'de' || !note) return note;
    const p = parseQty(note);
    return p.n ? fmtQty(p, 'en', p.hint) : note;
}
/** Getippte Menge (Vorlagen) in die gespeicherte Schreibweise bringen */
function canonNote(s) {
    if (lang === 'de' || !s) return s;
    const p = parseQty(s);
    return p.n ? fmtQty(p, 'de', p.hint) : s;
}
/** Eigene Einheit fürs Konto anlegen, z. B. Kasten. done bekommt den Namen. */
function addUnit(done) {
    ask(tr('Eigene Einheit'), [{ k: 'u', label: tr('Name'), placeholder: tr('z. B. Kasten, Beutel, Rolle'), max: 12 }], tr('Hinzufügen'), v => {
        const u = v.u.trim();
        if (!/^[^\d\s,;]{1,12}$/.test(u)) throw new Error(tr('Bitte ein einzelnes Wort ohne Ziffern eingeben, höchstens 12 Zeichen.'));
        if (unitIndex(u) >= 0 || look.units.some(s => low(s) === low(u))) throw new Error(tr('Diese Einheit gibt es schon.'));
        if (look.units.length >= 12) throw new Error(tr('Mehr als 12 eigene Einheiten gehen nicht.'));
        setLook({ units: [...look.units, u] });
        done(u);
    });
}
function qtyField(value) {
    const st = parseQty(value);
    let auto = !st.n;   // noch keine Zahl gewählt: dann steht die 1 da, ohne Einheit
    if (auto) st.n = 1;
    const step = () => st.u >= 0 ? UNITS[st.u][2] : 1;
    const num = h('input', { type: 'text', inputmode: 'decimal', maxlength: 7, placeholder: '–', 'aria-label': tr('Menge'), autocomplete: 'off', enterkeyhint: 'done',
        oninput: () => { const n = parseFloat(num.value.replace(',', '.')); st.n = n > 0 ? Math.min(n, 9999) : 0; auto = false; show(false); },
        onfocus: () => num.select() });
    const hint = h('input', { type: 'text', value: st.hint, placeholder: tr('z. B. die grünen, vom Bäcker'), maxlength: 60, autocomplete: 'off', enterkeyhint: 'done' });
    // Einheit an- oder abwählen. Steht noch die 1 vom Anfang da, springt die Zahl auf einen sinnvollen Startwert (50 g statt 1 g).
    const pick = (u, cu) => {
        const same = cu ? st.cu === cu : st.u === u;
        st.u = same || cu ? -1 : u;
        st.cu = same || !cu ? '' : cu;
        if (auto || (!st.n && !same)) st.n = Math.max(1, step());
        show(true);
    };
    const chipBox = h('div', { class: 'chips' });
    let chips = [];
    const drawChips = () => {
        chips = [...UNITS.map((u, i) => h('button', { class: 'chip', type: 'button', onclick: () => pick(i, '') })),
            ...look.units.map(cu => h('button', { class: 'chip', type: 'button', onclick: () => pick(-1, cu) }, cu))];
        fill(chipBox, chips, h('button', { class: 'chip add', type: 'button', onclick: () => addUnit(cu => { drawChips(); if (st.cu !== cu) pick(-1, cu); }) }, tr('+ Einheit')));
        show(true);
    };
    const minus = h('button', { class: 'qbtn', type: 'button', 'aria-label': tr('Weniger') }, '−');
    const plus = h('button', { class: 'qbtn', type: 'button', 'aria-label': tr('Mehr') }, '+');
    function show(writeNum) {
        if (writeNum) num.value = st.n ? fmtNum(st.n) : '';
        minus.disabled = !st.n;
        chips.forEach((c, i) => {
            const sel = i < UNITS.length ? i === st.u : look.units[i - UNITS.length] === st.cu;
            c.classList.toggle('sel', sel);
            c.setAttribute('aria-pressed', String(sel));
            if (i < UNITS.length) c.textContent = unitName(i, sel ? st.n : 1, lang);
        });
    }
    const bump = d => {
        const s = step();
        st.n = Math.max(0, Math.min(9999, Math.round((d > 0 ? Math.floor(st.n / s + 1e-9) + 1 : Math.ceil(st.n / s - 1e-9) - 1) * s * 100) / 100));
        auto = false;
        show(true);
    };
    // Tippen zählt einen Schritt, gedrückt halten zählt weiter
    for (const [b, d] of [[minus, -1], [plus, 1]]) {
        let t1 = 0, t2 = 0, held = false;
        const stop = () => { clearTimeout(t1); clearInterval(t2); };
        b.addEventListener('pointerdown', e => { if (e.button > 0) return; stop(); held = false; t1 = setTimeout(() => { held = true; t2 = setInterval(() => { if (b.disabled) stop(); else bump(d); }, 90); }, 400); });
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, stop);
        b.addEventListener('contextmenu', e => e.preventDefault());
        b.addEventListener('click', () => { if (held) held = false; else bump(d); });
    }
    drawChips();
    return {
        type: 'qty',
        node: h('div', { class: 'qty' },
            h('div', { class: 'qlabel' }, tr('Menge')),
            h('div', { class: 'qrow' }, minus, num, plus),
            chipBox,
            h('label', { class: 'field' }, tr('Hinweis'), hint)),
        get value() {
            const bare = st.n === 1 && st.u < 0 && !st.cu;   // 1 ohne Einheit ist der Normalfall und wird nicht eigens vermerkt
            return fmtQty({ n: bare ? 0 : st.n, u: st.u, cu: st.cu }, 'de', hint.value.trim()).slice(0, 80);
        },
    };
}

const confirmDlg = (title, text, okLabel, fn) => ask(title, [{ type: 'info', text }], null, null, [{ label: okLabel, danger: true, fn }]);
/** Aktion mit neuem Stand als Antwort */
const act = async (action, body) => { const e = lookEpoch; applyState(await api(action, body), e !== lookEpoch); };

/* ---------- Hauptansicht ---------- */
function tile(cls, data, name, note, by) {
    return h('button', { class: 'tile ' + cls, type: 'button', data }, h('span', { class: 'tn' }, name), note && h('span', { class: 'tt' }, note), by && h('span', { class: 'tb' }, by));
}
const prodTile = (n, c, src) => {
    const it = itemByName(n);
    return tile(it ? 'has' : '', { k: 'prod', n, c, src: src || '' }, dn(n), dnote(it ? it.note : memOf(n)));
};

function render() {
    const l = curList();
    $('#listName').textContent = l ? l.n : 'Kaufen';
    document.title = l ? l.n + ' – Kaufen' : 'Kaufen';
    showNet();
    if (!S) { main.replaceChildren(h('p', { class: 'hint' }, online ? tr('Lade …') : tr('Keine Verbindung. Sobald wieder Netz da ist, geht es weiter.'))); return; }
    if (!l) {
        main.replaceChildren(h('p', { class: 'hint' }, tr('Du bist noch in keiner Liste. Leg eine eigene an oder lass dich in eine einladen.')),
            h('button', { class: 'btn primary', type: 'button', onclick: newList }, tr('Neue Liste anlegen')));
        return;
    }
    if (!L) { main.replaceChildren(h('p', { class: 'hint' }, tr('Lade …'))); return; }
    const q = norm(qInput.value.trim());
    main.replaceChildren(...(q ? viewSearch(q) : viewHome(l)));
}

function viewHome(l) {
    const out = [];
    const order = catOrder();
    const shared = l.members.length > 1;
    out.push(h('h2', null, tr('Noch zu kaufen'), h('small', null, L.items.length ? String(L.items.length) : '')));
    if (!L.items.length) out.push(h('p', { class: 'hint' }, tr('Alles erledigt. Tippe unten auf ein Produkt oder such oben danach, dann landet es hier.')));
    const groups = new Map(order.map(id => [id, []]));
    for (const it of L.items) groups.get(hasCat(it.c) ? it.c : 0).push(it);
    for (const [id, items] of groups) {
        if (!items.length) continue;
        out.push(h('div', { class: 'grp' }, catName(id)));
        out.push(h('div', { class: 'grid' }, items.map(it => tile('on', { k: 'item', uid: it.uid }, dn(it.n), dnote(it.note), shared && it.by !== S.me.id && userName(it.by)))));
    }

    // Zuletzt gekauft: erst die jüngsten, dann aufgefüllt mit den häufigsten
    const free = L.usage.filter(u => !itemByName(u.n));
    const recent = free.slice(0, 8);
    for (const u of [...free].sort((a, b) => b.cnt - a.cnt)) {
        if (recent.length >= 12) break;
        if (!recent.includes(u)) recent.push(u);
    }
    const open = LS.get('open', {});
    if (recent.length) {
        const isOpen = !!open.recent;
        out.push(h('button', { class: 'cat solo' + (isOpen ? ' open' : ''), type: 'button', data: { k: 'cat', id: 'recent' }, 'aria-expanded': String(isOpen) }, tr('Zuletzt gekauft'), h('small', null, String(recent.length)), icon(I.down)));
        if (isOpen) out.push(h('div', { class: 'grid' }, recent.map(u => prodTile(u.n, hasCat(u.c) ? u.c : 0, 'recent'))));
    }

    out.push(h('h2', null, tr('Katalog')));
    if (!S.catalog.cats.length) out.push(h('p', { class: 'hint' }, tr('Der Katalog ist leer. Über die Suche oben kannst du trotzdem alles auf die Liste setzen. Unter Menü → Katalog verwalten lassen sich Warengruppen anlegen oder der Standard zurückholen.')));
    const byCat = prodsByCat();
    for (const id of order) {
        if (!id) continue;
        const prods = byCat.get(id) || [];
        const isOpen = !!open[id];
        out.push(h('button', { class: 'cat' + (isOpen ? ' open' : ''), type: 'button', data: { k: 'cat', id }, 'aria-expanded': String(isOpen) }, catName(id), h('small', null, String(prods.length)), icon(I.down)));
        if (isOpen) out.push(h('div', { class: 'grid' }, prods.map(p => prodTile(p.n, p.c)),
            tile('new', { k: 'newin', id }, tr('+ Neu'))));
    }
    return out;
}
/** Produkte je Warengruppe. Vom Server kommen sie nach dem deutschen Namen sortiert, auf Englisch wird nach dem angezeigten Namen neu sortiert. */
function prodsByCat() {
    const byCat = new Map();
    for (const p of S.catalog.products) (byCat.get(p.c) || byCat.set(p.c, []).get(p.c)).push(p);
    if (lang === 'en') for (const list of byCat.values()) list.sort((a, b) => dn(a.n).localeCompare(dn(b.n), 'en'));
    return byCat;
}

function viewSearch(q) {
    const seen = new Map();
    const add = (n, c) => { if (!seen.has(low(n))) seen.set(low(n), { n, c }); };
    // Gesucht wird im angezeigten Namen. Dazu kommt der Name in der anderen Sprache (Milk findet Milch und umgekehrt),
    // dort aber nur ab drei Buchstaben und am Wortanfang, damit die Treffer nicht ausufern. Diese Treffer stehen am Ende.
    const other = n => lang === 'en' ? (enName(n) ? n : '') : enName(n);
    const rank = n => {
        const own = norm(dn(n));
        if (own.startsWith(q)) return 0;
        if (own.includes(q)) return 1;
        return q.length >= 3 && (' ' + norm(other(n)).replace(/-/g, ' ')).includes(' ' + q) ? 2 : -1;
    };
    const hit = n => rank(n) >= 0;
    for (const p of S.catalog.products) if (hit(p.n)) add(p.n, p.c);
    for (const i of L.items) if (hit(i.n)) add(i.n, i.c);
    for (const u of L.usage) if (hit(u.n)) add(u.n, u.c);
    const hits = [...seen.values()].sort((a, b) => (Math.max(rank(a.n), 1) - Math.max(rank(b.n), 1)) || (norm(dn(b.n)).startsWith(q) - norm(dn(a.n)).startsWith(q)) || dn(a.n).localeCompare(dn(b.n), lang));
    const exact = hits.some(x => norm(x.n) === q || norm(dn(x.n)) === q || norm(enName(x.n)) === q);
    const raw = qInput.value.trim().replace(/\s+/g, ' ').slice(0, 60);
    const out = [h('h2', null, tr('Treffer'), h('small', null, String(hits.length)))];
    const tiles = hits.slice(0, 60).map(x => prodTile(x.n, hasCat(x.c) ? x.c : 0));
    if (!exact) tiles.unshift(tile('new', { k: 'new', n: raw }, tr('„{0}“ hinzufügen', raw)));
    out.push(h('div', { class: 'grid' }, tiles));
    return out;
}

/* ---------- Tippen und lange drücken ---------- */
function tapItem(uid) {
    const it = L.items.find(i => i.uid === uid);
    if (!it) return;
    op({ t: 'done', uid });
    toast(tr('{0} erledigt', dn(it.n)), tr('Rückgängig'), () => op({ t: 'restore', uid: it.uid, n: it.n, c: it.c, note: it.note, by: it.by }));
}
function tapProd(n, c) {
    const it = itemByName(n);
    if (it) op({ t: 'remove', uid: it.uid });
    else op({ t: 'add', uid: newUid(), n, c, note: memOf(n) });   // steht eine Menge vom letzten Mal im Gedächtnis, kommt sie gleich mit
    if (qInput.value) { qInput.value = ''; render(); }
}
const catOptions = () => [...S.catalog.cats.map(c => [c.id, dc(c.n)]), [0, tr('Sonstiges')]];

function itemDialog(it) {
    const who = userName(it.by);
    ask(dn(it.n), [
        { k: 'note', type: 'qty', value: it.note },
        { k: 'c', label: tr('Warengruppe'), type: 'select', value: hasCat(it.c) ? it.c : 0, options: catOptions() },
        { type: 'info', text: who ? tr('Auf die Liste gesetzt von {0}, {1}.', who, fmtTime(it.at)) : tr('Auf die Liste gesetzt, {0}.', fmtTime(it.at)) },
    ], tr('Speichern'), v => op({ t: 'edit', uid: it.uid, note: v.note.trim(), c: +v.c }),
    [(it.note || memOf(it.n, true)) && { label: tr('Menge zurücksetzen'), fn: () => op({ t: 'edit', uid: it.uid, note: '', c: it.c }, { t: 'unmem', n: it.n }) },
     { label: tr('Von der Liste nehmen'), danger: true, fn: () => op({ t: 'remove', uid: it.uid }) }]);
}
function prodDialog(n, c, src) {
    const it = itemByName(n);
    if (it) return itemDialog(it);
    ask(dn(n), [{ k: 'note', type: 'qty', value: memOf(n) }],
        tr('Auf die Liste'), v => op({ t: 'add', uid: newUid(), n, c, note: v.note.trim() }),
        [src === 'recent' && { label: tr('Aus „Zuletzt gekauft“ entfernen'), fn: () => op({ t: 'forget', n }) },
         memOf(n) && { label: tr('Gemerkte Menge vergessen'), fn: () => op({ t: 'unmem', n }) }]);
}
/** Neues Produkt aus der Suche oder aus einer Warengruppe heraus */
function newProduct(name, catId) {
    const cats = S.catalog.cats;
    ask(tr('Neues Produkt'), [
        { k: 'n', label: tr('Name'), value: name, max: 60 },
        { k: 'note', type: 'qty' },
        { k: 'c', label: tr('Warengruppe'), type: 'select', value: catId || 0, options: catOptions() },
        cats.length && { k: 'keep', type: 'checkbox', label: tr('Auch im Katalog speichern'), value: true },
    ], tr('Auf die Liste'), async v => {
        const n = canon(v.n.trim().replace(/\s+/g, ' '));
        if (!n) throw new Error(tr('Bitte einen Namen eingeben.'));
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
    ask(tr('Neue Liste'), [{ k: 'name', label: tr('Name'), placeholder: tr('z. B. Drogerie, Baumarkt, Urlaub'), max: 40 }], tr('Anlegen'), async v => {
        const s = await api('list_create', { name: v.name });
        applyState(s);
        openList(s.created);
        while (sheets.length > 1) sheets[0].close();
    });
}

function showLists() {
    const sh = sheet(tr('Listen'), { onclose: () => stateListeners.delete(draw) });
    function draw() {
        fill(sh.body, 
            S.lists.map(l => {
                const others = l.members.filter(id => id !== S.me.id).map(userName).filter(Boolean);
                const sub = (l.count ? tr('{0} offen', l.count) : tr('leer')) + ' · ' + (others.length ? tr('mit {0}', others.join(', ')) : tr('nur du'));
                return h('div', { class: 'row' + (l.id === cur ? ' cur' : ''), role: 'button', tabindex: '0', onclick: e => { if (e.target.closest('.mini')) return; openList(l.id); sh.close(); } },
                    h('span', { class: 'grow' }, l.n, h('small', null, sub)),
                    h('button', { class: 'mini', type: 'button', 'aria-label': tr('Liste bearbeiten'), onclick: () => listMenu(l) }, icon(I.more)));
            }),
            h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: newList }, tr('Neue Liste anlegen'))));
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
        !mine && h('p', { class: 'info' }, tr('Diese Liste gehört {0}.', userName(l.owner) || tr('jemand anderem'))),
        mine && btn(tr('Teilen mit …'), () => shareList(l)),
        mine && btn(tr('Umbenennen'), () => ask(tr('Liste umbenennen'), [{ k: 'name', label: tr('Name'), value: l.n, max: 40 }], tr('Speichern'), v => act('list_rename', { id: l.id, name: v.name }))),
        mine && btn(tr('Liste löschen'), () => confirmDlg(tr('Liste löschen'), tr('„{0}“ wird für alle Mitglieder gelöscht, samt allem, was noch draufsteht.', l.n), tr('Endgültig löschen'), () => act('list_delete', { id: l.id }))),
        !mine && btn(tr('Liste verlassen'), () => confirmDlg(tr('Liste verlassen'), tr('Du siehst „{0}“ danach nicht mehr. Wieder rein kommst du nur, wenn dich jemand neu einlädt.', l.n), tr('Verlassen'), () => act('list_leave', { id: l.id }))));
}

function shareList(l) {
    const others = S.users.filter(u => u.id !== S.me.id);
    if (!others.length) {
        return ask(tr('Teilen'), [{ type: 'info', text: S.me.admin ? tr('Es gibt noch keine weiteren Konten. Leg unter Menü → Konten welche an.') : tr('Es gibt noch keine weiteren Konten. Neue Konten legt der Administrator an.') }], null, null);
    }
    ask(tr('„{0}“ teilen mit', l.n), others.map(u => ({ k: 'u' + u.id, type: 'checkbox', label: u.n, value: l.members.includes(u.id) })), tr('Speichern'),
        v => act('list_share', { id: l.id, users: others.filter(u => v['u' + u.id]).map(u => u.id) }));
}

/* ---------- Reihenfolge der Warengruppen ---------- */
function showOrder() {
    if (!L) return;
    const sh = sheet(tr('Reihenfolge im Laden'));
    const box = h('div');
    const row = id => h('div', { class: 'row', data: { id } },
        h('span', { class: 'mini grip', 'aria-hidden': 'true' }, icon(I.grip)),
        h('span', { class: 'grow' }, catName(id)),
        h('button', { class: 'mini', type: 'button', 'aria-label': tr('nach oben'), onclick: e => { const r = e.currentTarget.parentNode; if (r.previousSibling) box.insertBefore(r, r.previousSibling); } }, icon(I.up)),
        h('button', { class: 'mini', type: 'button', 'aria-label': tr('nach unten'), onclick: e => { const r = e.currentTarget.parentNode; if (r.nextSibling) box.insertBefore(r.nextSibling, r); } }, icon(I.down)));
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
        h('p', { class: 'info' }, tr('Zieh die Warengruppen in die Reihenfolge, in der du durch deinen Laden läufst. Das gilt nur für die Liste „{0}“.', curList().n)),
        box,
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => save([]) }, tr('Standard')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => save([...box.children].map(r => +r.dataset.id)) }, tr('Speichern'))));
}

/* ---------- Vorlagen ---------- */
function showTemplates() {
    const sh = sheet(tr('Vorlagen'), { onclose: () => stateListeners.delete(draw) });
    function draw() {
        fill(sh.body, 
            h('p', { class: 'info' }, curList() ? tr('Antippen setzt alle Produkte der Vorlage auf die Liste „{0}“.', curList().n) : tr('Antippen setzt alle Produkte der Vorlage auf die Liste.')),
            S.templates.map(tp => h('div', { class: 'row', role: 'button', tabindex: '0', onclick: e => { if (e.target.closest('.mini')) return; applyTemplate(tp); sh.close(); } },
                h('span', { class: 'grow' }, dt(tp.n), h('small', null, tp.items.map(i => dn(i.n)).join(', '))),
                h('button', { class: 'mini', type: 'button', 'aria-label': tr('Vorlage bearbeiten'), onclick: () => editTemplate(tp) }, icon(I.edit)))),
            h('div', { class: 'btns' },
                L && L.items.length > 0 && h('button', { class: 'btn', type: 'button', onclick: () => editTemplate(null, L.items) }, tr('Aktuelle Liste als Vorlage')),
                h('button', { class: 'btn primary', type: 'button', onclick: () => editTemplate(null) }, tr('Neue Vorlage'))));
    }
    stateListeners.add(draw);
    draw();
}
function applyTemplate(tp) {
    if (!L) return;
    const ops = tp.items.filter(i => !itemByName(i.n)).map(i => ({ t: 'add', uid: newUid(), n: i.n, c: hasCat(i.c) ? i.c : 0, note: i.note || '' }));
    op(ops);
    toast(!ops.length ? tr('Alles aus „{0}“ steht schon auf der Liste', dt(tp.n))
        : ops.length === 1 ? tr('1 Produkt aus „{0}“ hinzugefügt', dt(tp.n)) : tr('{0} Produkte aus „{1}“ hinzugefügt', ops.length, dt(tp.n)));
}
function editTemplate(tp, preset) {
    const items = tp ? tp.items : (preset || []);
    ask(tp ? tr('Vorlage bearbeiten') : tr('Neue Vorlage'), [
        { k: 'name', label: tr('Name'), value: tp ? dt(tp.n) : '', placeholder: tr('z. B. Wocheneinkauf'), max: 40 },
        { k: 'items', label: tr('Produkte, eines pro Zeile. Menge nach einem Semikolon.'), type: 'textarea', placeholder: tr('Milch; 2 Liter\nBrot\nÄpfel'), value: items.map(i => dn(i.n) + (i.note ? '; ' + dnote(i.note) : '')).join('\n') },
    ], tr('Speichern'), v => {
        const list = v.items.split('\n').map(line => {
            const [n, ...rest] = line.split(';');
            const name = canon(n.trim());
            const known = S.catalog.products.find(p => low(p.n) === low(name)) || items.find(i => low(i.n) === low(name));
            return { n: name, note: canonNote(rest.join(';').trim()), c: known ? known.c : 0 };
        }).filter(i => i.n);
        // Der unveränderte (nur übersetzt angezeigte) Name einer mitgelieferten Vorlage bleibt, wie er gespeichert ist
        return act('tpl_save', { id: tp ? tp.id : 0, name: tp && v.name.trim() === dt(tp.n) ? tp.n : v.name, items: list });
    }, [tp && { label: tr('Löschen'), danger: true, fn: () => act('tpl_delete', { id: tp.id }) }]);
}

/* ---------- Katalog verwalten ---------- */
function showCatalog() {
    const sh = sheet(tr('Katalog verwalten'), { wide: true, onclose: () => stateListeners.delete(draw) });
    function draw() {
        const byCat = prodsByCat();
        fill(sh.body, 
            h('p', { class: 'info' }, tr('{0} Produkte in {1} Warengruppen. Der Katalog gilt für alle Listen und alle Konten. Tippe ein Produkt an, um es zu ändern oder zu löschen.', S.catalog.products.length, S.catalog.cats.length)),
            h('div', { class: 'btns' },
                h('button', { class: 'btn small', type: 'button', onclick: () => ask(tr('Neue Warengruppe'), [{ k: 'name', label: tr('Name'), max: 60 }], tr('Anlegen'), v => act('cat_add', { name: canonC(v.name.trim()) })) }, tr('+ Warengruppe')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: showBackups }, tr('Sicherungen')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: () => confirmDlg(tr('Standard wiederherstellen'),
                    tr('Der ganze Katalog wird durch den mitgelieferten Standard ersetzt. Eigene Produkte und Warengruppen gehen dabei verloren. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.'),
                    tr('Standard wiederherstellen'), () => act('catalog_reset', {})) }, tr('Standard wiederherstellen')),
                S.me.admin && h('button', { class: 'btn small danger', type: 'button', onclick: () => confirmDlg(tr('Alles löschen'),
                    tr('Alle Produkte und Warengruppen werden gelöscht, der Katalog ist danach leer. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.'),
                    tr('Alles löschen'), () => act('catalog_clear', {})) }, tr('Alles löschen'))),
            S.catalog.cats.map(c => [
                h('div', { class: 'mcat' }, h('h4', null, dc(c.n), h('span', { class: 'badge' }, String((byCat.get(c.id) || []).length))),
                    h('button', { class: 'btn small', type: 'button', onclick: () => editCat(c, (byCat.get(c.id) || []).length) }, tr('Ändern'))),
                h('div', { class: 'chips' },
                    (byCat.get(c.id) || []).map(p => h('button', { class: 'chip', type: 'button', onclick: () => editProd(p) }, dn(p.n))),
                    h('button', { class: 'chip add', type: 'button', onclick: () => addProd(c) }, tr('+ Produkt'))),
            ]));
    }
    stateListeners.add(draw);
    draw();
}
const realCats = () => S.catalog.cats.map(c => [c.id, dc(c.n)]);
/* Auf Englisch zeigen die Felder den übersetzten Namen. Bleibt er unverändert, wird der gespeicherte (deutsche) Name behalten. */
function addProd(c) {
    ask(tr('Neues Produkt'), [{ k: 'name', label: tr('Name'), max: 60 }, { k: 'cat', label: tr('Warengruppe'), type: 'select', value: c.id, options: realCats() }],
        tr('Anlegen'), v => {
            const name = canon(v.name.trim());
            if (S.catalog.products.some(p => low(p.n) === low(name))) throw new Error(tr('„{0}“ gibt es schon im Katalog.', dn(name)));
            return act('prod_add', { name, cat: +v.cat });
        });
}
function editProd(p) {
    ask(tr('Produkt ändern'), [{ k: 'name', label: tr('Name'), value: dn(p.n), max: 60 }, { k: 'cat', label: tr('Warengruppe'), type: 'select', value: p.c, options: realCats() }],
        tr('Speichern'), v => act('prod_edit', { id: p.id, name: v.name.trim() === dn(p.n) ? p.n : canon(v.name.trim()), cat: +v.cat }),
        [{ label: tr('Löschen'), danger: true, fn: () => act('prod_delete', { id: p.id }) }]);
}
function editCat(c, count) {
    ask(tr('Warengruppe ändern'), [{ k: 'name', label: tr('Name'), value: dc(c.n), max: 60 }], tr('Speichern'), v => act('cat_rename', { id: c.id, name: v.name.trim() === dc(c.n) ? c.n : canonC(v.name.trim()) }),
        [{ label: tr('Löschen'), danger: true, fn: () => {
            confirmDlg(tr('Warengruppe löschen'), !count ? tr('„{0}“ wird gelöscht. Vorher wird eine Sicherung angelegt.', dc(c.n))
                : count === 1 ? tr('„{0}“ wird gelöscht, samt 1 Produkt. Vorher wird eine Sicherung angelegt.', dc(c.n))
                : tr('„{0}“ wird gelöscht, samt {1} Produkten. Vorher wird eine Sicherung angelegt.', dc(c.n), count),
                tr('Löschen'), () => act('cat_delete', { id: c.id }));
        } }]);
}
/** Der Grund einer Sicherung steht deutsch in der Datenbank */
function backupReason(r) {
    const m = /^Vor dem Löschen von „(.*)“$/.exec(r);
    return m ? tr('Vor dem Löschen von „{0}“', dc(m[1])) : tr(r);
}
async function showBackups() {
    let list;
    try { list = (await api('catalog_backups')).backups; } catch (e) { return toast(e.message); }
    const sh = sheet(tr('Sicherungen des Katalogs'));
    put(sh.body, 
        h('p', { class: 'info' }, list.length ? tr('Vor jeder großen Änderung wird der Katalog gesichert, die letzten 10 Stände bleiben erhalten. Antippen holt einen Stand zurück.') : tr('Noch keine Sicherungen. Sie entstehen automatisch vor jeder großen Änderung.')),
        list.map(b => h('button', { class: 'row', type: 'button', onclick: () => confirmDlg(tr('Sicherung zurückholen'),
            tr('Der Katalog wird durch den Stand vom {0} ersetzt ({1} Produkte). Der jetzige Stand wird vorher gesichert.', fmtTime(b.at), b.products), tr('Zurückholen'),
            async () => { await act('catalog_restore', { id: b.id }); sh.close(); }) },
            h('span', { class: 'grow' }, fmtTime(b.at), h('small', null, backupReason(b.reason) + ' · ' + tr('{0} Produkte in {1} Warengruppen', b.products, b.cats))))));
}

/* ---------- Konten (nur Administrator) ---------- */
function showUsers() {
    const sh = sheet(tr('Konten'), { onclose: () => stateListeners.delete(draw) });
    function draw() {
        const myLists = S.lists.filter(l => l.owner === S.me.id);
        fill(sh.body, 
            h('p', { class: 'info' }, tr('Konten legst nur du an, eine offene Registrierung gibt es nicht. Gib Name und Passwort einfach weiter, jeder kann sein Passwort danach selbst ändern.')),
            S.users.map(u => h('div', { class: 'row' },
                h('span', { class: 'grow' }, u.n, u.admin && h('span', { class: 'badge' }, tr('Administrator'))),
                h('button', { class: 'btn small', type: 'button', onclick: () => ask(tr('Neues Passwort für {0}', u.n), [{ k: 'pass', label: tr('Neues Passwort (mindestens 8 Zeichen)'), type: 'password' }], tr('Setzen'),
                    async v => { await act('user_pass', { id: u.id, pass: v.pass }); toast(tr('Passwort geändert')); }) }, tr('Passwort')),
                u.id !== S.me.id && h('button', { class: 'btn small danger', type: 'button', onclick: () => confirmDlg(tr('Konto löschen'),
                    tr('Das Konto „{0}“ wird gelöscht. Listen, die {0} angelegt hat, gehen an dich über.', u.n), tr('Konto löschen'), () => act('user_delete', { id: u.id })) }, tr('Löschen')))),
            h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => ask(tr('Konto anlegen'), [
                { k: 'name', label: tr('Name'), max: 30 },
                { k: 'pass', label: tr('Passwort (mindestens 8 Zeichen)'), type: 'text' },
                ...myLists.map(l => ({ k: 'l' + l.id, type: 'checkbox', label: tr('In die Liste „{0}“ einladen', l.n), value: l.id === S.startList })),
            ], tr('Anlegen'), v => act('user_add', { name: v.name, pass: v.pass, lists: myLists.filter(l => v['l' + l.id]).map(l => l.id) })) }, tr('Konto anlegen'))));
    }
    stateListeners.add(draw);
    draw();
}

/* ---------- Einstellungen ---------- */
const PALS = {
    light: [['tuerkis', 'Türkis'], ['ozean', 'Ozean'], ['sand', 'Sand'], ['beere', 'Beere'], ['graphit', 'Graphit']],
    dark: [['lagune', 'Lagune'], ['mitternacht', 'Nacht'], ['glut', 'Glut'], ['aubergine', 'Pflaume'], ['schwarz', 'Schwarz']],
};
const darkMq = window.matchMedia('(prefers-color-scheme: dark)');
/** Die vier Farben, die man selbst einstellen kann. Alles Weitere (Linien, Nebentext, zarter Akzent …) wird daraus abgeleitet. */
const PARTS = [['bg', 'Hintergrund'], ['card', 'Kacheln'], ['text', 'Schrift'], ['acc', 'Akzent']];
const okCols = c => c && PARTS.every(([k]) => /^#[0-9a-f]{6}$/.test(c[k])) ? Object.fromEntries(PARTS.map(([k]) => [k, c[k]])) : null;
const okUnit = u => typeof u === 'string' && /^[^\d\s,;]{1,12}$/.test(u);
const normLook = o => ({ mode: o && ['light', 'dark'].includes(o.mode) ? o.mode : 'auto', l: String(o && o.l || ''), d: String(o && o.d || ''), cl: okCols(o && o.cl), cd: okCols(o && o.cd),
    lang: o && ['de', 'en'].includes(o.lang) ? o.lang : '', keep: !(o && o.keep === false), units: Array.isArray(o && o.units) ? o.units.filter(okUnit).slice(0, 12) : [] });
/** Einstellungen des Kontos: mode = auto|light|dark, l/d = gewähltes Design für hell/dunkel, cl/cd = eigene Farben,
    lang = Sprache ('' = noch nicht gewählt), keep = zuletzt benutzte Menge merken, units = eigene Einheiten. Liegt auf dem Server, hier nur die Kopie. */
let look = normLook(LS.get('look', null) || { mode: LS.get('theme', 'auto'), l: LS.get('palL', ''), d: LS.get('palD', '') });
const palOf = mode => {
    const v = look[mode === 'dark' ? 'd' : 'l'];
    if (v === 'eigen' && look[mode === 'dark' ? 'cd' : 'cl']) return v;
    return PALS[mode].some(p => p[0] === v) ? v : PALS[mode][0][0];
};
let lookEpoch = 0;   // zählt jede Änderung an den Einstellungen des Kontos und jedes Speichern, siehe applyState
function setLook(patch, later) {
    lookEpoch++;
    Object.assign(look, patch);
    LS.set('look', look);
    LS.set('lookDirty', true);
    applyTheme();
    if (!later) saveLook();
}
/** Ans Konto schicken. Klappt es gerade nicht (kein Netz), versucht es der nächste Abgleich wieder. */
async function saveLook() {
    if (!LS.get('lookDirty', false) || !csrf) return;
    const sent = JSON.stringify(look);
    try {
        await api('me_look', { look });
        lookEpoch++;
        if (JSON.stringify(look) === sent) LS.set('lookDirty', false);
    } catch (e) {}
}

/* Farben rechnen */
const hex2rgb = x => [1, 3, 5].map(i => parseInt(x.slice(i, i + 2), 16));
const rgb2hex = a => '#' + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const x = hex2rgb(a), y = hex2rgb(b); return rgb2hex(x.map((v, i) => v + (y[i] - v) * t)); };
const lum = x => { const [r, g, b] = hex2rgb(x).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * r + .7152 * g + .0722 * b; };
const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function hsl2hex([hh, s, l]) {
    s /= 100; l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = n => { const k = (n + hh / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
    return rgb2hex([f(0), f(8), f(4)]);
}
function hex2hsl(x) {
    const [r, g, b] = hex2rgb(x).map(v => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
    let hh = 0;
    if (d) hh = ((mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + 360) % 360;
    return [Math.round(hh), Math.round((d ? d / (1 - Math.abs(2 * l - 1)) : 0) * 100), Math.round(l * 100)];
}
/** Aus den vier gewählten Farben alle Farben der Oberfläche. Die Schrift auf dem Akzent wird so gewählt, dass sie lesbar bleibt. */
function derive(c) {
    const dark = lum(c.bg) < .2;
    return {
        '--bg': c.bg, '--card': c.card, '--text': c.text, '--acc': c.acc, '--mut': mix(c.text, c.bg, .4), '--line': mix(c.text, c.bg, .85),
        '--acc-text': contrast(c.acc, '#ffffff') >= contrast(c.acc, '#101418') ? '#ffffff' : '#101418', '--acc-soft': mix(c.acc, c.card, .82),
        '--danger': dark ? '#ff8a7a' : '#b42318', '--shadow': dark ? 'none' : '0 1px 2px rgba(0, 0, 0, .08)', 'color-scheme': dark ? 'dark' : 'light',
    };
}
const VARS = Object.keys(derive({ bg: '#ffffff', card: '#ffffff', text: '#000000', acc: '#000000' }));
const setVars = (el, c) => { const v = c ? derive(c) : null; for (const k of VARS) { if (v) el.style.setProperty(k, v[k]); else el.style.removeProperty(k); } };
/** Die vier Grundfarben eines fertigen Designs, aus app.css gelesen (Startpunkt fürs eigene Design) */
function palColors(id) {
    const e = h('i', { class: 'pal', hidden: true, data: { pal: id } });
    document.body.append(e);
    const cs = getComputedStyle(e);
    const c = okCols(Object.fromEntries(PARTS.map(([k]) => [k, cs.getPropertyValue('--' + k).trim().toLowerCase()])));
    e.remove();
    return c || { bg: '#f3f6f5', card: '#ffffff', text: '#13201d', acc: '#0f766e' };
}

/** Hell oder dunkel (fest oder wie das Gerät) und dazu das jeweils ausgesuchte Design. Die fertigen Designs stehen in app.css. */
function applyTheme() {
    const mode = look.mode === 'auto' ? (darkMq.matches ? 'dark' : 'light') : look.mode;
    const root = document.documentElement;
    const pal = palOf(mode);
    root.dataset.theme = mode;
    root.dataset.pal = pal;
    setVars(root, pal === 'eigen' ? look[mode === 'dark' ? 'cd' : 'cl'] : null);
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue(mode === 'dark' ? '--bg' : '--acc').trim() || meta.content;
    // Merkzettel für boot.js: so sieht dieses Gerät beim nächsten Start sofort richtig aus, auch auf der Anmeldeseite
    const side = m => { const pal = palOf(m), c = pal === 'eigen' ? look[m === 'dark' ? 'cd' : 'cl'] : null; return { pal, vars: c ? derive(c) : null }; };
    const paint = { mode: look.mode, light: side('light'), dark: side('dark') };
    if (meta) paint[mode].tc = meta.content;
    LS.set('paint', paint);
}
darkMq.addEventListener('change', applyTheme);
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
    btn.title = compact ? tr('Zur Kachel-Ansicht') : tr('Zur kompakten Ansicht');
}

/** Sprache: was am Konto gewählt ist, sonst was dieses Gerät zuletzt hatte (Cookie, auch vom Umschalter der Anmeldeseite), sonst die Sprache des Geräts. */
const pickLang = () => look.lang || (/(?:^|; )kf_lang=(de|en)/.exec(document.cookie) || [])[1] || (/^de/i.test(navigator.language || 'de') ? 'de' : 'en');
function applyLang() {
    lang = pickLang();
    document.documentElement.lang = lang;
    // Das Cookie sagt dem Server, in welcher Sprache Anmeldeseite und Fehlermeldungen kommen sollen
    try { document.cookie = 'kf_lang=' + lang + '; path=' + location.pathname.replace(/[^/]*$/, '') + '; max-age=31536000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : ''); } catch (e) {}
    $('#listBtn').setAttribute('aria-label', tr('Liste wechseln'));
    $('#viewBtn').setAttribute('aria-label', tr('Ansicht wechseln'));
    $('#menuBtn').setAttribute('aria-label', tr('Menü'));
    qInput.placeholder = tr('Produkt suchen oder neu anlegen');
    qInput.setAttribute('aria-label', tr('Produkt suchen'));
    applyView();
}

/** Farbmischer fürs eigene Design: vier Farben, je drei Regler oder der Farbwähler des Geräts, oben eine Vorschau, die sofort mitgeht. */
function editLook(mode, redraw) {
    const ck = mode === 'dark' ? 'cd' : 'cl';
    const start = { ...look[ck] };
    const col = { ...start }, hsl = {};
    for (const [k] of PARTS) hsl[k] = hex2hsl(col[k]);
    let part = 'acc';
    const sh = sheet(mode === 'dark' ? tr('Eigenes Design für dunkel') : tr('Eigenes Design für hell'), { onclose: () => { saveLook(); redraw(); } });
    const demo = (cls, name, note) => h('span', { class: 'tile ' + cls }, h('span', { class: 'tn' }, name), note && h('span', { class: 'tt' }, note));
    const prev = h('div', { class: 'prev', 'aria-hidden': 'true' },
        h('h2', null, tr('Noch zu kaufen'), h('small', null, '1')),
        h('div', { class: 'grid' }, demo('on', dn('Milch'), dnote('2 Liter')), demo('has', dn('Brot')), demo('', dn('Butter')), demo('new', tr('+ Neu'))),
        h('div', { class: 'cat' }, dc('Getränke'), h('small', null, '12'), icon(I.down)),
        h('div', { class: 'btns' }, h('span', { class: 'btn' }, tr('Knopf')), h('span', { class: 'btn primary' }, tr('Speichern'))));
    const tabs = PARTS.map(([k, name]) => h('button', { class: 'seg', type: 'button', onclick: () => { part = k; show(); } }, h('i'), tr(name)));
    const range = (cls, label, max, i) => {
        const r = h('input', { type: 'range', min: '0', max: String(max), step: '1', 'aria-label': label, oninput: () => { hsl[part][i] = +r.value; col[part] = hsl2hex(hsl[part]); show(); } });
        return [h('label', { class: 'sl ' + cls }, label, r), r];
    };
    const [hueL, hue] = range('hue', tr('Farbton'), 360, 0), [satL, sat] = range('sat', tr('Sättigung'), 100, 1), [ligL, lig] = range('lig', tr('Helligkeit'), 100, 2);
    const sliders = h('div', { class: 'sliders' }, hueL, satL, ligL);
    const picker = h('input', { type: 'color', 'aria-label': tr('Farbwähler'), oninput: () => { col[part] = picker.value.toLowerCase(); hsl[part] = hex2hsl(col[part]); show(); } });
    // Farbcode zum Eintippen oder Einfügen: #7c3aed, 7c3aed oder kurz #73e
    const code = h('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'none', 'aria-label': tr('Farbcode'), enterkeyhint: 'done',
        onchange: () => {
            let v = code.value.trim().toLowerCase().replace(/^#/, '');
            if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, '$&$&');
            if (/^[0-9a-f]{6}$/.test(v)) { col[part] = '#' + v; hsl[part] = hex2hsl(col[part]); }
            show();
        },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); code.blur(); } } });
    const load = c => { Object.assign(col, c); for (const [k] of PARTS) hsl[k] = hex2hsl(col[k]); show(); };
    const base = h('select', { 'aria-label': tr('Fertiges Design als Ausgangspunkt'), onchange: () => { if (base.value) load(palColors(base.value)); base.value = ''; } },
        h('option', { value: '' }, tr('Von einem fertigen Design ausgehen …')),
        [['Hell', PALS.light], ['Dunkel', PALS.dark]].map(([g, list]) => h('optgroup', { label: tr(g) }, list.map(([id, name]) => h('option', { value: id }, tr(name))))));
    const warn = h('p', { class: 'err', hidden: true }, tr('Die Schrift ist auf diesem Untergrund schwer zu lesen.'));
    function show() {
        setVars(prev, col);
        setLook({ [ck]: { ...col } }, true);   // die App dahinter färbt sich gleich mit, zum Konto geht es beim Schließen
        tabs.forEach((t, i) => { const k = PARTS[i][0]; t.firstChild.style.setProperty('--c', col[k]); t.setAttribute('aria-pressed', String(k === part)); });
        const [a, b, c] = hsl[part];
        hue.value = a; sat.value = b; lig.value = c;
        sliders.style.setProperty('--h', a); sliders.style.setProperty('--s', b + '%'); sliders.style.setProperty('--l', c + '%');
        picker.value = col[part];
        code.value = col[part];
        warn.hidden = Math.min(contrast(col.text, col.bg), contrast(col.text, col.card)) >= 3;
    }
    put(sh.body, prev, h('div', { class: 'segs' }, tabs), sliders,
        h('div', { class: 'pick' }, h('label', { class: 'btn' }, picker, tr('Farbwähler')), code), warn,
        h('label', { class: 'field' }, base),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => load(start) }, tr('Zurücksetzen')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, tr('Fertig'))));
    show();
}

function showSettings() {
    const sh = sheet(tr('Einstellungen'));
    // Sprache wechseln: alles neu zeichnen, auch dieses Fenster
    const langSel = h('select', { onchange: () => { setLook({ lang: langSel.value }); applyLang(); pushRefresh(); render(); sh.close(); showSettings(); } },
        [['de', 'Deutsch'], ['en', 'English']].map(([v, s]) => h('option', { value: v, selected: lang === v }, s)));
    const keepBox = h('input', { type: 'checkbox', checked: look.keep, onchange: () => { setLook({ keep: keepBox.checked }); render(); } });
    const unitBox = h('div', { class: 'chips' });
    const drawUnits = () => fill(unitBox,
        look.units.map(u => h('button', { class: 'chip', type: 'button', 'aria-label': tr('{0} entfernen', u), onclick: () => { setLook({ units: look.units.filter(x => x !== u) }); drawUnits(); } }, u + ' ✕')),
        h('button', { class: 'chip add', type: 'button', onclick: () => addUnit(drawUnits) }, tr('+ Einheit')));
    drawUnits();
    // Mitteilungen: der Haken zeigt, ob dieses Gerät angemeldet ist
    const pushBox = h('input', { type: 'checkbox', disabled: true, onchange: async () => {
        pushBox.disabled = true;
        try {
            if (pushBox.checked) await pushOn();
            else { await pushOff(); toast(tr('Mitteilungen ausgeschaltet')); }
        } catch (e) { toast(e.message); }
        pushBox.checked = !!(await pushSub());
        pushBox.disabled = false;
    } });
    if (pushCan()) pushSub().then(s => { pushBox.checked = !!s; pushBox.disabled = false; });
    const theme = h('select', { onchange: () => setLook({ mode: theme.value }) },
        [['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, s]) => h('option', { value: v, selected: look.mode === v }, tr(s))));
    const wakeBox = h('input', { type: 'checkbox', checked: LS.get('wake', true), onchange: () => { LS.set('wake', wakeBox.checked); wake(); } });
    const ivInput = h('input', { type: 'number', min: '1', max: '60', inputmode: 'numeric', value: String(S.interval) });
    const view = h('select', { onchange: () => { LS.set('view', view.value); applyView(); } },
        [['tiles', 'Kleine Kacheln'], ['compact', 'Kompakt']].map(([v, s]) => h('option', { value: v, selected: LS.get('view', 'tiles') === v }, tr(s))));
    const swatches = mode => {
        const row = h('div', { class: 'pals', role: 'radiogroup', 'aria-label': mode === 'dark' ? tr('Dunkles Design') : tr('Helles Design') });
        const pk = mode === 'dark' ? 'd' : 'l', ck = mode === 'dark' ? 'cd' : 'cl';
        const draw = () => {
            const own = h('button', { class: 'pal' + (look[ck] ? '' : ' empty'), type: 'button', role: 'radio', 'aria-checked': String(palOf(mode) === 'eigen'), data: { pal: 'eigen' },
                onclick: () => { setLook({ [ck]: look[ck] || palColors(palOf(mode)), [pk]: 'eigen' }); draw(); editLook(mode, draw); } },
                h('span', { class: 'dot' }, look[ck] ? h('i') : icon(I.edit)), h('span', null, tr('Eigenes')));
            if (look[ck]) setVars(own, look[ck]);
            fill(row, PALS[mode].map(([id, name]) => h('button', { class: 'pal', type: 'button', role: 'radio', 'aria-checked': String(palOf(mode) === id), data: { pal: id },
                onclick: () => { setLook({ [pk]: id }); draw(); } }, h('span', { class: 'dot' }, h('i')), h('span', null, tr(name)))), own);
        };
        draw();
        return row;
    };
    put(sh.body,
        h('label', { class: 'field' }, 'Sprache / Language', langSel),
        h('label', { class: 'field' }, tr('Ansicht (nur dieses Gerät)'), view),
        h('label', { class: 'field' }, tr('Hell oder dunkel'), theme),
        h('div', { class: 'qlabel' }, tr('Design für hell')), swatches('light'),
        h('div', { class: 'qlabel' }, tr('Design für dunkel')), swatches('dark'),
        h('p', { class: 'info' }, tr('Design und Farben gehören zu deinem Konto und gelten überall, wo du angemeldet bist. „Eigenes“ öffnet den Farbmischer.')),
        h('label', { class: 'check' }, wakeBox, h('span', null, tr('Bildschirm anlassen, solange Kaufen offen ist'))),
        h('label', { class: 'check' }, keepBox, h('span', null, tr('Zuletzt benutzte Menge merken'))),
        h('p', { class: 'info' }, tr('Beim Abhaken merkt sich Kaufen, welche Menge am Produkt stand, und setzt es beim nächsten Mal wieder genauso auf die Liste. Ohne Haken steht immer 1 da.')),
        h('div', { class: 'qlabel' }, tr('Eigene Einheiten')), unitBox,
        h('p', { class: 'info units' }, tr('Erscheinen bei der Mengenauswahl neben Stück, Packung und Liter. Antippen entfernt eine Einheit.')),
        pushCan() && h('label', { class: 'check' }, pushBox, h('span', null, tr('Mitteilungen auf diesem Gerät'))),
        h('p', { class: 'info' }, pushCan() ? tr('Du bekommst eine Mitteilung, wenn jemand etwas auf eine Liste setzt, die ihr teilt. Mehrere Produkte kommen gebündelt in einer Mitteilung, sobald der andere Kaufen verlässt.')
            : S.push ? tr('Mitteilungen gehen auf diesem Gerät oder in diesem Browser nicht. Auf dem iPhone muss Kaufen dafür über „Zum Home-Bildschirm“ installiert sein (ab iOS 16.4).')
            : tr('Dieser Server kann keine Mitteilungen verschicken.')),
        h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => ask(tr('Passwort ändern'), [
            { k: 'old', label: tr('Bisheriges Passwort'), type: 'password', auto: 'current-password' },
            { k: 'pass', label: tr('Neues Passwort (mindestens 8 Zeichen)'), type: 'password' },
            { k: 'pass2', label: tr('Neues Passwort wiederholen'), type: 'password' },
        ], tr('Ändern'), async v => {
            if (v.pass !== v.pass2) throw new Error(tr('Die beiden neuen Passwörter stimmen nicht überein.'));
            await api('me_pass', { old: v.old, pass: v.pass });
            toast(tr('Passwort geändert, andere Geräte wurden abgemeldet'));
        }) }, tr('Passwort ändern'))),
        S.me.admin && h('h2', null, tr('Für alle')),
        S.me.admin && h('label', { class: 'field' }, tr('Abgleich alle … Sekunden (1 bis 60)'), ivInput),
        S.me.admin && h('p', { class: 'info' }, tr('So oft fragt jedes Gerät nach, ob sich an der Liste etwas geändert hat. Kleiner heißt schneller, größer schont Server und Akku.')),
        S.me.admin && h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            try { await act('settings_save', { interval: +ivInput.value }); ivInput.value = String(S.interval); toast(tr('Gespeichert: alle {0} Sekunden', S.interval)); }
            catch (e) { toast(e.message); }
        } }, tr('Speichern'))),
        h('p', { class: 'info' }, tr('Angemeldet als {0} · Kaufen {1}', S.me.n, S.version)));
}

async function logout() {
    const go = async () => {
        if (pushCan() && online) await pushOff();   // sonst bekäme dieses Gerät weiter die Mitteilungen des abgemeldeten Kontos
        try { await api('logout', {}); } catch (e) { if (e.net) throw new Error(tr('Abmelden geht nur mit Verbindung zum Server.')); }
        LS.clear();
        location.reload();
    };
    if (queue.length) confirmDlg(tr('Abmelden'), tr('{0} Änderungen sind noch nicht beim Server angekommen und gehen beim Abmelden verloren.', queue.length), tr('Trotzdem abmelden'), go);
    else go().catch(e => toast(e.message));
}

/** Die offene Liste als schlichten Text weitergeben (WhatsApp, Mail …), für Leute ohne Konto. Ohne Teilen-Funktion des Geräts wird kopiert. */
async function shareText() {
    const l = curList();
    if (!l || !L) return;
    if (!L.items.length) return toast(tr('Die Liste ist leer, es gibt nichts zu teilen.'));
    const groups = new Map(catOrder().map(id => [id, []]));
    for (const it of L.items) groups.get(hasCat(it.c) ? it.c : 0).push(it);
    const lines = [l.n];
    for (const [id, items] of groups) {
        if (!items.length) continue;
        lines.push('', catName(id) + ':');
        for (const it of items) lines.push('- ' + dn(it.n) + (it.note ? ' (' + dnote(it.note) + ')' : ''));
    }
    const text = lines.join('\n');
    try {
        if (navigator.share) return await navigator.share({ title: l.n, text });
        await navigator.clipboard.writeText(text);
        toast(tr('Liste in die Zwischenablage kopiert'));
    } catch (e) {
        if (e && e.name === 'AbortError') return;   // Teilen abgebrochen
        // Weder Teilen noch Kopieren erlaubt: den Text zum Markieren anzeigen
        const sh = sheet(tr('Liste als Text'));
        const box = h('textarea', { readonly: true, rows: '12', value: text, onfocus: () => box.select() });
        put(sh.body, h('p', { class: 'info' }, tr('Text markieren und kopieren.')), h('label', { class: 'field' }, box));
    }
}

function showMenu() {
    const sh = sheet(tr('Menü'));
    const btn = (label, fn) => h('button', { class: 'row', type: 'button', onclick: () => { sh.close(); fn(); } }, label);
    put(sh.body, 
        btn(tr('Listen'), showLists),
        L && btn(tr('Vorlagen'), showTemplates),
        L && btn(tr('Reihenfolge im Laden'), showOrder),
        L && btn(tr('Liste als Text teilen'), shareText),
        btn(tr('Katalog verwalten'), showCatalog),
        S.me.admin && btn(tr('Konten'), showUsers),
        btn(tr('Einstellungen'), showSettings),
        btn(tr('Abmelden'), logout));
}

/* ---------- Start ---------- */
$('#menuBtn').addEventListener('click', () => { if (S) showMenu(); });
$('#viewBtn').addEventListener('click', () => { LS.set('view', LS.get('view', 'tiles') === 'compact' ? 'tiles' : 'compact'); applyView(); });
$('#listBtn').addEventListener('click', () => { if (S) showLists(); });
document.addEventListener('visibilitychange', () => { wake(); if (document.hidden) { clearTimeout(timer); pushDone(); } else tick(); });
window.addEventListener('pagehide', pushDone);
window.addEventListener('online', tick);
window.addEventListener('offline', () => setOnline(false));

applyTheme();
applyLang();
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
