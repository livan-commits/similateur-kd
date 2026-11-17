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

Ce compte ne sera **pas** le compte NetEase, Steam, PlayStation Network, Xbox ou Apple. Il ne demandera jamais le mot de passe du jeu. **Supabase est retenu comme backend cible** pour Supabase Auth et PostgreSQL. Le schéma SQL initial avec Row Level Security est préparé dans `supabase/schema.sql`. Le client Supabase, l'interface d'inscription/connexion/déconnexion/récupération du mot de passe et la première synchronisation sont codés. Le projet Supabase n'est pas encore créé/configuré : ces fonctions restent donc inactives tant que l'URL et la clé publishable ne sont pas renseignées et que le schéma SQL n'est pas appliqué.

### Connexion au compte du jeu — facultative et non disponible à ce stade

Une liaison au compte Where Winds Meet n'a d'intérêt que si NetEase fournit une API ou un mécanisme d'autorisation utilisable par un service tiers. Aucune connexion de ce type n'est intégrée ici. Ne jamais demander ni stocker un mot de passe de jeu, un cookie de session ou un jeton récupéré dans le navigateur.

## 2. Suivi en direct : compatibilité par plateforme

| Environnement | Cible | État |
|---|---|---|
| Web / PWA sur toutes les plateformes | Carte intégrée, carnet, compte compagnon et synchronisation | Carte TH.GL intégrée à la demande ; compte et cloud à configurer |
| Windows / PC | Étudier un connecteur local de position en direct | Faisabilité démontrée par des outils communautaires, mais aucun connecteur propre n'est développé |
| PlayStation | Carte et suivi manuel ; étudier uniquement les interfaces autorisées | Pas d'API publique de position du personnage identifiée |
| Xbox | Carte et suivi manuel ; étudier uniquement les interfaces autorisées | Pas d'API publique de position du personnage identifiée |
| Android / iOS | Utiliser le compagnon comme deuxième écran | Le compagnon n'a pas accès automatiquement à l'état interne d'une autre application |

### Référence communautaire existante

TH.GL indique que son application compagnon Windows (Windows 10/11) affiche la position et l'orientation du joueur sur la carte. Sa fiche précise que la détection de Where Winds Meet est actuellement prise en charge via **Steam**. Le site web de TH.GL fonctionne sur tous les appareils, mais ne fournit pas à lui seul la superposition ni le suivi de position. TH.GL décrit également un partage de position entre utilisateurs par Peer Link. Ces informations démontrent une solution communautaire dans une configuration précise, **pas** une API universelle, une autorisation officielle de NetEase, ni un droit de réutiliser son code ou son protocole.

