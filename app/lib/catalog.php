<?php
/* Kaufen – Standardkatalog: Warengruppen in der Reihenfolge eines typischen Supermarkts, darin die Produkte */
defined('KF_VERSION') || exit;

function kfDefaultCatalog(): array {
    $c = [
        'Obst & Gemüse' => 'Äpfel, Bananen, Birnen, Orangen, Mandarinen, Zitronen, Limetten, Trauben, Erdbeeren, Himbeeren, Heidelbeeren, Kirschen, Pfirsiche, Nektarinen, Pflaumen, Aprikosen, Kiwis, Mango, Ananas, Melone, Wassermelone, Avocado, Granatapfel, Tomaten, Cocktailtomaten, Gurke, Paprika, Zucchini, Aubergine, Möhren, Kartoffeln, Süßkartoffeln, Zwiebeln, Rote Zwiebeln, Frühlingszwiebeln, Knoblauch, Ingwer, Lauch, Sellerie, Brokkoli, Blumenkohl, Rosenkohl, Weißkohl, Rotkohl, Spitzkohl, Kohlrabi, Spinat, Feldsalat, Rucola, Eisbergsalat, Kopfsalat, Salatherzen, Radieschen, Rote Bete, Kürbis, Spargel, Bohnen, Erbsen, Mais, Champignons, Pilze, Fenchel, Chili, Petersilie, Schnittlauch, Basilikum, Dill, Koriander, Minze, Rosmarin, Thymian, Suppengrün, Nüsse, Datteln',
        'Brot & Gebäck' => 'Brot, Brötchen, Vollkornbrot, Toastbrot, Baguette, Ciabatta, Laugenbrezeln, Laugenstangen, Croissants, Knäckebrot, Zwieback, Fladenbrot, Wraps, Aufbackbrötchen, Burgerbrötchen, Hotdog-Brötchen, Rosinenbrötchen, Kuchen, Berliner, Hefezopf, Paniermehl',
        'Milch & Käse' => 'Milch, H-Milch, Hafermilch, Sojamilch, Mandelmilch, Butter, Margarine, Eier, Joghurt, Naturjoghurt, Fruchtjoghurt, Griechischer Joghurt, Skyr, Quark, Kräuterquark, Sahne, Schlagsahne, Saure Sahne, Schmand, Crème fraîche, Kochsahne, Buttermilch, Kefir, Frischkäse, Hüttenkäse, Käse, Gouda, Emmentaler, Bergkäse, Butterkäse, Camembert, Brie, Mozzarella, Feta, Parmesan, Reibekäse, Schmelzkäse, Halloumi, Ziegenkäse, Mascarpone, Ricotta, Pudding, Milchreis, Kakao, Tofu, Frischer Teig, Blätterteig, Pizzateig, Hefe',
        'Fleisch & Fisch' => 'Hackfleisch, Rinderhack, Hähnchenbrust, Hähnchenschenkel, Hähnchen, Putenbrust, Putenschnitzel, Schweineschnitzel, Schweinefilet, Kotelett, Gulasch, Rindersteak, Rinderbraten, Rouladen, Bratwurst, Wiener Würstchen, Bockwurst, Leberkäse, Speck, Schinkenwürfel, Kochschinken, Rohschinken, Salami, Aufschnitt, Lyoner, Mortadella, Putenbrustaufschnitt, Leberwurst, Teewurst, Mett, Frikadellen, Grillfleisch, Spareribs, Lachs, Räucherlachs, Forelle, Kabeljau, Seelachs, Thunfischsteak, Garnelen, Matjes, Fischstäbchen frisch',
        'Zutaten & Gewürze' => 'Mehl, Vollkornmehl, Zucker, Puderzucker, Brauner Zucker, Vanillezucker, Backpulver, Natron, Trockenhefe, Speisestärke, Gelatine, Kakaopulver, Schokostreusel, Kuvertüre, Mandeln gemahlen, Haselnüsse gemahlen, Kokosraspeln, Rosinen, Salz, Pfeffer, Paprikapulver, Curry, Kurkuma, Zimt, Muskat, Oregano, Kräuter der Provence, Kreuzkümmel, Chiliflocken, Lorbeerblätter, Gemüsebrühe, Rinderbrühe, Hühnerbrühe, Olivenöl, Sonnenblumenöl, Rapsöl, Essig, Balsamico, Apfelessig, Senf, Ketchup, Mayonnaise, Tomatenmark, Sojasauce, Worcestersauce, Tabasco, Grillsauce, Salatdressing, Pesto, Sambal Oelek, Kokosmilch, Semmelbrösel, Zitronensaft, Tortenguss, Sahnesteif',
        'Nudeln, Reis & Co.' => 'Spaghetti, Penne, Fusilli, Tagliatelle, Lasagneplatten, Spätzle, Tortellini, Gnocchi, Schupfnudeln, Suppennudeln, Asia-Nudeln, Reis, Basmatireis, Risottoreis, Couscous, Bulgur, Quinoa, Polenta, Linsen, Rote Linsen, Kichererbsen getrocknet, Kartoffelpüree, Knödel, Tomatensauce, Passierte Tomaten, Gehackte Tomaten',
        'Konserven & Fertiges' => 'Thunfisch, Mais Dose, Kidneybohnen, Weiße Bohnen, Kichererbsen, Erbsen und Möhren, Sauerkraut, Rotkohl Glas, Gewürzgurken, Oliven, Kapern, Artischocken, Getrocknete Tomaten, Champignons Dose, Ananas Dose, Pfirsiche Dose, Apfelmus, Ravioli, Eintopf, Dosensuppe, Tütensuppe, Instantnudeln, Würstchen Glas, Sardinen, Hering in Tomatensauce, Tortilla-Chips, Taco-Schalen, Tortillas',
        'Frühstück & Aufstrich' => 'Müsli, Haferflocken, Cornflakes, Granola, Porridge, Marmelade, Erdbeermarmelade, Honig, Nuss-Nougat-Creme, Erdnussbutter, Ahornsirup, Agavendicksaft, Kaffee, Kaffeebohnen, Kaffeepads, Kaffeekapseln, Espresso, Instantkaffee, Kaffeefilter, Tee, Schwarzer Tee, Grüner Tee, Kräutertee, Pfefferminztee, Früchtetee, Kamillentee, Kakaogetränkepulver, Kondensmilch, Chiasamen, Leinsamen, Trockenfrüchte',
        'Süßes & Snacks' => 'Schokolade, Zartbitterschokolade, Schokoriegel, Pralinen, Gummibärchen, Lakritz, Bonbons, Kaugummi, Kekse, Butterkekse, Waffeln, Lebkuchen, Chips, Flips, Salzstangen, Cracker, Erdnüsse, Cashewkerne, Studentenfutter, Popcorn, Müsliriegel, Reiswaffeln, Eis, Götterspeise',
        'Tiefkühl' => 'Tiefkühlpizza, Pommes, Kroketten, Rösti, Fischstäbchen, Schlemmerfilet, Tiefkühlgemüse, Tiefkühlspinat, Tiefkühlerbsen, Tiefkühlbeeren, Tiefkühlkräuter, Tiefkühlbrötchen, Chicken Nuggets, Frühlingsrollen, Lasagne tiefgekühlt, Eis am Stiel, Eiswürfel, Tiefkühllachs, Tiefkühlgarnelen, Blätterteig tiefgekühlt, Torte tiefgekühlt',
        'Getränke' => 'Wasser, Mineralwasser, Stilles Wasser, Apfelsaft, Orangensaft, Multivitaminsaft, Traubensaft, Tomatensaft, Apfelschorle, Cola, Cola Zero, Limonade, Orangenlimonade, Zitronenlimonade, Eistee, Energydrink, Tonic Water, Ginger Ale, Bitter Lemon, Sirup, Bier, Alkoholfreies Bier, Radler, Weizenbier, Rotwein, Weißwein, Rosé, Sekt, Prosecco, Aperitif, Gin, Wodka, Rum, Whisky, Likör, Smoothie',
        'Haushalt' => 'Toilettenpapier, Küchenrolle, Taschentücher, Servietten, Müllbeutel, Biomüllbeutel, Gefrierbeutel, Frischhaltefolie, Alufolie, Backpapier, Spülmittel, Spülmaschinentabs, Klarspüler, Spülmaschinensalz, Schwämme, Spülbürste, Putzlappen, Allzweckreiniger, Badreiniger, WC-Reiniger, Glasreiniger, Entkalker, Waschmittel, Colorwaschmittel, Weichspüler, Fleckenentferner, Staubsaugerbeutel, Batterien, Glühbirnen, Kerzen, Teelichter, Streichhölzer, Feuerzeug, Grillkohle, Grillanzünder, Küchenhandschuhe, Zahnstocher, Strohhalme',
        'Drogerie & Pflege' => 'Zahnpasta, Zahnbürste, Zahnseide, Mundspülung, Duschgel, Shampoo, Spülung, Seife, Flüssigseife, Deo, Bodylotion, Handcreme, Gesichtscreme, Sonnencreme, Lippenpflege, Rasierer, Rasierklingen, Rasierschaum, Haargel, Haarspray, Wattepads, Wattestäbchen, Abschminktücher, Binden, Tampons, Slipeinlagen, Kondome, Pflaster, Schmerztabletten, Nasenspray, Hustenbonbons, Vitamine, Desinfektionsmittel, Feuchtes Toilettenpapier, Kontaktlinsenmittel, Nagellackentferner',
        'Baby' => 'Windeln, Feuchttücher, Babybrei, Babymilch, Babygläschen, Babykekse, Babyshampoo, Wundschutzcreme, Schnuller, Babyöl, Stilleinlagen',
        'Tierbedarf' => 'Katzenfutter, Katzenstreu, Katzensnacks, Hundefutter, Hundesnacks, Kotbeutel, Vogelfutter, Kleintierfutter, Heu, Einstreu, Fischfutter',
        'Haus & Garten' => 'Blumen, Blumenerde, Dünger, Pflanzensamen, Geschenkpapier, Geschenkband, Grußkarte, Klebeband, Kleber, Briefumschläge, Briefmarken, Druckerpapier, Druckerpatronen, Kugelschreiber, Schrauben, Dübel, Nägel, Streusalz',
    ];
    $out = [];
    foreach ($c as $name => $list) {
        $out[] = ['name' => $name, 'products' => array_map('trim', explode(',', $list))];
    }
    return $out;
}

/** Vorlagen, die beim ersten Start angelegt werden. Jeder kann sie ändern oder löschen. */
function kfDefaultTemplates(): array {
    return [
        'Grillen' => ['Grillfleisch', 'Bratwurst', 'Baguette', 'Grillsauce', 'Kräuterquark', 'Tomaten', 'Gurke', 'Paprika', 'Mais', 'Grillkohle', 'Bier'],
        'Frühstück' => ['Brötchen', 'Butter', 'Eier', 'Marmelade', 'Honig', 'Käse', 'Aufschnitt', 'Orangensaft', 'Kaffee', 'Milch'],
        'Spaghetti Bolognese' => ['Spaghetti', 'Hackfleisch', 'Zwiebeln', 'Knoblauch', 'Möhren', 'Passierte Tomaten', 'Tomatenmark', 'Parmesan'],
        'Kuchen backen' => ['Mehl', 'Zucker', 'Eier', 'Butter', 'Backpulver', 'Vanillezucker', 'Milch'],
    ];
}
