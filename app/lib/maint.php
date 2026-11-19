<?php
/* Kaufen – Wartung für den Administrator: komplette Sicherung der Datenbank und Update per Knopfdruck aus dem GitHub-Release.
   Nach außen geht hier nur etwas, wenn der Administrator nach Updates sucht oder das tägliche Nachsehen eingeschaltet hat. */
defined('KF_VERSION') || exit;

/* ---------- Sicherung ---------- */

/** Schnappschuss der ganzen Datenbank in eine eigene Datei im Ordner data/. Liefert den Pfad, der Aufrufer räumt sie weg. */
function kfBackupFile(): string {
    $db = kfDb();
    $tmp = KF_DATA_DIR . '/tmp_' . bin2hex(random_bytes(8)) . '.sqlite';
    try {
        $db->exec('VACUUM INTO ' . $db->quote($tmp));   // SQLite ab 3.27: in sich stimmige Kopie, auch während jemand schreibt
    } catch (Throwable $e) {
        @unlink($tmp);
        // Ältere SQLite: erst alles aus dem Protokoll in die Datei, dann Schreiben kurz sperren und kopieren
        try { $db->query('PRAGMA wal_checkpoint(TRUNCATE)')->fetchAll(); } catch (Throwable $e2) {}
        $db->exec('BEGIN IMMEDIATE');
        $ok = @copy(KF_DATA_DIR . '/' . kfConfig()['db'], $tmp);
        $db->exec('COMMIT');
        if (!$ok) throw new RuntimeException(kfT('Die Sicherung konnte nicht angelegt werden.'));
    }
    @chmod($tmp, 0600);
    return $tmp;
}

/** data/config.php neu schreiben (erst unter anderem Namen, dann umbenennen, damit nie eine halbe Datei dasteht) */
function kfConfigWrite(array $cfg): void {
    $file = KF_DATA_DIR . '/config.php';
    $php = "<?php\n// Kaufen: automatisch angelegt. Nicht löschen, nicht weitergeben.\nreturn " . var_export($cfg, true) . ";\n";
    if (@file_put_contents($file . '.tmp', $php, LOCK_EX) === false || !@rename($file . '.tmp', $file)) {
        @unlink($file . '.tmp');
        throw new RuntimeException(kfT('In den Ordner data/ kann nicht geschrieben werden. Bitte die Schreibrechte prüfen.'));
    }
    @chmod($file, 0600);
    if (function_exists('opcache_invalidate')) @opcache_invalidate($file, true);
}

/**
 * Eine Sicherung einspielen. Die hochgeladene Datei wird geprüft und unter neuem Namen abgelegt, dann zeigt config.php auf sie.
 * Die bisherige Datenbank bleibt unangetastet liegen und lässt sich mit kfBackupUndo zurückholen (immer nur der letzte Stand).
 */
