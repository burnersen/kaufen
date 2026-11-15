/* Kaufen – läuft vor dem ersten Bild: setzt das zuletzt auf diesem Gerät benutzte Aussehen, damit beim Start
   und auf der Anmeldeseite nichts in den Standardfarben aufblitzt. Den Merkzettel dazu schreibt app.js (applyTheme). */
(() => {
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
