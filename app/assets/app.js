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
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    tiles: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
    list: 'M4 6h.01M4 12h.01M4 18h.01M9 6h11M9 12h11M9 18h11',
    cart: 'M3 4h2.2l2.3 10.5h10.8L20.5 7H6.3M9.5 19.5h.01M17 19.5h.01', check: 'M5 12.5l4.5 4.5L19 7.5',
    globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9s1.2-6.5 3.6-9z', code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
};

const LS = {
    get(k, d) { try { const v = localStorage.getItem('kf_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kf_' + k, JSON.stringify(v)); } catch (e) {} },
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith('kf_') && !['kf_theme', 'kf_view', 'kf_tick', 'kf_palL', 'kf_palD', 'kf_look', 'kf_paint', 'kf_font', 'kf_mode', 'kf_ldb', 'kf_a2hsNo', 'kf_pdfo', 'kf_pdfx', 'kf_fontL', 'kf_viewL', 'kf_fontNow', 'kf_helpSeen'].includes(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} },
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
/* Eigene englische Namen aus dem Katalog (Import) gehen der eingebauten Übersetzung vor. Neu aufgebaut, sobald sich der Katalog ändert. */
let xFor = null, X = { p: new Map(), c: new Map(), rp: new Map(), rc: new Map() };
const xm = () => {
    if (S && S.catalog !== xFor) {
        xFor = S.catalog;
        X = { p: new Map(), c: new Map(), rp: new Map(), rc: new Map() };
        for (const p of xFor.products) if (p.e) { X.p.set(low(p.n), p.e); X.rp.set(low(p.e), p.n); }
        for (const c of xFor.cats) if (c.e) { X.c.set(low(c.n), c.e); X.rc.set(low(c.e), c.n); }
    }
    return X;
};
const enName = n => xm().p.get(low(n)) || EN_P.get(low(n)) || '';
const enCat = n => xm().c.get(low(n)) || EN_C.get(low(n)) || '';
const dn = n => lang === 'en' && enName(n) || n;
const dc = n => lang === 'en' && enCat(n) || n;
const dt = n => lang === 'en' && EN_T.get(low(n)) || n;
const canon = n => lang === 'en' && (xm().rp.get(low(n)) || DE_P.get(low(n))) || n;
const canonC = n => lang === 'en' && (xm().rc.get(low(n)) || DE_C.get(low(n))) || n;

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
/** Lokaler Modus: alles bleibt auf diesem Gerät, local.js spielt den Server. Umschalten lädt die Seite neu. */
let LOCAL = LS.get('mode', '') === 'local';
/** Demo-Server (index.php): keine Konten, jeder Besucher nutzt Kaufen lokal. Dazu der Hinweis „Zum Home-Bildschirm“ und ein dezenter Hinweis unten. */
const DEMO = document.documentElement.dataset.demo === '1';
const stateListeners = new Set();         // offene Fenster, die bei neuem Stand neu zeichnen
const main = $('#main'), qInput = $('#q');

const saveQueue = () => LS.set('queue', queue);
const curList = () => S && S.lists.find(l => l.id === cur) || null;
const userName = id => { const u = S && S.users.find(u => u.id === id); return u ? u.n : ''; };
const catName = id => { const c = S && S.catalog.cats.find(c => c.id === id); return c ? dc(c.n) : tr('Sonstiges'); };
/** Mitgelieferte Symbole der Warengruppen, nach dem (deutschen) Namen im Katalog. Eigene Warengruppen haben keins, bis man eins wählt. */
const CAT_IC = { 'Obst & Gemüse': '🥦', 'Brot & Gebäck': '🥖', 'Milch & Käse': '🧀', 'Fleisch & Fisch': '🥩', 'Zutaten & Gewürze': '🧂', 'Nudeln, Reis & Co.': '🍝',
    'Konserven & Fertiges': '🥫', 'Frühstück & Aufstrich': '🍯', 'Süßes & Snacks': '🍫', 'Tiefkühl': '🧊', 'Getränke': '🧃', 'Haushalt': '🧽', 'Drogerie & Pflege': '🧴',
    'Baby': '🍼', 'Tierbedarf': '🐾', 'Haus & Garten': '🌱', 'Sonstiges': '📦' };
/** Was für eine Warengruppe gilt: eigenes Bild (data:), eigenes Emoji, nichts ('-') oder das mitgelieferte */
const catIconOf = c => !c ? CAT_IC.Sonstiges : c.i === '-' ? '' : c.i || CAT_IC[c.n] || '';
/** Symbol als Element: ein kleines Bild oder ein Emoji, nur als Text, nie als HTML */
function iconEl(v, cls = 'ci') {
    if (!v) return null;
    if (v.startsWith('data:image/')) return h('img', { class: cls + ' img', src: v, alt: '', draggable: 'false' });
    return h('span', { class: cls, 'aria-hidden': 'true' }, v);
}
const catIcon = id => iconEl(catIconOf(S && S.catalog.cats.find(c => c.id === id)));
const hasCat = id => !!(S && S.catalog.cats.some(c => c.id === id));
/** Was noch zu kaufen ist, unter diesem Namen. Abgehaktes (got = seit wann) zählt hier nicht. */
const itemByName = n => L ? L.items.find(i => !i.got && low(i.n) === low(n)) : null;
const inBasket = n => !!L && L.items.some(i => i.got && low(i.n) === low(n));
const openItems = () => L.items.filter(i => !i.got);
/** Alles Abgehakte, zuletzt Abgehaktes zuerst (früher „Einkaufskorb“, daher die Namen) */
const basketItems = () => L.items.filter(i => i.got).sort((a, b) => b.got - a.got);
/** Die Zahl an der Liste („3 offen“): nur was noch zu kaufen ist */
const countOpen = () => { const l = curList(); if (l && L) l.count = openItems().length; };
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

/** Fehler aus local.js: deutscher Text als Schlüssel, hier übersetzt */
const lerr = e => Object.assign(new Error(e && e.key ? tr(e.key, ...(e.args || [])) : (e && e.message) || String(e)), { status: e && e.status || 400 });
async function api(action, body) {
    if (LOCAL) {
        try { return self.kfLocal.api(action, body); } catch (e) { throw lerr(e); }
    }
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
    if (s.me.look && !oldLook && !LS.get('lookDirty', false)) { look = normLook(s.me.look); LS.set('look', look); applyTheme(); applyLang(); tidyUnits(); }   // das Aussehen gehört zum Konto
    LS.set('state', S);
    if (!S.lists.some(l => l.id === cur)) {
        cur = S.lists.length ? S.lists[0].id : null;
        LS.set('cur', cur);
        L = cur ? LS.get('list_' + cur, null) : null;
        applyListLook();
        if (cur) loadList();
    }
    render();
    stateListeners.forEach(fn => fn());
}

async function loadState() {
    const e = lookEpoch;
    applyState(await api('state'), e !== lookEpoch);
    flush();
    updAuto();
    offerImport();
    if (!pushSynced) { pushSynced = true; pushRefresh(); }
}

function setList(data) {
    if (data.id !== cur) return;
    L = data;
    LS.set('list_' + cur, L);
    countOpen();
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
    disarm();
    applyListLook();
    render();
    loadList();
}

/* ---------- Änderungen an der Liste: sofort anzeigen, merken, im Hintergrund abliefern ---------- */
/** Gekauft: zählt mit („vor 3 Tagen“) und merkt sich die Menge. Den Kaufrhythmus rechnet der Server. */
function usageBought(it, now) {
    const u = L.usage.find(u => low(u.n) === low(it.n));
    L.usage = L.usage.filter(x => x !== u);
    L.usage.unshift({ n: it.n, c: it.c, cnt: (u ? u.cnt : 0) + 1, last: now, g: u ? u.g : 0, gn: u ? u.gn : 0, rs: u ? u.rs || 0 : 0, am: u ? u.am || 0 : 0,
        prev: u ? { ...u, prev: null } : null });
    setMem(it.n, it.note);
}
/** Abhaken rückgängig: der Stand von vorher, sonst nur einen weniger */
function usageUndo(n) {
    const u = L.usage.find(u => low(u.n) === low(n));
    if (u && u.prev) L.usage = L.usage.map(x => x === u ? u.prev : x);
    else if (u && --u.cnt <= 0) L.usage = L.usage.filter(x => x !== u);
}
/** Ist es schon abgehakt und kommt wieder auf die Liste, wird es eben noch einmal gebraucht: das Abgehakte ist gekauft und fällt weg */
const dropBasket = n => { for (const it of L.items.filter(i => i.got && low(i.n) === low(n))) buyItem(it); };
/** Gekauft: geht von der Liste und zählt (zum Zeitpunkt des Abhakens). Nur so, mit „Einkauf fertig“, zählt etwas als gekauft. */
function buyItem(it) {
    L.items = L.items.filter(i => i !== it);
    usageBought(it, Math.min(Math.floor(Date.now() / 1000), it.got || Infinity));
}

