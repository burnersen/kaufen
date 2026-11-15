<?php
/**
 * Kaufen – gemeinsame Einkaufslisten zum Selbsthosten
 *
 * Diese Datei ist nur der Einstieg: Einstellungen und Reihenfolge. Der eigentliche Code liegt in app/:
 *   app/lib/     Funktionen (Datenbank, Konten, Listen, Katalog)
 *   app/routes/  alle JSON-Aktionen
 *   app/views/   Anmeldeseite und Hauptseite
 *   app/assets/  CSS, JavaScript, Symbole (werden über diese Datei ausgeliefert)
 *
 * Reines PHP mit SQLite, keine Abhängigkeiten, nichts wird von fremden Servern nachgeladen.
 * Der Code enthält KEINE Zugangsdaten. Alles Geheime entsteht beim ersten Aufruf und liegt
 * dann im Ordner data/. Den Ordner data/ niemals veröffentlichen oder ins Git legen.
 *
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');
date_default_timezone_set('Europe/Berlin');

define('KF_VERSION', '1.1.1');
define('KF_ROOT', __DIR__);
define('KF_APP', KF_ROOT . '/app');
define('KF_DATA_DIR', KF_ROOT . '/data');
define('KF_COOKIE', 'KFSESS');
define('KF_SESSION_DAYS', 180);   // so lange bleibt ein Gerät angemeldet, solange es benutzt wird
define('KF_BACKUP_KEEP', 10);     // so viele Katalog-Sicherungen werden aufbewahrt
define('KF_MAX_USERS', 50);

require KF_APP . '/lib/db.php';
require KF_APP . '/lib/auth.php';
require KF_APP . '/lib/store.php';

$action = isset($_GET['action']) && is_string($_GET['action']) ? $_GET['action'] : '';

/* ---------- Dateien ohne Anmeldung: CSS, JavaScript, Symbole, Manifest, Service Worker ---------- */
if ($action === 'asset') {
    $types = [
        'app.css' => 'text/css; charset=utf-8', 'app.js' => 'text/javascript; charset=utf-8', 'boot.js' => 'text/javascript; charset=utf-8',
        'icon.svg' => 'image/svg+xml', 'icon-192.png' => 'image/png', 'icon-512.png' => 'image/png',
    ];
    $f = isset($_GET['f']) && is_string($_GET['f']) ? $_GET['f'] : '';
    if (!isset($types[$f]) || !is_file(KF_APP . '/assets/' . $f)) { http_response_code(404); exit; }
    kfHeaders();
    header('Content-Type: ' . $types[$f]);
    header('Cache-Control: ' . (isset($_GET['v']) ? 'public, max-age=31536000, immutable' : 'no-cache'));
    readfile(KF_APP . '/assets/' . $f);
    exit;
}
if ($action === 'sw') {
    kfHeaders();
    // Der Service Worker muss Seite und Dateien selbst abrufen dürfen, sonst kann er sie nicht vorhalten
    header("Content-Security-Policy: default-src 'none'; connect-src 'self'; frame-ancestors 'none'");
    header('Content-Type: text/javascript; charset=utf-8');
    header('Cache-Control: no-cache');
    echo 'const KF_V = ' . json_encode(KF_VERSION) . ";\n";
    readfile(KF_APP . '/assets/sw.js');
    exit;
}
if ($action === 'manifest') {
    kfHeaders();
    header('Content-Type: application/manifest+json; charset=utf-8');
    header('Cache-Control: no-cache');
    echo json_encode([
        'name' => 'Kaufen', 'short_name' => 'Kaufen', 'description' => 'Gemeinsame Einkaufslisten',
        'start_url' => './', 'scope' => './', 'display' => 'standalone', 'lang' => 'de',
        'background_color' => '#0f1720', 'theme_color' => '#0f766e',
        'icons' => [
            ['src' => '?action=asset&f=icon-192.png', 'sizes' => '192x192', 'type' => 'image/png', 'purpose' => 'any maskable'],
            ['src' => '?action=asset&f=icon-512.png', 'sizes' => '512x512', 'type' => 'image/png', 'purpose' => 'any maskable'],
        ],
    ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}

/* ---------- Einrichtung, Anmeldung ---------- */
$me = kfCurrentUser();
$loginError = '';
$needSetup = !kfHasUsers();

if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'setup' && $needSetup) {
    $loginError = kfSetup((string)($_POST['name'] ?? ''), (string)($_POST['pass'] ?? ''), (string)($_POST['pass2'] ?? ''));
    if ($loginError === '') { header('Location: ./'); exit; }
}
if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === 'login' && !$needSetup) {
    $loginError = kfLogin((string)($_POST['name'] ?? ''), (string)($_POST['pass'] ?? ''));
    if ($loginError === '') { header('Location: ./'); exit; }
}

/* ---------- JSON-Aktionen ---------- */
if ($action !== '' && !in_array($action, ['setup', 'login'], true)) {
    require KF_APP . '/routes/api.php';
    exit;
}

kfHeaders(true);
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
if ($me) {
    header('X-KF-Page: app');
    require KF_APP . '/views/app.php';
} else {
    require KF_APP . '/views/login.php';
}
