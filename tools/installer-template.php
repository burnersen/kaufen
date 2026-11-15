<?php
/**
 * Kaufen – Installer (Version @@VERSION@@)
 *
 * Diese eine Datei enthält das ganze Programm. Hochladen, im Browser aufrufen, fertig:
 * Sie legt index.php und den Ordner app/ neben sich an und löscht sich danach selbst,
 * ebenso ein Kaufen-ZIP aus dem Release, falls eines daneben liegt.
 * Bei einem Update werden nur die Programmdateien ersetzt, der Ordner data/ wird nie angefasst.
 *
 * Erzeugt von tools/build-release.php, nicht von Hand bearbeiten.
 * Lizenz: GNU Affero General Public License v3.0, siehe Datei LICENSE.
 */

error_reporting(E_ALL);
ini_set('display_errors', '0');

define('KFI_VERSION', '@@VERSION@@');
define('KFI_MIN_PHP', '7.4.0');

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, private');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");

$kfiAl = strtolower(trim(isset($_SERVER['HTTP_ACCEPT_LANGUAGE']) ? (string)$_SERVER['HTTP_ACCEPT_LANGUAGE'] : ''));
$kfiEn = $kfiAl !== '' && strncmp($kfiAl, 'de', 2) !== 0;

/** Deutsch oder Englisch, je nach Browser */
function kfiT($de, $en) {
    global $kfiEn;
    return $kfiEn ? $en : $de;
}

function kfiH($s) {
    return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
}

/** Die eingepackten Dateien: hinter dem Programmende steht pro Zeile „Pfad, Prüfsumme, Inhalt (Base64)“ */
function kfiPayload() {
    $fp = @fopen(__FILE__, 'rb');
    if (!$fp) return null;
    fseek($fp, __COMPILER_HALT_OFFSET__);
    $raw = stream_get_contents($fp);
    fclose($fp);
    $files = array();
    foreach (explode("\n", (string)$raw) as $line) {
        $line = trim($line);
        if ($line === '') continue;
        $p = explode("\t", $line);
        if (count($p) !== 3) return null;
        $path = $p[0];
        if (!preg_match('~^[A-Za-z0-9._\-]+(/[A-Za-z0-9._\-]+)*$~', $path) || strpos($path, '..') !== false) return null;
        $bin = base64_decode($p[2], true);
        if ($bin === false || !hash_equals($p[1], hash('sha256', $bin))) return null;
        $files[$path] = $bin;
    }
    return isset($files['index.php']) ? $files : null;
}

/** Version eines schon vorhandenen Kaufen, '' = index.php gehört zu etwas anderem, null = keine da */
function kfiInstalledVersion($index) {
    if (!is_file($index)) return null;
    $head = (string)@file_get_contents($index, false, null, 0, 8192);
    if (strpos($head, 'Kaufen') !== false && preg_match("~define\\('KF_VERSION',\\s*'([0-9][0-9A-Za-z.\\-]*)'\\)~", $head, $m)) return $m[1];
    return '';
}

/** Schreibt alles erst unter einem Zwischennamen und tauscht dann um. Liefert Fehlertext oder ''. */
function kfiInstall($dir, array $files) {
    $tmp = array();
    $fail = '';
    foreach ($files as $path => $bin) {
        $target = $dir . '/' . $path;
        $parent = dirname($target);
        if (!is_dir($parent) && !@mkdir($parent, 0755, true) && !is_dir($parent)) { $fail = $path; break; }
        $t = $target . '.tmp';
        if (@file_put_contents($t, $bin) !== strlen($bin) || hash('sha256', (string)@file_get_contents($t)) !== hash('sha256', $bin)) {
            @unlink($t);
            $fail = $path;
            break;
        }
        $tmp[$t] = $target;
    }
    if ($fail === '') {
        foreach ($tmp as $t => $target) {
            if (!@rename($t, $target)) { $fail = substr($target, strlen($dir) + 1); break; }
            @chmod($target, 0644);
            if (function_exists('opcache_invalidate')) @opcache_invalidate($target, true);
        }
    }
    if ($fail !== '') {
        foreach ($tmp as $t => $target) if (is_file($t)) @unlink($t);
        return $fail;
    }
    // Programmteile, die es in dieser Version nicht mehr gibt, wegräumen (nur .php in app/, sonst nichts)
    foreach (array('lib', 'routes', 'views', 'assets') as $sub) {
        foreach ((array)@glob($dir . '/app/' . $sub . '/*') as $old) {
            if (!isset($files['app/' . $sub . '/' . basename($old)])) @unlink($old);
        }
    }
    return '';
}

