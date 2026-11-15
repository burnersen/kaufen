<?php
/*
 * Kaufen – Mitteilungen aufs Handy (Web Push), ohne fremde Bibliothek.
 *
 * Ablauf: Wer etwas auf eine Liste setzt, landet mit dem Produktnamen in push_pending. Verschickt wird gebündelt,
 * sobald das Gerät Kaufen verlässt (Aktion push_done) oder, falls das nie ankommt, wenn seit der letzten Änderung
 * KF_PUSH_WAIT Sekunden vergangen sind und irgendein Gerät den Server das nächste Mal fragt. Einen eigenen
 * Zeitgeber hat einfacher Webspace nicht.
 *
 * Der Server schickt direkt an den Mitteilungsdienst des Browsers (Apple, Google, Mozilla, Microsoft). Der Inhalt
 * ist für das Gerät verschlüsselt (RFC 8291, aes128gcm), der Server weist sich mit einem eigenen Schlüsselpaar aus
 * (VAPID, RFC 8292). Beides entsteht beim ersten Gebrauch und liegt in der Datenbank.
 */
defined('KF_VERSION') || exit;

define('KF_PUSH_WAIT', 180);   // so lange nach der letzten Änderung wird gewartet, wenn das Gerät sich nicht abmeldet

/** Kann dieser Server Mitteilungen verschicken? */
function kfPushOk(): bool {
    static $ok = null;
    if ($ok !== null) return $ok;
    return $ok = extension_loaded('openssl') && function_exists('openssl_pkey_derive') && function_exists('hash_hkdf')
        && in_array('aes-128-gcm', openssl_get_cipher_methods(), true)
        && (function_exists('curl_init') || filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN));
}

function kfB64u(string $bin): string {
    return rtrim(strtr(base64_encode($bin), '+/', '-_'), '=');
}

function kfB64uDec($s): string {
    if (!is_string($s) || !preg_match('/^[A-Za-z0-9_\-+\/]*=*$/', $s)) return '';
    $bin = base64_decode(strtr(rtrim($s, '='), '-_', '+/'), true);
    return $bin === false ? '' : $bin;
}

/** Öffentlicher Punkt eines EC-Schlüssels als 65 Bytes (0x04, x, y) */
function kfPushPoint($key): string {
    $d = openssl_pkey_get_details($key);
    if (!$d || empty($d['ec']['x']) || empty($d['ec']['y'])) throw new RuntimeException('EC-Schlüssel ohne Punkt');
    return "\x04" . str_pad($d['ec']['x'], 32, "\0", STR_PAD_LEFT) . str_pad($d['ec']['y'], 32, "\0", STR_PAD_LEFT);
}

function kfPushNewKey() {
    $key = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$key) throw new RuntimeException('EC-Schlüssel ließ sich nicht erzeugen');
    return $key;
}

/** Das Schlüsselpaar des Servers: pub = öffentlicher Punkt (Base64URL, bekommt der Browser), pem = privater Schlüssel */
function kfPushKeys(): array {
    static $keys = null;
    if ($keys !== null) return $keys;
    $pub = kfGet('push_pub');
    $pem = kfGet('push_pem');
    if ($pub === '' || $pem === '') {
        $key = kfPushNewKey();
        if (!openssl_pkey_export($key, $pem)) throw new RuntimeException('Schlüssel ließ sich nicht speichern');
        $pub = kfB64u(kfPushPoint($key));
        // Nur anlegen, wenn noch keiner da ist: zwei gleichzeitige erste Aufrufe dürfen sich nicht überschreiben
        kfQ('INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)', ['push_pem', $pem]);
        $pem = kfGet('push_pem');
        $pub = kfB64u(kfPushPoint(openssl_pkey_get_private($pem)));
        kfSet('push_pub', $pub);
    }
    return $keys = ['pub' => $pub, 'pem' => $pem];
}

/** Der öffentliche Schlüssel für den Browser, oder '' wenn dieser Server keine Mitteilungen verschicken kann */
function kfPushPublic(): string {
    if (!kfPushOk()) return '';
    try { return kfPushKeys()['pub']; } catch (Throwable $e) { error_log('Kaufen Push: ' . $e->getMessage()); return ''; }
}

/**
 * Nur an die Mitteilungsdienste der Browser schicken, nie an beliebige Adressen: die Adresse kommt vom Gerät,
 * und der Server soll sich nicht als Sprungbrett ins eigene Netz missbrauchen lassen.
 */
