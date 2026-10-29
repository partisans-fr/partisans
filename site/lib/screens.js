// Les écrans du site, rendus en texte HTML, et l'écran à montrer pour une ancre donnée : l'accueil
// (home.js) et les quatre écrans du parcours. Tout texte venu de la liste passe par escapeHtml.
// app.js s'appuie sur les attributs name, data-* et les ancres (#reseaux, #categories,
// #liste/<réseau>, #fin) produits ici.

import { PLATFORMS, accountGroups, categoryCounts, entryKey, followedCount, peopleCount, platformKeys, progress } from './catalog.js';
import { homeScreen } from './home.js';
import { EXTERNAL, bar, button, escapeHtml, fist, plural } from './html.js';
import { commentUrl, followUrl, normalizeInstance } from './links.js';
import { selectedCategories } from './state.js';

export { escapeHtml } from './html.js';

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

// La case native reste dans le label, invisible ; la case dessinée porte la coche.
const checkbox = (name, value, { checked, disabled = false }) =>
  `<input type="checkbox" name="${name}" value="${value}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}><span class="case" aria-hidden="true">${checked ? '<span class="coche">✓</span>' : ''}</span>`;

const step = (number) => `<span class="etape">${number} / 3</span>`;

function platformsScreen({ list, state }) {
  const rows = Object.entries(PLATFORMS)
    .map(([slug, label]) => {
      const checked = state.platforms.includes(slug);
      const count = checked ? `<span class="nombre">${plural(platformKeys(list, slug).length, 'compte')}</span>` : '';
      return `<label class="reseau">${checkbox('platform', slug, { checked })}<span class="nom">${label}</span>${count}</label>`;
    })
    .join('\n');
  const instance = state.platforms.includes('mastodon')
    ? `<label class="champ">Ton instance Mastodon
        <input name="instance" type="text" value="${escapeHtml(state.mastodonInstance ?? '')}" placeholder="mastodon.social" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false">
      </label>
      ${normalizeInstance(state.mastodonInstance) ? '' : '<p class="aide">Indique ton instance, par exemple mastodon.social.</p>'}`
    : '';
  return `${bar(step(1))}<div class="contenu">
    <h1>Sur quels réseaux es-tu\u202f?</h1>
    <fieldset class="reseaux"><legend>Coche tes réseaux</legend>${rows}</fieldset>
    ${instance}
    <div class="actions">${button('Continuer', platformsReady(state) ? '#categories' : null)}</div>
    </div>`;
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
      return `<label class="categorie">${box}<span class="nom">${escapeHtml(label)}</span><span class="nombre">${empty ? 'à venir' : plural(count, 'compte')}</span></label>`;
    })
    .join('\n');
  return `${bar(step(2))}<div class="contenu">
    <h1>Qui veux-tu suivre\u202f?</h1>
    <fieldset class="categories"><legend>Coche ce qui t'intéresse</legend>${rows}</fieldset>
    <div class="actions">${seeAccountsButton(selectionCount(list, state))}</div>
    <p class="liens"><a href="#reseaux">Changer mes réseaux</a></p>
    </div>`;
}

