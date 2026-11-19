/* Kaufen – Service Worker: hält Seite, CSS und JavaScript vor, damit die App im Laden auch ohne Netz startet.
   Daten werden hier nie zwischengespeichert, die merkt sich app.js selbst. KF_V setzt index.php davor.
   Im lokalen Modus (app.js meldet ihn per Nachricht) kommt alles zuerst aus dem Vorrat, das Netz nur für eine neue Version. */
const CACHE = 'kaufen-' + KF_V;
const FLAGS = 'kf-flags', LOCAL = './__kf_local';   // eigener Vorrat, den eine neue Version nicht wegräumt
const isLocal = () => caches.open(FLAGS).then(c => c.match(LOCAL)).then(r => !!r).catch(() => false);

// Englische Produktnamen für Mitteilungen. Klappt das Laden nicht, bleiben die Namen eben deutsch.
try { importScripts('./?action=asset&f=i18n.js&v=' + KF_V); } catch (e) {}

function keep(req, res, isPage) {
    if (!res || !res.ok) return;
    if (isPage && res.headers.get('X-KF-Page') !== 'app') return;   // die Anmeldeseite nie als App merken
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(isPage ? './' : req, copy)).catch(() => {});
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k.startsWith('kaufen-') && k !== CACHE).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('message', e => {
    const d = e.data || {};
    if (typeof d.local === 'boolean') {   // lokaler Modus an oder aus, Antwort über den mitgegebenen Kanal
        e.waitUntil(caches.open(FLAGS).then(c => d.local ? c.put(LOCAL, new Response('1')) : c.delete(LOCAL))
            .catch(() => {}).then(() => { if (e.ports[0]) e.ports[0].postMessage('ok'); }));
        return;
    }
    const urls = d.precache;
    if (!Array.isArray(urls)) return;
    urls.forEach(u => { const page = u === './' || u === './?local=1'; fetch(u, { credentials: 'same-origin' }).then(res => keep(page ? './' : u, res, page)).catch(() => {}); });
});

/* ---------- Mitteilungen: der Server schickt nur die Angaben, der Text entsteht hier in der Sprache des Geräts ---------- */
function pushText(d) {
    const en = d.lang === 'en';
    if (d.t === 'add') {
        const prods = en && self.KF_EN && self.KF_EN.prods || {};
        const names = (Array.isArray(d.n) ? d.n : []).map(n => prods[n] || n);
        const c = d.c || names.length;
        return {
            title: en ? d.by + (c === 1 ? ' added 1 item to “' : ' added ' + c + ' items to “') + d.l + '”' : d.by + ': ' + c + ' neu auf „' + d.l + '“',
            body: names.join(', ') + (c > names.length ? ' …' : ''),
        };
    }
    if (d.t === 'test') return { title: 'Kaufen', body: en ? 'Notifications are on for this device.' : 'Mitteilungen sind auf diesem Gerät eingeschaltet.' };
    return { title: 'Kaufen', body: '' };
}

self.addEventListener('push', e => {
    let d = {};
    try { d = e.data.json() || {}; } catch (x) {}
    const t = pushText(d);
    e.waitUntil(self.registration.showNotification(t.title, { body: t.body, icon: './?action=asset&f=icon-192.png', badge: './?action=asset&f=icon-192.png', lang: d.lang === 'en' ? 'en' : 'de', data: { list: d.id || 0 } }));
});

// Antippen holt Kaufen nach vorn (oder öffnet es) und zeigt die Liste, um die es geht
self.addEventListener('notificationclick', e => {
    e.notification.close();
    const list = e.notification.data && e.notification.data.list || 0;
    e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(all => {
        const c = all.find(x => x.url.startsWith(self.registration.scope));
        if (!c) return self.clients.openWindow('./');
        return c.focus().then(w => { (w || c).postMessage({ kfList: list }); });
    }));
});

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== location.origin) return;
    const action = url.searchParams.get('action');
    const isPage = req.mode === 'navigate' && !action;
    const isAsset = action === 'asset' || action === 'manifest';
    if (!isPage && !isAsset) return;
    const net = () => fetch(req).then(res => { keep(req, res, isPage); return res; });
    e.respondWith(isLocal().then(local => local
        // lokal: aus dem Vorrat, sonst einmal holen (die Seite als ./?local=1, ohne Anmeldung)
        ? caches.match(isPage ? './' : req).then(r => r || (isPage ? fetch('./?local=1', { credentials: 'same-origin' }).then(res => { keep(req, res, true); return res; }) : net()))
        : net().catch(() => caches.match(isPage ? './' : req).then(r => r || Response.error()))));
});
