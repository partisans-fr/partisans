// Format de la liste (site/partisans.json) : validation et lecture.

export const PLATFORMS = {
  bluesky: 'Bluesky',
  mastodon: 'Mastodon',
  x: 'X',
  instagram: 'Instagram',
  threads: 'Threads',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  youtube: 'YouTube',
};

// Identifie un compte d'une liste à l'autre.
export const entryKey = (entry) => `${entry.platform}:${entry.handle}`;

const DOMAIN = '(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?';
const INSTAGRAM_HANDLE = { regex: /^[a-z0-9._]{1,30}$/, hint: '1 à 30 caractères parmi a-z, 0-9, . et _' };

const HANDLE_FORMATS = {
  bluesky: { regex: new RegExp(`^${DOMAIN}$`), hint: 'un nom de domaine, par exemple nom.bsky.social' },
  mastodon: { regex: new RegExp(`^[a-z0-9_](?:[a-z0-9_.-]*[a-z0-9_])?@${DOMAIN}$`), hint: 'utilisateur@instance' },
  x: { regex: /^[a-z0-9_]{1,15}$/, hint: '1 à 15 caractères parmi a-z, 0-9 et _' },
  instagram: INSTAGRAM_HANDLE,
  threads: INSTAGRAM_HANDLE,
  tiktok: { regex: /^[a-z0-9._]{2,24}$/, hint: '2 à 24 caractères parmi a-z, 0-9, . et _' },
  facebook: { regex: /^[a-z0-9.]{5,50}$/, hint: 'nom de page ou ID numérique, 5 à 50 caractères parmi a-z, 0-9 et .' },
  youtube: { regex: /^[\p{Ll}\p{Lo}\p{Nd}\p{M}._-]{3,30}$/u, hint: '3 à 30 caractères : lettres minuscules ou sans casse, de tout alphabet, chiffres, ., _ et -' },
};

export const isValidHandle = (platform, handle) => handle.length <= 253 && HANDLE_FORMATS[platform].regex.test(handle);

const LIST_FIELDS = ['$schema', 'schemaVersion', 'name', 'description', 'maintainer', 'contestUrl', 'suggestUrl', 'version', 'updatedAt', 'categories', 'packs', 'entries'];
const MAINTAINER_FIELDS = ['name', 'url'];
const PACK_FIELDS = ['name', 'categories'];
const ENTRY_FIELDS = ['platform', 'handle', 'id', 'displayName', 'category', 'source', 'addedAt'];

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DID = /^did:[a-z]+:[a-zA-Z0-9._:%-]+$/;

const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value, max) => typeof value === 'string' && value.length >= 1 && value.length <= max;
const isUrl = (value) => typeof value === 'string' && /^https?:\/\/\S+$/.test(value) && URL.canParse(value);
const isSlug = (value) => typeof value === 'string' && value.length <= 40 && SLUG.test(value);
const isOptional = (value, check) => value === undefined || check(value);

function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

const isCategoryLabels = (value) =>
  isObject(value) && Object.entries(value).every(([slug, label]) => isSlug(slug) && isText(label, 60));

const isPack = (value) =>
  isObject(value) &&
  Object.keys(value).every((field) => PACK_FIELDS.includes(field)) &&
  isText(value.name, 60) &&
  Array.isArray(value.categories) &&
  value.categories.length > 0 &&
  value.categories.every(isSlug) &&
  new Set(value.categories).size === value.categories.length;

const isPacks = (value) => Array.isArray(value) && value.every(isPack);

const textProblem = (field, max) => `« ${field} » doit être un texte de 1 à ${max} caractères`;
const urlProblem = (field) => `« ${field} » doit être une URL http(s)`;
const dateProblem = (field) => `« ${field} » doit être une date au format AAAA-MM-JJ`;

const unknownFields = (object, allowed, prefix = '') =>
  Object.keys(object)
    .filter((field) => !allowed.includes(field))
    .map((field) => `champ inconnu « ${prefix}${field} »`);

