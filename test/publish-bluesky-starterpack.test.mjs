import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from './helpers/fake-fetch.mjs';
import { STARTER_PACK_MAX, publishStarterPack, slugify, starterPackRecords } from '../scripts/publish-bluesky-starterpack.mjs';

const PDS = 'https://bsky.social';
const LIST_URI = 'at://did:plc:projet/app.bsky.graph.list/liste-de-test';
const PACK_URI = 'at://did:plc:projet/app.bsky.graph.starterpack/liste-de-test';

const entry = (platform, handle) => ({
  platform,
  handle,
  displayName: handle,
  category: 'media',
  source: 'https://example.com/source',
  addedAt: '2026-10-28',
});

const list = {
  schemaVersion: 1,
  name: 'Liste de test',
  description: 'Des comptes à suivre.',
  maintainer: { name: 'Mainteneur fictif' },
  contestUrl: 'https://example.com/signaler',
  version: '1',
  entries: [entry('bluesky', 'a.example.com'), entry('bluesky', 'b.example.com'), entry('bluesky', 'absent.example.com'), entry('x', 'nom')],
};

// Routes du PDS : getRecord répond selon la collection demandée ; getProfiles trouve tout compte
// demandé sauf absent.example.com ; listRecords renvoie existingItems.
function blueskyRoutes({ existing = {}, listPurpose = 'app.bsky.graph.defs#referencelist', existingItems = [] } = {}) {
  const writes = [];
  const routes = {
    [`POST ${PDS}/xrpc/com.atproto.server.createSession`]: {
      body: { did: 'did:plc:projet', handle: 'projet.example.com', accessJwt: 'a', refreshJwt: 'r' },
    },
    [`GET ${PDS}/xrpc/com.atproto.repo.getRecord`]: ({ url }) => {
      const collection = url.searchParams.get('collection');
      const createdAt = existing[collection];
      const purpose = collection === 'app.bsky.graph.list' ? { purpose: listPurpose } : {};
      return createdAt
        ? { body: { uri: 'at://…', value: { ...purpose, createdAt } } }
        : { status: 400, body: { error: 'RecordNotFound', message: 'Could not locate record' } };
    },
    [`GET ${PDS}/xrpc/app.bsky.actor.getProfiles`]: ({ url }) => ({
      body: {
        profiles: url.searchParams
          .getAll('actors')
          .filter((handle) => handle !== 'absent.example.com')
          .map((handle) => ({ did: `did:plc:${handle.split('.')[0]}`, handle })),
      },
    }),
    [`GET ${PDS}/xrpc/com.atproto.repo.listRecords`]: { body: { records: existingItems } },
    [`POST ${PDS}/xrpc/com.atproto.repo.putRecord`]: ({ body }) => {
      writes.push({ put: body });
      return { body: {} };
    },
    [`POST ${PDS}/xrpc/com.atproto.repo.applyWrites`]: ({ body }) => {
      writes.push({ applyWrites: body.writes });
      return { body: {} };
    },
  };
  return { routes, writes };
}

const item = (rkey, subject, listUri = LIST_URI) => ({
  uri: `at://did:plc:projet/app.bsky.graph.listitem/${rkey}`,
  value: { $type: 'app.bsky.graph.listitem', subject, list: listUri },
});

const options = (fetch, extra = {}) => ({
  list,
  identifier: 'projet@example.com',
  password: 'abcd-efgh-ijkl-mnop',
  fetch,
  log: () => {},
  ...extra,
});

test('la clé est dérivée du nom de la liste', () => {
  assert.equal(slugify('Liste exemple (fictive)'), 'liste-exemple-fictive');
  assert.equal(slugify('Comptes à découvrir'), 'comptes-a-decouvrir');
});

test('les enregistrements forment une liste de référence et un starter pack qui la vise', () => {
  const long = { ...list, name: 'N'.repeat(80), description: 'd'.repeat(400) };
  const records = starterPackRecords(long, { listUri: LIST_URI, listCreatedAt: '2026-01-01', packCreatedAt: '2026-01-02' });
  assert.equal(records.list.$type, 'app.bsky.graph.list');
  assert.equal(records.list.purpose, 'app.bsky.graph.defs#referencelist');
  assert.equal([...records.list.name].length, 64);
  assert.equal(records.list.createdAt, '2026-01-01');
  assert.equal(records.starterPack.$type, 'app.bsky.graph.starterpack');
  assert.equal(records.starterPack.list, LIST_URI);
  assert.equal([...records.starterPack.name].length, 50);
  assert.equal([...records.starterPack.description].length, 300);
  assert.equal(records.starterPack.createdAt, '2026-01-02');
  const { description, ...withoutDescription } = list;
  assert.ok(!('description' in starterPackRecords(withoutDescription, { listUri: LIST_URI }).starterPack));
});