function accountRow(entry, state) {
  const key = escapeHtml(entryKey(entry));
  const name = escapeHtml(entry.displayName);
  const mastodonInstance = normalizeInstance(state.mastodonInstance);
  const followed = state.followed.includes(entryKey(entry));
  const action = followed
    ? `<button data-unfollow="${key}" aria-label="Annuler le suivi : ${name}">Annuler</button> <span class="suivi">✓ Suivi</span>`
    : `<a class="suivre" data-follow="${key}" href="${escapeHtml(followUrl(entry, { mastodonInstance }))}" ${EXTERNAL} aria-label="Suivre ${name}">Suivre</a>`;
  const commentLabel = followed ? 'Commenter leur dernier post' : 'Déjà abonné\u202f? Commenter leur dernier post';
  const comment = `<a class="commenter" data-comment="${key}" href="${escapeHtml(commentUrl(entry, { mastodonInstance }))}" ${EXTERNAL} aria-label="${commentLabel} : ${name}">${commentLabel} →</a>`;
  return `<li class="compte"><span class="nom">${name}</span><span class="action">${action}</span>${comment}</li>`;
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
  // La largeur remplie est posée par app.js (la CSP interdit l'attribut style).
  const progression = total
    ? `<div class="progression"><div class="barre-progression" role="progressbar" aria-labelledby="titre-liste" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><span class="rempli"></span></div><p class="meta">${done} sur ${total}</p></div>`
    : `<p class="vide">Pas encore de compte de ta sélection sur ${PLATFORMS[platform]}.</p>`;
  const followAll =
    platform === 'bluesky' && starterPackUrl && total
      ? `<a class="btn" data-follow-all="bluesky" href="${escapeHtml(starterPackUrl)}" ${EXTERNAL}>Tout suivre →</a>`
      : '';
  // En-têtes de groupe alternés, noir puis rouge, dans l'ordre affiché.
  const groups = accountGroups(list, platform, categories)
    .map(({ label, entries }, rank) => `<section class="groupe ${rank % 2 ? 'tete-rouge' : 'tete-noire'}"><h2>${escapeHtml(label)}</h2>
      <ul class="comptes">${entries.map((entry) => accountRow(entry, state)).join('\n')}</ul></section>`)
    .join('\n');
  return `${bar(step(3))}<nav class="onglets" aria-label="Tes réseaux">${tabs}</nav><div class="contenu">
    <h1 class="titre-liste" id="titre-liste">Ta liste ${PLATFORMS[platform]}</h1>
    ${progression}
    ${total ? '<p class="discret">Appuie sur Suivre, puis confirme dans l\'appli ou la page qui s\'ouvre.</p>' : ''}
    ${followAll}
    ${groups}
    <div class="actions">${button('J\'ai fini', '#fin', { secondary: true })}</div>
    <p class="liens"><a href="#reseaux">Changer mes réseaux</a> <a href="#categories">Changer mes catégories</a></p>
    <footer class="pied">
      <a href="${escapeHtml(list.contestUrl)}" ${EXTERNAL}>Un compte erroné\u202f? Signale-le</a>
      ${list.suggestUrl ? `<a href="${escapeHtml(list.suggestUrl)}" ${EXTERNAL}>Suggérer un compte</a>` : ''}
    </footer>
    </div>`;
}

// Les lignes du titre de la fin, chacune montée depuis sa découpe (animation « line »).
function headline(count) {
  if (count === 0) return ['Ta liste t\'attend.'];
  return ['C\'est fait :', `${count} ${count === 1 ? 'abonnement' : 'abonnements'}.`];
}

function endScreen({ list, state }) {
  const count = followedCount(list, state.platforms, selectedCategories(list, state), state.followed);
  const title = headline(count).map((line) => `<span class="ligne"><span data-anim="line">${line}</span></span>`).join(' ');
  return `${bar()}<div class="contenu">
    <h1>${title}</h1>
    <p>Maintenant, chaque jour, sur leurs posts :</p>
    <ul class="verbes"><li>Aime.</li><li>Partage.</li><li>Commente.</li></ul>
    <p class="ignore">Et l'extrême droite\u202f? <strong>Ignore-la.</strong> Ne réponds pas, ne cite pas, passe ton chemin.</p>
    <p class="liens"><a href="#liste">Revenir à ma liste</a></p>
    </div>
    <div class="fin-partage"><p class="mot">Fais passer le mot.</p><button class="btn" data-share>Partager le site</button><p class="statut" role="status"></p><p class="adresse">soyonspartisans.fr</p></div>
    ${fist('208px')}`;
}

const home = ({ list, state }) => homeScreen({ list, resume: resolveRoute('#liste', list, state).screen === 'liste' });

const SCREENS = { accueil: home, reseaux: platformsScreen, categories: categoriesScreen, fin: endScreen };

export function renderScreen(route, { list, state, starterPackUrl = null }) {
  const context = { list, state, starterPackUrl };
  const body = route.screen === 'liste' ? listScreen(context, route.platform) : SCREENS[route.screen](context);
  return `<section class="ecran ecran-${route.screen}">${body}</section>`;
}
