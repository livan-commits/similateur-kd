# Kode Dot Local — Android

Application Android autonome qui embarque les fichiers statiques du simulateur KodeOS et les exécute dans Android System WebView. Le moteur ESP-EMU est fourni sous forme WebAssembly officielle ; il s'exécute localement sur l'appareil, sans serveur distant ni connexion réseau après installation.

## Première étape : P4

Cette première cible Android embarque le simulateur KodeOS ESP32-P4 existant :
- firmware KodeOS réel construit depuis les commits KodeOS et SDK épinglés ;
- ESP-EMU WebAssembly officiel ;
- framebuffer KGUI RGB565 lu depuis la mémoire émulée ;
- worker de rendu et carte I2C virtuelle Kode Dot.

Le lancement P4 dans l'APK devra être vérifié sur Android avant de déclarer cette étape terminée.

## Étape suivante : second ESP32-C5

Le firmware C5 est actuellement construit et inclus dans l'image de stockage KodeOS. Il n'est pas encore lancé comme seconde instance ESP-EMU. L'intégration C5 demandera d'extraire le fichier c5_slave.bin de l'image de stockage et de créer une seconde instance d'émulateur, avec le transport ESP-Hosted entre P4 et C5. L'APK P4 seule ne doit pas être présentée comme une émulation double puce.

## Pourquoi WebAssembly dans WebView ?

Le dépôt ESP-EMU publie le moteur natif pour Linux/macOS et le moteur WebAssembly pour navigateur. Le code source du moteur CPU n'est pas fourni dans ce dépôt public sous forme de crate Rust compilable Android. Cette application réutilise donc le runtime WebAssembly officiel dans WebView au lieu de prétendre produire un port natif non vérifié.

## Build

Le workflow GitHub Actions Build Android local simulator construit l'APK debug et le publie comme artefact kode-dot-local-android-debug. Les ressources site/ sont injectées depuis le dist/ validé par le build web.
