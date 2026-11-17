# Connexions, compte et suivi en direct

Ce document décrit la cible technique. Il distingue les fonctions déjà présentes, les fonctions prévues et les possibilités qui restent à prouver.

## 1. Deux connexions différentes

### Compte du compagnon — prévu

Un compte propre à ce projet permettra de retrouver les mêmes données sur le téléphone, la tablette et le PC :
- objectifs et quêtes suivis ;
- découvertes cochées ;
- builds et notes ;
- journal personnel ;
- préférences de carte et filtres.

Ce compte ne sera **pas** le compte NetEase, Steam, PlayStation Network, Xbox ou Apple. Il ne demandera jamais le mot de passe du jeu. Le fournisseur d'authentification et le backend seront choisis avant de mettre en production l'inscription, la connexion, la récupération de compte et la synchronisation.

### Connexion au compte du jeu — facultative et non disponible à ce stade

Une liaison au compte Where Winds Meet n'a d'intérêt que si NetEase fournit une API ou un mécanisme d'autorisation utilisable par un service tiers. Aucune connexion de ce type n'est intégrée ici. Ne jamais demander ni stocker un mot de passe de jeu, un cookie de session ou un jeton récupéré dans le navigateur.

## 2. Suivi en direct : compatibilité par plateforme

| Environnement | Cible | État |
|---|---|---|
| Web / PWA sur toutes les plateformes | Carte, carnet, compte compagnon et synchronisation | Les fonctions locales existent ; compte et cloud à développer |
| Windows / PC | Étudier un connecteur local de position en direct | Faisabilité démontrée par des outils communautaires, mais aucun connecteur propre n'est développé |
| PlayStation | Carte et suivi manuel ; étudier uniquement les interfaces autorisées | Pas d'API publique de position du personnage identifiée |
| Xbox | Carte et suivi manuel ; étudier uniquement les interfaces autorisées | Pas d'API publique de position du personnage identifiée |
| Android / iOS | Utiliser le compagnon comme deuxième écran | Le compagnon n'a pas accès automatiquement à l'état interne d'une autre application |

### Référence communautaire existante

TH.GL indique que son application compagnon Windows peut afficher la position et l'orientation du joueur sur la carte Where Winds Meet. Son site précise aussi que les outils web fonctionnent sur tous les appareils, mais ne fournissent pas la superposition ni le suivi de position. Cela prouve qu'un suivi existe dans une configuration Windows particulière, **pas** qu'une API universelle existe, ni que son implémentation peut être copiée ou réutilisée.

- [Carte Where Winds Meet sur TH.GL](https://wherewindsmeet.th.gl/)
- [FAQ TH.GL : suivi de la position des amis](https://www.th.gl/id/faq/see-friends-on-map)
- [TH.GL : état du suivi en direct de Where Winds Meet](https://www.th.gl/suggestions-issues/1558792781974081546)

## 3. Architecture cible

1. **Application commune** : PWA responsive, utilisable sur PC, console via navigateur secondaire, téléphone et tablette.
2. **Identité compagnon** : authentification indépendante, sessions sécurisées, suppression et export des données.
3. **Synchronisation** : API HTTPS, données privées rattachées à un identifiant compagnon, contrôle de conflits et fonctionnement hors ligne avec synchronisation différée.
4. **Données de jeu** : catalogue de lieux, boss, objets et quêtes versionné et sourcé.
5. **Connecteurs optionnels** : interface standardisée qui transmet uniquement les événements autorisés (position, zone, orientation, découverte). Chaque connecteur déclare ses capacités ; l'application fonctionne même sans lui.
6. **Confidentialité** : collecte minimale, consentement explicite, aucune donnée de compte de jeu ni capture d'écran conservée par défaut.

Exemple de contrat interne envisagé pour un événement de position :

```json
{
  "type": "player.position",
  "source": "windows-companion",
  "gameVersion": null,
  "region": "unknown",
  "x": null,
  "y": null,
  "heading": null,
  "observedAt": null,
  "confidence": "unknown"
}
```

Les valeurs `null` sont intentionnelles : aucune coordonnée ne doit être inventée. Un connecteur ne pourra publier une position qu'après validation de son système de coordonnées et de sa précision.

## 4. Ordre de réalisation

- [x] Retirer les références Xbox exclusives et rendre le projet multiplateforme.
- [x] Définir la séparation entre compte compagnon et compte du jeu.
- [ ] Choisir et configurer le backend d'authentification et de synchronisation.
- [ ] Implémenter inscription, connexion, déconnexion et récupération de compte.
- [ ] Migrer les données locales vers un modèle synchronisable avec fusion hors ligne.
- [ ] Évaluer un connecteur Windows en respectant les règles du jeu.
- [ ] Évaluer séparément les possibilités sur PlayStation, Xbox et mobile.
- [ ] Afficher explicitement les capacités réelles et l'état de chaque connecteur.

## 5. Sécurité et règles du jeu

Les [conditions d'utilisation de Where Winds Meet](https://www.wherewindsmeetgame.com/termsofuse.html) interdisent notamment certains outils tiers non autorisés qui modifient ou désassemblent le logiciel, contournent des protections, extraient des informations par scraping ou automatisent des actions. Elles interdisent aussi le partage non autorisé des identifiants de compte.

En conséquence, ce projet n'utilisera pas de lecture mémoire, injection, modification du client, contournement anti-triche, automatisation des commandes ni récupération de jetons de session. Une technique de suivi ne sera retenue qu'après vérification de sa compatibilité avec les règles applicables. En cas de doute, la fonction restera manuelle ou sera désactivée.

## 6. État actuel

À la date de cette version, le compagnon ne possède pas encore de serveur, de compte utilisateur, de synchronisation cloud, de liaison NetEase ni de suivi automatique de position. Le code existant conserve les données dans le stockage local du navigateur. Ce document est une spécification de développement, pas une promesse de fonctions déjà actives.
