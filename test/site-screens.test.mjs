import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXTERNAL } from '../site/lib/html.js';
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

test('l\'écran des catégories compte les personnes', () => {
  const platforms = ['instagram', 'x'];
  const all = render('#categories', { platforms });
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
  assert.ok(html.includes('<li class="compte est-suivi"><span class="nom">Alice Martin</span>'));
  assert.ok(html.includes('<li class="compte"><span class="nom">Le Journal</span>'));
  assert.ok(html.includes('<span class="suivi">✓ Suivi</span>'));
  assert.ok(html.includes('<section class="groupe teinte-ardoise"><h2>Personnalités politiques</h2>'));
  assert.ok(html.includes('<section class="groupe teinte-ocre"><h2>Médias</h2>'));
  assert.ok(html.includes('<section class="groupe teinte-sauge"><h2>Associations</h2>'));
  assert.ok(html.includes('data-unfollow="instagram:alicemartin"'));
  assert.ok(html.includes('data-follow="instagram:lejournal" href="https://www.instagram.com/lejournal/"'));
  assertInOrder(html, ['<h2>Personnalités politiques</h2>', '<h2>Médias</h2>', '<h2>Associations</h2>']);
  assert.ok(html.includes('href="https://example.com/signaler"'));
  assert.ok(html.includes('href="https://example.com/suggerer"'));
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
  assert.ok(render('#liste/bluesky', fields, { starterPackUrl: url }).includes('class="btn secondaire" data-follow-all="bluesky"'));
});

test('les noms sont échappés', () => {
  const html = render('#liste/youtube', { platforms: ['youtube'], categories: ['media'] });
  assert.ok(html.includes('L&#39;Écho &amp; &lt;Cie&gt;'));
  assert.ok(!html.includes('<Cie>'));
});

test('la fin compte les abonnements et porte le message', () => {
  const platforms = ['instagram', 'x'];
  const html = render('#fin', { platforms, followed: ['instagram:alicemartin', 'x:alicemartin'] });
  assert.ok(html.includes('C\'est fait : 2 abonnements.'));
  assert.ok(render('#fin', { platforms, followed: ['x:alicemartin'] }).includes('C\'est fait : 1 abonnement.'));
  assert.ok(render('#fin', { platforms }).includes('Ta liste t\'attend.'));
  assertInOrder(html, [
    'Maintenant, chaque jour, sur leurs posts :',
    'Aime.',
    'Partage.',
    'Commente.',
    'Et l\'extrême droite ?',
    'Ignore-la.',
    'Ne réponds pas, ne cite pas, passe ton chemin.',
  ]);
  assert.ok(html.includes('<button class="btn" data-share>Partager le site</button>'));
  assert.ok(html.includes('<p class="statut" role="status"></p>'));
});

test('chaque écran du parcours a la barre au logo et au plus un bouton rouge plein', () => {
  const fields = { platforms: ['instagram', 'bluesky'], followed: ['instagram:alicemartin'] };
  for (const hash of ['#reseaux', '#categories', '#liste/instagram', '#liste/bluesky', '#fin']) {
    const html = render(hash, fields, { starterPackUrl: 'https://bsky.app/starter-pack/projet.example/partisans' });
    assert.ok(html.includes('<header class="barre"><span class="symbole" aria-hidden="true"></span><span class="logotype">partisans</span>'), hash);
    assert.ok((html.match(/class="btn"/g) ?? []).length <= 1, hash);
  }
  assert.ok(render('#liste/instagram', fields).includes('<a class="btn secondaire" href="#fin">J\'ai fini</a>'));
});

test('chaque compte propose de commenter son dernier post', () => {
  const html = render('#liste/instagram', { platforms: ['instagram'], followed: ['instagram:alicemartin'] });
  assert.ok(html.includes(`<a class="commenter" data-comment="instagram:lejournal" href="https://www.instagram.com/lejournal/" ${EXTERNAL} aria-label="Déjà abonné ? Commenter leur dernier post : Le Journal">Déjà abonné ? Commenter leur dernier post →</a></li>`));
  assert.ok(html.includes(`<a class="commenter" data-comment="instagram:alicemartin" href="https://www.instagram.com/alicemartin/" ${EXTERNAL} aria-label="Commenter leur dernier post : Alice Martin">Commenter leur dernier post →</a></li>`));
  assert.ok(render('#liste/youtube', { platforms: ['youtube'] }).includes('aria-label="Déjà abonné ? Commenter leur dernier post : L&#39;Écho &amp; &lt;Cie&gt;"'));
  assert.ok(render('#liste/bluesky', { platforms: ['bluesky'], categories: ['media'] }).includes('href="/.netlify/functions/dernier-post?compte=bluesky%3Alejournal.bsky.social"'));
});