function kfBackupRestore(string $bin): void {
    if (strlen($bin) < 1024 || substr($bin, 0, 16) !== "SQLite format 3\0") throw new RuntimeException(kfT('Das ist keine Sicherung von Kaufen.'));
    $tmp = KF_DATA_DIR . '/tmp_' . bin2hex(random_bytes(8)) . '.sqlite';
    if (@file_put_contents($tmp, $bin) !== strlen($bin)) { @unlink($tmp); throw new RuntimeException(kfT('Die Sicherung konnte nicht gespeichert werden.')); }
    try {
        $t = new PDO('sqlite:' . $tmp);
        $t->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $tables = $t->query("SELECT name FROM sqlite_master WHERE type = 'table'")->fetchAll(PDO::FETCH_COLUMN);
        foreach (['settings', 'users', 'lists', 'members', 'items', 'usage', 'cats', 'products'] as $need) {
            if (!in_array($need, $tables, true)) throw new RuntimeException(kfT('Das ist keine Sicherung von Kaufen.'));
        }
        if ((int)$t->query('PRAGMA user_version')->fetchColumn() > KF_SCHEMA) throw new RuntimeException(kfT('Die Sicherung stammt aus einer neueren Version von Kaufen. Bitte erst aktualisieren.'));
        if ((string)$t->query('PRAGMA quick_check')->fetchColumn() !== 'ok') throw new RuntimeException(kfT('Die Sicherung ist beschädigt.'));
        if ((int)$t->query('SELECT COUNT(*) FROM users WHERE is_admin = 1')->fetchColumn() < 1) throw new RuntimeException(kfT('In der Sicherung gibt es keinen Administrator.'));
        $t = null;
    } catch (RuntimeException $e) {
        @unlink($tmp);
        throw $e;
    } catch (Throwable $e) {
        @unlink($tmp);
        throw new RuntimeException(kfT('Das ist keine Sicherung von Kaufen.'));
    }
    $cfg = kfConfig();
    $name = 'kf_' . bin2hex(random_bytes(12)) . '.sqlite';
    if (!@rename($tmp, KF_DATA_DIR . '/' . $name)) { @unlink($tmp); throw new RuntimeException(kfT('Die Sicherung konnte nicht gespeichert werden.')); }
    @chmod(KF_DATA_DIR . '/' . $name, 0600);
    // Der vorletzte Stand fliegt weg, der bisherige wird zum Zurückholen gemerkt
    if (!empty($cfg['prev_db']) && preg_match('/^kf_[0-9a-f]{24}\.sqlite$/', $cfg['prev_db'])) {
        foreach (['', '-wal', '-shm'] as $x) @unlink(KF_DATA_DIR . '/' . $cfg['prev_db'] . $x);
    }
    $cfg['prev_db'] = $cfg['db'];
    $cfg['prev_at'] = time();
    $cfg['db'] = $name;
    kfConfigWrite($cfg);
}

/** Vor dem letzten Einspielen zurück: die beiden Datenbanken tauschen die Plätze */
function kfBackupUndo(): void {
    $cfg = kfConfig();
    if (empty($cfg['prev_db']) || !is_file(KF_DATA_DIR . '/' . $cfg['prev_db'])) throw new RuntimeException(kfT('Es gibt keinen vorigen Stand.'));
    [$cfg['db'], $cfg['prev_db']] = [$cfg['prev_db'], $cfg['db']];
    $cfg['prev_at'] = time();
    kfConfigWrite($cfg);
}

/** Zeitpunkt, zu dem der Stand zum Zurückholen weggelegt wurde, 0 = keiner da */
function kfBackupPrevAt(): int {
    $cfg = kfConfig();
    return !empty($cfg['prev_db']) && is_file(KF_DATA_DIR . '/' . $cfg['prev_db']) ? (int)($cfg['prev_at'] ?? 0) : 0;
}

/* ---------- Update ---------- */

/** Woher die Updates kommen. In data/config.php lässt sich mit 'update_url' eine andere Adresse eintragen, '' schaltet sie ab. */
function kfUpdUrl(): string {
    $cfg = kfConfig();
    return array_key_exists('update_url', $cfg) ? (string)$cfg['update_url'] : 'https://api.github.com/repos/burnersen/kaufen/releases/latest';
}

