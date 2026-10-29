// Branchement du site : charge la liste, affiche l'écran de l'ancre, écoute les gestes et sauvegarde.

import { STARTER_PACK_URL } from './config.js';
import { platformKeys } from './lib/catalog.js';
import { siteUrl } from './lib/links.js';
import { renderScreen, resolveRoute } from './lib/screens.js';
import { loadState, saveState, selectedCategories, setFollowed, toggle } from './lib/state.js';

const SHARE_TEXT = 'Abonne-toi en quelques minutes aux comptes qui combattent l\'extrême droite.';

const app = document.getElementById('app');

// localStorage peut lever une exception (navigation privée, navigateur intégré) : le site marche sans.
let storage = null;
try {
  storage = window.localStorage;
} catch {}

let state = loadState(storage);
let list = null;
let shownHash = null;

const hashOf = (route) => {
  if (route.screen === 'accueil') return '';
  return route.screen === 'liste' ? `#liste/${route.platform}` : `#${route.screen}`;
};

function currentScreen() {
  const route = resolveRoute(location.hash, list, state);
  return { route, html: renderScreen(route, { list, state, starterPackUrl: STARTER_PACK_URL }) };
}

// L'écran est refait en entier : le focus revient à la même case, ou au même compte (Suivre devenu
// Annuler et inversement), pour le clavier et les lecteurs d'écran.
function focusSelector(element) {
  if (element.name === 'platform' || element.name === 'category') return `input[name="${element.name}"][value="${CSS.escape(element.value)}"]`;
  const key = element.dataset?.follow ?? element.dataset?.unfollow;
  return key ? `[data-follow="${CSS.escape(key)}"], [data-unfollow="${CSS.escape(key)}"]` : null;
}

// La CSP interdit l'attribut style dans le HTML : la largeur remplie se pose ici.
function drawProgress() {
  const fill = app.querySelector('.rempli');
  if (!fill) return;
  const meter = fill.parentElement;
  fill.style.width = `${(Number(meter.getAttribute('aria-valuenow')) / Number(meter.getAttribute('aria-valuemax'))) * 100}%`;
}

// L'onglet du réseau affiché est centré dans sa rangée, sans faire défiler la page.
function centerCurrentTab() {
  const tab = app.querySelector('.onglet[aria-current="page"]');
  if (!tab) return;
  const tabs = tab.parentElement;
  tabs.scrollLeft = tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2;
}

function render() {
  const { route, html } = currentScreen();
  const hash = hashOf(route);
  const focused = focusSelector(document.activeElement);
  if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname + location.search);
  app.innerHTML = html;
  if (focused) app.querySelector(focused)?.focus({ preventScroll: true });
  centerCurrentTab();
  if (hash !== shownHash) window.scrollTo(0, 0);
  shownHash = hash;
  drawProgress();
}

function update(changes) {
  state = { ...state, ...changes };
  saveState(storage, state);
}

// Pendant la saisie de l'instance, le champ reste en place (le remplacer fermerait le clavier du
// téléphone) : seuls l'aide et le bouton Continuer sont refaits.
function refreshAroundInstance() {
  const fresh = document.createElement('template');
  fresh.innerHTML = currentScreen().html;
  app.querySelector('.aide')?.remove();
  const hint = fresh.content.querySelector('.aide');
  if (hint) app.querySelector('.champ').after(hint);
  app.querySelector('.actions').replaceWith(fresh.content.querySelector('.actions'));
}

async function share(status) {
  const url = siteUrl(document.querySelector('meta[property="og:url"]')?.content ?? null, location.href);
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Partisans', text: SHARE_TEXT, url });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    status.textContent = 'Lien copié.';
  } catch {
    status.textContent = `Copie ce lien : ${url}`;
  }
}

app.addEventListener('change', (event) => {
  const { name, value } = event.target;
  if (name === 'platform') update({ platforms: toggle(state.platforms, value) });
  else if (name === 'category') update({ categories: toggle(selectedCategories(list, state), value) });
  else return;
  render();
});

app.addEventListener('input', (event) => {
  if (event.target.name !== 'instance') return;
  update({ mastodonInstance: event.target.value });
  refreshAroundInstance();
});

app.addEventListener('click', (event) => {
  const target = event.target.closest('[data-follow], [data-follow-all], [data-unfollow], [data-share]');
  if (!target) return;
  const { follow, followAll, unfollow } = target.dataset;
  if (target.hasAttribute('data-share')) return share(app.querySelector('.statut'));
  if (unfollow) {
    update(setFollowed(state, [unfollow], false));
    return render();
  }
  // Le lien s'ouvre normalement ; l'écran est refait juste après, pour ne pas retirer le lien pendant le clic.
  update(setFollowed(state, follow ? [follow] : platformKeys(list, followAll), true));
  setTimeout(render);
});

async function loadList() {
  try {
    const response = await fetch('partisans.json', { cache: 'no-cache' });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

// Les écrans ont besoin de la liste : l'ancre n'est suivie qu'une fois celle-ci chargée.
list = await loadList();
if (list) {
  render();
  window.addEventListener('hashchange', render);
} else app.innerHTML = '<p class="erreur">La liste n\'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>';
