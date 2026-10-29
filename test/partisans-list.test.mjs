import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseList } from '../scripts/lib/list-format.js';

// site/partisans.json est la liste servie par le site.

const list = JSON.parse(readFileSync(new URL('../site/partisans.json', import.meta.url), 'utf8'));

test('la liste Partisans est valide', () => {
  const { errors, rejected } = parseList(list);
  assert.deepEqual(errors, []);
  assert.deepEqual(rejected, []);
});

test('les six catégories sont déclarées dans l\'ordre', () => {
  assert.deepEqual(Object.entries(list.categories), [
    ['politique', 'Personnalités politiques'],
    ['media', 'Médias'],
    ['journaliste', 'Journalistes'],
    ['influenceur', 'Influenceur·ses'],
    ['parti', 'Partis et mouvements'],
    ['association', 'Associations'],
  ]);
});

test('chaque entrée a une catégorie déclarée', () => {
  for (const entry of list.entries) assert.ok(Object.hasOwn(list.categories, entry.category), `${entry.displayName} : ${entry.category}`);
});

test('une personne a une seule catégorie', () => {
  const categories = Map.groupBy(list.entries, (entry) => entry.displayName);
  for (const [name, entries] of categories) {
    assert.equal(new Set(entries.map((entry) => entry.category)).size, 1, name);
  }
});

test('les adresses de signalement et de suggestion sont renseignées', () => {
  assert.ok(list.contestUrl);
  assert.ok(list.suggestUrl);
});
