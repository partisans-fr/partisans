import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addToTotals, handle, onRequest, parseIncrements } from '../functions/api/compter.js';
import { fakeD1 } from './helpers/fake-d1.mjs';

const post = (body) => new Request('https://partisans.test/api/compter', { method: 'POST', body });

test('les additions reçues sont lues avec prudence', () => {
  assert.deepEqual(parseIncrements('{"visiteurs":1}'), { visiteurs: 1, comptes: 0 });
  assert.deepEqual(parseIncrements('{"comptes":25}'), { visiteurs: 0, comptes: 25 });
  assert.deepEqual(parseIncrements('{"visiteurs":1,"comptes":3,"ip":"x"}'), { visiteurs: 1, comptes: 3 });
  for (const refused of ['', 'oups', 'null', '[]', '{}', '{"visiteurs":0}', '{"visiteurs":2}', '{"visiteurs":-1}',
    '{"comptes":1.5}', '{"comptes":"3"}', '{"comptes":1001}', '{"comptes":-4}']) {
    assert.equal(parseIncrements(refused), null, refused);
  }
});

test('les totaux s\'additionnent sur une seule ligne, et rien d\'autre n\'est gardé', async () => {
  const db = fakeD1();
  await addToTotals(db, { visiteurs: 1, comptes: 0 });
  await addToTotals(db, { visiteurs: 0, comptes: 25 });
  await addToTotals(db, { visiteurs: 1, comptes: 2 });
  assert.deepEqual(db.read(), [{ id: 1, visiteurs: 2, comptes: 27 }]);
});

test('la fonction refuse ce qui n\'est pas une addition, sans toucher aux totaux', async () => {
  const db = fakeD1();
  assert.equal((await handle(new Request('https://partisans.test/', { method: 'GET' }), db)).status, 405);
  assert.equal((await handle(post('{"comptes":-1}'), db)).status, 400);
  assert.equal(db.read(), null);
  assert.equal((await handle(post('{"visiteurs":1}'), db)).status, 204);
  assert.deepEqual(db.read(), [{ id: 1, visiteurs: 1, comptes: 0 }]);
});

test('base indisponible ou pas reliée : la fonction répond 503', async () => {
  assert.equal((await handle(post('{"comptes":2}'), fakeD1({ broken: true }))).status, 503);
  assert.equal((await handle(post('{"comptes":2}'), undefined)).status, 503);
});

test('Cloudflare Pages : la base arrive sous le nom DB', async () => {
  const db = fakeD1();
  assert.equal((await onRequest({ request: post('{"comptes":4}'), env: { DB: db } })).status, 204);
  assert.deepEqual(db.read(), [{ id: 1, visiteurs: 0, comptes: 4 }]);
});

test('la fonction ne journalise rien', () => {
  assert.doesNotMatch(readFileSync(new URL('../functions/api/compter.js', import.meta.url), 'utf8'), /console\./);
});
