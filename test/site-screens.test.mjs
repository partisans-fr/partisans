import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL, fist } from '../site/lib/html.js';
import { escapeHtml, renderScreen, resolveRoute } from '../site/lib/screens.js';
import { emptyState } from '../site/lib/state.js';
import { miniList } from './helpers/partisans-fixture.mjs';

const state = (fields = {}) => ({ ...emptyState(), ...fields });
const render = (hash, fields, options = {}) => {
  const current = state(fields);
  return renderScreen(resolveRoute(hash, miniList, current), { list: miniList, state: current, ...options });
};
const assertInOrder = (html, texts) => {
  const positions = texts.map((text) => html.indexOf(text));
  assert.ok(positions.every((p) => p >= 0), `absent : ${texts.filter((_, i) => positions[i] < 0).join(', ')}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
};

test('escapeHtml neutralise le HTML', () => {
  assert.equal(escapeHtml(`L'Écho & <Cie> "x"`), 'L&#39;Écho &amp; &lt;Cie&gt; &quot;x&quot;');
});

test('une adresse sans choix ramène à l\'écran cohérent', () => {
  for (const hash of ['#liste', '#fin', '#categories']) assert.deepEqual(resolveRoute(hash, miniList, emptyState()), { screen: 'reseaux' }, hash);
  for (const hash of ['', '#nimportequoi']) assert.deepEqual(resolveRoute(hash, miniList, emptyState()), { screen: 'accueil' }, hash);
  assert.deepEqual(resolveRoute('#liste/instagram', miniList, state({ platforms: ['x'] })), { screen: 'liste', platform: 'x' });
  assert.deepEqual(resolveRoute('#liste', miniList, state({ platforms: ['threads'], categories: ['politique'] })), { screen: 'categories' });
  assert.deepEqual(resolveRoute('#categories', miniList, state({ platforms: ['mastodon'], mastodonInstance: 'piaille' })), { screen: 'reseaux' });
  assert.deepEqual(resolveRoute('#mentions', miniList, emptyState()), { screen: 'mentions' });
});

test('les mentions légales nomment l\'hébergeur et gardent l\'éditeur anonyme', () => {
  const html = render('#mentions', {});
  assertInOrder(html, [
    '<header class="barre"><a class="logo" href="#">',
    '<h1>Mentions légales</h1>',
    '<h2>Éditeur</h2>',
    'article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l\'économie numérique',
    '<h2>Hébergeur</h2>',
    'Netlify, Inc., 101 2nd Street, San Francisco, CA 94105, États-Unis.',
    '<h2>Contact</h2>',
    `<a href="${miniList.contestUrl}" ${EXTERNAL}>`,
    '<h2>Données personnelles</h2>',
    '<a href="#">Retour à l\'accueil</a>',
  ]);
  assert.ok(!html.includes('class="btn"'));
});

test('Continuer attend un réseau et une instance valide', () => {
  assert.ok(render('#reseaux', {}).includes('<button class="btn" disabled>Continuer</button>'));
  const withoutInstance = render('#reseaux', { platforms: ['mastodon'] });
  assert.ok(withoutInstance.includes('name="instance"'));
  assert.ok(withoutInstance.includes('Indique ton instance, par exemple mastodon.social.'));
  assert.ok(withoutInstance.includes('<button class="btn" disabled>Continuer</button>'));
  const withInstance = render('#reseaux', { platforms: ['mastodon'], mastodonInstance: '@moi@piaille.fr' });
  assert.ok(withInstance.includes('href="#categories"'));
  assert.ok(!withInstance.includes('Indique ton instance'));
  assert.ok(!render('#reseaux', { platforms: ['x'] }).includes('name="instance"'));
});

test('chaque réseau est une ligne à cocher, qui compte ses comptes une fois cochée', () => {
  const html = render('#reseaux', { platforms: ['instagram', 'bluesky'] });
  assert.ok(html.includes('<h1>Sur quels réseaux es-tu\u202f?</h1>'));
  assert.ok(html.includes('<fieldset class="reseaux"><legend>Coche tes réseaux</legend>'));
  assert.ok(html.includes('<label class="reseau"><input type="checkbox" name="platform" value="instagram" checked><span class="case" aria-hidden="true"><span class="coche">✓</span></span><span class="nom">Instagram</span><span class="nombre">3 comptes</span></label>'));
  assert.ok(html.includes('<label class="reseau"><input type="checkbox" name="platform" value="bluesky" checked><span class="case" aria-hidden="true"><span class="coche">✓</span></span><span class="nom">Bluesky</span><span class="nombre">1 compte</span></label>'));
  assert.ok(html.includes('<label class="reseau"><input type="checkbox" name="platform" value="x"><span class="case" aria-hidden="true"></span><span class="nom">X</span></label>'));
  assertInOrder(html, ['value="instagram"', 'value="x"', 'value="tiktok"', 'value="youtube"', 'value="threads"', 'value="bluesky"', 'value="mastodon"', 'value="facebook"']);
  assert.equal(html.match(/<label class="reseau">/g).length, 8);
});

