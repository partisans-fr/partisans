// L'accueil, en texte HTML : les deux mises en page (téléphone et ordi) sont dans le même balisage,
// accueil.css cache ce qui n'appartient pas à la largeur courante. Textes validés, mot pour mot.
// app.js s'appuie sur data-defiler (défilement dans la page), data-open (vitrine), .panneau et .bandeau.

import { PLATFORMS, entryKey, showcase } from './catalog.js';
import { EXTERNAL, TINTS, bar, button, escapeHtml } from './html.js';
import { profileUrl } from './links.js';

// Réglette des cartes : toujours les huit réseaux, dans cet ordre, pour que les cases s'alignent.
const RULER = ['x', 'bluesky', 'threads', 'instagram', 'facebook', 'tiktok', 'mastodon', 'youtube'];
// Ce que le titre de colonne ne dit pas.
const PRECISIONS = { journaliste: 'Journaliste', influenceur: 'Influenceur', parti: 'Parti ou mouvement', association: 'Association' };
const VISIBLE_CARDS = 6;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

function card(person) {
  const name = escapeHtml(person.name);
  const precision = PRECISIONS[person.category] ? ` <span class="precision">${PRECISIONS[person.category]}</span>` : '';
  const cells = RULER.map((platform) => {
    const entry = person.accounts[platform];
    if (!entry) return `<span aria-hidden="true">${PLATFORMS[platform]}</span>`;
    return `<a href="${escapeHtml(profileUrl(entry))}" ${EXTERNAL} data-open="${escapeHtml(entryKey(entry))}" aria-label="${name} sur ${PLATFORMS[platform]}">${PLATFORMS[platform]}</a>`;
  }).join('');
  return `<li class="carte"><p class="carte-nom"><span class="nom">${name}</span>${precision}</p><p class="reglette">${cells}</p></li>`;
}

function column({ title, categories, people }) {
  const cards = (some) => `<ul class="cartes">${some.map(card).join('')}</ul>`;
  const rest = people.length > VISIBLE_CARDS
    ? `<details class="suite"><summary>Voir les ${people.length} →</summary>${cards(people.slice(VISIBLE_CARDS))}</details>`
    : '';
  return `<section class="colonne teinte-${TINTS[categories[0]]}"><header class="colonne-tete"><p>${plural(people.length, 'compte')}</p><h3>${title}</h3></header>
      ${cards(people.slice(0, VISIBLE_CARDS))}
      ${rest}
    </section>`;
}

function showcaseSection(list) {
  const { people, platforms, columns } = showcase(list);
  return `<section class="vitrine" id="la-liste" tabindex="-1">
    <div class="vitrine-tete"><h2>La liste</h2><p>${plural(people, 'compte')} au total, sur ${platforms} ${platforms === 1 ? 'réseau' : 'réseaux'}.</p>${button('Tout suivre sur mes réseaux →', '#reseaux')}</div>
    <div class="colonnes">${columns.map(column).join('\n')}</div>
  </section>`;
}

export function homeScreen({ list, resume }) {
  const links = '<nav class="barre-liens"><a href="#la-liste" data-defiler>La liste</a><a href="#la-consigne" data-defiler>La consigne</a></nav>';
  return `${bar(`${links}${button('Je rejoins →', '#reseaux', { secondary: true })}`)}
  <div class="hero">
    <div class="hero-texte">
      <p class="surtitre">Contre l'extrême droite, sur les réseaux</p>
      <div class="masque-titre"><h1>Rejoins les partisans.</h1></div>
      <p class="chapo">Abonne-toi en quelques minutes aux élus, médias et collectifs de gauche qui combattent l'extrême droite. Chaque abonné de plus, c'est plus de monde qui voit leurs posts.</p>
      <div class="hero-boutons">${button('Voir la liste →', '#reseaux')}${resume ? button('Reprendre ma liste', '#liste', { secondary: true }) : ''}<a class="btn secondaire" href="#la-consigne" data-defiler>Lire la consigne</a></div>
      <p class="discret">Il ne te sera demandé aucun mot de passe, toutes tes données restent confidentielles.</p>
    </div>
    <div class="panneau" aria-hidden="true"><span class="poing"></span></div>
  </div>
  <div class="blocs">
    <section class="bloc"><h2>Les algorithmes amplifient ce qui fait réagir.</h2><p>Quand tu réponds à un post d'extrême droite, même pour le dénoncer, tu le fais voir à plus de monde. Tes likes, partages et commentaires ont du poids : donne-les à ceux qui la combattent.</p></section>
    <section class="bloc"><h2>Abonne-toi en quelques clics.</h2><p>Choisis tes réseaux. On t'ouvre chaque compte de la liste, tu n'as plus qu'à cliquer sur « S'abonner ».</p></section>
    <section class="bloc bloc-encre" id="la-consigne" tabindex="-1"><h2>Soutiens. <em>Ignore le reste.</em></h2><p>Une fois abonné, aime, partage et commente leurs posts. L'extrême droite, ignore-la : ne réponds pas, ne cite pas, continue juste de scroller !</p><p class="coin-blocage">Tu veux bloquer les comptes d'extrême droite pour ne plus les voir du tout ? Rendez-vous sur <a href="https://www.onbloquelextremedroite.fr/" ${EXTERNAL}>onbloquelextremedroite.fr</a>, par Mise au poing.</p></section>
  </div>
  <div class="bandeau"><span class="poing" aria-hidden="true"></span><a class="btn papier" href="#reseaux">Voir la liste →</a></div>
  ${showcaseSection(list)}
  <footer class="pied-accueil"><span class="symbole" aria-hidden="true"></span><p class="mot">Fais passer le mot.</p><p class="note">Projet bénévole et anonyme.</p></footer>`;
}
