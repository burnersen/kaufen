<?php
/* Kaufen – Katalog, Listen, Einträge, Vorlagen */
defined('KF_VERSION') || exit;

function kfLower(string $s): string {
    return function_exists('mb_strtolower') ? mb_strtolower($s, 'UTF-8') : strtolower($s);
}

/** Eingaben säubern: Steuerzeichen raus, Leerraum zusammenfassen, Länge begrenzen */
function kfClean($s, int $max): string {
    if (!is_string($s) && !is_numeric($s)) return '';
    $s = trim((string)preg_replace('/\s+/u', ' ', (string)preg_replace('/[\x00-\x1f\x7f]/u', ' ', (string)$s)));
    return function_exists('mb_substr') ? mb_substr($s, 0, $max, 'UTF-8') : substr($s, 0, $max);
}

/* ---------- Katalog ---------- */

function kfCatalog(): array {
    $cats = [];
    foreach (kfQ('SELECT id, name, en FROM cats ORDER BY pos, id') as $r) $cats[] = ['id' => (int)$r['id'], 'n' => $r['name']] + ($r['en'] !== '' ? ['e' => $r['en']] : []);
    $prods = [];
    foreach (kfQ('SELECT id, cat_id, name, en FROM products ORDER BY name COLLATE NOCASE') as $r) $prods[] = ['id' => (int)$r['id'], 'c' => (int)$r['cat_id'], 'n' => $r['name']] + ($r['en'] !== '' ? ['e' => $r['en']] : []);
    return ['cats' => $cats, 'products' => $prods];
}

/** Der Katalog als einfache Liste (Gruppe + Produktnamen), so wird er gesichert und wieder eingespielt.
 *  Ein Produkt ist ein Name oder, mit eigenem englischen Namen, ['de' => …, 'en' => …]. Die Gruppe trägt ihren unter 'en'. */
function kfCatalogExport(): array {
    $out = [];
    $idx = [];
    foreach (kfQ('SELECT id, name, en FROM cats ORDER BY pos, id') as $r) {
        $idx[(int)$r['id']] = count($out);
        $out[] = ['name' => $r['name']] + ($r['en'] !== '' ? ['en' => $r['en']] : []) + ['products' => []];
    }
    foreach (kfQ('SELECT cat_id, name, en FROM products ORDER BY id') as $r) {
        if (isset($idx[(int)$r['cat_id']])) $out[$idx[(int)$r['cat_id']]]['products'][] = $r['en'] !== '' ? ['de' => $r['name'], 'en' => $r['en']] : $r['name'];
    }
    return $out;
}

function kfCatalogBackup(string $reason): void {
    $data = kfCatalogExport();
    $n = 0;
    foreach ($data as $c) $n += count($c['products']);
    if (!$data) return;
    kfQ('INSERT INTO catalog_backups (at, reason, cats, products, data) VALUES (?, ?, ?, ?, ?)',
        [time(), $reason, count($data), $n, json_encode($data, JSON_UNESCAPED_UNICODE)]);
    kfQ('DELETE FROM catalog_backups WHERE id NOT IN (SELECT id FROM catalog_backups ORDER BY id DESC LIMIT ' . (int)KF_BACKUP_KEEP . ')');
}

/**
 * Ersetzt den ganzen Katalog. Einträge auf Listen, „Zuletzt gekauft“, Vorlagen und die Reihenfolge
 * pro Liste hängen an der Nummer der Warengruppe und werden über deren Namen auf die neue umgehängt.
 */
