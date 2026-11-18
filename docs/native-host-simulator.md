# Simulateur natif KGUI — profil hôte

## Objectif et limites

Cette cible exécute les vrais fichiers graphiques KGUI/KUI de KodeOS recompilés pour l'hôte (Linux et Windows). Elle ne simule pas le processeur ESP32-P4 et ne démarre pas les Active Objects ni le firmware complet. L'interface SDL2 est celle du simulateur KUI officiel du SDK.

Les sources KodeOS et le SDK sont épinglés respectivement à :

- KodeOS : `9bcfdb71b763ee7b5c14106358643ea611fc97db`
- SDK : `1841cc8c13d4b2e3e4d7288b40cdac5de207a133`

## Profil initial

Le profil hôte construit les écrans officiels Face, Launcher et Touch Test, à partir de leurs unités de traduction d'origine. Il conserve également les modules KGUI utilisés par ces écrans (`kgui_off.c`, `kgui_lvgl.c` et `kgui_rest.c`).

`ports/native/kgui_sim_host.c` est un adaptateur d'initialisation propre à l'hôte : il crée les sujets LVGL attendus, appelle les constructeurs officiels et expose les trois écrans au lanceur KUI. Il ne redessine pas les écrans et ne remplace pas leur logique graphique. Il reste portable : `localtime_r`/`localtime_s` et le format de date `%e` sont gérés par des chemins spécifiques à chaque plateforme.

Loading et Settings ne sont pas encore exposés dans ce profil :
- Loading dépend du système de packs, des ressources KGUI et du lecteur d'animation Kody/Lottie.
- Settings dépend du service d'inclinaison et de ses autres services firmware.

Ils seront réintégrés lorsque leurs dépendances auront un backend hôte réel. Ils ne sont ni remplacés par des écrans factices ni annoncés comme fonctionnels.

## Construction et vérification

Le workflow `Build native KGUI host simulator` :

1. récupère KodeOS et son SDK aux révisions épinglées ;
2. applique un petit profil CMake dans le checkout isolé (`patches/native_host.py` adapte aussi le `setenv` du `main.c` amont pour la CRT Windows) ;
3. construit le simulateur KUI officiel avec SDL2 sur Linux (gcc) et sur Windows (MinGW64 via MSYS2, Ninja) ;
4. produit `kgui_sim` (Linux) et `kgui_sim.exe` accompagné de `SDL2.dll` (Windows) comme artefacts téléchargeables.

La réussite de l'édition des liens ne suffit pas à valider le simulateur. Les critères de validation incluent l'exécution headless des trois écrans, la génération d'images PNG, et le contrôle des sujets exposés (`app_count`, `empty_text`, `tp_text`). Le rendu doit être comparé aux captures du même SDK et des mêmes sources KodeOS.

## Ce que cette cible ne prétend pas faire

- Elle n'émule pas les instructions RISC-V du ESP32-P4.
- Elle ne démarre pas les Active Objects QP/C de KodeOS.
- Elle ne fournit pas encore les pilotes ou périphériques physiques (écran AMOLED, NFC, capteurs, boutons).
- Elle n'exécute pas les applications firmware du Kode Dot.

Une émulation firmware plus complète nécessitera un moteur CPU et des modèles de périphériques adaptés, ou un backend hôte distinct qui implémente réellement les contrats des services KodeOS.
