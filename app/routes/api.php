<?php
/* Kaufen – alle JSON-Aktionen. Wird von index.php eingebunden, $me und $action sind gesetzt. */
defined('KF_VERSION') || exit;

function kfJson($data, int $code = 200): void {
    http_response_code($code);
    kfHeaders();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function kfFail(string $msg, int $code = 400): void {
    kfJson(['error' => $msg], $code);
}

if (!$me) kfFail('Nicht angemeldet.', 401);

$isPost = $_SERVER['REQUEST_METHOD'] === 'POST';
$in = [];
if ($isPost) {
    $token = (string)($_SERVER['HTTP_X_CSRF'] ?? '');
    if ($token === '' || !hash_equals($me['csrf'], $token)) kfFail('Sitzung abgelaufen, bitte die Seite neu laden.', 403);
    $in = json_decode((string)file_get_contents('php://input'), true);
    if (!is_array($in)) $in = [];
}
$getOnly = ['state', 'list', 'poll', 'catalog_backups'];
if (in_array($action, $getOnly, true) === $isPost) kfFail('Falsche Aufrufart.', 405);

$admin = function () use ($me) { if (!$me['is_admin']) kfFail('Das darf nur der Administrator.', 403); };
$int = function (string $k) use ($in) { return (int)($in[$k] ?? 0); };
$needList = function (int $lid) use ($me) {
    $l = kfListFor($me['id'], $lid);
    if (!$l) kfFail('Diese Liste gibt es nicht (mehr) oder du bist kein Mitglied.', 404);
    return $l;
};
$state = function (array $extra = []) use ($me) { kfJson($extra + kfState($me)); };

try {
    switch ($action) {

    /* ---------- lesen ---------- */
    case 'state':
        $state();

    case 'list':
        $l = $needList((int)($_GET['id'] ?? 0));
        kfJson(kfListData((int)$l['id']));

    case 'poll':   // die Abfrage alle paar Sekunden: so klein wie möglich
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
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        if ((int)kfQ('SELECT COUNT(*) FROM lists WHERE owner_id = ?', [$me['id']])->fetchColumn() >= 30) kfFail('Mehr als 30 eigene Listen gehen nicht.');
        kfQ('INSERT INTO lists (name, owner_id, created_at) VALUES (?, ?, ?)', [$name, $me['id'], time()]);
        $lid = (int)kfDb()->lastInsertId();
        kfQ('INSERT INTO members (list_id, user_id) VALUES (?, ?)', [$lid, $me['id']]);
        kfBump('lv');
        $state(['created' => $lid]);

    case 'list_rename':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail('Umbenennen kann nur, wer die Liste angelegt hat.', 403);
        $name = kfClean($in['name'] ?? '', 40);
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        kfQ('UPDATE lists SET name = ? WHERE id = ?', [$name, $l['id']]);
        kfBump('lv');
        $state();

    case 'list_share':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail('Teilen kann nur, wer die Liste angelegt hat.', 403);
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
        if ((int)$l['owner_id'] === $me['id']) kfFail('Die eigene Liste kann man nicht verlassen, nur löschen.');
        kfQ('DELETE FROM members WHERE list_id = ? AND user_id = ?', [$l['id'], $me['id']]);
        kfBump('lv');
        $state();

    case 'list_delete':
        $l = $needList($int('id'));
        if ((int)$l['owner_id'] !== $me['id']) kfFail('Löschen kann nur, wer die Liste angelegt hat.', 403);
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
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        if (kfQ('SELECT 1 FROM cats WHERE name = ?', [$name])->fetchColumn()) kfFail('Diese Warengruppe gibt es schon.');
        kfQ('INSERT INTO cats (name, pos) VALUES (?, (SELECT COALESCE(MAX(pos), 0) + 1 FROM cats))', [$name]);
        kfBump('cv');
        $state();

    case 'cat_rename':
        $name = kfClean($in['name'] ?? '', 60);
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        if (kfQ('SELECT 1 FROM cats WHERE name = ? AND id <> ?', [$name, $int('id')])->fetchColumn()) kfFail('Diese Warengruppe gibt es schon.');
        kfQ('UPDATE cats SET name = ? WHERE id = ?', [$name, $int('id')]);
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
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        if (!kfQ('SELECT 1 FROM cats WHERE id = ?', [$cat])->fetchColumn()) kfFail('Bitte eine Warengruppe wählen.');
        if (kfQ('SELECT 1 FROM products WHERE name = ?', [$name])->fetchColumn()) {
            if (!empty($in['quiet'])) $state();
            kfFail('„' . $name . '“ gibt es schon im Katalog.');
        }
        kfQ('INSERT INTO products (cat_id, name) VALUES (?, ?)', [$cat, $name]);
        kfBump('cv');
        $state();

    case 'prod_edit':
        $name = kfClean($in['name'] ?? '', 60);
        $cat = $int('cat');
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        if (!kfQ('SELECT 1 FROM cats WHERE id = ?', [$cat])->fetchColumn()) kfFail('Bitte eine Warengruppe wählen.');
        if (kfQ('SELECT 1 FROM products WHERE name = ? AND id <> ?', [$name, $int('id')])->fetchColumn()) kfFail('„' . $name . '“ gibt es schon im Katalog.');
        kfQ('UPDATE products SET name = ?, cat_id = ? WHERE id = ?', [$name, $cat, $int('id')]);
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
        if (!is_array($data)) kfFail('Diese Sicherung gibt es nicht mehr.');
        kfDb()->beginTransaction();
        kfCatalogBackup('Vor dem Zurückholen einer Sicherung');
        kfCatalogReplace($data);
        kfDb()->commit();
        $state();

    /* ---------- Vorlagen ---------- */
    case 'tpl_save':
        $name = kfClean($in['name'] ?? '', 40);
        if ($name === '') kfFail('Bitte einen Namen eingeben.');
        $items = [];
        foreach (array_slice((array)($in['items'] ?? []), 0, 200) as $it) {
            $n = kfClean($it['n'] ?? '', 60);
            if ($n !== '') $items[kfLower($n)] = [$n, max(0, (int)($it['c'] ?? 0)), kfClean($it['note'] ?? '', 80)];
        }
        if (!$items) kfFail('Die Vorlage braucht mindestens ein Produkt.');
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
        if (kfQ('SELECT 1 FROM users WHERE name = ?', [$name])->fetchColumn()) kfFail('Diesen Namen gibt es schon.');
        if ((int)kfQ('SELECT COUNT(*) FROM users')->fetchColumn() >= KF_MAX_USERS) kfFail('Mehr als ' . KF_MAX_USERS . ' Konten gehen nicht.');
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
        if ($id === $me['id']) kfFail('Das eigene Konto kann man nicht löschen.');
        kfDb()->beginTransaction();
        // Listen des gelöschten Kontos gehen an den Administrator, damit nichts verloren geht
        foreach (kfQ('SELECT id FROM lists WHERE owner_id = ?', [$id])->fetchAll() as $r) {
            kfQ('UPDATE lists SET owner_id = ? WHERE id = ?', [$me['id'], $r['id']]);
            kfQ('INSERT OR IGNORE INTO members (list_id, user_id) VALUES (?, ?)', [$r['id'], $me['id']]);
        }
        kfQ('DELETE FROM members WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM sessions WHERE user_id = ?', [$id]);
        kfQ('DELETE FROM users WHERE id = ?', [$id]);
        kfBump('lv');
        kfDb()->commit();
        $state();

    case 'me_pass':
        $row = kfQ('SELECT pass FROM users WHERE id = ?', [$me['id']])->fetch();
        if (!$row || !password_verify((string)($in['old'] ?? ''), $row['pass'])) kfFail('Das bisherige Passwort stimmt nicht.');
        $pass = (string)($in['pass'] ?? '');
        if (($e = kfCheckPass($pass)) !== '') kfFail($e);
        kfQ('UPDATE users SET pass = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $me['id']]);
        kfQ('DELETE FROM sessions WHERE user_id = ? AND hash <> ?', [$me['id'], $me['hash']]);   // andere Geräte abmelden
        kfJson(['ok' => true]);

    case 'me_look':   // Aussehen des eigenen Kontos, gilt auf allen Geräten
        $l = is_array($in['look'] ?? null) ? $in['look'] : [];
        $pal = function ($v) { return is_string($v) && preg_match('/^[a-z]{1,20}$/', $v) ? $v : ''; };
        $cols = function ($v) {
            if (!is_array($v)) return null;
            $out = [];
            foreach (['bg', 'card', 'text', 'acc'] as $k) {
                $c = $v[$k] ?? '';
                if (!is_string($c) || !preg_match('/^#[0-9a-f]{6}$/', $c)) return null;
                $out[$k] = $c;
            }
            return $out;
        };
        $look = ['mode' => in_array($l['mode'] ?? '', ['light', 'dark'], true) ? $l['mode'] : 'auto',
                 'l' => $pal($l['l'] ?? ''), 'd' => $pal($l['d'] ?? ''), 'cl' => $cols($l['cl'] ?? null), 'cd' => $cols($l['cd'] ?? null)];
        kfQ('UPDATE users SET look = ? WHERE id = ?', [json_encode($look), $me['id']]);
        kfBump('lv');   // damit die anderen Geräte des Kontos es beim nächsten Abgleich mitbekommen
        kfJson(['ok' => true]);

    case 'settings_save':
        $admin();
        kfSet('interval', (string)max(1, min(60, $int('interval'))));
        kfBump('lv');
        $state();

    case 'logout':
        kfLogout($me);
        kfJson(['ok' => true]);

    default:
        kfFail('Unbekannte Aktion.', 404);
    }
} catch (Throwable $e) {
    if (kfDb()->inTransaction()) kfDb()->rollBack();
    error_log('Kaufen: ' . $e->getMessage());
    kfFail('Das hat nicht geklappt. Bitte noch einmal versuchen.', 500);
}
