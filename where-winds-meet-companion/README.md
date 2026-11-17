# Where Winds Meet — Ultimate Companion

Compagnon non officiel, indépendant du jeu, pensé comme second écran pour les joueurs Xbox.

## Objectif
Réunir dans une application web responsive :
- carte communautaire (données et coordonnées à sourcer avant publication) ;
- suivi manuel des lieux, coffres, secrets et ressources ;
- journal de quêtes et objectifs ;
- fiches de boss et stratégies ;
- builds, armes et compétences ;
- encyclopédie et recherche globale.

## État du projet
**Phase 0 — fondations.** L'interface et les outils de suivi local sont en préparation. Aucune connexion au compte NetEase/Xbox ni lecture de la mémoire du jeu n'est implémentée. Le suivi automatique de position sur Xbox n'est pas confirmé et ne doit pas être présenté comme disponible.

## Principes
- Pas de demande de mot de passe, cookie ou jeton de compte.
- Pas de données de jeu inventées : les fiches et coordonnées devront être sourcées.
- Progression conservée localement sur l'appareil dans cette première version.
- Application non affiliée à Everstone Studio, NetEase ou Xbox.

## Lancement local
Ouvrir `index.html` dans un navigateur moderne. Pour tester le service worker/PWA, servir ce dossier en HTTP(S) (par exemple avec un serveur statique).

## Feuille de route
1. Interface responsive et stockage local.
2. Import de données de carte vérifiées et filtres par catégorie.
3. Encyclopédie, quêtes, boss et builds alimentés par des sources vérifiables.
4. Installation PWA et déploiement GitHub Pages.
5. Étude séparée des possibilités de synchronisation Xbox, sans promettre de télémétrie inaccessible.
