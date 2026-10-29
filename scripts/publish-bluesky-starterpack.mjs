#!/usr/bin/env node
// Publie les comptes Bluesky d'une liste en starter pack : un bouton « Tout suivre » dans Bluesky.
// Le starter pack s'appuie sur une liste de référence (app.bsky.graph.list) qui porte les comptes.
// Relancer le script synchronise la liste (ajouts et retraits).
//
//   node --env-file=.env scripts/publish-bluesky-starterpack.mjs site/partisans.json [--rkey <clé>] [--dry-run]
//
// Identifiants dans .env (jamais commité) : BLUESKY_IDENTIFIER et BLUESKY_APP_PASSWORD.
// Le starter pack appartient au compte qui le publie : utilise le compte du projet, jamais un
// compte personnel. La liste et le starter pack partagent la même clé, au format TID imposé par
// Bluesky : celle du starter pack du compte qui porte le nom de la liste, sinon une nouvelle
// (--rkey pour en forcer une).
// L'adresse affichée à la fin va dans STARTER_PACK_URL (site/config.js).

import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { createClient, login, resolveAccounts } from './lib/bluesky.js';
import { parseList } from './lib/list-format.js';

export const STARTER_PACK_MAX = 150; // comptes au plus dans un starter pack
const LIST_NAME_MAX = 64; // limites des lexiques app.bsky.graph.list et starterpack, en caractères
const PACK_NAME_MAX = 50;
const DESCRIPTION_MAX = 300;
const WRITES_PER_REQUEST = 50;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function truncate(text, max) {
  const characters = [...text];
  return characters.length <= max ? text : `${characters.slice(0, max - 1).join('')}…`;
}

const BASE32_SORTABLE = '234567abcdefghijklmnopqrstuvwxyz';

// Clé d'enregistrement au format TID : 13 caractères en base 32 triable, qui codent les
// microsecondes depuis 1970 suivies d'un identifiant d'horloge sur 10 bits.
export function tid(micros = BigInt(Date.now()) * 1000n, clockId = BigInt(randomInt(1024))) {
  let value = (micros << 10n) | clockId;
  let key = '';
  for (let i = 0; i < 13; i += 1) {
    key = BASE32_SORTABLE[Number(value & 31n)] + key;
    value >>= 5n;
  }
  return key;
}

const rkeyOf = (uri) => uri.split('/').pop();

// Enregistrement du compte connecté, ou null s'il n'existe pas.
async function findRecord(client, collection, rkey) {
  try {
    return await client.get('com.atproto.repo.getRecord', { repo: client.did, collection, rkey });
  } catch (error) {
    if (error.code === 'RecordNotFound') return null;
    throw error;
  }
}

// Une clé ne doit jamais changer le type d'une liste existante : une liste de référence devenue
// liste de modération ferait bloquer ses comptes par tous ses abonnés (et inversement).
function checkPurpose(existing, purpose, key) {
  if (existing && existing.value.purpose !== purpose) {
    throw new Error(`la clé ${key} désigne déjà une liste d'un autre type (${existing.value.purpose}) : passe une autre --rkey.`);
  }
}

// Les enregistrements sont lus dans le dépôt du compte (et non via l'AppView, qui peut être en retard).
async function listRecords(client, collection) {
  const records = [];
  let cursor;
  do {
    const page = await client.get('com.atproto.repo.listRecords', {
      repo: client.did,
      collection,
      limit: 100,
      ...(cursor && { cursor }),
    });
    records.push(...page.records);
    cursor = page.records.length ? page.cursor : undefined;
  } while (cursor);
  return records;
}

// Clé du starter pack du compte qui porte ce nom, ou null s'il n'existe pas encore.
async function findPackKey(client, name) {
  const pack = (await listRecords(client, 'app.bsky.graph.starterpack')).find(({ value }) => value.name === name);
  return pack ? rkeyOf(pack.uri) : null;
}

async function listItems(client, listUri) {
  return (await listRecords(client, 'app.bsky.graph.listitem'))
    .filter(({ value }) => value.list === listUri)
    .map(({ uri, value }) => ({ rkey: rkeyOf(uri), subject: value.subject }));
}

// Garde un élément par compte voulu, retire les autres (comptes sortis de la liste, doublons).
function syncPlan(dids, items) {
  const wanted = new Set(dids);
  const kept = new Set();
  const toRemove = [];
  for (const item of items) {
    if (wanted.has(item.subject) && !kept.has(item.subject)) kept.add(item.subject);
    else toRemove.push(item.rkey);
  }
  return { toAdd: dids.filter((did) => !kept.has(did)), toRemove };
}

async function withRateLimit(action, { sleep, log }) {
  for (;;) {
    try {
      return await action();
    } catch (error) {
      if (error.kind !== 'rateLimit') throw error;
      log(`Limite de débit atteinte, reprise vers ${new Date(error.retryAt).toLocaleTimeString('fr-FR')}…`);
      await sleep(Math.max(error.retryAt - Date.now(), 1000));
    }
  }
}

