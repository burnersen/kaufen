<?php
/* Kaufen – Datenordner, Datenbank (SQLite), Einstellungen */
defined('KF_VERSION') || exit;

define('KF_SCHEMA', 3);

function kfFatal(string $msg): void {
    http_response_code(500);
    header('Content-Type: text/plain; charset=utf-8');
    exit($msg . "\n");
}

/**
 * Legt data/ an und sperrt den Ordner nach außen. In data/config.php steht der zufällige Name
 * der Datenbank-Datei. Eine .php-Datei kann man von außen nicht herunterladen, und ohne den Namen
 * findet niemand die Datenbank, falls die .htaccess einmal nicht greift.
 */
function kfConfig(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    $file = KF_DATA_DIR . '/config.php';
    if (is_file($file)) {
        $cfg = require $file;
        if (is_array($cfg) && !empty($cfg['db'])) return $cfg;
    }
    if (!is_dir(KF_DATA_DIR) && !@mkdir(KF_DATA_DIR, 0700, true) && !is_dir(KF_DATA_DIR)) {
        kfFatal(kfT('Der Ordner data/ konnte nicht angelegt werden. PHP braucht Schreibrechte im Verzeichnis von Kaufen.'));
    }
    if (!is_file(KF_DATA_DIR . '/.htaccess')) {
        @file_put_contents(KF_DATA_DIR . '/.htaccess', "# Kaufen: hier liegt alles Geheime, nichts davon darf von außen abrufbar sein.\n"
            . "<IfModule mod_authz_core.c>\nRequire all denied\n</IfModule>\n<IfModule !mod_authz_core.c>\nDeny from all\n</IfModule>\nOptions -Indexes\n");
    }
    if (!is_file(KF_DATA_DIR . '/index.html')) @file_put_contents(KF_DATA_DIR . '/index.html', '');
    $cfg = ['db' => 'kf_' . bin2hex(random_bytes(12)) . '.sqlite'];
    $php = "<?php\n// Kaufen: automatisch angelegt. Nicht löschen, nicht weitergeben.\nreturn " . var_export($cfg, true) . ";\n";
    if (@file_put_contents($file, $php, LOCK_EX) === false) {
        kfFatal(kfT('In den Ordner data/ kann nicht geschrieben werden. Bitte die Schreibrechte prüfen.'));
    }
    @chmod($file, 0600);
    if (function_exists('opcache_invalidate')) @opcache_invalidate($file, true);   // sonst liest PHP unter Umständen noch eine alte Fassung
    return $cfg;
}

function kfDb(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;
    if (!extension_loaded('pdo_sqlite')) kfFatal(kfT('Die PHP-Erweiterung pdo_sqlite fehlt. Ohne sie kann Kaufen nichts speichern.'));
    $cfg = kfConfig();
    try {
        $pdo = new PDO('sqlite:' . KF_DATA_DIR . '/' . $cfg['db']);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA busy_timeout = 5000');
        $pdo->exec('PRAGMA synchronous = NORMAL');
        $ver = (int)$pdo->query('PRAGMA user_version')->fetchColumn();
        if ($ver < KF_SCHEMA) {
            try { $pdo->query('PRAGMA journal_mode = WAL')->fetchAll(); } catch (Throwable $e) {}
            kfMigrate($pdo, $ver);
        }
    } catch (Throwable $e) {
        kfFatal(kfT('Die Datenbank konnte nicht geöffnet werden: ') . $e->getMessage());
    }
    return $pdo;
}

function kfMigrate(PDO $pdo, int $from): void {
    $pdo->beginTransaction();
    if ($from < 1) {
        $pdo->exec("CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            pass TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, csrf TEXT NOT NULL,
            expires INTEGER NOT NULL, touched INTEGER NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, fails INTEGER NOT NULL, last INTEGER NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS cats (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE COLLATE NOCASE, pos INTEGER NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY AUTOINCREMENT, cat_id INTEGER NOT NULL,
            name TEXT NOT NULL UNIQUE COLLATE NOCASE)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS products_cat ON products (cat_id)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS lists (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, owner_id INTEGER NOT NULL,
            version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS members (list_id INTEGER NOT NULL, user_id INTEGER NOT NULL, PRIMARY KEY (list_id, user_id))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS list_order (list_id INTEGER NOT NULL, cat_id INTEGER NOT NULL, pos INTEGER NOT NULL, PRIMARY KEY (list_id, cat_id))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS items (uid TEXT PRIMARY KEY, list_id INTEGER NOT NULL, name TEXT NOT NULL COLLATE NOCASE,
            cat_id INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', added_by INTEGER NOT NULL, added_at INTEGER NOT NULL)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS items_list ON items (list_id)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS usage (list_id INTEGER NOT NULL, name TEXT NOT NULL COLLATE NOCASE, cat_id INTEGER NOT NULL DEFAULT 0,
            cnt INTEGER NOT NULL DEFAULT 0, last_at INTEGER NOT NULL, PRIMARY KEY (list_id, name))");
        $pdo->exec("CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, created_by INTEGER NOT NULL DEFAULT 0)");
        $pdo->exec("CREATE TABLE IF NOT EXISTS template_items (template_id INTEGER NOT NULL, pos INTEGER NOT NULL, name TEXT NOT NULL,
            cat_id INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '')");
        $pdo->exec("CREATE TABLE IF NOT EXISTS catalog_backups (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, reason TEXT NOT NULL,
            cats INTEGER NOT NULL, products INTEGER NOT NULL, data TEXT NOT NULL)");
        $ins = $pdo->prepare("INSERT OR IGNORE INTO settings (k, v) VALUES (?, ?)");
        foreach (['interval' => '5', 'cv' => '1', 'lv' => '1'] as $k => $v) $ins->execute([$k, $v]);
    }
    if ($from < 2) {
        // Aussehen pro Konto: hell/dunkel, gewählte Designs und selbst eingestellte Farben, als JSON
        $pdo->exec("ALTER TABLE users ADD COLUMN look TEXT NOT NULL DEFAULT ''");
    }
    if ($from < 3) {
        // Zuletzt benutzte Menge pro Liste und Produkt, z. B. „5 Flaschen“. Steht beim nächsten Mal wieder da.
        $pdo->exec("ALTER TABLE usage ADD COLUMN note TEXT NOT NULL DEFAULT ''");
    }
    $pdo->exec('PRAGMA user_version = ' . KF_SCHEMA);
    $pdo->commit();
    if ($from < 1) {
        require_once KF_APP . '/lib/catalog.php';
        kfCatalogReplace(kfDefaultCatalog(), $pdo);
        kfSeedTemplates($pdo);
    }
}

function kfGet(string $k, string $default = ''): string {
    $st = kfDb()->prepare('SELECT v FROM settings WHERE k = ?');
    $st->execute([$k]);
    $v = $st->fetchColumn();
    return $v === false ? $default : (string)$v;
}

function kfSet(string $k, string $v): void {
    kfDb()->prepare('INSERT INTO settings (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v')->execute([$k, $v]);
}

/** Zähler hochsetzen: cv = Katalog geändert, lv = Listen/Mitglieder/Benutzer/Vorlagen geändert */
function kfBump(string $k, ?PDO $pdo = null): void {
    ($pdo ?: kfDb())->prepare("UPDATE settings SET v = CAST(v AS INTEGER) + 1 WHERE k = ?")->execute([$k]);
}

function kfQ(string $sql, array $args = []): PDOStatement {
    $st = kfDb()->prepare($sql);
    $st->execute($args);
    return $st;
}
