import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { COUNTER_KEY, COUNTER_URL, commitRecord, emptyCounter, loadCounter, recordOpened, recordVisit } from '../site/lib/counter.js';
import { STORAGE_KEY } from '../site/lib/state.js';
import { fakeStorage, hostile } from './helpers/fake-storage.mjs';

// Cloudflare Pages range ses fonctions par adresse : /api/compter est servie par functions/api/compter.js.
test('le navigateur envoie à la fonction du compteur', () => {
  assert.equal(COUNTER_URL, '/api/compter');
  assert.ok(existsSync(new URL(`../functions${COUNTER_URL}.js`, import.meta.url)));
});

test('une visite ne compte qu\'une fois par navigateur', () => {
  const first = recordVisit(emptyCounter());
  assert.deepEqual(first.increments, { visiteurs: 1, comptes: 0 });
  assert.equal(recordVisit(first.counter).increments, null);
});

test('un compte ouvert ne compte qu\'une fois, d\'où qu\'il soit ouvert', () => {
  const { counter, increments } = recordOpened(emptyCounter(), ['x:a', 'x:b', 'x:a']);
  assert.deepEqual(increments, { visiteurs: 0, comptes: 2 });
  assert.deepEqual(recordOpened(counter, ['x:b', 'bluesky:c']).increments, { visiteurs: 0, comptes: 1 });
  assert.equal(recordOpened(counter, ['x:a']).increments, null);
});

test('sans stockage, rien n\'est envoyé', () => {
  const record = recordVisit(emptyCounter());
  assert.equal(commitRecord(null, record), null);
  assert.equal(commitRecord(hostile, record), null);
  const storage = fakeStorage();
  assert.deepEqual(commitRecord(storage, record), { visiteurs: 1, comptes: 0 });
  assert.deepEqual(loadCounter(storage), record.counter);
  assert.equal(commitRecord(storage, recordVisit(record.counter)), null);
});

test('un compteur abîmé repart de zéro, champ par champ', () => {
  assert.deepEqual(loadCounter(fakeStorage({ [COUNTER_KEY]: '{oups' })), emptyCounter());
  assert.deepEqual(loadCounter(fakeStorage({ [COUNTER_KEY]: '{"visited":"oui","opened":["x:a",3]}' })), { visited: false, opened: ['x:a'] });
  assert.deepEqual(loadCounter(hostile), emptyCounter());
});

test('le compteur vit à côté de l\'état du site', () => {
  assert.notEqual(COUNTER_KEY, STORAGE_KEY);
});
