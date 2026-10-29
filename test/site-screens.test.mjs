import { test } from 'node:test';
import assert from 'node:assert/strict';
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
  assert.ok(html.includes('<progress max="3" value="1">'));
  assert.ok(html.includes('Suivi ✓'));
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
  assert.ok(!html.includes('<progress'));
  assert.ok(html.includes('Pas encore de compte de ta sélection sur Threads.'));
});

test('Bluesky propose Tout suivre seulement avec un starter pack', () => {
  const fields = { platforms: ['bluesky'], categories: ['media'] };
  assert.ok(!render('#liste/bluesky', fields).includes('data-follow-all'));
  const url = 'https://bsky.app/starter-pack/projet.example/partisans';
  assert.match(render('#liste/bluesky', fields, { starterPackUrl: url }), new RegExp(`data-follow-all="bluesky" href="${url}"`));
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

test('l\'accueil propose de reprendre seulement si la liste est accessible', () => {
  assert.match(render('', { platforms: ['x'] }), /href="#liste">Reprendre ma liste</);
  assert.ok(!render('', {}).includes('Reprendre ma liste'));
  assert.ok(render('', {}).includes('href="#reseaux">Commencer<'));
});
