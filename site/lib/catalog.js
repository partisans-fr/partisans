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

// Vitrine de l'accueil sur ordi : trois colonnes, une carte par personne ou organisation.
export const SHOWCASE_COLUMNS = [
  { title: 'Personnalités politiques', categories: ['politique'] },
  { title: 'Médias', categories: ['media', 'journaliste', 'influenceur'] },
  { title: 'Partis et associations', categories: ['parti', 'association'] },
];

// Une personne prend la catégorie de sa première entrée ; sur un réseau, sa première entrée compte.
export function showcase(list) {
  const people = new Map();
  for (const entry of list.entries) {
    const person = people.get(entry.displayName) ?? { name: entry.displayName, category: entry.category, accounts: {} };
    person.accounts[entry.platform] ??= entry;
    people.set(entry.displayName, person);
  }
  const columns = SHOWCASE_COLUMNS.map(({ title, categories }) => ({
    title,
    categories,
    people: categories.flatMap((category) => [...people.values()].filter((person) => person.category === category)),
  })).filter((column) => column.people.length);
  return { people: people.size, platforms: new Set(list.entries.map((entry) => entry.platform)).size, columns };
}
