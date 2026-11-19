<?php
/* Kaufen – alle JSON-Aktionen. Wird von index.php eingebunden, $me und $action sind gesetzt. */
defined('KF_VERSION') || exit;

function kfJson($data, int $code = 200): void {
    http_response_code($code);
    kfHeaders();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    $out = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    // Stehen noch Mitteilungen an, soll das Gerät nicht auf deren Versand warten: mit der Länge weiß es, wann die Antwort vollständig ist
    if (!empty($GLOBALS['kfPushJob']) && !headers_sent() && !filter_var(ini_get('zlib.output_compression'), FILTER_VALIDATE_BOOLEAN)) header('Content-Length: ' . strlen($out));
    echo $out;
    exit;
}

/** Mitteilungen erst verschicken, wenn die Antwort draußen ist. $GLOBALS['kfPushJob']: 'due' = was lange genug liegt, Zahl = alles von diesem Konto. */
register_shutdown_function(function () {
    $job = $GLOBALS['kfPushJob'] ?? null;
    if ($job === null) return;
    try {
        ignore_user_abort(true);
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
        else { while (ob_get_level() > 0) @ob_end_flush(); @flush(); }
        @set_time_limit(40);
        kfPushFlush($job === 'due' ? null : (int)$job);
    } catch (Throwable $e) {
        error_log('Kaufen Push: ' . $e->getMessage());
    }
});

function kfFail(string $msg, int $code = 400): void {
    kfJson(['error' => $msg], $code);
}

if (!$me) kfFail(kfT('Nicht angemeldet.'), 401);

$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = [];
if ($isPost) {
    $token = (string)($_SERVER['HTTP_X_CSRF'] ?? '');
    if ($token === '' || !hash_equals($me['csrf'], $token)) kfFail(kfT('Sitzung abgelaufen, bitte die Seite neu laden.'), 403);
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
}
$getOnly = ['state', 'list', 'poll', 'catalog_backups', 'maint', 'backup_get'];
if (in_array($action, $getOnly, true) === $isPost) kfFail(kfT('Falsche Aufrufart.'), 405);

$admin = function () use ($me) { if (!$me['is_admin']) kfFail(kfT('Das darf nur der Administrator.'), 403); };
$int = function (string $k) use ($in) { return (int)($in[$k] ?? 0); };
$needList = function (int $lid) use ($me) {
    $l = kfListFor($me['id'], $lid);
    if (!$l) kfFail(kfT('Diese Liste gibt es nicht (mehr) oder du bist kein Mitglied.'), 404);
    return $l;
};
$state = function (array $extra = []) use ($me) { kfJson($extra + kfState($me)); };