- [Carte Where Winds Meet sur TH.GL](https://wherewindsmeet.th.gl/)
- [Fiche TH.GL : Companion App Windows et compatibilité Steam](https://www.th.gl/fr/apps/where-winds-meet)
- [FAQ TH.GL : suivi de la position des amis via Peer Link](https://www.th.gl/faq/see-friends-on-map)
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
- [x] Choisir le backend cible : Supabase Auth + PostgreSQL.
- [x] Préparer le schéma SQL initial avec RLS.
- [ ] Créer/configurer le projet Supabase et ses clés publiques.
- [x] Coder inscription, connexion, déconnexion et récupération de compte (activation réelle en attente de la configuration Supabase).
- [x] Préparer la fusion des données locales et distantes, l'import/export JSON et la synchronisation différée (tests locaux de fusion ; validation Supabase de bout en bout encore en attente).
- [ ] Évaluer un connecteur Windows en respectant les règles du jeu.
- [ ] Évaluer séparément les possibilités sur PlayStation, Xbox et mobile.
- [ ] Afficher explicitement les capacités réelles et l'état de chaque connecteur.

## 5. Sécurité et règles du jeu

Les [conditions d'utilisation de Where Winds Meet](https://www.wherewindsmeetgame.com/termsofuse.html) interdisent notamment certains outils tiers non autorisés qui modifient ou désassemblent le logiciel, contournent des protections, extraient des informations par scraping ou automatisent des actions. Elles interdisent aussi le partage non autorisé des identifiants de compte.

En conséquence, ce projet n'utilisera pas de lecture mémoire, injection, modification du client, contournement anti-triche, automatisation des commandes ni récupération de jetons de session. Une technique de suivi ne sera retenue qu'après vérification de sa compatibilité avec les règles applicables. En cas de doute, la fonction restera manuelle ou sera désactivée.

## 6. Carte intégrée

La vue Carte intègre les cartes TH.GL via leur URL officielle `/embed/maps/` documentée par le fournisseur. Les cartes proposées sont Central Plain, Hexi et Transdust Ruins. Le chargement est volontaire : tant que le joueur ne clique pas sur « Afficher la carte », aucun iframe TH.GL n'est créé. Le crédit et le lien vers la carte complète sont conservés sous l'iframe, conformément aux conditions d'intégration du fournisseur. Les marqueurs, couches, filtres et données restent hébergés et maintenus par TH.GL ; ils ne sont ni copiés ni présentés comme des données propres au compagnon. La carte officielle NetEase reste un lien externe car l'intégration iframe n'est pas retenue.

Sources techniques : [documentation d'intégration TH.GL](https://www.th.gl/developers) et [carte Where Winds Meet TH.GL](https://wherewindsmeet.th.gl/).

## 7. État actuel

À la date de cette version, le compagnon possède une carte TH.GL intégrée avec chargement à la demande ; la progression propre au compagnon reste indépendante des cases cochées chez TH.GL. Le compte compagnon et la synchronisation cloud ne sont pas activables tant qu'un projet Supabase n'est pas configuré et que le schéma SQL n'a pas été appliqué ; aucune synchronisation de bout en bout n'a donc été testée. Les données restent enregistrées dans le navigateur. La fusion côté client utilise les horodatages pour arbitrer les états de quêtes et de découvertes ; en cas d'horodatage égal ou absent (anciennes sauvegardes), l'appareil en cours de fusion garde la priorité. Les suppressions de notes de carte sont propagées par des marqueurs de suppression (tombstones). Les entrées de journal et les builds sont fusionnés par dédoublonnage, sans gestion complète de leur suppression. Ces mécanismes ne règlent pas encore les écritures simultanées sur le serveur : il n'existe pas de contrôle atomique de révision/compare-and-swap, et des horloges d'appareils désynchronisées peuvent entraîner un mauvais arbitrage. Aucune liaison NetEase ni aucun suivi automatique de position n'est intégré. Ce document décrit l'état réel du développement, pas une promesse de fonctions déjà actives.


## 8. Suivi de position en direct : état de faisabilité

La Companion App de TH.GL propose un suivi en direct pour Where Winds Meet, mais sa documentation indique actuellement une prise en charge du jeu sur **Steam uniquement**, avec une application Windows 10/11. Le site web seul fonctionne sur téléphone et navigateur, mais ne fournit pas à lui seul le suivi de position. Peer Link permet à un navigateur ou à un téléphone de voir une position partagée, à condition qu'un joueur utilise au préalable l'application de bureau TH.GL et génère un code de partage.

- Présentation et plateformes prises en charge : https://www.th.gl/fr/apps/where-winds-meet
- Fonctionnement de Peer Link : https://www.th.gl/faq/see-friends-on-map

**Conséquence pour ce projet :** cette solution peut dépanner un joueur PC/Steam avec un second écran, mais elle ne satisfait pas l'objectif multiplateforme (PlayStation, Xbox, PC et mobile). Nous ne l'intégrons donc pas comme système de suivi natif et universel. Aucun accès mémoire du jeu, injection, contournement anti-triche, identifiant de session ou API privée n'est ajouté au compagnon. Une intégration multiplateforme ne sera annoncée que si une interface officielle ou une méthode autorisée et vérifiable devient disponible.
