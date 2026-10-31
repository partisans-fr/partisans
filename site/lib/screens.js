// Les écrans du site, rendus en texte HTML, et l'écran à montrer pour une ancre donnée : l'accueil
// (home.js), les quatre écrans du parcours et les mentions légales. Tout texte venu de la liste passe
// par escapeHtml. app.js s'appuie sur les attributs name, data-* et les ancres (#reseaux, #categories,
// #liste/<réseau>, #fin, #mentions) produits ici.

import { PLATFORMS, accountGroups, categoryCounts, entryKey, followedCount, peopleCount, platformKeys, progress, recentlyFollowed } from './catalog.js';
import { homeScreen } from './home.js';
import { EXTERNAL, bar, button, escapeHtml, fist, plural } from './html.js';
import { commentUrl, followUrl, normalizeInstance, profileUrl } from './links.js';
import { selectedCategories } from './state.js';

export { escapeHtml } from './html.js';

const chosenPlatforms = (state) => Object.keys(PLATFORMS).filter((slug) => state.platforms.includes(slug));
const platformsReady = (state) =>
  state.platforms.length > 0 && (!state.platforms.includes('mastodon') || normalizeInstance(state.mastodonInstance) !== null);
const selectionCount = (list, state) => peopleCount(list, state.platforms, selectedCategories(list, state));

