// Additionne les visites et les comptes ouverts envoyés par les navigateurs (site/lib/counter.js).
// Ne garde que deux totaux, ne lit ni l'adresse IP ni les en-têtes de la requête, ne journalise rien.
// Les totaux se lisent dans l'interface Netlify : Data & Storage > Blobs > compteur > totaux.

import { getStore } from '@netlify/blobs';

export const TOTALS_KEY = 'totaux';
export const MAX_ACCOUNTS = 1000;

// Une addition valide : visiteurs 0 ou 1, comptes entier de 0 à MAX_ACCOUNTS, pas les deux à 0.
// Un champ absent vaut 0, les autres champs sont ignorés.
export function parseIncrements(text) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const { visiteurs = 0, comptes = 0 } = body;
  if (visiteurs !== 0 && visiteurs !== 1) return null;
  if (!Number.isInteger(comptes) || comptes < 0 || comptes > MAX_ACCOUNTS) return null;
  if (visiteurs === 0 && comptes === 0) return null;
  return { visiteurs, comptes };
}

// Écriture conditionnelle : si un autre envoi a écrit entre notre lecture et notre écriture, on relit
// et on recommence, pour que deux additions simultanées comptent toutes les deux.
export async function addToTotals(store, increments, attempts = 5) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const current = await store.getWithMetadata(TOTALS_KEY, { type: 'json' });
    const totals = {
      visiteurs: (current?.data.visiteurs ?? 0) + increments.visiteurs,
      comptes: (current?.data.comptes ?? 0) + increments.comptes,
    };
    const { modified } = await store.setJSON(TOTALS_KEY, totals, current ? { onlyIfMatch: current.etag } : { onlyIfNew: true });
    if (modified) return totals;
  }
  return null;
}

export async function handle(request, store) {
  if (request.method !== 'POST') return new Response(null, { status: 405 });
  const increments = parseIncrements(await request.text());
  if (!increments) return new Response(null, { status: 400 });
  return new Response(null, { status: (await addToTotals(store, increments)) ? 204 : 503 });
}

export default (request) => handle(request, getStore({ name: 'compteur', consistency: 'strong' }));