test('une première publication crée la liste, ses comptes, puis le starter pack', async () => {
  const { routes, writes } = blueskyRoutes();
  const { fetch } = fakeFetch(routes);

  const report = await publishStarterPack(options(fetch));

  assert.deepEqual(report, {
    listUri: LIST_URI,
    starterPackUri: PACK_URI,
    url: 'https://bsky.app/starter-pack/projet.example.com/liste-de-test',
    added: 2,
    removed: 0,
    notFound: ['absent.example.com'],
  });
  assert.deepEqual(
    writes.map((w) => (w.put ? `putRecord ${w.put.collection} ${w.put.rkey}` : 'applyWrites')),
    ['putRecord app.bsky.graph.list liste-de-test', 'applyWrites', 'putRecord app.bsky.graph.starterpack liste-de-test'],
  );
  assert.deepEqual(writes[1].applyWrites.map((w) => [w.value.subject, w.value.list]), [
    ['did:plc:a', LIST_URI],
    ['did:plc:b', LIST_URI],
  ]);
  assert.equal(writes[2].put.record.list, LIST_URI);
});

test('une republication garde les dates de création', async () => {
  const { routes, writes } = blueskyRoutes({
    existing: { 'app.bsky.graph.list': '2025-01-01T00:00:00.000Z', 'app.bsky.graph.starterpack': '2025-02-01T00:00:00.000Z' },
  });
  const { fetch } = fakeFetch(routes);

  await publishStarterPack(options(fetch));

  const puts = writes.filter((w) => w.put).map((w) => w.put.record.createdAt);
  assert.deepEqual(puts, ['2025-01-01T00:00:00.000Z', '2025-02-01T00:00:00.000Z']);
});

test('une republication synchronise : ajoute les manquants, retire les comptes sortis de la liste', async () => {
  const { routes, writes } = blueskyRoutes({
    existing: { 'app.bsky.graph.list': '2025-01-01T00:00:00.000Z' },
    existingItems: [
      item('1', 'did:plc:a'),
      item('2', 'did:plc:retire'),
      item('3', 'did:plc:a'), // doublon
      item('4', 'did:plc:b', 'at://did:plc:projet/app.bsky.graph.list/autre-liste'),
    ],
  });
  const { fetch } = fakeFetch(routes);

  const report = await publishStarterPack(options(fetch));

  assert.deepEqual([report.added, report.removed], [1, 2]);
  assert.deepEqual(writes[1].applyWrites.map((w) => [w.$type, w.value?.subject ?? w.rkey]), [
    ['com.atproto.repo.applyWrites#create', 'did:plc:b'],
    ['com.atproto.repo.applyWrites#delete', '2'],
    ['com.atproto.repo.applyWrites#delete', '3'],
  ]);
});

test('plus de 150 comptes : refus avant toute écriture', async () => {
  const { routes, writes } = blueskyRoutes();
  const { fetch } = fakeFetch(routes);
  const many = { ...list, entries: Array.from({ length: STARTER_PACK_MAX + 1 }, (_, i) => entry('bluesky', `compte${i}.example.com`)) };

  await assert.rejects(publishStarterPack(options(fetch, { list: many })), /151, 150 au plus/);
  assert.deepEqual(writes, []);
});

test('une clé déjà prise par une liste d\'un autre type est refusée avant toute écriture', async () => {
  const { routes, writes } = blueskyRoutes({
    existing: { 'app.bsky.graph.list': '2025-01-01T00:00:00.000Z' },
    listPurpose: 'app.bsky.graph.defs#modlist',
  });
  const { fetch } = fakeFetch(routes);

  await assert.rejects(publishStarterPack(options(fetch)), /liste-de-test désigne déjà une liste d'un autre type/);
  assert.deepEqual(writes, []);
});

test('en simulation, rien n\'est écrit', async () => {
  const { routes, writes } = blueskyRoutes();
  const { fetch } = fakeFetch(routes);

  const report = await publishStarterPack(options(fetch, { dryRun: true }));

  assert.equal(report.added, 2);
  assert.deepEqual(writes, []);
});