function metadataProblems(list) {
  if (!isObject(list)) return ['la liste doit être un objet JSON'];

  const problems = unknownFields(list, LIST_FIELDS);
  const check = (ok, problem) => {
    if (!ok) problems.push(problem);
  };

  check(list.schemaVersion === 1, '« schemaVersion » doit valoir 1 (version du format non prise en charge)');
  check(isText(list.name, 100), textProblem('name', 100));
  check(isOptional(list.description, (value) => isText(value, 1000)), textProblem('description', 1000));
  if (isObject(list.maintainer)) {
    problems.push(...unknownFields(list.maintainer, MAINTAINER_FIELDS, 'maintainer.'));
    check(isText(list.maintainer.name, 100), textProblem('maintainer.name', 100));
    check(isOptional(list.maintainer.url, isUrl), urlProblem('maintainer.url'));
  } else {
    problems.push('« maintainer » doit être un objet { name, url }');
  }
  check(isUrl(list.contestUrl), urlProblem('contestUrl'));
  check(isOptional(list.suggestUrl, isUrl), urlProblem('suggestUrl'));
  check(isText(list.version, 50), textProblem('version', 50));
  check(isOptional(list.updatedAt, isDate), dateProblem('updatedAt'));
  check(
    isOptional(list.categories, isCategoryLabels),
    '« categories » doit associer des catégories (minuscules, chiffres et tirets) à des libellés de 1 à 60 caractères',
  );
  check(
    isOptional(list.packs, isPacks),
    '« packs » doit être un tableau de { name, categories } : un nom de 1 à 60 caractères et au moins une catégorie, sans doublon',
  );
  check(Array.isArray(list.entries), '« entries » doit être un tableau');
  return problems;
}

// Renvoie le premier problème d'une entrée, ou null si elle est valide.
function entryProblem(entry) {
  if (!isObject(entry)) return 'l\'entrée doit être un objet';
  const [unknown] = unknownFields(entry, ENTRY_FIELDS);
  if (unknown) return unknown;

  const { platform, handle, id } = entry;
  if (!Object.hasOwn(PLATFORMS, platform)) {
    return `plateforme inconnue « ${platform} » (attendu : ${Object.keys(PLATFORMS).join(', ')})`;
  }
  const label = PLATFORMS[platform];
  if (typeof handle !== 'string') return '« handle » manquant';
  if (!isValidHandle(platform, handle)) {
    return `handle ${label} invalide « ${handle} » : attendu ${HANDLE_FORMATS[platform].hint}, en minuscules et sans @`;
  }
  if (!isOptional(id, (value) => isText(value, 256) && (platform !== 'bluesky' || DID.test(value)))) {
    return platform === 'bluesky' ? `id Bluesky invalide « ${id} » : attendu un DID (did:plc:…)` : textProblem('id', 256);
  }
  if (!isText(entry.displayName, 100)) return textProblem('displayName', 100);
  if (!isSlug(entry.category)) return '« category » doit être en minuscules, chiffres et tirets (par exemple elu, media)';
  if (!isUrl(entry.source)) return urlProblem('source');
  if (!isDate(entry.addedAt)) return dateProblem('addedAt');
  return null;
}

// Lit une liste brute (JSON déjà parsé).
// - errors : problèmes de structure ou de métadonnées. S'il y en a, la liste est inutilisable (list = null).
// - rejected : entrées invalides ou en double, écartées sans bloquer le reste de la liste.
export function parseList(raw) {
  const errors = metadataProblems(raw);
  if (errors.length) return { list: null, errors, rejected: [] };

  const entries = [];
  const rejected = [];
  const firstIndexByKey = new Map();

  raw.entries.forEach((entry, index) => {
    const reject = (problem) => rejected.push({ index, message: `entrée n°${index + 1} : ${problem}` });
    const problem = entryProblem(entry);
    if (problem) return reject(problem);

    const key = entryKey(entry);
    if (firstIndexByKey.has(key)) return reject(`doublon de l'entrée n°${firstIndexByKey.get(key) + 1}`);
    firstIndexByKey.set(key, index);
    entries.push(entry);
  });

  return { list: { ...raw, entries }, errors: [], rejected };
}
