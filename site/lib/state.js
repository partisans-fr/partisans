// Choix et progression de la personne, gardés dans son navigateur (localStorage).
// Un stockage absent, refusé ou abîmé ne bloque rien : la progression n'est simplement pas gardée.

import { PLATFORMS } from './catalog.js';

export const STORAGE_KEY = 'partisans';

// categories: null = pas encore choisies, donc toutes cochées ; mastodonInstance = texte saisi tel quel.
export const emptyState = () => ({ platforms: [], mastodonInstance: null, categories: null, followed: [] });

const texts = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);

export function loadState(storage) {
  let saved;
  try {
    saved = JSON.parse(storage?.getItem(STORAGE_KEY) ?? 'null');
  } catch {
    return emptyState();
  }
  if (typeof saved !== 'object' || saved === null) return emptyState();
  return {
    platforms: [...new Set(texts(saved.platforms).filter((slug) => Object.hasOwn(PLATFORMS, slug)))],
    mastodonInstance: typeof saved.mastodonInstance === 'string' ? saved.mastodonInstance : null,
    categories: Array.isArray(saved.categories) ? texts(saved.categories) : null,
    followed: texts(saved.followed),
  };
}

export function saveState(storage, state) {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function setFollowed(state, keys, followed) {
  const next = followed ? [...new Set([...state.followed, ...keys])] : state.followed.filter((key) => !keys.includes(key));
  return { ...state, followed: next };
}

export const toggle = (values, value) => (values.includes(value) ? values.filter((v) => v !== value) : [...values, value]);

export const selectedCategories = (list, state) =>
  state.categories === null ? Object.keys(list.categories) : state.categories.filter((slug) => Object.hasOwn(list.categories, slug));