async function writeListItems(client, listUri, { toAdd, toRemove }, { sleep, log }) {
  const createdAt = new Date().toISOString();
  const writes = [
    ...toAdd.map((did) => ({
      $type: 'com.atproto.repo.applyWrites#create',
      collection: 'app.bsky.graph.listitem',
      value: { $type: 'app.bsky.graph.listitem', subject: did, list: listUri, createdAt },
    })),
    ...toRemove.map((itemKey) => ({
      $type: 'com.atproto.repo.applyWrites#delete',
      collection: 'app.bsky.graph.listitem',
      rkey: itemKey,
    })),
  ];
  for (let start = 0; start < writes.length; start += WRITES_PER_REQUEST) {
    const chunk = writes.slice(start, start + WRITES_PER_REQUEST);
    await withRateLimit(() => client.post('com.atproto.repo.applyWrites', { repo: client.did, writes: chunk }), { sleep, log });
    log(`${Math.min(start + WRITES_PER_REQUEST, writes.length)}/${writes.length} écritures.`);
  }
}

export function starterPackRecords(list, { listUri, listCreatedAt, packCreatedAt }) {
  return {
    list: {
      $type: 'app.bsky.graph.list',
      purpose: 'app.bsky.graph.defs#referencelist',
      name: truncate(list.name, LIST_NAME_MAX),
      createdAt: listCreatedAt,
    },
    starterPack: {
      $type: 'app.bsky.graph.starterpack',
      name: truncate(list.name, PACK_NAME_MAX),
      ...(list.description && { description: truncate(list.description, DESCRIPTION_MAX) }),
      list: listUri,
      createdAt: packCreatedAt,
    },
  };
}

export async function publishStarterPack({
  list: raw,
  identifier,
  password,
  rkey,
  dryRun = false,
  newKey = tid,
  fetch = globalThis.fetch,
  log = console.log,
  sleep = wait,
}) {
  const { list, errors, rejected } = parseList(raw);
  const problems = [...errors, ...rejected.map((r) => r.message)];
  if (problems.length) throw new Error(`liste invalide :\n  - ${problems.join('\n  - ')}`);

  const account = await login(identifier, password, { fetch });
  const client = createClient(account, { fetch });
  const key = rkey ?? (await findPackKey(client, truncate(list.name, PACK_NAME_MAX))) ?? newKey();
  const listUri = `at://${client.did}/app.bsky.graph.list/${key}`;
  const starterPackUri = `at://${client.did}/app.bsky.graph.starterpack/${key}`;
  const existingList = await findRecord(client, 'app.bsky.graph.list', key);
  checkPurpose(existingList, 'app.bsky.graph.defs#referencelist', key);
  const existingPack = await findRecord(client, 'app.bsky.graph.starterpack', key);
  const { dids, notFound } = await resolveAccounts(client, list.entries.filter((entry) => entry.platform === 'bluesky'));
  if (dids.length > STARTER_PACK_MAX) {
    throw new Error(`trop de comptes Bluesky pour un starter pack (${dids.length}, ${STARTER_PACK_MAX} au plus)`);
  }
  const { toAdd, toRemove } = syncPlan(dids, await listItems(client, listUri));

  log(`${existingPack ? 'Mise à jour' : 'Création'} de ${starterPackUri}`);
  log(`${dids.length} comptes trouvés, ${toAdd.length} à ajouter, ${toRemove.length} à retirer.`);
  for (const handle of notFound) log(`  introuvable, ignoré : ${handle}`);
  const url = `https://bsky.app/starter-pack/${account.handle}/${key}`;
  const report = { listUri, starterPackUri, url, created: !existingPack, added: toAdd.length, removed: toRemove.length, notFound };
  if (dryRun) return report;

  const now = new Date().toISOString();
  const records = starterPackRecords(list, {
    listUri,
    listCreatedAt: existingList?.value.createdAt ?? now,
    packCreatedAt: existingPack?.value.createdAt ?? now,
  });
  const put = (collection, record) => client.post('com.atproto.repo.putRecord', { repo: client.did, collection, rkey: key, record });
  await put('app.bsky.graph.list', records.list);
  await writeListItems(client, listUri, { toAdd, toRemove }, { sleep, log });
  await put('app.bsky.graph.starterpack', records.starterPack);
  return report;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { rkey: { type: 'string' }, 'dry-run': { type: 'boolean' } },
  });
  const { BLUESKY_IDENTIFIER: identifier, BLUESKY_APP_PASSWORD: password } = process.env;
  if (positionals.length !== 1 || !identifier || !password) {
    console.error('Usage : node --env-file=.env scripts/publish-bluesky-starterpack.mjs <liste.json> [--rkey <clé>] [--dry-run]');
    console.error('avec BLUESKY_IDENTIFIER et BLUESKY_APP_PASSWORD dans .env.');
    process.exit(2);
  }
  const list = JSON.parse(readFileSync(positionals[0], 'utf8'));
  const report = await publishStarterPack({ list, identifier, password, rkey: values.rkey, dryRun: values['dry-run'] });
  if (values['dry-run']) {
    console.log('Simulation terminée, rien n\'a été écrit.');
    if (report.created) return console.log('Nouveau starter pack : sa clé sera tirée à la publication.');
  }
  console.log(`Adresse du starter pack, à reporter dans STARTER_PACK_URL (site/config.js) : ${report.url}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Échec : ${error.message}`);
    process.exit(1);
  });
}
