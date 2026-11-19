/* Kaufen: Einkaufszettel als PDF, ohne fremde Bibliothek.
   Zwei Spalten, Kästchen zum Abhaken mit dem Kuli, schlicht schwarzweiß. Schrift ist Helvetica, die jedes PDF-Programm mitbringt,
   kodiert als WinAnsi: Umlaute, ß, ½ und € gehen, alles andere (etwa Emojis) fällt weg oder wird ohne Akzent geschrieben.
   Aufruf: kfPdf({ title, date, count, sections: [{ name, items: [{ n, q }] }], extra: { name, lines }, brand, page: (i, n) => text })
   Ergebnis: Uint8Array mit der fertigen PDF-Datei. */
(function () {
    'use strict';
    // Breiten der Zeichen 32 bis 255 in Tausendsteln der Schriftgröße (aus den Adobe-Metriken, WinAnsi)
    const W = {
        r: [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,350,556,350,222,556,333,1000,556,556,333,1000,667,333,1000,350,611,350,350,222,222,333,333,350,556,1000,333,1000,500,333,944,350,500,667,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],
        b: [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,350,556,350,278,556,500,1000,556,556,333,1000,667,333,1000,350,611,350,350,278,278,500,500,350,556,1000,333,1000,556,333,944,350,500,667,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556],
    };
    // Zeichen, die WinAnsi zwischen 128 und 159 anders belegt als Unicode
    const WIN = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142,
        '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };

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
    const width = (s, size, bold, sp = 0) => {
        const t = W[bold ? 'b' : 'r'];
        let w = 0;
        for (let i = 0; i < s.length; i++) w += t[s.charCodeAt(i) - 32] || 556;
        return w * size / 1000 + sp * s.length;
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
    const esc = s => s.replace(/[\\()]/g, '\\$&');
    const f = n => (Math.round(n * 100) / 100).toString();

    // Maße in Punkt (1/72 Zoll), Seite A4
    const PW = 595.28, PH = 841.89, ML = 46, MR = 46, MT = 48, MB = 52, GUT = 34;
    const CW = (PW - ML - MR - GUT) / 2;
    const BOX = 10.5, TX = BOX + 9;                       // Kästchen und Abstand zum Text
    const NAME = 11, QTY = 10, LH = 13.5;                 // Schriftgrößen, Zeilenabstand bei Umbruch
    const ROW = 22;                                        // Höhe einer einzeiligen Zeile
    const HEAD = 8.5, HSP = 1.4;                           // Überschrift der Warengruppe, Sperrung

    function kfPdf(d) {
        const title = enc(d.title || ''), date = enc(d.date || ''), count = enc(d.count || ''), brand = enc(d.brand || '');

        /* ---------- 1. Bausteine: Überschriften und Zeilen, jeweils mit Höhe ---------- */
        const blocks = [];
        let head = null;
        const heading = name => { head = { t: 'h', text: enc(name).toUpperCase(), h: 26, gap: 16, sec: 0 }; blocks.push(head); };
        for (const sec of d.sections || []) {
            if (!sec.items || !sec.items.length) continue;
            heading(sec.name);
            for (const it of sec.items) {
                const q = enc(it.q || '');
                const qMax = CW * 0.42;
                const qLines = q ? wrap(q, QTY, false, qMax) : [];
                const qW = qLines.reduce((m, l) => Math.max(m, width(l, QTY)), 0);
                const nLines = wrap(enc(it.n), NAME, false, CW - TX - (qW ? qW + 12 : 0));
                const lines = Math.max(nLines.length, qLines.length);
                blocks.push({ t: 'i', n: nLines, q: qLines, h: ROW + (lines - 1) * LH, gap: 0, head });
                head.sec += blocks[blocks.length - 1].h;
            }
        }
        if (d.extra && d.extra.lines > 0) {
            heading(d.extra.name || '');
            for (let i = 0; i < d.extra.lines; i++) { blocks.push({ t: 'e', h: ROW + 2, gap: 0, head }); head.sec += ROW + 2; }
        }

        /* ---------- 2. Auf Spalten und Seiten verteilen. Kleine Warengruppen bleiben zusammen, große werden frühestens nach zwei Zeilen geteilt.
           Geht eine Warengruppe in der nächsten Spalte weiter, steht ihre Überschrift dort noch einmal mit „Forts.“. ---------- */
        const more = enc(d.more || 'Forts.').toUpperCase();
        function fill(start, colH) {
            const cols = [[], []];
            let i = start;
            for (let c = 0; c < 2 && i < blocks.length; c++) {
                let y = 0;
                if (blocks[i].t !== 'h') {   // Fortsetzung
                    cols[c].push({ b: { t: 'h', text: blocks[i].head.text + '  (' + more + ')', h: 26 }, y: 0 });
                    y = 26;
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
        const H1 = PH - MT - MB - 74, H2 = PH - MT - MB - 40;   // erste Seite mit großem Kopf, weitere mit kleinem
        const pages = [];
        for (let i = 0; i < blocks.length || !pages.length;) {
            const colH = pages.length ? H2 : H1;
            let p = fill(i, colH);
            if (p.end >= blocks.length) {
                // letzte Seite: beide Spalten etwa gleich hoch machen
                let lo = 0, hi = colH;
                while (hi - lo > 1) { const m = (lo + hi) / 2; if (fill(i, m).end >= blocks.length) hi = m; else lo = m; }
                p = fill(i, hi);
            }
            pages.push(p);
            if (p.end === i) break;   // nichts mehr unterzubringen (sollte nicht vorkommen)
            i = p.end;
        }

        /* ---------- 3. Zeichnen ---------- */
        const streams = pages.map((p, pi) => {
            const o = [];
            const Y = y => f(PH - y);
            const text = (x, y, s, size, bold, sp) => o.push('BT /' + (bold ? 'F2 ' : 'F1 ') + f(size) + ' Tf ' + (sp ? f(sp) + ' Tc ' : '') + f(x) + ' ' + Y(y) + ' Td (' + esc(s) + ') Tj ' + (sp ? '0 Tc ' : '') + 'ET');
            const line = (x1, y1, x2, y2, w, gray, dash) => o.push('q ' + f(w) + ' w ' + f(gray) + ' G ' + (dash ? dash + ' d 1 J ' : '') + f(x1) + ' ' + Y(y1) + ' m ' + f(x2) + ' ' + Y(y2) + ' l S Q');
            const box = (x, y, s) => {   // Kästchen mit runden Ecken, y = Oberkante
                const r = 2, k = r * 0.5523, L = x, R = x + s, T = PH - y, B = PH - y - s;
                o.push('q 0.85 w 0 G ' + [
                    f(L + r) + ' ' + f(T) + ' m', f(R - r) + ' ' + f(T) + ' l',
                    f(R - r + k) + ' ' + f(T) + ' ' + f(R) + ' ' + f(T - r + k) + ' ' + f(R) + ' ' + f(T - r) + ' c', f(R) + ' ' + f(B + r) + ' l',
                    f(R) + ' ' + f(B + r - k) + ' ' + f(R - r + k) + ' ' + f(B) + ' ' + f(R - r) + ' ' + f(B) + ' c', f(L + r) + ' ' + f(B) + ' l',
                    f(L + r - k) + ' ' + f(B) + ' ' + f(L) + ' ' + f(B + r - k) + ' ' + f(L) + ' ' + f(B + r) + ' c', f(L) + ' ' + f(T - r) + ' l',
                    f(L) + ' ' + f(T - r + k) + ' ' + f(L + r - k) + ' ' + f(T) + ' ' + f(L + r) + ' ' + f(T) + ' c',
                ].join(' ') + ' h S Q');
            };

            // Kopf
            let top;
            if (pi === 0) {
                const tl = wrap(title, 24, true, PW - ML - MR);
                text(ML, MT + 20, tl[0] + (tl.length > 1 ? '\x85' : ''), 24, true);
                o.push('0.4 g'); text(ML, MT + 40, date, 10); o.push('0 g');
                if (count) { o.push('0.4 g'); text(PW - MR - width(count, 10), MT + 40, count, 10); o.push('0 g'); }
                line(ML, MT + 52, PW - MR, MT + 52, 1.4, 0);
                top = MT + 74;
            } else {
                text(ML, MT + 12, title, 12, true);
                if (date) { o.push('0.4 g'); text(PW - MR - width(date, 9), MT + 12, date, 9); o.push('0 g'); }
                line(ML, MT + 20, PW - MR, MT + 20, 0.8, 0);
                top = MT + 40;
            }

            // Trennlinie zwischen den Spalten, so hoch wie der Inhalt
            const colEnd = c => c.length ? c[c.length - 1].y + c[c.length - 1].b.h : 0;
            const used = Math.max(colEnd(p.cols[0]), colEnd(p.cols[1]));
            if (p.cols[1].length) line(ML + CW + GUT / 2, top - 4, ML + CW + GUT / 2, top + used - 6, 0.5, 0.75);

            p.cols.forEach((col, ci) => {
                const x = ML + ci * (CW + GUT);
                col.forEach(({ b, y }, k) => {
                    const yy = top + y;
                    if (b.t === 'h') {
                        text(x, yy + 10, b.text, HEAD, true, HSP);
                        line(x, yy + 17, x + CW, yy + 17, 0.9, 0);
                        return;
                    }
                    const next = col[k + 1];
                    const last = !next || next.b.t === 'h';
                    box(x, yy + 5.5, BOX);
                    if (b.t === 'e') {
                        line(x + TX, yy + 17, x + CW, yy + 17, 0.5, 0.55);
                        return;
                    }
                    b.n.forEach((s, j) => text(x + TX, yy + 14.6 + j * LH, s, NAME));
                    if (b.q.length) {
                        o.push('0.3 g');
                        b.q.forEach((s, j) => text(x + CW - width(s, QTY), yy + 14.4 + j * LH, s, QTY));
                        o.push('0 g');
                    }
                    if (!last) line(x + TX, yy + b.h - 0.5, x + CW, yy + b.h - 0.5, 0.4, 0.82);
                });
            });

            // Fuß
            o.push('0.55 g');
            if (brand) text(ML, PH - MB + 26, brand, 8);
            const pg = d.page && pages.length > 1 ? enc(d.page(pi + 1, pages.length)) : '';
            if (pg) text(PW - MR - width(pg, 8), PH - MB + 26, pg, 8);
            o.push('0 g');
            return o.join('\n');
        });

        /* ---------- 4. PDF-Datei zusammensetzen ---------- */
        const objs = [];
        const add = s => { objs.push(s); return objs.length; };
        const cat = add(''), pagesId = add('');
        const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
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
        const bytes = new Uint8Array(out.length);
        for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i);
        return bytes;
    }
    self.kfPdf = kfPdf;
})();
