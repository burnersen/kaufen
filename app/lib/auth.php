<?php
/* Kaufen – Konten, Anmeldung, Sitzungen, Bremse gegen Durchprobieren, Security-Header */
defined('KF_VERSION') || exit;

function kfIsHttps(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || (int)($_SERVER['SERVER_PORT'] ?? 0) === 443;
}

function kfHeaders(bool $html = false): void {
    if (headers_sent()) return;
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    if (kfIsHttps()) header('Strict-Transport-Security: max-age=31536000');
    if ($html) {
        header("Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; "
            . "connect-src 'self'; manifest-src 'self'; worker-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    } else {
        header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
    }
}

function h(string $s): string {
    return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

function kfHasUsers(): bool {
    return (int)kfDb()->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0;
}

/** Prüft Name und Passwort eines neuen Kontos, liefert Fehlertext oder '' */
function kfCheckName(string $name): string {
    $len = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
    if ($len < 2 || $len > 30) return kfT('Der Name muss 2 bis 30 Zeichen lang sein.');
    if (preg_match('/[\x00-\x1f<>]/', $name)) return kfT('Der Name enthält unzulässige Zeichen.');
    return '';
}

function kfCheckPass(string $pass): string {
    if (strlen($pass) < 8) return kfT('Das Passwort muss mindestens 8 Zeichen lang sein.');
    if (strlen($pass) > 200) return kfT('Das Passwort ist zu lang.');
    return '';
}

/* ---------- Sitzungen: zufälliges Kennzeichen im Cookie, in der Datenbank steht nur dessen Prüfsumme ---------- */

function kfCookie(string $value, int $expires): void {
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
    setcookie(KF_COOKIE, $value, ['expires' => $expires, 'path' => $path, 'secure' => kfIsHttps(), 'httponly' => true, 'samesite' => 'Lax']);
}

function kfStartSession(int $userId): void {
    $token = bin2hex(random_bytes(32));
    $exp = time() + KF_SESSION_DAYS * 86400;
    kfQ('INSERT INTO sessions (hash, user_id, csrf, expires, touched) VALUES (?, ?, ?, ?, ?)',
        [hash('sha256', $token), $userId, bin2hex(random_bytes(24)), $exp, time()]);
    kfCookie($token, $exp);
    if (random_int(1, 20) === 1) kfQ('DELETE FROM sessions WHERE expires < ?', [time()]);
}

/** Der angemeldete Benutzer oder null. Enthält id, name, is_admin, csrf, hash. */
function kfCurrentUser(): ?array {
    static $done = false, $user = null;
    if ($done) return $user;
    $done = true;
    $token = $_COOKIE[KF_COOKIE] ?? '';
    if (!is_string($token) || !preg_match('/^[0-9a-f]{64}$/', $token)) return null;
    $hash = hash('sha256', $token);
    $row = kfQ('SELECT s.hash, s.csrf, s.expires, s.touched, u.id, u.name, u.is_admin FROM sessions s JOIN users u ON u.id = s.user_id
                WHERE s.hash = ? AND s.expires > ?', [$hash, time()])->fetch();
    if (!$row) return null;
    // Höchstens einmal am Tag verlängern, damit die Abfrage alle paar Sekunden nichts schreibt
    if (time() - (int)$row['touched'] > 86400) {
        $exp = time() + KF_SESSION_DAYS * 86400;
        kfQ('UPDATE sessions SET expires = ?, touched = ? WHERE hash = ?', [$exp, time(), $hash]);
        kfCookie($token, $exp);
    }
    $user = ['id' => (int)$row['id'], 'name' => $row['name'], 'is_admin' => (int)$row['is_admin'] === 1, 'csrf' => $row['csrf'], 'hash' => $hash];
    return $user;
}

function kfLogout(array $me): void {
    kfQ('DELETE FROM sessions WHERE hash = ?', [$me['hash']]);
    kfCookie('', time() - 3600);
}

/* ---------- Bremse: nach 5 Fehlversuchen wächst die Wartezeit, gemerkt wird nur eine Prüfsumme ---------- */

function kfThrottleKeys(string $name): array {
    $ip = (string)($_SERVER['REMOTE_ADDR'] ?? '');
    $lower = function_exists('mb_strtolower') ? mb_strtolower($name) : strtolower($name);
    return [hash('sha256', 'ip|' . $ip), hash('sha256', 'name|' . $lower . '|' . $ip)];
}

/** Sekunden, die noch gewartet werden muss (0 = frei) */
function kfThrottleWait(string $name): int {
    $wait = 0;
    foreach (kfThrottleKeys($name) as $i => $k) {
        $row = kfQ('SELECT fails, last FROM throttle WHERE k = ?', [$k])->fetch();
        if (!$row) continue;
        $limit = $i === 0 ? 20 : 5;   // pro Adresse großzügiger als pro Name
        $over = (int)$row['fails'] - $limit;
        if ($over < 0) continue;
        $lock = min(3600, 30 * (2 ** min($over, 7)));
        $wait = max($wait, (int)$row['last'] + $lock - time());
    }
    return max(0, $wait);
}

function kfThrottleFail(string $name): void {
    foreach (kfThrottleKeys($name) as $k) {
        kfQ('INSERT INTO throttle (k, fails, last) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET fails = fails + 1, last = excluded.last', [$k, time()]);
    }
    kfQ('DELETE FROM throttle WHERE last < ?', [time() - 86400]);
}

function kfThrottleClear(string $name): void {
    kfQ('DELETE FROM throttle WHERE k = ?', [kfThrottleKeys($name)[1]]);
}

/* ---------- Einrichtung und Anmeldung ---------- */

/** Erstes Konto = Administrator, dazu die erste gemeinsame Liste. Liefert Fehlertext oder ''. */
function kfSetup(string $name, string $pass, string $pass2): string {
    $name = trim($name);
    if (($e = kfCheckName($name)) !== '') return $e;
    if (($e = kfCheckPass($pass)) !== '') return $e;
    if ($pass !== $pass2) return kfT('Die beiden Passwörter stimmen nicht überein.');
    $db = kfDb();
    $db->beginTransaction();
    if ((int)$db->query('SELECT COUNT(*) FROM users')->fetchColumn() > 0) { $db->rollBack(); return kfT('Kaufen ist schon eingerichtet.'); }
    kfQ('INSERT INTO users (name, pass, is_admin, created_at) VALUES (?, ?, 1, ?)', [$name, password_hash($pass, PASSWORD_DEFAULT), time()]);
    $uid = (int)$db->lastInsertId();
    kfQ('INSERT INTO lists (name, owner_id, created_at) VALUES (?, ?, ?)', [kfT('Einkauf'), $uid, time()]);
    $lid = (int)$db->lastInsertId();
    kfQ('INSERT INTO members (list_id, user_id) VALUES (?, ?)', [$lid, $uid]);
    kfSet('start_list', (string)$lid);
    $db->commit();
    kfStartSession($uid);
    return '';
}

function kfLogin(string $name, string $pass): string {
    $name = trim($name);
    if ($name === '' || $pass === '') return kfT('Bitte Name und Passwort eingeben.');
    $wait = kfThrottleWait($name);
    if ($wait > 0) return kfT('Zu viele Fehlversuche. Bitte in %s noch einmal versuchen.', $wait > 90 ? kfT('%d Minuten', (int)ceil($wait / 60)) : kfT('%d Sekunden', $wait));
    $row = kfQ('SELECT id, pass FROM users WHERE name = ?', [$name])->fetch();
    // Auch ohne Treffer rechnen, damit die Antwortzeit nichts verrät
    $ok = password_verify($pass, $row ? $row['pass'] : '$2y$10$abcdefghijklmnopqrstuuJ7i0kE5cH3f8QZ6y0K3d0a8mQ9oQe1e');
    if (!$row || !$ok) {
        kfThrottleFail($name);
        return kfT('Name oder Passwort stimmt nicht.');
    }
    kfThrottleClear($name);
    if (password_needs_rehash($row['pass'], PASSWORD_DEFAULT)) {
        kfQ('UPDATE users SET pass = ? WHERE id = ?', [password_hash($pass, PASSWORD_DEFAULT), $row['id']]);
    }
    kfStartSession((int)$row['id']);
    return '';
}