function applyLocal(o) {
    const now = Math.floor(Date.now() / 1000);
    if (o.t === 'add' || o.t === 'restore') {
        if (L.items.some(i => i.uid === o.uid)) return;
        const same = itemByName(o.n);
        if (same) { if (o.note) same.note = o.note; }
        else { dropBasket(o.n); L.items.push({ uid: o.uid, n: o.n, c: o.c || 0, note: o.note || '', by: o.by || S.me.id, at: now, got: 0 }); }
        if (o.t === 'restore') usageUndo(o.n);
    } else if (o.t === 'got') {   // abgehakt: bleibt durchgestrichen stehen, gekauft zählt es erst mit „Einkauf fertig“
        const it = L.items.find(i => i.uid === o.uid && !i.got);
        if (it) it.got = now;
    } else if (o.t === 'ungot') {   // Abgehaktes zurück auf die Liste
        const it = L.items.find(i => i.uid === o.uid && i.got);
        if (it) it.got = 0;
    } else if (o.t === 'buy') {   // „Einkauf fertig“
        const it = L.items.find(i => i.uid === o.uid && i.got);
        if (it) buyItem(it);
    } else if (o.t === 'back') {   // Löschen rückgängig: genau so wieder hin
        if (L.items.some(i => i.uid === o.uid) || itemByName(o.n)) return;
        if (!o.got) dropBasket(o.n);
        else if (inBasket(o.n)) return;
        L.items.push({ uid: o.uid, n: o.n, c: o.c || 0, note: o.note || '', by: o.by || S.me.id, at: o.at || now, got: o.got || 0 });
    } else if (o.t === 'done' || o.t === 'remove') {
        const it = L.items.find(i => i.uid === o.uid);
        if (!it) return;
        L.items = L.items.filter(i => i !== it);
        if (o.t === 'done' && !it.got) usageBought(it, now);
    } else if (o.t === 'edit') {
        const it = L.items.find(i => i.uid === o.uid);
        if (it) { it.note = o.note || ''; it.c = o.c || 0; }
    } else if (o.t === 'forget') {
        L.usage = L.usage.filter(u => low(u.n) !== low(o.n));
        setMem(o.n, '');
    } else if (o.t === 'unmem') {
        setMem(o.n, '');
    } else if (o.t === 'nodue' || o.t === 'redue') {   // aus: -1 - gn, so bleibt die Zahl der Abstände erhalten (wie auf dem Server)
        const u = L.usage.find(u => low(u.n) === low(o.n));
        if (u && o.t === 'nodue' && u.gn >= 0) u.gn = -1 - u.gn;
        if (u && o.t === 'redue' && u.gn < 0) u.gn = u.gn < -1 ? -1 - u.gn : u.g > 0 ? 2 : 0;
    } else if (o.t === 'auto') {   // automatisch auf die Liste, pro Kauf nur einmal
        const u = usageOf(o.n);
        if (!u || u.am < 0 || u.am === u.last || L.items.some(i => i.uid === o.uid)) return;
        u.am = u.last;
        if (!itemByName(o.n)) { dropBasket(o.n); L.items.push({ uid: o.uid, n: o.n, c: o.c || 0, note: o.note || '', by: S.me.id, at: now, got: 0 }); }
    } else if (o.t === 'noauto' || o.t === 'reauto') {
        const u = usageOf(o.n);
        if (u) u.am = o.t === 'noauto' ? -1 : 0;
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
    countOpen();
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
    if (!document.hidden && !LOCAL) timer = setTimeout(tick, Math.max(1, iv) * 1000);
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
function toast(text, actionLabel, action, ms) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    fill(el, h('span', null, text), actionLabel && h('button', { type: 'button', onclick: () => { el.hidden = true; action(); } }, actionLabel));
    el.hidden = false;
    toastTimer = setTimeout(() => { el.hidden = true; }, ms || (actionLabel ? 6000 : 3500));
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
   immer in deutscher Schreibweise und mit Komma (2,5). Für die Anzeige wird er übersetzt und bekommt Brüche (dnote: 2½), getippte Mengen gehen den Weg zurück (canonNote). ---------- */
// Einheit: deutsch Einzahl und Mehrzahl, Schrittweite, englisch Einzahl und Mehrzahl
const UNITS = [['Stück', 'Stück', 1, 'piece', 'pieces'], ['Packung', 'Packungen', 1, 'pack', 'packs'], ['Flasche', 'Flaschen', 1, 'bottle', 'bottles'],
    ['Dose', 'Dosen', 1, 'can', 'cans'], ['Glas', 'Gläser', 1, 'jar', 'jars'], ['Bund', 'Bund', 1, 'bunch', 'bunches'],
    ['Liter', 'Liter', .5, 'liter', 'liters'], ['ml', 'ml', 50, 'ml', 'ml'], ['kg', 'kg', .5, 'kg', 'kg'], ['g', 'g', 50, 'g', 'g'],
    // ab hier Gebinde, die bei der Mengenauswahl erst unter „Weitere …“ stehen, bis man sie in den Einstellungen dazuholt
    ['Kiste', 'Kisten', 1, 'crate', 'crates'], ['Kasten', 'Kästen', 1, 'case', 'cases'], ['Becher', 'Becher', 1, 'tub', 'tubs'],
    ['Beutel', 'Beutel', 1, 'bag', 'bags'], ['Tüte', 'Tüten', 1, 'bag', 'bags'], ['Netz', 'Netze', 1, 'net', 'nets'],
    ['Schale', 'Schalen', 1, 'tray', 'trays'], ['Rolle', 'Rollen', 1, 'roll', 'rolls'], ['Tafel', 'Tafeln', 1, 'bar', 'bars'],
    ['Tube', 'Tuben', 1, 'tube', 'tubes'], ['Sack', 'Säcke', 1, 'sack', 'sacks'], ['Scheibe', 'Scheiben', 1, 'slice', 'slices'],
    ['Kopf', 'Köpfe', 1, 'head', 'heads'], ['Zehe', 'Zehen', 1, 'clove', 'cloves'], ['Würfel', 'Würfel', 1, 'cube', 'cubes'],
    ['Stange', 'Stangen', 1, 'stick', 'sticks'], ['Portion', 'Portionen', 1, 'portion', 'portions']];
const unitName = (i, n, lg) => UNITS[i][(lg === 'en' ? 3 : 0) + (n > 1 ? 1 : 0)];
const unitIndex = w => UNITS.findIndex(x => [x[0], x[1], x[3], x[4]].some(s => low(s) === low(w)));
// Welche mitgelieferten Einheiten bei der Mengenauswahl immer dastehen (look.uv, null = die ersten zehn wie bisher). Schlüssel ist die deutsche Einzahl.
const UDEF = UNITS.slice(0, 10).map(x => x[0]);
const uvis = () => look.uv || UDEF;
/* Eigene Einheit, gespeichert als „Kiste/Kisten“ (Einzahl/Mehrzahl) oder nur „Beutel“, wenn beide gleich sind. Ein Knopf für beide Formen. */
const UWORD = /^[^\d\s,;\/]{1,12}$/;
const cuForms = s => { const [a, b] = String(s).split('/'); return [a, b || a]; };
const cuName = (s, n) => cuForms(s)[n > 1 ? 1 : 0];
const cuLabel = s => [...new Set(cuForms(s))].join(' / ');
const cuFind = w => look.units.find(s => cuForms(s).some(f => low(f) === low(w))) || '';
/** Mehrzahl raten, wenn man sie leer lässt: Kiste wird Kisten, sonst bleibt das Wort (Beutel, Eimer) */
const guessPl = s => /e$/.test(s) ? s + 'n' : s;
/* Zahlen: gespeichert immer als Kommazahl (2,5), angezeigt mit Bruch (nice: 2½). Getippt werden darf 2,5 · 2.5 · 2½ · 2 1/2 · 1/2 · ½ */
const FRAC = { '½': .5, '¼': .25, '¾': .75, '1/2': .5, '1/4': .25, '3/4': .75 };
const NUM = String.raw`\d{1,4}(?:[.,]\d{1,2}|\s*[½¼¾]|\s+(?:1\/[24]|3\/4))?|[½¼¾]|1\/[24]|3\/4`;
const NUM_RE = new RegExp('^(?:' + NUM + ')$'), QTY_RE = new RegExp('^(' + NUM + ')\\s*([^\\d\\s,]*)\\s*(?:,\\s*(.*))?$');
function parseNum(s) {
    s = String(s || '').trim();
    if (!NUM_RE.test(s)) return NaN;
    const f = /(?:[½¼¾]|1\/[24]|3\/4)$/.exec(s), whole = f ? s.slice(0, f.index).trim() : s;
    return (whole ? parseFloat(whole.replace(',', '.')) : 0) + (f ? FRAC[f[0]] : 0);
}
function fmtNum(n, lg = lang, nice) {
    const r = Math.round(n * 100) / 100, w = Math.floor(r), f = nice && { .25: '¼', .5: '½', .75: '¾' }[Math.round((r - w) * 100) / 100];
    return f ? (w || '') + f : String(r).replace('.', lg === 'en' ? '.' : ',');
}
/** Zerlegt einen Hinweis in Zahl, Einheit (u = mitgelieferte, cu = eigene des Kontos) und Rest. Passt er nicht ins Muster, bleibt er als Ganzes der freie Hinweis. */
function parseQty(note) {
    const raw = String(note || '').trim();
    const m = QTY_RE.exec(raw);
    if (m) {
        const u = m[2] ? unitIndex(m[2]) : -1;
        const cu = m[2] && u < 0 ? cuFind(m[2]) : '';
        const n = parseNum(m[1]);
        if (n > 0 && (!m[2] || u >= 0 || cu)) return { n, u, cu, hint: m[3] || '' };
    }
    return { n: 0, u: -1, cu: '', hint: raw };
}
const fmtQty = (st, lg, hint, nice) => [st.n ? fmtNum(st.n, lg, nice) + (st.u >= 0 ? ' ' + unitName(st.u, st.n, lg) : st.cu ? ' ' + cuName(st.cu, st.n) : '') : '', hint].filter(Boolean).join(', ');
/** Menge für die Anzeige: in der Sprache des Kontos, halbe und viertel als Bruch. Was nicht ins Muster passt, bleibt, wie es ist. */
function dnote(note) {
    if (!note) return note;
    const p = parseQty(note);
    return p.n ? fmtQty(p, lang, p.hint, true) : note;
}
/** Menge und Hinweis getrennt für die Kacheln. Eine Zahl ohne Einheit wird zu „3×“ (cnt) und groß gezeigt, ein halbes bleibt „½“. */
function noteParts(note) {
    const p = parseQty(note);
    if (!p.n) return { q: '', hint: p.hint, cnt: false };
    const cnt = p.u < 0 && !p.cu;
    return { q: cnt ? fmtNum(p.n, lang, true) + (p.n >= 1 ? '×' : '') : fmtQty(p, lang, '', true), hint: p.hint, cnt };
}
/** Getippte Menge (Vorlagen) in die gespeicherte Schreibweise bringen, z. B. „1/2 Liter“ zu „0,5 Liter“ */
function canonNote(s) {
    if (!s) return s;
    const p = parseQty(s);
    return p.n ? fmtQty(p, 'de', p.hint) : s;
}
/** Eigene Einheit fürs Konto anlegen, z. B. Eimer. done(Name, Index einer mitgelieferten Einheit, falls es die schon gibt). */
function addUnit(done) { unitDialog('', (u, old, bi) => done(u, bi)); }
/** Eigene Einheit anlegen (old leer) oder umbenennen und löschen, mit Einzahl und Mehrzahl. done(neuer Name, alter Name), beim Löschen ist der neue Name leer.
    Gibt es die neue Einheit schon fest eingebaut, wird stattdessen die eingebaute immer angezeigt: done('', '', Index).
    Mengen, die schon mit der alten Einheit auf Listen stehen, bleiben als Text stehen („2 Eimer“). */
function unitDialog(old, done) {
    const [osg, opl] = old ? cuForms(old) : ['', ''];
    const sh = ask(old ? tr('Einheit bearbeiten') : tr('Eigene Einheit'), [
        { k: 'u', label: tr('Einzahl'), value: osg, placeholder: tr('z. B. Eimer'), max: 12 },
        { k: 'p', label: tr('Mehrzahl'), value: opl !== osg ? opl : '', placeholder: osg ? guessPl(osg) : tr('leer = wie Einzahl'), max: 12 },
        { type: 'info', text: tr('Einzahl und Mehrzahl teilen sich einen Knopf: bei 1 steht „Eimer“ da, ab 2 die Mehrzahl. Diktieren und Tippen verstehen beide.') },
        old && { type: 'info', text: tr('Mengen, die schon mit „{0}“ auf einer Liste stehen, bleiben als Text stehen.', cuLabel(old)) }],
        old ? tr('Speichern') : tr('Hinzufügen'), v => {
            const sg = v.u.trim(), pl = v.p.trim() || guessPl(sg);
            if (!UWORD.test(sg) || !UWORD.test(pl)) throw new Error(tr('Bitte ein einzelnes Wort ohne Ziffern eingeben, höchstens 12 Zeichen.'));
            const u = low(pl) === low(sg) ? sg : sg + '/' + pl;
            if (u === old) return;
            const bi = [sg, pl].map(unitIndex).find(i => i >= 0);
            if (bi !== undefined && !old) {   // gibt es schon fest eingebaut: die nehmen und immer anzeigen
                const was = uvis().includes(UNITS[bi][0]);
                if (!was) setLook({ uv: UNITS.map(x => x[0]).filter(k => k === UNITS[bi][0] || uvis().includes(k)) });
                toast(tr(was ? '„{0}“ gibt es schon.' : '„{0}“ ist schon dabei und steht jetzt immer bei der Mengenauswahl.', unitName(bi, 1, lang)));
                done('', '', bi);
                return;
            }
            if (bi !== undefined || look.units.some(s => s !== old && cuForms(s).some(f => [sg, pl].some(g => low(f) === low(g)))))
                throw new Error(tr('Diese Einheit gibt es schon.'));
            if (!old && look.units.length >= 12) throw new Error(tr('Mehr als 12 eigene Einheiten gehen nicht.'));
            setLook({ units: old ? look.units.map(x => x === old ? u : x) : [...look.units, u] });
            done(u, old);
        },
        [old && { label: tr('Löschen'), danger: true, fn: () => { setLook({ units: look.units.filter(x => x !== old) }); done('', old); } }]);
    // Beim Tippen der Einzahl die geratene Mehrzahl als Vorschlag zeigen
    const [iu, ip] = sh.body.querySelectorAll('input');
    if (iu && ip) iu.addEventListener('input', () => { const t = iu.value.trim(); ip.placeholder = t ? guessPl(t) : tr('leer = wie Einzahl'); });
}
/** Aufräumen, wenn das Aussehen vom Server kommt: eigene Einheiten, die es jetzt fest eingebaut gibt, fallen weg (die eingebaute wird dafür
    immer angezeigt), und zwei eigene wie „Eimer“ und „Eimern“ oder „Topf“ und „Töpfe“ werden ein Knopf mit Einzahl und Mehrzahl. */
function tidyUnits() {
    const plain = s => low(s).replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u');
    const pair = (x, y) => { const [a, b] = [x, y].sort((p, q) => p.length - q.length); return a !== b && plain(b).startsWith(plain(a)) && b.length - a.length <= 2 ? a + '/' + b : ''; };
    const units = [], add = [];
    let changed = false;
    for (const s of look.units) {
        const bi = cuForms(s).map(unitIndex).find(i => i >= 0);
        if (bi !== undefined) { add.push(UNITS[bi][0]); changed = true; continue; }
        const k = units.findIndex(t => cuForms(t).some(f => cuForms(s).some(g => low(f) === low(g))));   // eine Form gibt es schon
        const j = k >= 0 || s.includes('/') ? -1 : units.findIndex(t => !t.includes('/') && pair(t, s));
        if (k >= 0) { if (s.includes('/') && !units[k].includes('/')) units[k] = s; changed = true; }
        else if (j >= 0) { units[j] = pair(units[j], s); changed = true; }
        else units.push(s);
    }
    if (!changed) return;
    const vis = [...uvis(), ...add];
    setLook({ units, uv: add.every(k => uvis().includes(k)) ? look.uv : UNITS.map(x => x[0]).filter(k => vis.includes(k)) });
}
/** Alle eigenen Einheiten auf einen Blick: antippen zum Umbenennen oder Löschen, dazu „+ Einheit“. changed(neu, alt) nach jeder Änderung. */
function manageUnits(changed) {
    const sh = sheet(tr('Eigene Einheiten'));
    const box = h('div', { class: 'chips' });
    const after = (u, old) => { draw(); changed(u, old); };
    const draw = () => fill(box, look.units.map(u => h('button', { class: 'chip', type: 'button', 'aria-label': tr('{0} bearbeiten', cuLabel(u)), onclick: () => unitDialog(u, after) }, cuLabel(u))),
        h('button', { class: 'chip add', type: 'button', onclick: () => unitDialog('', after) }, tr('+ Einheit')));
    draw();
    put(sh.body, h('p', { class: 'info' }, tr('Antippen zum Umbenennen oder Löschen.')), box,
        h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, tr('Fertig'))));
}
function qtyField(value) {
    const st = parseQty(value);
    let auto = !st.n;   // noch keine Zahl gewählt: dann steht die 1 da, ohne Einheit
    if (auto) st.n = 1;
    const step = () => st.u >= 0 ? UNITS[st.u][2] : 1;
    const num = h('input', { type: 'text', inputmode: 'decimal', maxlength: 7, placeholder: '–', 'aria-label': tr('Menge'), autocomplete: 'off', enterkeyhint: 'done',
        oninput: () => { let n = parseNum(num.value); if (isNaN(n)) n = parseFloat(num.value.replace(',', '.')); st.n = n > 0 ? Math.min(n, 9999) : 0; auto = false; show(false); },
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
    let chips = [], more = false;   // chips: { b: Knopf, u: mitgelieferte, cu: eigene }. more: „Weitere …“ ist aufgeklappt
    const drawChips = () => {
        const all = UNITS.map((x, i) => i), vis = uvis();
        const shown = all.filter(i => vis.includes(UNITS[i][0]) || i === st.u), rest = all.filter(i => !shown.includes(i));
        const mk = (u, cu) => ({ u, cu, b: h('button', { class: 'chip', type: 'button', onclick: () => pick(u, cu) }) });
        chips = [...shown.map(i => mk(i, '')), ...look.units.map(cu => mk(-1, cu)), ...(more ? rest.map(i => mk(i, '')) : [])];
        fill(chipBox, chips.map(c => c.b),
            rest.length > 0 && h('button', { class: 'chip add', type: 'button', 'aria-expanded': String(more), onclick: () => { more = !more; drawChips(); } }, more ? tr('Weniger anzeigen') : tr('Weitere …')),
            h('button', { class: 'chip add', type: 'button', onclick: () => addUnit((cu, bi) => {
                if (bi >= 0) { drawChips(); if (st.u !== bi) pick(bi, ''); return; }
                drawChips(); if (st.cu !== cu) pick(-1, cu);
            }) }, tr('+ Einheit')),
            look.units.length > 0 && h('button', { class: 'chip add', type: 'button', onclick: () => manageUnits((u, old) => {
                if (old && st.cu === old) st.cu = u;   // die gewählte Einheit umbenannt oder gelöscht
                drawChips();
            }) }, tr('✎ Bearbeiten')));
        show(true);
    };
    const minus = h('button', { class: 'qbtn', type: 'button', 'aria-label': tr('Weniger') }, '−');
    const plus = h('button', { class: 'qbtn', type: 'button', 'aria-label': tr('Mehr') }, '+');
    // ½ dazu oder wieder weg: aus 2 wird 2½ und zurück. Steht noch die 1 vom Anfang da, gibt es ein schlichtes ½.
    const half = h('button', { class: 'qbtn half', type: 'button', 'aria-label': tr('Halbe dazu'), onclick: () => {
        const w = Math.floor(st.n + 1e-9);
        st.n = auto ? .5 : Math.abs(st.n - w - .5) < 1e-9 ? w : w + .5;
        auto = false;
        show(true);
    } }, '½');
    function show(writeNum) {
        if (writeNum) num.value = st.n ? fmtNum(st.n, lang, true) : '';
        minus.disabled = !st.n;
        half.setAttribute('aria-pressed', String(!auto && Math.abs(st.n % 1 - .5) < 1e-9));
        for (const { b, u, cu } of chips) {
            const sel = cu ? st.cu === cu : u === st.u;
            b.classList.toggle('sel', sel);
            b.setAttribute('aria-pressed', String(sel));
            b.textContent = cu ? cuName(cu, sel ? st.n : 1) : unitName(u, sel ? st.n : 1, lang);
        }
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
            h('div', { class: 'qrow' }, minus, num, plus, half),
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
/** Eine Kachel. note ist die gespeicherte Menge: Menge (tt) und Hinweis (th) bekommen je eine eigene Zeile. ago: „vor 3 Tagen“ (ta). */
function tile(cls, data, name, note, by, ago) {
    const p = noteParts(note);
    return h('button', { class: 'tile ' + cls, type: 'button', data }, h('span', { class: 'tn' }, name),
        p.q && h('span', { class: p.cnt ? 'tt cnt' : 'tt' }, p.q), p.hint && h('span', { class: 'th' }, p.hint), by && h('span', { class: 'tb' }, by),
        ago && h('span', { class: 'ta' }, ago));
}
/** Produkt aus Katalog, Suche oder „Bald wieder fällig“. Was in den letzten zwei Wochen gekauft wurde, sagt es dazu (always: egal wie lange her),
    was gerade abgehakt auf der Liste steht, sagt „abgehakt“. */
const prodTile = (n, c, src, always) => {
    const it = itemByName(n), u = !it && usageOf(n), d = u ? daysAgo(u.last) : 99;
    return tile(it ? 'has' : '', { k: 'prod', n, c, src: src || '' }, dn(n), it ? it.note : memOf(n), '',
        !it && inBasket(n) ? tr('abgehakt') : u && (always || d < 14) ? agoText(d, true) : '');
};

/* ---------- Gekauft: wann zuletzt, und was bald wieder fällig ist ---------- */
const DAY = 86400;
let usageFor = null, usageMap = new Map();
const usageOf = n => {
    if (!L) return null;
    if (L.usage !== usageFor) { usageFor = L.usage; usageMap = new Map(L.usage.map(u => [low(u.n), u])); }
    return usageMap.get(low(n)) || null;
};
/** Wie viele Kalendertage her: heute 0, gestern 1 */
const daysAgo = ts => { const a = new Date(ts * 1000), b = new Date(); a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0); return Math.max(0, Math.round((b - a) / 864e5)); };
/** „heute gekauft“ (Kachel, short) bzw. „heute“, dann „gestern“, „vor 3 Tagen“ */
const agoText = (d, short) => d === 0 ? tr(short ? 'heute gekauft' : 'heute') : d === 1 ? tr(short ? 'gestern gekauft' : 'gestern') : tr('vor {0} Tagen', d);
/** Ist es wieder so weit? Seit dem letzten Kauf sind 90 % des üblichen Abstands vorbei, aber noch nicht das Dreifache (dann kauft ihr es wohl nicht mehr). */
const dueNow = (u, now) => u.g >= DAY / 2 && now - u.last >= u.g * .9 && now - u.last <= u.g * 3;
/** Bald wieder fällig: ab dem eingestellten Kauf (look.dn, Standard 2, also nach einem gelernten Abstand). Am meisten überfällig zuerst. */
function dueList() {
    if (!look.due || !L) return [];
    const now = Date.now() / 1000;
    return L.usage.filter(u => u.gn >= look.dn - 1 && dueNow(u, now) && !itemByName(u.n) && !inBasket(u.n))
        .sort((a, b) => (now - b.last) / b.g - (now - a.last) / a.g);
}
/** So viele zeigt „Bald wieder fällig“, der Rest kommt mit „Alle anzeigen“ */
const DUE_MAX = 16;
/**
 * Regelmäßig Gekauftes automatisch auf die Liste: seit look.auto Tagen im gleichen Abstand gekauft (rs, mindestens drei Käufe) und wieder fällig.
 * Pro Kauf nur einmal (am), wer es wieder löscht, bekommt es erst nach dem nächsten Kauf wieder. Pro Produkt abschaltbar (am = -1).
 */
function autoAdd() {
    if (!L || !S || !look.auto || !cur) return;
    const now = Date.now() / 1000;
    const due = L.usage.filter(u => u.gn >= 2 && (u.am || 0) >= 0 && u.am !== u.last && u.rs > 0 && u.last - u.rs >= look.auto * DAY - DAY / 2
        && dueNow(u, now) && !itemByName(u.n) && !inBasket(u.n));
    if (!due.length) return;
    op(due.map(u => ({ t: 'auto', uid: newUid(), n: u.n, c: hasCat(u.c) ? u.c : 0, note: memOf(u.n) })));
    toast(tr('Automatisch auf die Liste: {0}', due.map(u => dn(u.n)).join(', ')));
}

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
    if (swipeBusy) { renderLater = true; return; }   // nicht unter dem Finger wegziehen, kommt nach dem Wischen
    renderLater = false;
    if (gest) { stopHold(); gest = null; }   // die Kachel unter dem Finger wird gleich ersetzt: Halten gilt nicht mehr
    const q = norm(qInput.value.trim());
    main.replaceChildren(...(q ? viewSearch(q) : [demoBanner(), helpHint(), ...viewHome(l), demoFoot()].filter(Boolean)));
    if (!q) setTimeout(autoAdd, 0);   // regelmäßig Gekauftes von allein auf die Liste, sobald es fällig ist (nicht mitten im Zeichnen)
}
setInterval(() => { if (!document.hidden) render(); }, 15 * 60 * 1000);   // fällig wird es auch, während Kaufen offen ist

function viewHome(l) {
    const out = [];
    const order = catOrder();
    const shared = l.members.length > 1;
    const todo = openItems(), bask = basketItems();
    out.push(h('h2', null, tr('Noch zu kaufen'), h('small', null, todo.length ? String(todo.length) : '')));
    if (!todo.length && bask.length) out.push(h('p', { class: 'hint' }, tr('Alles abgehakt. Wenn du fertig bist, tippe unten auf „Einkauf fertig“.')));
    // Leere Liste: ein großer Haken statt eines grauen Satzes
    if (!todo.length && !bask.length) out.push(h('div', { class: 'empty' }, h('div', { class: 'ebig' }, icon(I.check)),
        h('b', null, tr('Alles erledigt')), h('p', null, tr('Tippe unten auf ein Produkt oder such oben danach, dann landet es hier.'))));
    // Abgehaktes bleibt an seinem Platz stehen, mit Haken und durchgestrichen, bis „Einkauf fertig“
    const groups = new Map(order.map(id => [id, []]));
    for (const it of L.items) groups.get(hasCat(it.c) ? it.c : 0).push(it);
    const secs = [];
    for (const [id, items] of groups) {
        if (!items.length) continue;
        items.sort((x, y) => dn(x.n).localeCompare(dn(y.n), lang));   // innerhalb der Warengruppe alphabetisch, wie bei der Auswahl unten
        const left = items.filter(it => !it.got).length;   // rechts an der Überschrift: wie viel hier noch fehlt, ✓ wenn alles abgehakt ist
        secs.push(h('div', { class: 'sec' }, h('div', { class: 'grp' }, catIcon(id), h('span', { class: 'gn' }, catName(id)),
                h('span', { class: 'gc' + (left ? '' : ' done'), 'aria-label': left ? tr('{0} offen', left) : tr('Alles abgehakt') }, left ? String(left) : '✓')),
            h('div', { class: 'grid todo' }, items.map(it => it.got ? gotTile(it) : tile('on', { k: 'item', uid: it.uid }, dn(it.n), it.note, shared && look.who && it.by !== S.me.id && userName(it.by))))));
    }
    if (secs.length) out.push(h('div', { class: 'secs' }, secs));
    // „Einkauf fertig“ nimmt alles Abgehakte von der Liste
    if (bask.length) out.push(finishButton(bask.length, todo.length));

    const open = LS.get('open', {});
    // Bald wieder fällig: von Anfang an aufgeklappt, zuklappen wird gemerkt. Bis zu DUE_MAX, „Alle anzeigen“ klappt den Rest auf (gemerkt pro Gerät).
    const due = dueList();
    if (due.length) {
        const isOpen = open.due !== 0, all = LS.get('dueAll', false);
        out.push(h('button', { class: 'cat solo due' + (isOpen ? ' open' : ''), type: 'button', data: { k: 'cat', id: 'due' }, 'aria-expanded': String(isOpen) }, tr('Bald wieder fällig'), h('small', null, String(due.length)), icon(I.down)));
        if (isOpen) {
            out.push(h('div', { class: 'grid' }, (all ? due : due.slice(0, DUE_MAX)).map(u => prodTile(u.n, hasCat(u.c) ? u.c : 0, 'due', true))));
            if (due.length > DUE_MAX) out.push(h('button', { class: 'btn wide duemore', type: 'button', onclick: () => { LS.set('dueAll', !all); render(); } },
                all ? tr('Weniger anzeigen') : tr('Alle anzeigen ({0})', due.length)));
        }
    }

    out.push(h('h2', null, tr('Katalog')));
    if (!S.catalog.cats.length) out.push(h('p', { class: 'hint' }, tr('Der Katalog ist leer. Über die Suche oben kannst du trotzdem alles auf die Liste setzen. Unter Menü → Katalog verwalten lassen sich Warengruppen anlegen oder der Standard zurückholen.')));
    const byCat = prodsByCat();
    for (const id of order) {
        if (!id) continue;
        const prods = byCat.get(id) || [];
        const isOpen = !!open[id];
        out.push(h('button', { class: 'cat' + (isOpen ? ' open' : ''), type: 'button', data: { k: 'cat', id }, 'aria-expanded': String(isOpen) }, catIcon(id), h('span', { class: 'cn' }, catName(id)), h('small', null, String(prods.length)), icon(I.down)));
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

/** Vorschau für mehrere Produkte auf einmal: so kommen sie auf die Liste, Enter oder der Knopf setzt sie drauf */
function viewMulti(m) {
    const extra = x => itemByName(x.n) ? tr('steht schon drauf') : x.known ? '' : tr('neu: {0}', catName(x.c));
    return [h('h2', null, tr('Auf die Liste'), h('small', null, String(m.length))),
        h('div', { class: 'grid todo' }, m.map(x => tile('on', { k: 'mx' }, dn(x.n), x.note, '', extra(x)))),
        h('button', { class: 'btn primary multigo', type: 'button', onclick: () => addMulti(m) }, m.length === 1 ? tr('Auf die Liste') : tr('Alle {0} auf die Liste', m.length)),
        h('p', { class: 'info' }, tr('Enter tut dasselbe. Getrennt wird an Komma, „und“ oder Zeilenende, Mengen dürfen davor oder dahinter stehen: „2 Liter Milch, Äpfel 1 kg und ein halbes Brot“.'))];
}

function viewSearch(q) {
    const m = multiOf(qInput.value.trim());
    if (m) return viewMulti(m);
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

/* ---------- Mehrere Produkte auf einmal: „Milch, 2 kg Äpfel und ein halbes Brot“, auch diktiert ohne Kommas („Milch Brot Äpfel Sahne“).
   Getrennt wird an Komma, Semikolon, Zeilenende, „und“, „sowie“, „&“, „+“. Steht nichts dazwischen, zerlegt der Katalog die Wörter.
   Mengen vorne oder hinten, in Ziffern oder Worten: „zwei Liter Milch“, „Äpfel 2 kg“, „3x Joghurt“, „ein halbes Brot“. ---------- */
const NUMW = { ein: 1, eine: 1, einen: 1, eins: 1, zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, elf: 11, 'zwölf': 12,
    zwanzig: 20, halb: .5, halbe: .5, halben: .5, halbes: .5, anderthalb: 1.5, eineinhalb: 1.5, zweieinhalb: 2.5, dreieinhalb: 3.5,
    a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, half: .5 };
// Andere Schreibweisen für die mitgelieferten Einheiten
const UNITA = { kilo: 'kg', kilos: 'kg', kilogramm: 'kg', gramm: 'g', gr: 'g', l: 'Liter', ltr: 'Liter', litre: 'Liter', litres: 'Liter', 'päckchen': 'Packung',
    pkg: 'Packung', pck: 'Packung', stk: 'Stück', 'stücke': 'Stück', milliliter: 'ml' };
// Gebinde ohne eingebaute Einheit: bleiben als Text stehen („2 Eimer“)
const FREEU = /^(?:pakete?|töpfe?|topf|eimer|riegel|boxes|box)$/i;
/** Menge ab Wort i: Zahl (Ziffern, Bruch, Zahlwort) und vielleicht eine Einheit oder „x“. Liefert { n, u, cu, len } oder null. */
function readQty(t, i) {
    let n = NaN, len = 0;
    if (t[i + 1] && /^\d+$/.test(t[i]) && /^(?:[½¼¾]|1\/[24]|3\/4)$/.test(t[i + 1])) { n = parseNum(t[i] + ' ' + t[i + 1]); len = 2; }   // „2 1/2“
    else if (t[i] && !isNaN(parseNum(t[i]))) { n = parseNum(t[i]); len = 1; }
    else if (t[i] && low(t[i]) in NUMW) {
        n = NUMW[low(t[i])]; len = 1;
        if (n === 1 && t[i + 1] && /^halb/i.test(t[i + 1])) { n = .5; len = 2; }   // „ein halbes“
    }
    if (!(n > 0 && n <= 9999)) return null;
    if (n === .5 && /^(?:a|an)$/i.test(t[i + len] || '')) len++;   // „half a bread“
    const w = t[i + len];
    let r = { n, u: -1, cu: '', len };
    if (w) {
        const al = UNITA[low(w)], u = unitIndex(al || w), cu = cuFind(w);
        if (u >= 0) r = { n, u, cu: '', len: len + 1 };
        else if (cu || FREEU.test(w)) r = { n, u: -1, cu: cu || w, len: len + 1 };
        else if (/^(?:x|×|mal)$/i.test(w)) r = { n, u: -1, cu: '', len: len + 1 };
    }
    if (r.len > len && /^of$/i.test(t[i + r.len] || '')) r.len++;   // „2 kg of apples“
    return r;
}
/** Alle bekannten Namen (Katalog in beiden Sprachen, Liste, Gekauftes) zum schnellen Nachschlagen, neu gebaut, wenn sich etwas ändert */
let knownFor = [], knownMap = new Map();
function findProd(name) {
    if (knownFor[0] !== S.catalog || knownFor[1] !== L.usage || knownFor[2] !== L.items) {
        knownFor = [S.catalog, L.usage, L.items];
        knownMap = new Map();
        const put = (n, c) => { for (const k of [n, dn(n), enName(n)]) if (k && !knownMap.has(norm(k))) knownMap.set(norm(k), { n, c }); };
        for (const p of S.catalog.products) put(p.n, p.c);
        for (const x of [...L.items, ...L.usage]) put(x.n, hasCat(x.c) ? x.c : 0);
    }
    const q = norm(name).replace(/\s+/g, ' ').trim();
    if (q.length < 2) return null;
    // auch Einzahl und Mehrzahl: Tomate findet Tomaten, Eier findet Eier
    for (const v of [q, q + 'n', q + 'e', q + 's', q + 'en', q.replace(/(?:en|n|e|s)$/, '')]) { const p = knownMap.get(v); if (p) return p; }
    return null;
}
/** Ein Stück Text ohne Trennzeichen: Menge vorne oder hinten abziehen, Rest ist der Name. Kennt der Katalog den Namen nicht und sind es
    mehrere Wörter, wird probiert, ob sie sich in bekannte Produkte zerlegen lassen („Milch Brot Äpfel“). */
function parsePiece(seg) {
    const t = seg.split(' ').filter(Boolean);
    if (!t.length) return [];
    let q = readQty(t, 0), a = q ? q.len : 0, b = t.length;
    if (!q) for (let j = t.length - 1; j > 0; j--) {   // Menge hinten: „Äpfel 2 kg“, „Joghurt x3“
        if (/^(?:größe|gr|size|nr|no|typ|stufe|grösse)\.?$/i.test(t[j - 1])) break;   // „Windeln Größe 4“: die Zahl gehört zum Namen
        const x = /^(?:x|×)$/i.test(t[j]) ? readQty(t, j + 1) : readQty(t, j), off = /^(?:x|×)$/i.test(t[j]) ? 1 : 0;
        if (x && j + off + x.len === t.length) { q = x; b = j; break; }
    }
    const name = t.slice(a, b).join(' ');
    if (!name) return [];
    if (findProd(name) || b - a < 2) return [{ name, q }];
    // Zerlegen: jedes Stück ein bekanntes Produkt (bis 4 Wörter, Menge davor erlaubt) oder ein einzelnes unbekanntes Wort
    const memo = new Map();
    const go = i => {
        if (i === t.length) return { s: 0, k: 0, u: 0, parts: [] };
        if (memo.has(i)) return memo.get(i);
        let best = null;
        const qq = readQty(t, i), j0 = i + (qq ? qq.len : 0);
        for (let j = Math.min(t.length, j0 + 4); j > j0; j--) {
            const nm = t.slice(j0, j).join(' '), known = !!findProd(nm);
            if (!known && j > j0 + 1) continue;
            const rest = go(j);
            if (!rest) continue;
            const s = rest.s + (known ? 3 : -1);
            if (!best || s > best.s) best = { s, k: rest.k + known, u: rest.u + !known, parts: [{ name: nm, q: qq }, ...rest.parts] };
        }
        memo.set(i, best);
        return best;
    };
    const best = go(0);
    return best && best.k >= 2 && best.u <= best.k ? best.parts : [{ name, q }];
}
/** Text aus dem Suchfeld in Einträge zerlegen: [{ n, c, note, known }]. Gleiche Produkte nur einmal, das letzte gewinnt. */
function parseMulti(raw) {
    const s = String(raw).replace(/(\d),(\d)/g, '$1\u0001$2').replace(/(\d)([a-zäöüß×])/gi, '$1 $2').replace(/\bx(\d)/gi, 'x $1');
    const out = new Map();
    for (let piece of s.split(/[,;\n]+/)) {
        piece = piece.replace(/\u0001/g, ',').replace(/[.!?:]+$/g, '').replace(/\s+/g, ' ').trim();
        if (!piece) continue;
        // an „und“ nur trennen, wenn das Ganze kein bekanntes Produkt ist („Erbsen und Möhren“)
        const segs = findProd(piece) ? [piece] : piece.split(/\s+(?:und|sowie|and|plus)\s+|\s*[&+]\s*/i);
        for (const seg of segs) for (const { name, q } of parsePiece(seg.trim())) {
            const x = entryOf(name, q && !(q.n === 1 && q.u < 0 && !q.cu) ? fmtQty(q, 'de', '') : '');
            out.delete(low(x.n));
            out.set(low(x.n), x);
        }
    }
    return [...out.values()];
}
/** Ein Eintrag für die Vorschau: Name wie im Katalog (oder groß geschrieben, wie getippt), Warengruppe bekannt oder geraten */
function entryOf(name, note) {
    const p = findProd(name);
    const nm = p ? p.n : canon(name.charAt(0).toLocaleUpperCase(lang) + name.slice(1)).slice(0, 60);
    return { n: nm, c: p ? p.c : guessCat(nm), note, known: !!p };
}
/** Lohnt sich die Vorschau? Ab zwei Produkten, oder bei einem mit Menge („2 Liter Milch“). */
const multiOf = raw => { const m = parseMulti(raw); return m.length >= 2 || (m.length === 1 && m[0].note) ? m : null; };
/** Alles auf einmal auf die Liste. Was schon draufsteht, bekommt nur die neue Menge. Rückgängig nimmt die neuen wieder runter. */
function addMulti(m) {
    const fresh = [];
    const ops = m.map(x => {
        const o = { t: 'add', uid: newUid(), n: x.n, c: x.c, note: x.note || memOf(x.n) };
        if (!itemByName(x.n)) fresh.push(o.uid);
        return o;
    });
    op(ops);
    qInput.value = '';
    qInput.blur();
    render();
    toast(tr('{0} Produkte auf der Liste', m.length), fresh.length ? tr('Rückgängig') : null, () => op(fresh.map(uid => ({ t: 'remove', uid }))));
}

/** Warengruppe für ein neues Produkt raten. Deutsche Wörter tragen ihre Bedeutung hinten: Bergkäse wie Käse, Dinkelbrötchen wie Brötchen,
    Hundefutter wie Katzenfutter. Verglichen wird mit allen Produkten im Katalog (deutsch und englisch), Wort für Wort von hinten:
    erst das letzte Wort, passt das nirgends hin, das davor („Windeln Größe 4“). Ein ganzes Katalogwort am Ende zählt doppelt,
    ein bloß gleiches Wortende (ab 5 Buchstaben) nur, wenn mindestens zwei Produkte derselben Gruppe so enden. Namen aus mehreren
    Wörtern („Gehackte Tomaten“) zählen halb. Gewinnt keine Gruppe klar (mindestens die Hälfte der Stimmen), bleibt es bei 0. */
function guessCat(name) {
    const words = s => norm(s).split(/[\s-]+/).filter(x => /^[a-z]{3,}$/.test(x));
    const cands = [];
    for (const p of S.catalog.products) for (const pn of [p.n, enName(p.n)]) {
        const pw = pn && words(pn).pop();
        if (pw) cands.push([pw, p.c, /\s/.test(pn.trim()) ? .5 : 1]);
    }
    for (const w of words(name).reverse()) {
        const votes = new Map();
        let total = 0;
        for (const [pw, c, f] of cands) {
            if (pw === w) return c;   // gleiches Wort: „Bio Milch“ ist Milch
            let k = 0;
            while (k < w.length && k < pw.length && w[w.length - 1 - k] === pw[pw.length - 1 - k]) k++;
            const whole = k === pw.length;
            if (!(whole && k >= 3) && k < 5) continue;
            const v = votes.get(c) || { s: 0, whole: 0, part: 0 };
            v.s += k * k * (whole ? 2 : 1) * f;
            if (whole) v.whole++; else v.part++;
            votes.set(c, v);
            total += k * k * (whole ? 2 : 1) * f;
        }
        let best = 0, bv = null;
        for (const [c, v] of votes) if (!bv || v.s > bv.s) { best = c; bv = v; }
        if (bv && bv.s >= total * .5 && (bv.whole || bv.part >= 2)) return best;
    }
    return 0;
}

/* ---------- Tippen, wischen und lange halten ---------- */
/** Antippen in der Liste: abgehakt, es bleibt durchgestrichen an seinem Platz.
    Das Zurückholen braucht zwei Tipps innerhalb von ARM_MS: der erste macht den Eintrag scharf, erst der zweite holt ihn zurück.
    So holt ein Tipp aus Versehen (etwa beim Rollen im Laden) nichts wieder auf die Liste. */
const ARM_MS = 2000;
let armUid = '', armTimer = 0;
/** Gerade abgehakt: für die kleine Animation (Strich zieht sich durch, Kreis hüpft). Wird die Liste währenddessen neu gezeichnet, läuft sie dort weiter, wo sie war. */
let justGot = null;
const JUST_MS = 450;
function tapItem(uid) { if (L.items.some(i => i.uid === uid && !i.got)) { disarm(); justGot = { uid, t: Date.now() }; op({ t: 'got', uid }); } }
function tapGot(uid) {
    const it = L.items.find(i => i.uid === uid && i.got);
    if (!it) return;
    if (armUid !== uid) {
        disarm();
        armUid = uid;
        for (const t of main.querySelectorAll('.tile[data-k="got"]')) if (t.dataset.uid === uid) t.classList.add('arm');
        armTimer = setTimeout(disarm, ARM_MS);
        if (navigator.vibrate) navigator.vibrate(10);
        toast(tr('Nochmal tippen, dann ist {0} wieder auf der Liste', dn(it.n)), null, null, ARM_MS);
        return;
    }
    disarm();
    op({ t: 'ungot', uid });
}
function disarm() {
    clearTimeout(armTimer);
    armUid = '';
    for (const t of main.querySelectorAll('.tile.arm')) t.classList.remove('arm');
}
/** Ein abgehakter Eintrag, an seinem Platz durchgestrichen */
function gotTile(it) {
    const t = tile('got' + (armUid === it.uid ? ' arm' : ''), { k: 'got', uid: it.uid }, dn(it.n), it.note);
    const ms = justGot && justGot.uid === it.uid ? Date.now() - justGot.t : JUST_MS;
    if (ms < JUST_MS) { t.classList.add('justgot'); t.style.setProperty('--jd', -ms + 'ms'); }
    return t;
}
/** Ganz von der Liste löschen, ein paar Sekunden lang mit „Rückgängig“ */
function delItem(it) {
    op({ t: 'remove', uid: it.uid });
    toast(tr('{0} gelöscht', dn(it.n)), tr('Rückgängig'), () => op({ t: 'back', uid: it.uid, n: it.n, c: it.c, note: it.note, by: it.by, at: it.at, got: it.got || 0 }));
}
let finishPct = null;   // zuletzt gezeigter Fortschritt
/** Der Knopf „Einkauf fertig“ unter der Liste: in der Farbe des Designs mit Fortschritt, grün, sobald alles abgehakt ist */
function finishButton(got, left) {
    const all = !left, pct = Math.floor(got / (got + left) * 100);
    // Breite per Skript, nicht als style-Attribut: das verbietet die Content-Security-Policy (style-src 'self')
    // Er wächst vom letzten Stand aus weiter, so sieht man beim Abhaken, wie es vorangeht
    const fill = h('i');
    fill.style.width = (finishPct == null ? pct : finishPct) + '%';
    if (finishPct != null && finishPct !== pct) requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = pct + '%'; }));
    finishPct = pct;
    return h('button', { class: 'finishbtn' + (all ? ' all' : ''), type: 'button', onclick: finishShopping },
        h('span', { class: 'fi' }, icon(all ? I.check : I.cart)),
        h('span', { class: 'ft' },
            h('b', null, all ? tr('Alles abgehakt, Einkauf fertig') : tr('Einkauf fertig')),
            h('small', null, all ? (got === 1 ? tr('1 Sache im Wagen') : tr('{0} Sachen im Wagen', got)) : tr('{0} von {1} abgehakt', got, got + left)),
            !all && h('span', { class: 'fbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct) }, fill)));
}
/** „Einkauf fertig“: ein eigenes Fenster fragt nach, zeigt was gekauft ist und was bleibt. Erst dann geht das Abgehakte von der Liste und zählt als gekauft. */
function finishShopping() {
    const bask = basketItems(), left = openItems().length, all = !left;
    if (!bask.length) return;
    const sh = sheet(tr('Einkauf abschließen'));
    const MAX = 12, names = bask.map(it => dn(it.n)).sort((a, b) => a.localeCompare(b, lang));
    const done = () => {
        const now = basketItems();
        sh.close();
        if (now.length) { op(now.map(it => ({ t: 'buy', uid: it.uid }))); toast(now.length === 1 ? tr('Einkauf abgeschlossen, 1 Sache gekauft') : tr('Einkauf abgeschlossen, {0} Sachen gekauft', now.length)); }
    };
    put(sh.body, h('div', { class: 'finishdlg' + (all ? ' all' : '') },
        h('div', { class: 'fbig' }, icon(all ? I.check : I.cart)),
        h('p', { class: 'flead' }, all ? tr('Alles erledigt, prima!') : tr('{0} von {1} abgehakt', bask.length, bask.length + left)),
        h('p', { class: 'info' }, tr('Das Abgehakte kommt von der Liste und zählt als gekauft:')),
        h('div', { class: 'chips' }, names.slice(0, MAX).map(n => h('span', { class: 'chip got' }, n)),
            names.length > MAX && h('span', { class: 'chip' }, tr('und {0} weitere', names.length - MAX))),
        left > 0 && h('p', { class: 'info fleft' }, left === 1 ? tr('Das eine, was noch zu kaufen ist, bleibt drauf.') : tr('Die {0} Sachen, die noch zu kaufen sind, bleiben drauf.', left)),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => sh.close() }, tr('Noch nicht')),
            h('button', { class: 'btn fok', type: 'button', onclick: done }, icon(I.check), tr('Ja, Einkauf abschließen')))));
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
     { label: tr('Von der Liste nehmen'), danger: true, fn: () => delItem(it) }]);
}
/** Lange halten auf einem Eintrag: schnell die Warengruppe wechseln, nur für diesen Eintrag (Pflaumen im Glas zu den Konserven)
    oder auf Wunsch auch im Katalog. Eine neue Warengruppe lässt sich gleich hier anlegen. Dazu Menge und Löschen für alle ohne Wischen. */
function catMenu(it) {
    const cur = hasCat(it.c) ? it.c : 0;
    const prod = S.catalog.products.find(p => low(p.n) === low(it.n));
    const keep = prod && h('input', { type: 'checkbox' });
    const sh = sheet(dn(it.n));
    const move = c => {
        sh.close();
        if (c !== cur) op({ t: 'edit', uid: it.uid, note: it.note, c });
        if (keep && keep.checked && c && c !== prod.c) act('prod_edit', { id: prod.id, name: prod.n, cat: c }).catch(e => toast(e.message));
    };
    const newCat = () => ask(tr('Neue Warengruppe'), [{ k: 'name', label: tr('Name'), max: 60 }], tr('Anlegen'), async v => {
        const name = canonC(v.name.trim().replace(/\s+/g, ' '));
        if (!name) throw new Error(tr('Bitte einen Namen eingeben.'));
        const old = S.catalog.cats.find(x => low(x.n) === low(name));
        if (!old) await act('cat_add', { name });
        const c = old || S.catalog.cats.find(x => low(x.n) === low(name));
        if (c) move(c.id);
    });
    put(sh.body,
        h('div', { class: 'qlabel' }, tr('Warengruppe')),
        h('div', { class: 'chips catpick' }, catOrder().map(id => h('button', { class: 'chip' + (id === cur ? ' sel' : ''), type: 'button', onclick: () => move(id) }, catName(id))),
            h('button', { class: 'chip add', type: 'button', onclick: newCat }, tr('+ Neue Warengruppe'))),
        keep && h('label', { class: 'check' }, keep, h('span', null, tr('Auch im Katalog ändern, dann gilt es immer'))),
        h('div', { class: 'btns' },
            // regelmäßig Gekauftes: hier lässt sich das automatische Draufsetzen abschalten, gerade wenn es eben von allein kam
            autoOpts(usageOf(it.n)).map(x => h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); x.fn(); } }, x.label)),
            h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); itemDialog(it); } }, tr('Menge …')),
            h('button', { class: 'btn danger', type: 'button', onclick: () => { sh.close(); delItem(it); } }, tr('Löschen'))));
}
function prodDialog(n, c, src) {
    const it = itemByName(n);
    if (it) return itemDialog(it);
    const u = usageOf(n);
    // Zuletzt gekauft, wie oft, und wenn schon gelernt: etwa wie oft
    const info = u && [tr('Zuletzt gekauft: {0} ({1})', agoText(daysAgo(u.last)), new Date(u.last * 1000).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' })),
        u.cnt > 1 && tr('Insgesamt {0}-mal gekauft', u.cnt), u.g >= DAY / 2 && u.gn !== 0 && tr('Etwa alle {0} Tage', Math.max(1, Math.round(u.g / DAY)))].filter(Boolean).join(' · ');
    ask(dn(n), [{ k: 'note', type: 'qty', value: memOf(n) }, info && { type: 'info', text: info }],
        tr('Auf die Liste'), v => op({ t: 'add', uid: newUid(), n, c, note: v.note.trim() }),
        [u && u.gn >= look.dn - 1 && look.due && { label: tr('Nicht mehr als fällig vorschlagen'), fn: () => op({ t: 'nodue', n }) },
         u && u.gn < 0 && look.due && { label: tr('Wieder als fällig vorschlagen'), fn: () => op({ t: 'redue', n }) },
         ...autoOpts(u),
         memOf(n) && { label: tr('Gemerkte Menge vergessen'), fn: () => op({ t: 'unmem', n }) }]);
}
/** Automatisch auf die Liste: für dieses Produkt abschalten oder wieder an. Erst, wenn es dafür überhaupt in Frage kommt (ein gelernter Abstand). */
function autoOpts(u) {
    if (!u || !look.auto || u.gn === 0) return [];
    return [(u.am || 0) >= 0 ? { label: tr('Nicht automatisch auf die Liste setzen'), fn: () => op({ t: 'noauto', n: u.n }) }
        : { label: tr('Wieder automatisch auf die Liste setzen'), fn: () => op({ t: 'reauto', n: u.n }) }];
}
/** Neues Produkt aus der Suche oder aus einer Warengruppe heraus */
function newProduct(name, catId) {
    const cats = S.catalog.cats;
    ask(tr('Neues Produkt'), [
        { k: 'n', label: tr('Name'), value: name, max: 60 },
        { k: 'note', type: 'qty' },
        { k: 'c', label: tr('Warengruppe'), type: 'select', value: catId || (name ? guessCat(canon(name)) : 0), options: catOptions() },   // geraten am Wortende
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

/* Gesten. Auf Einträgen der Liste, auch abgehakten: Finger drauf und nach links wischen löscht, nach rechts öffnet die Menge,
   still liegen lassen (LP_ITEM) öffnet das Menü für die Warengruppe. Auf Produkten im Katalog öffnet kurzes Halten (LP_PROD) die Menge.
   Am Rechner: mit der Maus ziehen geht genauso, Rechtsklick statt Halten. */
const LP_ITEM = 1000, LP_PROD = 500;
let lpTimer = 0, holdTimer = 0, lpFired = false, gest = null, swipeG = null, swipeBusy = false, renderLater = false, ghostUntil = 0;
/* Nach dem langen Halten kann beim Loslassen noch ein Tipp kommen. Der landet sonst im gerade geöffneten Menü und wählt dort etwas aus. */
document.addEventListener('click', e => { if (Date.now() < ghostUntil) { e.stopPropagation(); e.preventDefault(); } }, true);
for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { if (ghostUntil > Date.now()) ghostUntil = Date.now() + 350; }, true);
function detail(t) {
    const d = t.dataset;
    if (d.k === 'item' || d.k === 'got') { const it = L.items.find(i => i.uid === d.uid); if (it) catMenu(it); }
    else if (d.k === 'prod') prodDialog(d.n, +d.c, d.src);
}
/** Halten abbrechen, auch den Ring, der beim Halten um den Eintrag wächst */
function stopHold() {
    clearTimeout(lpTimer);
    clearTimeout(holdTimer);
    for (const t of main.querySelectorAll('.tile.holding')) t.classList.remove('holding');
}
/** Wischen beginnt: hinter dem Eintrag liegt ein Schild, links „Menge“, rechts rot „Löschen“. Ausgelöst wird ab gut einem Drittel der Breite. */
function swipeStart(g) {
    const t = g.t;
    g.swipe = true;
    lpFired = true;   // der Klick nach dem Loslassen zählt nicht als Antippen
    swipeBusy = true;
    swipeG = g;
    g.w = t.offsetWidth;
    g.th = Math.min(120, Math.max(56, g.w * .35));
    g.bg = h('div', { class: 'swipebg', 'aria-hidden': 'true' },
        h('span', { class: 'sw-qty' }, icon(I.edit), h('b', null, tr('Menge'))),
        h('span', { class: 'sw-del' }, icon(I.trash), h('b', null, tr('Löschen'))));
    Object.assign(g.bg.style, { left: t.offsetLeft + 'px', top: t.offsetTop + 'px', width: g.w + 'px', height: t.offsetHeight + 'px', borderRadius: getComputedStyle(t).borderRadius });
    t.parentElement.append(g.bg);
    t.classList.add('swiping');
    try { t.setPointerCapture(g.id); } catch (e) {}
}
function swipeMove(g, dx) {
    const x = Math.max(-g.w, Math.min(g.w, dx)), armed = Math.abs(x) >= g.th;
    g.dx = x;
    g.t.style.transform = 'translateX(' + x + 'px)';
    g.bg.dataset.dir = x < 0 ? 'del' : 'qty';
    if (armed !== !!g.armed) {
        g.armed = armed;
        g.bg.classList.toggle('armed', armed);
        if (armed && navigator.vibrate) navigator.vibrate(10);
    }
}
/** Loslassen: weit genug gewischt, dann löschen (der Eintrag fliegt raus) oder die Menge öffnen, sonst federt er zurück */
function swipeEnd(g, commit) {
    if (g.ending) return;
    g.ending = true;
    const t = g.t, it = L && L.items.find(i => i.uid === t.dataset.uid);
    const what = commit && g.armed && it ? (g.dx < 0 ? 'del' : 'qty') : '';
    t.style.transition = 'transform .18s ease-out, opacity .18s';
    t.style.transform = what === 'del' ? 'translateX(' + -g.w + 'px)' : '';
    if (what === 'del') t.style.opacity = '0';
    setTimeout(() => {
        g.bg.remove();
        t.classList.remove('swiping');
        t.style.transition = t.style.transform = t.style.opacity = '';
        swipeBusy = false;
        swipeG = null;
        if (what === 'del') delItem(it);
        else {
            if (renderLater) render();
            if (what === 'qty') itemDialog(it);
        }
    }, 190);
}
/** Ein Wischen, dessen Loslassen nie ankam (App im Hintergrund o. ä.), federt zurück, statt hängen zu bleiben */
const swipeAbort = () => { if (swipeG) swipeEnd(swipeG, false); };
document.addEventListener('visibilitychange', swipeAbort);
main.addEventListener('pointerdown', e => {
    if (swipeG && swipeG.id !== e.pointerId) swipeAbort();
    lpFired = false;
    stopHold();
    gest = null;
    const t = e.target.closest('.tile');
    if (!t || e.button > 0 || swipeBusy) return;
    const k = t.dataset.k, item = k === 'item' || k === 'got';
    gest = { t, id: e.pointerId, x: e.clientX, y: e.clientY, item, swipe: false, touch: e.pointerType !== 'mouse' };
    if (item) holdTimer = setTimeout(() => t.classList.add('holding'), 250);
    lpTimer = setTimeout(() => {
        lpFired = true;
        ghostUntil = Date.now() + 2500;   // bis der Finger losgelassen hat, siehe oben
        stopHold();
        gest = null;
        if (navigator.vibrate) navigator.vibrate(15);
        detail(t);
    }, item ? LP_ITEM : LP_PROD);
});
main.addEventListener('pointermove', e => {
    const g = gest;
    if (!g || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.swipe) {
        if (Math.hypot(dx, dy) <= 10) return;
        stopHold();
        if (!g.item || Math.abs(dx) < Math.abs(dy) * 1.3) { gest = null; return; }   // eher hoch oder runter: das ist Rollen
        swipeStart(g);
    }
    swipeMove(g, dx);
});
main.addEventListener('pointerup', e => {
    stopHold();
    const g = gest;
    gest = null;
    if (g && g.swipe) swipeEnd(g, e.pointerId === g.id);
});
main.addEventListener('pointercancel', () => {
    stopHold();
    const g = gest;
    gest = null;
    if (g && g.swipe) swipeEnd(g, false);
});
main.addEventListener('pointerleave', () => { if (!gest || !gest.swipe) stopHold(); });
main.addEventListener('contextmenu', e => {
    const t = e.target.closest('.tile');
    if (!t) return;
    e.preventDefault();
    if (gest && (gest.touch || gest.swipe)) return;   // am Handy zählt das eigene Halten, Android meldet sich schon nach einer halben Sekunde
    stopHold();
    gest = null;
    if (!lpFired) { lpFired = true; detail(t); }
});
main.addEventListener('click', e => {
    if (lpFired) { lpFired = false; return; }
    const t = e.target.closest('[data-k]');
    if (!t || !L) return;
    const d = t.dataset;
    if (d.k === 'item') tapItem(d.uid);
    else if (d.k === 'got') tapGot(d.uid);
    else if (d.k === 'prod') tapProd(d.n, +d.c);
    else if (d.k === 'new') newProduct(d.n, 0);
    else if (d.k === 'newin') newProduct('', +d.id);
    else if (d.k === 'cat') {
        const open = LS.get('open', {});
        if (d.id === 'due') open.due = open.due === 0 ? 1 : 0;   // „Bald wieder fällig“ ist von Anfang an offen
        else if (open[d.id]) delete open[d.id]; else open[d.id] = 1;
        LS.set('open', open);
        render();
    }
});
qInput.addEventListener('input', render);
$('#qClear').addEventListener('click', () => { qInput.value = ''; render(); });
qInput.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || !L) return;
    const m = multiOf(qInput.value.trim());   // mehrere auf einmal (oder eins mit Menge): alle drauf
    if (m) { e.preventDefault(); addMulti(m); return; }
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
        mine && !LOCAL && btn(tr('Teilen mit …'), () => shareList(l)),
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
        catIcon(id), h('span', { class: 'grow' }, catName(id)),
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
    const qIn = h('input', { type: 'search', placeholder: tr('Produkt suchen oder neu anlegen'), 'aria-label': tr('Produkt suchen'), autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'done',
        oninput: () => draw(),
        onkeydown: e => {   // Enter: gibt es das Gesuchte noch nicht, geht es direkt ins Anlegen
            if (e.key !== 'Enter') return;
            e.preventDefault();
            const name = qIn.value.trim().replace(/\s+/g, ' ');
            if (!name) return;
            const hit = S.catalog.products.find(p => norm(dn(p.n)) === norm(name) || norm(p.n) === norm(name));
            if (hit) editProd(hit); else addNew(name);
        } });
    const addNew = name => S.catalog.cats.length ? addProd(S.catalog.cats[0], name) : toast(tr('Leg zuerst eine Warengruppe an.'));
    const list = h('div');
    put(sh.body, h('div', { class: 'search csearch' }, qIn,
        h('button', { class: 'iconbtn', type: 'button', 'aria-label': tr('Suche leeren'), onclick: () => { qIn.value = ''; draw(); qIn.focus(); } }, icon(I.x))), list);
    function draw() {
        const byCat = prodsByCat();
        const q = norm(qIn.value.trim());
        if (q) {
            const groups = S.catalog.cats.map(c => [c, (byCat.get(c.id) || []).filter(p => norm(dn(p.n)).includes(q) || norm(p.n).includes(q))]).filter(g => g[1].length);
            const name = qIn.value.trim().replace(/\s+/g, ' ');
            const exact = S.catalog.products.some(p => norm(dn(p.n)) === q || norm(p.n) === q);
            fill(list,
                !groups.length && h('p', { class: 'hint' }, tr('Kein Produkt gefunden.')),
                groups.map(([c, prods]) => [
                    h('div', { class: 'mcat' }, h('h4', null, dc(c.n), h('span', { class: 'badge' }, String(prods.length)))),
                    h('div', { class: 'chips' }, prods.map(p => h('button', { class: 'chip', type: 'button', onclick: () => editProd(p) }, dn(p.n)))),
                ]),
                !exact && h('div', { class: 'btns' }, h('button', { class: 'btn small', type: 'button', onclick: () => addNew(name) }, tr('„{0}“ neu anlegen', name))));
            return;
        }
        fill(list,
            h('p', { class: 'info' }, tr('{0} Produkte in {1} Warengruppen. Der Katalog gilt für alle Listen und alle Konten. Tippe ein Produkt an, um es zu ändern oder zu löschen.', S.catalog.products.length, S.catalog.cats.length)),
            h('div', { class: 'btns' },
                h('button', { class: 'btn small', type: 'button', onclick: () => ask(tr('Neue Warengruppe'), [{ k: 'name', label: tr('Name'), max: 60 }], tr('Anlegen'), v => act('cat_add', { name: canonC(v.name.trim()) })) }, tr('+ Warengruppe')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: exportCatalog }, tr('Exportieren')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: importCatalog }, tr('Importieren')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: showBackups }, tr('Sicherungen')),
                S.me.admin && h('button', { class: 'btn small', type: 'button', onclick: () => confirmDlg(tr('Standard wiederherstellen'),
                    tr('Der ganze Katalog wird durch den mitgelieferten Standard ersetzt. Eigene Produkte und Warengruppen gehen dabei verloren. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.'),
                    tr('Standard wiederherstellen'), () => act('catalog_reset', {})) }, tr('Standard wiederherstellen')),
                S.me.admin && h('button', { class: 'btn small danger', type: 'button', onclick: () => confirmDlg(tr('Alles löschen'),
                    tr('Alle Produkte und Warengruppen werden gelöscht, der Katalog ist danach leer. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.'),
                    tr('Alles löschen'), () => act('catalog_clear', {})) }, tr('Alles löschen'))),
            S.catalog.cats.map(c => [
                h('div', { class: 'mcat' }, h('h4', null, iconEl(catIconOf(c)), dc(c.n), h('span', { class: 'badge' }, String((byCat.get(c.id) || []).length))),
                    h('button', { class: 'btn small', type: 'button', onclick: () => editCat(c, (byCat.get(c.id) || []).length) }, tr('Ändern'))),
                h('div', { class: 'chips' },
                    (byCat.get(c.id) || []).map(p => h('button', { class: 'chip', type: 'button', onclick: () => editProd(p) }, dn(p.n))),
                    h('button', { class: 'chip add', type: 'button', onclick: () => addProd(c) }, tr('+ Produkt'))),
            ]));
    }
    stateListeners.add(draw);
    draw();
}

