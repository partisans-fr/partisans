// Liens d'abonnement par réseau, et adresse du site à partager.
// Chaque réseau garde le lien qui fait gagner un appui sur téléphone, d'après l'essai sur Android du
// 2026-10-29 : fenêtre « Suivre ? » dans l'appli pour X, YouTube et Threads, profil ailleurs.

import { entryKey } from './catalog.js';

const DOMAIN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

// Accepte « piaille.fr », « @moi@piaille.fr » ou « https://piaille.fr/@moi » ; renvoie le domaine, ou null.
export function normalizeInstance(input) {
  if (typeof input !== 'string') return null;
  const domain = input
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .split('/')[0]
    .split('@')
    .pop();
  return DOMAIN.test(domain) ? domain : null;
}

const FOLLOW_URLS = {
  x: (handle) => `https://x.com/intent/follow?screen_name=${handle}`,
  instagram: (handle) => `https://www.instagram.com/${handle}/`,
  tiktok: (handle) => `https://www.tiktok.com/@${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${encodeURIComponent(handle)}?sub_confirmation=1`,
  threads: (handle) => `https://www.threads.com/intent/follow?username=${handle}`,
  bluesky: (handle) => `https://bsky.app/profile/${handle}`,
  mastodon: (handle, instance) => `https://${instance}/authorize_interaction?uri=${encodeURIComponent(handle)}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
};

// `mastodonInstance` est déjà normalisée par normalizeInstance.
export const followUrl = (entry, { mastodonInstance }) => FOLLOW_URLS[entry.platform](entry.handle, mastodonInstance);

// Profil public du compte, pour la vitrine : pas d'intention d'abonnement, et le compte Mastodon sur
// son instance (le visiteur n'a pas encore donné la sienne).
const PROFILE_URLS = {
  x: (handle) => `https://x.com/${handle}`,
  youtube: (handle) => `https://www.youtube.com/@${encodeURIComponent(handle)}`,
  threads: (handle) => `https://www.threads.com/@${handle}`,
  mastodon: (handle) => {
    const [name, instance] = handle.replace(/^@/, '').split('@');
    return `https://${instance}/@${name}`;
  },
};

export const profileUrl = (entry) => (PROFILE_URLS[entry.platform] ?? FOLLOW_URLS[entry.platform])(entry.handle);

// « Commenter leur dernier post » : Bluesky passe par la fonction dernier-post (recherche côté serveur),
// Mastodon ouvre le compte sur l'instance du visiteur, YouTube les vidéos de la chaîne (la plus récente
// en premier) ; ailleurs, la page du compte, où le dernier post est en haut.
// `mastodonInstance` est déjà normalisée par normalizeInstance.
export function commentUrl(entry, { mastodonInstance }) {
  if (entry.platform === 'bluesky') return `/.netlify/functions/dernier-post?compte=${encodeURIComponent(entryKey(entry))}`;
  if (entry.platform === 'mastodon') return followUrl(entry, { mastodonInstance });
  if (entry.platform === 'youtube') return `${profileUrl(entry)}/videos`;
  return profileUrl(entry);
}

// L'adresse publique (og:url) tant qu'elle est renseignée, sinon la page en cours sans son ancre.
export function siteUrl(ogUrl, currentUrl) {
  if (ogUrl && !new URL(ogUrl).hostname.endsWith('.invalid')) return ogUrl;
  const url = new URL(currentUrl);
  url.hash = '';
  return url.href;
}