try {
    switch ($action) {

    /* ---------- lesen ---------- */
    case 'state':
        $GLOBALS['kfPushJob'] = 'due';
        $state();

    case 'list':
        $l = $needList((int)($_GET['id'] ?? 0));
        kfJson(kfListData((int)$l['id']));

    case 'poll':   // die Abfrage alle paar Sekunden: so klein wie möglich
        $GLOBALS['kfPushJob'] = 'due';   // liegen Mitteilungen lange genug, gehen sie nach dieser Antwort raus
        $l = kfListFor($me['id'], (int)($_GET['id'] ?? 0));
        kfJson(['v' => $l ? (int)$l['version'] : null, 'cv' => (int)kfGet('cv', '1'), 'lv' => (int)kfGet('lv', '1'),
                'iv' => max(1, min(60, (int)kfGet('interval', '5')))]);

    /* ---------- Einträge ---------- */
    case 'ops':
        $l = $needList($int('list'));
        kfApplyOps($me, (int)$l['id'], is_array($in['ops'] ?? null) ? $in['ops'] : []);
        kfJson(kfListData((int)$l['id']));

    /* ---------- Listen ---------- */
    case 'list_create':
        $name = kfClean($in['name'] ?? '', 40);
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        if ((int)kfQ('SELECT COUNT(*) FROM lists WHERE owner_id = ?', [$me['id']])->fetchColumn() >= 30) kfFail(kfT('Mehr als 30 eigene Listen gehen nicht.'));
        kfQ('INSERT INTO lists (name, owner_id, created_at) VALUES (?, ?, ?)', [$name, $me['id'], time()]);
        $lid = (int)kfDb()->lastInsertId();
        kfQ('INSERT INTO members (list_id, user_id) VALUES (?, ?)', [$lid, $me['id']]);
        kfBump('lv');
        $state(['created' => $lid]);

    case 'list_rename':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail(kfT('Umbenennen kann nur, wer die Liste angelegt hat.'), 403);
        $name = kfClean($in['name'] ?? '', 40);
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        kfQ('UPDATE lists SET name = ? WHERE id = ?', [$name, $l['id']]);
        kfBump('lv');
        $state();

    case 'list_share':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail(kfT('Teilen kann nur, wer die Liste angelegt hat.'), 403);
        $want = [$me['id'] => true];
        foreach ((array)($in['users'] ?? []) as $u) {
            if (kfQ('SELECT 1 FROM users WHERE id = ?', [(int)$u])->fetchColumn()) $want[(int)$u] = true;
        }
        kfDb()->beginTransaction();
        kfQ('DELETE FROM members WHERE list_id = ?', [$l['id']]);
        foreach (array_keys($want) as $u) kfQ('INSERT INTO members (list_id, user_id) VALUES (?, ?)', [$l['id'], $u]);
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'list_leave':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] === $me['id']) kfFail(kfT('Die eigene Liste kann man nicht verlassen, nur löschen.'));
        kfQ('DELETE FROM members WHERE list_id = ? AND user_id = ?', [$l['id'], $me['id']]);
        kfBump('lv');
        $state();

    case 'list_delete':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail(kfT('Löschen kann nur, wer die Liste angelegt hat.'), 403);
        kfDb()->beginTransaction();
        kfDeleteList((int)$l['id']);
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'list_order':   // Reihenfolge der Warengruppen für diese Liste (so wie der Laden aufgebaut ist)
        $l = $needList($int('id'));
        kfDb()->beginTransaction();
        kfQ('DELETE FROM list_order WHERE list_id = ?', [$l['id']]);
        $pos = 0;
        $seen = [];
        foreach ((array)($in['order'] ?? []) as $c) {
            $c = (int)$c;
            if ($c <= 0 || isset($seen[$c]) || $pos >= 200) continue;
            $seen[$c] = true;
            kfQ('INSERT INTO list_order (list_id, cat_id, pos) VALUES (?, ?, ?)', [$l['id'], $c, ++$pos]);
        }
        kfTouchList((int)$l['id']);
        kfDb()->commit();
        kfJson(kfListData((int)$l['id']));

    /* ---------- Katalog ---------- */
    case 'cat_add':
        $name = kfClean($in['name'] ?? '', 60);
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        if (kfQ('SELECT 1 FROM cats WHERE name = ?', [$name])->fetchColumn()) kfFail(kfT('Diese Warengruppe gibt es schon.'));
        kfQ('INSERT INTO cats (name, pos) VALUES (?, (SELECT COALESCE(MAX(pos), 0) + 1 FROM cats))', [$name]);
        kfBump('cv');
        $state();

    case 'cat_rename':
        $name = kfClean($in['name'] ?? '', 60);
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        if (kfQ('SELECT 1 FROM cats WHERE name = ? AND id <> ?', [$name, $int('id')])->fetchColumn()) kfFail(kfT('Diese Warengruppe gibt es schon.'));
        // Bei einem neuen Namen passt der eigene englische Name nicht mehr
        kfQ("UPDATE cats SET en = CASE WHEN name = ? THEN en ELSE '' END, name = ? WHERE id = ?", [$name, $name, $int('id')]);
        kfBump('cv');
        $state();

    case 'cat_delete':
        $id = $int('id');
        $name = kfQ('SELECT name FROM cats WHERE id = ?', [$id])->fetchColumn();
        if ($name === false) $state();
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor dem Löschen von „' . $name . '“');
        kfQ('DELETE FROM products WHERE cat_id = ?', [$id]);
        kfQ('DELETE FROM cats WHERE id = ?', [$id]);
        kfQ('DELETE FROM list_order WHERE cat_id = ?', [$id]);
        foreach (['items', 'usage', 'template_items'] as $t) kfQ("UPDATE $t SET cat_id = 0 WHERE cat_id = ?", [$id]);
        kfQ('UPDATE lists SET version = version + 1');
        kfBump('cv');
        kfDb()->commit();
        $state();

    case 'prod_add':
        $name = kfClean($in['name'] ?? '', 60);
        $cat = $int('cat');
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        if (!kfQ('SELECT 1 FROM cats WHERE id = ?', [$cat])->fetchColumn()) kfFail(kfT('Bitte eine Warengruppe wählen.'));
        if (kfQ('SELECT 1 FROM products WHERE name = ?', [$name])->fetchColumn()) {
            if (!empty($in['quiet'])) $state();
            kfFail(kfT('„%s“ gibt es schon im Katalog.', $name));
        }
        kfQ('INSERT INTO products (cat_id, name) VALUES (?, ?)', [$cat, $name]);
        kfBump('cv');
        $state();

    case 'prod_edit':
        $name = kfClean($in['name'] ?? '', 60);
        $cat = $int('cat');
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        if (!kfQ('SELECT 1 FROM cats WHERE id = ?', [$cat])->fetchColumn()) kfFail(kfT('Bitte eine Warengruppe wählen.'));
        if (kfQ('SELECT 1 FROM products WHERE name = ? AND id <> ?', [$name, $int('id')])->fetchColumn()) kfFail(kfT('„%s“ gibt es schon im Katalog.', $name));
        kfQ("UPDATE products SET en = CASE WHEN name = ? THEN en ELSE '' END, name = ?, cat_id = ? WHERE id = ?", [$name, $name, $cat, $int('id')]);
        kfBump('cv');
        $state();

    case 'prod_delete':
        kfQ('DELETE FROM products WHERE id = ?', [$int('id')]);
        kfBump('cv');
        $state();

    case 'catalog_clear':
        $admin();
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor „Alles löschen“');
        kfCatalogReplace([]);
        kfDb()->commit();
        $state();

    case 'catalog_reset':
        $admin();
        require_once KF_APP . '/lib/catalog.php';
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor „Standard wiederherstellen“');
        kfCatalogReplace(kfDefaultCatalog());
        kfDb()->commit();
        $state();

    case 'catalog_import':   // ganzer Katalog aus einer Datei (CSV oder JSON, im Browser gelesen), ersetzt den bisherigen
        $admin();
        $data = is_array($in['data'] ?? null) ? array_values($in['data']) : [];
        $n = 0;
        foreach ($data as $c) $n += is_array($c) && is_array($c['products'] ?? null) ? count($c['products']) : 0;
        if (!$data || count($data) > 200 || $n > 5000) kfFail(kfT('Die Datei enthält keinen brauchbaren Katalog.'));
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor dem Import');
        kfCatalogReplace(array_filter($data, 'is_array'));
        kfDb()->commit();
        $state();

    case 'catalog_backups':
        $admin();
        $out = [];
        foreach (kfQ('SELECT id, at, reason, cats, products FROM catalog_backups ORDER BY id DESC') as $r) {
            $out[] = ['id' => (int)$r['id'], 'at' => (int)$r['at'], 'reason' => $r['reason'], 'cats' => (int)$r['cats'], 'products' => (int)$r['products']];
        }
        kfJson(['backups' => $out]);

    case 'catalog_restore':
        $admin();
        $data = kfQ('SELECT data FROM catalog_backups WHERE id = ?', [$int('id')])->fetchColumn();
        $data = $data === false ? null : json_decode((string)$data, true);
        if (!is_array($data)) kfFail(kfT('Diese Sicherung gibt es nicht mehr.'));
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor dem Zurückholen einer Sicherung');
        kfCatalogReplace($data);
        kfDb()->commit();
        $state();

    /* ---------- Vorlagen ---------- */
    case 'tpl_save':
        $name = kfClean($in['name'] ?? '', 40);
        if ($name === '') kfFail(kfT('Bitte einen Namen eingeben.'));
        $items = [];
        foreach (array_slice((array)($in['items'] ?? []), 0, 200) as $it) {
            $n = kfClean($it['n'] ?? '', 60);
            if ($n !== '') $items[kfLower($n)] = [$n, max(0, (int)($it['c'] ?? 0)), kfClean($it['note'] ?? '', 80)];
        }
        if (!$items) kfFail(kfT('Die Vorlage braucht mindestens ein Produkt.'));
        kfDb()->beginTransaction();
        $id = $int('id');
        if ($id && kfQ('SELECT 1 FROM templates WHERE id = ?', [$id])->fetchColumn()) {
            kfQ('UPDATE templates SET name = ? WHERE id = ?', [$name, $id]);
            kfQ('DELETE FROM template_items WHERE template_id = ?', [$id]);
        } else {
            kfQ('INSERT INTO templates (name, created_by) VALUES (?, ?)', [$name, $me['id']]);
            $id = (int)kfDb()->lastInsertId();
        }
        $pos = 0;
        foreach ($items as $it) kfQ('INSERT INTO template_items (template_id, pos, name, cat_id, note) VALUES (?, ?, ?, ?, ?)', [$id, $pos++, $it[0], $it[1], $it[2]]);
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'tpl_delete':
        kfQ('DELETE FROM template_items WHERE template_id = ?', [$int('id')]);
        kfQ('DELETE FROM templates WHERE id = ?', [$int('id')]);
        kfBump('lv');
        $state();

    /* ---------- Konten ---------- */
    case 'user_add':
        $admin();
        $name = kfClean($in['name'] ?? '', 30);
        $pass = (string)($in['pass'] ?? '');
        if (($e = kfCheckName($name)) !== '' || ($e = kfCheckPass($pass)) !== '') kfFail($e);
        if (kfQ('SELECT 1 FROM users WHERE name = ?', [$name])->fetchColumn()) kfFail(kfT('Diesen Namen gibt es schon.'));
        if ((int)kfQ('SELECT COUNT(*) FROM users')->fetchColumn() >= KF_MAX_USERS) kfFail(kfT('Mehr als %d Konten gehen nicht.', KF_MAX_USERS));
        kfDb()->beginTransaction();
        kfQ('INSERT INTO users (name, pass, is_admin, created_at) VALUES (?, ?, 0, ?)', [$name, password_hash($pass, PASSWORD_DEFAULT), time()]);
        $uid = (int)kfDb()->lastInsertId();
        foreach ((array)($in['lists'] ?? []) as $lid) {   // nur in Listen einladen, die dem Administrator selbst gehören
            if (kfQ('SELECT 1 FROM lists WHERE id = ? AND owner_id = ?', [(int)$lid, $me['id']])->fetchColumn()) {
                kfQ('INSERT OR IGNORE INTO members (list_id, user_id) VALUES (?, ?)', [(int)$lid, $uid]);
            }
        }
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'user_rename':   // Namen eines Kontos ändern. Angemeldete Geräte bleiben angemeldet, beim nächsten Anmelden gilt der neue Name.
        $admin();
        $name = kfClean($in['name'] ?? '', 30);
        if (($e = kfCheckName($name)) !== '') kfFail($e);
        if (kfQ('SELECT 1 FROM users WHERE name = ? AND id <> ?', [$name, $int('id')])->fetchColumn()) kfFail(kfT('Diesen Namen gibt es schon.'));
        kfQ('UPDATE users SET name = ? WHERE id = ?', [$name, $int('id')]);
        kfBump('lv');
        $state();

    case 'user_pass':
        $admin();
        $pass = (string)($in['pass'] ?? '');
        if (($e = kfCheckPass($pass)) !== '') kfFail($e);
        kfQ('UPDATE users SET pass = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $int('id')]);
        kfQ('DELETE FROM sessions WHERE user_id = ? AND hash <> ?', [$int('id'), $me['hash']]);
        $state();

    case 'user_delete':
        $admin();
        $id = $int('id');
        if ($id === $me['id']) kfFail(kfT('Das eigene Konto kann man nicht löschen.'));
        kfDb()->beginTransaction();
        // Listen des gelöschten Kontos gehen an den Administrator, damit nichts verloren geht
        foreach (kfQ('SELECT id FROM lists WHERE owner_id = ?', [$id])->fetchAll() as $r) {
            kfQ('UPDATE lists SET owner_id = ? WHERE id = ?', [$me['id'], $r['id']]);
            kfQ('INSERT OR IGNORE INTO members (list_id, user_id) VALUES (?, ?)', [$r['id'], $me['id']]);
        }
        kfQ('DELETE FROM members WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM sessions WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM push_subs WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM push_pending WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM users WHERE id = ?', [$id]);
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'me_pass':
        $row = kfQ('SELECT pass FROM users WHERE id = ?', [$me['id']])->fetch();
        if (!$row || !password_verify((string)($in['old'] ?? ''), $row['pass'])) kfFail(kfT('Das bisherige Passwort stimmt nicht.'));
        $pass = (string)($in['pass'] ?? '');
        if (($e = kfCheckPass($pass)) !== '') kfFail($e);
        kfQ('UPDATE users SET pass = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $me['id']]);
        kfQ('DELETE FROM sessions WHERE user_id = ? AND hash <> ?', [$me['id'], $me['hash']]);   // andere Geräte abmelden
        kfJson(['ok' => true]);

    case 'me_look':   // Aussehen, Sprache und Mengen-Einstellungen des eigenen Kontos, gelten auf allen Geräten
        $l = is_array($in['look'] ?? null) ? $in['look'] : [];
        $old = json_decode((string)kfQ('SELECT look FROM users WHERE id = ?', [$me['id']])->fetchColumn(), true);
        if (!is_array($old)) $old = [];
        $pal = function ($v) { return is_string($v) && preg_match('/^[a-z]{1,20}$/', $v) ? $v : ''; };
        $cols = function ($v) {
            if (!is_array($v)) return null;
            $out = [];
            foreach (['bg', 'card', 'text', 'acc'] as $k) {
                $c = $v[$k] ?? '';
                if (!is_string($c) || !preg_match('/^#[0-9a-f]{6}$/', $c)) return null;
                $out[$k] = $c;
            }
            // Schriftfarben sind freiwillig: Überschriften, Nebentext, Schrift auf dem Akzent, Menge. Fehlen sie, rechnet die App sie aus.
            foreach (['head', 'mut', 'at', 'qty'] as $k) {
                $c = $v[$k] ?? '';
                if (is_string($c) && preg_match('/^#[0-9a-f]{6}$/', $c)) $out[$k] = $c;
            }
            return $out;
        };
        $look = ['mode' => in_array($l['mode'] ?? '', ['light', 'dark'], true) ? $l['mode'] : 'auto',
                 'l' => $pal($l['l'] ?? ''), 'd' => $pal($l['d'] ?? ''), 'cl' => $cols($l['cl'] ?? null), 'cd' => $cols($l['cd'] ?? null)];
        // Sprache, Menge merken, eigene Einheiten. Schickt ein Gerät sie nicht mit (ältere Fassung im Zwischenspeicher), bleibt der gespeicherte Wert.
        $src = function (string $k) use ($l, $old) { return array_key_exists($k, $l) ? $l[$k] : ($old[$k] ?? null); };
        $look['lang'] = in_array($src('lang'), ['de', 'en'], true) ? $src('lang') : '';
        $look['keep'] = $src('keep') !== false;
        $look['who'] = $src('who') !== false;
        $look['due'] = $src('due') !== false;
        // Eigene Einheiten als „Kiste/Kisten“ (Einzahl/Mehrzahl) oder nur „Eimer“. Schickt ein älteres Gerät nur die Einzahl, bleibt die gespeicherte Mehrzahl.
        $oldUnits = (array)($old['units'] ?? []);
        $look['units'] = [];
        foreach ((array)$src('units') as $u) {
            $u = kfClean($u, 25);
            if ($u === '' || !preg_match('~^[^\d\s,;/]{1,12}(?:/[^\d\s,;/]{1,12})?$~u', $u)) continue;
            if (strpos($u, '/') === false && !array_key_exists('uv', $l)) {   // nur ältere Geräte schicken kein uv mit
                foreach ($oldUnits as $o) if (is_string($o) && strpos($o, $u . '/') === 0) { $u = $o; break; }
            }
            if (!in_array($u, $look['units'], true) && count($look['units']) < 12) $look['units'][] = $u;
        }
        // Mitgelieferte Einheiten, die bei der Mengenauswahl immer dastehen. null = Standard.
        $uv = $src('uv');
        if (is_array($uv)) {
            $look['uv'] = [];
            foreach ($uv as $k) {
                $k = kfClean($k, 12);
                if ($k !== '' && !in_array($k, $look['uv'], true) && count($look['uv']) < 60) $look['uv'][] = $k;
            }
        } else $look['uv'] = null;
        kfQ('UPDATE users SET look = ? WHERE id = ?', [json_encode($look, JSON_UNESCAPED_UNICODE), $me['id']]);
        kfBump('lv');   // damit die anderen Geräte des Kontos es beim nächsten Abgleich mitbekommen
        kfJson(['ok' => true]);

    /* ---------- Mitteilungen ---------- */
    case 'push_sub':   // dieses Gerät will Mitteilungen (auch beim Start der App: frischt Konto und Sprache auf)
        if (!kfPushOk()) kfFail(kfT('Dieser Server kann keine Mitteilungen verschicken.'));
        $endpoint = is_string($in['endpoint'] ?? null) ? $in['endpoint'] : '';
        $p256dh = kfB64uDec($in['keys']['p256dh'] ?? '');
        $auth = kfB64uDec($in['keys']['auth'] ?? '');
        if ($endpoint === '' || strlen($endpoint) > 1000 || !kfPushHostOk($endpoint) || strlen($p256dh) !== 65 || $p256dh[0] !== "\x04" || strlen($auth) < 8 || strlen($auth) > 64) {
            kfFail(kfT('Mitteilungen lassen sich auf diesem Gerät nicht einrichten.'));
        }
        if (kfGet('push_contact') === '') {   // Adresse dieser Installation, die der Mitteilungsdienst im Problemfall sieht
            $host = preg_replace('/[^A-Za-z0-9.\-:\[\]]/', '', (string)($_SERVER['HTTP_HOST'] ?? ''));
            kfSet('push_contact', 'https://' . ($host !== '' ? $host : 'localhost'));
        }
        kfQ('INSERT INTO push_subs (user_id, endpoint, p256dh, auth, lang, created_at) VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, lang = excluded.lang',
            [$me['id'], $endpoint, kfB64u($p256dh), kfB64u($auth), kfLang(), time()]);
        // Höchstens 10 Geräte pro Konto, die ältesten fallen heraus
        kfQ('DELETE FROM push_subs WHERE user_id = ? AND id NOT IN (SELECT id FROM push_subs WHERE user_id = ? ORDER BY id DESC LIMIT 10)', [$me['id'], $me['id']]);
        $sent = null;
        if (!empty($in['test'])) {   // gleich ausprobieren, damit man sieht, ob der Server den Mitteilungsdienst erreicht
            $row = kfQ('SELECT id, endpoint, p256dh, auth, lang FROM push_subs WHERE endpoint = ?', [$endpoint])->fetch();
            $sent = $row ? kfPushSend($row, ['t' => 'test']) : 0;
        }
        kfJson(['ok' => true, 'sent' => $sent]);

    case 'push_unsub':
        kfQ('DELETE FROM push_subs WHERE user_id = ? AND endpoint = ?', [$me['id'], is_string($in['endpoint'] ?? null) ? $in['endpoint'] : '']);
        kfJson(['ok' => true]);

    case 'push_done':   // das Gerät hat Kaufen verlassen: was dieses Konto auf Listen gesetzt hat, geht jetzt gebündelt an die anderen
        $GLOBALS['kfPushJob'] = $me['id'];
        kfJson(['ok' => true]);

    case 'settings_save':
        $admin();
        kfSet('interval', (string)max(1, min(60, $int('interval'))));
        kfBump('lv');
        $state();

    case 'logout':
        kfLogout($me);
        kfJson(['ok' => true]);

    /* ---------- Sicherung und Update (nur Administrator, siehe maint.php) ---------- */
    case 'maint':   // Stand für das Fenster „Sicherung und Update“
    case 'upd_check':
    case 'upd_auto':
        $admin();
        $err = '';
        if ($action === 'upd_auto') kfSet('upd_auto', !empty($in['on']) ? '1' : '0');
        if ($action === 'upd_check') { try { kfUpdCheck(); } catch (RuntimeException $e) { $err = $e->getMessage(); } }
        $info = kfUpdInfo();
        kfJson(['have' => KF_VERSION, 'info' => $info, 'newer' => kfUpdNewer($info), 'at' => (int)kfGet('upd_at', '0'), 'auto' => kfGet('upd_auto') === '1',
                'off' => kfUpdUrl() === '', 'prev' => kfUpdPrev(), 'locked' => kfUpdWritable(), 'restoreAt' => kfBackupPrevAt(), 'error' => $err,
                'maxUp' => (string)ini_get('post_max_size')]);

    /* ---------- Demo-Modus (siehe index.php): erst eine Rechenaufgabe holen, die richtige Lösung schaltet ihn ein ---------- */
    case 'demo_task':
        $admin();
        $a = random_int(13, 29); $b = random_int(6, 9); $c = random_int(11, 59);
        kfSet('demo_task', json_encode(['r' => $a * $b - $c, 'until' => time() + 600]));
        kfJson(['a' => $a, 'b' => $b, 'c' => $c]);

    case 'demo_on':
        $admin();
        $t = json_decode(kfGet('demo_task'), true);
        kfSet('demo_task', '');   // jede Aufgabe gilt nur für einen Versuch
        if (($in['sure'] ?? '') !== 'DEMO' || !is_array($t) || time() > (int)($t['until'] ?? 0)) kfFail(kfT('Die Aufgabe ist abgelaufen. Bitte noch einmal von vorn.'));
        if ((string)(int)trim((string)($in['answer'] ?? '')) !== trim((string)($in['answer'] ?? '')) || (int)$in['answer'] !== (int)$t['r']) {
            kfFail(kfT('Das stimmt nicht. Der Demo-Modus bleibt aus.'));
        }
        try { kfDemoOn(); } catch (RuntimeException $e) { kfFail($e->getMessage()); }
        kfJson(['ok' => true]);

    case 'upd_install':
    case 'upd_rollback':
        $admin();
        try { $v = $action === 'upd_install' ? kfUpdInstall() : kfUpdRollback(); } catch (RuntimeException $e) { kfFail($e->getMessage()); }
        kfJson(['ok' => true, 'v' => $v]);

    case 'backup_get':   // die ganze Datenbank als Datei
        $admin();
        $f = kfBackupFile();
        kfHeaders();
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="kaufen-sicherung-' . date('Y-m-d-His') . '.sqlite"');
        header('Content-Length: ' . filesize($f));
        header('Cache-Control: no-store');
        readfile($f);
        @unlink($f);
        exit;

    case 'backup_put':   // Sicherung einspielen: die Datei kommt roh im Body
    case 'backup_undo':
        $admin();
        if ($action === 'backup_put' && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0 && (string)file_get_contents('php://input', false, null, 0, 16) === '') {
            kfFail(kfT('Die Datei ist zu groß. Dieser Server nimmt höchstens %s an.', (string)ini_get('post_max_size')));
        }
        try { $action === 'backup_put' ? kfBackupRestore((string)file_get_contents('php://input')) : kfBackupUndo(); } catch (RuntimeException $e) { kfFail($e->getMessage()); }
        kfJson(['ok' => true]);

    default:
        kfFail(kfT('Unbekannte Aktion.'), 404);
    }
} catch (Throwable $e) {
    if (kfDb()->inTransaction()) kfDb()->rollBack();
    error_log('Kaufen: ' . $e->getMessage());
    kfFail(kfT('Das hat nicht geklappt. Bitte noch einmal versuchen.'), 500);
}
