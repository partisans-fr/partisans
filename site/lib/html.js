// Morceaux HTML partagés par l'accueil et les écrans du parcours : échappement, boutons, barre au
// logo, accords et poing.

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (char) => ESCAPES[char]);

export const EXTERNAL = 'target="_blank" rel="noopener noreferrer"';

// Un seul bouton rouge plein par écran : les autres sont secondaires (encadrés).
export function button(label, href, { secondary = false } = {}) {
  if (!href) return `<button class="btn" disabled>${label}</button>`;
  return `<a class="btn${secondary ? ' secondaire' : ''}" href="${href}">${label}</a>`;
}

export const bar = (extra = '') =>
  `<header class="barre"><span class="logo"><span class="logo-poing" aria-hidden="true"></span><span class="logo-mots"><span class="logo-soyons">Soyons</span> <span class="logo-partisans">Partisans</span></span></span>${extra}</header>`;

export const plural = (count, word) => `${count} ${word}${count > 1 ? 's' : ''}`;

// Poing papier du hero et de la fin : deux résolutions, la plus légère sur téléphone.
export const fist = (sizes) =>
  `<img class="poing" src="img/poing-papier-880.webp" srcset="img/poing-papier-880.webp 426w, img/poing-papier.webp 718w" sizes="${sizes}" width="718" height="1483" alt="" data-anim="rise">`;