/* ---------- Katalog exportieren und importieren (nur Administrator) ----------
   Eine Datei enthält immer beide Sprachen. CSV: Warengruppe;Category;Produkt;Product, eine Zeile pro Produkt.
   JSON: [{ de, en, products: [{ de, en }] }]. Die Reihenfolge der Warengruppen ist die der Datei. */
function catalogData() {
    const byCat = new Map();
    for (const p of S.catalog.products) (byCat.get(p.c) || byCat.set(p.c, []).get(p.c)).push(p);
    return S.catalog.cats.map(c => ({ de: c.n, en: enCat(c.n), products: (byCat.get(c.id) || []).map(p => ({ de: p.n, en: enName(p.n) })) }));
}
function download(name, text, type) {
    const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
function exportCatalog() {
    const sh = sheet(tr('Katalog exportieren'));
    const csvCell = s => /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    const go = kind => {
        const data = catalogData();
        if (kind === 'json') download('kaufen-katalog.json', JSON.stringify(data, null, 2), 'application/json');
        else {
            const rows = [['Warengruppe', 'Category', 'Produkt', 'Product']];
            for (const c of data) for (const p of c.products.length ? c.products : [{ de: '', en: '' }]) rows.push([c.de, c.en, p.de, p.en]);
            download('kaufen-katalog.csv', '\ufeff' + rows.map(r => r.map(csvCell).join(';')).join('\r\n') + '\r\n', 'text/csv;charset=utf-8');   // mit BOM, damit Excel die Umlaute richtig liest
        }
        sh.close();
    };
    put(sh.body,
        h('p', { class: 'info' }, tr('Die Datei enthält alle Warengruppen und Produkte auf Deutsch und Englisch. CSV lässt sich in Excel bearbeiten, JSON in jedem Texteditor. Beide Formate kannst du wieder importieren.')),
        h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => go('csv') }, 'CSV'), h('button', { class: 'btn', type: 'button', onclick: () => go('json') }, 'JSON')));
}
/** CSV in Zeilen und Zellen zerlegen. Trennzeichen ; oder , (was in der Kopfzeile öfter vorkommt), Anführungszeichen wie in Excel. */
function parseCsv(text) {
    const head = text.split(/\r?\n/, 1)[0];
    const sep = (head.match(/;/g) || []).length >= (head.match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQ) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') inQ = false;
            else cell += ch;
        } else if (ch === '"' && cell === '') inQ = true;
        else if (ch === sep) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); cell = ''; rows.push(row); row = [];
        } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows;
}
/** Dateiinhalt (CSV oder JSON) in die Form bringen, die der Server erwartet. Wirft einen Fehler, wenn nichts Brauchbares drin ist. */
function parseCatalogFile(text) {
    text = text.replace(/^\ufeff/, '');
    const clean = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').slice(0, 60);
    const cats = [], idx = new Map(), seen = new Set();
    const cat = (de, en) => {
        const k = low(de);
        if (!idx.has(k)) { idx.set(k, cats.length); cats.push({ name: de, en, products: [] }); }
        const c = cats[idx.get(k)];
        if (en && !c.en) c.en = en;
        return c;
    };
    const prod = (c, de, en) => { if (de && !seen.has(low(de))) { seen.add(low(de)); c.products.push({ de, en }); } };
    if (/^\s*[\[{]/.test(text)) {
        let data;
        try { data = JSON.parse(text); } catch (e) { throw new Error(tr('Die JSON-Datei ist fehlerhaft und lässt sich nicht lesen.')); }
        for (const g of Array.isArray(data) ? data : []) {
            const de = clean(g && (g.de || g.name));
            if (!de) continue;
            const c = cat(de, clean(g.en));
            for (const p of Array.isArray(g.products) ? g.products : []) typeof p === 'string' ? prod(c, clean(p), '') : p && prod(c, clean(p.de || p.name), clean(p.en));
        }
    } else {
        const rows = parseCsv(text).filter(r => r.some(x => x.trim()));
        if (rows.length && ['warengruppe', 'category'].includes(low(rows[0][0].trim()))) rows.shift();
        for (const r of rows) {
            const de = clean(r[0]);
            if (!de) continue;
            prod(cat(de, clean(r[1])), clean(r[2]), clean(r[3]));
        }
    }
    if (!cats.length) throw new Error(tr('Die Datei enthält keinen brauchbaren Katalog.'));
    return cats;
}
function importCatalog() {
    const inp = h('input', { type: 'file', accept: '.csv,.json,.txt,text/csv,application/json,text/plain', hidden: true, onchange: async () => {
        const f = inp.files[0];
        inp.remove();
        if (!f) return;
        try {
            if (f.size > 2e6) throw new Error(tr('Die Datei ist zu groß.'));
            const data = parseCatalogFile(await f.text());
            const n = data.reduce((s, c) => s + c.products.length, 0);
            confirmDlg(tr('Katalog importieren'),
                tr('Gefunden: {0} Produkte in {1} Warengruppen. Der ganze Katalog wird dadurch ersetzt. Vorher wird eine Sicherung angelegt, Einkaufslisten bleiben wie sie sind.', n, data.length),
                tr('Importieren'), () => act('catalog_import', { data }));
        } catch (e) { toast(e.message); }
    } });
    document.body.append(inp);
    inp.click();
}
const realCats = () => S.catalog.cats.map(c => [c.id, dc(c.n)]);
/* Auf Englisch zeigen die Felder den übersetzten Namen. Bleibt er unverändert, wird der gespeicherte (deutsche) Name behalten. */
function addProd(c, name) {
    ask(tr('Neues Produkt'), [{ k: 'name', label: tr('Name'), value: name || '', max: 60 }, { k: 'cat', label: tr('Warengruppe'), type: 'select', value: c.id, options: realCats() }],
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
        [{ label: tr('Symbol …'), fn: () => { catIconDialog(c); } },
         { label: tr('Löschen'), danger: true, fn: () => {
            confirmDlg(tr('Warengruppe löschen'), !count ? tr('„{0}“ wird gelöscht. Vorher wird eine Sicherung angelegt.', dc(c.n))
                : count === 1 ? tr('„{0}“ wird gelöscht, samt 1 Produkt. Vorher wird eine Sicherung angelegt.', dc(c.n))
                : tr('„{0}“ wird gelöscht, samt {1} Produkten. Vorher wird eine Sicherung angelegt.', dc(c.n), count),
                tr('Löschen'), () => act('cat_delete', { id: c.id }));
        } }]);
}
/**
 * Symbol einer Warengruppe wählen: ein eigenes Bild (aus Fotos, Mediathek, Dateien, etwa ein mit KI erzeugtes), ein Emoji,
 * das mitgelieferte oder keins. Bilder werden hier auf 96 × 96 Pixel verkleinert (mittig zugeschnitten), so bleiben sie klein.
 */
function catIconDialog(c) {
    const sh = sheet(tr('Symbol für „{0}“', dc(c.n)));
    const err = h('p', { class: 'err', role: 'alert', hidden: true });
    const save = async v => { try { await act('cat_icon', { id: c.id, icon: v }); sh.close(); } catch (e) { err.textContent = e.message; err.hidden = false; } };
    const cur = catIconOf(c), def = CAT_IC[c.n] || '';
    const file = h('input', { type: 'file', class: 'vh', accept: 'image/*', onchange: async () => {
        const f = file.files && file.files[0];
        if (!f) return;
        try { await save(await shrinkIcon(f)); } catch (e) { err.textContent = e.message || tr('Das Bild ließ sich nicht lesen.'); err.hidden = false; }
    } });
    const emo = h('input', { type: 'text', maxlength: 8, placeholder: '🥕', autocomplete: 'off', value: cur && !cur.startsWith('data:') ? cur : '', 'aria-label': tr('Emoji') });
    put(sh.body, h('div', { class: 'cidlg' },
        h('div', { class: 'cibig' }, iconEl(cur, 'cbig') || h('span', { class: 'cbig none' }, '–')),
        h('p', { class: 'info' }, tr('Ein eigenes Bild aus deinen Fotos oder Dateien, etwa eines, das du dir per KI hast malen lassen. Am besten quadratisch, es wird verkleinert.')),
        // ein Label um das Dateifeld: öffnet die Auswahl auf jedem Gerät, ohne Skript-Klick
        h('div', { class: 'btns' }, h('label', { class: 'btn primary' }, file, tr('Bild wählen …'))),
        h('label', { class: 'field' }, tr('Oder ein Emoji'), h('div', { class: 'row2' }, emo,
            h('button', { class: 'btn', type: 'button', onclick: () => { const v = emo.value.trim(); if (v) save(v); } }, tr('Übernehmen')))),
        err,
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => save('') }, def ? [tr('Standard'), ' ', def] : tr('Standard (keins)')),
            h('button', { class: 'btn', type: 'button', onclick: () => save('-') }, tr('Kein Symbol')))));
}
/** Bild auf 96 × 96 verkleinern, mittig zugeschnitten. WebP, wo es geht, sonst PNG, zur Not JPEG. Nur Standardmittel: FileReader, Image, Canvas. */
function shrinkIcon(f) {
    return new Promise((ok, fail) => {
        const rd = new FileReader();
        rd.onerror = () => fail(new Error(tr('Das Bild ließ sich nicht lesen.')));
        rd.onload = () => {
            const img = new Image();
            img.onerror = () => fail(new Error(tr('Dieses Bildformat geht leider nicht. PNG oder JPEG klappt immer.')));
            img.onload = () => {
                const N = 96, cv = document.createElement('canvas'), s = Math.min(img.naturalWidth, img.naturalHeight);
                if (!s) return fail(new Error(tr('Das Bild ließ sich nicht lesen.')));
                cv.width = cv.height = N;
                const g = cv.getContext('2d');
                g.imageSmoothingQuality = 'high';
                g.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, 0, 0, N, N);
                let out = cv.toDataURL('image/webp', .85);
                if (!out.startsWith('data:image/webp')) out = cv.toDataURL('image/png');
                if (out.length > 110000) out = cv.toDataURL('image/jpeg', .82);
                ok(out);
            };
            img.src = rd.result;
        };
        rd.readAsDataURL(f);
    });
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
                h('button', { class: 'btn small', type: 'button', onclick: () => ask(tr('Konto umbenennen'), [{ k: 'name', label: tr('Name'), value: u.n, max: 30 },
                    { type: 'info', text: tr('Angemeldete Geräte bleiben angemeldet. Beim nächsten Anmelden gilt der neue Name.') }], tr('Speichern'),
                    v => v.name.trim() === u.n ? null : act('user_rename', { id: u.id, name: v.name.trim() })) }, tr('Name')),
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
/** Die vier Grundfarben, die jedes eigene Design gespeichert hat. Ab 1.22 wählt man nur den Akzent, der Rest kommt aus autoColors, solange man ihn nicht selbst einstellt. */
const PARTS = [['bg', 'Hintergrund'], ['card', 'Kacheln'], ['text', 'Schrift'], ['acc', 'Akzent']];
/** Weitere Farben. Fehlt eine (Design von vor 1.22), rechnet derive sie wie früher aus. Dazu die CSS-Variable, die sie setzt. */
const TPARTS = [['head', 'Überschriften', '--head'], ['mut', 'Nebentext', '--mut'], ['at', 'Listenschrift', '--acc-text'], ['qty', 'Menge', '--qty'], ['ok', 'Fertig-Haken', '--ok']];
const isHex = v => /^#[0-9a-f]{6}$/.test(v);
/** Alles außer dem Akzent kann automatisch sein. m im eigenen Design: was davon selbst eingestellt ist (fehlt m, ist es ein Design von vor 1.22) */
const AUTO_KEYS = ['bg', 'card', 'text', 'head', 'mut', 'at', 'qty', 'ok'];
const okCols = c => c && PARTS.every(([k]) => isHex(c[k])) ? Object.assign(Object.fromEntries([...PARTS, ...TPARTS].filter(([k]) => isHex(c[k])).map(([k]) => [k, c[k]])),
    Array.isArray(c.m) ? { m: AUTO_KEYS.filter(k => c.m.includes(k)) } : {}) : null;
