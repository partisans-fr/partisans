import { test } from 'node:test';
import assert from 'node:assert/strict';
import { followUrl, normalizeInstance, siteUrl } from '../site/lib/links.js';
import { miniList } from './helpers/partisans-fixture.mjs';

const entryOf = (platform) => miniList.entries.find((entry) => entry.platform === platform);
const linkOf = (platform) => followUrl(entryOf(platform), { mastodonInstance: 'piaille.fr' });

test('chaque réseau a son lien d\'abonnement', () => {
  assert.equal(linkOf('x'), 'https://x.com/intent/follow?screen_name=alicemartin');
  assert.equal(linkOf('instagram'), 'https://www.instagram.com/alicemartin/');
  assert.equal(linkOf('tiktok'), 'https://www.tiktok.com/@chloevideo');
  assert.equal(linkOf('youtube'), 'https://www.youtube.com/@echo-cie?sub_confirmation=1');
  assert.equal(linkOf('threads'), 'https://www.threads.com/@mouvementcommun');
  assert.equal(linkOf('bluesky'), 'https://bsky.app/profile/lejournal.bsky.social');
  assert.equal(linkOf('mastodon'), 'https://piaille.fr/authorize_interaction?uri=echo%40exemple.social');
  assert.equal(linkOf('facebook'), 'https://www.facebook.com/collectifsolidaire');
});

test('un pseudo YouTube hors ASCII est encodé', () => {
  const entry = { ...entryOf('youtube'), handle: 'médiaçà' };
  assert.equal(followUrl(entry, { mastodonInstance: null }), 'https://www.youtube.com/@m%C3%A9dia%C3%A7%C3%A0?sub_confirmation=1');
});

test('l\'instance Mastodon se reconnaît sous toutes ses formes', () => {
  assert.equal(normalizeInstance('mastodon.social'), 'mastodon.social');
  assert.equal(normalizeInstance(' Piaille.FR '), 'piaille.fr');
  assert.equal(normalizeInstance('@moi@piaille.fr'), 'piaille.fr');
  assert.equal(normalizeInstance('moi@piaille.fr'), 'piaille.fr');
  assert.equal(normalizeInstance('https://piaille.fr/@moi'), 'piaille.fr');
  assert.equal(normalizeInstance('http://mastodon.social/'), 'mastodon.social');
  for (const refused of ['piaille', '', null, 'pi aille.fr']) assert.equal(normalizeInstance(refused), null, String(refused));
});

test('le lien partagé est l\'adresse publique, ou la page en cours avant la mise en ligne', () => {
  assert.equal(siteUrl('https://partisans.invalid/', 'https://exemple.org/site/#liste'), 'https://exemple.org/site/');
  assert.equal(siteUrl('https://partisans.fr/', 'http://localhost:8000/#fin'), 'https://partisans.fr/');
  assert.equal(siteUrl(null, 'http://localhost:8000/#fin'), 'http://localhost:8000/');
});
