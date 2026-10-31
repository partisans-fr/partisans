import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { imageProblems } from '../scripts/check-privacy.mjs';
import { AVATARS } from '../site/lib/avatars.js';

// site/lib/avatars.js et site/img/avatars/ sont produits par scripts/preparer-avatars.py.

const list = JSON.parse(readFileSync(new URL('../site/partisans.json', import.meta.url), 'utf8'));
const folder = new URL('../site/img/avatars/', import.meta.url);

test('chaque avatar appartient à un nom de la liste', () => {
  const names = new Set(list.entries.map((entry) => entry.displayName));
  assert.deepEqual(Object.keys(AVATARS).filter((name) => !names.has(name)), []);
});

test('chaque fichier d\'avatar existe, petit et sans métadonnées, et aucun n\'est orphelin', () => {
  const files = Object.values(AVATARS).map(({ file }) => file);
  assert.deepEqual(readdirSync(folder).sort(), [...files].sort());
  for (const file of files) {
    const buffer = readFileSync(new URL(file, folder));
    assert.ok(buffer.length <= 12 * 1024, `${file} : ${buffer.length} octets`);
    assert.deepEqual(imageProblems(file, buffer), [], file);
  }
});

test('chaque image de Wikimedia Commons a son auteur, sa licence et son adresse', () => {
  for (const [name, { credit }] of Object.entries(AVATARS)) {
    if (!credit) continue;
    assert.ok(credit.author && credit.license, name);
    assert.match(credit.url, /^https:\/\/commons\.wikimedia\.org\/wiki\/File:/, name);
  }
});