const okUnit = u => typeof u === 'string' && u.split('/').length <= 2 && u.split('/').every(x => UWORD.test(x));
/** Was pro Liste gelten kann: hell oder dunkel, Design für hell und dunkel, eigene Farben */
const LOOKC = ['mode', 'l', 'd', 'cl', 'cd'];
const normC = o => ({ mode: o && ['light', 'dark'].includes(o.mode) ? o.mode : 'auto', l: String(o && o.l || ''), d: String(o && o.d || ''), cl: okCols(o && o.cl), cd: okCols(o && o.cd) });
const normPl = o => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => /^[\w-]{1,40}$/.test(k) && v && typeof v === 'object').slice(0, 100).map(([k, v]) => [k, normC(v)]));
const normLook = o => ({ ...normC(o), pl: normPl(o && o.pl),
    lang: o && ['de', 'en'].includes(o.lang) ? o.lang : '', keep: !(o && o.keep === false), who: !(o && o.who === false), due: !(o && o.due === false), dn: [2, 3, 4].includes(o && o.dn) ? o.dn : 2, auto: [0, 28, 56, 84].includes(o && o.auto) ? o.auto : 28, units: Array.isArray(o && o.units) ? o.units.filter(okUnit).slice(0, 12) : [],
    uv: Array.isArray(o && o.uv) ? UNITS.map(x => x[0]).filter(k => o.uv.includes(k)) : null });
/** Einstellungen des Kontos: mode = auto|light|dark, l/d = gewähltes Design für hell/dunkel, cl/cd = eigene Farben (der Standard für alle Listen),
    pl = dasselbe je Liste ({Listennummer: {mode, l, d, cl, cd}}), sobald an einer Liste das Aussehen eigens eingestellt wurde,
    lang = Sprache ('' = noch nicht gewählt), keep = zuletzt benutzte Menge merken, who = anzeigen, wer einen Artikel hinzugefügt hat, due = „Bald wieder fällig“ zeigen, dn = ab dem wievielten Kauf (2 bis 4),
    auto = regelmäßig Gekauftes nach so vielen Tagen automatisch auf die Liste setzen (0 = aus), units = eigene Einheiten,
    uv = mitgelieferte Einheiten, die bei der Mengenauswahl immer dastehen (null = Standard). Liegt auf dem Server, hier nur die Kopie. */
