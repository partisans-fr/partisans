// Compteur anonyme : deux totaux, les visiteurs et les comptes ouverts depuis le site, additionnés par
// une fonction Cloudflare (functions/api/compter.js). Ce navigateur se souvient seulement de ce qu'il a
// déjà compté (localStorage), pour ne rien compter deux fois. Sans stockage, rien n'est envoyé plutôt
// que de recompter à chaque visite.

export const COUNTER_KEY = 'partisans-compteur';
export const COUNTER_URL = '/api/compter';

export const emptyCounter = () => ({ visited: false, opened: [] });

export function loadCounter(storage) {
  let saved;
  try {
    saved = JSON.parse(storage?.getItem(COUNTER_KEY) ?? 'null');
  } catch {
    return emptyCounter();
  }
  if (typeof saved !== 'object' || saved === null) return emptyCounter();
  return {
    visited: saved.visited === true,
    opened: Array.isArray(saved.opened) ? saved.opened.filter((key) => typeof key === 'string') : [],
  };
}

export function saveCounter(storage, counter) {
  if (!storage) return false;
  try {
    storage.setItem(COUNTER_KEY, JSON.stringify(counter));
    return true;
  } catch {
    return false;
  }
}

export function recordVisit(counter) {
  if (counter.visited) return { counter, increments: null };
  return { counter: { ...counter, visited: true }, increments: { visiteurs: 1, comptes: 0 } };
}

export function recordOpened(counter, keys) {
  const fresh = [...new Set(keys)].filter((key) => !counter.opened.includes(key));
  if (!fresh.length) return { counter, increments: null };
  return { counter: { ...counter, opened: [...counter.opened, ...fresh] }, increments: { visiteurs: 0, comptes: fresh.length } };
}

// Enregistre d'abord : ce qui n'a pas pu être retenu n'est pas envoyé.
export function commitRecord(storage, { counter, increments }) {
  if (!increments || !saveCounter(storage, counter)) return null;
  return increments;
}
