import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { EXTERNAL, fist, plural } from '../site/lib/html.js';
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
    '<p class="surtitre">Contre l\'extrême droite, sur les réseaux</p>',
    '<h1><span class="ligne"><span data-anim="line">Soyons</span></span> <span class="ligne"><span data-anim="line">partisans.</span></span></h1>',
    'Abonne-toi en quelques minutes aux élus, médias et collectifs de gauche qui combattent l\'extrême droite. Chaque abonné de plus, c\'est plus de monde qui voit leurs posts.',
    '>Voir la liste →</a>',
    'Il ne te sera demandé aucun mot de passe, toutes tes données restent confidentielles.',
    '<p class="slogan"><span class="phrase"><span>De la force pour</span> <span>ceux qui luttent.</span></span> <span class="phrase rouge">Rien pour eux.</span></p>',
    '<h2>Les algorithmes amplifient ce qui fait réagir.</h2>',
    'Quand tu réponds à un post d\'extrême droite, même pour le dénoncer, tu le fais voir à plus de monde. Tes likes, partages et commentaires ont du poids : donne-les à ceux qui la combattent.',
    '<h2>Abonne-toi en quelques clics.</h2>',
    'Choisis tes réseaux. On t\'ouvre chaque compte de la liste, tu n\'as plus qu\'à cliquer sur « S\'abonner ».',
    '<h2>Soutiens. <em>Ignore le reste.</em></h2>',
    'Une fois abonné, aime, partage et commente leurs posts. L\'extrême droite, ignore-la : ne réponds pas, ne cite pas, continue juste de scroller !',
    '<h2>La liste</h2>',
    'Fais passer le mot.',
    '<p class="adresse">soyonspartisans.fr</p>',
    'Projet bénévole et anonyme.',
  ]);
});

test('le poing du hero monte dans le panneau rouge', () => {
  const html = home();
  assertInOrder(html, [`<div class="panneau" aria-hidden="true">${fist('(min-width: 900px) 368px, 213px')}</div>`, '<div class="hero-texte">']);
});

test('les blocs et les colonnes tombent, le bloc rouge se dévoile', () => {
  const html = home();
  assert.equal(html.match(/data-anim="drop"/g).length, 6);
  assert.ok(html.includes('<section class="bloc bloc-rouge" id="la-consigne" tabindex="-1" data-anim="drop"><span class="voile" data-anim="sweep" aria-hidden="true"></span><h2>'));
});

test('l\'ancien bandeau et l\'ancien titre ont disparu', () => {
  const html = home();
  assert.ok(!html.includes('btn papier'));
  assert.ok(!html.includes('Rejoins les partisans.'));
});

test('l\'accueil ne porte ni compteur, ni étiquette, ni menu', () => {
  const html = home();
  for (const absent of ['12 408', '·', 'Menu', 'Diffuser', 'Ligne LFI', 'Survole']) assert.ok(!html.includes(absent), absent);
});

test('les boutons de l\'accueil ouvrent le parcours ou défilent dans la page', () => {
  const html = home();
  assert.equal(html.match(/href="#reseaux"/g).length, 3);
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
    '<section class="colonne teinte-noir" data-anim="drop"><header class="colonne-tete"><h3>Personnalités politiques</h3><p>2 comptes</p></header>',
    '<section class="colonne teinte-rouge" data-anim="drop"><header class="colonne-tete"><h3>Médias</h3><p>3 comptes</p></header>',
    '<section class="colonne teinte-papier" data-anim="drop"><header class="colonne-tete"><h3>Partis et associations</h3><p>2 comptes</p></header>',
  ]);
});

test('chaque carte ne montre que les réseaux où la personne a un compte', () => {
  const html = home();
  const card = html.match(/<li class="carte"><p class="carte-nom"><span class="nom">Alice Martin<\/span><\/p>(.*?)<\/li>/s)[1];
  assert.equal(card, `<p class="carte-reseaux"><a href="https://www.instagram.com/alicemartin/" ${EXTERNAL} data-open="instagram:alicemartin" aria-label="Alice Martin sur Instagram">Instagram</a><a href="https://x.com/alicemartin" ${EXTERNAL} data-open="x:alicemartin" aria-label="Alice Martin sur X">X</a></p>`);
  assert.ok(!html.includes('<span aria-hidden="true">Bluesky</span>'));
});

test('plural accorde comptes', () => {
  assert.equal(plural(0, 'compte'), '0 compte');
  assert.equal(plural(1, 'compte'), '1 compte');
  assert.equal(plural(2, 'compte'), '2 comptes');
});

test('le pied porte le poing et l\'adresse', () => {
  assert.ok(home().includes('<footer class="pied-accueil"><span class="pied-poing" aria-hidden="true"></span><p class="mot">Fais passer le mot.</p><p class="adresse">soyonspartisans.fr</p><p class="note">Projet bénévole et anonyme.</p></footer>'));
});

test('tout fichier appelé par l\'accueil existe', () => {
  const html = home({ platforms: ['x'] });
  const siteFile = (path) => new URL(`../site/${path}`, import.meta.url);
  const refs = [
    ...[...html.matchAll(/\bsrc="([^"]+)"/g)].map(([, src]) => src),
    ...[...html.matchAll(/\bsrcset="([^"]+)"/g)].flatMap(([, set]) => set.split(',').map((item) => item.trim().split(/\s+/)[0])),
    ...[...html.matchAll(/\bhref="([^"]+)"/g)].map(([, href]) => href).filter((href) => !href.startsWith('#') && !href.startsWith('http')),
  ];
  assert.ok(refs.length >= 2);
  for (const ref of refs) assert.ok(existsSync(siteFile(ref)), ref);
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