let look = normLook(LS.get('look', null) || { mode: LS.get('theme', 'auto'), l: LS.get('palL', ''), d: LS.get('palD', '') });
/** Schlüssel fürs Aussehen der offenen Liste in der aktuellen Ansicht, z. B. „5_list“ (null = keine Liste offen) */
const lvKey = () => cur != null ? cur + '_' + curView() : null;
/** Das Aussehen, das gerade gilt: das eigene der offenen Liste in dieser Ansicht, sonst das der Liste (aus 1.19.0), sonst der Standard des Kontos */
const lk = () => { const o = cur != null && (look.pl[lvKey()] || look.pl[cur]); return o ? { ...look, ...o } : look; };
const palOf = mode => {
    const a = lk(), v = a[mode === 'dark' ? 'd' : 'l'];
    if (v === 'eigen' && a[mode === 'dark' ? 'cd' : 'cl']) return v;
    return PALS[mode].some(p => p[0] === v) ? v : PALS[mode][0][0];
};
let lookEpoch = 0;   // zählt jede Änderung an den Einstellungen des Kontos und jedes Speichern, siehe applyState
function setLook(patch, later) {
    lookEpoch++;
    // Farben und Design gelten für die offene Liste in der aktuellen Ansicht. Beim ersten Mal übernimmt sie, was bisher galt, und ändert dann nur, was sich ändert.
    const own = {}, rest = {};
    for (const k in patch) (LOOKC.includes(k) ? own : rest)[k] = patch[k];
    if (Object.keys(own).length) {
        if (cur != null) {
            const a = lk(), pl = {};
            for (const k in look.pl) if (!S || S.lists.some(l => String(l.id) === k.split('_')[0])) pl[k] = look.pl[k];   // gelöschte Listen fallen raus
            pl[lvKey()] = { ...Object.fromEntries(LOOKC.map(k => [k, a[k]])), ...own };
            look.pl = pl;
        } else Object.assign(look, own);
    }
    Object.assign(look, rest);
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
/** Gut lesbare Schrift auf einer Farbe: Weiß oder fast Schwarz */
const textOn = c => contrast(c, '#ffffff') >= contrast(c, '#101418') ? '#ffffff' : '#101418';
/** Abstand zweier Farbtöne im Farbkreis (0 bis 180) */
const hueDist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
/**
 * Farbe des dicken Hakens auf dem Knopf „Alles abgehakt, Einkauf fertig“ (der Knopf selbst bleibt in der Akzentfarbe), solange man sie nicht selbst wählt.
 * Am liebsten Grün, liegt der Akzent selbst im Grün (etwa Türkis), dann Gold, Blau, Violett oder Rosa. Heller oder dunkler als der Akzent,
 * je nachdem wo mehr Platz ist, bis der Kontrast zum Akzent mindestens 3 ist. Klappt das mit keiner Farbe, Weiß oder fast Schwarz.
 */
function okAuto(acc) {
    const [ah, as] = hex2hsl(acc), up = contrast(acc, '#ffffff') >= contrast(acc, '#101418');
    for (const hue of [142, 50, 205, 280, 330]) {
        if (as >= 15 && hueDist(hue, ah) < 50) continue;
        for (let l = 50; l >= 5 && l <= 95; l += up ? 2 : -2) {
            const c = hsl2hex([hue, 78, l]);
            if (contrast(c, acc) >= 3) return hsl2hex([hue, 78, Math.max(5, Math.min(95, l + (up ? 4 : -4)))]);
        }
    }
    return textOn(acc);
}
/**
 * Alle Farben eines eigenen Designs aus der Akzentfarbe, für hell oder dunkel.
 * Hintergrund und Kacheln bekommen einen Hauch vom Farbton des Akzents (bei grauem Akzent neutral), hell fast Weiß, dunkel ein tiefes, nicht ganz schwarzes Blau-Grau
 * im Ton des Akzents. Schrift fast Schwarz bzw. fast Weiß mit demselben Hauch, Überschriften einen Tick kräftiger. Nebentext gedämpft, aber gut lesbar (mindestens 4,5).
 * Listenschrift und Menge auf dem Akzent wie matchText, der Fertig-Haken wie okAuto.
 */
function autoColors(acc, dark) {
    const [ah, as] = hex2hsl(acc), t = as < 12 ? 0 : 1;   // t = 0: grauer Akzent, dann alles neutral
    const c = (s, l) => hsl2hex([ah, t * s, l]);
    const o = dark
        ? { bg: c(24, 8), card: c(20, 13), text: c(14, 92), head: c(22, 96) }
        : { bg: c(18, 96), card: c(30, 99.5), text: c(25, 12), head: c(35, 15) };
    // Nebentext: zwischen Schrift und Kacheln, so weit Richtung Hintergrund wie es die Lesbarkeit erlaubt
    for (let f = .5; f >= 0; f -= .02) { o.mut = mix(o.text, o.card, f); if (contrast(o.mut, o.card) >= 4.6 && contrast(o.mut, o.bg) >= 4.6) break; }
    const m = matchText(acc);
    return { ...o, at: m.at, qty: m.qty, ok: okAuto(acc) };
}
/** Eigenes Design vervollständigen: was nicht selbst eingestellt ist (m), kommt aus dem Akzent */
function fillAuto(c, dark) {
    const a = autoColors(c.acc, dark), m = c.m || [], out = { ...c, m: [...m] };
    for (const k of AUTO_KEYS) if (!m.includes(k) || !isHex(out[k])) out[k] = a[k];
    return out;
}
/**
 * Akzent als Schrift, Haken, Rand oder Linie auf Hintergrund und Kacheln (--acc-ink): derselbe Farbton, nur so viel dunkler (hell) bzw. heller (dunkel),
 * dass er sich abhebt (Kontrast 3,5). Ein sehr heller Akzent im hellen Design oder ein sehr dunkler im dunklen bleibt so trotzdem sichtbar.
 * Flächen in Akzentfarbe (Knöpfe, Kacheln auf der Liste) behalten genau den gewählten Ton.
 */
function inkOf(acc, card, bg) {
    if (Math.min(contrast(acc, card), contrast(acc, bg)) >= 3.5) return acc;
    const [ah, as, al] = hex2hsl(acc), up = lum(card) < .2;
    for (let l = al; l >= 0 && l <= 100; l += up ? 2 : -2) {
        const c = hsl2hex([ah, as, l]);
        if (Math.min(contrast(c, card), contrast(c, bg)) >= 3.5) return c;
    }
    return textOn(card);
}
/**
 * Leichter Farbverlauf für Flächen in Akzentfarbe (--acc-g1 oben links, --acc-g2 unten rechts): der Farbton ein Stück nach links und rechts im Farbkreis,
 * dazu etwas heller und dunkler. Wie weit, hängt an der Schrift darauf: sie soll auf beiden Enden so gut lesbar bleiben wie auf dem Akzent selbst.
 * Bei grauem Akzent nur hell und dunkel.
 */
function accGrad(acc, at) {
    const [ah, as, al] = hex2hsl(acc), dh = as < 12 ? 0 : 12, need = Math.min(contrast(acc, at), 4.5) - .25;
    for (let d = 6; d >= 0; d--) {
        const g1 = hsl2hex([(ah + 360 - dh) % 360, as, Math.min(97, al + d)]), g2 = hsl2hex([(ah + dh) % 360, as, Math.max(3, al - d)]);
        if (contrast(g1, at) >= need && contrast(g2, at) >= need) return [g1, g2];
    }
    return [acc, acc];
}
/** Aus den gewählten Farben alle Farben der Oberfläche. Ohne eigene Wahl wird die Schrift auf dem Akzent so gewählt, dass sie lesbar bleibt. */
function derive(c) {
    const dark = lum(c.bg) < .2;
    const at = c.at || textOn(c.acc), ok = c.ok || okAuto(c.acc);
    return {
        '--bg': c.bg, '--card': c.card, '--text': c.text, '--acc': c.acc, '--mut': c.mut || mix(c.text, c.bg, .4), '--line': mix(c.text, c.bg, .85),
        '--head': c.head || c.text, '--qty': c.qty || at, '--ok': ok, '--acc-ink': inkOf(c.acc, c.card, c.bg), '--acc-g1': accGrad(c.acc, at)[0], '--acc-g2': accGrad(c.acc, at)[1],
        '--acc-text': at, '--acc-soft': mix(c.acc, c.card, .82),
        '--danger': dark ? '#ff8a7a' : '#b42318', '--shadow': dark ? 'none' : '0 1px 2px rgba(0, 0, 0, .08)', 'color-scheme': dark ? 'dark' : 'light',
    };
}
/** Schriftfarben auf dem Akzent abstimmen (Knopf im Farbmischer).
    Listenschrift: so lesbar wie möglich, fast Weiß oder fast Schwarz mit einem Hauch vom Farbton des Akzents.
    Menge: eine Farbe aus dem Farbkreis, die zum Akzent passt (schräg gegenüber und Dreiklang am liebsten, genau gegenüber flimmert leicht),
    so kräftig wie möglich, aber gut lesbar (Kontrast 4,5, geht das mit Farbe nicht, 3,5) und damit klar anders als die Listenschrift.
    Bei grauem Akzent die klassischen Hervorhebungen: Gold auf dunkel, Blau auf hell. */
function matchText(acc) {
    const [ah, asat] = hex2hsl(acc), la = lum(acc);
    const light = contrast(acc, '#ffffff') >= contrast(acc, '#101418');   // helle Schrift auf diesem Akzent?
    const plain = light ? '#ffffff' : '#101418', tint = hsl2hex([ah, asat < 12 ? 0 : 35, light ? 97 : 9]);
    const at = contrast(acc, tint) >= contrast(acc, plain) * .9 ? tint : plain;
    const fit = (hue, up) => {
        if (asat < 12) return up ? (hue >= 35 && hue <= 55 ? 1 : .8) : (hue >= 205 && hue <= 235 ? 1 : .8);
        const d = Math.min(Math.abs(hue - ah), 360 - Math.abs(hue - ah));   // Abstand im Farbkreis
        return d >= 165 ? .9 : d >= 100 ? 1 : d >= 60 ? .8 : d >= 30 ? .55 : .3;
    };
    const chroma = c => { const v = hex2rgb(c); return (Math.max(...v) - Math.min(...v)) / 255; };   // wie bunt
    for (const goal of [4.5, 3.5]) {
        let best = null;
        for (let hue = 0; hue < 360; hue += 5) for (const up of [light, !light]) for (const sat of [70, 100]) {
            // von der Mitte (kräftigste Farbe) Richtung hell bzw. dunkel, bis es lesbar genug ist, dann noch ein Stück Reserve.
            // Ab „bunt genug“ zählt mehr Farbe nicht mehr, so gewinnt der gedämpfte Ton statt Neon.
            for (let l = 50; l >= 4 && l <= 96; l += up ? 1 : -1) {
                const lc = lum(hsl2hex([hue, sat, l]));
                if ((lc > la) !== up || (Math.max(lc, la) + .05) / (Math.min(lc, la) + .05) < goal) continue;
                const r = hsl2hex([hue, sat, Math.max(4, Math.min(96, l + (up ? 5 : -5)))]);
                const score = fit(hue, up) * (up === light ? 1 : .8) * Math.min(chroma(r), .5);
                if (!best || score > best.score + 1e-9) best = { c: r, score };
                break;
            }
        }
        if (best && best.score >= .2) return { at, qty: best.c };
    }
    return { at, qty: at };
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
    const a = lk();
    const mode = a.mode === 'auto' ? (darkMq.matches ? 'dark' : 'light') : a.mode;
    const root = document.documentElement;
    const pal = palOf(mode);
    root.dataset.theme = mode;
    root.dataset.pal = pal;
    setVars(root, pal === 'eigen' ? a[mode === 'dark' ? 'cd' : 'cl'] : null);
    if (pal !== 'eigen') {   // fertige Designs: der Fertig-Haken passend zum Akzent aus app.css
        const cs = getComputedStyle(root), v = k => cs.getPropertyValue(k).trim().toLowerCase(), acc = v('--acc');
        if (isHex(acc)) root.style.setProperty('--ok', okAuto(acc));
        if (isHex(acc) && isHex(v('--card')) && isHex(v('--bg'))) root.style.setProperty('--acc-ink', inkOf(acc, v('--card'), v('--bg')));
        if (isHex(acc)) { const [g1, g2] = accGrad(acc, isHex(v('--acc-text')) ? v('--acc-text') : textOn(acc)); root.style.setProperty('--acc-g1', g1); root.style.setProperty('--acc-g2', g2); }
    }
    const meta = $('meta[name=theme-color]');
    if (meta) meta.content = getComputedStyle(root).getPropertyValue(mode === 'dark' ? '--bg' : '--acc').trim() || meta.content;
    // Merkzettel für boot.js: so sieht dieses Gerät beim nächsten Start sofort richtig aus, auch auf der Anmeldeseite
    const side = m => { const pal = palOf(m), c = pal === 'eigen' ? a[m === 'dark' ? 'cd' : 'cl'] : null; return { pal, vars: c ? derive(c) : null }; };
    const paint = { mode: a.mode, light: side('light'), dark: side('dark') };
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

/** Zwei Ansichten: Kacheln oder Liste (schlichte Zeilen auf Karten, je Warengruppe eine Überschrift, die Menge als Pille rechts). Gemerkt pro Gerät und je Liste (viewL), sonst der Standard dieses Geräts, sonst die Liste. */
const VIEWS = ['tiles', 'list'];   // „Kompakt“ und „Laden-Modus“ gibt es seit 1.23 nicht mehr, wer sie hatte, bekommt die Liste
const VIEW_NAMES = [['tiles', 'Kacheln'], ['list', 'Liste']];
const curView = () => { const m = LS.get('viewL', {}), v = cur != null && m[cur] || LS.get('view', 'list'); return VIEWS.includes(v) ? v : 'list'; };
function applyView() {
    const v = curView(), next = VIEWS[(VIEWS.indexOf(v) + 1) % VIEWS.length];
    main.classList.toggle('list', v === 'list');
    const btn = $('#viewBtn');
    fill(btn, icon(I[next]));   // der Knopf zeigt, wohin er umschaltet
    btn.title = tr({ tiles: 'Zur Kachel-Ansicht', list: 'Zur Listen-Ansicht' }[next]);
}
/** Ansicht wechseln und neu zeichnen */
const setView = v => {
    if (cur != null) { const m = LS.get('viewL', {}); m[cur] = v; LS.set('viewL', m); } else LS.set('view', v);
    disarm(); applyListLook(); render();   // jede Ansicht kann ihr eigenes Aussehen haben
};
/** Beim Wechsel der Liste: ihr Aussehen, ihre Schrift und ihre Ansicht */
function applyListLook() { applyTheme(); applyFont(); applyView(); }
/** Das Aussehen der offenen Liste in dieser Ansicht gilt ab jetzt für alle Listen und Ansichten: wird Standard, alle eigenen Einstellungen fallen weg */
function lookForAll() {
    const a = lk(), f = fontRaw(), v = curView();
    for (const k of LOOKC) look[k] = a[k];
    look.pl = {};
    LS.set('font', f); LS.set('fontL', {});
    LS.set('view', v); LS.set('viewL', {});
    setLook({});
    applyListLook();
    render();
    toast(tr('Gilt jetzt für alle Listen und Ansichten'));
}

/** Schriftgrößen, gemerkt pro Gerät wie die Ansicht: je ein Faktor (1 = Standard, Grenzen von bis) und wie fett die Anzahl ohne Einheit ist.
    Landen als CSS-Variablen --fs-… und --fw-cnt an der Seite, boot.js setzt sie schon vor dem ersten Bild. */
const FONTS = [['all', 'Alle Schriften', .85, 1.4], ['head', 'Überschriften', .7, 1.5], ['name', 'Produktnamen', .7, 1.5],
    ['qty', 'Menge', .7, 1.5], ['cnt', 'Anzahl', .6, 1.5], ['hint', 'Hinweis', .7, 1.5],
    ['row', 'Höhe der Einträge', .6, 1.8], ['gap', 'Abstand dazwischen', 0, 3]];
const SIZES = ['row', 'gap'];   // keine Schrift, sondern Größe der Kacheln, Schildchen und Zeilen und die Lücke zwischen ihnen (--fs-row, --fs-gap)
const WEIGHTS = [[800, 'Fett'], [600, 'Halbfett'], [400, 'Normal']];
/** Schrift dieses Geräts für die offene Liste in dieser Ansicht (fontL), sonst für die Liste, sonst der Standard dieses Geräts */
const fontRaw = () => { const m = LS.get('fontL', {}); return cur != null && (m[lvKey()] || m[cur]) || LS.get('font', null) || {}; };
function setFontRaw(f) {
    if (cur != null) { const m = LS.get('fontL', {}); m[lvKey()] = f; LS.set('fontL', m); } else LS.set('font', f);
}
function curFont() {
    const f = fontRaw(), o = {};
    for (const [k, , lo, hi] of FONTS) o[k] = +f[k] >= lo && +f[k] <= hi ? +f[k] : 1;
    o.w = WEIGHTS.some(([w]) => w === +f.w) ? +f.w : 800;
    return o;
}
function applyFont() {
    const f = curFont(), st = document.documentElement.style;
    for (const [k] of FONTS) st.setProperty('--fs-' + k, String(f[k]));
    st.setProperty('--fw-cnt', String(f.w));
    LS.set('fontNow', f);   // für boot.js: so startet dieses Gerät gleich mit der Schrift der zuletzt offenen Liste
}
/** Beim Ziehen an einem Regler die echte Liste zeigen (Schalter im Farbmischer und bei den Schriftgrößen, gemerkt pro Gerät):
    alle Fenster werden unsichtbar, nur die Zeile mit dem Regler bleibt als Leiste stehen. on(true) beim Anfassen, on(false) beim Loslassen. */
function peekOnDrag(input, on) {
    let active = false, pend = null;
    const ends = [[window, 'pointerup'], [window, 'touchend'], [window, 'touchcancel'], [input, 'change'], [input, 'blur']];
    const end = () => {
        if (!active) return;
        active = false;
        input.closest('.sl').classList.remove('peeking');
        $('#layer').classList.remove('peek');
        for (const [t, ev] of ends) t.removeEventListener(ev, end);
        if (on) on(false);
    };
    // Erst abwarten, wohin der Finger geht: senkrecht ist Rollen und bleibt Rollen, erst waagerecht am Regler schieben macht durchsichtig
    const watch = [[window, 'pointermove', e => move(e)], [window, 'touchmove', e => move(e)], [window, 'pointerup', () => stop()], [window, 'pointercancel', () => stop()],
        [window, 'touchend', () => stop()], [window, 'touchcancel', () => stop()]];
    const stop = () => { if (!pend) return; pend = null; for (const [t, ev, fn] of watch) t.removeEventListener(ev, fn); };
    const pt = e => e.touches ? e.touches[0] : e;
    const move = e => {
        if (!pend || !pt(e)) return;
        const dx = Math.abs(pt(e).clientX - pend.x), dy = Math.abs(pt(e).clientY - pend.y);
        if (dx < 8 && dy < 8) return;
        stop();
        if (dx > dy) begin();
    };
    const begin = () => {
        active = true;
        input.closest('.sl').classList.add('peeking');
        $('#layer').classList.add('peek');
        for (const [t, ev] of ends) t.addEventListener(ev, end);
        if (on) on(true);
    };
    const start = e => {
        if (active || pend || !LS.get('peek', false) || e.button > 0 || !pt(e)) return;
        pend = { x: pt(e).clientX, y: pt(e).clientY };
        for (const [t, ev, fn] of watch) t.addEventListener(ev, fn, ev === 'touchmove' ? { passive: true } : undefined);
    };
    input.addEventListener('pointerdown', start);
    input.addEventListener('touchstart', start, { passive: true });
}
/** Der Schalter dazu, in beiden Fenstern derselbe */
function peekOption() {
    const box = h('input', { type: 'checkbox', checked: LS.get('peek', false), onchange: () => LS.set('peek', box.checked) });
    return h('label', { class: 'check peekopt' }, box, h('span', null, tr('Beim Ziehen am Regler die echte Liste zeigen')));
}
/** Fenster für Schriftgrößen, Größe und Abstände: oben eine Vorschau in der Ansicht dieses Geräts, darunter je ein Regler */
function editFont() {
    const sh = sheet(tr('Schrift, Größe und Abstände'));
    const v = curView();
    const prev = h('div', { class: 'prev' + (v === 'tiles' ? '' : ' ' + v), 'aria-hidden': 'true' },
        h('h2', null, tr('Noch zu kaufen'), h('small', null, '2')),
        h('div', { class: 'secs' }, h('div', { class: 'sec' }, h('div', { class: 'grp' }, dc('Milch & Käse')),
            h('div', { class: 'grid todo' }, tile('on', {}, dn('Milch'), '3'), tile('on', {}, dn('Butter'), '2 Packungen, die guten'),
                tile('got', {}, dn('Quark'), '1,5 kg')))));
    prev.querySelectorAll('button').forEach(b => { b.tabIndex = -1; });
    let f = curFont();
    const save = () => { setFontRaw(f); applyFont(); };
    const rows = FONTS.map(([k, name, lo, hi]) => {
        const out = h('b');
        const r = h('input', { type: 'range', min: String(lo * 100), max: String(hi * 100), step: '5', 'aria-label': tr(name),
            oninput: () => { f[k] = +r.value / 100; out.textContent = r.value + ' %'; save(); } });
        peekOnDrag(r);
        return { k, r, out, node: h('label', { class: 'sl fs' }, h('span', { class: 'fsl' }, tr(name), out), r) };
    });
    const wSel = h('select', { onchange: () => { f.w = +wSel.value; save(); } }, WEIGHTS.map(([w, s]) => h('option', { value: String(w) }, tr(s))));
    const show = () => {
        for (const x of rows) { x.r.value = String(Math.round(f[x.k] * 100)); x.out.textContent = x.r.value + ' %'; }
        wSel.value = String(f.w);
    };
    const fontRows = rows.filter(x => !SIZES.includes(x.k)), sizeRows = rows.filter(x => SIZES.includes(x.k));
    put(sh.body, prev, peekOption(), h('div', { class: 'qlabel' }, tr('Schriftgrößen')), fontRows.map(x => x.node),
        h('label', { class: 'field' }, tr('Anzahl ohne Einheit'), wSel),
        h('div', { class: 'qlabel gap' }, tr('Größe und Abstände')), sizeRows.map(x => x.node),
        h('p', { class: 'info' }, tr('Höhe der Einträge macht Kacheln, Schildchen und Zeilen in allen Ansichten größer oder kleiner, Abstand dazwischen die Lücke zwischen ihnen. In der Liste stehen die Zeilen ohne Lücke untereinander.')),
        h('p', { class: 'info' }, tr('Gilt für diese Liste in dieser Ansicht und nur auf diesem Gerät. 100 % und fett ist der Standard.')),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => { setFontRaw({}); f = curFont(); applyFont(); show(); } }, tr('Zurücksetzen')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, tr('Fertig'))));
    show();
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
    $('#qClear').setAttribute('aria-label', tr('Suche leeren'));
    applyView();
}

/**
 * Farbmischer fürs eigene Design. Gewählt wird nur die Akzentfarbe, alles andere stimmt Kaufen darauf ab (autoColors), für hell und dunkel je eigens.
 * Jede Farbe lässt sich trotzdem einzeln ändern, dann steht sie fest (col.m = selbst eingestellt). „Automatisch“ holt eine zurück, „Alles automatisch“ alle.
 * Oben eine Vorschau, die sofort mitgeht, je drei Regler oder der Farbwähler des Geräts.
 */
