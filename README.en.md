# Kaufen

[Deutsch](README.md) · **English**

[![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php&logoColor=white)](#requirements)
[![License: AGPLv3](https://img.shields.io/badge/License-AGPLv3-blue)](#license)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20me-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/burnersen)

**[⬇️ Download the latest release](../../releases/latest)** · **[🌐 Website](https://tech.burnersen.de/en/tools/kaufen-en/)** · **[☕ Buy me a coffee](https://ko-fi.com/burnersen)**

<sub>🇩🇪 Auf Deutsch: [tech.burnersen.de/tools/kaufen](https://tech.burnersen.de/tools/kaufen/)</sub>

Shared shopping lists you host yourself. The server side is PHP and SQLite, the browser side plain JavaScript and CSS. No frameworks, no dependencies, no build step, no MySQL. Runs on basic web hosting and is installed with a single file.

*Kaufen* is German for "to buy". You tap products from a ready-made catalog, sorted by category. In the store you tap them again and they move, checked off, into the cart, for everyone who shares the list.

Upload `kaufen-install.php`, open it in the browser, create the first account. That is the whole installation.

If you do not want anything on a server at all, tap **“Use without an account, on this device only”** on the sign-in page. All lists then stay on your own phone or computer, see [Local mode](#on-this-device-only-local-mode).

<p align="center">
  <img src="docs/en/list.png" alt="The shopping list with quantities, notes, who added what, and “Due again soon” below" width="320">
</p>

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/en/list-view.png" alt="The list view: categories on one card, circles for ticking off, ticked items stay struck through in place" width="250"><br><sub>List: ticked items stay struck through</sub></td>
    <td align="center" width="33%"><img src="docs/en/size.png" alt="Text, size and spacing: preview, below it entry height and space between" width="250"><br><sub>Set entry height and spacing</sub></td>
    <td align="center" width="33%"></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/en/no-account.png" alt="The sign-in page with the link “Use without an account, on this device only”" width="250"><br><sub>No account, on this device only</sub></td>
    <td align="center" width="33%"><img src="docs/en/local.png" alt="Settings in local mode: backup file and leave local mode" width="250"><br><sub>Local mode</sub></td>
    <td align="center" width="33%"><img src="docs/en/print.png" alt="Print and share: preview of the sheet, below it font, text size, line spacing and columns" width="250"><br><sub>Adjust the sheet, with preview</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/en/cart.png" alt="Checked-off items sit ticked and crossed out in the cart, with the “Done shopping” button below" width="250"><br><sub>Cart: ticked and crossed out</sub></td>
    <td align="center" width="33%"><img src="docs/en/swipe.png" alt="An item in shopping mode being swiped to the left, with a red “Delete” behind it" width="250"><br><sub>Swipe: left deletes, right sets quantity</sub></td>
    <td align="center" width="33%"><img src="docs/en/category.png" alt="After holding an item: change its category or create a new one" width="250"><br><sub>Hold: change the category</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/en/store.png" alt="Shopping mode with large rows for ticking off" width="250"><br><sub>Shopping mode: large rows for ticking off</sub></td>
    <td align="center" width="33%"><img src="docs/en/dark.png" alt="Dark theme in the compact view" width="250"><br><sub>Dark and compact</sub></td>
    <td align="center" width="33%"><img src="docs/en/several.png" alt="Preview when typing several products at once" width="250"><br><sub>Several at once, with preview</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/en/quantity.png" alt="Quantity picker: counter, units, custom unit, note" width="250"><br><sub>Quantity, unit and note</sub></td>
    <td align="center"><img src="docs/en/recent.png" alt="Recently bought, with “3 days ago” on the tiles" width="250"><br><sub>Recently bought</sub></td>
    <td align="center"><img src="docs/en/settings.png" alt="Settings: language, view, text, ten themes" width="250"><br><sub>Settings</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/en/color-mixer.png" alt="Color mixer for your own theme" width="250"><br><sub>Color mixer for your own theme</sub></td>
    <td align="center"><img src="docs/en/menu.png" alt="The menu" width="250"><br><sub>Menu</sub></td>
    <td align="center"><img src="docs/en/backup.png" alt="Backup and update for the administrator" width="250"><br><sub>Backup and update</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/en/paste.png" alt="Paste from text, with a preview of what was recognized" width="250"><br><sub>Paste from text</sub></td>
    <td align="center"><img src="docs/en/shopping-list.png" alt="The shopping list as PDF: two columns, boxes to tick off" width="250"><br><sub>The PDF to print</sub></td>
    <td align="center"><img src="docs/en/compact.png" alt="The same sheet compact: Classic font, three columns, tight line spacing" width="250"><br><sub>The same sheet, compact</sub></td>
  </tr>
</table>

<sub>Screenshots of versions 1.11.1 to 1.16.0. Names and entries are made up.</sub>

> 💜 **Using Kaufen and happy with it?** A ⭐ on GitHub is the easiest way to let me know, and it does more than you'd think: stars are the visible proof that a project does good work, and they are how small projects like this one get found by other people in the first place. Or [tell me what you use it for](https://github.com/burnersen/kaufen/issues/new), I read every message. Thanks for being here!

## Contents

[How it works](#how-it-works) · [Features](#features) · [Requirements](#requirements) · [Installation](#installation) · [Protecting your data](#protecting-your-data) · [Updating](#updating) · [Backup and restore](#backup-and-restore) · [Structure](#structure) · [Good to know](#good-to-know) · [License](#license)

## How it works

1. **Onto the list:** tap products in the catalog or type them at the top, several at once if you like (“milk, 2 kg apples and bread”). Everyone who shares the list sees them within a few seconds.
2. **Tick off in the store:** tap an item and it stays where it is, checked and struck through, like on paper. Tapped the wrong one? Two taps within 2 seconds bring it back. If you prefer, ticked items can move into a cart below the list instead, where one tap brings them back.
3. **Done:** “Done shopping” below the cart empties it after asking once more. Whatever is still missing stays on the list for the next store.

| Gesture | On the list and in the cart | In the catalog |
|---|---|---|
| Tap | tick off, into the cart or struck through (in the cart: bring back, struck through: tap twice) | put on the list or take it off again |
| Swipe left | delete completely, with “Undo” for a few seconds | |
| Swipe right | quantity and note | |
| Hold | change the category (about one second, a ring shows it) | quantity and note (half a second) |
| On a computer | drag with the mouse instead of swiping, right-click instead of holding | right-click instead of holding |

**Explained briefly in the app:** Menu → Help shows how to use it at a glance, with all gestures. On first start a small box points to it once.

**Without a server:** in [local mode](#on-this-device-only-local-mode) everything works the same, except that the lists never leave the device.

## Features

### Shopping

- **Catalog** with about 810 products in 16 categories, in the order of a typical supermarket. Text only, no images.
- **Tap** to put a product on the list. Tap it in the list to check it off: it moves, ticked and crossed out, into the **cart** below, just like on paper. Tap it again to bring it back up. Everyone who shares the list sees right away what is already in the cart.
- **Done shopping:** the button below the cart empties it after asking once more. Anything still to buy stays on the list, for example for another store. The cart never empties by itself.
- **Swipe like in your mail app:** swipe an item to the left to delete it from the list completely (with “Undo” for a few seconds), swipe it to the right to open quantity and note. Works in all four views. On a computer, drag with the mouse.
- **Change the category on the spot:** hold an item on the list for about one second (on a computer: right-click), a ring grows around it meanwhile. Then tap another category, for example jarred plums to canned goods instead of fruit. This only applies to that item, or permanently in the catalog if you like. You can create a new category right there too.
- **Search** across the whole catalog, in both languages: "milch" finds Milk as well. If a product does not exist, you create it right from the search and assign it to a category. Kaufen suggests the category from the end of the word: German compounds like “Bergkäse” land in dairy, “Hundefutter” in pet supplies.
- **Several at once, also by voice:** type or dictate “milk, 2 kg apples and half a bread” into the search field, press Enter, and everything is on the list. Items are split at commas, “and” or line breaks; without commas (“milk bread apples cream”) the catalog splits the words. Quantities may come before or after, in digits or words. While you type, a preview shows what was recognized.
- **Recently bought:** the latest and most frequent products, collapsible like the categories. What was bought in the last two weeks says so on the tile (“3 days ago”), a long-press shows the date and how often.
- **Due again soon:** when you tick things off, Kaufen learns how often you buy them (milk about every 5 days). When it is time again, it waits below the list, ready to tap. A product needs a few purchases for this. Everything stays on your own server, can be switched off per account or per product.
- **Four views:** small tiles, compact, shopping mode (large rows for ticking off in the store) or list (plain rows on one card, a heading per category, a circle for ticking off on the left, the quantity as a pill on the right). By default Kaufen starts in the list view, the closest to a paper shopping list. Switched with the button at the top right, remembered per device and for each list separately. Colors come from the chosen theme, as everywhere.
- **Strike through or cart:** by default ticked items stay where they are, checked and struck through. A per-device choice in the settings: always strike through, always into the cart, or strike through in the list view only. Two taps within 2 seconds put an item back on the list, so a single accidental tap brings nothing back. “Done shopping” then takes everything ticked off the list. Others sharing the list who prefer the cart see the same items in their cart.
- **Keep shopping without a signal:** the app starts without reception, changes are collected and sent later.
- **Screen stays on** while the app is open (can be turned off).
- **Help in the app:** Menu → Help briefly explains tapping, swiping and holding, quantities, shopping in the store and what is at the top and in the menu. The help adapts: if you strike through instead of using the cart, that is what it says.

### Quantities and notes

- **Quantity or note:** swipe right on the list, long-press in the catalog (on a computer: right-click). The counter starts at 1 with no unit. Adjust it with plus and minus, tap a unit if you want one (piece, pack, liter, kg …) and add a note. A plain 1 is not shown on the tile, a number without a unit is shown large as “3×”. Halves work too: type “2.5” or “2 1/2” or tap the ½ button, it shows as 2½.
- **Singular and plural on one button:** the same button reads “jar” for 1 and “jars” from 2 on. Dictating and typing understand both forms.
- **More units:** besides piece, pack, liter, kg and so on there are crate, case, tub, bag, net, tray, roll, bar, tube, sack, slice, head, clove, cube, stick and portion. The settings decide which ones are always shown in the quantity picker, the rest waits under “More …”.
- **Custom units:** each account can add its own, such as “bucket”, with singular and plural, right in the quantity picker or in the settings. They can be renamed and deleted in both places. Quantities already saved stay as text.
- **Remembers quantities:** when you check a product off, Kaufen remembers what was on it. Bought five colas, and next time it says "5" again, visible on the tile, and one tap puts it on the list the same way. Each account can turn this off in the settings, then it always starts at 1. "Reset quantity" forgets the remembered quantity of a product.

### Shopping together

- **Sync across all devices:** your own changes go to the server right away. Only while Kaufen is open and visible and nothing is going on does the device ask every few seconds whether something has changed. The administrator can set the interval (1 to 60 seconds, default 5).
- **Multiple lists:** everyone can create lists and share them with any accounts. If you were invited, you can also leave a list again.
- **Who added it:** in shared lists the product shows who put it there. Each account can hide this in the settings.
- **Notifications on your phone:** if you like, you get a notification when someone puts something on a shared list. Each account turns this on or off per device in the settings. Bundled instead of one by one: three products make one notification, sent the moment the other person leaves Kaufen. Checking things off in the store does not notify anyone.
- **Shopping list as PDF:** for the days the phone stays at home. Sorted by category in the order of your own store, with a box in front of every item to tick off with a pen. Plain black and white, so it prints well on any printer. At the bottom, optional blank “Also get” lines to write on, and an empty list gives you a blank sheet. On a phone the PDF goes straight to the printer via sharing. It is created in the browser, without any third-party library and even offline.
- **The sheet your way:** font (Clean, Classic or Typewriter), text size, line spacing from tight to wide, and 2 or 3 columns. A preview at the top of the window shows exactly what comes out of the printer and changes as you adjust. Tap it to enlarge. Tight with 3 columns, a big weekly shop fits on half a page. Remembered per device.
- **List as text:** whatever is still to buy goes to your messenger, mail and so on as plain text, to the clipboard or into a text file, for people without an account. Both are under Menu → Print and share. Anything already in the cart is left off the sheet and the text.
- **Paste from text:** paste text or open a text file, and everything lands on the open list. Kaufen understands its own export, lists with dashes, boxes or numbers, and free text like “milk, 2 kg apples and bread”. A preview shows what was recognized first. Anything already on the list is not added twice, ticked lines ([x]) are left out.
- **Store layout:** the categories can be ordered per list to match the way your own store is laid out.
- **Templates:** "BBQ" or "Breakfast" puts several products on the list with one tap. The current list can be saved as a template too.

### On this device only (local mode)

For everyone who does not want their lists on any server. It is the same app with all features and all future improvements, only a small “server” inside the browser does the work.

- **Without an account:** tap “Use without an account, on this device only” on the sign-in page, then add it to your home screen (see [On your phone](#on-your-phone)). Done, no sign-in.
- **Switch with an account:** Settings → “Switch to local mode”. Lists, catalog, templates and look are copied to the device, then the device signs out of the server.
- **Everything stays on the device:** no syncing, no notifications, no list goes online. Kaufen starts from the device's storage, even in airplane mode. The only connection: now and then the browser checks whether there is a new version of Kaufen and fetches it. No data goes out with that.
- **What is missing:** sharing lists with others, accounts and notifications. You can still pass a list on as PDF or text.
- **Backup file:** in the menu. Saves all lists, the catalog, the templates and the look to one file and restores it. Important, because clearing the browser data would otherwise lose everything.
- **Going back:** Menu → “Leave local mode” leads to the sign-in page. Afterwards Kaufen asks whether the local lists should move into the account. If there is a list with the same name, everything goes there, without duplicates.
- **For the server owner:** if you do not want the link on your server, set `'local' => false` in `data/config.php`. People using it only get the program files and the default catalog from your server, never any data from you or others.

### Demo mode (for a public server to try Kaufen out)

For anyone who wants to let others try Kaufen without signing up. **Not for your own installation.**

- **Turning it on:** install fresh, create the first account, then Settings → “Turn on demo mode …”. Two warnings follow and finally an arithmetic task. Only the right answer turns it on; a wrong one leaves everything as it is.
- **What happens then:** everyone is signed out. The sign-in page, accounts, shared lists and notifications are gone. Everyone who opens the page goes straight into local mode, everything stays on their device.
- **Home screen:** visitors see a note at the top on how to put Kaufen on their home screen (explained for iPhone and iPad, Android, Safari on the Mac and other computers), and that everything then stays local. The same box says you can host Kaufen yourself and then share lists too, with a link to the guide.
- **At the bottom:** a short line saying this is a demo, and two clearly visible buttons to tech.burnersen.de and to Kaufen on GitHub.
- **Updates by themselves:** the server checks for a new version at most once an hour and installs it without asking, after the page has been delivered. Devices pick it up the next time they open Kaufen.
- **No way back in the app.** If you made a mistake: delete the line `'demo' => true` from `data/config.php` via FTP. Accounts and lists are then back as before.

### Language and look

- **German and English:** each account picks its language in the settings. A German device starts in German, all others in English. Everything is translated, including the catalog. In a shared list one person sees "Milch" and the other sees "Milk", and it is still the same entry.
- **Ten themes and your own colors:** five light and five dark color schemes, plus one custom theme each from the color mixer (sliders or color picker, with preview). There you can also pick the text colors for headings, secondary text, list text and quantity. One button matches them to the accent color automatically: easy-to-read list text and a quantity color from the color wheel that stands out from it. If you like, dragging a slider shows your real list instead of the preview. With "Same as device" Kaufen switches automatically between your light and your dark favorite. The look belongs to the account and applies on all devices.
- **Every list its own look:** view, text, light or dark, theme and colors apply to the list that is open. The grocery list as a plain list, the hardware store dark with large tiles. Every user sets this up for themselves, in shared lists everyone sees their own look. “Apply to all lists” in the settings makes the look of the open list the default for all.
- **Text, size and spacing:** set per device and list in the settings: text sizes for everything at once or separately for headings, product names, quantity, count and note, plus how bold the count is. Also the entry height (tiles, labels and rows, 60 to 180 %) and the space between them (0 to 300 %), in every view. With a preview in the chosen view, or right on the real list while dragging if you like.
- **Installable as an app** (PWA), with its own icon on the home screen.

### Managing

- **Manage the catalog:** create, rename, move and delete products and categories. A search field filters the catalog, Enter creates what you searched for if it is missing. The administrator can export the whole catalog as CSV or JSON, edit it and import it again, always with German and English names. The administrator can also delete everything and restore the default. A backup is made automatically before every major change, the last 10 versions can be restored.
- **Accounts:** the first account is the administrator, who creates the others and can change their names and passwords at any time or delete accounts. There is no open sign-up.
- **Backup and update** (administrator, in the menu): download the whole database as one file and restore it, the previous state can be brought back. One-tap updates: Kaufen looks up the latest release on GitHub, verifies the file by checksum, saves the running version and installs the new one. Going back to the previous version takes one tap. If you like, Kaufen checks once a day by itself.
- **Throttling against password guessing:** after 5 wrong attempts for one name (or 20 from one address) you have to wait, 30 seconds at first, longer with every further failure, one hour at most.

## Requirements

- PHP 7.4 or newer (8.x recommended) with the `pdo_sqlite` extension
- A web server with PHP. **Apache** (and LiteSpeed) lock the internal folders by themselves via `.htaccess`, as long as the host honors `.htaccess` files, which almost every host does. **nginx** and other servers need two lines in their configuration, see [Protecting your data](#protecting-your-data).
- **HTTPS.** Without HTTPS the password travels in plain text, and the app cannot be installed on a phone.
- For notifications on your phone in addition: the `openssl` extension, plus `curl` or `allow_url_fopen`, and the web host must allow outgoing connections. If any of that is missing, Kaufen works as usual, just without notifications. The same goes for one-tap updates.

## Installation

1. Download `kaufen-install.php` from the [latest release](../../releases/latest) and copy it to a directory on your web server.
2. PHP must be allowed to write to that directory (it creates `index.php`, the folder `app/` and later `data/` there).
3. Open `kaufen-install.php` in the browser **right away** and click "Install now". The file unpacks the program, deletes itself and redirects. Create the first account there. This account is the administrator. If the installer says it could not delete itself, please delete the file by hand.
4. **Check that the internal folders are locked from the outside** (important, see [Protecting your data](#protecting-your-data)): open `https://your-address/data/config.php` and `https://your-address/app/routes/api.php`. Both must show "403 Forbidden" (or "404 Not Found"). A blank white page means the lock is not working.
5. In the menu under *Accounts* create the other accounts and invite them to the shared list in the same step.

> ⚠️ Whoever opens a freshly uploaded Kaufen that has not been set up yet becomes the administrator. So do step 3 immediately after uploading.

**Rather do it by hand?** The release also contains `kaufen-<version>.zip`. Unpack it and upload the contents of the folder `kaufen/`, that is `index.php` **and** the folder `app/`. Then open it in the browser and continue with step 4.

### On your phone

Open the address in the browser, sign in (or “Use without an account”), then choose "Add to Home screen" in the browser menu (iPhone: Share → "Add to Home Screen"). From then on Kaufen starts like an app. On a computer, Chrome and Edge offer “Install” in the address bar.

## Protecting your data

The folder `data/` holds everything worth protecting: the database with accounts, lists and settings, plus the key for notifications. Kaufen does quite a bit to keep it out of reach. A few things are up to you, though.

**1. Lock the internal folders.** Under Apache, Kaufen creates the necessary `.htaccess` files by itself. Under **nginx**, add these two lines to the site's `server` block. The `^~` matters: it makes the lock take precedence over the rule for `.php` files. Without it, nginx would still hand `data/config.php` over to PHP:

```nginx
# Kaufen lives in the folder /kaufen/ here. If it is in the web root, leave out /kaufen.
location ^~ /kaufen/data/ { deny all; }
location ^~ /kaufen/app/  { deny all; }
```

Back up the configuration first, then test and reload:

```sh
# Back up the configuration (path depends on your system, often /etc/nginx/sites-available/)
sudo cp -a /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

# Test and reload
sudo nginx -t && sudo systemctl reload nginx

# If something goes wrong: restore and reload
sudo cp -a /etc/nginx/sites-available/default.bak /etc/nginx/sites-available/default && sudo systemctl reload nginx
```

Then repeat the check from [Installation, step 4](#installation). Kaufen needs no direct access to `app/`, even CSS and JavaScript are served through `index.php`.

If the lock ever fails, the database still cannot simply be downloaded: it has a random name that is only written in `data/config.php`, and a `.php` file cannot be downloaded from the outside. You should not rely on that alone, though.

**2. Keep backups safe.** The backup from the menu is the complete database: all accounts (passwords only as a hash), all lists and the key for notifications. It does not belong in a public cloud share, a chat or back in the web folder. The same goes for the folder `data/` itself, which never belongs in a public Git repository.

**3. Strong passwords.** At least 8 characters are required, more is better, especially for the administrator account.

**4. What goes out.** Kaufen loads nothing from third-party servers, no fonts, no scripts, no analytics. Only two features connect to the outside, and only if you use them:

- **Updates:** asks GitHub for the latest version. Nothing personal is sent. If you do not want this at all, add `'update_url' => ''` to `data/config.php`.
- **Notifications:** go from your own server to the notification service of the respective browser (Apple, Google, Mozilla, Microsoft). The content is encrypted for the device, the service itself cannot read it.

**5. What is not encrypted.** The shopping lists are stored as plain text in the database. Anyone with access to the web space (including your host) can read them. If you do not want that, use [local mode](#on-this-device-only-local-mode): then the lists never end up on the server in the first place.

## Updating

**From version 1.10.0 the easiest way:** in the menu, *Backup and update*, tap “Check for updates now” and then “Update now”. PHP must be allowed to overwrite the program files and to open outgoing connections (curl or `allow_url_fopen`). To switch it off, set `'update_url' => ''` in `data/config.php`.

By hand: upload the new `kaufen-install.php` and open it. Only the program files are replaced, the folder `data/` is left untouched.

A backup before an update never hurts, see the next section.

## Backup and restore

**Easiest in the menu** under *Backup and update*: "Download backup" saves the whole database as one file, "Restore backup …" brings it back. The state before restoring is kept and can be brought back there with one tap.

**By hand via SSH** (in the Kaufen directory). The backup goes to your home directory, outside the web folder, so nobody can fetch it through the browser. Best done while nobody is shopping:

```sh
# Create a backup
cp -a data ~/kaufen-backup-$(date +%Y%m%d-%H%M)

# Restore: move the current state aside (also outside the web folder),
# then put the backup in place (insert the name of your backup)
mv data ~/kaufen-data-before-$(date +%Y%m%d-%H%M) && cp -a ~/kaufen-backup-YYYYMMDD-HHMM data
```

Without SSH: download the folder `data/` via FTP and upload it again to restore. Keep the downloaded copy safe, see [Protecting your data](#protecting-your-data).

## Structure

```
index.php      entry point and settings (PHP)
app/lib/       language, database, accounts and sign-in, lists and catalog, default catalog, notifications, backup and update (PHP)
app/routes/    all JSON actions (PHP)
app/views/     sign-in page and main page (PHP/HTML)
app/assets/    the app in the browser (JavaScript, CSS), PDF shopping list, local mode, English translation, icons, service worker
data/          created on first start, holds the database and accounts
tools/         builds the release files (php tools/build-release.php)
```

The files in `app/` do nothing when called directly, everything goes through `index.php`. Under Apache an `.htaccess` blocks the folder as well. The default catalog lives in `app/lib/catalog.php` and can be adjusted there. The English texts and product names are in `app/assets/i18n.js`, the English server messages in `app/lib/lang.php`. Comments in the source code are in German.

## Good to know

- **Local mode on the iPhone:** be sure to install it via "Add to Home Screen". Otherwise Safari clears the data of websites that have not been used for a week. Installed apps are exempt. A backup file never hurts anyway.
- **Notifications:** on the iPhone they only work when Kaufen is installed via "Add to Home Screen" (iOS 16.4 or later), on Android and on a computer they also work in the browser. When you turn them on, the server sends a test, so you see right away whether it can reach the notification service. If a device does not say goodbye when leaving (no signal), the notification goes out about three minutes after the last change, as soon as any device has Kaufen open again.
- **Language:** the built-in catalog is stored in German in the database and is only translated for display on English accounts. Products, categories and templates you create yourself stay exactly as typed.
- **Cart:** belongs to the list and applies to everyone sharing it. Ticking off counts as bought (for “Recently bought” and “Due again soon”), bringing an item back from the cart undoes that. Deleting by swiping does not count as bought.
- **What belongs to whom:** remembered quantities belong to the list and apply to everyone sharing it. Language, "remember quantity", "who added it", custom units and the look belong to the account. View, ticking off (cart or strike through), text sizes and spacing only apply to the device.
- **Catalog and templates** apply to all accounts and all lists. Any account may change individual products and categories. "Delete everything", "Restore default", export and import and the backups are reserved for the administrator.
- **Lists** are only visible to their members. Only the person who created a list can share, rename and delete it. When an account is deleted, its lists go to the administrator so nothing is lost.
- **Signing in:** a device stays signed in for 180 days as long as it is used. Changing your password signs out all your other devices. When the administrator sets a new password for an account, all devices of that account are signed out. Renaming keeps them signed in.
- **Limits:** at most 50 accounts, at most 30 own lists per account.
- **Behind a proxy** (such as Cloudflare or a reverse proxy in front), all requests look to Kaufen as if they came from the same address. The throttling against password guessing then counts for everyone together. Per name it still applies separately.

## ☕ Support

Kaufen is free and made in my spare time, on my own hardware and electricity bill. If it saved you time and you'd like to say thanks, you can [drop a little something in the tip jar on Ko-fi](https://ko-fi.com/burnersen), it keeps motivation and coffee flowing. ☕ Completely optional, and either way: thank you for using it!

## License

GNU Affero General Public License v3.0, see [LICENSE](LICENSE).
