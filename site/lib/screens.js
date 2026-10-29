// Les cinq écrans du parcours, rendus en texte HTML, et l'écran à montrer pour une ancre donnée.
// Tout texte venu de la liste passe par escapeHtml. app.js s'appuie sur les attributs name, data-*
// et les ancres (#reseaux, #categories, #liste/<réseau>, #fin) produits ici.

import { PLATFORMS, accountGroups, categoryCounts, entryKey, followedCount, peopleCount, progress } from './catalog.js';
import { followUrl, normalizeInstance } from './links.js';
import { selectedCategories } from './state.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

const EXTERNAL = 'target="_blank" rel="noopener noreferrer"';
const BRAND = '<p class="marque">PARTISANS</p>';

const chosenPlatforms = (state) => Object.keys(PLATFORMS).filter((slug) => state.platforms.includes(slug));
const platformsReady = (state) =>
  state.platforms.length > 0 && (!state.platforms.includes('mastodon') || normalizeInstance(state.mastodonInstance) !== null);
const selectionCount = (list, state) => peopleCount(list, state.platforms, selectedCategories(list, state));

export function resolveRoute(hash, list, state) {
  const [name, platform] = hash.replace(/^#/, '').split('/');
  if (!['reseaux', 'categories', 'liste', 'fin'].includes(name)) return { screen: 'accueil' };
  if (name === 'reseaux' || !platformsReady(state)) return { screen: 'reseaux' };
  if (name === 'categories' || selectionCount(list, state) === 0) return { screen: 'categories' };
  if (name === 'fin') return { screen: 'fin' };
  const chosen = chosenPlatforms(state);
  return { screen: 'liste', platform: chosen.includes(platform) ? platform : chosen[0] };
}

const button = (label, href) => (href ? `<a class="btn" href="${href}">${label}</a>` : `<button class="btn" disabled>${label}</button>`);
const checkbox = (name, value, { checked, disabled = false }) =>
  `<input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>`;

function home({ list, state }) {
  const resume = resolveRoute('#liste', list, state).screen === 'liste';
  return `${BRAND}
    <h1>Donne de la force à ceux qui combattent l'extrême droite</h1>
    <p>Abonne-toi en quelques minutes aux élus, médias et collectifs de gauche : chaque abonnement leur donne de l'audience.</p>
    <p class="discret">Rien à installer, aucun mot de passe. Tes choix restent dans ce téléphone.</p>
    <div class="actions">
      ${resume ? button('Reprendre ma liste', '#liste') : ''}
      ${button('Commencer', '#reseaux')}
    </div>`;
}

function platformsScreen({ state }) {
  const chips = Object.entries(PLATFORMS)
    .map(([slug, label]) => `<label class="puce">${checkbox('platform', slug, { checked: state.platforms.includes(slug) })}<span>${label}</span></label>`)
    .join('\n');
  const instance = state.platforms.includes('mastodon')
    ? `<label class="champ">Ton instance Mastodon
        <input name="instance" type="text" value="${escapeHtml(state.mastodonInstance ?? '')}" placeholder="mastodon.social" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false">
      </label>
      ${normalizeInstance(state.mastodonInstance) ? '' : '<p class="aide">Indique ton instance, par exemple mastodon.social.</p>'}`
    : '';
  return `${BRAND}
    <h1>Sur quels réseaux es-tu ?</h1>
    <fieldset class="puces"><legend>Coche tes réseaux</legend>${chips}</fieldset>
    ${instance}
    <div class="actions">${button('Continuer', platformsReady(state) ? '#categories' : null)}</div>`;
}

function seeAccountsButton(count) {
  if (count === 0) return button('Aucun compte', null);
  return button(count === 1 ? 'Voir le compte' : `Voir les ${count} comptes`, '#liste');
}

function categoriesScreen({ list, state }) {
  const selected = selectedCategories(list, state);
  const rows = categoryCounts(list, state.platforms)
    .map(({ slug, label, count, empty }) => {
      const box = checkbox('category', escapeHtml(slug), { checked: count > 0 && selected.includes(slug), disabled: count === 0 });
      return `<label class="categorie">${box}<span class="nom">${escapeHtml(label)}</span><span class="nombre">${empty ? 'à venir' : count}</span></label>`;
    })
    .join('\n');
  return `${BRAND}
    <h1>Qui veux-tu suivre ?</h1>
    <fieldset class="categories"><legend>Coche ce qui t'intéresse</legend>${rows}</fieldset>
    <div class="actions">${seeAccountsButton(selectionCount(list, state))}</div>
    <p class="liens"><a href="#reseaux">Changer mes réseaux</a></p>`;
}

function accountRow(entry, state) {
  const key = escapeHtml(entryKey(entry));
  const name = escapeHtml(entry.displayName);
  const action = state.followed.includes(entryKey(entry))
    ? `<span class="suivi">Suivi ✓</span> <button data-unfollow="${key}" aria-label="Annuler le suivi : ${name}">Annuler</button>`
    : `<a class="suivre" data-follow="${key}" href="${escapeHtml(followUrl(entry, { mastodonInstance: normalizeInstance(state.mastodonInstance) }))}" ${EXTERNAL} aria-label="Suivre ${name}">Suivre</a>`;
  return `<li class="compte"><span class="nom">${name}</span><span class="action">${action}</span></li>`;
}

function listScreen({ list, state, starterPackUrl }, platform) {
  const categories = selectedCategories(list, state);
  const tabs = chosenPlatforms(state)
    .map((slug) => {
      const { done, total } = progress(list, slug, categories, state.followed);
      const current = slug === platform ? ' aria-current="page"' : '';
      return `<a class="onglet" href="#liste/${slug}"${current}>${PLATFORMS[slug]} ${done}/${total}</a>`;
    })
    .join('\n');
  const { done, total } = progress(list, platform, categories, state.followed);
  const bar = total
    ? `<progress max="${total}" value="${done}">${done} sur ${total}</progress>`
    : `<p class="vide">Pas encore de compte de ta sélection sur ${PLATFORMS[platform]}.</p>`;
  const followAll =
    platform === 'bluesky' && starterPackUrl && total
      ? `<a class="btn" data-follow-all="bluesky" href="${escapeHtml(starterPackUrl)}" ${EXTERNAL}>Tout suivre</a>`
      : '';
  const groups = accountGroups(list, platform, categories)
    .map(({ label, entries }) => `<h2>${escapeHtml(label)}</h2>
      <ul class="comptes">${entries.map((entry) => accountRow(entry, state)).join('\n')}</ul>`)
    .join('\n');
  return `<nav class="onglets" aria-label="Tes réseaux">${tabs}</nav>
    <h1 class="titre-liste">Ta liste ${PLATFORMS[platform]}</h1>
    ${bar}
    ${total ? '<p class="discret">Appuie sur Suivre, puis confirme dans l\'appli ou la page qui s\'ouvre.</p>' : ''}
    ${followAll}
    ${groups}
    <div class="actions">${button('J\'ai fini', '#fin')}</div>
    <p class="liens"><a href="#reseaux">Changer mes réseaux</a> <a href="#categories">Changer mes catégories</a></p>
    <footer class="pied">
      <a href="${escapeHtml(list.contestUrl)}" ${EXTERNAL}>Un compte erroné ? Signale-le</a>
      ${list.suggestUrl ? `<a href="${escapeHtml(list.suggestUrl)}" ${EXTERNAL}>Suggérer un compte</a>` : ''}
    </footer>`;
}

function headline(count) {
  if (count === 0) return 'Ta liste t\'attend.';
  return `C'est fait : ${count} ${count === 1 ? 'abonnement' : 'abonnements'}.`;
}

function endScreen({ list, state }) {
  const count = followedCount(list, state.platforms, selectedCategories(list, state), state.followed);
  return `${BRAND}
    <h1>${headline(count)}</h1>
    <p>Maintenant, chaque jour, sur leurs posts :</p>
    <ul class="verbes"><li>Aime.</li><li>Partage.</li><li>Commente.</li></ul>
    <p class="ignore">Et l'extrême droite ? <strong>Ignore-la.</strong> Ne réponds pas, ne cite pas, passe ton chemin.</p>
    <div class="actions">
      <button class="btn" data-share>Partager le site</button>
      <p class="statut" role="status"></p>
    </div>
    <p class="liens"><a href="#liste">Revenir à ma liste</a></p>`;
}

const SCREENS = { accueil: home, reseaux: platformsScreen, categories: categoriesScreen, fin: endScreen };

export function renderScreen(route, { list, state, starterPackUrl = null }) {
  const context = { list, state, starterPackUrl };
  const body = route.screen === 'liste' ? listScreen(context, route.platform) : SCREENS[route.screen](context);
  return `<section class="ecran ecran-${route.screen}">${body}</section>`;
}