function editLook(mode, redraw) {
    const ck = mode === 'dark' ? 'cd' : 'cl', dark = mode === 'dark';
    const raw = lk()[ck];
    // Eigenes Design von vor 1.22 (ohne m): alles gilt als selbst eingestellt, so sieht es genauso aus wie bisher
    const legacy = c => { const d = derive(c), out = { ...c, m: [...AUTO_KEYS] }; for (const [k, , v] of TPARTS) if (!out[k]) out[k] = d[v]; return out; };
    const start = raw.m ? fillAuto(raw, dark) : legacy(raw);
    const col = { ...start }, hsl = {};
    let man = new Set(start.m);
    const ALL = [['acc', 'Akzent'], ...PARTS.filter(([k]) => k !== 'acc'), ...TPARTS];
    const name = k => tr(ALL.find(x => x[0] === k)[1]);
    let part = 'acc';
    const recompute = () => { Object.assign(col, fillAuto({ ...col, m: [...man] }, dark)); col.m = [...man]; for (const [k] of ALL) if (k !== part) hsl[k] = hex2hsl(col[k]); };
    const set = hex => { col[part] = hex; if (part !== 'acc') man.add(part); recompute(); show(); };
    for (const [k] of ALL) hsl[k] = hex2hsl(col[k]);
    const sh = sheet(dark ? tr('Eigenes Design für dunkel') : tr('Eigenes Design für hell'), { onclose: () => { saveLook(); redraw(); } });
    const demo = (cls, nm, note) => h('span', { class: 'tile ' + cls }, h('span', { class: 'tn' }, nm), note && h('span', { class: 'tt' }, note));
    const prev = h('div', { class: 'prev', 'aria-hidden': 'true' },
        h('h2', null, tr('Noch zu kaufen'), h('small', null, '1')),
        h('div', { class: 'grp' }, dc('Milch & Käse')),
        h('div', { class: 'grid' }, demo('on', dn('Milch'), dnote('2 Liter')), demo('has', dn('Brot')), demo('', dn('Butter')), demo('new', tr('+ Neu'))),
        h('p', { class: 'info' }, tr('Nebentext, etwa ein Hinweis')),
        h('div', { class: 'cat' }, dc('Getränke'), h('small', null, '12'), icon(I.down)),
        h('div', { class: 'btns' }, h('span', { class: 'btn' }, tr('Knopf')), h('span', { class: 'btn primary' }, tr('Speichern'))),
        h('span', { class: 'finishbtn all mini' }, h('span', { class: 'fi' }, icon(I.check)), h('span', { class: 'ft' }, h('b', null, tr('Alles abgehakt, Einkauf fertig')))));
    const tabs = ALL.map(([k, nm]) => h('button', { class: 'seg', type: 'button', onclick: () => { part = k; show(); } }, h('i'), tr(nm)));
    // Beim Ziehen mit freiem Blick: die echte Seite zeigt genau die Farben, an denen gedreht wird, auch wenn das Gerät gerade die andere Seite (hell/dunkel) zeigt
    let peeking = false;
    const peek = on => { peeking = on; if (on) setVars(document.documentElement, col); else applyTheme(); };
    const range = (cls, label, max, i) => {
        const r = h('input', { type: 'range', min: '0', max: String(max), step: '1', 'aria-label': label, oninput: () => { hsl[part][i] = +r.value; set(hsl2hex(hsl[part])); } });
        peekOnDrag(r, peek);
        return [h('label', { class: 'sl ' + cls }, label, r), r];
    };
    const [hueL, hue] = range('hue', tr('Farbton'), 360, 0), [satL, sat] = range('sat', tr('Sättigung'), 100, 1), [ligL, lig] = range('lig', tr('Helligkeit'), 100, 2);
    const sliders = h('div', { class: 'sliders' }, hueL, satL, ligL);
    const picker = h('input', { type: 'color', 'aria-label': tr('Farbwähler'), oninput: () => { hsl[part] = hex2hsl(picker.value.toLowerCase()); set(picker.value.toLowerCase()); } });
    // Farbcode zum Eintippen oder Einfügen: #7c3aed, 7c3aed oder kurz #73e
    const code = h('input', { type: 'text', class: 'hex', maxlength: 7, spellcheck: 'false', autocomplete: 'off', autocapitalize: 'none', 'aria-label': tr('Farbcode'), enterkeyhint: 'done',
        onchange: () => {
            let v = code.value.trim().toLowerCase().replace(/^#/, '');
            if (/^[0-9a-f]{3}$/.test(v)) v = v.replace(/./g, '$&$&');
            if (/^[0-9a-f]{6}$/.test(v) && col[part] !== '#' + v) { hsl[part] = hex2hsl('#' + v); set('#' + v); }
            show();
        },
        onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); code.blur(); } } });
    // Diese eine Farbe wieder automatisch, oder alle außer dem Akzent
    const autoBtn = h('button', { class: 'btn auto', type: 'button', onclick: () => { man.delete(part); recompute(); hsl[part] = hex2hsl(col[part]); show(); } });
    const allBtn = h('button', { class: 'btn auto', type: 'button', onclick: () => { man = new Set(); recompute(); hsl[part] = hex2hsl(col[part]); show(); } }, tr('Alles automatisch'));
    const load = (c, m) => { Object.assign(col, c); man = new Set(m); recompute(); for (const [k] of ALL) hsl[k] = hex2hsl(col[k]); show(); };
    const base = h('select', { 'aria-label': tr('Fertiges Design als Ausgangspunkt'), onchange: () => { if (base.value) load(palColors(base.value), ['bg', 'card', 'text']); base.value = ''; } },
        h('option', { value: '' }, tr('Von einem fertigen Design ausgehen …')),
        [['Hell', PALS.light], ['Dunkel', PALS.dark]].map(([g, list]) => h('optgroup', { label: tr(g) }, list.map(([id, nm]) => h('option', { value: id }, tr(nm))))));
    const warn = h('p', { class: 'err', hidden: true });
    // Welche Farbe auf welchem Untergrund steht: Schrift braucht 4,5, Nebentext, Menge und Haken 3. Der Akzent selbst darf alles, Schrift und Ränder in Akzentfarbe hebt --acc-ink ab.
    const pairs = [['text', ['bg', 'card'], 4.5], ['head', ['bg'], 4.5], ['mut', ['bg', 'card'], 3], ['at', ['acc'], 4.5], ['qty', ['acc'], 3], ['ok', ['acc'], 3]];
    function show() {
        recompute();
        setVars(prev, col);
        setLook({ [ck]: { ...col, m: [...man] } }, true);   // die App dahinter färbt sich gleich mit, zum Konto geht es beim Schließen
        if (peeking) setVars(document.documentElement, col);
        tabs.forEach((t, i) => { const k = ALL[i][0]; t.firstChild.style.setProperty('--c', col[k]); t.setAttribute('aria-pressed', String(k === part)); t.classList.toggle('isauto', k !== 'acc' && !man.has(k)); });
        const [a, b, c] = hsl[part];
        hue.value = a; sat.value = b; lig.value = c;
        sliders.style.setProperty('--h', a); sliders.style.setProperty('--s', b + '%'); sliders.style.setProperty('--l', c + '%');
        picker.value = col[part];
        code.value = col[part];
        autoBtn.hidden = part === 'acc';
        fill(autoBtn, man.has(part) ? tr('{0} wieder automatisch', name(part)) : tr('{0}: automatisch', name(part)));
        autoBtn.setAttribute('aria-pressed', String(!man.has(part)));
        allBtn.setAttribute('aria-pressed', String(!man.size));
        const bad = pairs.filter(([k, on, min]) => man.has(k) && on.some(u => contrast(col[k], col[u]) < min)).map(([k]) => name(k));   // automatisch ist schon das Beste, was geht
        warn.textContent = tr('Schwer zu erkennen: {0}', bad.join(', '));
        warn.hidden = !bad.length;
    }
    put(sh.body, prev, h('div', { class: 'segs' }, tabs), peekOption(), sliders,
        h('div', { class: 'pick' }, h('label', { class: 'btn' }, picker, tr('Farbwähler')), code),
        h('p', { class: 'info' }, tr('Wähl nur die Akzentfarbe, alles andere stimmt Kaufen darauf ab, gut lesbar und in sich stimmig. Jede Farbe lässt sich trotzdem ändern, „A“ heißt automatisch.')),
        h('div', { class: 'btns autos' }, autoBtn, allBtn), warn,
        h('label', { class: 'field' }, base),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => load(start, start.m) }, tr('Zurücksetzen')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, tr('Fertig'))));
    show();
}

function showSettings(top) {
    const sh = sheet(tr('Einstellungen'));
    if (top) requestAnimationFrame(() => { sh.body.scrollTop = top; });   // nach dem Wechsel der Ansicht an derselben Stelle weiter
    // Sprache wechseln: alles neu zeichnen, auch dieses Fenster
    const langSel = h('select', { onchange: () => { setLook({ lang: langSel.value }); applyLang(); pushRefresh(); render(); sh.close(); showSettings(); } },
        [['de', 'Deutsch'], ['en', 'English']].map(([v, s]) => h('option', { value: v, selected: lang === v }, s)));
    const keepBox = h('input', { type: 'checkbox', checked: look.keep, onchange: () => { setLook({ keep: keepBox.checked }); render(); } });
    const unitBox = h('div', { class: 'chips' });
    const drawUnits = () => fill(unitBox,
        look.units.map(u => h('button', { class: 'chip', type: 'button', 'aria-label': tr('{0} bearbeiten', cuLabel(u)), onclick: () => unitDialog(u, () => { drawUnits(); drawStd(); }) }, cuLabel(u))),
        h('button', { class: 'chip add', type: 'button', onclick: () => addUnit(() => { drawUnits(); drawStd(); }) }, tr('+ Einheit')));
    // Mitgelieferte Einheiten: markierte stehen bei der Mengenauswahl immer da, die anderen unter „Weitere …“
    const stdBox = h('div', { class: 'chips' });
    const drawStd = () => fill(stdBox, UNITS.map((x, i) => {
        const on = uvis().includes(x[0]);
        return h('button', { class: 'chip' + (on ? ' sel' : ''), type: 'button', 'aria-pressed': String(on),
            onclick: () => { setLook({ uv: UNITS.map(y => y[0]).filter(k => k === x[0] ? !on : uvis().includes(k)) }); drawStd(); } }, unitName(i, 1, lang));
    }));
    drawUnits();
    drawStd();
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
        [['auto', 'Wie das Gerät'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([v, s]) => h('option', { value: v, selected: lk().mode === v }, tr(s))));
    const wakeBox = h('input', { type: 'checkbox', checked: LS.get('wake', true), onchange: () => { LS.set('wake', wakeBox.checked); wake(); } });
    const whoBox = h('input', { type: 'checkbox', checked: look.who, onchange: () => { setLook({ who: whoBox.checked }); render(); } });
    const dueBox = h('input', { type: 'checkbox', checked: look.due, onchange: () => { setLook({ due: dueBox.checked }); render(); } });
    const ivInput = h('input', { type: 'number', min: '1', max: '60', inputmode: 'numeric', value: String(S.interval) });
    // Andere Ansicht, anderes Aussehen: das Fenster zeigt danach die Einstellungen dieser Ansicht
    const view = h('select', { onchange: () => { const t = sh.body.scrollTop; setView(view.value); sh.close(); showSettings(t); } },
        VIEW_NAMES.map(([v, s]) => h('option', { value: v, selected: curView() === v }, tr(s))));
    const dueN = h('select', { onchange: () => { setLook({ dn: +dueN.value }); render(); } },
        [2, 3, 4].map(v => h('option', { value: String(v), selected: look.dn === v }, tr('Ab dem {0}. Kauf', v))));
    const autoSel = h('select', { onchange: () => { setLook({ auto: +autoSel.value }); render(); autoAdd(); } },
        [[0, 'Aus'], [28, 'Nach 4 Wochen regelmäßigem Kauf'], [56, 'Nach 8 Wochen regelmäßigem Kauf'], [84, 'Nach 12 Wochen regelmäßigem Kauf']]
            .map(([v, s]) => h('option', { value: String(v), selected: look.auto === v }, tr(s))));
    const swatches = mode => {
        const row = h('div', { class: 'pals', role: 'radiogroup', 'aria-label': mode === 'dark' ? tr('Dunkles Design') : tr('Helles Design') });
        const pk = mode === 'dark' ? 'd' : 'l', ck = mode === 'dark' ? 'cd' : 'cl';
        const draw = () => {
            const a = lk();
            const own = h('button', { class: 'pal' + (a[ck] ? '' : ' empty'), type: 'button', role: 'radio', 'aria-checked': String(palOf(mode) === 'eigen'), data: { pal: 'eigen' },
                onclick: () => { setLook({ [ck]: a[ck] || fillAuto({ acc: palColors(palOf(mode)).acc, m: [] }, mode === 'dark'), [pk]: 'eigen' }); draw(); editLook(mode, draw); } },
                h('span', { class: 'dot' }, a[ck] ? h('i') : icon(I.edit)), h('span', null, tr('Eigenes')));
            if (a[ck]) setVars(own, a[ck]);
            fill(row, PALS[mode].map(([id, name]) => h('button', { class: 'pal', type: 'button', role: 'radio', 'aria-checked': String(palOf(mode) === id), data: { pal: id },
                onclick: () => { setLook({ [pk]: id }); draw(); } }, h('span', { class: 'dot' }, h('i')), h('span', null, tr(name)))), own);
        };
        draw();
        return row;
    };
    put(sh.body,
        h('label', { class: 'field' }, 'Sprache / Language', langSel),
        // Aussehen: gilt für die offene Liste, auf Wunsch für alle
        h('h2', { class: 'looksec' }, curList() ? tr('Aussehen der Liste „{0}“', curList().n) : tr('Aussehen')),
        curList() && h('p', { class: 'info' }, tr('Jede Ansicht hat ihr eigenes Aussehen. Wähl die Ansicht, dann stellst du Schrift, Design und Farben genau für sie ein.')),
        h('label', { class: 'field' }, tr('Ansicht'), view),
        h('div', { class: 'qlabel' }, tr('Schrift und Größe')),
        h('button', { class: 'btn fontbtn', type: 'button', onclick: editFont }, tr('Schrift, Größe und Abstände anpassen …')),
        h('label', { class: 'field' }, tr('Hell oder dunkel'), theme),
        h('div', { class: 'qlabel' }, tr('Design für hell')), swatches('light'),
        h('div', { class: 'qlabel' }, tr('Design für dunkel')), swatches('dark'),
        h('p', { class: 'info' }, curList() ? tr('Gilt nur für diese Liste in der Ansicht „{0}“. Design und Farben gehören zu deinem Konto und gelten überall, wo du angemeldet bist, Ansicht und Schrift nur auf diesem Gerät. „Eigenes“ öffnet den Farbmischer.', tr(VIEW_NAMES.find(x => x[0] === curView())[1]))
            : tr('Design und Farben gehören zu deinem Konto und gelten überall, wo du angemeldet bist, Ansicht und Schrift nur auf diesem Gerät. „Eigenes“ öffnet den Farbmischer.')),
        curList() && h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => confirmDlg(tr('Für alle Listen und Ansichten übernehmen?'),
            tr('Ansicht, Schrift, Design und Farben, wie du sie gerade bei „{0}“ siehst, gelten dann für alle Listen und alle Ansichten. Was du anderswo eigens eingestellt hast, fällt dabei weg.', curList().n),
            tr('Für alle übernehmen'), lookForAll) }, tr('Für alle Listen und Ansichten übernehmen'))),
        h('h2', null, tr('Weitere Einstellungen')),
        h('label', { class: 'check' }, whoBox, h('span', null, tr('Anzeigen, wer einen Artikel hinzugefügt hat'))),
        h('label', { class: 'check' }, wakeBox, h('span', null, tr('Bildschirm anlassen, solange Kaufen offen ist'))),
        h('label', { class: 'check' }, keepBox, h('span', null, tr('Zuletzt benutzte Menge merken'))),
        h('p', { class: 'info' }, tr('Beim Abhaken merkt sich Kaufen, welche Menge am Produkt stand, und setzt es beim nächsten Mal wieder genauso auf die Liste. Ohne Haken steht immer 1 da.')),
        h('label', { class: 'check' }, dueBox, h('span', null, tr('Vorschlagen, was bald wieder fällig ist'))),
        h('label', { class: 'field' }, tr('Vorschlagen'), dueN),
        h('p', { class: 'info' }, tr('Kaufen lernt beim Abhaken, wie oft ihr etwas kauft, zum Beispiel Milch alle 7 Tage. Kurz bevor es wieder so weit ist, steht es unter der Liste bei „Bald wieder fällig“. Lang drücken, dann kannst du es dort für ein Produkt abschalten.')),
        h('label', { class: 'field' }, tr('Regelmäßiges automatisch auf die Liste'), autoSel),
        h('p', { class: 'info' }, tr('Kauft ihr etwas so lange im gleichen Abstand, setzt Kaufen es von allein auf die Liste, sobald es wieder fällig ist. Lang drücken, dann lässt es sich für ein Produkt abschalten.')),
        h('div', { class: 'qlabel' }, tr('Einheiten bei der Mengenauswahl')), stdBox,
        h('p', { class: 'info' }, tr('Markierte stehen immer da, die anderen findest du dort unter „Weitere …“. Diktieren und Tippen verstehen alle, egal ob „eine Kiste“ oder „zwei Kisten“.')),
        h('div', { class: 'qlabel' }, tr('Eigene Einheiten')), unitBox,
        h('p', { class: 'info units' }, tr('Erscheinen bei der Mengenauswahl neben den mitgelieferten, mit Einzahl und Mehrzahl auf einem Knopf. Antippen zum Umbenennen oder Löschen.')),
        pushCan() && h('label', { class: 'check' }, pushBox, h('span', null, tr('Mitteilungen auf diesem Gerät'))),
        !LOCAL && h('p', { class: 'info' }, pushCan() ? tr('Du bekommst eine Mitteilung, wenn jemand etwas auf eine Liste setzt, die ihr teilt. Mehrere Produkte kommen gebündelt in einer Mitteilung, sobald der andere Kaufen verlässt.')
            : S.push ? tr('Mitteilungen gehen auf diesem Gerät oder in diesem Browser nicht. Auf dem iPhone muss Kaufen dafür über „Zum Home-Bildschirm“ installiert sein (ab iOS 16.4).')
            : tr('Dieser Server kann keine Mitteilungen verschicken.')),
        !LOCAL && h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => ask(tr('Passwort ändern'), [
            { k: 'old', label: tr('Bisheriges Passwort'), type: 'password', auto: 'current-password' },
            { k: 'pass', label: tr('Neues Passwort (mindestens 8 Zeichen)'), type: 'password' },
            { k: 'pass2', label: tr('Neues Passwort wiederholen'), type: 'password' },
        ], tr('Ändern'), async v => {
            if (v.pass !== v.pass2) throw new Error(tr('Die beiden neuen Passwörter stimmen nicht überein.'));
            await api('me_pass', { old: v.old, pass: v.pass });
            toast(tr('Passwort geändert, andere Geräte wurden abgemeldet'));
        }) }, tr('Passwort ändern'))),
        S.me.admin && !LOCAL && h('h2', null, tr('Für alle')),
        S.me.admin && !LOCAL && h('label', { class: 'field' }, tr('Abgleich alle … Sekunden (1 bis 60)'), ivInput),
        S.me.admin && !LOCAL && h('p', { class: 'info' }, tr('So oft fragt jedes Gerät nach, ob sich an der Liste etwas geändert hat. Kleiner heißt schneller, größer schont Server und Akku.')),
        S.me.admin && !LOCAL && h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: async () => {
            try { await act('settings_save', { interval: +ivInput.value }); ivInput.value = String(S.interval); toast(tr('Gespeichert: alle {0} Sekunden', S.interval)); }
            catch (e) { toast(e.message); }
        } }, tr('Speichern'))),
        // Lokaler Modus: einschalten (mit Konto) oder Bescheid wissen und wieder beenden
        S.me.admin && !LOCAL && h('h2', null, tr('Demo-Modus')),
        S.me.admin && !LOCAL && h('p', { class: 'info' }, tr('Nur für einen öffentlichen Server zum Ausprobieren, nicht für deine eigene Installation! Danach gibt es hier keine Konten mehr und jeder nutzt Kaufen nur auf seinem Gerät. Ein Zurück gibt es in der App nicht.')),
        S.me.admin && !LOCAL && h('div', { class: 'btns' }, h('button', { class: 'btn danger', type: 'button', onclick: () => { sh.close(); demoOn(); } }, tr('Demo-Modus einschalten …'))),
        DEMO ? [h('h2', null, tr('Demo')), h('p', { class: 'info' }, tr('Das ist die Demo von Kaufen. Alles bleibt nur auf diesem Gerät, Teilen mit anderen gibt es hier nicht. Neue Versionen kommen von allein.')),
            h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); showLocalBackup(); } }, tr('Sicherung als Datei'))),
            h('p', { class: 'info' }, tr('Kaufen ist frei und lässt sich auf eigenem Webspace installieren, dann auch zum Teilen mit anderen: '), h('a', { href: GH, target: '_blank', rel: 'noopener' }, 'GitHub'), '. ',
                tr('Für weitere Informationen besuch bitte '), h('a', { href: SITE, target: '_blank', rel: 'noopener' }, 'tech.burnersen.de'), '.')] : [
        h('h2', null, tr(LOCAL ? 'Lokaler Modus' : 'Nur auf diesem Gerät')),
        h('p', { class: 'info' }, LOCAL
            ? tr('Alles liegt nur auf diesem Gerät, Kaufen schickt keine Listen ins Netz. Es schaut nur ab und zu nach einer neuen Version von Kaufen. Denk an eine Sicherung als Datei, falls die Browserdaten einmal gelöscht werden.')
            : tr('Im lokalen Modus läuft Kaufen ganz ohne Server: Listen, Katalog und Einstellungen liegen nur auf diesem Gerät, nichts davon geht ins Netz. Teilen mit anderen und Mitteilungen gibt es dann nicht. Neue Versionen von Kaufen kommen trotzdem.')),
        h('div', { class: 'btns' }, LOCAL
            ? [h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); showLocalBackup(); } }, tr('Sicherung als Datei')),
               h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); leaveLocal(); } }, tr('Lokalen Modus beenden'))]
            : h('button', { class: 'btn', type: 'button', onclick: () => { sh.close(); goLocal(); } }, tr('Lokalen Modus einschalten')))],
        h('p', { class: 'info' }, LOCAL ? tr('Lokaler Modus · Kaufen {0}', S.version) : tr('Angemeldet als {0} · Kaufen {1}', S.me.n, S.version)));
}

