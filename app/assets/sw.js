/* Kaufen – Service Worker: hält Seite, CSS und JavaScript vor, damit die App im Laden auch ohne Netz startet.
   Daten werden hier nie zwischengespeichert, die merkt sich app.js selbst. KF_V setzt index.php davor. */
const CACHE = 'kaufen-' + KF_V;

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
    const urls = e.data && e.data.precache;
    if (!Array.isArray(urls)) return;
    urls.forEach(u => fetch(u, { credentials: 'same-origin' }).then(res => keep(u, res, u === './')).catch(() => {}));
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
    e.respondWith(fetch(req).then(res => { keep(req, res, isPage); return res; })
        .catch(() => caches.match(isPage ? './' : req).then(r => r || Response.error())));
});
