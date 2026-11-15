# Version Windows hors ligne

Le programme Windows emballe le site statique validé du simulateur KodeOS dans une application Electron. Le firmware, les fichiers WebAssembly, les workers et les composants virtuels sont copiés dans l'installateur; le programme bloque les connexions HTTP(S) et WebSocket à l'exécution.

L'installateur est produit par le workflow GitHub Actions après une compilation Web réussie. Il est publié comme artefact `kode-dot-windows-installer` pour une durée de 14 jours.

La compilation de l'application ne suffit pas à valider le rendu KGUI. Le contrôle existant du simulateur Web doit également réussir avant qu'une version soit considérée comme prête à distribuer.
