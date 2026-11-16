# Références techniques KodeDIY

Ce document décrit les sources amont et les versions utilisées par le simulateur KodeOS Web. Les sources officielles et le commit du sous-module réellement référencé par KodeOS priment sur les anciennes pages de documentation.

## Sources officielles

- [KodeOS](https://github.com/kodediy/KodeOS)
- [Documentation KodeOS](https://docs.kode.diy/internals/overview)
- [Architecture de démarrage](https://docs.kode.diy/internals/boot-model)
- [Interface graphique KGUI](https://docs.kode.diy/internals/gui/overview)
- [kode-sdk](https://github.com/kodediy/kode-sdk)
- [Documentation SDK](https://docs.kode.diy/sdk/overview)
- [KUI](https://docs.kode.diy/sdk/kui)
- [Modèle d'application officiel](https://github.com/kodediy/kode-app-template)
- [ESP-EMU officiel](https://github.com/espressif/esp-emulator)

## Versions du build Web

Le workflow épingle le commit KodeOS :

`d2443ddc07b238a24f1f4ebe1b0b8e4a09f34b1d`

Ce commit référence le sous-module `sdk` au commit :

`66f2a597596c7f19d651207158be9efe305fdf33`

Le workflow vérifie explicitement que le sous-module extrait correspond à ce SHA avant de compiler. Il ne prend pas arbitrairement la branche `main` de `kode-sdk`.

Versions et cible :
- KodeOS 0.1.1 (version rapportée par le firmware au démarrage ; le build la revalide dans son journal UART) ;
- ESP-IDF v6.1 ;
- cible firmware ESP32-P4 ;
- KUI 0.1.1 ;
- LVGL 9.6.0~1, déclaré dans le manifeste du composant KUI épinglé ;
- ESP-EMU v1.0.0 ;
- écran Kode Dot 410 × 502 en RGB565.

Le fichier publié `versions.json` est le manifeste faisant foi pour les commits du site effectivement déployé.

## Architecture d'exécution

Le site n'est pas une maquette KGUI en HTML. Le workflow construit l'image flash réelle de KodeOS et le stockage, puis ESP-EMU v1.0.0 exécute le firmware ESP32-P4 dans un Worker du navigateur.

KGUI et KUI/LVGL restent dans le firmware. Un overlay de compilation spécifique au simulateur remplace la sortie physique CO5300/MIPI-DSI par deux framebuffers RGB565 en PSRAM. Les adresses de leurs symboles sont extraites du véritable ELF ; un Worker lit la mémoire émulée via `read_memory` et transfère les pixels au canvas du navigateur.

Une carte virtuelle WebAssembly fournit le TCA6408A (I²C 0x20) et le CST820 (I²C 0x15) nécessaires au chemin d'affichage, aux boutons et au tactile. Le test Playwright accède à la console UART0, demande `gui_info`, vérifie `lvgl=on`, attend une séquence framebuffer supérieure à l'initialisation et rejette une image noire.

## Périmètre non émulé

Le site ne représente pas toute l'électronique Kode Dot :
- le contrôleur CO5300/MIPI-DSI physique est contourné ;
- le firmware ESP32-C5 est construit et livré, mais le C5 n'est pas exécuté comme une seconde puce dans ce runtime Web ; la liaison SDIO et les fonctions Wi-Fi/Bluetooth dépendantes ne sont donc pas validées ;
- la carte microSD, l'IMU, le NFC/RFID, le codec audio, les haptics, l'IR, les LED et les circuits de batterie n'ont pas de modèles virtuels complets ;
- NFC est désactivé dans ce profil headless ;
- les applications tierces ne sont pas validées par le test de boot et de rendu.

Les messages de périphériques absents dans le journal UART doivent être interprétés comme des limites du modèle virtuel, pas comme des comportements du matériel réel.

## Documentation historique

Certaines pages publiques de l'ancien dépôt de documentation peuvent encore décrire des générations ESP32-S3 ou LVGL antérieures. En cas de divergence, utiliser le commit KodeOS épinglé, le commit SDK qu'il référence et les manifestes des composants correspondants.
