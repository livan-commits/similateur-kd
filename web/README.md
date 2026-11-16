# Simulateur KodeOS Web

Cette page est le runtime du workflow **Build and publish KodeOS Web Emulator**. Elle exécute le vrai firmware KodeOS ESP32-P4 avec ESP-EMU dans le navigateur. Ce n'est pas le simulateur graphique KGUI/KUI SDL2 autonome.

## Rendu

- Le firmware KodeOS officiel et son SDK sous-module exact sont compilés pour ESP32-P4.
- KGUI et KUI/LVGL s'exécutent dans le firmware émulé.
- Un overlay headless remplace uniquement la sortie physique CO5300/MIPI-DSI par deux framebuffers RGB565 en PSRAM.
- Les adresses des symboles sont extraites du véritable ELF. Le Worker navigateur lit la PSRAM émulée avec `read_memory` ; le canvas ne fait qu'afficher les pixels produits par KGUI.
- La carte virtuelle WASM fournit le TCA6408A et le CST820 pour les boutons et le tactile.

## Contrôles et console

Le boîtier Web expose les flèches, TOP, BOT et la surface tactile. La console UART0 affiche les journaux du firmware et reçoit les commandes de diagnostic comme `gui_info`. L'heure UTC du navigateur est transmise à KodeOS.

## Tests

Le workflow déploie d'abord GitHub Pages, puis utilise Playwright/Chromium sur l'URL publique. Il vérifie le boot ESP32-P4, la console UART0, `gui_info` avec `lvgl=on`, la progression de séquence du framebuffer PSRAM et la présence de pixels non noirs. Il échoue également sur les erreurs JavaScript, console ou réseau.

## Limites

Le C5 n'est pas lancé comme une seconde puce ; la liaison SDIO, Wi-Fi et Bluetooth ne sont pas validées. Le CO5300/MIPI-DSI physique est contourné. La microSD, l'IMU, le NFC/RFID, l'audio, les haptics, l'IR, les LED et les circuits de batterie ne sont pas complètement modélisés. Le firmware NFC est désactivé dans ce profil headless.

Le workflow **Build native KGUI host simulator** est un autre outil de développement SDL2/Linux ; il ne produit pas le site Web publié.