function kfPushHostOk(string $endpoint): bool {
    $cfg = kfConfig();
    if (!empty($cfg['push_test']) && strncmp($endpoint, (string)$cfg['push_test'], strlen((string)$cfg['push_test'])) === 0) return true;   // nur für Tests, steht in data/config.php
    $p = parse_url($endpoint);
    if (!$p || ($p['scheme'] ?? '') !== 'https' || empty($p['host']) || isset($p['user']) || isset($p['port'])) return false;
    $host = strtolower($p['host']);
    foreach (['fcm.googleapis.com', 'android.googleapis.com', 'web.push.apple.com', 'push.apple.com', 'push.services.mozilla.com', 'notify.windows.com'] as $ok) {
        if ($host === $ok || substr($host, -strlen($ok) - 1) === '.' . $ok) return true;
    }
    return false;
}

/** Die Unterschrift von openssl (DER) in die Form bringen, die ein JWT braucht: r und s, je 32 Bytes */
function kfPushRawSig(string $der): string {
    $pos = 2;
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        $len = ord($der[$pos + 1]);
        $out .= str_pad(ltrim(substr($der, $pos + 2, $len), "\0"), 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $len;
    }
    return $out;
}

/**
 * Baut die Anfrage an den Mitteilungsdienst: Kopfzeilen und verschlüsselten Inhalt.
 * $sub: endpoint, p256dh und auth (beide binär). $contact: Adresse dieser Installation, die der Dienst im Problemfall sieht.
 */
function kfPushBuild(array $sub, string $payload, string $contact): array {
    $keys = kfPushKeys();
    $ua = $sub['p256dh'];
    if (strlen($ua) !== 65 || $ua[0] !== "\x04" || strlen($sub['auth']) < 8) throw new RuntimeException('Ungültige Schlüssel des Geräts');

    // Inhalt verschlüsseln (RFC 8291): einmaliges Schlüsselpaar, daraus mit dem Schlüssel des Geräts das gemeinsame Geheimnis
    $local = kfPushNewKey();
    $as = kfPushPoint($local);
    $peer = openssl_pkey_get_public("-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode(hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $ua), 64, "\n") . "-----END PUBLIC KEY-----\n");
    if (!$peer) throw new RuntimeException('Schlüssel des Geräts nicht lesbar');
    $secret = openssl_pkey_derive($peer, $local, 32);
    if ($secret === false) throw new RuntimeException('Gemeinsames Geheimnis ließ sich nicht bilden');
    $secret = str_pad($secret, 32, "\0", STR_PAD_LEFT);
    $ikm = hash_hkdf('sha256', $secret, 32, "WebPush: info\0" . $ua . $as, $sub['auth']);
    $salt = random_bytes(16);
    $cek = hash_hkdf('sha256', $ikm, 16, "Content-Encoding: aes128gcm\0", $salt);
    $nonce = hash_hkdf('sha256', $ikm, 12, "Content-Encoding: nonce\0", $salt);
    $tag = '';
    $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($cipher === false) throw new RuntimeException('Verschlüsseln hat nicht geklappt');
    $body = $salt . pack('N', 4096) . chr(65) . $as . $cipher . $tag;

    // Ausweis des Servers (VAPID): kurzlebiges, unterschriebenes Token für genau diesen Dienst
    $p = parse_url($sub['endpoint']);
    $aud = $p['scheme'] . '://' . $p['host'] . (isset($p['port']) ? ':' . $p['port'] : '');
    $jwt = kfB64u('{"typ":"JWT","alg":"ES256"}') . '.' . kfB64u(json_encode(['aud' => $aud, 'exp' => time() + 12 * 3600, 'sub' => $contact], JSON_UNESCAPED_SLASHES));
    if (!openssl_sign($jwt, $der, openssl_pkey_get_private($keys['pem']), OPENSSL_ALGO_SHA256)) throw new RuntimeException('Unterschreiben hat nicht geklappt');
    $jwt .= '.' . kfB64u(kfPushRawSig($der));

    return ['headers' => [
        'Authorization: vapid t=' . $jwt . ', k=' . $keys['pub'],
        'Content-Type: application/octet-stream',
        'Content-Encoding: aes128gcm',
        'TTL: 86400',
        'Urgency: normal',
    ], 'body' => $body];
}

/** Schickt ab und liefert den Statuscode des Dienstes (201 = angenommen, 404/410 = Gerät gibt es nicht mehr, 0 = nicht erreichbar) */
function kfPushPost(string $url, array $headers, string $body): int {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body, CURLOPT_HTTPHEADER => $headers, CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 6, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_FOLLOWLOCATION => false]);
        if (defined('CURLOPT_PROTOCOLS')) curl_setopt($ch, CURLOPT_PROTOCOLS, CURLPROTO_HTTP | CURLPROTO_HTTPS);
        curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code;
    }
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => implode("\r\n", $headers), 'content' => $body, 'timeout' => 6, 'ignore_errors' => true, 'follow_location' => 0]]);
    $res = @file_get_contents($url, false, $ctx);
    $line = isset($http_response_header[0]) ? $http_response_header[0] : '';
    return $res !== false && preg_match('~^HTTP/\S+\s+(\d{3})~', $line, $m) ? (int)$m[1] : 0;
}