/** Datei aus dem Netz holen (folgt Weiterleitungen, höchstens $max Bytes). Wirft bei jedem Fehler. */
function kfHttpGet(string $url, int $max): string {
    if (!preg_match('~^https?://~i', $url)) throw new RuntimeException(kfT('Ungültige Adresse für Updates.'));
    $ua = 'Kaufen/' . KF_VERSION . ' (self-hosted)';
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $buf = '';
        curl_setopt_array($ch, [CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => $ua, CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json, application/octet-stream;q=0.9, */*;q=0.5'],
            CURLOPT_WRITEFUNCTION => function ($ch, $chunk) use (&$buf, $max) { $buf .= $chunk; return strlen($buf) > $max ? 0 : strlen($chunk); }]);
        $ok = curl_exec($ch);
        $code = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if (strlen($buf) > $max) throw new RuntimeException(kfT('Die Datei ist zu groß.'));
        if ($ok === false || $code !== 200) throw new RuntimeException(kfT('Der Update-Server antwortet nicht (%s).', $code ?: $err));
        return $buf;
    }
    if (!filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) throw new RuntimeException(kfT('Dieser Server kann keine Dateien aus dem Netz laden (curl oder allow_url_fopen fehlt).'));
    $ctx = stream_context_create(['http' => ['method' => 'GET', 'header' => "User-Agent: $ua\r\nAccept: application/vnd.github+json, */*;q=0.5", 'timeout' => 60,
        'follow_location' => 1, 'max_redirects' => 5, 'ignore_errors' => true]]);
    $buf = @file_get_contents($url, false, $ctx, 0, $max + 1);
    $code = isset($http_response_header) && preg_match_all('~^HTTP/\S+\s+(\d+)~m', implode("\n", $http_response_header), $m) ? (int)end($m[1]) : 0;
    if ($buf === false || $code !== 200) throw new RuntimeException(kfT('Der Update-Server antwortet nicht (%s).', $code));
    if (strlen($buf) > $max) throw new RuntimeException(kfT('Die Datei ist zu groß.'));
    return $buf;
}

