import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { addToTotals, handle, parseIncrements } from '../netlify/functions/compter.mjs';

// Faux magasin Netlify Blobs : etag, écritures conditionnelles, et des visites concurrentes qui
// se glissent avant chacune de nos écritures, tant qu'il en reste.
function fakeStore({ concurrentVisits = 0 } = {}) {
  let entry = null;
  let version = 0;
  let pending = concurrentVisits;
  const write = (data) => (entry = { data, etag: `v${++version}` });
  return {
    read: () => entry?.data ?? null,
    async getWithMetadata() {
      return entry ? { data: structuredClone(entry.data), etag: entry.etag, metadata: {} } : null;
    },
    async setJSON(key, data, { onlyIfMatch, onlyIfNew } = {}) {
      if (pending > 0) {
        pending -= 1;
        write({ visiteurs: (entry?.data.visiteurs ?? 0) + 1, comptes: entry?.data.comptes ?? 0 });
      }
      if ((onlyIfNew && entry) || (onlyIfMatch && entry?.etag !== onlyIfMatch)) return { modified: false };
      write(data);
      return { modified: true, etag: entry.etag };
    },
  };
}
const post = (body) => new Request('https://partisans.test/.netlify/functions/compter', { method: 'POST', body });

test('les additions reçues sont lues avec prudence', () => {
  assert.deepEqual(parseIncrements('{"visiteurs":1}'), { visiteurs: 1, comptes: 0 });
  assert.deepEqual(parseIncrements('{"comptes":25}'), { visiteurs: 0, comptes: 25 });
  assert.deepEqual(parseIncrements('{"visiteurs":1,"comptes":3,"ip":"x"}'), { visiteurs: 1, comptes: 3 });
  for (const refused of ['', 'oups', 'null', '[]', '{}', '{"visiteurs":0}', '{"visiteurs":2}', '{"visiteurs":-1}',
    '{"comptes":1.5}', '{"comptes":"3"}', '{"comptes":1001}', '{"comptes":-4}']) {
    assert.equal(parseIncrements(refused), null, refused);
  }
});

test('les totaux s\'additionnent, et rien d\'autre n\'est gardé', async () => {
  const store = fakeStore();
  await addToTotals(store, { visiteurs: 1, comptes: 0 });
  await addToTotals(store, { visiteurs: 0, comptes: 25 });
  assert.deepEqual(store.read(), { visiteurs: 1, comptes: 25 });
});

test('une écriture concurrente ne fait rien perdre', async () => {
  const store = fakeStore({ concurrentVisits: 2 });
  assert.deepEqual(await addToTotals(store, { visiteurs: 0, comptes: 3 }), { visiteurs: 2, comptes: 3 });
  assert.deepEqual(store.read(), { visiteurs: 2, comptes: 3 });
});

test('la fonction refuse ce qui n\'est pas une addition, sans toucher aux totaux', async () => {
  const store = fakeStore();
  assert.equal((await handle(new Request('https://partisans.test/', { method: 'GET' }), store)).status, 405);
  assert.equal((await handle(post('{"comptes":-1}'), store)).status, 400);
  assert.equal(store.read(), null);
  assert.equal((await handle(post('{"visiteurs":1}'), store)).status, 204);
  assert.deepEqual(store.read(), { visiteurs: 1, comptes: 0 });
});

test('trop de collisions : la fonction abandonne', async () => {
  assert.equal((await handle(post('{"comptes":2}'), fakeStore({ concurrentVisits: 99 }))).status, 503);
});

test('la fonction ne journalise rien', () => {
  assert.doesNotMatch(readFileSync(new URL('../netlify/functions/compter.mjs', import.meta.url), 'utf8'), /console\./);
});
