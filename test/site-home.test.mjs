import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL } from '../site/lib/html.js';
import { renderScreen, resolveRoute } from '../site/lib/screens.js';
import { emptyState } from '../site/lib/state.js';
import { miniList } from './helpers/partisans-fixture.mjs';

const home = (fields = {}, list = miniList) => {
  const state = { ...emptyState(), ...fields };
  return renderScreen(resolveRoute('', list, state), { list, state });
};
const assertInOrder = (html, texts) => {
  const positions = texts.map((text) => html.indexOf(text));
  assert.ok(positions.every((p) => p >= 0), `absent : ${texts.filter((_, i) => positions[i] < 0).join(', ')}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
};

test('l\'accueil porte les textes validés, dans l\'ordre', () => {
  const html = home();
  assertInOrder(html, [
    'Contre l\'extrême droite, sur les réseaux',
    '<h1>Rejoins les partisans.</h1>',
    'Abonne-toi en quelques minutes aux élus, médias et collectifs de gauche qui combattent l\'extrême droite. Chaque abonné de plus, c\'est plus de monde qui voit leurs posts.',
    '>Voir la liste →</a>',
    'Il ne te sera demandé aucun mot de passe, toutes tes données restent confidentielles.',
    '<h2>Les algorithmes amplifient ce qui fait réagir.</h2>',
    'Quand tu réponds à un post d\'extrême droite, même pour le dénoncer, tu le fais voir à plus de monde. Tes likes, partages et commentaires ont du poids : donne-les à ceux qui la combattent.',
    '<h2>Abonne-toi en quelques clics.</h2>',
    'Choisis tes réseaux. On t\'ouvre chaque compte de la liste, tu n\'as plus qu\'à cliquer sur « S\'abonner ».',
    '<h2>Soutiens. <em>Ignore le reste.</em></h2>',
    'Une fois abonné, aime, partage et commente leurs posts. L\'extrême droite, ignore-la : ne réponds pas, ne cite pas, continue juste de scroller !',
    '<a class="btn papier" href="#reseaux">Voir la liste →</a>',
    '<h2>La liste</h2>',
    'Fais passer le mot.',
    'Projet bénévole et anonyme.',
  ]);
});

test('l\'accueil ne porte ni compteur, ni étiquette, ni menu', () => {
  const html = home();
  for (const absent of ['12 408', '·', 'Menu', 'Diffuser', 'Ligne LFI', 'Survole']) assert.ok(!html.includes(absent), absent);
});

test('les boutons de l\'accueil ouvrent le parcours ou défilent dans la page', () => {
  const html = home();
  assert.equal(html.match(/href="#reseaux"/g).length, 4);
  assert.ok(html.includes('<a class="btn" href="#reseaux">Voir la liste →</a>'));
  assert.ok(html.includes('<a class="btn secondaire" href="#reseaux">Je rejoins →</a>'));
  assert.ok(html.includes('<a class="btn" href="#reseaux">Tout suivre sur mes réseaux →</a>'));
  assert.ok(html.includes('<a href="#la-liste" data-defiler>La liste</a>'));
  assert.ok(html.includes('<a href="#la-consigne" data-defiler>La consigne</a>'));
  assert.ok(html.includes('<a class="btn secondaire" href="#la-consigne" data-defiler>Lire la consigne</a>'));
  assert.ok(html.includes('id="la-consigne"') && html.includes('id="la-liste"'));
});

test('la consigne renvoie vers On bloque l\'extrême droite', () => {
  assert.ok(home().includes(`<p class="coin-blocage">Tu veux bloquer les comptes d'extrême droite pour ne plus les voir du tout ? Rendez-vous sur <a href="https://www.onbloquelextremedroite.fr/" ${EXTERNAL}>onbloquelextremedroite.fr</a>, par Mise au poing.</p></section>`));
});

test('l\'accueil propose de reprendre seulement si la liste est accessible', () => {
  assert.ok(home({ platforms: ['x'] }).includes('<a class="btn secondaire" href="#liste">Reprendre ma liste</a>'));
  assert.ok(!home().includes('Reprendre ma liste'));
});

test('la vitrine compte les comptes et les réseaux de la liste', () => {
  const html = home();
  assert.ok(html.includes('<p>7 comptes au total, sur 8 réseaux.</p>'));
  assertInOrder(html, [
    '<section class="colonne teinte-ardoise"><header class="colonne-tete"><p>2 comptes</p><h3>Personnalités politiques</h3>',
    '<section class="colonne teinte-ocre"><header class="colonne-tete"><p>3 comptes</p><h3>Médias</h3>',
    '<section class="colonne teinte-sauge"><header class="colonne-tete"><p>2 comptes</p><h3>Partis et associations</h3>',
  ]);
});

test('chaque carte montre les huit réseaux, toujours dans le même ordre', () => {
  const card = home().match(/<li class="carte"><p class="carte-nom"><span class="nom">Alice Martin<\/span><\/p>(.*?)<\/li>/s)[1];
  assertInOrder(card, ['>X<', '>Bluesky<', '>Threads<', '>Instagram<', '>Facebook<', '>TikTok<', '>Mastodon<', '>YouTube<']);
  assert.ok(card.includes(`<a href="https://x.com/alicemartin" ${EXTERNAL} data-open="x:alicemartin" aria-label="Alice Martin sur X">X</a>`));
  assert.ok(card.includes(`<a href="https://www.instagram.com/alicemartin/" ${EXTERNAL} data-open="instagram:alicemartin" aria-label="Alice Martin sur Instagram">Instagram</a>`));
  assert.ok(card.includes('<span aria-hidden="true">Bluesky</span>'));
});

test('la précision dit ce que le titre de colonne ne dit pas', () => {
  const html = home();
  assert.ok(html.includes('<span class="nom">Chloé Vidéo</span> <span class="precision">Influenceur</span>'));
  assert.ok(html.includes('<span class="nom">Mouvement Commun</span> <span class="precision">Parti ou mouvement</span>'));
  assert.ok(html.includes('<span class="nom">Collectif Solidaire</span> <span class="precision">Association</span>'));
  assert.ok(html.includes('<span class="nom">Le Journal</span></p>'));
});

test('les noms de la vitrine sont échappés', () => {
  const html = home();
  assert.ok(html.includes('<span class="nom">L&#39;Écho &amp; &lt;Cie&gt;</span>'));
  assert.ok(html.includes('href="https://exemple.social/@echo"'));
  assert.ok(html.includes('aria-label="L&#39;Écho &amp; &lt;Cie&gt; sur Mastodon"'));
  assert.ok(!html.includes('<Cie>'));
});

test('une colonne montre six cartes, la suite se déplie', () => {
  const [alice] = miniList.entries;
  const entries = Array.from({ length: 8 }, (_, i) => ({ ...alice, handle: `elu${i}`, displayName: `Élu ${i}` }));
  const html = home({}, { ...miniList, entries });
  assert.ok(html.includes('<p>8 comptes au total, sur 1 réseau.</p>'));
  const [visible, rest] = html.split('<details class="suite">');
  assert.equal(visible.match(/<li class="carte">/g).length, 6);
  assert.ok(rest.startsWith('<summary>Voir les 8 →</summary>'));
  assert.equal(rest.match(/<li class="carte">/g).length, 2);
  assert.ok(!home().includes('<details'));
});