/* ---------- Lokaler Modus: alles bleibt auf diesem Gerät (local.js). Ein- und Ausschalten, Sicherung als Datei, Übernahme ins Konto. ---------- */
/** Dem Service Worker Bescheid geben: lokal kommt alles zuerst aus dem Vorrat. Wartet auf seine Antwort, höchstens 1,5 Sekunden. */
async function swLocal(on) {
    if (!('serviceWorker' in navigator)) return;
    const reg = await Promise.race([navigator.serviceWorker.ready, new Promise(r => setTimeout(r, 1500))]);
    const sw = navigator.serviceWorker.controller || (reg && reg.active);
    if (!sw) return;
    await new Promise(res => { const ch = new MessageChannel(); ch.port1.onmessage = res; sw.postMessage({ local: on }, [ch.port2]); setTimeout(res, 1500); });
}
/** Seite, Schrift und Programm für den Start ohne Netz vorhalten */
function precache() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.ready.then(reg => {
        const urls = [LOCAL ? './?local=1' : './', ...[...document.querySelectorAll('link[rel=stylesheet], script[src]')].map(e => e.getAttribute('href') || e.getAttribute('src'))];
        if (reg.active) reg.active.postMessage({ precache: urls });
    }).catch(() => {});
}
/** Den Browser bitten, die Daten nicht von sich aus wegzuräumen (wichtig, wenn sonst nirgends eine Kopie liegt) */
const askPersist = () => { try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {} };
/** Ohne Konto anfangen (Link auf der Anmeldeseite, ./?local=1): Standardkatalog holen, sonst steht alles schon auf dem Gerät */
async function localBegin() {
    try {
        if (!self.kfLocal.has()) {
            const r = await fetch('?action=local_seed', { cache: 'no-store' });
            const seed = await r.json().catch(() => ({}));
            if (!r.ok || !Array.isArray(seed.catalog)) throw new Error(seed.error || tr('Der Server antwortet nicht richtig ({0}).', r.status));
            self.kfLocal.create(seed, tr('Ich'), tr('Einkauf'));
        }
    } catch (e) {
        main.replaceChildren(h('p', { class: 'hint' }, e.key ? lerr(e).message : e.message || tr('Keine Verbindung zum Server.')));
        return;
    }
    LS.clear();
    S = null; L = null; cur = null; queue = [];
    LS.set('mode', 'local');
    LOCAL = true;
    history.replaceState(null, '', './');
    await swLocal(true);
    precache();
    askPersist();
    toast(tr('Lokaler Modus: alles bleibt auf diesem Gerät'));
    tick();
}
/** Mit Konto in den lokalen Modus: alles vom Server aufs Gerät kopieren, dann vom Server abmelden */
function goLocal() {
    confirmDlg(tr('Lokalen Modus einschalten'), tr('Deine Listen, der Katalog, die Vorlagen und dein Aussehen werden auf dieses Gerät kopiert. Danach meldet sich dieses Gerät vom Server ab und Kaufen läuft nur noch hier. Geteilte Listen sind dann eine Kopie und werden nicht mehr abgeglichen. Zurück geht es jederzeit über „Lokalen Modus beenden“.')
        + (self.kfLocal.has() ? ' ' + tr('Lokale Listen, die noch auf diesem Gerät liegen, werden dabei ersetzt.') : ''),
        tr('Lokal weitermachen'), async () => {
            if (!online) throw new Error(tr('Dafür braucht Kaufen einmal Verbindung zum Server.'));
            await flush();
            if (queue.length) throw new Error(tr('Erst müssen alle Änderungen beim Server sein. Versuch es gleich noch einmal.'));
            const lists = [];
            for (const l of S.lists) lists.push({ meta: l, data: await api('list&id=' + l.id) });
            let seed = null;
            try { const r = await fetch('?action=local_seed', { cache: 'no-store' }); if (r.ok) seed = await r.json(); } catch (e) {}
            try { self.kfLocal.fromAccount({ me: S.me, look, catalog: S.catalog, templates: S.templates, lists, seed, start: cur }); } catch (e) { throw lerr(e); }
            if (pushCan()) await pushOff().catch(() => {});
            try { await api('logout', {}); } catch (e) {}
            LS.clear();
            LS.set('mode', 'local');
            await swLocal(true);
            location.replace('./?local=1');
        });
}
/** Lokalen Modus beenden: zur Anmeldung. Die lokalen Daten bleiben, nach dem Anmelden fragt Kaufen, ob sie ins Konto sollen. */
function leaveLocal() {
    confirmDlg(tr('Lokalen Modus beenden'), tr('Danach meldest du dich mit einem Konto an. Deine lokalen Listen bleiben auf diesem Gerät, nach dem Anmelden kannst du sie ins Konto übernehmen.'),
        tr('Zur Anmeldung'), async () => {
            LS.set('mode', '');
            await swLocal(false);
            location.replace('./');
        });
}
/** Sicherung als Datei: im lokalen Modus die einzige Kopie außerhalb des Browsers */
function showLocalBackup() {
    const sh = sheet(tr('Sicherung als Datei'));
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        const text = await f.text();
        confirmDlg(tr('Sicherung einspielen'), tr('Alles, was jetzt auf diesem Gerät liegt, wird durch die Sicherung ersetzt.'), tr('Einspielen'), () => {
            try { self.kfLocal.importAll(text); } catch (e) { throw lerr(e); }
            LS.clear();
            LS.set('mode', 'local');
            location.reload();
        });
    } });
    const d = new Date(), p = n => String(n).padStart(2, '0');
    put(sh.body,
        h('p', { class: 'info' }, tr('Im lokalen Modus liegt alles nur auf diesem Gerät. Wer die Browserdaten löscht oder das Handy wechselt, braucht eine Sicherung. Am besten ab und zu eine speichern, zum Beispiel in der Cloud oder per Mail an dich selbst.')),
        h('button', { class: 'btn wide primary', type: 'button', onclick: () => {
            try { download('Kaufen-' + tr('Sicherung') + ' ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.json', self.kfLocal.exportAll(), 'application/json'); }
            catch (e) { toast(lerr(e).message); }
        } }, tr('Sicherung speichern')),
        h('button', { class: 'btn wide', type: 'button', onclick: () => file.click() }, tr('Sicherung einspielen …')),
        h('p', { class: 'info' }, tr('Eine Sicherung enthält alle Listen, den Katalog, die Vorlagen und dein Aussehen.')),
        file);
}
/** Nach dem Anmelden: liegen noch Listen aus dem lokalen Modus auf dem Gerät, einmal pro Start fragen, ob sie ins Konto sollen.
    Übernommen wird, was noch zu kaufen ist. Die Warengruppe geht über ihren Namen, das Abgehakte bleibt zurück. */
let importAsked = false;
function offerImport() {
    if (LOCAL || importAsked || !self.kfLocal || !self.kfLocal.has() || !S) return;
    importAsked = true;
    const db = self.kfLocal.peek();
    const lists = (db.lists || []).filter(l => l.items.some(i => !i.got));
    if (!lists.length) { self.kfLocal.drop(); return; }   // nichts mehr zu kaufen: nichts zu übernehmen
    const sum = lists.map(l => l.n + ' (' + l.items.filter(i => !i.got).length + ')').join(', ');
    ask(tr('Lokale Listen übernehmen?'), [{ type: 'info', text: tr('Auf diesem Gerät liegen noch Listen aus dem lokalen Modus: {0}. Sollen sie in dein Konto?', sum) }],
        tr('Ins Konto übernehmen'), async () => {
            const catName = id => { const c = (db.cats || []).find(x => x.id === id); return c ? c.n : ''; };
            const catId = id => { const n = catName(id), c = n && S.catalog.cats.find(x => low(x.n) === low(n)); return c ? c.id : 0; };
            let n = 0;
            for (const l of lists) {
                // Gibt es im Konto eine Liste mit diesem Namen (etwa die, aus der die lokale einmal kopiert wurde), kommt alles dorthin.
                // Was dort schon steht, kommt nicht doppelt drauf.
                let id = (S.lists.find(x => low(x.n) === low(l.n)) || {}).id;
                if (!id) { const r = await api('list_create', { name: l.n }); applyState(r); id = r.created; }
                const ops = l.items.filter(i => !i.got).map(i => ({ t: 'add', uid: newUid(), n: i.n, c: catId(i.c), note: i.note || '' }));
                if (ops.length && id) await api('ops', { list: id, ops });
                n++;
            }
            self.kfLocal.drop();
            await loadState();
            if (cur) loadList();
            toast(n === 1 ? tr('1 Liste übernommen') : tr('{0} Listen übernommen', n));
        },
        [{ label: tr('Verwerfen'), danger: true, fn: () => {
            confirmDlg(tr('Lokale Listen verwerfen'), tr('Die lokalen Listen werden von diesem Gerät gelöscht. Das lässt sich nicht rückgängig machen.'), tr('Löschen'), () => { self.kfLocal.drop(); toast(tr('Lokale Listen gelöscht')); });
        } }]);
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

/* ---------- Drucken und Teilen: Einkaufszettel als PDF (pdf.js), Liste als Text. Und der Weg zurück: aus Text einfügen. ---------- */
/** Was noch zu kaufen ist, nach Warengruppen in der Reihenfolge des Ladens: [[Warengruppe, [Einträge]]]. Abgehaktes bleibt draußen. */
function listGroups() {
    const groups = new Map(catOrder().map(id => [id, []]));
    for (const it of openItems()) groups.get(hasCat(it.c) ? it.c : 0).push(it);
    return [...groups].filter(g => g[1].length);
}
const locale = () => lang === 'en' ? 'en-US' : 'de-DE';
/** Dateiname aus Listenname und heutigem Datum, z. B. „Wocheneinkauf 2026-11-19.pdf“ */
function exportName(ext) {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return (curList().n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Kaufen') + ' ' + d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '.' + ext;
}
/** Menge für Zettel und Text wie auf den Kacheln: „6×“ statt bloß „6“ */
const paperNote = note => { const p = noteParts(note); return [p.q, p.hint].filter(Boolean).join(', '); };
/** Die Liste als schlichter Text. Genau dieses Format versteht „Aus Text einfügen“ wieder. */
function listText() {
    const lines = [curList().n + ' (' + new Date().toLocaleDateString(locale()) + ')'];
    for (const [id, items] of listGroups()) {
        lines.push('', catName(id) + ':');
        for (const it of items) lines.push('- ' + dn(it.n) + (it.note ? ' (' + paperNote(it.note) + ')' : ''));
    }
    return lines.join('\n');
}
/** Wie der Zettel aussieht, gemerkt pro Gerät: Schriftart, Schriftgröße und Zeilenabstand (Faktor, 1 = Standard), 2 oder 3 Spalten */
const PDF_DEF = { font: 'helvetica', size: 1, space: 1, cols: 2 };
const PDF_FONTS = [['helvetica', 'Klar', 'Helvetica, Arial, sans-serif'], ['times', 'Klassisch', '"Times New Roman", Times, serif'], ['courier', 'Schreibmaschine', '"Courier New", Courier, monospace']];
function pdfOpt() {
    const o = { ...PDF_DEF, ...(LS.get('pdfo', null) || {}) };
    if (!PDF_FONTS.some(f => f[0] === o.font)) o.font = PDF_DEF.font;
    o.size = +o.size >= .7 && +o.size <= 1.5 ? +o.size : 1;
    o.space = +o.space >= .3 && +o.space <= 2 ? +o.space : 1;
    o.cols = +o.cols === 3 ? 3 : 2;
    return o;
}
/** Die Angaben für den Einkaufszettel (pdf.js). Eine leere Liste ergibt einen leeren Zettel zum Selberschreiben. */
function listPdfData(extra, opt) {
    const n = openItems().length;
    return {
        title: curList().n,
        date: new Date().toLocaleDateString(locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
        count: n === 1 ? tr('1 Eintrag') : n ? tr('{0} Einträge', n) : '',
        sections: listGroups().map(([id, items]) => ({ name: catName(id), items: items.map(it => ({ n: dn(it.n), q: paperNote(it.note) })) })),
        extra: !n ? { name: '', lines: -1 } : extra ? { name: tr('Noch dazu'), lines: 6 } : null,   // leere Liste: ganze Seite Schreiblinien
        more: tr('Forts.'), brand: 'Kaufen', page: (i, k) => tr('Seite {0} von {1}', i, k), opt: opt || pdfOpt(),
    };
}
const listPdf = extra => self.kfPdf(listPdfData(extra));
/** Kann das Gerät Dateien teilen (Handy: teilen, drucken, in Dateien sichern)? */
function canShareFiles() {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] })); } catch (e) { return false; }
}

function showExport() {
    if (!curList() || !L) return;
    const sh = sheet(tr('Drucken und Teilen'));
    let o = pdfOpt();
    const ex = h('input', { type: 'checkbox', checked: LS.get('pdfx', true), onchange: () => { LS.set('pdfx', ex.checked); redraw(); } });
    /* Vorschau: dasselbe Layout wie im PDF, auf Canvas gezeichnet. Bleibt beim Rollen oben stehen, Antippen macht sie groß. */
    const prev = h('div', { class: 'pdfprev', role: 'img', 'aria-label': tr('Vorschau'), title: tr('Antippen zum Vergrößern'), onclick: () => { prev.parentNode.classList.toggle('big', prev.classList.toggle('big')); redraw(); } });
    const pinfo = h('div', { class: 'pdfinfo' });
    let raf = 0;
    function redraw() {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
            if (typeof self.kfPdfLayout !== 'function') return;
            const lay = self.kfPdfLayout(listPdfData(ex.checked, o));
            const big = prev.classList.contains('big'), avail = prev.clientWidth || 300, dpr = Math.min(3, window.devicePixelRatio || 1);
            const w = big ? Math.min(avail, 640) : Math.min(avail * (lay.pages > 1 ? .72 : 1), Math.min(innerHeight * .38, 340) * lay.width / lay.height);
            const pages = [];
            for (let i = 0; i < lay.pages; i++) {
                const c = h('canvas', { class: 'pdfpage' });
                c.width = Math.round(w * dpr);
                c.height = Math.round(w * dpr * lay.height / lay.width);
                c.style.width = Math.round(w) + 'px';
                const ctx = c.getContext('2d');
                ctx.scale(w * dpr / lay.width, w * dpr / lay.width);
                lay.draw(ctx, i);
                pages.push(c);
            }
            prev.replaceChildren(...pages);
            pinfo.textContent = (lay.pages === 1 ? tr('1 Seite') : tr('{0} Seiten', lay.pages)) + ' · ' + tr(big ? 'Antippen zum Verkleinern' : 'Antippen zum Vergrößern');
        });
    }
    const setO = patch => { o = { ...o, ...patch }; LS.set('pdfo', o); showO(); redraw(); };
    const fontBtns = PDF_FONTS.map(([k, name, css]) => { const b = h('button', { class: 'chip', type: 'button', onclick: () => setO({ font: k }) }, tr(name)); b.style.fontFamily = css; return b; });   // style-Attribut verbietet die CSP
    const colBtns = [2, 3].map(n => h('button', { class: 'chip', type: 'button', onclick: () => setO({ cols: n }) }, tr('{0} Spalten', n)));
    const slider = (k, name, lo, hi, step) => {
        const out = h('b');
        const r = h('input', { type: 'range', min: String(lo), max: String(hi), step: String(step), 'aria-label': tr(name),
            oninput: () => { out.textContent = r.value + ' %'; setO({ [k]: +r.value / 100 }); } });
        return { k, r, out, node: h('label', { class: 'sl fs' }, h('span', { class: 'fsl' }, tr(name), out), r) };
    };
    const sliders = [slider('size', 'Schriftgröße', 70, 150, 5), slider('space', 'Zeilenabstand', 30, 200, 10)];
    const showO = () => {
        fontBtns.forEach((b, i) => b.classList.toggle('sel', PDF_FONTS[i][0] === o.font));
        colBtns.forEach((b, i) => b.classList.toggle('sel', [2, 3][i] === o.cols));
        for (const x of sliders) { x.r.value = String(Math.round(o[x.k] * 100)); x.out.textContent = x.r.value + ' %'; }
    };
    const resetBtn = h('button', { class: 'btn small', type: 'button', onclick: () => { o = { ...PDF_DEF }; LS.set('pdfo', null); showO(); redraw(); } }, tr('Zurücksetzen'));
    const pdf = async share => {
        if (typeof self.kfPdf !== 'function') return toast(tr('Das PDF lässt sich gerade nicht erstellen. Lade die Seite neu.'));
        const bytes = listPdf(ex.checked), name = exportName('pdf');
        if (!share) return download(name, bytes, 'application/pdf');
        try { await navigator.share({ files: [new File([bytes], name, { type: 'application/pdf' })], title: curList().n }); }
        catch (e) { if (!e || e.name !== 'AbortError') download(name, bytes, 'application/pdf'); }
    };
    const empty = () => !openItems().length && (toast(tr('Die Liste ist leer, es gibt nichts zu teilen.')), true);
    const btn = (label, fn, primary) => h('button', { class: 'btn' + (primary ? ' primary' : ''), type: 'button', onclick: fn }, label);
    const files = canShareFiles();
    put(sh.body,
        h('div', { class: 'pdfwrap' }, prev, pinfo),
        h('h2', null, tr('Einkaufszettel')),
        h('p', { class: 'info' }, tr('Zum Ausdrucken, falls das Handy mal zu Hause bleibt: nach Warengruppen in der Reihenfolge deines Ladens, mit Kästchen zum Abhaken. Die Vorschau oben zeigt genau, was aus dem Drucker kommt. Ist die Liste leer, gibt es einen leeren Zettel zum Selberschreiben.')),
        h('div', { class: 'btns' },
            files && btn(tr('PDF teilen oder drucken'), () => pdf(true), true),
            btn(tr('PDF speichern'), () => pdf(false), !files)),
        h('div', { class: 'qlabel gap' }, tr('Schriftart')),
        h('div', { class: 'chips pdfopt' }, fontBtns),
        sliders.map(x => x.node),
        h('div', { class: 'qlabel' }, tr('Spalten')),
        h('div', { class: 'chips pdfopt' }, colBtns),
        h('label', { class: 'check' }, ex, h('span', null, tr('Leere Zeilen „Noch dazu“ zum Dazuschreiben'))),
        h('div', { class: 'btns pdfreset' }, resetBtn),
        h('h2', null, tr('Als Text')),
        h('p', { class: 'info' }, tr('Für WhatsApp, Mail und Co. oder als Datei zum Aufheben. Über „Aus Text einfügen“ kommt so ein Text wieder auf eine Liste.')),
        h('div', { class: 'btns' },
            btn(tr('Text teilen'), () => { if (!empty()) { sh.close(); shareText(); } }, true),
            btn(tr('Textdatei speichern'), () => { if (!empty()) download(exportName('txt'), '﻿' + listText().replace(/\n/g, '\r\n') + '\r\n', 'text/plain;charset=utf-8'); })));
    showO();
    redraw();
}

/** Die offene Liste als schlichten Text weitergeben (WhatsApp, Mail …), für Leute ohne Konto. Ohne Teilen-Funktion des Geräts wird kopiert. */
async function shareText() {
    const l = curList();
    if (!l || !L) return;
    if (!openItems().length) return toast(tr('Die Liste ist leer, es gibt nichts zu teilen.'));
    const text = listText();
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

/** Text in Einträge zerlegen. Versteht das eigene Format von oben („Obst & Gemüse:“, „- Äpfel (2 kg)“) und andere Listen mit
    Spiegelstrichen, Kästchen oder Nummern. Stehen solche Zeichen im Text, zählen nur diese Zeilen, der Rest (Titel, Grüße) bleibt draußen.
    Ohne solche Zeichen geht alles durch dieselbe Erkennung wie das Suchfeld („Milch, 2 kg Äpfel und Brot“).
    Überschriften mit Doppelpunkt, die wie eine Warengruppe heißen, gelten für unbekannte Produkte darunter. Abgehakte Zeilen ([x], ☑, ✓) fallen weg. */
const IMP_BUL = /^(?:[-*•·–—+▪◦○●]|\[ ?\]|[☐□▢]|\d{1,3}[.)](?=\s))\s*/;
const IMP_DONE = /^(?:\[[xX✓✔]\]|[☑☒✓✔✅])/;
function parseImport(text) {
    const lines = String(text).replace(/^﻿/, '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const bullets = lines.some(x => IMP_BUL.test(x) || IMP_DONE.test(x));
    const catBy = name => {
        const k = norm(name);
        if (k === norm(tr('Sonstiges')) || k === 'sonstiges' || k === 'other') return 0;
        const c = S.catalog.cats.find(c => [c.n, dc(c.n), enCat(c.n)].some(x => x && norm(x) === k));
        return c ? c.id : null;
    };
    const out = new Map();
    let cat = null;
    for (const line of lines) {
        if (IMP_DONE.test(line)) continue;
        const b = IMP_BUL.exec(line);
        if (!b && /:$/.test(line)) { cat = catBy(line.slice(0, -1)); continue; }
        if (bullets && !b) continue;
        const body = (b ? line.slice(b[0].length) : line).trim();
        if (!body) continue;
        const m = /^(.+?)\s*\((.+)\)$/.exec(body);   // „Äpfel (2 kg)“
        const items = m ? [entryOf(m[1].trim(), canonNote(m[2].trim().replace(/^(\d[\d,.]*\s*[½¼¾]?|[½¼¾])\s*[×x]$/i, '$1')).slice(0, 80))] : parseMulti(body);
        for (const x of items) {
            if (!x.known && cat != null) x.c = cat;
            out.delete(low(x.n));
            out.set(low(x.n), x);
        }
    }
    return [...out.values()].slice(0, 300);
}

function showImport() {
    if (!curList() || !L) return;
    const sh = sheet(tr('Aus Text einfügen'));
    let m = [], timer = 0;
    const isNew = x => { const it = itemByName(x.n); return !it || (x.note && x.note !== it.note); };
    const box = h('textarea', { placeholder: tr('Liste hier einfügen, z. B.\n- Milch (2 Liter)\n- Äpfel\noder einfach: Milch, 2 kg Äpfel und Brot'),
        oninput: () => { clearTimeout(timer); timer = setTimeout(draw, 250); } });
    const prev = h('div', { class: 'imp' });
    const go = h('button', { class: 'btn primary', type: 'button', disabled: true, onclick: () => {
        const todo = m.filter(isNew);
        if (!todo.length) return;
        addMulti(todo);
        sh.close();
    } }, tr('Auf die Liste'));
    const file = h('input', { type: 'file', accept: '.txt,.md,.csv,text/plain', hidden: true, onchange: async () => {
        const f = file.files[0];
        file.value = '';
        if (!f) return;
        if (f.size > 1e6) return toast(tr('Die Datei ist zu groß.'));
        box.value = await f.text();
        draw();
    } });
    function draw() {
        m = parseImport(box.value);
        const n = m.filter(isNew).length;
        go.disabled = !n;
        go.textContent = n > 1 ? tr('Alle {0} auf die Liste', n) : tr('Auf die Liste');
        const extra = x => { const it = itemByName(x.n); return it ? (isNew(x) ? tr('neue Menge') : tr('steht schon drauf')) : x.known ? '' : tr('neu: {0}', catName(x.c)); };
        fill(prev, m.length ? [
            h('h2', null, tr('Erkannt'), h('small', null, String(m.length))),
            m.map(x => h('div', { class: 'row plain' + (isNew(x) ? '' : ' off') }, h('span', { class: 'grow' }, dn(x.n),
                h('small', null, [paperNote(x.note), extra(x) || catName(x.c)].filter(Boolean).join(' · '))))),
        ] : box.value.trim() ? h('p', { class: 'info' }, tr('Darin ist nichts, was nach einem Produkt aussieht.')) : null);
    }
    put(sh.body,
        h('p', { class: 'info' }, tr('Text einfügen oder eine Textdatei öffnen. Kaufen versteht den eigenen Export („Liste als Text“), Listen mit Spiegelstrichen oder Kästchen und freien Text. Was schon auf der Liste steht, kommt nicht doppelt drauf.')),
        h('label', { class: 'field' }, box),
        h('div', { class: 'btns' }, h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, tr('Textdatei öffnen')), go),
        file, prev);
    if (!('ontouchstart' in window)) box.focus();
}