test('la barre dit l\'étape', () => {
  const fields = { platforms: ['x'] };
  assert.ok(render('#reseaux', fields).includes('<span class="etape">1 / 3</span>'));
  assert.ok(render('#categories', fields).includes('<span class="etape">2 / 3</span>'));
  assert.ok(render('#liste/x', fields).includes('<span class="etape">3 / 3</span>'));
  assert.ok(!render('#fin', fields).includes('class="etape"'));
});

test('l\'écran des catégories compte les personnes', () => {
  const platforms = ['instagram', 'x'];
  const all = render('#categories', { platforms });
  assert.ok(all.includes('<label class="categorie"><input type="checkbox" name="category" value="politique" checked><span class="case" aria-hidden="true"><span class="coche">✓</span></span><span class="nom">Personnalités politiques</span><span class="nombre">2 comptes</span></label>'));
  assert.ok(all.includes('Voir les 4 comptes'));
  assert.match(all, /Journalistes<\/span>\s*<span class="nombre">à venir</);
  assert.match(all, /name="category" value="journaliste"[^>]*\bdisabled\b/);
  assert.match(all, /name="category" value="influenceur"[^>]*\bdisabled\b/);
  assert.doesNotMatch(all, /name="category" value="politique"[^>]*\bdisabled\b/);
  assert.ok(render('#categories', { platforms, categories: ['politique'] }).includes('Voir les 2 comptes'));
  assert.ok(render('#categories', { platforms, categories: ['association'] }).includes('Voir le compte'));
  assert.ok(render('#categories', { platforms, categories: ['parti'] }).includes('<button class="btn" disabled>Aucun compte</button>'));
});

