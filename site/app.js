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

// Pose l'ancien aspect d'un élément refait, sans transition, avant de le laisser glisser vers le nouveau.
function startFrom(element, applyOldLook) {
  element.style.transition = 'none';
  applyOldLook();
  element.getBoundingClientRect();
  element.style.transition = '';
}

// La CSP interdit l'attribut style dans le HTML : la largeur remplie se pose ici. Sur le même réseau,
// la barre repart de sa largeur précédente pour que sa transition se joue.
let lastProgress = null;
function drawProgress(hash) {
  const fill = app.querySelector('.rempli');
  if (!fill) {
    lastProgress = null;
    return;
  }
  const meter = fill.parentElement;
  const part = (Number(meter.getAttribute('aria-valuenow')) / Number(meter.getAttribute('aria-valuemax'))) * 100;
  if (lastProgress?.hash === hash) startFrom(fill, () => (fill.style.width = `${lastProgress.part}%`));
  fill.style.width = `${part}%`;
  lastProgress = { hash, part };
}

// La ligne refaite reprend un instant son ancien aspect, puis glisse vers le nouveau (fondu de la feuille).
function fadeRow(key) {
  const row = app.querySelector(`[data-follow="${CSS.escape(key)}"], [data-unfollow="${CSS.escape(key)}"]`)?.closest('.compte');
  if (!row) return;
  startFrom(row, () => row.classList.toggle('est-suivi'));
  row.classList.toggle('est-suivi');
}

// L'onglet du réseau affiché est centré dans sa rangée, sans faire défiler la page.
function centerCurrentTab() {
  const tab = app.querySelector('.onglet[aria-current="page"]');
  if (!tab) return;
  const tabs = tab.parentElement;
  tabs.scrollLeft = tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2;
}

// Le poing se lève la première fois que son bloc rouge entre à l'écran : au chargement sur ordi, à
// l'arrivée du bandeau sur téléphone (sinon l'animation se jouerait hors de l'écran).
let fistObserver = null;
function raiseFists() {
  fistObserver?.disconnect();
  fistObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries.filter((e) => e.isIntersecting)) {
        entry.target.classList.add('leve');
        fistObserver.unobserve(entry.target);
      }
    },
    { threshold: 0.3 },
  );
  app.querySelectorAll('.panneau, .bandeau').forEach((block) => fistObserver.observe(block));
}

function render(changedKey = null) {
  const { route, html } = currentScreen();
  const hash = hashOf(route);
  const focused = focusSelector(document.activeElement);
  if (hash !== location.hash) history.replaceState(null, '', hash || location.pathname + location.search);
  app.innerHTML = html;
  if (focused) app.querySelector(focused)?.focus({ preventScroll: true });
  centerCurrentTab();
  if (hash !== shownHash) window.scrollTo(0, 0);
  shownHash = hash;
  if (changedKey) fadeRow(changedKey);
  drawProgress(hash);
  raiseFists();
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
  // Liens internes de l'accueil : l'ancre commande l'écran affiché, on ne la touche pas ; la page
  // défile jusqu'à la section (en douceur d'après la feuille), qui reçoit le focus.
  const internal = event.target.closest('[data-defiler]');
  if (internal) {
    event.preventDefault();
    const section = document.querySelector(internal.getAttribute('href'));
    section.scrollIntoView();
    section.focus({ preventScroll: true });
    return;
  }
  const target = event.target.closest('[data-follow], [data-follow-all], [data-unfollow], [data-share]');
  if (!target) return;
  const { follow, followAll, unfollow } = target.dataset;
  if (target.hasAttribute('data-share')) return share(app.querySelector('.statut'));
  if (unfollow) {
    update(setFollowed(state, [unfollow], false));
    return render(unfollow);
  }
  // Le lien s'ouvre normalement ; l'écran est refait juste après, pour ne pas retirer le lien pendant le clic.
  update(setFollowed(state, follow ? [follow] : platformKeys(list, followAll), true));
  setTimeout(() => render(follow ?? null));
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
  window.addEventListener('hashchange', () => render());
} else app.innerHTML = '<p class="erreur">La liste n\'a pas pu se charger. Vérifie ta connexion et recharge la page.</p>';
