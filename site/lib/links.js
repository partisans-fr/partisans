// Liens d'abonnement par réseau, et adresse du site à partager.
// Liens candidats de la conception (docs/superpowers/specs/2026-10-28-partisans-design.md) : chaque
// réseau gardera le lien qui fait gagner un appui sur téléphone, d'après l'essai réel (plan, Task 10).

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
  threads: (handle) => `https://www.threads.com/@${handle}`,
  bluesky: (handle) => `https://bsky.app/profile/${handle}`,
  mastodon: (handle, instance) => `https://${instance}/authorize_interaction?uri=${encodeURIComponent(handle)}`,
  facebook: (handle) => `https://www.facebook.com/${handle}`,
};

// `mastodonInstance` est déjà normalisée par normalizeInstance.
export const followUrl = (entry, { mastodonInstance }) => FOLLOW_URLS[entry.platform](entry.handle, mastodonInstance);

// L'adresse publique (og:url) tant qu'elle est renseignée, sinon la page en cours sans son ancre.
export function siteUrl(ogUrl, currentUrl) {
  if (ogUrl && !new URL(ogUrl).hostname.endsWith('.invalid')) return ogUrl;
  const url = new URL(currentUrl);
  url.hash = '';
  return url.href;
}
