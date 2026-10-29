// Catalogue des comptes de la liste : réseaux, catégories, décomptes et progression.
// Une personne ou une organisation se reconnaît d'un réseau à l'autre par son displayName.

export const PLATFORMS = {
  instagram: 'Instagram',
  x: 'X',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  threads: 'Threads',
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  facebook: 'Facebook',
};

// Même clé que scripts/lib/list-format.js, que le site ne peut pas importer (il ne sert que site/).
export const entryKey = (entry) => `${entry.platform}:${entry.handle}`;

const entriesOn = (list, platforms, categories) =>
  list.entries.filter((entry) => platforms.includes(entry.platform) && categories.includes(entry.category));

const distinctPeople = (entries) => new Set(entries.map((entry) => entry.displayName)).size;

export function categoryCounts(list, platforms) {
  return Object.entries(list.categories).map(([slug, label]) => ({
    slug,
    label,
    count: distinctPeople(entriesOn(list, platforms, [slug])),
    empty: !list.entries.some((entry) => entry.category === slug),
  }));
}

export const peopleCount = (list, platforms, categories) => distinctPeople(entriesOn(list, platforms, categories));

export function accountGroups(list, platform, categories) {
  return Object.entries(list.categories)
    .filter(([slug]) => categories.includes(slug))
    .map(([slug, label]) => ({ slug, label, entries: entriesOn(list, [platform], [slug]) }))
    .filter((group) => group.entries.length);
}

const followedAmong = (entries, followed) => entries.filter((entry) => followed.includes(entryKey(entry))).length;

export function progress(list, platform, categories, followed) {
  const entries = entriesOn(list, [platform], categories);
  return { done: followedAmong(entries, followed), total: entries.length };
}

export const followedCount = (list, platforms, categories, followed) => followedAmong(entriesOn(list, platforms, categories), followed);

export const platformKeys = (list, platform) => list.entries.filter((entry) => entry.platform === platform).map(entryKey);
