# Where Winds Meet — Ultimate Companion

Compagnon communautaire indépendant, en français, conçu comme deuxième écran pour les joueurs Xbox.

## Fonctions présentes dans cette première version
- Tableau de bord de progression.
- Carnet d'objectifs et cases à cocher.
- Suivi manuel de catégories de découvertes.
- Journal d'aventure.
- Fiches personnelles de builds.
- Notes de stratégie pour les boss.
- Export JSON de la progression.
- Sauvegarde locale dans le navigateur.
- Structure PWA et service worker pour l'utilisation hors ligne après première visite.

## Fonctions prévues
- Carte interactive alimentée par des emplacements provenant de sources publiques vérifiables.
- Filtres pour coffres, secrets, ressources, boss et points d'intérêt.
- Encyclopédie recherchable avec sources.
- Guides détaillés de quêtes, personnages et combats.
- Import/export et éventuellement synchronisation multi-appareils.

## Limites techniques importantes
Cette application ne se connecte pas au compte NetEase/Xbox et ne lit pas la mémoire de la console. Le suivi automatique de la position du personnage en temps réel sur Xbox n'est pas implémenté et n'est pas garanti. La carte de jeu complète n'est pas encore intégrée. Les emplacements et stratégies ne seront publiés qu'après vérification de sources fiables.

Aucun mot de passe, cookie ou jeton de compte n'est demandé. La progression de cette version reste stockée localement sur l'appareil ; l'export JSON permet d'en conserver une copie.

## Déploiement
Le workflow GitHub Actions « Where Winds Meet Companion — Deploy » valide les fichiers puis publie le dossier sur GitHub Pages. La publication nécessite que GitHub Pages soit autorisé pour le dépôt et que l'environnement `github-pages` soit disponible.

Projet indépendant, non affilié à Everstone Studio, NetEase ou Microsoft/Xbox.