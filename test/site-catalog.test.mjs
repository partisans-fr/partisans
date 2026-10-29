import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseList } from '../scripts/lib/list-format.js';
import { accountGroups, categoryCounts, followedCount, peopleCount, platformKeys, progress } from '../site/lib/catalog.js';
import { miniList } from './helpers/partisans-fixture.mjs';

const ALL = ['politique', 'media', 'journaliste', 'influenceur', 'parti', 'association'];

test('le jeu d\'essai est une liste valide', () => {
  const { errors, rejected } = parseList(miniList);
  assert.deepEqual(errors, []);
  assert.deepEqual(rejected, []);
});

test('les catégories comptent des personnes, sur les réseaux choisis', () => {
  const counts = categoryCounts(miniList, ['instagram', 'x']);
  assert.deepEqual(counts.map((c) => c.slug), ALL);
  assert.deepEqual(counts.map((c) => c.count), [2, 1, 0, 0, 0, 1]);
  assert.deepEqual(counts.filter((c) => c.empty).map((c) => c.slug), ['journaliste']);
  assert.equal(counts[0].label, 'Personnalités politiques');
});

test('le total compte chaque personne une fois', () => {
  assert.equal(peopleCount(miniList, ['instagram', 'x', 'youtube'], ['politique', 'media']), 4);
  assert.equal(peopleCount(miniList, ['bluesky'], ['politique']), 0);
  assert.equal(peopleCount(miniList, ['instagram'], ['inconnue']), 0);
});

test('un onglet regroupe ses comptes par catégorie', () => {
  const groups = accountGroups(miniList, 'instagram', ['politique', 'media', 'association']);
  assert.deepEqual(groups.map((g) => g.slug), ['politique', 'media', 'association']);
  assert.deepEqual(groups.map((g) => g.entries.map((e) => e.handle)), [['alicemartin'], ['lejournal'], ['collectifsolidaire']]);
  assert.equal(groups[1].label, 'Médias');
  assert.deepEqual(accountGroups(miniList, 'threads', ['politique']), []);
});

test('la progression d\'un réseau ne compte que ses comptes', () => {
  assert.deepEqual(progress(miniList, 'instagram', ALL, ['instagram:alicemartin', 'x:brunopetit']), { done: 1, total: 3 });
  assert.deepEqual(progress(miniList, 'threads', ['politique'], []), { done: 0, total: 0 });
});

test('un compte retiré de la liste ne compte plus', () => {
  assert.deepEqual(progress(miniList, 'instagram', ALL, ['instagram:alicemartin', 'instagram:ancien']), { done: 1, total: 3 });
  assert.equal(
    followedCount(miniList, ['instagram', 'x'], ALL, ['instagram:alicemartin', 'x:brunopetit', 'x:ancien', 'tiktok:chloevideo']),
    2,
  );
});

test('platformKeys donne tous les comptes d\'un réseau', () => {
  assert.deepEqual(platformKeys(miniList, 'bluesky'), ['bluesky:lejournal.bsky.social']);
});
