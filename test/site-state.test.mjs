import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, emptyState, loadState, saveState, selectedCategories, setFollowed, toggle } from '../site/lib/state.js';
import { miniList } from './helpers/partisans-fixture.mjs';

// Faux localStorage sur un objet, et stockage qui refuse tout accès (navigation privée, navigateur intégré).
const fakeStorage = (data = {}) => ({
  data,
  getItem: (key) => (Object.hasOwn(data, key) ? data[key] : null),
  setItem: (key, value) => {
    data[key] = String(value);
  },
});
const hostile = {
  getItem: () => {
    throw new Error('SecurityError');
  },
  setItem: () => {
    throw new Error('SecurityError');
  },
};

test('sans rien d\'enregistré, l\'état est vide', () => {
  assert.deepEqual(loadState(fakeStorage()), emptyState());
  assert.deepEqual(emptyState(), { platforms: [], mastodonInstance: null, categories: null, followed: [] });
});

test('l\'état enregistré est relu', () => {
  const storage = fakeStorage();
  const state = { platforms: ['x', 'mastodon'], mastodonInstance: '@moi@piaille.fr', categories: ['media'], followed: ['x:a'] };
  assert.equal(saveState(storage, state), true);
  assert.ok(Object.hasOwn(storage.data, STORAGE_KEY));
  assert.deepEqual(loadState(storage), state);
});

test('un stockage qui refuse l\'accès ne casse rien', () => {
  assert.deepEqual(loadState(hostile), emptyState());
  assert.deepEqual(loadState(null), emptyState());
  assert.equal(saveState(hostile, emptyState()), false);
  assert.equal(saveState(null, emptyState()), false);
});

test('un enregistrement abîmé est remis à zéro champ par champ', () => {
  assert.deepEqual(loadState(fakeStorage({ [STORAGE_KEY]: '{oups' })), emptyState());
  assert.deepEqual(loadState(fakeStorage({ [STORAGE_KEY]: 'null' })), emptyState());
  const damaged = '{"platforms":["x","myspace","x"],"mastodonInstance":42,"categories":"media","followed":["x:a",7]}';
  assert.deepEqual(loadState(fakeStorage({ [STORAGE_KEY]: damaged })), {
    platforms: ['x'],
    mastodonInstance: null,
    categories: null,
    followed: ['x:a'],
  });
});

test('marquer et démarquer un compte', () => {
  const start = emptyState();
  const marked = setFollowed(start, ['x:a', 'x:b'], true);
  assert.deepEqual(marked.followed, ['x:a', 'x:b']);
  assert.deepEqual(setFollowed(marked, ['x:a'], true).followed, ['x:a', 'x:b']);
  assert.deepEqual(setFollowed(marked, ['x:a'], false).followed, ['x:b']);
  assert.deepEqual(start, emptyState());
  assert.deepEqual(marked.followed, ['x:a', 'x:b']);
});

test('cocher et décocher', () => {
  assert.deepEqual(toggle(['x'], 'instagram'), ['x', 'instagram']);
  assert.deepEqual(toggle(['x', 'instagram'], 'x'), ['instagram']);
});

test('les catégories non choisies valent toutes, les inconnues sont ignorées', () => {
  assert.deepEqual(selectedCategories(miniList, emptyState()), ['politique', 'media', 'journaliste', 'influenceur', 'parti', 'association']);
  assert.deepEqual(selectedCategories(miniList, { ...emptyState(), categories: ['media', 'ancienne'] }), ['media']);
});
