<?php
/* Kaufen – Sprache: Deutsch oder Englisch. Der deutsche Text ist zugleich der Schlüssel für die Übersetzung. */
defined('KF_VERSION') || exit;

/**
 * Die Sprache dieses Aufrufs. Das Gerät merkt sie sich im Cookie kf_lang (setzt app.js bzw. der Umschalter
 * auf der Anmeldeseite). Ohne Cookie entscheidet die Sprache des Browsers: Deutsch bleibt Deutsch, alles andere wird Englisch.
 */
function kfLang(): string {
    static $lang = null;
    if ($lang !== null) return $lang;
    $c = $_COOKIE['kf_lang'] ?? '';
    if ($c === 'de' || $c === 'en') return $lang = $c;
    $al = strtolower(trim((string)($_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '')));
    return $lang = ($al !== '' && strncmp($al, 'de', 2) !== 0) ? 'en' : 'de';
}

/** Merkt die Sprache auf diesem Gerät. Kein httponly, damit app.js das Cookie lesen und nachführen kann. */
function kfLangCookie(string $lang): void {
    $path = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/') . '/';
    setcookie('kf_lang', $lang, ['expires' => time() + 365 * 86400, 'path' => $path, 'secure' => kfIsHttps(), 'httponly' => false, 'samesite' => 'Lax']);
}

/** Text in der Sprache des Aufrufs. Platzhalter wie bei sprintf: kfT('Mehr als %d Konten gehen nicht.', 50) */
function kfT(string $s, ...$args): string {
    static $en = null;
    if (kfLang() === 'en') {
        if ($en === null) $en = kfEnglish();
        $s = $en[$s] ?? $s;
    }
    return $args ? vsprintf($s, $args) : $s;
}

function kfEnglish(): array {
    return [
        // Start und Datenbank
        'Der Ordner data/ konnte nicht angelegt werden. PHP braucht Schreibrechte im Verzeichnis von Kaufen.' => 'The folder data/ could not be created. PHP needs write access to the Kaufen directory.',
        'In den Ordner data/ kann nicht geschrieben werden. Bitte die Schreibrechte prüfen.' => 'The folder data/ is not writable. Please check the permissions.',
        'Die PHP-Erweiterung pdo_sqlite fehlt. Ohne sie kann Kaufen nichts speichern.' => 'The PHP extension pdo_sqlite is missing. Kaufen cannot store anything without it.',
        'Die Datenbank konnte nicht geöffnet werden: ' => 'The database could not be opened: ',
        // Anmeldung und Einrichtung
        'Der Name muss 2 bis 30 Zeichen lang sein.' => 'The name must be 2 to 30 characters long.',
        'Der Name enthält unzulässige Zeichen.' => 'The name contains characters that are not allowed.',
        'Das Passwort muss mindestens 8 Zeichen lang sein.' => 'The password must be at least 8 characters long.',
        'Das Passwort ist zu lang.' => 'The password is too long.',
        'Die beiden Passwörter stimmen nicht überein.' => 'The two passwords do not match.',
        'Kaufen ist schon eingerichtet.' => 'Kaufen is already set up.',
        'Einkauf' => 'Groceries',
        'Bitte Name und Passwort eingeben.' => 'Please enter name and password.',
        'Zu viele Fehlversuche. Bitte in %s noch einmal versuchen.' => 'Too many failed attempts. Please try again in %s.',
        '%d Minuten' => '%d minutes',
        '%d Sekunden' => '%d seconds',
        'Name oder Passwort stimmt nicht.' => 'Wrong name or password.',
        'Kaufen einrichten' => 'Set up Kaufen',
        'Kaufen – Anmelden' => 'Kaufen – Sign in',
        'Willkommen! Leg jetzt das erste Konto an. Es ist der Administrator und kann später weitere Konten anlegen.' => 'Welcome! Create the first account now. It is the administrator and can add more accounts later.',
        'Gemeinsame Einkaufslisten' => 'Shared shopping lists',
        'Name' => 'Name',
        'Passwort' => 'Password',
        'Passwort wiederholen' => 'Repeat password',
        'Konto anlegen' => 'Create account',
        'Anmelden' => 'Sign in',
        // Hauptseite (app.js setzt diese Texte beim Start noch einmal in der Sprache des Kontos)
        'Liste wechseln' => 'Switch list',
        'Ansicht wechseln' => 'Switch view',
        'Menü' => 'Menu',
        'Produkt suchen oder neu anlegen' => 'Search or add a product',
        'Produkt suchen' => 'Search products',
        'Suche leeren' => 'Clear search',
        'Lade …' => 'Loading …',
        'Kaufen braucht JavaScript.' => 'Kaufen needs JavaScript.',
        // JSON-Aktionen
        'Nicht angemeldet.' => 'Not signed in.',
        'Sitzung abgelaufen, bitte die Seite neu laden.' => 'Session expired, please reload the page.',
        'Falsche Aufrufart.' => 'Wrong request method.',
        'Das darf nur der Administrator.' => 'Only the administrator may do that.',
        'Die Datei enthält keinen brauchbaren Katalog.' => 'The file does not contain a usable catalog.',
        'Diese Liste gibt es nicht (mehr) oder du bist kein Mitglied.' => 'This list does not exist (anymore) or you are not a member.',
        'Bitte einen Namen eingeben.' => 'Please enter a name.',
        'Mehr als 30 eigene Listen gehen nicht.' => 'You cannot have more than 30 lists of your own.',
        'Umbenennen kann nur, wer die Liste angelegt hat.' => 'Only the person who created the list can rename it.',
        'Teilen kann nur, wer die Liste angelegt hat.' => 'Only the person who created the list can share it.',
        'Die eigene Liste kann man nicht verlassen, nur löschen.' => 'You cannot leave your own list, only delete it.',
        'Löschen kann nur, wer die Liste angelegt hat.' => 'Only the person who created the list can delete it.',
        'Diese Warengruppe gibt es schon.' => 'This category already exists.',
        'Bitte eine Warengruppe wählen.' => 'Please choose a category.',
        '„%s“ gibt es schon im Katalog.' => '“%s” is already in the catalog.',
        'Diese Sicherung gibt es nicht mehr.' => 'This backup no longer exists.',
        'Die Vorlage braucht mindestens ein Produkt.' => 'The template needs at least one product.',
        'Diesen Namen gibt es schon.' => 'This name is already taken.',
        'Mehr als %d Konten gehen nicht.' => 'More than %d accounts are not possible.',
        'Das eigene Konto kann man nicht löschen.' => 'You cannot delete your own account.',
        'Das bisherige Passwort stimmt nicht.' => 'The current password is wrong.',
        'Dieser Server kann keine Mitteilungen verschicken.' => 'This server cannot send notifications.',
        'Mitteilungen lassen sich auf diesem Gerät nicht einrichten.' => 'Notifications cannot be set up on this device.',
        'Unbekannte Aktion.' => 'Unknown action.',
        'Das hat nicht geklappt. Bitte noch einmal versuchen.' => 'That did not work. Please try again.',
    ];
}
