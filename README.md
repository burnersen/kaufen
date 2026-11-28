# Kaufen

**Deutsch** · [English](README.en.md)

[![PHP 7.4+](https://img.shields.io/badge/PHP-7.4%2B-777BB4?logo=php&logoColor=white)](#voraussetzungen)
[![Lizenz: AGPLv3](https://img.shields.io/badge/Lizenz-AGPLv3-blue)](#lizenz)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Unterst%C3%BCtze%20mich-FF5E5B?logo=kofi&logoColor=white)](https://ko-fi.com/burnersen)

**[⬇️ Neuestes Release herunterladen](../../releases/latest)** · **[🌐 Webseite](https://tech.burnersen.de/tools/kaufen/)** · **[☕ Spendier mir einen Kaffee](https://ko-fi.com/burnersen)**

<sub>🇬🇧 In English: [tech.burnersen.de/en/tools/kaufen-en](https://tech.burnersen.de/en/tools/kaufen-en/)</sub>

Gemeinsame Einkaufslisten zum Selbsthosten. Auf dem Server laufen PHP und SQLite, im Browser schlichtes JavaScript und CSS. Keine Frameworks, keine Abhängigkeiten, kein Build-Schritt, kein MySQL. Läuft auf einfachem Webspace und wird mit einer einzigen Datei installiert.

Produkte tippt man aus einem fertigen Katalog an, sortiert nach Warengruppen. Im Laden tippt man sie wieder an, dann bleiben sie abgehakt und durchgestrichen stehen, und zwar bei allen, die die Liste teilen. Was ihr regelmäßig kauft, schlägt Kaufen rechtzeitig wieder vor oder setzt es auf Wunsch von allein auf die Liste.

`kaufen-install.php` hochladen, im Browser öffnen, erstes Konto anlegen. Das ist die ganze Installation.

Wer gar nichts auf einem Server haben will, tippt auf der Anmeldeseite auf **„Ohne Konto nutzen, nur auf diesem Gerät“**. Dann bleiben alle Listen auf dem eigenen Handy oder Rechner, siehe [Lokaler Modus](#nur-auf-diesem-gerät-lokaler-modus).

<p align="center">
  <img src="docs/de/liste.png" alt="Die Einkaufsliste als Kacheln mit Farbverlauf, Symbol und Zähler je Warengruppe, Mengen, Hinweisen und darunter „Bald wieder fällig“" width="320">
</p>

<table>
  <tr>
    <td align="center" width="33%"><img src="docs/de/listenansicht.png" alt="Die Listen-Ansicht: Warengruppen auf einer Karte, Kreise zum Abhaken, Abgehaktes bleibt durchgestrichen an seinem Platz" width="250"><br><sub>Liste: Abgehaktes bleibt durchgestrichen stehen</sub></td>
    <td align="center" width="33%"><img src="docs/de/groesse.png" alt="Schrift, Größe und Abstände: Vorschau, darunter Höhe der Einträge und Abstand dazwischen" width="250"><br><sub>Höhe der Einträge und Abstände einstellen</sub></td>
    <td align="center" width="33%"><img src="docs/de/symbol.png" alt="Symbol einer Warengruppe wählen: eigenes Bild, Emoji, Standard oder keins" width="250"><br><sub>Eigenes Symbol je Warengruppe</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/de/ohne-konto.png" alt="Die Anmeldeseite mit dem Link „Ohne Konto nutzen, nur auf diesem Gerät“" width="250"><br><sub>Ohne Konto, nur auf dem Gerät</sub></td>
    <td align="center" width="33%"><img src="docs/de/lokal.png" alt="Einstellungen im lokalen Modus: Sicherung als Datei und Lokalen Modus beenden" width="250"><br><sub>Lokaler Modus</sub></td>
    <td align="center" width="33%"><img src="docs/de/drucken.png" alt="Drucken und Teilen: Vorschau des Zettels, darunter Schriftart, Schriftgröße, Zeilenabstand und Spalten" width="250"><br><sub>Zettel einstellen, mit Vorschau</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/de/abgehakt.png" alt="Abgehaktes bleibt mit Haken und durchgestrichen an seinem Platz, darunter der Knopf „Einkauf fertig“" width="250"><br><sub>Abgehakt und durchgestrichen</sub></td>
    <td align="center" width="33%"><img src="docs/de/wischen.png" alt="Ein Eintrag in der Liste wird nach links gewischt, dahinter erscheint rot „Löschen“" width="250"><br><sub>Wischen: links löschen, rechts Menge</sub></td>
    <td align="center" width="33%"><img src="docs/de/warengruppe.png" alt="Nach langem Halten: Warengruppe wechseln oder neu anlegen" width="250"><br><sub>Halten: Warengruppe wechseln</sub></td>
  </tr>
  <tr>
    <td align="center" width="33%"><img src="docs/de/rechner.png" alt="Am Rechner: die Warengruppen der Liste in zwei Spalten nebeneinander" width="250"><br><sub>Am Rechner: zwei Spalten</sub></td>
    <td align="center" width="33%"><img src="docs/de/dunkel.png" alt="Dunkles Design in der Kachel-Ansicht" width="250"><br><sub>Dunkel, als Kacheln</sub></td>
    <td align="center" width="33%"><img src="docs/de/mehrere.png" alt="Vorschau, wenn man mehrere Produkte auf einmal eintippt" width="250"><br><sub>Mehrere auf einmal, mit Vorschau</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/de/menge.png" alt="Menge wählen: Zähler, Einheiten, eigene Einheit, Hinweis" width="250"><br><sub>Menge, Einheit und Hinweis</sub></td>
    <td align="center"><img src="docs/de/faellig.png" alt="Bald wieder fällig, darunter der Katalog mit Symbolen" width="250"><br><sub>Bald wieder fällig</sub></td>
    <td align="center"><img src="docs/de/einstellungen.png" alt="Einstellungen: Sprache, Ansicht, Schrift, zehn Designs" width="250"><br><sub>Einstellungen</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/de/farbmischer.png" alt="Farbmischer für das eigene Design" width="250"><br><sub>Farbmischer fürs eigene Design</sub></td>
    <td align="center"><img src="docs/de/menue.png" alt="Das Menü" width="250"><br><sub>Menü</sub></td>
    <td align="center"><img src="docs/de/sicherung.png" alt="Sicherung und Update für den Administrator" width="250"><br><sub>Sicherung und Update</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/de/einfuegen.png" alt="Aus Text einfügen, mit Vorschau, was erkannt wurde" width="250"><br><sub>Aus Text einfügen</sub></td>
    <td align="center"><img src="docs/de/zettel.png" alt="Der Einkaufszettel als PDF: zwei Spalten, Kästchen zum Abhaken" width="250"><br><sub>Der Zettel zum Ausdrucken</sub></td>
    <td align="center"><img src="docs/de/kompakt.png" alt="Derselbe Zettel kompakt: Schrift Klassisch, drei Spalten, enger Zeilenabstand" width="250"><br><sub>Derselbe Zettel kompakt</sub></td>
  </tr>
</table>

<sub>Screenshots von Version 1.11.1 bis 1.16.0. Namen und Einträge sind erfunden.</sub>

> 💜 **Gefällt dir Kaufen?** Ein ⭐ auf GitHub ist die einfachste Art, mir das zu sagen, und es bringt mehr, als man denkt: Sterne sind der sichtbare Beweis, dass ein Projekt gute Arbeit leistet, und genau darüber finden andere kleine Projekte wie dieses überhaupt erst Leute. Oder [erzähl mir, wofür du es nutzt](https://github.com/burnersen/kaufen/issues/new), ich lese jede Nachricht. Danke, dass du da bist!

## Inhalt

[So funktioniert's](#so-funktionierts) · [Funktionen](#funktionen) · [Voraussetzungen](#voraussetzungen) · [Installation](#installation) · [Daten schützen](#daten-schützen) · [Aktualisieren](#aktualisieren) · [Sichern und Zurückholen](#sichern-und-zurückholen) · [Aufbau](#aufbau) · [Gut zu wissen](#gut-zu-wissen) · [Lizenz](#lizenz)

## So funktioniert's

1. **Auf die Liste:** Produkte im Katalog antippen oder oben eintippen, auch mehrere auf einmal („Milch, 2 kg Äpfel und Brot“). Alle, die die Liste teilen, sehen es nach ein paar Sekunden.
2. **Im Laden abhaken:** Eintrag antippen, dann bleibt er mit Haken durchgestrichen an seinem Platz stehen, wie auf dem Zettel. Vertippt? Zwei Tipps innerhalb von 2 Sekunden holen ihn zurück.
3. **Fertig:** „Einkauf fertig“ unter der Liste nimmt nach einer Sicherheitsfrage alles Abgehakte runter. Was noch fehlt, bleibt für den nächsten Laden auf der Liste.

| Geste | Auf der Liste | Im Katalog |
|---|---|---|
| Antippen | abhaken, es bleibt durchgestrichen stehen (zurückholen: zweimal tippen) | auf die Liste setzen oder wieder runternehmen |
| Nach links wischen | ganz löschen, ein paar Sekunden lang mit „Rückgängig“ | |
| Nach rechts wischen | Menge und Hinweis | |
| Halten | Warengruppe wechseln (etwa eine Sekunde, ein Ring zeigt es an) | Menge und Hinweis (eine halbe Sekunde) |
| Am Rechner | mit gedrückter Maus ziehen statt wischen, Rechtsklick statt halten | Rechtsklick statt halten |

**Kurz erklärt in der App:** Menü → Hilfe zeigt die Bedienung auf einen Blick, mit allen Gesten. Beim ersten Start weist ein kleiner Kasten einmal darauf hin.

**Ohne Server:** Im [lokalen Modus](#nur-auf-diesem-gerät-lokaler-modus) funktioniert alles genauso, nur dass die Listen nie das Gerät verlassen.

## Funktionen

### Einkaufen

- **Katalog** mit rund 810 Produkten in 16 Warengruppen, in der Reihenfolge eines typischen Supermarkts. Nur Text, keine Bilder.
- **Antippen** setzt ein Produkt auf die Liste. Antippen in der Liste hakt es ab: es bleibt mit Haken und durchgestrichen an seinem Platz stehen, wie auf dem Zettel. Zwei Tipps innerhalb von 2 Sekunden holen es zurück, ein einzelner Tipp aus Versehen holt nichts zurück. Wer die Liste teilt, sieht sofort, was schon im Wagen liegt.
- **Einkauf fertig:** der Knopf unter der Liste nimmt nach einer Sicherheitsfrage alles Abgehakte runter. Was noch zu kaufen ist, bleibt auf der Liste, etwa für einen anderen Laden. Von allein verschwindet nichts.
- **Wischen wie bei Mails:** einen Eintrag nach links wischen löscht ihn ganz von der Liste (ein paar Sekunden lang mit „Rückgängig“), nach rechts wischen öffnet Menge und Hinweis. Klappt in beiden Ansichten. Am Rechner geht es mit gedrückter Maus.
- **Warengruppe mal eben ändern:** einen Eintrag der Liste etwa eine Sekunde halten (am Rechner: Rechtsklick), um ihn wächst dabei ein Ring. Dann eine andere Warengruppe antippen, z. B. Pflaumen im Glas zu den Konserven statt zum Obst. Das gilt nur für diesen Eintrag, auf Wunsch auch dauerhaft im Katalog. Eine neue Warengruppe lässt sich gleich dort anlegen.
- **Suche** über den ganzen Katalog, in beiden Sprachen: „milk“ findet auch Milch. Gibt es ein Produkt nicht, legt man es direkt aus der Suche an und ordnet es einer Warengruppe zu. Die passende Warengruppe schlägt Kaufen am Wortende vor: „Bergkäse“ landet bei Milch & Käse, „Hundefutter“ bei Tierbedarf.
- **Mehrere auf einmal, auch per Sprache:** „Milch, 2 kg Äpfel und ein halbes Brot“ ins Suchfeld tippen oder diktieren, Enter, und alles steht auf der Liste. Getrennt wird an Komma, „und“ oder Zeilenende, ohne Kommas („Milch Brot Äpfel Sahne“) zerlegt der Katalog die Wörter. Mengen dürfen davor oder dahinter stehen, in Ziffern oder Worten. Schon beim Tippen zeigt eine Vorschau, was erkannt wurde.
- **Wann zuletzt gekauft:** was in den letzten zwei Wochen gekauft wurde, sagt es an der Kachel dazu („vor 3 Tagen“), beim langen Drücken mit Datum, wie oft und etwa wie regelmäßig.
- **Bald wieder fällig:** beim Abhaken lernt Kaufen, wie oft ihr etwas kauft (Milch etwa alle 7 Tage). Schon nach dem zweiten Kauf steht es kurz vor dem nächsten Mal unter der Liste zum Antippen bereit. Bis zu 16 Vorschläge, „Alle anzeigen“ klappt den Rest auf. Ab dem wievielten Kauf vorgeschlagen wird (2., 3. oder 4.), stellt jeder in den Einstellungen ein. Lang drücken auf einen Vorschlag schaltet ihn für dieses Produkt ab. Alles bleibt auf dem eigenen Server.
- **Regelmäßiges automatisch auf die Liste:** kauft ihr etwas 4 Wochen lang im gleichen Abstand (einstellbar: 4, 8 oder 12 Wochen, oder aus), setzt Kaufen es von allein auf die Liste, sobald es wieder fällig ist, und sagt kurz Bescheid. Pro Kauf nur einmal: wer es wieder löscht, bekommt es erst nach dem nächsten Kauf erneut. Lang drücken auf den Eintrag schaltet das für dieses Produkt ab.
- **Zwei Ansichten:** Kacheln (mit leichtem Farbverlauf in der Akzentfarbe) oder Liste (schlichte Zeilen auf einer Karte, je Warengruppe eine Überschrift, links ein Kreis zum Abhaken, die Menge als Pille rechts). Am Rechner und auf dem Tablet quer stehen die Warengruppen in zwei Spalten nebeneinander.
- **Symbole und Zähler an den Warengruppen:** jede mitgelieferte Warengruppe hat ein Symbol (🥦, 🥖, 🧀 …), rechts steht, wie viel dort noch fehlt, ✓ wenn alles abgehakt ist. Unter Menü → Katalog verwalten → Ändern → Symbol lässt sich ein eigenes Bild (aus Fotos oder Dateien, etwa per KI erzeugt, es wird auf 96 × 96 Pixel verkleinert) oder ein Emoji wählen, oder gar keins.
- **Abhaken mit kleiner Animation:** der Strich zieht sich durch, der Kreis hüpft kurz. Reines CSS, bei „Bewegung reduzieren“ im System aus. Ist die Liste leer, zeigt ein großer Haken „Alles erledigt“. Von Haus aus startet Kaufen in der Listen-Ansicht, sie kommt einem Einkaufszettel am nächsten. Umschaltbar mit dem Knopf oben rechts, gemerkt pro Gerät und für jede Liste einzeln. Die Farben kommen wie überall aus dem gewählten Design.
- **Ohne Netz weiter einkaufen:** die App startet auch ohne Empfang, Änderungen werden gesammelt und nachgereicht.
- **Bildschirm bleibt an**, solange die App offen ist (abschaltbar).
- **Hilfe in der App:** Menü → Hilfe erklärt kurz und knapp Tippen, Wischen und Halten, Mengen, den Einkauf im Laden und was oben und im Menü steckt.

### Mengen und Hinweise

- **Menge oder Hinweis:** auf der Liste nach rechts wischen, im Katalog lange drücken (am Rechner: Rechtsklick). Im Zähler steht erst einmal 1, ohne Einheit. Mit Plus und Minus einstellen, bei Bedarf eine Einheit antippen (Stück, Packung, Liter, kg …) und einen Hinweis dazuschreiben. Eine schlichte 1 wird an der Kachel nicht eigens angezeigt, eine Zahl ohne Einheit steht groß als „3×“ da. Halbe gehen auch: „2,5“ oder „2 1/2“ tippen oder den Knopf ½ drücken, angezeigt wird 2½.
- **Einzahl und Mehrzahl auf einem Knopf:** „Glas“ steht bei 1 da, ab 2 heißt derselbe Knopf „Gläser“. Diktieren und Tippen verstehen beide Formen, „eine Kiste Wasser“ genauso wie „zwei Kisten Wasser“.
- **Mehr Einheiten:** neben Stück, Packung, Liter, kg und Co. gibt es Kiste, Kasten, Becher, Beutel, Tüte, Netz, Schale, Rolle, Tafel, Tube, Sack, Scheibe, Kopf, Zehe, Würfel, Stange und Portion. In den Einstellungen legst du fest, welche bei der Mengenauswahl immer dastehen, der Rest wartet unter „Weitere …“.
- **Eigene Einheiten:** z. B. „Eimer“ legt jedes Konto selbst an, mit Einzahl und Mehrzahl, direkt in der Mengenauswahl oder in den Einstellungen. Die Mehrzahl wird vorgeschlagen (Kanne wird Kannen). Umbenennen und löschen geht an beiden Stellen. Schon gespeicherte Mengen bleiben dabei als Text stehen.
- **Menge merken:** beim Abhaken merkt sich Kaufen, was am Produkt stand. Fünfmal Cola gekauft, dann steht beim nächsten Mal wieder „5“ da, schon an der Kachel zu sehen, und ein Tipp setzt es genauso auf die Liste. Jedes Konto kann das in den Einstellungen abschalten, dann steht immer 1 da. „Menge zurücksetzen“ vergisst die gemerkte Menge eines Produkts.

### Gemeinsam einkaufen

- **Abgleich zwischen allen Geräten:** eigene Änderungen gehen sofort an den Server. Nur solange Kaufen offen und zu sehen ist und gerade nichts passiert, fragt das Gerät alle paar Sekunden nach, ob sich etwas geändert hat. Der Abstand ist für den Administrator einstellbar (1 bis 60 Sekunden, voreingestellt 5).
- **Mehrere Listen:** jeder kann eigene Listen anlegen und mit beliebigen Konten teilen. Wer eingeladen wurde, kann eine Liste auch wieder verlassen.
- **Wer war's:** in geteilten Listen steht am Produkt, wer es draufgesetzt hat. Jedes Konto kann das in den Einstellungen ausblenden.
- **Mitteilungen aufs Handy:** wer möchte, bekommt eine Mitteilung, wenn jemand etwas auf eine geteilte Liste setzt. Jedes Konto schaltet das pro Gerät in den Einstellungen ein oder aus. Gebündelt statt einzeln: drei Produkte ergeben eine Mitteilung, und zwar in dem Moment, in dem der andere Kaufen verlässt. Abhaken im Laden meldet nichts.
- **Einkaufszettel als PDF:** für die Tage, an denen das Handy zu Hause bleibt. Nach Warengruppen in der Reihenfolge des eigenen Ladens, vor jedem Eintrag ein Kästchen zum Abhaken mit dem Kuli. Schlicht schwarzweiß, druckt also auf jedem Drucker gut. Unten auf Wunsch leere Zeilen „Noch dazu“ zum Dazuschreiben, eine leere Liste ergibt einen leeren Zettel. Am Handy geht das PDF übers Teilen direkt zum Drucker. Erstellt wird es im Browser, ohne fremde Bibliothek und auch ohne Netz.
- **Zettel nach Wunsch:** Schriftart (Klar, Klassisch oder Schreibmaschine), Schriftgröße, Zeilenabstand von eng bis weit und 2 oder 3 Spalten. Oben im Fenster zeigt eine Vorschau genau, was aus dem Drucker kommt, und ändert sich beim Einstellen sofort mit. Antippen macht sie groß. Eng und mit 3 Spalten passt ein großer Wocheneinkauf auf eine halbe Seite. Gemerkt wird das pro Gerät.
- **Liste als Text:** was noch zu kaufen ist, geht als schlichter Text an WhatsApp, Mail und Co., in die Zwischenablage oder als Textdatei, für Leute ohne Konto. Beides steht unter Menü → Drucken und Teilen. Was schon abgehakt ist, bleibt bei Zettel und Text draußen.
- **Aus Text einfügen:** Text reinkopieren oder eine Textdatei öffnen, und alles landet auf der offenen Liste. Kaufen versteht den eigenen Export, Listen mit Spiegelstrichen, Kästchen oder Nummern und freien Text wie „Milch, 2 kg Äpfel und Brot“. Vorher zeigt eine Vorschau, was erkannt wurde. Was schon auf der Liste steht, kommt nicht doppelt drauf, abgehakte Zeilen ([x]) bleiben weg.
- **Reihenfolge im Laden:** die Warengruppen lassen sich pro Liste so sortieren, wie der eigene Laden aufgebaut ist.
- **Vorlagen:** „Grillen“ oder „Frühstück“ setzt mit einem Tipp mehrere Produkte auf die Liste. Auch die aktuelle Liste lässt sich als Vorlage speichern.

### Nur auf diesem Gerät (lokaler Modus)

Für alle, die ihre Listen auf keinem Server haben wollen. Es ist dieselbe App mit allen Funktionen und allen künftigen Verbesserungen, nur dass ein kleiner „Server“ im Browser die Arbeit macht.

- **Ohne Konto:** auf der Anmeldeseite „Ohne Konto nutzen, nur auf diesem Gerät“ antippen, dann aufs Handy legen (siehe [Aufs Handy](#aufs-handy)). Fertig, ohne Anmeldung.
- **Mit Konto umschalten:** Einstellungen → „Lokalen Modus einschalten“. Listen, Katalog, Vorlagen und Aussehen werden aufs Gerät kopiert, danach meldet sich das Gerät vom Server ab.
- **Alles bleibt auf dem Gerät:** kein Abgleich, keine Mitteilungen, keine Liste geht ins Netz. Kaufen startet aus dem Speicher des Geräts, auch im Flugmodus. Die einzige Verbindung: ab und zu schaut der Browser nach, ob es eine neue Version von Kaufen gibt, und holt sie sich. Dabei gehen keine Daten raus.
- **Was fehlt:** Listen mit anderen teilen, Konten und Mitteilungen. Weitergeben geht per PDF oder Text.
- **Sicherung als Datei:** im Menü. Speichert alle Listen, den Katalog, die Vorlagen und das Aussehen in einer Datei und spielt sie wieder ein. Wichtig, denn wer die Browserdaten löscht, ist sonst alles los.
- **Zurück:** Menü → „Lokalen Modus beenden“ führt zur Anmeldung. Danach fragt Kaufen, ob die lokalen Listen ins Konto sollen. Gibt es dort eine Liste mit gleichem Namen, kommt alles dorthin, ohne Doppelte.
- **Für den Betreiber:** wer den Link auf seinem Server nicht will, trägt in `data/config.php` den Eintrag `'local' => false` ein. Wer ihn nutzt, bekommt von deinem Server nur die Programmdateien und den mitgelieferten Katalog, nie Daten von dir oder anderen.

### Demo-Modus (für einen öffentlichen Server zum Ausprobieren)

Für alle, die Kaufen anderen zum Ausprobieren anbieten wollen, ohne dass sich jemand anmelden muss. **Für die eigene Installation ist das nichts.**

- **Einschalten:** frisch installieren, erstes Konto anlegen, dann Einstellungen → „Demo-Modus einschalten …“. Danach kommen zwei Warnungen und zum Schluss eine Rechenaufgabe. Erst die richtige Lösung schaltet ihn ein, bei einer falschen bleibt alles, wie es ist.
- **Was dann passiert:** Alle werden abgemeldet. Anmeldeseite, Konten, geteilte Listen und Mitteilungen gibt es nicht mehr. Jeder, der die Seite öffnet, landet sofort im lokalen Modus, alles bleibt auf seinem Gerät.
- **Home-Bildschirm:** Besucher sehen oben einen Hinweis, wie sie Kaufen auf den Home-Bildschirm legen (iPhone und iPad, Android, Safari am Mac und andere Rechner je passend erklärt), und dass dann alles nur lokal bleibt. Im selben Kasten steht, dass man Kaufen selbst hosten und dann auch Listen teilen kann, mit Link zur Anleitung.
- **Unten:** ein kurzer Satz, dass es eine Demo ist, und zwei gut sichtbare Knöpfe zu tech.burnersen.de und zu Kaufen auf GitHub.
- **Updates von allein:** Der Server schaut höchstens einmal pro Stunde nach einer neuen Version und spielt sie ohne Nachfrage ein, nachdem die Seite ausgeliefert ist. Die Geräte holen sie sich danach beim nächsten Öffnen.
- **Kein Zurück in der App.** Wer sich vertan hat: per FTP in `data/config.php` die Zeile `'demo' => true` löschen. Konten und Listen liegen dann wieder so da wie vorher.

### Sprache und Aussehen

- **Deutsch und Englisch:** jedes Konto wählt seine Sprache in den Einstellungen, ein deutsches Gerät startet deutsch, alle anderen englisch. Übersetzt ist alles, auch der Katalog. In einer geteilten Liste sieht die eine „Milch“ und der andere „Milk“, es bleibt derselbe Eintrag.
- **Zehn Designs und eigene Farben:** fünf helle und fünf dunkle Farbwelten, dazu je ein eigenes Design aus dem Farbmischer (Regler oder Farbwähler, mit Vorschau). Gewählt wird nur die Akzentfarbe, alles andere stimmt Kaufen darauf ab, für hell und dunkel je eigens: Hintergrund und Kacheln mit einem Hauch vom Farbton, gut lesbare Schrift, Überschriften und Nebentext, Listenschrift und Menge auf dem Akzent und der Haken am Knopf „Einkauf fertig“. Jede dieser Farben lässt sich trotzdem selbst einstellen, ein „A“ zeigt, was automatisch ist, „Automatisch“ und „Alles automatisch“ holen es zurück. Änderst du Hintergrund oder Kacheln, gehen alle Schriften mit und bleiben gut lesbar, auch selbst gewählte (ihr Farbton bleibt, nur die Helligkeit rückt nach). Ist der Akzent sehr hell (im hellen Design) oder sehr dunkel (im dunklen), bleiben Ränder, Haken und Schrift in Akzentfarbe trotzdem gut sichtbar. Wer will, sieht beim Ziehen an einem Regler statt der Vorschau die echte Liste. Bei „Wie das Gerät“ wechselt Kaufen automatisch zwischen dem hellen und dem dunklen Favoriten. Das Aussehen gehört zum Konto und gilt auf allen Geräten.
- **Meine Designs:** das Design, das gerade zu sehen ist (hell oder dunkel, fertig oder eigenes), lässt sich unter Einstellungen → „Aktuelles Design speichern …“ mit Namen im Konto ablegen, bis zu 30 Stück. Sie stehen auf allen Geräten neben den fertigen Designs zur Auswahl, im hellen wie im dunklen Modus, egal wo sie gespeichert wurden. Im Farbmischer lässt sich auch von einem eigenen Design ausgehen, ein helles ergibt dort im Mischer für dunkel automatisch eine dunkle Variante mit demselben Akzent. Unter „Meine Designs …“ lassen sie sich umbenennen, überschreiben, im Farbmischer bearbeiten, löschen, als Datei exportieren und wieder importieren.
- **Jede Liste und jede Ansicht ihr eigenes Aussehen:** Schrift, hell oder dunkel, Design und Farben gelten für die offene Liste in der Ansicht, die gerade zu sehen ist. Die Ansicht selbst merkt sich jede Liste. Der Einkaufszettel als helle Liste und in den Kacheln dunkel mit großer Schrift, der Baumarkt ganz anders. Jeder Nutzer stellt das für sich ein, in geteilten Listen sieht jeder sein eigenes Aussehen. „Für alle Listen und Ansichten übernehmen“ in den Einstellungen macht das, was gerade zu sehen ist, zum Standard für alles.
- **Durchsichtig nur beim Schieben:** wer „Beim Ziehen am Regler die echte Liste zeigen“ eingeschaltet hat, sieht die Liste erst, wenn ein Regler waagerecht geschoben wird. Senkrecht wischen rollt das Fenster ganz normal, auch wenn der Finger auf einem Regler landet.
- **Schrift, Größe und Abstände:** in den Einstellungen pro Gerät, Liste und Ansicht, Schriftgrößen für alles zusammen oder einzeln für Überschriften, Produktnamen, Menge, Anzahl und Hinweis, dazu wie fett die Anzahl ist. Dazu die Höhe der Einträge (Kacheln, Schildchen und Zeilen, von 60 bis 180 %) und der Abstand dazwischen (0 bis 300 %), in allen Ansichten. Mit Vorschau in der gewählten Ansicht, auf Wunsch beim Ziehen auch direkt an der echten Liste.
- **Als App installierbar** (PWA), mit eigenem Symbol auf dem Startbildschirm.

### Verwalten

- **Katalog verwalten:** Produkte und Warengruppen anlegen, umbenennen, verschieben, löschen. Ein Suchfeld filtert den Katalog, Enter legt das Gesuchte neu an, wenn es noch fehlt. Der Administrator kann den ganzen Katalog als CSV oder JSON exportieren, bearbeiten und wieder importieren, jeweils mit deutschem und englischem Namen. Er kann auch alles löschen und den Standard wiederherstellen. Vor jeder großen Änderung wird automatisch gesichert, die letzten 10 Stände lassen sich zurückholen.
- **Konten:** das erste Konto ist der Administrator. Er legt die anderen an und kann ihre Namen und Passwörter jederzeit ändern oder Konten löschen. Eine offene Registrierung gibt es nicht.
- **Sicherung und Update** (Administrator, im Menü): die ganze Datenbank als eine Datei herunterladen und wieder einspielen, der vorige Stand bleibt zum Zurückholen. Updates per Knopfdruck: Kaufen schaut beim neuesten Release auf GitHub nach, prüft die Datei per Prüfsumme, sichert die laufende Version und spielt die neue ein. Zurück zur vorigen Version geht mit einem Tipp. Auf Wunsch sieht Kaufen einmal am Tag selbst nach.
- **Bremse gegen das Durchprobieren von Passwörtern:** nach 5 falschen Versuchen für einen Namen (oder 20 von einer Adresse) muss man warten, erst 30 Sekunden, bei weiteren Fehlversuchen immer länger, höchstens eine Stunde.

## Voraussetzungen

- PHP 7.4 oder neuer (empfohlen 8.x) mit der Erweiterung `pdo_sqlite`
- Ein Webserver mit PHP. **Apache** (und LiteSpeed) sperren die internen Ordner von selbst über `.htaccess`, sofern der Webspace `.htaccess`-Dateien beachtet, was bei fast jedem Hoster der Fall ist. **nginx** und andere Server brauchen zwei Zeilen in der Konfiguration, siehe [Daten schützen](#daten-schützen).
- **HTTPS.** Ohne HTTPS geht das Passwort im Klartext durchs Netz, und die App lässt sich nicht aufs Handy installieren.
- Für Mitteilungen aufs Handy zusätzlich: die Erweiterung `openssl`, dazu `curl` oder `allow_url_fopen`, und der Webspace muss ausgehende Verbindungen erlauben. Fehlt etwas davon, läuft Kaufen ganz normal, nur ohne Mitteilungen. Dasselbe gilt für die Updates per Knopfdruck.

## Installation

1. Aus dem [neuesten Release](../../releases/latest) die Datei `kaufen-install.php` herunterladen und in ein Verzeichnis auf dem Webserver kopieren.
2. PHP muss in dieses Verzeichnis schreiben dürfen (es legt dort `index.php`, den Ordner `app/` und später `data/` an).
3. `kaufen-install.php` **sofort** im Browser aufrufen und auf „Jetzt installieren“ klicken. Die Datei packt das Programm aus, löscht sich selbst und leitet weiter. Dort das erste Konto anlegen. Dieses Konto ist der Administrator. Meldet der Installer, dass er sich nicht löschen konnte, die Datei bitte von Hand löschen.
4. **Prüfen, dass die internen Ordner von außen gesperrt sind** (wichtig, siehe [Daten schützen](#daten-schützen)): `https://deine-adresse/data/config.php` und `https://deine-adresse/app/routes/api.php` aufrufen. Beide müssen „403 Forbidden“ zeigen (oder „404 Not Found“). Eine leere weiße Seite heißt: die Sperre greift nicht.
5. Im Menü unter *Konten* die weiteren Konten anlegen und dabei gleich in die gemeinsame Liste einladen.

> ⚠️ Wer ein frisch hochgeladenes, noch nicht eingerichtetes Kaufen als Erster aufruft, wird Administrator. Schritt 3 also direkt nach dem Hochladen erledigen.

**Lieber von Hand?** Im Release liegt auch `kaufen-<Version>.zip`. Entpacken und den Inhalt des Ordners `kaufen/` hochladen, also `index.php` **und** den Ordner `app/`. Danach weiter mit dem ersten Aufruf im Browser und Schritt 4.

### Aufs Handy

Die Adresse im Browser öffnen, anmelden (oder „Ohne Konto nutzen“), dann im Browser-Menü „Zum Startbildschirm hinzufügen“ (iPhone: Teilen → „Zum Home-Bildschirm“). Danach startet Kaufen wie eine App. Am Rechner bieten Chrome und Edge in der Adresszeile „Installieren“ an.

## Daten schützen

Im Ordner `data/` liegt alles, was schützenswert ist: die Datenbank mit Konten, Listen und Einstellungen, dazu der Schlüssel für die Mitteilungen. Kaufen tut einiges dafür, dass niemand da rankommt. Ein paar Dinge liegen aber in deiner Hand.

**1. Die internen Ordner sperren.** Unter Apache legt Kaufen die nötigen `.htaccess`-Dateien selbst an. Unter **nginx** gehören diese zwei Zeilen in den `server`-Block der Seite. Das `^~` ist wichtig: es sorgt dafür, dass die Sperre Vorrang vor der Regel für `.php`-Dateien hat. Ohne würde nginx `data/config.php` trotzdem an PHP weiterreichen:

```nginx
# Kaufen liegt hier im Ordner /kaufen/. Liegt es direkt im Hauptverzeichnis, /kaufen weglassen.
location ^~ /kaufen/data/ { deny all; }
location ^~ /kaufen/app/  { deny all; }
```

Vorher die Konfiguration sichern, danach testen und neu laden:

```sh
# Sicherung der Konfiguration (Pfad je nach System, oft /etc/nginx/sites-available/)
sudo cp -a /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak

# Prüfen und neu laden
sudo nginx -t && sudo systemctl reload nginx

# Falls etwas schiefgeht: zurückholen und neu laden
sudo cp -a /etc/nginx/sites-available/default.bak /etc/nginx/sites-available/default && sudo systemctl reload nginx
```

Danach den Test aus [Installation, Schritt 4](#installation) wiederholen. Kaufen braucht keinen direkten Zugriff auf `app/`, auch CSS und JavaScript laufen über `index.php`.

Greift die Sperre einmal nicht, ist die Datenbank trotzdem nicht einfach abrufbar: Sie hat einen zufälligen Namen, der nur in `data/config.php` steht, und eine `.php`-Datei kann man von außen nicht herunterladen. Verlassen sollte man sich darauf aber nicht.

**2. Sicherungen gut aufheben.** Die Sicherung aus dem Menü ist die komplette Datenbank: alle Konten (Passwörter nur als Prüfsumme), alle Listen und der Schlüssel für die Mitteilungen. Sie gehört nicht in eine öffentliche Cloud-Freigabe, nicht in einen Chat und nicht zurück in den Webordner. Dasselbe gilt für den Ordner `data/` selbst, der gehört niemals in ein öffentliches Git-Repository.

**3. Starke Passwörter.** Mindestens 8 Zeichen sind Pflicht, mehr ist besser, vor allem fürs Administrator-Konto.

**4. Was nach außen geht.** Kaufen lädt nichts von fremden Servern nach, keine Schriften, keine Skripte, keine Statistik. Nur zwei Funktionen verbinden sich nach draußen, beide nur, wenn man sie nutzt:

- **Updates:** fragt bei GitHub nach der neuesten Version. Persönliches geht dabei nicht raus. Wer das gar nicht will, trägt in `data/config.php` den Eintrag `'update_url' => ''` ein.
- **Mitteilungen:** gehen vom eigenen Server an den Mitteilungsdienst des jeweiligen Browsers (Apple, Google, Mozilla, Microsoft). Der Inhalt ist für das Gerät verschlüsselt, der Dienst selbst kann ihn nicht lesen.

**5. Was nicht verschlüsselt ist.** Die Einkaufslisten liegen im Klartext in der Datenbank. Wer Zugriff auf den Webspace hat (also auch der Hoster), kann sie lesen. Wer das nicht will, nimmt den [lokalen Modus](#nur-auf-diesem-gerät-lokaler-modus): dann liegen die Listen gar nicht erst auf dem Server.

## Aktualisieren

**Ab Version 1.10.0 am einfachsten:** im Menü *Sicherung und Update* auf „Jetzt nach Updates suchen“ und dann „Jetzt aktualisieren“ tippen. Dafür muss PHP die Programmdateien überschreiben dürfen und Verbindungen nach außen aufbauen können (curl oder `allow_url_fopen`). Wer das nicht will, schaltet es in `data/config.php` mit `'update_url' => ''` ab.

Von Hand: den neuen `kaufen-install.php` hochladen und aufrufen. Ersetzt werden nur die Programmdateien, der Ordner `data/` bleibt unangetastet.

Vor einem Update schadet eine Sicherung nie, siehe nächster Abschnitt.

## Sichern und Zurückholen

**Am einfachsten im Menü** unter *Sicherung und Update*: „Sicherung herunterladen“ speichert die ganze Datenbank als eine Datei, „Sicherung einspielen …“ holt sie zurück. Der Stand vor dem Einspielen bleibt erhalten und lässt sich dort mit einem Tipp zurückholen.

**Von Hand per SSH** (im Verzeichnis von Kaufen). Die Sicherung landet im Home-Verzeichnis, also außerhalb des Webordners, damit sie niemand über den Browser abrufen kann. Am besten, während gerade niemand einkauft:

```sh
# Sicherung anlegen
cp -a data ~/kaufen-sicherung-$(date +%Y%m%d-%H%M)

# Zurückholen: den jetzigen Stand zur Seite legen (auch außerhalb des Webordners),
# dann die Sicherung einsetzen (Namen der Sicherung anpassen)
mv data ~/kaufen-data-vorher-$(date +%Y%m%d-%H%M) && cp -a ~/kaufen-sicherung-JJJJMMTT-HHMM data
```

Ohne SSH: den Ordner `data/` per FTP herunterladen und zum Zurückholen wieder hochladen. Die heruntergeladene Kopie gut aufheben, siehe [Daten schützen](#daten-schützen).

## Aufbau

```
index.php      Einstieg und Einstellungen (PHP)
app/lib/       Sprache, Datenbank, Konten und Anmeldung, Listen und Katalog, Standardkatalog, Mitteilungen, Sicherung und Update (PHP)
app/routes/    alle JSON-Aktionen (PHP)
app/views/     Anmeldeseite und Hauptseite (PHP/HTML)
app/assets/    die App im Browser (JavaScript, CSS), PDF-Einkaufszettel, lokaler Modus, englische Übersetzung, Symbole, Service Worker
data/          entsteht beim ersten Start, hier liegen Datenbank und Konten
tools/         baut die Release-Dateien (php tools/build-release.php)
```

Die Dateien in `app/` tun nichts, wenn man sie direkt aufruft, alles läuft über `index.php`. Unter Apache sperrt eine `.htaccess` den Ordner zusätzlich. Der Standardkatalog steht in `app/lib/catalog.php` und lässt sich dort anpassen. Die englischen Texte und Produktnamen stehen in `app/assets/i18n.js`, die englischen Meldungen des Servers in `app/lib/lang.php`.

## Gut zu wissen

- **Lokaler Modus am iPhone:** unbedingt über „Zum Home-Bildschirm“ installieren. Safari räumt die Daten von Webseiten, die eine Woche nicht benutzt wurden, sonst von selbst weg. Installierte Apps sind davon ausgenommen. Eine Sicherung als Datei schadet trotzdem nie.
- **Mitteilungen:** auf dem iPhone gehen sie nur, wenn Kaufen über „Zum Home-Bildschirm“ installiert ist (ab iOS 16.4), auf Android und am Rechner auch im Browser. Beim Einschalten schickt der Server eine Probe, so sieht man sofort, ob er den Mitteilungsdienst erreicht. Meldet sich ein Gerät beim Verlassen nicht ab (Funkloch), geht die Mitteilung rund drei Minuten nach der letzten Änderung raus, sobald irgendein Gerät Kaufen das nächste Mal offen hat.
- **Sprache:** der mitgelieferte Katalog liegt deutsch in der Datenbank und wird für englische Konten nur bei der Anzeige übersetzt. Selbst angelegte Produkte, Warengruppen und Vorlagen bleiben so, wie sie getippt wurden.
- **Abgehaktes:** gehört zur Liste und gilt für alle, die sie teilen. Als gekauft zählt es erst mit „Einkauf fertig“ (für „vor 3 Tagen“, „Bald wieder fällig“ und das automatische Draufsetzen), und zwar mit dem Zeitpunkt des Abhakens. Löschen zählt nie als gekauft, auch nicht bei Abgehaktem.
- **Was wem gehört:** die gemerkten Mengen gehören zur Liste und gelten für alle, die sie teilen. Sprache, „Menge merken“, „Wer war's“, „Bald wieder fällig“ samt Automatik, eigene Einheiten und das Aussehen gehören zum Konto. Ansicht, Schriftgrößen und Abstände gelten nur für das jeweilige Gerät.
- **Katalog und Vorlagen** gelten für alle Konten und alle Listen. Einzelne Produkte und Warengruppen darf jedes Konto ändern, „Alles löschen“, „Standard wiederherstellen“, Export und Import sowie die Sicherungen sind dem Administrator vorbehalten.
- **Listen** sehen nur ihre Mitglieder. Teilen, umbenennen und löschen kann nur, wer die Liste angelegt hat. Wird ein Konto gelöscht, gehen seine Listen an den Administrator, damit nichts verloren geht.
- **Anmeldung:** ein Gerät bleibt 180 Tage angemeldet, solange es benutzt wird. Wer sein Passwort ändert, meldet alle anderen Geräte ab. Setzt der Administrator das Passwort eines Kontos neu, werden alle Geräte dieses Kontos abgemeldet. Beim Umbenennen bleiben sie angemeldet.
- **Grenzen:** höchstens 50 Konten, jedes Konto höchstens 30 eigene Listen.
- **Hinter einem Proxy** (etwa Cloudflare oder ein vorgeschalteter Server) sehen alle Anfragen für Kaufen aus, als kämen sie von derselben Adresse. Die Bremse gegen das Durchprobieren von Passwörtern zählt dann für alle zusammen. Pro Name gilt sie weiterhin einzeln.

## ☕ Unterstützen

Kaufen ist kostenlos und entsteht in meiner Freizeit, auf meiner eigenen Hardware und Stromrechnung. Wenn es dir Zeit gespart hat und du Danke sagen möchtest, kannst du [ein kleines Trinkgeld bei Ko-fi dalassen](https://ko-fi.com/burnersen), das hält Motivation und Kaffee am Laufen. ☕ Völlig freiwillig, und in jedem Fall: danke fürs Benutzen!

## ⚠️ Haftungsausschluss

Kaufen ist kostenlose Hobby-Software und wird **so, wie es ist, ohne jede Gewähr** bereitgestellt. Es ist mit Sorgfalt gebaut und getestet, die Nutzung erfolgt aber **auf eigene Gefahr**. Mach regelmäßig und vor jedem Update eine Sicherung aus dem Menü. Wer Kaufen auf einem eigenen Server betreibt, ist für diesen Server, seine Updates und Sicherungen selbst verantwortlich.

Wo diese Anleitung beschreibt, was Kaufen tut, prüft oder nie tut, steht dort, wie es gedacht und gebaut ist, keine Zusage und keine Garantie: Software kann Fehler haben, und Systeme, Dienste und andere Programme verhalten sich nicht immer wie erwartet. Soweit gesetzlich zulässig, haftet der Autor nicht für Schäden oder Datenverlust durch die Nutzung dieser Software. Siehe Abschnitte 15 und 16 der [Lizenz](LICENSE).

## Lizenz

GNU Affero General Public License v3.0, siehe [LICENSE](LICENSE).