export function resolveRoute(hash, list, state) {
  const [name, platform] = hash.replace(/^#/, '').split('/');
  if (name === 'mentions') return { screen: 'mentions' };
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

const ARTICLES = new Set(['le', 'la', 'les', 'l', 'de', 'du', 'des', 'd']);

// Les initiales des deux premiers mots qui comptent : « La France insoumise » donne FI.
const initials = (name) =>
  name
    .split(/[\s'’-]+/)
    .filter((word) => /^\p{L}/u.test(word) && !ARTICLES.has(word.toLowerCase()))
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');

// L'avatar est décoratif : le nom suit, d'où alt="" et aria-hidden.
function avatar(name, avatars) {
  const file = avatars[name]?.file;
  if (file) return `<img class="avatar" src="img/avatars/${escapeHtml(file)}" width="40" height="40" alt="" loading="lazy" decoding="async">`;
  return `<span class="avatar initiales" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

// Lien vers les derniers posts du compte : Bluesky ouvre le dernier post, les autres réseaux le profil,
// où il est en haut. Le compte qu'on vient de suivre a droit au bandeau qui relance.
function likeLink(entry, state, last) {
  const key = escapeHtml(entryKey(entry));
  const name = escapeHtml(entry.displayName);
  const href = escapeHtml(commentUrl(entry, { mastodonInstance: normalizeInstance(state.mastodonInstance) }));
  const link = (className, label, text) => `<a class="${className}" data-comment="${key}" href="${href}" ${EXTERNAL} aria-label="${label} : ${name}">${text}</a>`;
  if (!state.followed.includes(entryKey(entry))) {
    return link('commenter', 'Déjà abonné·e\u202f? Like ses derniers posts', 'Déjà abonné·e\u202f? Like ses derniers posts →');
  }
  if (last) return link('commenter bravo', 'Like ses derniers posts', 'Bien joué ! Donne-lui de la force : <span>like ses derniers posts →</span>');
  return link('commenter', 'Like ses derniers posts', 'Like ses derniers posts →');
}

function accountRow(entry, state, roles, avatars) {
  const key = escapeHtml(entryKey(entry));
  const name = escapeHtml(entry.displayName);
  const role = roles?.[entry.displayName];
  const mastodonInstance = normalizeInstance(state.mastodonInstance);
  const followed = state.followed.includes(entryKey(entry));
  const action = followed
    ? `<button data-unfollow="${key}" aria-label="Annuler le suivi : ${name}">Annuler</button> <span class="suivi">✓ Suivi</span>`
    : `<a class="suivre" data-follow="${key}" href="${escapeHtml(followUrl(entry, { mastodonInstance }))}" ${EXTERNAL} aria-label="Suivre ${name}">Suivre</a>`;
  const comment = likeLink(entry, state, entryKey(entry) === state.followed.at(-1));
  const roleText = role ? `<span class="fonction">${escapeHtml(role)}</span>` : '';
  return `<li class="compte">${avatar(entry.displayName, avatars)}<span class="nom">${name}${roleText}</span><span class="action">${action}</span>${comment}</li>`;
}

// Où trouver, sur le profil du compte relais, la liste des comptes qu'il suit (libellés de l'appli en français).
const RELAY_STEPS = {
  instagram: 'touche «\u202fsuivi(e)s\u202f»',
  threads: 'touche «\u202ffollowers\u202f», puis l\'onglet «\u202fSuivi(e)s\u202f»,',
};

// Le compte relais du projet suit toute la liste : depuis son profil, on s'abonne dans l'appli sans
// revenir au site. Le site ne sait pas à qui la personne s'abonne là-bas, donc la progression ne bouge pas.
function relayShortcut(platform, handle, count) {
  const url = profileUrl({ platform, handle });
  const accounts = count === 1 ? 'le compte' : `les ${count} comptes`;
  return `<div class="raccourci"><p class="raccourci-titre">Plus rapide : abonne-toi depuis l'appli.</p>
    <a class="btn" href="${escapeHtml(url)}" ${EXTERNAL}>Ouvrir @${escapeHtml(handle)} →</a>
    <p class="discret">Ce compte suit ${accounts} de la liste. Sur son profil, ${RELAY_STEPS[platform]} et abonne-toi à chacun, sans revenir ici.</p></div>`;
}

function listScreen({ list, state, starterPackUrl, relayAccounts, avatars }, platform) {
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
  const relayHandle = RELAY_STEPS[platform] && relayAccounts[platform];
  const relay = relayHandle && total ? relayShortcut(platform, relayHandle, platformKeys(list, platform).length) : '';
  // Case cochée : les comptes suivis disparaissent, sauf le dernier, qui garde son bandeau.
  const shown = (entry) => !state.hideFollowed || !state.followed.includes(entryKey(entry)) || entryKey(entry) === state.followed.at(-1);
  const hide = total ? `<label class="masquer">${checkbox('masquer', 'oui', { checked: state.hideFollowed })}Masquer les comptes déjà suivis</label>` : '';
  const allFollowed = total && done === total ? `<p class="tout-suivi">Tu suis tous les comptes de ta sélection sur ${PLATFORMS[platform]}.</p>` : '';
  // En-têtes de groupe alternés, noir puis rouge, dans l'ordre affiché, avec le décompte du groupe.
  const groups = accountGroups(list, platform, categories)
    .map((group) => ({ ...group, done: group.entries.filter((entry) => state.followed.includes(entryKey(entry))).length, entries: group.entries.filter(shown), total: group.entries.length }))
    .filter((group) => group.entries.length)
    .map(({ label, entries, done: groupDone, total: groupTotal }, rank) => `<section class="groupe ${rank % 2 ? 'tete-rouge' : 'tete-noire'}"><h2>${escapeHtml(label)} <span class="decompte">${groupDone}/${groupTotal}</span></h2>
      <ul class="comptes">${entries.map((entry) => accountRow(entry, state, list.roles, avatars)).join('\n')}</ul></section>`)
    .join('\n');
  return `${bar(step(3))}<nav class="onglets" aria-label="Tes réseaux">${tabs}</nav><div class="contenu">
    <h1 class="titre-liste" id="titre-liste">Ta liste ${PLATFORMS[platform]}</h1>
    ${progression}
    ${relay}
    ${total ? '<p class="discret">Appuie sur Suivre, puis confirme dans l\'appli ou la page qui s\'ouvre.</p>' : ''}
    ${followAll}
    ${allFollowed}
    ${hide}
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

// Les trois derniers comptes suivis, pour liker tout de suite plutôt que « un jour ».
function startNow(list, state, avatars) {
  const recent = recentlyFollowed(list, state.followed, state.platforms).slice(0, 3);
  if (!recent.length) return '';
  const mastodonInstance = normalizeInstance(state.mastodonInstance);
  const rows = recent.map((entry) => {
    const name = escapeHtml(entry.displayName);
    return `<li><a class="geste" data-comment="${escapeHtml(entryKey(entry))}" href="${escapeHtml(commentUrl(entry, { mastodonInstance }))}" ${EXTERNAL} aria-label="Like ses derniers posts : ${name}">${avatar(entry.displayName, avatars)}<span class="nom">${name}<span class="fonction">ses derniers posts</span></span><span class="like">Like →</span></a></li>`;
  });
  return `<p class="commence">Commence tout de suite :</p><ul class="gestes">${rows.join('')}</ul>`;
}

function endScreen({ list, state, avatars }) {
  const count = followedCount(list, state.platforms, selectedCategories(list, state), state.followed);
  const title = headline(count).map((line) => `<span class="ligne"><span data-anim="line">${line}</span></span>`).join(' ');
  return `${bar()}<div class="contenu">
    <h1>${title}</h1>
    <p>Maintenant, chaque jour, sur leurs posts :</p>
    <ul class="verbes"><li>Aime.</li><li>Partage.</li><li>Commente.</li></ul>
    ${startNow(list, state, avatars)}
    <p class="ignore">Et l'extrême droite\u202f? <strong>Ignore-la.</strong> Chaque réponse, même pour la dénoncer, la fait remonter dans les algorithmes.</p>
    <div class="fin-bas"><p class="liens"><a href="#liste">Revenir à ma liste</a></p>${fist('146px')}</div>
    </div>
    <div class="fin-partage"><p class="mot">Fais passer le mot.</p><button class="btn" data-share>Partager le site</button><a class="btn secondaire" href="visuels/soyons-partisans-story-soyons.jpg" download data-visuel>Télécharger la story\u00a0↓</a><p class="statut" role="status"></p><p class="adresse">soyonspartisans.fr</p></div>`;
}

const REPO_URL = 'https://github.com/partisans-fr/partisans';

// L'éditeur, particulier non professionnel, reste anonyme : la loi lui demande seulement de nommer
// l'hébergeur, à qui il a donné son identité.
// Les images de Wikimedia Commons citent leur auteur et leur licence ; celles des réseaux non.
function creditsSection(avatars) {
  const credits = Object.entries(avatars)
    .filter(([, { credit }]) => credit)
    .map(([name, { credit }]) => `<li>${escapeHtml(name)} : ${escapeHtml(credit.author)}, <a href="${escapeHtml(credit.url)}" ${EXTERNAL}>${escapeHtml(credit.license)}</a></li>`);
  if (!credits.length) return '';
  return `<section><h2>Crédits photos</h2><p>Photos et logos de Wikimedia Commons :</p><ul class="credits">${credits.join('')}</ul></section>`;
}

function legalScreen({ list, avatars }) {
  const suggest = list.suggestUrl ? ` Un compte à ajouter ? <a href="${escapeHtml(list.suggestUrl)}" ${EXTERNAL}>Suggère-le</a>.` : '';
  return `${bar()}<div class="contenu mentions">
    <h1>Mentions légales</h1>
    <section><h2>Éditeur</h2><p>Soyons Partisans est un projet bénévole, édité à titre non professionnel par une personne qui reste anonyme, comme le permet l'article 1-1 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique. Son identité est connue de l'hébergeur.</p></section>
    <section><h2>Hébergeur</h2><p>Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis.</p></section>
    <section><h2>Contact</h2><p>Un compte erroné ? <a href="${escapeHtml(list.contestUrl)}" ${EXTERNAL}>Signale-le</a>.${suggest} Pour tout le reste, ouvre un ticket sur <a href="${REPO_URL}/issues" ${EXTERNAL}>le dépôt du projet</a>.</p></section>
    <section><h2>Données personnelles</h2><p>Aucun cookie, aucun compte, aucun pistage. Tes choix (réseaux, catégories, comptes suivis) restent dans ton navigateur. Le site compte seulement, de façon anonyme, combien de personnes l'ont ouvert et combien de comptes y ont été ouverts : deux totaux, sans adresse IP ni identifiant. Comme tout hébergeur, Cloudflare reçoit l'adresse IP de chaque visite pour servir les pages.</p></section>
    <section><h2>Code source</h2><p>Le code du site est libre, sous licence GPL v3 : <a href="${REPO_URL}" ${EXTERNAL}>github.com/partisans-fr/partisans</a>.</p></section>
    ${creditsSection(avatars)}
    <p class="liens"><a href="#">Retour à l'accueil</a></p>
    </div>`;
}

const DAY = 24 * 60 * 60 * 1000;
const GESTURES = ['Aime ses derniers posts →', 'Commente un de ses posts →', 'Partage un de ses posts →'];

// Geste du jour : un compte suivi et un geste, choisis par la date et non au hasard. Le compte change
// chaque jour, le geste quand on a fait le tour des comptes : toutes les paires finissent par venir.
function dailyGesture(list, state, avatars, today) {
  const followed = recentlyFollowed(list, state.followed, state.platforms);
  if (!followed.length) return '';
  const day = Math.floor(today.getTime() / DAY);
  const entry = followed[day % followed.length];
  const name = escapeHtml(entry.displayName);
  const href = escapeHtml(commentUrl(entry, { mastodonInstance: normalizeInstance(state.mastodonInstance) }));
  return `<a class="geste-du-jour" data-comment="${escapeHtml(entryKey(entry))}" href="${href}" ${EXTERNAL}><span class="geste-titre">Ton geste du jour</span><span class="geste-compte">${avatar(entry.displayName, avatars)}<span class="nom">${name}</span></span><span class="geste-action">${GESTURES[Math.floor(day / followed.length) % GESTURES.length]}</span></a>`;
}

function home({ list, state, avatars, today }) {
  const resume = resolveRoute('#liste', list, state).screen === 'liste';
  return homeScreen({ list, resume, gesture: resume ? dailyGesture(list, state, avatars, today) : '' });
}

const SCREENS = { accueil: home, reseaux: platformsScreen, categories: categoriesScreen, fin: endScreen, mentions: legalScreen };

export function renderScreen(route, { list, state, starterPackUrl = null, relayAccounts = {}, avatars = {}, today = new Date() }) {
  const context = { list, state, starterPackUrl, relayAccounts, avatars, today };
  const body = route.screen === 'liste' ? listScreen(context, route.platform) : SCREENS[route.screen](context);
  return `<section class="ecran ecran-${route.screen}">${body}</section>`;
}