/** Kaufen-ZIPs aus dem Release, die neben dem Installer liegen (werden nach der Installation nicht mehr gebraucht) */
function kfiZips($dir) {
    $out = array();
    foreach ((array)@glob($dir . '/kaufen-*.zip') as $z) {
        if (is_file($z) && preg_match('~^kaufen-[0-9][0-9A-Za-z.\-]*\.zip$~', basename($z))) $out[] = $z;
    }
    return $out;
}

$kfiDir = __DIR__;
$kfiSelf = __FILE__;
$kfiIndex = $kfiDir . '/index.php';
$kfiSelfIsIndex = realpath($kfiSelf) === realpath($kfiIndex);
$kfiFiles = kfiPayload();
$kfiOld = $kfiSelfIsIndex ? null : kfiInstalledVersion($kfiIndex);
$kfiHasData = is_dir($kfiDir . '/data');

$kfiProblems = array();
if (version_compare(PHP_VERSION, KFI_MIN_PHP, '<')) {
    $kfiProblems[] = kfiT('Kaufen braucht PHP 7.4 oder neuer, hier läuft PHP ', 'Kaufen needs PHP 7.4 or newer, this server runs PHP ') . PHP_VERSION . '.';
}
if (!extension_loaded('pdo_sqlite')) {
    $kfiProblems[] = kfiT('Die PHP-Erweiterung „pdo_sqlite“ fehlt. Ohne sie kann Kaufen nichts speichern.', 'The PHP extension "pdo_sqlite" is missing. Kaufen cannot store anything without it.');
}
if (!is_writable($kfiDir)) {
    $kfiProblems[] = kfiT('PHP darf in diesen Ordner nicht schreiben. Bitte die Schreibrechte anpassen.', 'PHP is not allowed to write to this folder. Please fix the permissions.');
}
if ($kfiFiles === null) {
    $kfiProblems[] = kfiT('Diese Installer-Datei ist beschädigt (unvollständig hochgeladen?). Bitte noch einmal herunterladen und im Binärmodus hochladen.', 'This installer file is damaged (incomplete upload?). Please download it again and upload it in binary mode.');
}

$kfiError = '';
$kfiDone = false;
$kfiSelfGone = true;
if (!$kfiProblems && (isset($_SERVER['REQUEST_METHOD']) ? $_SERVER['REQUEST_METHOD'] : '') === 'POST' && isset($_POST['kfi_go'])) {
    if ($kfiOld === '' && empty($_POST['kfi_overwrite'])) {
        $kfiError = kfiT('Bitte erst bestätigen, dass die vorhandene index.php ersetzt werden darf.', 'Please confirm first that the existing index.php may be replaced.');
    } else {
        $fail = kfiInstall($kfiDir, $kfiFiles);
        if ($fail !== '') {
            $kfiError = kfiT('Diese Datei ließ sich nicht schreiben: ', 'This file could not be written: ') . $fail
                      . kfiT('. Es wurde nichts verändert.', '. Nothing has been changed.');
        } else {
            $kfiDone = true;
            foreach (kfiZips($kfiDir) as $z) @unlink($z);
            if (!$kfiSelfIsIndex) {
                @unlink($kfiSelf);
                clearstatcache();
                $kfiSelfGone = !is_file($kfiSelf);
            }
            if ($kfiSelfGone) {
                header('Location: index.php');
                exit;
            }
        }
    }
}

