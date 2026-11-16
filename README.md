# Simulateur Kode Dot Web

Projet indépendant qui exécute le véritable firmware KodeOS ESP32-P4 dans le navigateur avec le moteur officiel ESP-EMU. Ce dépôt n'est pas un produit officiel KodeDIY.

## Site public

[Ouvrir le simulateur KodeOS Web](https://livan-commits.github.io/similateur-kd/)

Le site fonctionne dans un navigateur moderne, sans Termux ni installation locale.

## Ce qui est réellement exécuté

- Le firmware KodeOS est compilé depuis un commit officiel KodeOS fixe et le commit exact de son sous-module SDK.
- ESP-EMU v1.0.0 exécute le firmware ESP32-P4 dans un Worker du navigateur.
- KodeOS démarre ses Active Objects et son interface KGUI. Le KUI/LVGL officiel dessine dans deux framebuffers RGB565 en PSRAM.
- Le navigateur lit ces pixels dans la mémoire de l'ESP32-P4 émulé via l'API `read_memory` d'ESP-EMU. Le canvas 410 × 502 n'est que la surface d'affichage des pixels réels ; il ne dessine pas une imitation de KGUI.
- Le patch headless remplace uniquement la sortie physique CO5300/MIPI-DSI par les framebuffers PSRAM. Le code de rendu KGUI/KUI reste celui du firmware officiel.
- Une carte virtuelle WebAssembly modélise le TCA6408A (0x20) et le contrôleur tactile CST820 (0x15) nécessaires au chemin d'affichage et d'entrée.

## Vérification navigateur

Le workflow « Build and publish KodeOS Web Emulator » déploie le site puis lance un vrai Chromium automatisé sur l'URL publique. Le test attend le démarrage ESP32-P4/KodeOS, envoie `gui_info` par UART0 et exige `lvgl=on`, une séquence framebuffer PSRAM d'au moins 4, une image 410 × 502 avec des pixels non noirs, et aucune erreur JavaScript, console ou requête réseau. Une capture d'écran du navigateur est conservée comme artefact du workflow.

## Versions officielles épinglées pour le site

- KodeOS : commit `d2443ddc07b238a24f1f4ebe1b0b8e4a09f34b1d`
- `kode-sdk` : commit `66f2a597596c7f19d651207158be9efe305fdf33`, exactement celui référencé par le sous-module du commit KodeOS ci-dessus
- ESP-IDF : v6.1
- KUI : 0.1.1, LVGL 9.6.0~1
- ESP-EMU : v1.0.0
- Écran : 410 × 502, RGB565

Le manifeste publié `versions.json` contient les commits et le périmètre exacts du build.

## Limites connues

Ce n'est pas encore une émulation complète de toute la carte Kode Dot :

- Le contrôleur physique CO5300/MIPI-DSI est contourné par le backend headless ; les pixels KGUI eux-mêmes sont bien produits par le firmware.
- Le firmware ESP32-C5 est construit et fourni comme image, mais le coprocesseur C5 n'est pas encore lancé comme une seconde puce dans cette version Web. Le Wi-Fi/Bluetooth et la liaison inter-puces SDIO ne sont donc pas annoncés comme fonctionnels.
- Le TCA6408A et le CST820 sont modélisés par une carte virtuelle ; ce n'est pas une reproduction électrique complète.
- La carte microSD, l'IMU, le NFC/RFID, le codec audio, les vibrations, l'IR, les LED et les circuits de gestion de batterie ne sont pas encore modélisés. Les fonctions qui dépendent de ces périphériques restent indisponibles.
- Le NFC est désactivé dans ce profil headless (`CONFIG_KODEOS_NFC=n`) : son matériel SPI/IRQ n'a pas encore de modèle virtuel.
- La capacité mémoire et les performances de l'émulateur navigateur ne sont pas encore validées comme identiques à celles d'une carte physique.
- L'exécution d'applications tierces n'est pas encore validée par ce test de démarrage et d'affichage.

Le workflow « Build native KGUI host simulator » est une cible distincte de test SDL2/Linux ; ce n'est pas le moteur utilisé par le site public.