/* ---------- Demo ---------- */
const GH = 'https://github.com/burnersen/kaufen', SITE = 'https://tech.burnersen.de/';
/** Demo-Modus einschalten (Administrator): zwei Warnungen, dann eine Rechenaufgabe vom Server. Erst die richtige Lösung schaltet ihn ein. */
function demoOn() {
    confirmDlg(tr('Demo-Modus einschalten?'), tr('Achtung: Der Demo-Modus ist nur für einen öffentlichen Server gedacht, auf dem andere Kaufen ausprobieren. Für deine eigene Installation willst du ihn nicht! Danach gibt es auf diesem Server keine Konten und keine gemeinsamen Listen mehr.'),
        tr('Ich weiß, was ich tue'), () => {
            confirmDlg(tr('Wirklich sicher?'), tr('Das passiert: Alle werden abgemeldet, auch du. Anmelden, Konten, geteilte Listen und Mitteilungen gibt es nicht mehr, deine Listen auf dem Server sind nicht mehr zu erreichen. Jeder, der die Seite öffnet, nutzt Kaufen nur auf seinem Gerät. Kaufen holt sich neue Versionen ab dann von allein. Ein Zurück gibt es in der App nicht.'),
                tr('Ja, einschalten'), async () => {
                    let t;
                    try { t = await api('demo_task', {}); } catch (e) { toast(e.message); return; }
                    ask(tr('Letzte Sicherheitsfrage'), [
                        { type: 'info', text: tr('Rechne ohne Taschenrechner. Bei einem Fehler bleibt alles, wie es ist.') },
                        { k: 'answer', label: t.a + ' × ' + t.b + ' − ' + t.c + ' = ?', type: 'number' },
                    ], tr('Demo-Modus einschalten'), async v => {
                        try { await api('demo_on', { sure: 'DEMO', answer: String(v.answer).trim() }); }
                        catch (e) { toast(e.message, null, null, 6000); return; }   // falsch: Fenster zu, beim nächsten Versuch gibt es eine neue Aufgabe
                        LS.clear();
                        LS.set('mode', '');
                        location.replace('./');
                    });
                });
        });
}
/** „Zum Home-Bildschirm“: nur im Demo-Modus und nur im Browser (nicht in der installierten App). „Später“ gilt bis zum nächsten Start, „Nicht mehr zeigen“ für immer. */
let installEvt = null, a2hsLater = false;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (DEMO) render(); });
const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Safari am Mac: kann kein „Installieren“, legt Seiten aber über Ablage → Zum Dock hinzufügen ab */
const isMacSafari = () => { const ua = navigator.userAgent; return /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|Firefox|OPR/.test(ua); };
function demoBanner() {
    if (!DEMO || standalone() || a2hsLater || LS.get('a2hsNo', false)) return null;
    // iPhone und iPad: Teilen sitzt je nach Gerät, Ansicht und Browser unten, oben oder hinter „…“
    const how = installEvt ? null : isIOS() ? tr('So geht es: im Browser auf Teilen tippen (das Kästchen mit dem Pfeil nach oben, je nach Ansicht unten, oben oder hinter „…“), dann auf „Zum Home-Bildschirm“.')
        : /Android/i.test(navigator.userAgent) ? tr('So geht es: im Browsermenü (⋮) auf „App installieren“ oder „Zum Startbildschirm hinzufügen“ tippen.')
        : isMacSafari() ? tr('So geht es: in Safari oben im Menü Ablage → „Zum Dock hinzufügen“ wählen.')
        : tr('So geht es: im Browser über das Symbol in der Adresszeile oder im Menü „Installieren“ wählen. Nicht jeder Browser bietet das an, Chrome und Edge schon.');
    return h('div', { class: 'a2hs', role: 'region', 'aria-label': tr('Kaufen auf den Home-Bildschirm') },
        h('b', null, tr('Kaufen auf den Home-Bildschirm')),
        h('p', null, tr('Dann startet Kaufen wie eine App, auch ohne Netz, und bekommt neue Versionen von allein. Ohne Anmeldung: alle Listen bleiben nur auf diesem Gerät, Teilen mit anderen gibt es hier nicht.')),
        how && h('p', { class: 'how' }, how),
        // Wer mehr will: selbst hosten, dann auch mit Teilen
        h('p', { class: 'self' }, tr('Du willst Kaufen selbst hosten und deine Listen mit anderen teilen? Dann besuch das Projekt auf GitHub: eine Datei laut Anleitung auf deinen Webspace laden, fertig.'), ' ',
            h('a', { href: ghDoc('installation'), target: '_blank', rel: 'noopener' }, tr('Zur Anleitung'))),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: () => { LS.set('a2hsNo', true); render(); } }, tr('Nicht mehr zeigen')),
            h('button', { class: 'btn', type: 'button', onclick: () => { a2hsLater = true; render(); } }, tr('Später')),
            installEvt && h('button', { class: 'btn primary', type: 'button', onclick: async () => {
                const e = installEvt;
                installEvt = null;
                e.prompt();
                try { if ((await e.userChoice).outcome === 'accepted') a2hsLater = true; } catch (x) {}
                render();
            } }, tr('Installieren'))));
}
window.addEventListener('appinstalled', () => { a2hsLater = true; if (DEMO) render(); });
/** Die ausführliche Anleitung auf GitHub, auf Englisch die englische */
const ghDoc = (sec = '') => (lang === 'en' ? GH + '/blob/main/README.en.md' : GH) + (sec ? '#' + sec : '');
/** Ganz unten: was die Demo ist, dazu gut sichtbar die eigene Seite und Kaufen auf GitHub */
const demoFoot = () => DEMO && h('footer', { class: 'demofoot' },
    h('p', null, tr('Das ist die Demo von Kaufen, alles bleibt auf deinem Gerät.')),
    h('div', { class: 'links' },
        h('a', { class: 'btn', href: SITE, target: '_blank', rel: 'noopener' }, icon(I.globe), 'tech.burnersen.de'),
        h('a', { class: 'btn', href: ghDoc(), target: '_blank', rel: 'noopener' }, icon(I.code), tr('Kaufen auf GitHub'))),
    h('p', null, tr('Kaufen ist kostenlos. Selbst gehostet auf deinem Webspace kannst du deine Listen auch mit anderen teilen.')));

/* ---------- Hilfe: kurz und knapp, wie Kaufen bedient wird. Die ausführliche Fassung steht auf GitHub. ---------- */
function showHelp() {
    if (!LS.get('helpSeen', false)) { LS.set('helpSeen', true); render(); }
    const sh = sheet(tr('Hilfe'));
    const solo = LOCAL || DEMO;
    const sec = (title, ...kids) => [h('h2', null, title), ...kids];
    const p = (...t) => h('p', null, ...t);
    const dl = rows => h('dl', null, rows.map(([g, t]) => [h('dt', null, g), h('dd', null, t)]));
    // Die Knöpfe oben genau so, wie sie aussehen
    const svg = sel => { const s = $(sel + ' svg'); return s ? s.cloneNode(true) : null; };
    put(sh.body, h('div', { class: 'help' },
        sec(tr('Auf die Liste'),
            p(tr('Ein Produkt im Katalog antippen oder oben ins Suchfeld tippen. Mehrere auf einmal gehen auch, sogar mit Menge: „Milch, 2 kg Äpfel und Brot“, dann Enter. Diktieren klappt genauso. Was es noch nicht gibt, legst du direkt aus der Suche an.'))),
        sec(tr('Auf der Liste'),
            dl([[tr('Antippen'), tr('Abhaken, es bleibt durchgestrichen an seinem Platz stehen.')],
                [tr('Zweimal tippen'), tr('Holt Durchgestrichenes zurück auf die Liste.')],
                [tr('Nach links wischen'), tr('Löschen, ein paar Sekunden lang mit „Rückgängig“')],
                [tr('Nach rechts wischen'), tr('Menge und Hinweis')],
                [tr('1 Sekunde halten'), tr('Warengruppe wechseln, dazu Menge und Löschen. Ein Ring zeigt, wann es so weit ist.')]])),
        sec(tr('Im Katalog'),
            dl([[tr('Antippen'), tr('Auf die Liste oder wieder runter')],
                [tr('Kurz halten'), tr('Erst Menge und Hinweis wählen, dann auf die Liste')],
                [tr('Warengruppe antippen'), tr('Auf- und zuklappen, genauso „Bald wieder fällig“. „+ Neu“ legt dort ein Produkt an.')]])),
        sec(tr('Menge'),
            p(tr('Plus und Minus zählen, gedrückt halten zählt schneller, ½ gibt Halbe. Dazu eine Einheit antippen, mehr gibt es unter „Weitere …“, eigene mit „+ Einheit“. Darunter ist Platz für einen Hinweis, etwa „die grünen“.'),
                look.keep ? ' ' + tr('Beim Abhaken merkt sich Kaufen die Menge fürs nächste Mal.') : '')),
        sec(tr('Im Laden'),
            p(tr('Abhaken, was im Wagen liegt. „Einkauf fertig“ unten nimmt alles Abgehakte von der Liste, der Rest bleibt für den nächsten Laden.'))),
        sec(tr('Bald wieder fällig'),
            p(tr('Kaufen merkt sich, wie oft du etwas kaufst. Schon nach dem zweiten Kauf schlägt „Bald wieder fällig“ unter der Liste vor, was kurz vor dem nächsten Mal steht. Antippen setzt es auf die Liste, lang drücken schaltet den Vorschlag für dieses Produkt ab. Sind es mehr als 16, zeigt „Alle anzeigen“ den Rest.')),
            look.auto > 0 && p(tr('Kaufst du etwas {0} Wochen lang im gleichen Abstand, kommt es von allein auf die Liste. Lang drücken, dann lässt sich das für ein Produkt abschalten.', look.auto / 7)),
            p(tr('Ab dem wievielten Kauf vorgeschlagen wird und ob Regelmäßiges von allein auf die Liste kommt, stellst du in den Einstellungen ein.'))),
        sec(tr('Oben'),
            dl([[tr('Listenname'), tr('Liste wechseln oder eine neue anlegen')],
                [tr('Suchfeld'), tr('Suchen, eintippen oder diktieren, das ✕ leert es')],
                [[svg('#viewBtn'), tr('Ansicht')], tr('Kacheln oder Liste')],
                [[svg('#menuBtn'), tr('Menü')], tr('Vorlagen, Reihenfolge im Laden, Drucken und Teilen, Aus Text einfügen, Katalog verwalten, Einstellungen und diese Hilfe')]])),
        sec(tr('In den Fenstern'),
            dl([[tr('Reihenfolge im Laden'), tr('Warengruppe am Griff nach oben oder unten ziehen oder die Pfeile antippen')],
                [tr('Vorlagen'), tr('Antippen setzt alles auf die Liste, der Stift bearbeitet')],
                [tr('Schließen'), tr('Das ✕ oben oder ein Tipp daneben')]])),
        sec(tr('Aussehen'),
            p(tr('Schrift, Design und Farben stellst du in den Einstellungen für jede Liste und jede Ansicht einzeln ein, die Ansicht für jede Liste. „Für alle Listen und Ansichten übernehmen“ macht alles überall gleich.')),
            p(tr('Jede Warengruppe hat ein Symbol. Ein eigenes Bild oder Emoji wählst du unter Menü → Katalog verwalten → Ändern → Symbol.'))),
        sec(tr('Am Rechner'),
            p(tr('Mit gedrückter Maus ziehen statt wischen, Rechtsklick statt halten, Doppelklick statt zweimal tippen. Enter im Suchfeld nimmt den ersten Treffer, Esc schließt ein Fenster.'))),
        sec(tr('Gut zu wissen'),
            p(solo ? tr('Alles bleibt auf diesem Gerät, auch ohne Netz geht alles. Mach ab und zu eine Sicherung als Datei (im Menü), sonst ist alles weg, wenn die Browserdaten gelöscht werden.')
                : tr('Geteilte Listen gleichen sich nach ein paar Sekunden ab. Ohne Netz geht alles weiter, Änderungen werden nachgereicht.'))),
        p(h('a', { href: ghDoc(), target: '_blank', rel: 'noopener' }, tr('Ausführliche Anleitung auf GitHub')))),
        h('div', { class: 'btns' }, h('button', { class: 'btn primary', type: 'button', onclick: () => sh.close() }, tr('Alles klar'))));
}
/** Einmal beim ersten Start: wo die Hilfe ist. Schließen oder die Hilfe öffnen, dann kommt der Kasten nie wieder. */
function helpHint() {
    if (LS.get('helpSeen', false)) return null;
    const done = () => { LS.set('helpSeen', true); render(); };
    return h('div', { class: 'a2hs helphint', role: 'region', 'aria-label': tr('Neu bei Kaufen?') },
        h('b', null, tr('Neu bei Kaufen?')),
        h('p', null, tr('Antippen hakt ab, wischen löscht oder ändert die Menge, halten wechselt die Warengruppe. Die Hilfe erklärt alles kurz, später findest du sie im Menü.')),
        h('div', { class: 'btns' },
            h('button', { class: 'btn', type: 'button', onclick: done }, tr('Schließen')),
            h('button', { class: 'btn primary', type: 'button', onclick: () => { done(); showHelp(); } }, tr('Hilfe ansehen'))));
}

function showMenu() {
    const sh = sheet(tr('Menü'));
    const btn = (label, fn) => h('button', { class: 'row', type: 'button', onclick: () => { sh.close(); fn(); } }, label);
    put(sh.body, 
        btn(tr('Listen'), showLists),
        L && btn(tr('Vorlagen'), showTemplates),
        L && btn(tr('Reihenfolge im Laden'), showOrder),
        L && btn(tr('Drucken und Teilen'), showExport),
        L && btn(tr('Aus Text einfügen'), showImport),
        btn(tr('Katalog verwalten'), showCatalog),
        S.me.admin && !LOCAL && btn(tr('Konten'), showUsers),
        S.me.admin && !LOCAL && btn([tr('Sicherung und Update'), S.upd && S.upd.v && h('span', { class: 'badge' }, tr('Neu: {0}', S.upd.v))], showMaint),
        LOCAL && btn(tr('Sicherung als Datei'), showLocalBackup),
        btn(tr('Hilfe'), showHelp),
        btn(tr('Einstellungen'), showSettings),
        LOCAL ? !DEMO && btn(tr('Lokalen Modus beenden'), leaveLocal) : btn(tr('Abmelden'), logout));
}

/* ---------- Sicherung und Update (nur Administrator) ---------- */
function showMaint() {
    const sh = sheet(tr('Sicherung und Update'));
    put(sh.body, h('p', { class: 'hint' }, tr('Lade …')));
    let st = null, busy = false;
    const load = async (action, body) => {
        if (busy) return;
        busy = true;
        try { st = await api(action || 'maint', body); } catch (e) { toast(e.message); }
        busy = false;
        if (st) draw();
    };
    // Nach Update, Rückkehr oder Einspielen: neu laden, damit Seite, Dateien und Daten zusammenpassen
    const reload = text => { toast(text); setTimeout(() => location.reload(), 1500); };
    const install = () => confirmDlg(tr('Auf Kaufen {0} aktualisieren?', st.info.v),
        tr('Die laufende Version wird vorher gesichert, zurück geht es jederzeit hier. Deine Daten bleiben, wie sie sind.'), tr('Jetzt aktualisieren'),
        async () => { const r = await api('upd_install', {}); sh.close(); reload(tr('Kaufen {0} ist installiert.', r.v)); });
    const rollback = () => confirmDlg(tr('Zurück zu Kaufen {0}?', st.prev), tr('Die Programmdateien von vor dem letzten Update kommen zurück. Deine Daten bleiben, wie sie sind.'),
        tr('Zurück'), async () => { const r = await api('upd_rollback', {}); sh.close(); reload(tr('Kaufen {0} ist wieder da.', r.v)); });
    const pick = () => {
        const inp = h('input', { type: 'file', accept: '.sqlite,.db,application/octet-stream,application/x-sqlite3', hidden: true, onchange: () => {
            const f = inp.files[0];
            inp.remove();
            if (!f) return;
            confirmDlg(tr('Sicherung einspielen'), tr('Alles wird durch den Stand aus „{0}“ ersetzt: Konten, Listen, Katalog, Vorlagen. Der jetzige Stand bleibt aufgehoben und lässt sich hier zurückholen. Danach musst du dich vielleicht neu anmelden.', f.name),
                tr('Einspielen'), async () => {
                    const r = await fetch('?action=backup_put', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/octet-stream', 'X-CSRF': csrf }, body: f });
                    const j = await r.json().catch(() => ({}));
                    if (!r.ok) throw new Error(j.error || tr('Der Server antwortet nicht richtig ({0}).', r.status));
                    sh.close();
                    reload(tr('Die Sicherung ist eingespielt.'));
                });
        } });
        document.body.append(inp);
        inp.click();
    };
    const undo = () => confirmDlg(tr('Vorigen Stand zurückholen'), tr('Der Stand von vor dem letzten Einspielen kommt zurück, der jetzige wird dafür beiseitegelegt.'), tr('Zurückholen'),
        async () => { await api('backup_undo', {}); sh.close(); reload(tr('Der vorige Stand ist zurück.')); });
    // Release-Hinweise von GitHub (Markdown) als schlichter Text: ohne Rauten, Sternchen, Links und „by @… in https://…“
    const plain = t => String(t).replace(/^\*\*Full Changelog\*\*.*$/gm, '').replace(/ by @[\w-]+ in https?:\/\/\S+/g, '').replace(/^#+\s*/gm, '')
        .replace(/^\s*[*-]\s+/gm, '• ').replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
    function draw() {
        const autoBox = h('input', { type: 'checkbox', checked: st.auto, disabled: st.off, onchange: () => load('upd_auto', { on: autoBox.checked }) });
        fill(sh.body,
            h('div', { class: 'qlabel' }, tr('Update')),
            h('p', null, tr('Installiert ist Kaufen {0}.', st.have)),
            st.error && h('p', { class: 'err' }, st.error),
            st.newer && [h('p', { class: 'upnew' }, tr('Neu: Kaufen {0}', st.info.v)),
                plain(st.info.notes || '') && h('div', { class: 'notes' }, plain(st.info.notes)),
                st.info.page && h('p', { class: 'info' }, h('a', { href: st.info.page, target: '_blank', rel: 'noopener' }, tr('Alles dazu auf GitHub'))),
                st.locked ? h('p', { class: 'err' }, tr('PHP darf die Datei {0} nicht überschreiben. Bitte von Hand aktualisieren oder die Schreibrechte ändern.', st.locked))
                          : h('button', { class: 'btn primary wide', type: 'button', onclick: install }, tr('Jetzt aktualisieren'))],
            !st.newer && st.at > 0 && !st.error && h('p', { class: 'info' }, tr('Das ist die neueste Version (nachgesehen {0}).', fmtTime(st.at))),
            !st.off && h('button', { class: 'btn wide', type: 'button', onclick: () => load('upd_check', {}) }, tr('Jetzt nach Updates suchen')),
            !st.off && h('label', { class: 'check' }, autoBox, h('span', null, tr('Einmal am Tag automatisch nachsehen'))),
            h('p', { class: 'info' }, st.off ? tr('Updates sind auf diesem Server abgeschaltet (data/config.php).')
                : tr('Dafür fragt dein Server bei GitHub nach, wo Kaufen veröffentlicht wird. Persönliches geht dabei nicht raus, und eingespielt wird nur, wenn du auf „Jetzt aktualisieren“ tippst.')),
            st.prev && h('button', { class: 'btn wide', type: 'button', onclick: rollback }, tr('Zurück zu Kaufen {0}', st.prev)),
            h('div', { class: 'qlabel gap' }, tr('Datensicherung')),
            h('p', { class: 'info' }, tr('Alles in einer Datei: Konten, Listen, Katalog, Vorlagen und Einstellungen. Gut aufheben, sie enthält auch die verschlüsselten Passwörter.')),
            h('a', { class: 'btn wide', href: '?action=backup_get', download: '' }, tr('Sicherung herunterladen')),
            h('button', { class: 'btn wide', type: 'button', onclick: pick }, tr('Sicherung einspielen …')),
            st.restoreAt > 0 && h('button', { class: 'btn wide', type: 'button', onclick: undo }, tr('Stand vor dem Einspielen zurückholen ({0})', fmtTime(st.restoreAt))));
    }
    load();
}
/** Tägliches Nachsehen (eingeschaltet in „Sicherung und Update“): einmal pro Start, wenn der Server sagt, dass es dran ist */
let updAsked = false;
async function updAuto() {
    if (updAsked || !S || !S.upd || !S.upd.check) return;
    updAsked = true;
    try {
        const r = await api('upd_check', {});
        if (r.newer) S.upd.v = r.info.v;
    } catch (e) { return; }
    if (S.upd.v && LS.get('updSeen', '') !== S.upd.v) { LS.set('updSeen', S.upd.v); toast(tr('Kaufen {0} ist da: Menü → Sicherung und Update', S.upd.v)); }
}

/* ---------- Start ---------- */
$('#menuBtn').addEventListener('click', () => { if (S) showMenu(); });
$('#viewBtn').addEventListener('click', () => setView(VIEWS[(VIEWS.indexOf(curView()) + 1) % VIEWS.length]));
$('#listBtn').addEventListener('click', () => { if (S) showLists(); });
/* Neue Version im lokalen Modus (und in der Demo): höchstens einmal pro Stunde beim Server nach einem neuen Service Worker fragen.
   Ist einer übernommen, lädt Kaufen beim nächsten Zurückkommen neu, sofern gerade kein Fenster offen ist. Die Daten bleiben dabei, wie sie sind. */
let swNew = false, swAt = 0;
const swHad = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('controllerchange', () => { if (swHad) swNew = true; });
function swCheck() {
    if (!LOCAL || !('serviceWorker' in navigator) || Date.now() - swAt < 3600e3) return;
    swAt = Date.now();
    navigator.serviceWorker.getRegistration().then(r => r && r.update()).catch(() => {});
}
document.addEventListener('visibilitychange', () => {
    wake();
    if (document.hidden) { clearTimeout(timer); pushDone(); return; }
    if (swNew && LOCAL && !sheets.length) { location.reload(); return; }
    tick();
    swCheck();
});
window.addEventListener('pagehide', pushDone);
window.addEventListener('online', tick);
window.addEventListener('offline', () => setOnline(false));

applyTheme();
applyFont();
applyLang();
render();
// „Ohne Konto nutzen“ auf der Anmeldeseite, oder lokal, aber die Daten sind weg (Browserdaten gelöscht): frisch anfangen
const wantLocal = (!LOCAL && (DEMO || /[?&]local=1(&|$)/.test(location.search))) || (LOCAL && !self.kfLocal.has());
if (wantLocal) localBegin(); else tick();
if (LOCAL) { swLocal(true); askPersist(); setTimeout(swCheck, 5000); }
wake();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
    navigator.serviceWorker.register('./?action=sw', { scope: './' }).then(precache).catch(() => {});
}
})();