/** Eine Mitteilung an ein Gerät. Räumt Geräte weg, die es nicht mehr gibt. Liefert den Statuscode. */
function kfPushSend(array $row, array $data): int {
    try {
        $req = kfPushBuild(['endpoint' => $row['endpoint'], 'p256dh' => kfB64uDec($row['p256dh']), 'auth' => kfB64uDec($row['auth'])],
            json_encode($data + ['lang' => $row['lang']], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), kfGet('push_contact', 'https://localhost'));
        $code = kfPushPost($row['endpoint'], $req['headers'], $req['body']);
    } catch (Throwable $e) {
        error_log('Kaufen Push: ' . $e->getMessage());
        return 0;
    }
    if ($code === 404 || $code === 410) kfQ('DELETE FROM push_subs WHERE id = ?', [$row['id']]);
    return $code;
}

/** Gibt es überhaupt ein Gerät, das Mitteilungen will? Sonst wird gar nichts vorgemerkt. */
function kfPushAny(): bool {
    static $any = null;
    if ($any === null) $any = (bool)kfQ('SELECT 1 FROM push_subs LIMIT 1')->fetchColumn();
    return $any;
}

/** Vormerken: dieses Konto hat das Produkt auf die Liste gesetzt */
function kfPushQueue(int $lid, int $uid, string $name): void {
    if (!kfPushAny()) return;
    kfQ('INSERT OR REPLACE INTO push_pending (list_id, user_id, name, at) VALUES (?, ?, ?, ?)', [$lid, $uid, $name, time()]);
}

/** Wieder von der Liste (abgehakt oder gelöscht), bevor die Mitteilung raus ist: dann muss es niemand mehr erfahren */
function kfPushUnqueue(int $lid, string $name): void {
    if (!kfPushAny()) return;
    kfQ('DELETE FROM push_pending WHERE list_id = ? AND name = ?', [$lid, $name]);
}

/**
 * Vorgemerktes verschicken, pro Liste und Absender eine Mitteilung an alle anderen Mitglieder.
 * $actor gesetzt: alles von diesem Konto, sofort (es hat Kaufen gerade verlassen). Sonst: alles, was lange genug liegt.
 */
function kfPushFlush(?int $actor = null): void {
    if (!kfPushOk()) return;
    $db = kfDb();
    if ($actor === null) {
        $min = kfQ('SELECT MIN(at) FROM push_pending')->fetchColumn();
        if ($min === null || $min === false || (int)$min >= time() - KF_PUSH_WAIT) return;   // der häufige Fall: nichts fällig
    }
    // Erst abholen und löschen, dann schicken. So verschickt bei zwei gleichzeitigen Aufrufen nur einer.
    $groups = [];
    try {
        $db->exec('BEGIN IMMEDIATE');
        if ($actor !== null) $keys = kfQ('SELECT DISTINCT list_id, user_id FROM push_pending WHERE user_id = ?', [$actor])->fetchAll();
        else $keys = kfQ('SELECT list_id, user_id FROM push_pending GROUP BY list_id, user_id HAVING MAX(at) < ?', [time() - KF_PUSH_WAIT])->fetchAll();
        foreach ($keys as $k) {
            $names = kfQ('SELECT name FROM push_pending WHERE list_id = ? AND user_id = ? ORDER BY at, rowid', [$k['list_id'], $k['user_id']])->fetchAll(PDO::FETCH_COLUMN);
            kfQ('DELETE FROM push_pending WHERE list_id = ? AND user_id = ?', [$k['list_id'], $k['user_id']]);
            if ($names) $groups[] = [(int)$k['list_id'], (int)$k['user_id'], $names];
        }
        $db->exec('COMMIT');
    } catch (Throwable $e) {
        try { $db->exec('ROLLBACK'); } catch (Throwable $e2) {}
        return;
    }
    foreach ($groups as [$lid, $uid, $names]) {
        $list = kfQ('SELECT name FROM lists WHERE id = ?', [$lid])->fetchColumn();
        $by = kfQ('SELECT name FROM users WHERE id = ?', [$uid])->fetchColumn();
        if ($list === false || $by === false) continue;
        $subs = kfQ('SELECT s.id, s.endpoint, s.p256dh, s.auth, s.lang FROM push_subs s JOIN members m ON m.user_id = s.user_id
                     WHERE m.list_id = ? AND s.user_id <> ?', [$lid, $uid])->fetchAll();
        $data = ['t' => 'add', 'id' => $lid, 'l' => $list, 'by' => $by, 'n' => array_slice($names, 0, 8), 'c' => count($names)];
        foreach ($subs as $row) kfPushSend($row, $data);
    }
}
