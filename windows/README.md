# Version Windows hors ligne

Le programme Windows emballe le site statique validé du simulateur KodeOS dans une application Electron. Le firmware, les fichiers WebAssembly, les workers et les composants virtuels sont copiés dans l'installateur; le programme bloque les connexions HTTP(S) et WebSocket à l'exécution.

L'installateur est produit par le workflow GitHub Actions après une compilation Web réussie. Le workflow démarre aussi l'application emballée en mode hors ligne et vérifie le démarrage KodeOS, l'horloge UTC et un framebuffer KGUI non noir. L'installateur est publié comme artefact `kode-dot-windows-installer` pour une durée de 14 jours si ces étapes réussissent.

Le contrôle du site Web public doit également réussir sur la branche principale avant qu'une version soit considérée comme prête à distribuer. La branche de préparation Windows vérifie l'application à partir de ses fichiers locaux et bloque ses connexions réseau.
