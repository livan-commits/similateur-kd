# Where Winds Meet — Ultimate Companion

Compagnon communautaire indépendant, en français, conçu comme deuxième écran universel pour les joueurs de **toutes les plateformes** : PC, PlayStation, Xbox, Android et iOS. L'application ne dépend d'aucune plateforme de jeu.

## Fonctions présentes
- Tableau de bord de progression.
- Carnet d'objectifs et cases à cocher.
- Carte TH.GL intégrée au compagnon, avec sélection des cartes Plaine centrale, Hexi et Ruines Transdust ; chargement à la demande et lien de crédit conservé.\n- Suivi manuel de catégories de découvertes.
- Journal d'aventure.
- Fiches personnelles de builds.
- Notes de stratégie pour les boss.
- Export et import JSON de la progression, avec fusion des entrées lors de l'import.
- Sauvegarde locale dans le navigateur.
- Structure PWA et service worker pour l'utilisation hors ligne après première visite.

## Direction du projet : compagnon connecté
Le but n'est pas de rester une simple encyclopédie. Le projet vise :
- un **compte compagnon** indépendant du compte Where Winds Meet ;
- la synchronisation des données personnelles entre appareils ;
- une carte interactive et des données de jeu sourcées ;
- des connecteurs de suivi en direct lorsque la plateforme et les règles du jeu le permettent ;
- des intégrations facultatives et séparées par plateforme, sans rendre les fonctions communes dépendantes d'un seul système.

## État réel des connexions
- **Compte compagnon :** interface d'inscription, connexion, déconnexion et réinitialisation du mot de passe ajoutée ; activation réelle en attente de la configuration Supabase.
- **Synchronisation cloud :** le client de synchronisation et le schéma Supabase sont préparés, avec fusion des entrées non conflictuelles et priorité à l'état de l'appareil en cours de synchronisation lorsqu'une même quête ou découverte diffère. Le service reste inactif tant qu'aucun projet Supabase n'est configuré. Les données restent enregistrées localement.
- **Connexion au compte NetEase / compte de plateforme :** aucune connexion n'est actuellement demandée ou effectuée. Aucun mot de passe, cookie ou jeton ne doit être communiqué au projet.
- **Position du personnage en direct :** pas encore implémentée dans ce compagnon. Elle devra être évaluée séparément pour chaque plateforme et uniquement avec une méthode autorisée.
- **Progression automatique des quêtes / objets :** pas encore implémentée.

## Architecture prévue pour les connexions
Le compte du compagnon sera distinct du compte du jeu. Il servira uniquement à synchroniser les données créées dans le compagnon. Les données de jeu en direct passeront par des connecteurs indépendants, optionnels et limités aux capacités autorisées de chaque plateforme. Une indisponibilité d'un connecteur ne devra jamais bloquer l'application, la carte ou le suivi manuel.

La conception détaillée, les niveaux de compatibilité et les contraintes sont documentés dans [CONNEXIONS.md](CONNEXIONS.md).

## Sécurité et conformité
Les conditions de NetEase interdisent notamment certains logiciels non autorisés qui modifient le jeu, contournent ses protections, extraient des informations par scraping ou automatisent les actions. Le projet n'intégrera pas de lecture mémoire, injection, modification du client, automatisation de commandes ou collecte de jetons de compte sans autorisation explicite. Toute méthode de suivi devra être vérifiée avant implémentation.

## Sources de cartes
- [Carte officielle Where Winds Meet](https://www.wherewindsmeetgame.com/map/)
- [TH.GL — carte et base de données communautaires](https://wherewindsmeet.th.gl/)
- [Where Guilds Meet — atlas communautaire, quêtes et itinéraires](https://www.whereguildsmeet.org/map)

Les marqueurs communautaires seront identifiés comme tels et ne seront pas présentés comme des données officielles.

## Déploiement
Le workflow GitHub Actions de ce compagnon vérifie les fichiers requis, la syntaxe JavaScript, les tests de fusion des sauvegardes, la neutralité multiplateforme de l'interface et la présence des protections RLS du schéma SQL, puis prépare un artefact web. **Il ne déploie pas encore cette application sur une URL publique.** Le site Kode Dot publié sur GitHub Pages ne doit pas être remplacé par ce projet.

Projet indépendant, non affilié à Everstone Studio ou NetEase.
