<?php
/* Kaufen – Hauptseite. Nur das Gerüst, alle Inhalte holt app.js über die JSON-Aktionen. */
defined('KF_VERSION') || exit;
$kfV = function (string $f): string { return h('?action=asset&f=' . $f . '&v=' . KF_VERSION . '-' . (int)@filemtime(KF_APP . '/assets/' . $f)); };
?><!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0f766e">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Kaufen">
<title>Kaufen</title>
<link rel="manifest" href="?action=manifest">
<link rel="icon" href="?action=asset&amp;f=icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="?action=asset&amp;f=icon-192.png">
<link rel="stylesheet" href="<?= $kfV('app.css') ?>">
<script defer src="<?= $kfV('app.js') ?>"></script>
</head>
<body>
<header id="top">
    <div class="bar">
        <button id="listBtn" class="listbtn" type="button" aria-label="Liste wechseln"><span id="listName">Kaufen</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <span id="net" class="net" hidden></span>
        <button id="menuBtn" class="iconbtn" type="button" aria-label="Menü"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
    </div>
    <div class="search">
        <input id="q" type="search" placeholder="Produkt suchen oder neu anlegen" autocomplete="off" autocapitalize="sentences" enterkeyhint="done" aria-label="Produkt suchen">
    </div>
</header>
<main id="main"><p class="hint">Lade …</p></main>
<div id="toast" class="toast" hidden></div>
<div id="layer"></div>
<noscript><p class="hint">Kaufen braucht JavaScript.</p></noscript>
</body>
</html>
