// Morceaux HTML partagés par l'accueil et les écrans du parcours : échappement, boutons, barre au
// logo et teintes des catégories.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

export const EXTERNAL = 'target="_blank" rel="noopener noreferrer"';

// Un seul bouton rouge plein par écran : les autres sont secondaires (encadrés).
export function button(label, href, { secondary = false } = {}) {
  if (!href) return `<button class="btn" disabled>${label}</button>`;
  return `<a class="btn${secondary ? ' secondaire' : ''}" href="${href}">${label}</a>`;
}

export const bar = (extra = '') =>
  `<header class="barre"><span class="symbole" aria-hidden="true"></span><span class="logotype">partisans</span>${extra}</header>`;

// Couleurs des collections de la charte, par catégorie de la liste.
export const TINTS = { politique: 'ardoise', media: 'ocre', journaliste: 'ocre', influenceur: 'ocre', parti: 'sauge', association: 'sauge' };