function kfCatalogReplace(array $data, ?PDO $pdo = null): void {
    $pdo = $pdo ?: kfDb();
    $own = !$pdo->inTransaction();
    if ($own) $pdo->beginTransaction();
    $old = [];
    foreach ($pdo->query('SELECT id, name FROM cats') as $r) $old[(int)$r['id']] = kfLower($r['name']);
    $pdo->exec('DELETE FROM cats');
    $pdo->exec('DELETE FROM products');
    $insC = $pdo->prepare('INSERT OR IGNORE INTO cats (name, pos, en) VALUES (?, ?, ?)');
    $getC = $pdo->prepare('SELECT id FROM cats WHERE name = ?');
    $insP = $pdo->prepare('INSERT OR IGNORE INTO products (cat_id, name, en) VALUES (?, ?, ?)');
    $new = [];
    $pos = 0;
    foreach ($data as $c) {
        $name = kfClean($c['name'] ?? '', 60);
        if ($name === '') continue;
        $insC->execute([$name, ++$pos, kfClean(is_string($c['en'] ?? null) ? $c['en'] : '', 60)]);
        $getC->execute([$name]);
        $cid = (int)$getC->fetchColumn();
        $new[kfLower($name)] = $cid;
        foreach ((array)($c['products'] ?? []) as $p) {
            $en = is_array($p) ? kfClean(is_string($p['en'] ?? null) ? $p['en'] : '', 60) : '';
            $p = kfClean(is_array($p) ? (is_string($p['de'] ?? null) ? $p['de'] : '') : $p, 60);
            if ($p !== '') $insP->execute([$cid, $p, $en]);
        }
    }
    // Neue Nummern sind immer größer als alle alten (AUTOINCREMENT), es kann also nichts doppelt umgehängt werden
    foreach ($old as $id => $lname) {
        $to = $new[$lname] ?? 0;
        foreach (['items', 'usage', 'template_items'] as $t) {
            $pdo->prepare("UPDATE $t SET cat_id = ? WHERE cat_id = ?")->execute([$to, $id]);
        }
        if ($to) $pdo->prepare('UPDATE list_order SET cat_id = ? WHERE cat_id = ?')->execute([$to, $id]);
        else $pdo->prepare('DELETE FROM list_order WHERE cat_id = ?')->execute([$id]);
    }
    // Was keine Warengruppe (mehr) hat, bekommt die des gleichnamigen Produkts, z. B. nach „Alles löschen“ und „Standard wiederherstellen“
    foreach (['items', 'usage', 'template_items'] as $t) {
        $pdo->exec("UPDATE $t SET cat_id = (SELECT p.cat_id FROM products p WHERE p.name = $t.name)
                    WHERE cat_id = 0 AND EXISTS (SELECT 1 FROM products p WHERE p.name = $t.name)");
    }
    kfBump('cv', $pdo);
    $pdo->exec('UPDATE lists SET version = version + 1');
    if ($own) $pdo->commit();
}

function kfSeedTemplates(PDO $pdo): void {
    $cat = [];
    foreach ($pdo->query('SELECT name, cat_id FROM products') as $r) $cat[kfLower($r['name'])] = (int)$r['cat_id'];
    $insT = $pdo->prepare('INSERT INTO templates (name) VALUES (?)');
    $insI = $pdo->prepare('INSERT INTO template_items (template_id, pos, name, cat_id) VALUES (?, ?, ?, ?)');
    foreach (kfDefaultTemplates() as $name => $items) {
        $insT->execute([$name]);
        $tid = (int)$pdo->lastInsertId();
        foreach ($items as $i => $n) $insI->execute([$tid, $i, $n, $cat[kfLower($n)] ?? 0]);
    }
}

function kfTemplates(): array {
    $out = [];
    $idx = [];
    foreach (kfQ('SELECT id, name FROM templates ORDER BY name COLLATE NOCASE') as $r) {
        $idx[(int)$r['id']] = count($out);
        $out[] = ['id' => (int)$r['id'], 'n' => $r['name'], 'items' => []];
    }
    foreach (kfQ('SELECT template_id, name, cat_id, note FROM template_items ORDER BY template_id, pos') as $r) {
        if (isset($idx[(int)$r['template_id']])) $out[$idx[(int)$r['template_id']]]['items'][] = ['n' => $r['name'], 'c' => (int)$r['cat_id'], 'note' => $r['note']];
    }
    return $out;
}

/* ---------- Listen ---------- */

/** Die Liste, wenn der Benutzer Mitglied ist, sonst null */
function kfListFor(int $uid, int $lid): ?array {
    $row = kfQ('SELECT l.id, l.name, l.owner_id, l.version FROM lists l JOIN members m ON m.list_id = l.id WHERE l.id = ? AND m.user_id = ?', [$lid, $uid])->fetch();
    return $row ?: null;
}

function kfTouchList(int $lid): void {
    kfQ('UPDATE lists SET version = version + 1 WHERE id = ?', [$lid]);
}

function kfListData(int $lid): array {
    $items = [];
    // got: seit wann im Einkaufskorb, 0 = noch zu kaufen
    foreach (kfQ('SELECT uid, name, cat_id, note, added_by, added_at, got_at FROM items WHERE list_id = ? ORDER BY added_at, uid', [$lid]) as $r) {
        $items[] = ['uid' => $r['uid'], 'n' => $r['name'], 'c' => (int)$r['cat_id'], 'note' => $r['note'], 'by' => (int)$r['added_by'], 'at' => (int)$r['added_at'],
                    'got' => (int)$r['got_at']];
    }
    // Gekauftes: die 80 jüngsten immer, dazu alles aus den letzten 120 Tagen (für „vor 3 Tagen“ und „Bald wieder fällig“).
    // g = mittlerer Abstand zwischen zwei Käufen in Sekunden, gn = wie viele Abstände eingeflossen sind (-1 = nicht vorschlagen)
    $usage = [];
    $since = time() - 120 * 86400;
    foreach (kfQ('SELECT name, cat_id, cnt, last_at, gap, gn FROM usage WHERE list_id = ? ORDER BY last_at DESC LIMIT 800', [$lid]) as $i => $r) {
        if ($i >= 80 && (int)$r['last_at'] < $since) break;
        $usage[] = ['n' => $r['name'], 'c' => (int)$r['cat_id'], 'cnt' => (int)$r['cnt'], 'last' => (int)$r['last_at'], 'g' => (int)$r['gap'], 'gn' => (int)$r['gn']];
    }
    $order = [];
    foreach (kfQ('SELECT cat_id FROM list_order WHERE list_id = ? ORDER BY pos', [$lid]) as $r) $order[] = (int)$r['cat_id'];
    // Gemerkte Mengen: was beim letzten Abhaken am Produkt stand
    $mem = [];
    foreach (kfQ("SELECT name, note FROM usage WHERE list_id = ? AND note <> '' ORDER BY last_at DESC LIMIT 2000", [$lid]) as $r) $mem[] = [$r['name'], $r['note']];
    return ['id' => $lid, 'v' => (int)kfQ('SELECT version FROM lists WHERE id = ?', [$lid])->fetchColumn(), 'items' => $items, 'usage' => $usage, 'order' => $order, 'mem' => $mem];
}

/** Alles, was die Oberfläche außer dem Inhalt einer Liste braucht */
function kfState(array $me): array {
    $lists = [];
    $idx = [];
    foreach (kfQ('SELECT l.id, l.name, l.owner_id, (SELECT COUNT(*) FROM items i WHERE i.list_id = l.id AND i.got_at = 0) AS cnt
                  FROM lists l JOIN members m ON m.list_id = l.id WHERE m.user_id = ? ORDER BY l.id', [$me['id']]) as $r) {
        $idx[(int)$r['id']] = count($lists);
        $lists[] = ['id' => (int)$r['id'], 'n' => $r['name'], 'owner' => (int)$r['owner_id'], 'count' => (int)$r['cnt'], 'members' => []];
    }
    if ($idx) {
        foreach (kfQ('SELECT list_id, user_id FROM members WHERE list_id IN (' . implode(',', array_keys($idx)) . ') ORDER BY user_id') as $r) {
            $lists[$idx[(int)$r['list_id']]]['members'][] = (int)$r['user_id'];
        }
    }
    $users = [];
    foreach (kfQ('SELECT id, name, is_admin FROM users ORDER BY name COLLATE NOCASE') as $r) {
        $users[] = ['id' => (int)$r['id'], 'n' => $r['name'], 'admin' => (int)$r['is_admin'] === 1];
    }
    $look = json_decode((string)kfQ('SELECT look FROM users WHERE id = ?', [$me['id']])->fetchColumn(), true);
    return [
        'me' => ['id' => $me['id'], 'n' => $me['name'], 'admin' => $me['is_admin'], 'look' => is_array($look) ? $look : null],
        'csrf' => $me['csrf'], 'version' => KF_VERSION,
        'interval' => max(1, min(60, (int)kfGet('interval', '5'))),
        'cv' => (int)kfGet('cv', '1'), 'lv' => (int)kfGet('lv', '1'),
        'startList' => (int)kfGet('start_list', '0'),
        'push' => kfPushPublic(),   // öffentlicher Schlüssel für Mitteilungen, leer = dieser Server kann keine verschicken
        'users' => $users, 'lists' => $lists, 'catalog' => kfCatalog(), 'templates' => kfTemplates(),
        // nur für den Administrator: neuere Version bekannt? Soll das Gerät heute nachsehen lassen (tägliches Nachsehen eingeschaltet)?
        'upd' => $me['is_admin'] ? ['v' => kfUpdNewer($i = kfUpdInfo()) ? $i['v'] : '', 'check' => kfGet('upd_auto') === '1' && time() - (int)kfGet('upd_at', '0') > 20 * 3600] : null,
    ];
}

/**
 * Gekauft: Zähler und Kaufrhythmus lernen. Abstand zum letzten Kauf, geglättet. Unter 12 Stunden ist es derselbe Einkauf,
 * ein Ausreißer (Urlaub) zählt höchstens dreimal so viel wie der bisherige Abstand. Der Stand davor kommt nach prev,
 * damit Rückgängig (kfUsageUndo) ihn zurückholen kann. Die Menge am Eintrag wird fürs nächste Mal gemerkt.
 */
function kfUsageBought(int $lid, array $row, int $now): void {
    $u = kfQ('SELECT last_at, gap, gn FROM usage WHERE list_id = ? AND name = ?', [$lid, $row['name']])->fetch();
    $gap = $u ? (int)$u['gap'] : 0;
    $gn = $u ? (int)$u['gn'] : 0;
    $d = $u ? $now - (int)$u['last_at'] : 0;
    if ($u && $d >= 43200) {
        if ($gap > 0) $d = min($d, 3 * $gap);
        $gap = $gap > 0 ? (int)round($gap * .6 + $d * .4) : $d;
        if ($gn >= 0) $gn++;
    }
    kfQ('INSERT INTO usage (list_id, name, cat_id, cnt, last_at, note, gap, gn, prev) VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
         ON CONFLICT(list_id, name) DO UPDATE SET cnt = cnt + 1, last_at = excluded.last_at, cat_id = excluded.cat_id, note = excluded.note,
         gap = excluded.gap, gn = excluded.gn, prev = excluded.prev',
        [$lid, $row['name'], (int)$row['cat_id'], $now, (string)$row['note'], $gap, $gn, $u ? $u['last_at'] . ',' . $u['gap'] . ',' . $u['gn'] : '']);
}

/** Abhaken rückgängig: Zähler und Kaufrhythmus wie vorher, ohne gemerkten Stand nur einen weniger */
function kfUsageUndo(int $lid, string $name): void {
    $u = kfQ('SELECT prev FROM usage WHERE list_id = ? AND name = ?', [$lid, $name])->fetch();
    $p = $u ? explode(',', (string)$u['prev']) : [];
    if (count($p) === 3) kfQ("UPDATE usage SET cnt = cnt - 1, last_at = ?, gap = ?, gn = ?, prev = '' WHERE list_id = ? AND name = ?", [(int)$p[0], (int)$p[1], (int)$p[2], $lid, $name]);
    else kfQ('UPDATE usage SET cnt = cnt - 1 WHERE list_id = ? AND name = ?', [$lid, $name]);
    kfQ('DELETE FROM usage WHERE list_id = ? AND name = ? AND cnt <= 0', [$lid, $name]);
}

/**
 * Änderungen an einer Liste. Jede ist so gebaut, dass sie ohne Schaden doppelt ankommen darf,
 * denn ein Handy ohne Netz schickt seine gesammelten Änderungen später nach.
 */
function kfApplyOps(array $me, int $lid, array $ops): void {
    $db = kfDb();
    $db->beginTransaction();
    $changed = false;
    $now = time();
    foreach (array_slice($ops, 0, 500) as $op) {
        if (!is_array($op)) continue;
        $t = (string)($op['t'] ?? '');
        $uid = (string)($op['uid'] ?? '');
        $uidOk = (bool)preg_match('/^[A-Za-z0-9_-]{8,40}$/', $uid);
        $name = kfClean($op['n'] ?? '', 60);
        $cat = max(0, (int)($op['c'] ?? 0));
        $note = kfClean($op['note'] ?? '', 80);

        if (($t === 'add' || $t === 'restore') && $uidOk && $name !== '') {
            if (kfQ('SELECT 1 FROM items WHERE uid = ?', [$uid])->fetchColumn()) continue;
            $same = kfQ('SELECT uid FROM items WHERE list_id = ? AND name = ? AND got_at = 0', [$lid, $name])->fetchColumn();
            if ($same !== false) {
                if ($note !== '') { kfQ('UPDATE items SET note = ? WHERE uid = ?', [$note, $same]); $changed = true; }
            } else {
                // Liegt es schon im Korb, wird es eben noch einmal gebraucht: das im Korb ist gekauft und fällt weg, die Liste bekommt es neu
                kfQ('DELETE FROM items WHERE list_id = ? AND name = ? AND got_at > 0', [$lid, $name]);
                kfQ('INSERT INTO items (uid, list_id, name, cat_id, note, added_by, added_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                    [$uid, $lid, $name, $cat, $note, (int)($t === 'restore' && !empty($op['by']) ? $op['by'] : $me['id']), $now]);
                $changed = true;
                if ($t === 'add') kfPushQueue($lid, $me['id'], $name);   // die anderen erfahren es gebündelt, siehe push.php
            }
            if ($t === 'restore') kfUsageUndo($lid, $name);   // altes Abhaken (done) rückgängig
        } elseif ($t === 'got' && $uidOk) {   // abgehakt: in den Korb, zählt als gekauft
            $row = kfQ('SELECT name, cat_id, note FROM items WHERE uid = ? AND list_id = ? AND got_at = 0', [$uid, $lid])->fetch();
            if (!$row) continue;
            kfQ('UPDATE items SET got_at = ? WHERE uid = ?', [$now, $uid]);
            kfPushUnqueue($lid, $row['name']);
            kfUsageBought($lid, $row, $now);
            $changed = true;
        } elseif ($t === 'ungot' && $uidOk) {   // aus dem Korb zurück auf die Liste
            $row = kfQ('SELECT name FROM items WHERE uid = ? AND list_id = ? AND got_at > 0', [$uid, $lid])->fetch();
            if (!$row) continue;
            kfQ('UPDATE items SET got_at = 0 WHERE uid = ?', [$uid]);
            kfUsageUndo($lid, $row['name']);
            $changed = true;
        } elseif ($t === 'back' && $uidOk && $name !== '') {   // Löschen rückgängig: genau so wieder hin, ohne Mitteilung und ohne Zählerei
            if (kfQ('SELECT 1 FROM items WHERE uid = ?', [$uid])->fetchColumn()) continue;
            if (kfQ('SELECT 1 FROM items WHERE list_id = ? AND name = ? AND got_at = 0', [$lid, $name])->fetchColumn()) continue;   // steht schon wieder drauf
            $got = max(0, min($now, (int)($op['got'] ?? 0)));
            if (!$got) kfQ('DELETE FROM items WHERE list_id = ? AND name = ? AND got_at > 0', [$lid, $name]);
            elseif (kfQ('SELECT 1 FROM items WHERE list_id = ? AND name = ?', [$lid, $name])->fetchColumn()) continue;
            $at = (int)($op['at'] ?? 0);
            kfQ('INSERT INTO items (uid, list_id, name, cat_id, note, added_by, added_at, got_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [$uid, $lid, $name, $cat, $note, max(0, (int)($op['by'] ?? 0)) ?: $me['id'], $at > 0 && $at <= $now ? $at : $now, $got]);
            $changed = true;
        } elseif (($t === 'done' || $t === 'remove') && $uidOk) {   // done: Abhaken ohne Korb (ältere App-Versionen), remove: löschen
            $row = kfQ('SELECT name, cat_id, note, got_at FROM items WHERE uid = ? AND list_id = ?', [$uid, $lid])->fetch();
            if (!$row) continue;
            kfQ('DELETE FROM items WHERE uid = ?', [$uid]);
            kfPushUnqueue($lid, $row['name']);
            if ($t === 'done' && !(int)$row['got_at']) kfUsageBought($lid, $row, $now);
            $changed = true;
        } elseif ($t === 'edit' && $uidOk) {
            $st = kfQ('UPDATE items SET note = ?, cat_id = ? WHERE uid = ? AND list_id = ?', [$note, $cat, $uid, $lid]);
            $changed = $changed || $st->rowCount() > 0;
        } elseif ($t === 'forget' && $name !== '') {
            $st = kfQ('DELETE FROM usage WHERE list_id = ? AND name = ?', [$lid, $name]);
            $changed = $changed || $st->rowCount() > 0;
        } elseif (($t === 'nodue' || $t === 'redue') && $name !== '') {   // „Bald wieder fällig“ für dieses Produkt aus oder wieder an
            $st = $t === 'nodue' ? kfQ('UPDATE usage SET gn = -1 WHERE list_id = ? AND name = ? AND gn >= 0', [$lid, $name])
                                 : kfQ('UPDATE usage SET gn = CASE WHEN gap > 0 THEN 2 ELSE 0 END WHERE list_id = ? AND name = ? AND gn < 0', [$lid, $name]);
            $changed = $changed || $st->rowCount() > 0;
        } elseif ($t === 'unmem' && $name !== '') {   // gemerkte Menge vergessen, „Zuletzt gekauft“ bleibt
            $st = kfQ("UPDATE usage SET note = '' WHERE list_id = ? AND name = ? AND note <> ''", [$lid, $name]);
            $changed = $changed || $st->rowCount() > 0;
        }
    }
    if ($changed) kfTouchList($lid);
    $db->commit();
}

function kfDeleteList(int $lid): void {
    foreach (['items', 'usage', 'members', 'list_order', 'push_pending'] as $t) kfQ("DELETE FROM $t WHERE list_id = ?", [$lid]);
    kfQ('DELETE FROM lists WHERE id = ?', [$lid]);
}
