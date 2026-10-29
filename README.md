# Partisans

Un site, pour téléphone et pour ordi, qui abonne la personne, réseau par réseau, à des comptes de gauche qui combattent l'extrême droite. Un appui sur « Suivre » ouvre la page ou l'appli de la plateforme ; la progression reste dans le navigateur.

La section « Fais tourner » de l'accueil propose les visuels du projet à télécharger un par un (logos, bandeau de profil, carrousel, stories), ou tous d'un coup dans un zip sur ordi.

Le site : https://soyonspartisans.fr/

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

Le site est servi par Netlify depuis le dossier `site/` (voir `netlify.toml`), à l'adresse https://soyonspartisans.fr/ (https://partisans.netlify.app/ y redirige).

### Visuels

Les images du site viennent d'un dossier de design (poings, favicons, visuels des réseaux). Pour les produire à nouveau (Python 3 et Pillow) :

```sh
python3 scripts/preparer-visuels.py <dossier du design>
```

Le script écrit `site/img/` (poings, silhouettes du logo, grain, vignettes allégées), `site/visuels/` (visuels en pleine taille et leur zip), `site/icons/` et `site/partage.png`, sans aucune métadonnée.

### Polices

Dela Gothic One et Karla viennent du dépôt `google/fonts`. Seul le sous-ensemble latin est servi (Karla réduite à ses graisses 400 à 800), avec fontTools :

```sh
pyftsubset DelaGothicOne-Regular.ttf --unicodes="$U" --layout-features='kern,liga' --flavor=woff2 --output-file=site/polices/dela-gothic-one.woff2
fonttools varLib.instancer 'Karla[wght].ttf' wght=400:800 -o karla-400-800.ttf
pyftsubset karla-400-800.ttf --unicodes="$U" --layout-features='kern,liga' --flavor=woff2 --output-file=site/polices/karla.woff2
```

où `U='U+0020-007E,U+00A0-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2009,U+200B,U+2010-2011,U+2013,U+2018-2019,U+201C-201D,U+2026,U+202F,U+20AC,U+2190-2193'`.

Dela Gothic One dessine ses flèches pour le japonais, trop bas pour nos capitales : `python3 scripts/recentrer-fleches.py site/polices/dela-gothic-one.woff2` les recentre. Karla n'a pas de flèches : dans le texte courant, elles viennent de la police du système.

## Licence

Copyright (C) 2026 Les contributeurs de Partisans

Ce programme est un logiciel libre, distribué sous licence [GNU GPL v3](LICENSE).

Polices Dela Gothic One et Karla : SIL Open Font License (`site/polices/`).
