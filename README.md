# Partisans

Un site, pour téléphone et pour ordi, qui abonne la personne, réseau par réseau, à des comptes de gauche qui combattent l'extrême droite. Un appui sur « Suivre » ouvre la page ou l'appli de la plateforme ; la progression reste dans le navigateur.

> **Statut : en développement.** Le site n'est pas encore en ligne.

## Principes

- **Aucune donnée personnelle.** Pas de connexion, pas de cookie, pas de tracking, aucune ressource externe. Le site compte seulement, de façon anonyme, le nombre de visiteurs et le nombre de comptes ouverts depuis le site : deux totaux, sans adresse IP ni identifiant.
- **Liste publique, ouverte aux signalements et aux suggestions.**

## La liste

`site/partisans.json` : comptes de gauche, LFI assumé, en six catégories (personnalités politiques, médias, journalistes, influenceurs, partis et mouvements, associations). Chaque compte a une source qui prouve qu'il appartient bien à la personne ou à l'organisation (site officiel, item Wikidata).

Pour signaler ou suggérer un compte, ouvre un ticket avec le formulaire « Signaler un compte » ou « Suggérer un compte ». Une suggestion sans preuve d'appartenance n'est pas retenue.

## Développer

Avant ton premier commit, installe le garde-fou d'anonymat :

```sh
sh scripts/install-hooks.sh
```

Il refuse tout commit qui contiendrait une identité non anonyme, un chemin absolu de ta machine ou des métadonnées d'image.

- **Aperçu local** : `python3 -m http.server 8000 -d site`, puis http://localhost:8000.
- **Tests** (Node 22 ou plus récent) : `npm install` (dépendance `@netlify/blobs` du compteur), puis `npm test`.
- **Starter pack Bluesky** (bouton « Tout suivre ») : `node --env-file=.env scripts/publish-bluesky-starterpack.mjs site/partisans.json --dry-run`, puis sans `--dry-run`. Le fichier `.env` (ignoré par git) contient `BLUESKY_IDENTIFIER` et `BLUESKY_APP_PASSWORD`. Publie depuis le compte du projet, jamais depuis un compte personnel. L'adresse affichée va dans `STARTER_PACK_URL` (`site/config.js`).
- **Compteur** : `netlify/functions/compter.mjs` additionne les deux totaux dans le magasin Netlify Blobs `compteur` (clé `totaux`). Pour les lire : interface Netlify, Data & Storage > Blobs.
- **Dernier post** : `netlify/functions/dernier-post.mjs` mène au dernier post Bluesky d'un compte de la liste, cherché côté serveur.

Le site est servi par Netlify depuis le dossier `site/` (voir `netlify.toml`), à l'adresse https://partisans.netlify.app/.

À la mise en ligne :

1. Renseigner `STARTER_PACK_URL` dans `site/config.js`.
2. Essayer, depuis un iPhone et un Android : l'ajout à l'écran d'accueil, l'aperçu du lien partagé, et les liens « Suivre » ouverts depuis Instagram et WhatsApp.

## Licence

Copyright (C) 2026 Les contributeurs de Partisans

Ce programme est un logiciel libre, distribué sous licence [GNU GPL v3](LICENSE).

Polices Bricolage Grotesque et Newsreader : SIL Open Font License (`site/polices/`).