test('l\'onglet d\'un réseau montre sa progression et ses comptes', () => {
  const html = render('#liste/instagram', { platforms: ['instagram', 'x'], followed: ['instagram:alicemartin'] });
  assert.ok(html.includes('>Instagram 1/3<'));
  assert.ok(html.includes('>X 0/3<'));
  assert.match(html, /href="#liste\/instagram" aria-current="page"/);
  assert.ok(html.includes('<h1 class="titre-liste" id="titre-liste">Ta liste Instagram</h1>'));
  assert.match(html, /role="progressbar" aria-labelledby="titre-liste" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"/);
  assert.ok(html.includes('<p class="meta">1 sur 3</p>'));
  assert.ok(html.includes('<li class="compte"><span class="avatar initiales" aria-hidden="true">AM</span><span class="nom">Alice Martin</span><span class="action"><button data-unfollow="instagram:alicemartin" aria-label="Annuler le suivi : Alice Martin">Annuler</button> <span class="suivi">✓ Suivi</span></span>'));
  assert.ok(html.includes('<li class="compte"><span class="avatar initiales" aria-hidden="true">J</span><span class="nom">Le Journal</span>'));
  assert.ok(!html.includes('est-suivi'));
  assert.ok(html.includes('data-unfollow="instagram:alicemartin"'));
  assert.ok(html.includes('data-follow="instagram:lejournal" href="https://www.instagram.com/lejournal/"'));
  assertInOrder(html, ['<h2>Personnalités politiques</h2>', '<h2>Médias</h2>', '<h2>Associations</h2>']);
  assert.ok(html.includes('href="https://example.com/signaler"'));
  assert.ok(html.includes('href="https://example.com/suggerer"'));
});

test('les groupes alternent noir et rouge', () => {
  const html = render('#liste/instagram', { platforms: ['instagram'] });
  assertInOrder(html, [
    '<section class="groupe tete-noire"><h2>Personnalités politiques</h2>',
    '<section class="groupe tete-rouge"><h2>Médias</h2>',
    '<section class="groupe tete-noire"><h2>Associations</h2>',
  ]);
  assert.ok(!html.includes('teinte-'));
});

test('Suivre et Annuler nomment le compte pour les lecteurs d\'écran', () => {
  const html = render('#liste/instagram', { platforms: ['instagram'], followed: ['instagram:alicemartin'] });
  assert.match(html, /data-unfollow="instagram:alicemartin" aria-label="Annuler le suivi : Alice Martin"/);
  assert.match(html, /data-follow="instagram:lejournal"[^>]* aria-label="Suivre Le Journal"/);
  const escaped = render('#liste/youtube', { platforms: ['youtube'] });
  assert.ok(escaped.includes('aria-label="Suivre L&#39;Écho &amp; &lt;Cie&gt;"'));
});

test('un réseau sans compte dans la sélection l\'annonce', () => {
  const html = render('#liste/threads', { platforms: ['threads', 'x'], categories: ['politique'] });
  assert.ok(html.includes('Threads 0/0'));
  assert.ok(!html.includes('role="progressbar"'));
  assert.ok(html.includes('Pas encore de compte de ta sélection sur Threads.'));
});

test('Bluesky propose Tout suivre seulement avec un starter pack', () => {
  const fields = { platforms: ['bluesky'], categories: ['media'] };
  assert.ok(!render('#liste/bluesky', fields).includes('data-follow-all'));
  const url = 'https://bsky.app/starter-pack/projet.example/partisans';
  assert.match(render('#liste/bluesky', fields, { starterPackUrl: url }), new RegExp(`data-follow-all="bluesky" href="${url}"`));
  assert.ok(render('#liste/bluesky', fields, { starterPackUrl: url }).includes('>Tout suivre →</a>'));
  assert.ok(render('#liste/bluesky', fields, { starterPackUrl: url }).includes(`<a class="btn" data-follow-all="bluesky" href="${url}" ${EXTERNAL}>Tout suivre →</a>`));
});

test('Instagram et Threads proposent le compte relais seulement s\'il est réglé', () => {
  const fields = { platforms: ['instagram', 'threads', 'x'] };
  const relayAccounts = { instagram: 'relais', threads: 'relais' };
  assert.ok(!render('#liste/instagram', fields).includes('class="raccourci"'));
  assert.ok(!render('#liste/x', fields, { relayAccounts }).includes('class="raccourci"'));
  assertInOrder(render('#liste/instagram', fields, { relayAccounts }), [
    '<div class="progression">',
    '<div class="raccourci"><p class="raccourci-titre">Plus rapide : abonne-toi depuis l\'appli.</p>',
    `<a class="btn" href="https://www.instagram.com/relais/" ${EXTERNAL}>Ouvrir @relais →</a>`,
    '<p class="discret">Sur son profil, touche « suivi(e)s » : tous les comptes de la liste y sont, chacun avec son bouton « Suivre ». Pas besoin de revenir ici.</p></div>',
    'Appuie sur Suivre, puis confirme',
    '<section class="groupe',
  ]);
  assertInOrder(render('#liste/threads', fields, { relayAccounts }), [
    `<a class="btn" href="https://www.threads.com/@relais" ${EXTERNAL}>Ouvrir @relais →</a>`,
    'Sur son profil, touche « followers », puis l\'onglet « Suivi(e)s » : tous les comptes de la liste y sont',
  ]);
});

test('la fonction s\'affiche sous le nom, échappée', () => {
  const list = { ...miniList, roles: { 'Alice Martin': 'Députée', 'Le Journal': 'Quotidien <du soir>' } };
  const current = state({ platforms: ['instagram'] });
  const html = renderScreen(resolveRoute('#liste/instagram', list, current), { list, state: current });
  assert.ok(html.includes('<span class="nom">Alice Martin<span class="fonction">Députée</span></span>'));
  assert.ok(html.includes('<span class="fonction">Quotidien &lt;du soir&gt;</span>'));
  assert.ok(html.includes('<span class="nom">Collectif Solidaire</span>'));
});

test('chaque compte a son avatar, ou ses initiales à défaut', () => {
  const avatars = { 'Alice Martin': { file: 'alice-martin.webp' } };
  const fields = { platforms: ['instagram', 'x', 'youtube'] };
  const x = render('#liste/x', fields, { avatars });
  assert.ok(x.includes('<li class="compte"><img class="avatar" src="img/avatars/alice-martin.webp" width="40" height="40" alt="" loading="lazy" decoding="async"><span class="nom">Alice Martin'));
  assert.ok(x.includes('<li class="compte"><span class="avatar initiales" aria-hidden="true">BP</span><span class="nom">Bruno Petit'));
  assert.ok(render('#liste/instagram', fields, { avatars }).includes('<span class="avatar initiales" aria-hidden="true">J</span><span class="nom">Le Journal'));
  assert.ok(render('#liste/youtube', fields, { avatars }).includes('<span class="avatar initiales" aria-hidden="true">É</span><span class="nom">L&#39;Écho'));
});

test('les mentions légales créditent les images de Wikimedia Commons', () => {
  assert.ok(!render('#mentions', {}).includes('Crédits photos'));
  const credit = { author: 'Jean <Photo>', license: 'CC BY-SA 4.0', url: 'https://commons.wikimedia.org/wiki/File:Alice.jpg' };
  const avatars = { 'Alice Martin': { file: 'alice-martin.webp', credit }, 'Bruno Petit': { file: 'bruno-petit.webp' } };
  const html = render('#mentions', {}, { avatars });
  assertInOrder(html, [
    '<h2>Code source</h2>',
    '<h2>Crédits photos</h2>',
    `<li>Alice Martin : Jean &lt;Photo&gt;, <a href="${credit.url}" ${EXTERNAL}>CC BY-SA 4.0</a></li>`,
    '<a href="#">Retour à l\'accueil</a>',
  ]);
  assert.ok(!html.includes('Bruno Petit'));
});

test('les noms sont échappés', () => {
  const html = render('#liste/youtube', { platforms: ['youtube'], categories: ['media'] });
  assert.ok(html.includes('L&#39;Écho &amp; &lt;Cie&gt;'));
  assert.ok(!html.includes('<Cie>'));
});

test('la fin compte les abonnements et porte le message', () => {
  const platforms = ['instagram', 'x'];
  const html = render('#fin', { platforms, followed: ['instagram:alicemartin', 'x:alicemartin'] });
  assert.ok(render('#fin', { platforms, followed: ['x:alicemartin'] }).includes('<span class="ligne"><span data-anim="line">1 abonnement.</span></span></h1>'));
  assert.ok(render('#fin', { platforms }).includes('<h1><span class="ligne"><span data-anim="line">Ta liste t\'attend.</span></span></h1>'));
  assertInOrder(html, [
    '<h1><span class="ligne"><span data-anim="line">C\'est fait :</span></span> <span class="ligne"><span data-anim="line">2 abonnements.</span></span></h1>',
    'Maintenant, chaque jour, sur leurs posts :',
    'Aime.',
    'Partage.',
    'Commente.',
    'Et l\'extrême droite\u202f?',
    'Ignore-la.',
    'Ne réponds pas, ne cite pas, passe ton chemin.',
    `<div class="fin-bas"><p class="liens"><a href="#liste">Revenir à ma liste</a></p>${fist('146px')}</div>`,
    '<div class="fin-partage"><p class="mot">Fais passer le mot.</p><button class="btn" data-share>Partager le site</button><p class="statut" role="status"></p><p class="adresse">soyonspartisans.fr</p></div>',
  ]);
});

test('chaque écran du parcours a la barre au logo, qui ramène à l\'accueil, et au plus un bouton rouge plein', () => {
  const fields = { platforms: ['instagram', 'bluesky'], followed: ['instagram:alicemartin'] };
  for (const hash of ['#reseaux', '#categories', '#liste/instagram', '#liste/bluesky', '#fin']) {
    const html = render(hash, fields, { starterPackUrl: 'https://bsky.app/starter-pack/projet.example/partisans' });
    assert.ok(html.includes('<header class="barre"><a class="logo" href="#"><span class="logo-poing" aria-hidden="true"></span><span class="logo-mots"><span class="logo-soyons">Soyons</span> <span class="logo-partisans">Partisans</span></span></a>'), hash);
    assert.ok((html.match(/class="btn"/g) ?? []).length <= 1, hash);
  }
  assert.ok(render('#liste/instagram', fields).includes('<a class="btn secondaire" href="#fin">J\'ai fini</a>'));
});

test('un « ? » suit toujours une espace insécable fine', () => {
  const fields = { platforms: ['instagram', 'bluesky'], followed: ['instagram:alicemartin'] };
  const screens = ['', '#reseaux', '#categories', '#liste/instagram', '#fin'].map((hash) => render(hash, fields));
  for (const html of screens) assert.doesNotMatch(html, /[ \u00a0\t\n]\?/);
  assert.equal(screens.join('').match(/\u202f\?/g).length, 9);
});

test('chaque compte propose de commenter son dernier post', () => {
  const html = render('#liste/instagram', { platforms: ['instagram'], followed: ['instagram:alicemartin'] });
  assert.ok(html.includes(`<a class="commenter" data-comment="instagram:lejournal" href="https://www.instagram.com/lejournal/" ${EXTERNAL} aria-label="Déjà abonné·e\u202f? Commenter leur dernier post : Le Journal">Déjà abonné·e\u202f? Commenter leur dernier post →</a></li>`));
  assert.ok(html.includes(`<a class="commenter" data-comment="instagram:alicemartin" href="https://www.instagram.com/alicemartin/" ${EXTERNAL} aria-label="Commenter leur dernier post : Alice Martin">Commenter leur dernier post →</a></li>`));
  assert.ok(render('#liste/youtube', { platforms: ['youtube'] }).includes('aria-label="Déjà abonné·e\u202f? Commenter leur dernier post : L&#39;Écho &amp; &lt;Cie&gt;"'));
  assert.ok(render('#liste/bluesky', { platforms: ['bluesky'], categories: ['media'] }).includes('href="/.netlify/functions/dernier-post?compte=bluesky%3Alejournal.bsky.social"'));
});
