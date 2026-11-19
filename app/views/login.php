<?php
/* Kaufen – Anmeldung und erste Einrichtung. $needSetup und $loginError kommen aus index.php. */
defined('KF_VERSION') || exit;
$kfName = h(kfClean($_POST['name'] ?? '', 30));
?><!DOCTYPE html>
<html lang="<?= kfLang() ?>" data-page="login">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0f766e">
<title><?= h($needSetup ? kfT('Kaufen einrichten') : kfT('Kaufen – Anmelden')) ?></title>
<link rel="manifest" href="?action=manifest">
<link rel="icon" href="?action=asset&amp;f=icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="?action=asset&amp;f=icon-192.png">
<link rel="stylesheet" href="<?= h('?action=asset&f=app.css&v=' . KF_VERSION . '-' . (int)@filemtime(KF_APP . '/assets/app.css')) ?>">
<script src="<?= h('?action=asset&f=boot.js&v=' . KF_VERSION . '-' . (int)@filemtime(KF_APP . '/assets/boot.js')) ?>"></script>
</head>
<body class="loginpage">
<form class="login" method="post" action="?action=<?= $needSetup ? 'setup' : 'login' ?>">
    <img src="?action=asset&amp;f=icon.svg" alt="" width="64" height="64">
    <h1>Kaufen</h1>
<?php if ($needSetup): ?>
    <p class="sub"><?= h(kfT('Willkommen! Leg jetzt das erste Konto an. Es ist der Administrator und kann später weitere Konten anlegen.')) ?></p>
<?php else: ?>
    <p class="sub"><?= h(kfT('Gemeinsame Einkaufslisten')) ?></p>
<?php endif; ?>
<?php if ($loginError !== ''): ?>
    <p class="err" role="alert"><?= h($loginError) ?></p>
<?php endif; ?>
    <label><?= h(kfT('Name')) ?><input name="name" type="text" value="<?= $kfName ?>" autocomplete="username" autocapitalize="none" maxlength="30" required autofocus></label>
    <label><?= h(kfT('Passwort')) ?><input name="pass" type="password" autocomplete="<?= $needSetup ? 'new-password' : 'current-password' ?>" required<?= $needSetup ? ' minlength="8"' : '' ?>></label>
<?php if ($needSetup): ?>
    <label><?= h(kfT('Passwort wiederholen')) ?><input name="pass2" type="password" autocomplete="new-password" required minlength="8"></label>
<?php endif; ?>
    <button class="btn primary" type="submit"><?= h($needSetup ? kfT('Konto anlegen') : kfT('Anmelden')) ?></button>
<?php if (!$needSetup && !empty($localOk)): ?>
    <p class="localsw"><a href="?local=1"><?= h(kfT('Ohne Konto nutzen, nur auf diesem Gerät')) ?></a></p>
<?php endif; ?>
    <p class="langsw"><?php if (kfLang() === 'en'): ?><a href="?lang=de" lang="de" hreflang="de">Deutsch</a><?php else: ?><a href="?lang=en" lang="en" hreflang="en">English</a><?php endif; ?></p>
</form>
</body>
</html>
