/* Kaufen: Einkaufszettel als PDF, ohne fremde Bibliothek.
   Kästchen zum Abhaken mit dem Kuli, schlicht schwarzweiß. Einstellbar sind Schriftart, Schriftgröße, Zeilenabstand und 2 oder 3 Spalten.
   Die Schriften sind die drei, die jedes PDF-Programm mitbringt (Helvetica, Times, Courier), kodiert als WinAnsi: Umlaute, ß, ½ und €
   gehen, alles andere (etwa Emojis) fällt weg oder wird ohne Akzent geschrieben.
   Das Layout wird einmal berechnet und dann entweder als PDF geschrieben oder für die Vorschau auf ein Canvas gezeichnet,
   die Vorschau zeigt also genau, was aus dem Drucker kommt.
   kfPdf(d) liefert die fertige PDF-Datei (Uint8Array), kfPdfLayout(d) das Layout mit .pages, .draw(ctx, seite) und .bytes().
   d = { title, date, count, sections: [{ name, items: [{ n, q }] }], extra: { name, lines (-1 = Seite füllen) }, brand, more,
         page: (i, n) => text, opt: { font: helvetica|times|courier, size: 0.7–1.5, space: 0.3–2, cols: 2|3 } } */
(function () {
    'use strict';
    // Breiten der Zeichen 32 bis 255 in Tausendsteln der Schriftgröße (aus den Adobe-Metriken, WinAnsi). Courier ist überall 600 breit.
    const W = {
        r: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
        b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
        tr: [250,333,408,500,500,833,778,180,333,333,500,564,250,333,250,278,500,500,500,500,500,500,500,500,500,500,278,278,564,564,564,444,921,722,667,667,722,611,556,722,722,333,389,722,611,889,722,722,556,722,667,556,611,722,722,944,722,722,611,333,278,333,469,500,333,444,500,444,500,444,333,500,500,278,278,500,278,778,500,500,500,500,333,389,278,500,500,722,500,500,444,480,200,480,541,350,500,350,333,500,444,1000,500,500,333,1000,556,333,889,350,611,350,350,333,333,444,444,350,500,1000,333,980,389,333,722,350,444,722,250,333,500,500,500,500,200,500,333,760,276,500,564,333,760,333,400,564,300,300,333,500,453,250,333,300,310,500,750,750,750,444,722,722,722,722,722,722,889,667,611,611,611,611,333,333,333,333,722,722,722,722,722,722,722,564,722,722,722,722,722,722,556,500,444,444,444,444,444,444,667,444,444,444,444,444,278,278,278,278,500,500,500,500,500,500,500,564,500,500,500,500,500,500,500,500],
        tb: [250,333,555,500,500,1000,833,278,333,333,500,570,250,333,250,278,500,500,500,500,500,500,500,500,500,500,333,333,570,570,570,500,930,722,667,722,722,667,611,778,778,389,500,778,667,944,722,778,611,778,722,556,667,722,722,1000,722,722,667,333,278,333,581,500,333,500,556,444,556,444,333,500,556,278,333,556,278,833,556,500,556,556,444,389,333,556,500,722,500,500,444,394,220,394,520,350,500,350,333,500,500,1000,500,500,333,1000,556,333,1000,350,667,350,350,333,333,500,500,350,500,1000,333,1000,389,333,722,350,444,722,250,333,500,500,500,500,220,500,333,747,300,500,570,333,747,333,400,570,300,300,333,556,540,250,333,300,330,500,750,750,750,500,722,722,722,722,722,722,1000,722,667,667,667,667,389,389,389,389,722,722,778,778,778,778,778,570,778,722,722,722,722,722,611,556,500,500,500,500,500,500,722,444,444,444,444,444,278,278,278,278,500,556,500,500,500,500,500,570,500,556,556,556,556,500,556,500],
    };
    const FONTS = {
        helvetica: { r: 'Helvetica', b: 'Helvetica-Bold', wr: 'r', wb: 'b', css: 'Helvetica, Arial, "Liberation Sans", "Nimbus Sans", sans-serif' },
        times: { r: 'Times-Roman', b: 'Times-Bold', wr: 'tr', wb: 'tb', css: '"Times New Roman", Times, "Liberation Serif", "Nimbus Roman", serif' },
        courier: { r: 'Courier', b: 'Courier-Bold', wr: '', wb: '', css: '"Courier New", Courier, "Liberation Mono", "Nimbus Mono PS", monospace' },
    };
    // Zeichen, die WinAnsi zwischen 128 und 159 anders belegt als Unicode
    const WIN = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
        '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
    const UNWIN = {};
    for (const ch in WIN) UNWIN[WIN[ch]] = ch;

    /** Text in WinAnsi-Bytes (als String mit Zeichencodes unter 256). Unbekanntes ohne Akzent, sonst weg. */
    function enc(s) {
        let out = '';
        for (const ch of String(s == null ? '' : s).replace(/\s+/g, ' ')) {
            const c = ch.codePointAt(0);
            if ((c >= 32 && c < 127) || (c >= 160 && c < 256)) out += ch;
            else if (WIN[ch]) out += String.fromCharCode(WIN[ch]);
            else {
                const base = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
                if (base && base !== ch && base.codePointAt(0) < 256) out += enc(base);
            }
        }
        return out.replace(/ {2,}/g, ' ').trim();
    }
    /** Zurück in Unicode, für die Vorschau im Browser */
    const dec = s => s.replace(/[\x80-\x9f]/g, ch => UNWIN[ch.charCodeAt(0)] || '');
    const esc = s => s.replace(/[\\()]/g, '\\$&');
    const f = n => (Math.round(n * 100) / 100).toString();
    const clamp = (v, lo, hi, d) => (isFinite(v) && v !== null && v !== '' ? Math.min(hi, Math.max(lo, +v)) : d);

    // Maße in Punkt (1/72 Zoll), Seite A4
    const PW = 595.28, PH = 841.89, ML = 46, MR = 46, MT = 48, MB = 52;

    function layout(d) {
        const o = d.opt || {};
        const fam = FONTS[o.font] ? o.font : 'helvetica', F = FONTS[fam];
        const fs = clamp(o.size, .7, 1.5, 1), sp = clamp(o.space, .3, 2, 1), N = +o.cols === 3 ? 3 : 2;
        const width = (s, size, bold, ls = 0) => {
            const t = W[bold ? F.wb : F.wr];
            let w = 0;
            for (let i = 0; i < s.length; i++) w += t ? t[s.charCodeAt(i) - 32] || 556 : 600;
            return w * size / 1000 + ls * s.length;
        };
        /** Kodierten Text auf Breite umbrechen. Zu lange Wörter werden hart geteilt. */
        function wrap(s, size, bold, max) {
            const lines = [];
            let line = '';
            for (let word of s.split(' ')) {
                while (width(word, size, bold) > max) {
                    let k = word.length - 1;
                    while (k > 1 && width(word.slice(0, k), size, bold) > max) k--;
                    if (line) { lines.push(line); line = ''; }
                    lines.push(word.slice(0, k));
                    word = word.slice(k);
                }
                const t = line ? line + ' ' + word : word;
                if (line && width(t, size, bold) > max) { lines.push(line); line = word; } else line = t;
            }
            if (line || !lines.length) lines.push(line);
            return lines;
        }

        // Schriftgröße (fs) streckt Schrift und Kästchen, Zeilenabstand (sp) nur den Platz dazwischen
        const GUT = N === 3 ? 22 : 34, CW = (PW - ML - MR - GUT * (N - 1)) / N;
        const NAME = 11 * fs, QTY = 10 * fs, LH = 13.5 * fs;     // Schriftgrößen, Zeilenabstand bei Umbruch
        const BOX = 10.5 * fs, TX = BOX + 9 * fs;                  // Kästchen und Abstand zum Text
        const ROW = 11 * fs + 11 * sp, EROW = ROW + 2 * sp;        // einzeilige Zeile, leere Zeile zum Dazuschreiben
        const HEAD = 8.5 * fs, HSP = 1.4 * fs;                     // Überschrift der Warengruppe, Sperrung
        const HH = 17 * fs + 9 * sp, HGAP = 16 * sp;               // Höhe der Überschrift, Abstand davor
        const BASE = ROW / 2 + NAME * .33;                         // Grundlinie der ersten Textzeile

        const title = enc(d.title || ''), date = enc(d.date || ''), count = enc(d.count || ''), brand = enc(d.brand || '');
        const H1 = PH - MT - MB - 74, H2 = PH - MT - MB - 40;   // erste Seite mit großem Kopf, weitere mit kleinem

        /* ---------- 1. Bausteine: Überschriften und Zeilen, jeweils mit Höhe ---------- */
        const blocks = [];
        let head = null;
        const heading = name => { head = { t: 'h', text: enc(name).toUpperCase(), h: HH, gap: HGAP, sec: 0 }; blocks.push(head); };
        for (const sec of d.sections || []) {
            if (!sec.items || !sec.items.length) continue;
            heading(sec.name);
            for (const it of sec.items) {
                const q = enc(it.q || '');
                const qLines = q ? wrap(q, QTY, false, CW * 0.42) : [];
                const qW = qLines.reduce((m, l) => Math.max(m, width(l, QTY)), 0);
                const nLines = wrap(enc(it.n), NAME, false, CW - TX - (qW ? qW + 12 * fs : 0));
                const lines = Math.max(nLines.length, qLines.length);
                blocks.push({ t: 'i', n: nLines, q: qLines, h: ROW + (lines - 1) * LH, gap: 0, head });
                head.sec += blocks[blocks.length - 1].h;
            }
        }
        if (d.extra && d.extra.lines) {
            head = null;
            if (d.extra.name) heading(d.extra.name);   // ohne Namen: leerer Zettel nur mit Zeilen
            const n = d.extra.lines < 0 ? N * Math.floor(H1 / EROW) : d.extra.lines;   // -1: die erste Seite füllen
            for (let i = 0; i < n; i++) { blocks.push({ t: 'e', h: EROW, gap: 0, head }); if (head) head.sec += EROW; }
        }

        /* ---------- 2. Auf Spalten und Seiten verteilen. Kleine Warengruppen bleiben zusammen, große werden frühestens nach zwei Zeilen geteilt.
           Geht eine Warengruppe in der nächsten Spalte weiter, steht ihre Überschrift dort noch einmal mit „Forts.“. ---------- */
        const more = enc(d.more || 'Forts.').toUpperCase();
        function fill(start, colH) {
            const cols = Array.from({ length: N }, () => []);
            let i = start;
            for (let c = 0; c < N && i < blocks.length; c++) {
                let y = 0;
                if (blocks[i].t !== 'h' && blocks[i].head) {   // Fortsetzung
                    cols[c].push({ b: { t: 'h', text: blocks[i].head.text + '  (' + more + ')', h: HH }, y: 0 });
                    y = HH;
                }
                while (i < blocks.length) {
                    const b = blocks[i], gap = y ? b.gap : 0;
                    let need = gap + b.h;
                    if (b.t === 'h') need += b.sec <= colH * 0.4 ? b.sec : blocks[i + 1].h + (blocks[i + 2] && blocks[i + 2].head === b ? blocks[i + 2].h : 0);
                    if (y && y + need > colH) break;
                    cols[c].push({ b, y: y + gap });
                    y += gap + b.h;
                    i++;
                }
            }
            return { cols, end: i };
        }
        const pages = [];
        for (let i = 0; i < blocks.length || !pages.length;) {
            const colH = pages.length ? H2 : H1;
            let p = fill(i, colH);
            if (p.end >= blocks.length) {
                // letzte Seite: die Spalten etwa gleich hoch machen
                let lo = 0, hi = colH;
                while (hi - lo > 1) { const m = (lo + hi) / 2; if (fill(i, m).end >= blocks.length) hi = m; else lo = m; }
                p = fill(i, hi);
            }
            pages.push(p);
            if (p.end === i) break;   // nichts mehr unterzubringen (sollte nicht vorkommen)
            i = p.end;
        }

        /* ---------- 3. Zeichnen, als Liste von Befehlen: t = Text (r: rechtsbündig an x), l = Linie, b = Kästchen. y zählt von oben. ---------- */
        const ops = pages.map((p, pi) => {
            const o = [];
            const text = (x, y, s, size, bold, g, ls, r) => o.push({ k: 't', x, y, s, size, bold: !!bold, g: g || 0, ls: ls || 0, r: !!r });
            const line = (x1, y1, x2, y2, w, g) => o.push({ k: 'l', x1, y1, x2, y2, w, g });

            // Kopf
            let top;
            if (pi === 0) {
                const tl = wrap(title, 24, true, PW - ML - MR);
                text(ML, MT + 20, tl[0] + (tl.length > 1 ? '\x85' : ''), 24, true);
                text(ML, MT + 40, date, 10, false, .4);
                if (count) text(PW - MR, MT + 40, count, 10, false, .4, 0, true);
                line(ML, MT + 52, PW - MR, MT + 52, 1.4, 0);
                top = MT + 74;
            } else {
                text(ML, MT + 12, title, 12, true);
                if (date) text(PW - MR, MT + 12, date, 9, false, .4, 0, true);
                line(ML, MT + 20, PW - MR, MT + 20, 0.8, 0);
                top = MT + 40;
            }

            // Trennlinien zwischen den Spalten, so hoch wie der Inhalt
            const colEnd = c => c.length ? c[c.length - 1].y + c[c.length - 1].b.h : 0;
            const used = Math.max(...p.cols.map(colEnd));
            for (let c = 1; c < N; c++) if (p.cols[c].length) line(ML + c * (CW + GUT) - GUT / 2, top - 4, ML + c * (CW + GUT) - GUT / 2, top + used - 6, 0.5, 0.75);

            p.cols.forEach((col, ci) => {
                const x = ML + ci * (CW + GUT);
                col.forEach(({ b, y }, k) => {
                    const yy = top + y;
                    if (b.t === 'h') {
                        text(x, yy + 10 * fs, b.text, HEAD, true, 0, HSP);
                        line(x, yy + 17 * fs, x + CW, yy + 17 * fs, 0.9, 0);
                        return;
                    }
                    const next = col[k + 1];
                    const last = !next || next.b.t === 'h';
                    o.push({ k: 'b', x, y: yy + ROW / 2 - BOX / 2, s: BOX });
                    if (b.t === 'e') {
                        line(x + TX, yy + ROW / 2 + NAME * .55, x + CW, yy + ROW / 2 + NAME * .55, 0.5, 0.55);
                        return;
                    }
                    b.n.forEach((s, j) => text(x + TX, yy + BASE + j * LH, s, NAME));
                    b.q.forEach((s, j) => text(x + CW, yy + BASE - .2 * fs + j * LH, s, QTY, false, .3, 0, true));
                    if (!last) line(x + TX, yy + b.h - 0.5, x + CW, yy + b.h - 0.5, 0.4, 0.82);
                });
            });

            // Fuß
            if (brand) text(ML, PH - MB + 26, brand, 8, false, .55);
            const pg = d.page && pages.length > 1 ? enc(d.page(pi + 1, pages.length)) : '';
            if (pg) text(PW - MR, PH - MB + 26, pg, 8, false, .55, 0, true);
            return o;
        });

        /* ---------- 4a. Als PDF-Datei ---------- */
        function bytes() {
            const streams = ops.map(list => list.map(op => {
                if (op.k === 't') {
                    const x = op.r ? op.x - width(op.s, op.size, op.bold, op.ls) : op.x;
                    return (op.g ? f(op.g) + ' g ' : '') + 'BT /' + (op.bold ? 'F2 ' : 'F1 ') + f(op.size) + ' Tf ' + (op.ls ? f(op.ls) + ' Tc ' : '')
                        + f(x) + ' ' + f(PH - op.y) + ' Td (' + esc(op.s) + ') Tj ' + (op.ls ? '0 Tc ' : '') + 'ET' + (op.g ? ' 0 g' : '');
                }
                if (op.k === 'l') return 'q ' + f(op.w) + ' w ' + f(op.g) + ' G ' + f(op.x1) + ' ' + f(PH - op.y1) + ' m ' + f(op.x2) + ' ' + f(PH - op.y2) + ' l S Q';
                // Kästchen mit runden Ecken, y = Oberkante
                const r = 2 * Math.min(1.2, fs), k = r * 0.5523, L = op.x, R = op.x + op.s, T = PH - op.y, B = PH - op.y - op.s;
                return 'q 0.85 w 0 G ' + [
                    f(L + r) + ' ' + f(T) + ' m', f(R - r) + ' ' + f(T) + ' l',
                    f(R - r + k) + ' ' + f(T) + ' ' + f(R) + ' ' + f(T - r + k) + ' ' + f(R) + ' ' + f(T - r) + ' c', f(R) + ' ' + f(B + r) + ' l',
                    f(R) + ' ' + f(B + r - k) + ' ' + f(R - r + k) + ' ' + f(B) + ' ' + f(R - r) + ' ' + f(B) + ' c', f(L + r) + ' ' + f(B) + ' l',
                    f(L + r - k) + ' ' + f(B) + ' ' + f(L) + ' ' + f(B + r - k) + ' ' + f(L) + ' ' + f(B + r) + ' c', f(L) + ' ' + f(T - r) + ' l',
                    f(L) + ' ' + f(T - r + k) + ' ' + f(L + r - k) + ' ' + f(T) + ' ' + f(L + r) + ' ' + f(T) + ' c',
                ].join(' ') + ' h S Q';
            }).join('\n'));
            const objs = [];
            const add = s => { objs.push(s); return objs.length; };
            const cat = add(''), pagesId = add('');
            const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /' + F.r + ' /Encoding /WinAnsiEncoding >>');
            const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /' + F.b + ' /Encoding /WinAnsiEncoding >>');
            const kids = streams.map(s => {
                const c = add('<< /Length ' + s.length + ' >>\nstream\n' + s + '\nendstream');
                return add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' + f(PW) + ' ' + f(PH) + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >> >> /Contents ' + c + ' 0 R >>');
            });
            objs[cat - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>';
            objs[pagesId - 1] = '<< /Type /Pages /Kids [' + kids.map(k => k + ' 0 R').join(' ') + '] /Count ' + kids.length + ' >>';
            const info = add('<< /Title (' + esc(title) + ') /Producer (' + esc(brand || 'Kaufen') + ') >>');
            let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
            const offs = objs.map((s, i) => { const at = out.length; out += (i + 1) + ' 0 obj\n' + s + '\nendobj\n'; return at; });
            const xref = out.length;
            out += 'xref\n0 ' + (objs.length + 1) + '\n0000000000 65535 f \n' + offs.map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('');
            out += 'trailer\n<< /Size ' + (objs.length + 1) + ' /Root ' + cat + ' 0 R /Info ' + info + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n';
            const res = new Uint8Array(out.length);
            for (let i = 0; i < out.length; i++) res[i] = out.charCodeAt(i);
            return res;
        }

        /* ---------- 4b. Für die Vorschau: Seite i auf ein Canvas zeichnen. Der Kontext muss vorher so skaliert sein, dass 1 Einheit 1 Punkt ist. ---------- */
        function draw(ctx, i) {
            const gray = g => { const v = Math.round(g * 255); return 'rgb(' + v + ',' + v + ',' + v + ')'; };
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, PW, PH);
            ctx.textBaseline = 'alphabetic';
            for (const op of ops[i] || []) {
                if (op.k === 't') {
                    ctx.font = (op.bold ? 'bold ' : '') + op.size + 'px ' + F.css;
                    ctx.fillStyle = gray(op.g);
                    if (op.ls) {   // gesperrt: Buchstabe für Buchstabe, mit denselben Breiten wie im PDF
                        let x = op.r ? op.x - width(op.s, op.size, op.bold, op.ls) : op.x;
                        for (const ch of op.s) { ctx.fillText(dec(ch), x, op.y); x += width(ch, op.size, op.bold, op.ls); }
                    } else {
                        ctx.textAlign = op.r ? 'right' : 'left';
                        ctx.fillText(dec(op.s), op.x, op.y);
                        ctx.textAlign = 'left';
                    }
                } else if (op.k === 'l') {
                    ctx.strokeStyle = gray(op.g);
                    ctx.lineWidth = op.w;
                    ctx.beginPath(); ctx.moveTo(op.x1, op.y1); ctx.lineTo(op.x2, op.y2); ctx.stroke();
                } else {
                    const r = 2 * Math.min(1.2, fs);
                    ctx.strokeStyle = '#000';
                    ctx.lineWidth = 0.85;
                    ctx.beginPath();
                    if (ctx.roundRect) ctx.roundRect(op.x, op.y, op.s, op.s, r); else ctx.rect(op.x, op.y, op.s, op.s);
                    ctx.stroke();
                }
            }
        }
        return { pages: ops.length, width: PW, height: PH, draw, bytes };
    }

    self.kfPdfLayout = layout;
    self.kfPdf = d => layout(d).bytes();
})();
