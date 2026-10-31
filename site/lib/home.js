// L'accueil, en texte HTML : les deux mises en page (téléphone et ordi) sont dans le même balisage,
// accueil.css cache ce qui n'appartient pas à la largeur courante. Textes validés, mot pour mot.
// app.js s'appuie sur data-defiler (défilement dans la page), data-open (vitrine) et data-anim (animations).

import { PLATFORMS, entryKey, showcase } from './catalog.js';
import { EXTERNAL, bar, button, escapeHtml, fist, plural } from './html.js';
import { profileUrl } from './links.js';
import { visualsSection } from './visuals.js';

// Ce que le titre de colonne ne dit pas.
const PRECISIONS = { journaliste: 'Journaliste', influenceur: 'Influenceur·se',parti: 'Parti ou mouvement', association: 'Association' };
// En-tête de colonne, selon sa première catégorie.
const COLUMN_TINTS = { politique: 'noir', media: 'rouge', parti: 'papier' };
const VISIBLE_CARDS = 6;

// Une carte ne montre que les réseaux où la personne a un compte, dans l'ordre de PLATFORMS.
function card(person) {
  const name = escapeHtml(person.name);
  const precision = PRECISIONS[person.category] ? ` <span class="precision">${PRECISIONS[person.category]}</span>` : '';
  const links = Object.keys(PLATFORMS)
    .filter((platform) => person.accounts[platform])
    .map((platform) => {
      const entry = person.accounts[platform];
      return `<a href="${escapeHtml(profileUrl(entry))}" ${EXTERNAL} data-open="${escapeHtml(entryKey(entry))}" aria-label="${name} sur ${PLATFORMS[platform]}">${PLATFORMS[platform]}</a>`;
    }).join('');
  return `<li class="carte"><p class="carte-nom"><span class="nom">${name}</span>${precision}</p><p class="carte-reseaux">${links}</p></li>`;
}

function column({ title, categories, people }) {
  const cards = (some) => `<ul class="cartes">${some.map(card).join('')}</ul>`;
  const rest = people.length > VISIBLE_CARDS
    ? `<details class="suite"><summary>Voir les ${people.length} →</summary>${cards(people.slice(VISIBLE_CARDS))}</details>`
    : '';
  return `<section class="colonne teinte-${COLUMN_TINTS[categories[0]]}" data-anim="drop"><header class="colonne-tete"><h3>${title}</h3><p>${plural(people.length, 'compte')}</p></header>
      ${cards(people.slice(0, VISIBLE_CARDS))}
      ${rest}
    </section>`;
}

function showcaseSection(list) {
  const { people, platforms, columns } = showcase(list);
  return `<section class="vitrine" id="la-liste" tabindex="-1">
    <div class="section-tete"><h2>La liste</h2><p>${plural(people, 'compte')} au total, sur ${platforms} ${platforms === 1 ? 'réseau' : 'réseaux'}.</p>${button('Tout suivre sur mes réseaux →', '#reseaux')}</div>
    <div class="colonnes">${columns.map(column).join('\n')}</div>
  </section>`;
}

// Les réseaux où la liste a des comptes, dans l'ordre de PLATFORMS.
const networksList = (list) =>
  `<ul class="reseaux-dispo">${Object.keys(PLATFORMS).filter((platform) => list.entries.some((entry) => entry.platform === platform)).map((platform) => `<li>${PLATFORMS[platform]}</li>`).join('')}</ul>`;

// gesture : le geste du jour, déjà en HTML, ou rien pour qui ne suit encore aucun compte.
export function homeScreen({ list, resume, gesture = '' }) {
  const links = '<nav class="barre-liens"><a href="#la-liste" data-defiler>La liste</a><a href="#la-consigne" data-defiler>La consigne</a></nav>';
  return `${bar(`${links}<a class="btn" href="#fais-tourner" data-defiler>Fais tourner</a>`)}
  <div class="hero">
    <div class="panneau" aria-hidden="true">${fist('(min-width: 900px) 368px, 213px')}</div>
    <div class="hero-texte">
      <p class="surtitre">Contre l'extrême droite, sur les réseaux</p>
      <h1><span class="ligne"><span data-anim="line">Soyons</span></span> <span class="ligne"><span data-anim="line">partisan·es.</span></span></h1>
      <p class="chapo">Abonne-toi en quelques minutes aux élu·es, médias et collectifs de gauche qui combattent l'extrême droite.</p>
      <div class="hero-boutons">${button('Voir la liste →', '#reseaux')}${resume ? button('Reprendre ma liste', '#liste', { secondary: true }) : ''}</div>
      ${gesture}
      <p class="discret">Il ne te sera demandé aucun mot de passe, toutes tes données restent confidentielles.</p>
    </div>
  </div>
  <p class="slogan"><span class="phrase"><span>De la force pour</span> <span>celles et ceux</span> <span>qui luttent.</span></span> <span class="phrase rouge"><span>Rien pour</span> <span>l'extrême droite.</span></span></p>
  <div class="blocs">
    <section class="bloc" data-anim="drop"><h2>Les algorithmes amplifient ce qui fait réagir.</h2><p>Quand tu réponds à un post d'extrême droite, même pour le dénoncer, tu le fais voir à plus de monde. Tes likes, partages et commentaires ont du poids : donne-les à celles et ceux qui la combattent.</p></section>
    <section class="bloc" data-anim="drop"><h2>Abonne-toi en quelques clics.</h2><p>Choisis tes réseaux. On t'ouvre chaque compte de la liste, tu n'as plus qu'à cliquer sur «\u202fS'abonner\u202f».</p>${networksList(list)}</section>
    <section class="bloc bloc-rouge" id="la-consigne" tabindex="-1" data-anim="drop"><span class="voile" data-anim="sweep" aria-hidden="true"></span><h2>Soutiens. <em>Ignore le reste.</em></h2><p>Une fois abonné·e à celles et ceux qui luttent, aime, partage et commente leurs posts. L'extrême droite, ignore-la : ne réponds pas, ne cite pas, continue juste de scroller !</p><p class="coin-blocage">Tu veux bloquer les comptes d'extrême droite pour ne plus les voir du tout\u202f? Rendez-vous sur <a href="https://www.onbloquelextremedroite.fr/" ${EXTERNAL}>onbloquelextremedroite.fr</a>, par <a href="https://www.instagram.com/mise__au__poing/" ${EXTERNAL}>Mise au poing</a>.</p></section>
  </div>
  ${showcaseSection(list)}
  ${visualsSection()}
  <footer class="pied-accueil"><span class="pied-poing" aria-hidden="true"></span><p class="mot">Fais passer le mot.</p><p class="adresse">soyonspartisans.fr</p><p class="note">Projet bénévole et anonyme. <a href="#mentions">Mentions légales</a></p></footer>`;
}