$kfiTitle = $kfiOld ? kfiT('Kaufen aktualisieren', 'Update Kaufen') : kfiT('Kaufen installieren', 'Install Kaufen');
?><!DOCTYPE html>
<html lang="<?php echo $kfiEn ? 'en' : 'de'; ?>">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title><?php echo kfiH($kfiTitle); ?></title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.25rem;
           background: #0b1120; color: #e2e8f0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    .card { width: 100%; max-width: 34rem; background: #111a2e; border: 1px solid #26324d; border-radius: 1rem; padding: 1.75rem; }
    h1 { margin: 0 0 0.25rem; font-size: 1.4rem; }
    .sub { margin: 0 0 1.25rem; color: #94a3b8; font-size: 0.9rem; }
    ul { margin: 0 0 1.25rem; padding-left: 1.2rem; }
    li { margin-bottom: 0.35rem; }
    code { background: #0b1120; border: 1px solid #26324d; border-radius: 0.35rem; padding: 0.05rem 0.35rem; font-size: 0.85em; }
    .box { border-radius: 0.6rem; padding: 0.7rem 0.85rem; margin-bottom: 1rem; font-size: 0.92rem; }
    .bad { background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; }
    .warn { background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.4); color: #fcd34d; }
    .good { background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.4); color: #6ee7b7; }
    label { display: flex; gap: 0.6rem; align-items: flex-start; margin-bottom: 1rem; font-size: 0.92rem; }
    button, .btn { display: inline-block; width: 100%; border: 0; border-radius: 0.6rem; padding: 0.8rem 1rem; font: inherit; font-weight: 600;
                   color: #fff; background: #0f766e; cursor: pointer; text-align: center; text-decoration: none; }
    button:hover, .btn:hover { background: #0d5f59; }
</style>
</head>
<body>
<div class="card">
    <h1><?php echo kfiH($kfiTitle); ?></h1>
    <p class="sub">Version <?php echo kfiH(KFI_VERSION); ?></p>
<?php if ($kfiDone): ?>
    <div class="box good"><?php echo kfiH(kfiT('Kaufen ist eingerichtet.', 'Kaufen is installed.')); ?></div>
    <div class="box bad"><?php echo kfiH(kfiT('Diese Installer-Datei ließ sich nicht löschen. Bitte lösche sie jetzt von Hand: ', 'This installer file could not be deleted. Please delete it by hand now: ')); ?><code><?php echo kfiH(basename($kfiSelf)); ?></code></div>
    <a class="btn" href="index.php"><?php echo kfiH(kfiT('Weiter zu Kaufen', 'Continue to Kaufen')); ?></a>
<?php elseif ($kfiProblems): ?>
<?php foreach ($kfiProblems as $p): ?>
    <div class="box bad"><?php echo kfiH($p); ?></div>
<?php endforeach; ?>
    <p class="sub"><?php echo kfiH(kfiT('Es wurde nichts verändert. Behebe das Problem und lade diese Seite neu.', 'Nothing has been changed. Fix the problem and reload this page.')); ?></p>
<?php else: ?>
<?php if ($kfiError !== ''): ?>
    <div class="box bad"><?php echo kfiH($kfiError); ?></div>
<?php endif; ?>
    <ul>
<?php if ($kfiOld): ?>
        <li><?php echo kfiH(kfiT('Gefunden: Kaufen ', 'Found: Kaufen ') . $kfiOld . kfiT('. Es wird auf ', '. It will be updated to ') . KFI_VERSION . kfiT(' aktualisiert.', '.')); ?></li>
<?php else: ?>
        <li><?php echo kfiT('Legt <code>index.php</code> und den Ordner <code>app/</code> in diesem Verzeichnis an.', 'Creates <code>index.php</code> and the folder <code>app/</code> in this directory.'); ?></li>
<?php endif; ?>
<?php if ($kfiHasData): ?>
        <li><?php echo kfiT('Der Ordner <code>data/</code> mit deinen Konten und Listen bleibt unangetastet.', 'The folder <code>data/</code> with your accounts and lists is left untouched.'); ?></li>
<?php endif; ?>
        <li><?php echo kfiH(kfiT('Danach löscht sich diese Installer-Datei selbst.', 'Afterwards this installer file deletes itself.')); ?></li>
<?php foreach (kfiZips($kfiDir) as $z): ?>
        <li><?php echo kfiT('Auch <code>', 'Also <code>') . kfiH(basename($z)) . kfiT('</code> wird gelöscht, die Datei wird dann nicht mehr gebraucht.', '</code> is deleted, the file is no longer needed then.'); ?></li>
<?php endforeach; ?>
<?php if (!$kfiOld && !$kfiHasData): ?>
        <li><?php echo kfiH(kfiT('Gleich im Anschluss legst du das erste Konto an. Wer das als Erster tut, wird Administrator, also nicht aufschieben.', 'Right afterwards you create the first account. Whoever does that first becomes the administrator, so do not put it off.')); ?></li>
<?php endif; ?>
    </ul>
    <form method="post">
        <input type="hidden" name="kfi_go" value="1">
<?php if ($kfiOld === ''): ?>
        <div class="box warn"><?php echo kfiT('In diesem Verzeichnis liegt schon eine <code>index.php</code>, die nicht zu Kaufen gehört. Sie würde überschrieben.', 'This directory already contains an <code>index.php</code> that does not belong to Kaufen. It would be overwritten.'); ?></div>
        <label><input type="checkbox" name="kfi_overwrite" value="1"> <span><?php echo kfiH(kfiT('Ja, die vorhandene index.php darf ersetzt werden.', 'Yes, the existing index.php may be replaced.')); ?></span></label>
<?php endif; ?>
        <button type="submit"><?php echo kfiH($kfiOld ? kfiT('Jetzt aktualisieren', 'Update now') : kfiT('Jetzt installieren', 'Install now')); ?></button>
    </form>
<?php endif; ?>
</div>
</body>
</html>
<?php
__halt_compiler();
