/* Kaufen – lokaler Modus: alles bleibt auf diesem Gerät.
   Beantwortet dieselben Aktionen wie der Server (app/routes/api.php), aber hier im Browser. Gespeichert wird alles in localStorage
   unter kf_ldb. app.js merkt davon fast nichts: api() fragt im lokalen Modus nicht den Server, sondern kfLocal.api().
   So bleibt es dieselbe App und bekommt jede Verbesserung mit. Was es ohne Server nicht geben kann (Konten, Teilen, Mitteilungen,
   Sicherung und Update des Servers), meldet „Im lokalen Modus nicht verfügbar.“
   Fehler kommen als Error mit .key (deutscher Text, zugleich Schlüssel für die Übersetzung) und .args (Platzhalter {0}, {1}). */
(function () {
    'use strict';
    const KEY = 'kf_ldb';
    const now = () => Math.floor(Date.now() / 1000);
    const low = s => String(s).toLowerCase();
    const same = (a, b) => low(a) === low(b);
    /** Wie kfClean auf dem Server: Steuerzeichen raus, Leerraum zusammenfassen, Länge in Zeichen begrenzen */
    const clean = (s, max) => (typeof s === 'string' || typeof s === 'number')
        ? Array.from(String(s).replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('') : '';
    /** Sortierung wie SQLite mit COLLATE NOCASE: nur A bis Z ohne Groß und klein, sonst nach Zeichencode */
    const nocase = s => String(s).replace(/[A-Z]/g, c => c.toLowerCase());
    const byName = (a, b) => { const x = nocase(a.n), y = nocase(b.n); return x < y ? -1 : x > y ? 1 : 0; };
    const fail = (key, ...args) => { throw Object.assign(new Error(key), { key, args, status: 400 }); };
    const NA = 'Im lokalen Modus nicht verfügbar.';

    let db = null;
    function load() {
        if (db) return db;
        try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
        if (!db || !Array.isArray(db.lists)) fail('Die lokalen Daten fehlen. Spiel eine Sicherung ein oder fang neu an.');
        return db;
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(db)); }
        catch (e) { fail('Der Speicher auf diesem Gerät ist voll.'); }
    }
    const id = () => db.seq++;
    const version = () => document.documentElement.dataset.v || '';
    const listOf = lid => db.lists.find(l => l.id === +lid) || fail('Diese Liste gibt es nicht (mehr) oder du bist kein Mitglied.');
    const touch = l => { l.v = (l.v || 1) + 1; };

    /* ---------- Katalog ---------- */
    const catalog = () => ({
        cats: db.cats.map(c => ({ id: c.id, n: c.n, ...(c.e ? { e: c.e } : {}) })),
        products: db.products.slice().sort(byName).map(p => ({ id: p.id, c: p.c, n: p.n, ...(p.e ? { e: p.e } : {}) })),
    });
    /** Der Katalog als einfache Liste (Gruppe + Produktnamen), so wie ihn der Server sichert und einspielt */
    function catalogExport() {
        return db.cats.map(c => ({ name: c.n, ...(c.e ? { en: c.e } : {}),
            products: db.products.filter(p => p.c === c.id).sort((a, b) => a.id - b.id).map(p => p.e ? { de: p.n, en: p.e } : p.n) }));
    }
    function catalogBackup(reason) {
        const data = catalogExport();
        if (!data.length) return;
        db.cbackups = db.cbackups || [];
        db.cbackups.unshift({ id: id(), at: now(), reason, cats: data.length, products: data.reduce((n, c) => n + c.products.length, 0), data });
        db.cbackups = db.cbackups.slice(0, 5);
    }
    /** Ersetzt den ganzen Katalog. Einträge, Gekauftes, Vorlagen und Reihenfolge werden über den Namen der Warengruppe umgehängt. */
    function catalogReplace(data) {
        const old = new Map(db.cats.map(c => [c.id, low(c.n)]));
        db.cats = [];
        db.products = [];
        const fresh = new Map();
        for (const c of data || []) {
            if (!c || typeof c !== 'object') continue;
            const name = clean(c.name, 60);
            if (!name || fresh.has(low(name))) continue;
            const cat = { id: id(), n: name, e: clean(typeof c.en === 'string' ? c.en : '', 60) };
            db.cats.push(cat);
            fresh.set(low(name), cat.id);
            for (let p of Array.isArray(c.products) ? c.products : []) {
                const en = p && typeof p === 'object' ? clean(typeof p.en === 'string' ? p.en : '', 60) : '';
                p = clean(p && typeof p === 'object' ? (typeof p.de === 'string' ? p.de : '') : p, 60);
                if (p && !db.products.some(x => same(x.n, p))) db.products.push({ id: id(), c: cat.id, n: p, e: en });
            }
        }
        const remap = c => (old.has(c) ? fresh.get(old.get(c)) || 0 : c);
        const byProd = n => { const p = db.products.find(x => same(x.n, n)); return p ? p.c : 0; };
        const ok = new Set(db.cats.map(c => c.id));
        const fix = x => { x.c = remap(x.c); if (!ok.has(x.c)) x.c = byProd(x.n); };
        for (const l of db.lists) {
            l.items.forEach(fix);
            l.usage.forEach(fix);
            l.order = l.order.map(remap).filter(Boolean);
            touch(l);
        }
        for (const t of db.tpls) t.items.forEach(fix);
        db.cv++;
    }

    /* ---------- Listen ---------- */
    function listData(l) {
        const since = now() - 120 * 86400;
        const usage = l.usage.slice().sort((a, b) => b.last - a.last).slice(0, 800).filter((u, i) => i < 80 || u.last >= since)
            .map(u => ({ n: u.n, c: u.c, cnt: u.cnt, last: u.last, g: u.g, gn: u.gn, rs: u.rs || 0, am: u.am || 0 }));
        const mem = l.usage.filter(u => u.note).sort((a, b) => b.last - a.last).slice(0, 2000).map(u => [u.n, u.note]);
        const items = l.items.slice().sort((a, b) => a.at - b.at || (a.uid < b.uid ? -1 : 1))
            .map(i => ({ uid: i.uid, n: i.n, c: i.c, note: i.note, by: i.by, at: i.at, got: i.got || 0 }));
        return { id: l.id, v: l.v, items, usage, order: l.order.slice(), mem };
    }
    function state(extra) {
        const me = db.me;
        return Object.assign({
            me: { id: me.id, n: me.n, admin: true, look: db.look || null }, csrf: 'local', version: version(), interval: 5,
            cv: db.cv, lv: db.lv, startList: db.start || 0, push: '', local: true,
            users: [{ id: me.id, n: me.n, admin: true }],
            lists: db.lists.map(l => ({ id: l.id, n: l.n, owner: me.id, count: l.items.filter(i => !i.got).length, members: [me.id] })),
            catalog: catalog(),
            templates: db.tpls.slice().sort(byName).map(t => ({ id: t.id, n: t.n, items: t.items.map(i => ({ n: i.n, c: i.c, note: i.note })) })),
            upd: null,
        }, extra || {});
    }

    /* Gekauft: Zähler, Kaufrhythmus und ob regelmäßig (rs) lernen, genau wie kfUsageBought auf dem Server */
    function usageBought(l, it, t) {
        const u = l.usage.find(x => same(x.n, it.n));
        let gap = u ? u.g : 0, gn = u ? u.gn : 0, rs = u ? u.rs || 0 : 0, d = u ? t - u.last : 0;
        if (u && d >= 43200) {
            if (gap <= 0 || Math.abs(d - gap) > .35 * gap || rs <= 0) rs = u.last;
            if (gap > 0) d = Math.min(d, 3 * gap);
            gap = gap > 0 ? Math.round(gap * .6 + d * .4) : d;
            gn = gn >= 0 ? gn + 1 : gn - 1;
        }
        const prev = u ? u.last + ',' + u.g + ',' + u.gn + ',' + (u.rs || 0) : '';
        if (u) Object.assign(u, { cnt: u.cnt + 1, last: t, c: it.c, note: it.note, g: gap, gn, rs, prev });
        else l.usage.push({ n: it.n, c: it.c, cnt: 1, last: t, note: it.note, g: gap, gn, rs, am: 0, prev });
    }
    /* Abhaken rückgängig: Zähler und Kaufrhythmus wie vorher (kfUsageUndo) */
    function usageUndo(l, name) {
        const u = l.usage.find(x => same(x.n, name));
        if (!u) return;
        const p = String(u.prev || '').split(',');
        if (p.length >= 3) Object.assign(u, { cnt: u.cnt - 1, last: +p[0], g: +p[1], gn: +p[2], rs: +(p[3] || 0), prev: '' });
        else u.cnt--;
        if (u.cnt <= 0) l.usage = l.usage.filter(x => x !== u);
    }
    const uidOk = s => /^[A-Za-z0-9_-]{8,40}$/.test(String(s || ''));
    const findUid = uid => { for (const l of db.lists) { const it = l.items.find(i => i.uid === uid); if (it) return it; } return null; };

    /** Änderungen an einer Liste, wie kfApplyOps: jede darf ohne Schaden doppelt ankommen */
    function applyOps(l, ops) {
        let changed = false;
        const t = now();
        for (const op of (Array.isArray(ops) ? ops : []).slice(0, 500)) {
            if (!op || typeof op !== 'object') continue;
            const k = String(op.t || ''), uid = String(op.uid || ''), ok = uidOk(uid);
            const name = clean(op.n, 60), cat = Math.max(0, +op.c || 0), note = clean(op.note, 80);
            const open = n => l.items.find(i => !i.got && same(i.n, n));
            const dropBasket = n => { l.items = l.items.filter(i => !(i.got && same(i.n, n))); };
            if (k === 'auto' && ok && name) {   // automatisch auf die Liste, pro Kauf nur einmal (wie auf dem Server)
                if (findUid(uid)) continue;
                const u = l.usage.find(x => same(x.n, name));
                if (!u || (u.am || 0) < 0 || u.am === u.last) continue;
                u.am = u.last;
                changed = true;
                if (open(name)) continue;
                dropBasket(name);
                l.items.push({ uid, n: name, c: cat, note, by: db.me.id, at: t, got: 0 });
            } else if ((k === 'noauto' || k === 'reauto') && name) {
                const u = l.usage.find(x => same(x.n, name));
                if (u && k === 'noauto' && (u.am || 0) >= 0) { u.am = -1; changed = true; }
                if (u && k === 'reauto' && (u.am || 0) < 0) { u.am = 0; changed = true; }
            } else if ((k === 'add' || k === 'restore') && ok && name) {
                if (findUid(uid)) continue;
                const s = open(name);
                if (s) { if (note) { s.note = note; changed = true; } }
                else {
                    dropBasket(name);
                    l.items.push({ uid, n: name, c: cat, note, by: k === 'restore' && +op.by ? +op.by : db.me.id, at: t, got: 0 });
                    changed = true;
                }
                if (k === 'restore') usageUndo(l, name);
            } else if (k === 'got' && ok) {
                const it = l.items.find(i => i.uid === uid && !i.got);
                if (!it) continue;
                it.got = t;
                usageBought(l, it, t);
                changed = true;
            } else if (k === 'ungot' && ok) {
                const it = l.items.find(i => i.uid === uid && i.got);
                if (!it) continue;
                it.got = 0;
                usageUndo(l, it.n);
                changed = true;
            } else if (k === 'back' && ok && name) {
                if (findUid(uid) || open(name)) continue;
                const got = Math.max(0, Math.min(t, +op.got || 0));
                if (!got) dropBasket(name);
                else if (l.items.some(i => same(i.n, name))) continue;
                const at = +op.at || 0;
                l.items.push({ uid, n: name, c: cat, note, by: Math.max(0, +op.by || 0) || db.me.id, at: at > 0 && at <= t ? at : t, got });
                changed = true;
            } else if ((k === 'done' || k === 'remove') && ok) {
                const it = l.items.find(i => i.uid === uid);
                if (!it) continue;
                l.items = l.items.filter(i => i !== it);
                if (k === 'done' && !it.got) usageBought(l, it, t);
                changed = true;
            } else if (k === 'edit' && ok) {
                const it = l.items.find(i => i.uid === uid);
                if (it && (it.note !== note || it.c !== cat)) { it.note = note; it.c = cat; changed = true; }
            } else if (k === 'forget' && name) {
                const n = l.usage.length;
                l.usage = l.usage.filter(u => !same(u.n, name));
                changed = changed || l.usage.length !== n;
            } else if ((k === 'nodue' || k === 'redue') && name) {
                const u = l.usage.find(x => same(x.n, name));
                if (u && k === 'nodue' && u.gn >= 0) { u.gn = -1 - u.gn; changed = true; }
                if (u && k === 'redue' && u.gn < 0) { u.gn = u.gn < -1 ? -1 - u.gn : u.g > 0 ? 2 : 0; changed = true; }
            } else if (k === 'unmem' && name) {
                const u = l.usage.find(x => same(x.n, name));
                if (u && u.note) { u.note = ''; changed = true; }
            }
        }
        if (changed) touch(l);
    }

    /* ---------- Die Aktionen ---------- */
    const actions = {
        state: () => state(),
        list: q => listData(listOf(q.id)),
        poll: q => { const l = db.lists.find(x => x.id === +q.id); return { v: l ? l.v : null, cv: db.cv, lv: db.lv, iv: 5 }; },
        ops: b => { const l = listOf(b.list); applyOps(l, b.ops); return listData(l); },

        list_create: b => {
            const name = clean(b.name, 40);
            if (!name) fail('Bitte einen Namen eingeben.');
            if (db.lists.length >= 30) fail('Mehr als 30 eigene Listen gehen nicht.');
            const l = { id: id(), n: name, v: 1, items: [], usage: [], order: [] };
            db.lists.push(l);
            db.lv++;
            return state({ created: l.id });
        },
        list_rename: b => {
            const l = listOf(b.id), name = clean(b.name, 40);
            if (!name) fail('Bitte einen Namen eingeben.');
            l.n = name;
            db.lv++;
            return state();
        },
        list_delete: b => { listOf(b.id); db.lists = db.lists.filter(l => l.id !== +b.id); db.lv++; return state(); },
        list_order: b => {
            const l = listOf(b.id), seen = new Set();
            l.order = (Array.isArray(b.order) ? b.order : []).map(c => +c).filter(c => c > 0 && !seen.has(c) && seen.add(c)).slice(0, 200);
            touch(l);
            return listData(l);
        },

        cat_add: b => {
            const name = clean(b.name, 60);
            if (!name) fail('Bitte einen Namen eingeben.');
            if (db.cats.some(c => same(c.n, name))) fail('Diese Warengruppe gibt es schon.');
            db.cats.push({ id: id(), n: name, e: '' });
            db.cv++;
            return state();
        },
        cat_rename: b => {
            const name = clean(b.name, 60), c = db.cats.find(x => x.id === +b.id);
            if (!name) fail('Bitte einen Namen eingeben.');
            if (db.cats.some(x => same(x.n, name) && x.id !== +b.id)) fail('Diese Warengruppe gibt es schon.');
            if (c) { if (c.n !== name) c.e = ''; c.n = name; }
            db.cv++;
            return state();
        },
        cat_delete: b => {
            const c = db.cats.find(x => x.id === +b.id);
            if (!c) return state();
            catalogBackup('Vor dem Löschen von „' + c.n + '“');
            db.products = db.products.filter(p => p.c !== c.id);
            db.cats = db.cats.filter(x => x !== c);
            for (const l of db.lists) {
                l.order = l.order.filter(x => x !== c.id);
                for (const x of [...l.items, ...l.usage]) if (x.c === c.id) x.c = 0;
                touch(l);
            }
            for (const t of db.tpls) for (const x of t.items) if (x.c === c.id) x.c = 0;
            db.cv++;
            return state();
        },
        prod_add: b => {
            const name = clean(b.name, 60), cat = +b.cat;
            if (!name) fail('Bitte einen Namen eingeben.');
            if (!db.cats.some(c => c.id === cat)) fail('Bitte eine Warengruppe wählen.');
            if (db.products.some(p => same(p.n, name))) { if (b.quiet) return state(); fail('„{0}“ gibt es schon im Katalog.', name); }
            db.products.push({ id: id(), c: cat, n: name, e: '' });
            db.cv++;
            return state();
        },
        prod_edit: b => {
            const name = clean(b.name, 60), cat = +b.cat, p = db.products.find(x => x.id === +b.id);
            if (!name) fail('Bitte einen Namen eingeben.');
            if (!db.cats.some(c => c.id === cat)) fail('Bitte eine Warengruppe wählen.');
            if (db.products.some(x => same(x.n, name) && x.id !== +b.id)) fail('„{0}“ gibt es schon im Katalog.', name);
            if (p) { if (p.n !== name) p.e = ''; p.n = name; p.c = cat; }
            db.cv++;
            return state();
        },
        prod_delete: b => { db.products = db.products.filter(p => p.id !== +b.id); db.cv++; return state(); },
        catalog_clear: () => { catalogBackup('Vor „Alles löschen“'); catalogReplace([]); return state(); },
        catalog_reset: () => {
            if (!db.seed || !Array.isArray(db.seed.catalog)) fail('Den Standardkatalog gibt es auf diesem Gerät nicht. Spiel ihn über „Importieren“ ein.');
            catalogBackup('Vor „Standard wiederherstellen“');
            catalogReplace(db.seed.catalog);
            return state();
        },
        catalog_import: b => {
            const data = Array.isArray(b.data) ? b.data : [];
            const n = data.reduce((s, c) => s + (c && Array.isArray(c.products) ? c.products.length : 0), 0);
            if (!data.length || data.length > 200 || n > 5000) fail('Die Datei enthält keinen brauchbaren Katalog.');
            catalogBackup('Vor dem Import');
            catalogReplace(data);
            return state();
        },
        catalog_backups: () => ({ backups: (db.cbackups || []).map(x => ({ id: x.id, at: x.at, reason: x.reason, cats: x.cats, products: x.products })) }),
        catalog_restore: b => {
            const x = (db.cbackups || []).find(y => y.id === +b.id);
            if (!x) fail('Diese Sicherung gibt es nicht mehr.');
            catalogBackup('Vor dem Zurückholen einer Sicherung');
            catalogReplace(x.data);
            return state();
        },

        tpl_save: b => {
            const name = clean(b.name, 40);
            if (!name) fail('Bitte einen Namen eingeben.');
            const items = new Map();
            for (const it of (Array.isArray(b.items) ? b.items : []).slice(0, 200)) {
                const n = clean(it && it.n, 60);
                if (n) items.set(low(n), { n, c: Math.max(0, +it.c || 0), note: clean(it.note, 80) });
            }
            if (!items.size) fail('Die Vorlage braucht mindestens ein Produkt.');
            const t = db.tpls.find(x => x.id === +b.id);
            if (t) { t.n = name; t.items = [...items.values()]; }
            else db.tpls.push({ id: id(), n: name, items: [...items.values()] });
            db.lv++;
            return state();
        },
        tpl_delete: b => { db.tpls = db.tpls.filter(t => t.id !== +b.id); db.lv++; return state(); },

        me_look: b => { db.look = b.look && typeof b.look === 'object' ? JSON.parse(JSON.stringify(b.look)) : null; db.lv++; return { ok: true }; },
        settings_save: () => state(),
    };

    /** Wie fetch beim Server: action ist z. B. 'state', 'list&id=3' oder 'ops', body bei Änderungen. Antwort als frische Kopie. */
    function api(action, body) {
        const [name, ...rest] = String(action).split('&');
        const q = {};
        for (const p of rest) { const [k, v] = p.split('='); q[k] = decodeURIComponent(v || ''); }
        const fn = actions[name];
        if (!fn) fail(NA);
        load();
        const res = fn(body ? JSON.parse(JSON.stringify(body)) : q);
        if (body) save();
        return JSON.parse(JSON.stringify(res));
    }

    /* ---------- Anlegen, Übernehmen, Sichern ---------- */
    /** Neu anfangen: Standardkatalog und Vorlagen vom Server (seed: { catalog: [{ name, products }], templates: { Name: [Produkte] } }), eine leere Liste */
    function create(seed, meName, listName) {
        db = { kaufen: 'local', v: 1, seq: 1, me: { id: 1, n: meName }, look: null, cv: 1, lv: 1, start: 0, cats: [], products: [], tpls: [], lists: [], cbackups: [], seed };
        catalogReplace(seed && seed.catalog || []);
        for (const [n, items] of Object.entries(seed && seed.templates || {})) {
            db.tpls.push({ id: id(), n, items: items.map(p => { const pr = db.products.find(x => same(x.n, p)); return { n: p, c: pr ? pr.c : 0, note: '' }; }) });
        }
        const l = { id: id(), n: listName, v: 1, items: [], usage: [], order: [] };
        db.lists.push(l);
        db.start = l.id;
        db.cv = db.lv = 1;
        save();
    }
    /** Aus einem Konto übernehmen: was app.js vom Server hat (S und die Listen mit ihrem Inhalt), dazu der Standardkatalog für später */
    function fromAccount(a) {
        db = { kaufen: 'local', v: 1, seq: 1, me: { id: a.me.id, n: a.me.n }, look: a.look || null, cv: 1, lv: 1, start: a.start || 0,
            cats: a.catalog.cats.map(c => ({ id: c.id, n: c.n, e: c.e || '' })),
            products: a.catalog.products.map(p => ({ id: p.id, c: p.c, n: p.n, e: p.e || '' })),
            tpls: a.templates.map(t => ({ id: t.id, n: t.n, items: t.items.map(i => ({ n: i.n, c: i.c, note: i.note || '' })) })),
            lists: a.lists.map(({ meta, data }) => {
                const mem = new Map((data.mem || []).map(([n, note]) => [low(n), note]));
                return { id: meta.id, n: meta.n, v: 1, order: (data.order || []).slice(),
                    items: data.items.map(i => ({ uid: i.uid, n: i.n, c: i.c, note: i.note || '', by: i.by, at: i.at, got: i.got || 0 })),
                    usage: data.usage.map(u => ({ n: u.n, c: u.c, cnt: u.cnt, last: u.last, g: u.g, gn: u.gn, rs: u.rs || 0, am: u.am || 0, note: mem.get(low(u.n)) || '', prev: '' })) };
            }),
            cbackups: [], seed: a.seed || null };
        const ids = [...db.cats, ...db.products, ...db.tpls, ...db.lists].map(x => x.id);
        db.seq = Math.max(0, ...ids) + 1;
        if (!db.lists.some(l => l.id === db.start)) db.start = db.lists.length ? db.lists[0].id : 0;
        save();
    }
    /** Ganze Sicherung (alles in einer Datei). Prüft grob und ersetzt dann den Stand auf diesem Gerät. */
    function exportAll() { return JSON.stringify({ kaufen: 'local-backup', at: now(), version: version(), data: load() }); }
    function importAll(text) {
        let j = null;
        try { j = JSON.parse(text); } catch (e) {}
        const d = j && j.kaufen === 'local-backup' ? j.data : j;
        const okArr = k => d && Array.isArray(d[k]);
        if (!okArr('lists') || !okArr('cats') || !okArr('products') || !okArr('tpls') || !d.me) fail('Das ist keine Sicherung von Kaufen.');
        for (const l of d.lists) if (!Array.isArray(l.items) || !Array.isArray(l.usage) || !Array.isArray(l.order)) fail('Das ist keine Sicherung von Kaufen.');
        db = d;
        db.lv = (db.lv || 1) + 1;
        db.cv = (db.cv || 1) + 1;
        save();
    }
    const has = () => { try { const d = JSON.parse(localStorage.getItem(KEY)); return !!(d && Array.isArray(d.lists)); } catch (e) { return false; } };
    /** Für die Frage nach dem Anmelden: was liegt noch lokal (Listen mit Inhalt, Warengruppen) */
    const peek = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
    const drop = () => { db = null; localStorage.removeItem(KEY); };

    self.kfLocal = { api, create, fromAccount, exportAll, importAll, has, peek, drop };
})();