/** Beim Release nachsehen: neueste Version, Hinweise, Adresse und Prüfsumme des Installers. Wird gemerkt (upd_info, upd_at). */
function kfUpdCheck(): array {
    $url = kfUpdUrl();
    if ($url === '') throw new RuntimeException(kfT('Updates sind auf diesem Server abgeschaltet.'));
    kfSet('upd_at', (string)time());
    $j = json_decode(kfHttpGet($url, 1 << 20), true);
    if (!is_array($j) || empty($j['tag_name'])) throw new RuntimeException(kfT('Die Antwort des Update-Servers ist unbrauchbar.'));
    $info = ['v' => preg_replace('~^(?:kaufen-|v)~i', '', (string)$j['tag_name']), 'page' => (string)($j['html_url'] ?? ''),
             'notes' => function_exists('mb_substr') ? mb_substr((string)($j['body'] ?? ''), 0, 3000) : substr((string)($j['body'] ?? ''), 0, 3000), 'url' => '', 'sha' => ''];
    foreach ((array)($j['assets'] ?? []) as $a) {
        if (is_array($a) && ($a['name'] ?? '') === 'kaufen-install.php') {
            $info['url'] = (string)($a['browser_download_url'] ?? '');
            if (preg_match('~^sha256:([0-9a-f]{64})$~', (string)($a['digest'] ?? ''), $m)) $info['sha'] = $m[1];
        }
    }
    if (!preg_match('~^[0-9][0-9A-Za-z.\-]*$~', $info['v'])) throw new RuntimeException(kfT('Die Antwort des Update-Servers ist unbrauchbar.'));
    kfSet('upd_info', json_encode($info, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    return $info;
}

/** Zuletzt gesehene Release-Angaben, null = noch nie nachgesehen */
function kfUpdInfo(): ?array {
    $i = json_decode(kfGet('upd_info'), true);
    return is_array($i) && isset($i['v']) ? $i : null;
}
function kfUpdNewer(?array $i): bool { return $i !== null && version_compare($i['v'], KF_VERSION, '>'); }

/** Dateien im Format des Installers: hinter „__halt_compiler();“ pro Zeile Pfad, SHA-256 und Inhalt (Base64). null = unbrauchbar. */
function kfPayloadParse(string $raw): ?array {
    $pos = strpos($raw, '__halt_compiler();');
    $raw = $pos === false ? $raw : substr($raw, $pos + 18);
    $files = [];
    foreach (explode("\n", $raw) as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') continue;
        $p = explode("\t", $line);
        if (count($p) !== 3) return null;
        if (!preg_match('~^(?:index\.php|LICENSE|app(?:/[A-Za-z0-9._\-]+)+)$~', $p[0]) || strpos($p[0], '..') !== false) return null;
        $bin = base64_decode($p[2], true);
        if ($bin === false || !hash_equals($p[1], hash('sha256', $bin))) return null;
        $files[$p[0]] = $bin;
    }
    return isset($files['index.php'], $files['app/routes/api.php']) ? $files : null;
}

/** Die laufende Version in einer Datei festhalten (gleiches Format), damit man zu ihr zurückkann */
function kfPayloadSave(string $file): void {
    $list = ['index.php', 'LICENSE'];
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(KF_APP, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) if ($f->isFile()) $list[] = 'app/' . str_replace('\\', '/', substr($f->getPathname(), strlen(KF_APP) + 1));
    $out = '#Kaufen ' . KF_VERSION . "\n";
    foreach ($list as $path) {
        if (!is_file(KF_ROOT . '/' . $path) || !preg_match('~^(?:index\.php|LICENSE|app(?:/[A-Za-z0-9._\-]+)+)$~', $path)) continue;
        $bin = (string)file_get_contents(KF_ROOT . '/' . $path);
        $out .= $path . "\t" . hash('sha256', $bin) . "\t" . base64_encode($bin) . "\n";
    }
    if (@file_put_contents($file, $out, LOCK_EX) !== strlen($out)) throw new RuntimeException(kfT('Die laufende Version konnte nicht gesichert werden. Bitte die Schreibrechte von data/ prüfen.'));
    @chmod($file, 0600);
}

/** Dateien einspielen wie der Installer: alles erst unter Zwischennamen schreiben, dann umbenennen, Überbleibsel in app/ wegräumen */
function kfPayloadInstall(array $files): void {
    $tmp = [];
    $fail = '';
    foreach ($files as $path => $bin) {
        $target = KF_ROOT . '/' . $path;
        $parent = dirname($target);
        if (!is_dir($parent) && !@mkdir($parent, 0755, true) && !is_dir($parent)) { $fail = $path; break; }
        $t = $target . '.tmp';
        if (@file_put_contents($t, $bin) !== strlen($bin)) { @unlink($t); $fail = $path; break; }
        $tmp[$t] = $target;
    }
    if ($fail === '') {
        foreach ($tmp as $t => $target) {
            if (!@rename($t, $target)) { $fail = substr($target, strlen(KF_ROOT) + 1); break; }
            @chmod($target, 0644);
            if (function_exists('opcache_invalidate')) @opcache_invalidate($target, true);
        }
    }
    foreach ($tmp as $t => $target) if (is_file($t)) @unlink($t);
    if ($fail !== '') throw new RuntimeException(kfT('Die Datei %s ließ sich nicht schreiben. PHP braucht Schreibrechte im Ordner von Kaufen.', $fail));
    foreach (['lib', 'routes', 'views', 'assets'] as $sub) {
        foreach ((array)@glob(KF_APP . '/' . $sub . '/*') as $old) {
            if (is_file($old) && !isset($files['app/' . $sub . '/' . basename($old)])) @unlink($old);
        }
    }
}

/** Darf PHP die Programmdateien überschreiben? '' = ja, sonst der erste Pfad, bei dem es nicht geht */
function kfUpdWritable(): string {
    foreach (['index.php', 'app', 'app/lib', 'app/routes', 'app/views', 'app/assets', 'app/lib/maint.php', 'app/assets/app.js'] as $p) {
        if (file_exists(KF_ROOT . '/' . $p) && !is_writable(KF_ROOT . '/' . $p)) return $p;
    }
    return '';
}

/** Neueste Version holen, prüfen und einspielen. Die laufende Version wird vorher in data/update-prev.txt gelegt. */
function kfUpdInstall(): string {
    $info = kfUpdCheck();
    if (!kfUpdNewer($info)) throw new RuntimeException(kfT('Du hast schon die neueste Version.'));
    if ($info['url'] === '' || $info['sha'] === '') throw new RuntimeException(kfT('Zu dieser Version gibt es keinen prüfbaren Installer. Bitte von Hand aktualisieren.'));
    if (($w = kfUpdWritable()) !== '') throw new RuntimeException(kfT('Die Datei %s ließ sich nicht schreiben. PHP braucht Schreibrechte im Ordner von Kaufen.', $w));
    @set_time_limit(120);
    $bin = kfHttpGet($info['url'], 16 << 20);
    if (!hash_equals($info['sha'], hash('sha256', $bin))) throw new RuntimeException(kfT('Die Prüfsumme der heruntergeladenen Datei stimmt nicht. Es wurde nichts verändert.'));
    $files = kfPayloadParse($bin);
    if (!$files || !preg_match("~define\\('KF_VERSION',\\s*'" . preg_quote($info['v'], '~') . "'\\)~", $files['index.php'])) {
        throw new RuntimeException(kfT('Die heruntergeladene Datei ist unbrauchbar. Es wurde nichts verändert.'));
    }
    kfPayloadSave(KF_DATA_DIR . '/update-prev.txt');
    kfPayloadInstall($files);
    return $info['v'];
}

/** Demo-Modus: höchstens einmal pro Stunde nachsehen und eine neue Version gleich einspielen, ohne Nachfrage.
    Läuft nach der ausgelieferten Seite, damit niemand darauf wartet. Eine Sperrdatei sorgt dafür, dass es nur einmal gleichzeitig passiert. */
function kfDemoUpdate(): void {
    if (time() - (int)kfGet('upd_at', '0') < 3600 || kfUpdUrl() === '') return;
    $lock = @fopen(KF_DATA_DIR . '/update.lock', 'c');
    if (!$lock) return;
    if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); return; }
    try {
        ignore_user_abort(true);
        if (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
        else { while (ob_get_level() > 0) @ob_end_flush(); @flush(); }
        if (time() - (int)kfGet('upd_at', '0') < 3600) return;   // ein anderer Aufruf war schneller
        @set_time_limit(150);
        if (kfUpdNewer(kfUpdCheck())) kfUpdInstall();
    } catch (Throwable $e) {
        error_log('Kaufen Demo-Update: ' . $e->getMessage());
    } finally {
        flock($lock, LOCK_UN);
        fclose($lock);
    }
}

/** Demo-Modus einschalten: in data/config.php vermerken und alle abmelden. Konten und Listen bleiben in der Datenbank liegen,
    sind über die App aber nicht mehr zu erreichen. */
function kfDemoOn(): void {
    kfConfigWrite(['demo' => true] + kfConfig());
    kfQ('DELETE FROM sessions');
}

/** Version, zu der man zurückkann ('' = keine) */
function kfUpdPrev(): string {
    $f = KF_DATA_DIR . '/update-prev.txt';
    if (!is_file($f)) return '';
    $fp = @fopen($f, 'rb');
    $head = $fp ? (string)fgets($fp, 100) : '';
    if ($fp) fclose($fp);
    return preg_match('~^#Kaufen ([0-9][0-9A-Za-z.\-]*)~', $head, $m) ? $m[1] : '';
}

/** Zurück zur Version vor dem letzten Update */
function kfUpdRollback(): string {
    $v = kfUpdPrev();
    $files = $v !== '' ? kfPayloadParse((string)file_get_contents(KF_DATA_DIR . '/update-prev.txt')) : null;
    if (!$files) throw new RuntimeException(kfT('Es gibt keine vorige Version.'));
    if (($w = kfUpdWritable()) !== '') throw new RuntimeException(kfT('Die Datei %s ließ sich nicht schreiben. PHP braucht Schreibrechte im Ordner von Kaufen.', $w));
    kfPayloadInstall($files);
    @unlink(KF_DATA_DIR . '/update-prev.txt');
    return $v;
}
