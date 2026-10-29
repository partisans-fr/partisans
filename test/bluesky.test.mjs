import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeFetch } from './helpers/fake-fetch.mjs';
import { createClient, login, resolveAccounts } from '../scripts/lib/bluesky.js';

const PDS = 'https://pds.example.com';
const APP_PASSWORD = 'abcd-efgh-ijkl-mnop';
const account = { did: 'did:plc:moi', handle: 'moi.example.com', service: PDS, accessJwt: 'a1', refreshJwt: 'r1' };

const entry = (handle, fields = {}) => ({ platform: 'bluesky', handle, displayName: handle, category: 'parti', ...fields });

test('la connexion résout le PDS du handle puis ouvre la session dessus', async () => {
  const { fetch, calls } = fakeFetch({
    'GET https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle': { body: { did: 'did:plc:moi' } },
    'GET https://plc.directory/did:plc:moi': {
      body: { id: 'did:plc:moi', service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] },
    },
    [`POST ${PDS}/xrpc/com.atproto.server.createSession`]: {
      body: { did: 'did:plc:moi', handle: 'moi.example.com', accessJwt: 'a1', refreshJwt: 'r1' },
    },
  });

  const result = await login(' @Moi.Example.com ', APP_PASSWORD, { fetch });

  assert.deepEqual(result, account);
  assert.equal(calls[0].url.searchParams.get('handle'), 'moi.example.com');
  assert.deepEqual(calls.at(-1).body, { identifier: 'moi.example.com', password: APP_PASSWORD });
});

test('la connexion par e-mail passe par bsky.social et retient le PDS du document DID', async () => {
  const { fetch } = fakeFetch({
    'POST https://bsky.social/xrpc/com.atproto.server.createSession': {
      body: {
        ...account,
        didDoc: { id: 'did:plc:moi', service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: PDS }] },
      },
    },
  });
  assert.deepEqual(await login('moi@example.com', APP_PASSWORD, { fetch }), account);
});

test('la connexion refuse un mot de passe qui n\'est pas un mot de passe d\'application', async () => {
  const { fetch, calls } = fakeFetch({});
  await assert.rejects(login('moi.example.com', 'mon-vrai-mot-de-passe', { fetch }), /mot de passe d'application/);
  assert.equal(calls.length, 0);
});

test('des identifiants refusés donnent un message clair', async () => {
  const { fetch } = fakeFetch({
    'POST https://bsky.social/xrpc/com.atproto.server.createSession': {
      status: 401,
      body: { error: 'AuthenticationRequired', message: 'Invalid identifier or password' },
    },
  });
  await assert.rejects(login('moi@example.com', APP_PASSWORD, { fetch }), /Identifiant ou mot de passe d'application incorrect/);
});

test('la résolution renvoie les DID trouvés, par DID avant le handle, et les handles introuvables', async () => {
  const { fetch, calls } = fakeFetch({
    [`GET ${PDS}/xrpc/app.bsky.actor.getProfiles`]: {
      body: {
        profiles: [
          { did: 'did:plc:a', handle: 'a.example.com' },
          { did: 'did:plc:d', handle: 'nouveau-handle.example.com' },
        ],
      },
    },
  });
  const entries = [entry('a.example.com'), entry('ancien-handle.example.com', { id: 'did:plc:d' }), entry('absent.example.com')];

  const result = await resolveAccounts(createClient(account, { fetch }), entries);

  assert.deepEqual(calls[0].url.searchParams.getAll('actors'), ['a.example.com', 'did:plc:d', 'absent.example.com']);
  assert.deepEqual(result, { dids: ['did:plc:a', 'did:plc:d'], notFound: ['absent.example.com'] });
  assert.equal(calls[0].headers.authorization, 'Bearer a1');
});

test('la résolution envoie les comptes par paquets de 25', async () => {
  const { fetch, calls } = fakeFetch({
    [`GET ${PDS}/xrpc/app.bsky.actor.getProfiles`]: { body: { profiles: [] } },
  });
  const entries = Array.from({ length: 30 }, (_, index) => entry(`c${index}.example.com`));

  await resolveAccounts(createClient(account, { fetch }), entries);

  assert.deepEqual(calls.map((call) => call.url.searchParams.getAll('actors').length), [25, 5]);
});

test('une session expirée est rafraîchie, sauvegardée, puis l\'appel est rejoué', async () => {
  let attempts = 0;
  const saved = [];
  const { fetch, calls } = fakeFetch({
    [`GET ${PDS}/xrpc/app.bsky.actor.getProfiles`]: () =>
      ++attempts === 1
        ? { status: 400, body: { error: 'ExpiredToken', message: 'Token has expired' } }
        : { body: { profiles: [] } },
    [`POST ${PDS}/xrpc/com.atproto.server.refreshSession`]: { body: { ...account, accessJwt: 'a2', refreshJwt: 'r2' } },
  });

  const client = createClient(account, { fetch, onSessionUpdate: (session) => saved.push(session) });
  await resolveAccounts(client, [entry('a.example.com')]);

  assert.equal(calls[1].headers.authorization, 'Bearer r1');
  assert.equal(calls[2].headers.authorization, 'Bearer a2');
  assert.deepEqual(saved, [{ ...account, accessJwt: 'a2', refreshJwt: 'r2' }]);
});

test('un rafraîchissement refusé est une erreur d\'authentification', async () => {
  const { fetch } = fakeFetch({
    [`GET ${PDS}/xrpc/app.bsky.actor.getProfiles`]: { status: 400, body: { error: 'ExpiredToken' } },
    [`POST ${PDS}/xrpc/com.atproto.server.refreshSession`]: { status: 400, body: { error: 'ExpiredToken' } },
  });
  await assert.rejects(resolveAccounts(createClient(account, { fetch }), [entry('a.example.com')]), {
    kind: 'auth',
    message: /reconnecte-toi/,
  });
});

test('une limite de débit indique quand reprendre', async () => {
  const { fetch } = fakeFetch({
    [`POST ${PDS}/xrpc/com.atproto.repo.createRecord`]: {
      status: 429,
      headers: { 'ratelimit-reset': '1800000000' },
      body: { error: 'RateLimitExceeded' },
    },
  });
  await assert.rejects(createClient(account, { fetch }).post('com.atproto.repo.createRecord', {}), {
    kind: 'rateLimit',
    retryAt: 1800000000 * 1000,
  });
});

test('une panne réseau ou serveur est une erreur réseau', async () => {
  const unreachable = async () => {
    throw new TypeError('Failed to fetch');
  };
  await assert.rejects(createClient(account, { fetch: unreachable }).post('com.atproto.repo.createRecord', {}), { kind: 'network' });

  const { fetch } = fakeFetch({ [`POST ${PDS}/xrpc/com.atproto.repo.createRecord`]: { status: 502, body: {} } });
  await assert.rejects(createClient(account, { fetch }).post('com.atproto.repo.createRecord', {}), { kind: 'network' });
});

test('une requête refusée pour ce compte est une erreur d\'entrée, avec le message du serveur', async () => {
  const { fetch } = fakeFetch({
    [`POST ${PDS}/xrpc/com.atproto.repo.createRecord`]: {
      status: 400,
      body: { error: 'InvalidRequest', message: 'Record/subject must be a valid DID' },
    },
  });
  await assert.rejects(createClient(account, { fetch }).post('com.atproto.repo.createRecord', {}), {
    kind: 'entry',
    message: /subject must be a valid DID/,
  });
});
