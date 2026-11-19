/* Kaufen – läuft vor dem ersten Bild: setzt das zuletzt auf diesem Gerät benutzte Aussehen, damit beim Start
   und auf der Anmeldeseite nichts in den Standardfarben oder -größen aufblitzt. Den Merkzettel dazu schreibt app.js (applyTheme). */
(() => {
    // Lokaler Modus (app.js, local.js): dieses Gerät braucht keine Anmeldung, also gleich weiter zur App
    try {
        if (document.documentElement.dataset.page === 'login' && JSON.parse(localStorage.getItem('kf_mode')) === 'local') { location.replace('./?local=1'); return; }
    } catch (e) {}
    // Schriftgrößen dieses Geräts, die der zuletzt offenen Liste (app.js: applyFont)
    try {
        const f = JSON.parse(localStorage.getItem('kf_fontNow') || localStorage.getItem('kf_font'));
        for (const k in f || {}) if (/^[a-z]{1,4}$/.test(k) && isFinite(f[k])) document.documentElement.style.setProperty(k === 'w' ? '--fw-cnt' : '--fs-' + k, String(+f[k]));
    } catch (e) {}
    try {
        const p = JSON.parse(localStorage.getItem('kf_paint'));
        if (!p) return;
        const mode = p.mode === 'light' || p.mode === 'dark' ? p.mode : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        const d = p[mode];
        if (!d || typeof d.pal !== 'string') return;
        const root = document.documentElement;
        root.dataset.theme = mode;
        root.dataset.pal = d.pal;
        for (const k in d.vars || {}) root.style.setProperty(k, String(d.vars[k]));
        const meta = document.querySelector('meta[name=theme-color]');
        if (meta && d.tc) meta.content = String(d.tc);
    } catch (e) {}
})();
