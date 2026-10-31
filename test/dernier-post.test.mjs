import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { handle, onRequest } from '../functions/api/dernier-post.js';
import { fakeFetch } from './helpers/fake-fetch.mjs';
import { miniList } from './helpers/partisans-fixture.mjs';

const FEED = 'GET https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed';
const feed = { feed: [
  { post: { uri: 'at://did:plc:abc/app.bsky.feed.post/3krepost' }, reason: { $type: 'app.bsky.feed.defs#reasonRepost' } },
  { post: { uri: 'at://did:plc:abc/app.bsky.feed.post/3kdernier' } },
] };
const ask = (query) => new Request(`https://partisans.test/api/dernier-post?${query}`);
const redirectOf = async (query, fetch, timeoutMs) => {
  const response = await handle(ask(query), { list: miniList, fetch, timeoutMs });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  return response.headers.get('location');
};

test('Bluesky : le dernier post, sans les repartages ni les réponses', async () => {
  const { fetch, calls } = fakeFetch({ [FEED]: { body: feed } });
  assert.equal(await redirectOf('compte=bluesky%3Alejournal.bsky.social', fetch), 'https://bsky.app/profile/lejournal.bsky.social/post/3kdernier');
  assert.equal(calls[0].url.searchParams.get('actor'), 'lejournal.bsky.social');
  assert.equal(calls[0].url.searchParams.get('filter'), 'posts_no_replies');
});

test('sans post trouvé, la page du compte', async () => {
  const profile = 'https://bsky.app/profile/lejournal.bsky.social';
  const query = 'compte=bluesky%3Alejournal.bsky.social';
  assert.equal(await redirectOf(query, fakeFetch({ [FEED]: { body: { feed: [] } } }).fetch), profile);
  assert.equal(await redirectOf(query, fakeFetch({ [FEED]: { status: 500 } }).fetch), profile);
  assert.equal(await redirectOf(query, fakeFetch({ [FEED]: { body: { feed: [{ post: { uri: 'https://ailleurs.example/x' } }] } } }).fetch), profile);
  assert.equal(await redirectOf(query, async () => { throw new Error('réseau'); }), profile);
  const slow = (url, { signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
  assert.equal(await redirectOf(query, slow, 10), profile);
});

test('un autre réseau mène à la page du compte, sans appel', async () => {
  const { fetch, calls } = fakeFetch({});
  assert.equal(await redirectOf('compte=x%3Aalicemartin', fetch), 'https://x.com/alicemartin');
  assert.equal(calls.length, 0);
});

test('un compte hors de la liste est refusé', async () => {
  for (const query of ['compte=bluesky%3Ainconnu.bsky.social', 'compte=', '']) {
    assert.equal((await handle(ask(query), { list: miniList, fetch: fakeFetch({}).fetch })).status, 404, query);
  }
});

test('Cloudflare Pages : la fonction lit la liste du site', async () => {
  const response = await onRequest({ request: ask('compte=inconnu%3Apersonne') });
  assert.equal(response.status, 404);
});

test('la fonction ne journalise rien', () => {
  assert.doesNotMatch(readFileSync(new URL('../functions/api/dernier-post.js', import.meta.url), 'utf8'), /console\./);
});
