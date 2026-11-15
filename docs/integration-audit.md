# Audit d'intégration des sources — Similateur KD Web

Date de vérification : 2026-11-14

## Références exactes vérifiées

- Dépôt amont : [kodediy/KodeOS](https://github.com/kodediy/KodeOS), commit épinglé `9bcfdb71b763ee7b5c14106358643ea611fc97db`.
- Sous-module `sdk` déclaré par KodeOS : [kodediy/kode-sdk](https://github.com/kodediy/kode-sdk/tree/1841cc8c13d4b2e3e4d7288b40cdac5de207a133).
- Commit du SDK vérifié dans le checkout de ce projet : `1841cc8c13d4b2e3e4d7288b40cdac5de207a133`.
- Simulateur KGUI amont : [components/kgui/sim au commit épinglé](https://github.com/kodediy/KodeOS/tree/9bcfdb71b763ee7b5c14106358643ea611fc97db/components/kgui/sim).
- Simulateur KUI amont : [components/kui/sim au commit épinglé](https://github.com/kodediy/kode-sdk/tree/1841cc8c13d4b2e3e4d7288b40cdac5de207a133/components/kui/sim).

Les workflows récupèrent KodeOS au commit immuable `9bcfdb71b763ee7b5c14106358643ea611fc97db`, avec les sous-modules récursifs, puis vérifient explicitement que `sdk` correspond au commit `1841cc8c13d4b2e3e4d7288b40cdac5de207a133`. Ils ne suivent donc pas la branche mouvante `develop`.

## Ce qui est réellement repris

| Élément | Provenance | État dans le portage Web |
|---|---|---|
| Écrans KGUI | `KodeOS/components/kgui/screens` | Sources C compilées directement dans la cible du simulateur |
| Hôte du simulateur KGUI | `KodeOS/components/kgui/sim` | CMake amont utilisé comme point d'entrée |
| Simulateur KUI | `kode-sdk/components/kui/sim` | Sources amont réutilisées, avec adaptation Emscripten |
| LVGL | Dépendance FetchContent déclarée par KUI | Version demandée par la source amont : LVGL 9.6.0 |
| SDL2 | Simulateur KUI | Liaison adaptée à SDL2 d'Emscripten |
| Boucle d'événements | `kode-sdk/components/kui/sim/main.c` | Boucle native remplacée par `emscripten_set_main_loop` |
| Image du boîtier | Ressource du simulateur KUI | Incorporée par le mécanisme CMake amont |

Les écrans KGUI visibles dans le simulateur sont ceux que le code amont expose actuellement : `face`, `launcher`, `loading`, `settings` et `touch_test`.

## Adaptations propres à Similateur KD

- `patches/emscripten.py` modifie le CMake et le point d'entrée du simulateur pour la cible navigateur.
- `.github/workflows/build-web.yml` automatise le checkout, la compilation Emscripten et le déploiement GitHub Pages.
- Les chemins d'inclusion KGUI/SDK ajoutés dans le patch sont des adaptations de compilation ; ils ne constituent pas des composants officiels.

Aucune interface de remplacement en HTML/CSS n'est utilisée pour dessiner les écrans KGUI.

## Ce qui n'est pas encore intégré

Le résultat actuel n'est pas une émulation complète du Kode Dot ni du firmware KodeOS. Ne sont pas encore exécutés comme un système complet :

- démarrage et séquence de boot du firmware ;
- Active Objects QP/C et ordonnanceur temps réel ;
- services système et communication entre composants ;
- pilotes matériels, GPIO, écran physique, tactile réel et capteurs ;
- stockage/flash, partitions et périphériques spécifiques à l'ESP32-P4 ;
- applications firmware complètes et leurs interactions avec le matériel.

Les dépendances dont les écrans graphiques ont besoin peuvent apparaître dans les en-têtes transitifs sans que leurs services soient réellement démarrés dans le navigateur. La présence d'un chemin d'inclusion ne signifie donc pas que le sous-système est émulé.

## Dernier état de compilation vérifié

Workflow [Build and publish KGUI Web — run 43601692312](https://github.com/livan-commits/similateur-kd/actions/runs/43601692312), commit du projet `d7e9207c47c0bd099a3cd7b41f09b66361e64916).

- Checkout KodeOS et sous-modules : réussi.
- Installation Emscripten : réussie.
- Adaptation du simulateur : réussie.
- Configuration CMake : réussie.
- Compilation : échoue vers 99 %, lors de la compilation de `kgui_screen_loading.c`, car `kqp.h` inclut `qpc.h` et ce dernier n'est pas encore résolu par les chemins d'inclusion du build.
- Préparation du site et déploiement : non exécutés à cause de cet échec.

Le prochain travail consiste à résoudre proprement la dépendance QP/C à partir de la structure du SDK épinglé, puis à relancer la compilation. La réussite ne sera déclarée qu'après compilation, déploiement et vérification des fichiers publiés.

## Règle de provenance

Chaque composant doit rester traçable vers son dépôt, son chemin et sa version. Les adaptations du portage Web doivent être identifiées comme telles. Une compilation réussie du simulateur graphique ne devra jamais être présentée comme une émulation complète du firmware.


## Mise à jour — publication WebAssembly et ESP-EMU (2026-11-14)

Le workflow [run 59](https://github.com/livan-commits/similateur-kd/actions/runs/43614715092) a réussi la compilation KGUI, la préparation des fichiers navigateur, la récupération d'ESP-EMU v1.0.0 et le déploiement Pages.

Le workflow [run 61](https://github.com/livan-commits/similateur-kd/actions/runs/43614999742) a également réussi, y compris les deux jobs **build** et **deploy**. Ce run :
- vérifie le sous-module SDK au commit attendu ;
- installe Emscripten et applique l'adaptation navigateur ;
- compile le simulateur KGUI officiel ;
- télécharge ESP-EMU v1.0.0 et vérifie son SHA-256 avant extraction ;
- génère le lanceur du site et `versions.json` ;
- publie l'artefact GitHub Pages.

SHA-256 vérifié du paquet `esp-emu-1.0.0-wasm.tar.gz` :
`1b55d715c614207d3a441ad3c834eca216891f85c907b0ac0b1d7d9746294873`.

Commit du dépôt ayant déclenché le run 61 :
`449c28265d67bea6f672ead3a41e2c369b26476f`.

Le SDK est bien épinglé à :
`1841cc8c13d4b2e3e4d7288b40cdac5de207a133`.

Le commit KodeOS désormais épinglé dans les deux workflows est :
`9bcfdb71b763ee7b5c14106358643ea611fc97db`.
Les runs récents doivent être contrôlés individuellement ; leurs logs et leur manifeste de build restent la preuve de la provenance effective de chaque artefact.

## Périmètre ESP-EMU vérifié

La documentation ESP-EMU v1.0.0 indique que le build navigateur prend en charge ESP32-P4 et ESP32-C5. Son système Virtual Parts navigateur charge des modules WASM dans des Web Workers et prend actuellement en charge les interactions GPIO, I2C et SPI. Il est donc possible d'écrire des modèles matériels personnalisés pour plusieurs circuits du Kode Dot.

En revanche, la documentation ne fournit pas actuellement de part générique pour MIPI-DSI, I2S, SDMMC ou SDIO. La documentation ESP-Hosted consultée décrit une liaison native P4–C6 via socket Unix, pas le P4–C5 du Kode Dot dans un navigateur. Ces interfaces restent donc des travaux spécifiques, pas des capacités déjà acquises.

Voir [le profil matériel Kode Dot DVT](hardware-model.md) pour les broches, adresses, composants, modèles à écrire et limites vérifiées.


## Mise à jour — épinglage reproductible et builds du 14 novembre 2026

Les deux workflows utilisent désormais les mêmes références immuables :

- KodeOS : `9bcfdb71b763ee7b5c14106358643ea611fc97db`.
- SDK : `1841cc8c13d4b2e3e4d7288b40cdac5de207a133`, vérifié par une étape `git rev-parse` et `test`.
- ESP-IDF : `v6.1`, cible `esp32p4`.
- ESP-EMU navigateur : tag `v1.0.0`, archive contrôlée par SHA-256.

Runs déclenchés par cet épinglage :

- [Build firmware — run 43621355137](https://github.com/livan-commits/similateur-kd/actions/runs/43621355137).
- [Build Web — run 43621358508](https://github.com/livan-commits/similateur-kd/actions/runs/43621358508).

Au dernier contrôle consigné, les deux jobs étaient encore en cours, sans étape en échec. Le résultat final doit être mis à jour après la fin des jobs. Un build firmware réussi prouve la production d'une image, pas son démarrage dans ESP-EMU ; un build Web réussi ne prouve pas que le firmware est raccordé au rendu KGUI.


## Mise à jour — Windows hors ligne et périphériques non raccordés (15 novembre 2026)

Le paquet Windows est désormais vérifié en démarrage local sans réseau et contient le firmware P4/C5, les workers et les modules WASM. Le panneau de stockage Windows a été étendu pour gérer les fichiers et sous-dossiers de façon persistante (import, export, suppression). Il reste côté hôte : aucun montage SDMMC dans le firmware n'est revendiqué.

Le C5 est démarrable à la demande dans une instance ESP-EMU séparée. Ce test autonome permet de vérifier que son image démarre, mais ne relie pas les contrôleurs SDIO des deux SoC. Le contrat Virtual Parts navigateur ESP-EMU v1.0.0 expose GPIO, I2C et SPI, pas SDIO ni SDMMC. À distinguer : ESP-EMU v1.0.0 documente aussi un pont SDIO natif P4–C6 via socket Unix (docs/guides/HOSTED.md), mais ce chemin n'est ni une Virtual Part WebAssembly ni la paire P4–C5 du Kode Dot. Le vrai raccordement dans l'application Windows exige une adaptation du moteur/transport et des tests de protocole.

Les contrôles CI vérifient maintenant aussi la syntaxe des scripts Electron et du JavaScript intégré à la page, ainsi que la présence des commandes de gestion SD et du démarrage C5 manuel.

## Rectification technique — SDIO et microSD (15 novembre 2026)

L'audit des sources officielles KodeOS/SDK épinglées précise le schéma réel :

- Le P4 héberge le pilote ESP-Hosted ; le C5 est le slave ESP-Hosted-MCU v2.12.9. La liaison radio P4–C5 est SDIO 4 bits.
- Le firmware KodeOS configure le C5 en reset au démarrage (CONFIG_KODEOS_C5_HOLD=y) et le réveille via son signal enable lorsque les services radio le demandent.
- Le SDK réserve le slot SDMMC 1 au lien ESP-Hosted C5 et le slot SDMMC 0 à la microSD physique. Les deux partagent le contrôleur matériel P4 et sont coordonnés par khal_sdmmc.
- Le firmware du C5 configure aussi le GPIO de détection de carte et l'expandeur GPIO distant ; ce n'est pas un simple échange UART.

ESP-EMU v1.0.0 a une fonctionnalité documentée --hosted pour relier un P4 à un C6 par socket Unix, en processus natifs. Cette découverte corrige l'affirmation précédente selon laquelle ESP-EMU n'aurait aucun pont SDIO. En revanche, elle ne prouve pas la compatibilité avec le slave C5 KodeDIY ni avec le build WASM utilisé dans cette application Windows.

La carte Carte_SD Windows demeure actuellement un espace de fichiers hôte. Le firmware ne la monte pas. Pour la microSD, il faut un modèle de carte répondant aux commandes SDMMC sur le slot 0 et raccordé au contrôleur P4 émulé. Pour le C5, il faut d'abord valider le pont --hosted P4–C5 (ou porter son mécanisme dans le runtime WASM), en utilisant exactement les images KodeOS et C5 épinglées.
