// Visuels de « Fais tourner » : chaque fichier à télécharger, sa vignette (taille réelle) et sa légende.
// scripts/preparer-visuels.py produit ces fichiers ; le zip les reprend dans cet ordre.

import { escapeHtml } from './html.js';

export const ARCHIVE_URL = 'visuels/soyons-partisans-visuels.zip';

export const VISUAL_GROUPS = [
  { kind: 'logos', title: 'Logos et bandeau', visuals: [
    { name: 'Badge', detail: 'PNG · avatar, sticker', file: 'visuels/soyons-partisans-badge.png', thumbnail: 'img/vignette-badge.webp', width: 480, height: 480 },
    { name: 'Bloc', detail: 'PNG · bannière, en-tête', file: 'visuels/soyons-partisans-bloc.png', thumbnail: 'img/vignette-bloc.webp', width: 640, height: 232 },
    { name: 'Bandeau de profil', detail: 'JPG 1500 × 500 · X, Bluesky, Facebook', file: 'visuels/soyons-partisans-bandeau-profil.jpg', thumbnail: 'img/vignette-bandeau-profil.webp', width: 1200, height: 400 },
  ] },
  { kind: 'posts', title: 'Carrousel · 1080 × 1080', visuals: [
    { name: 'Slide 1', file: 'visuels/soyons-partisans-slide-1.jpg', thumbnail: 'img/vignette-slide-1.webp', width: 800, height: 800 },
    { name: 'Slide 2', file: 'visuels/soyons-partisans-slide-2.jpg', thumbnail: 'img/vignette-slide-2.webp', width: 800, height: 800 },
    { name: 'Slide 3', file: 'visuels/soyons-partisans-slide-3.jpg', thumbnail: 'img/vignette-slide-3.webp', width: 800, height: 800 },
  ] },
  { kind: 'stories', title: 'Stories · 1080 × 1920', visuals: [
    { name: 'Soyons partisans.', file: 'visuels/soyons-partisans-story-soyons.jpg', thumbnail: 'img/vignette-story-soyons.webp', width: 600, height: 1067 },
    { name: 'La consigne', file: 'visuels/soyons-partisans-story-consigne.jpg', thumbnail: 'img/vignette-story-consigne.webp', width: 600, height: 1067 },
  ] },
];

// Une carte : la vignette, la légende (cachée à l'œil sur téléphone) et la flèche. Le lien télécharge
// le fichier en pleine taille ; sur iPhone, app.js ouvre plutôt le menu de partage (data-visuel).
function visualCard({ name, detail, file, thumbnail, width, height }, kind) {
  const action = kind === 'posts' ? '<span class="action-mot">Télécharger </span>↓' : '↓';
  const detailText = detail ? `<span class="visuel-detail">${escapeHtml(detail)}</span>` : '';
  return `<li class="visuel" data-anim="drop"><a href="${file}" download data-visuel><span class="visuel-image"><img src="${thumbnail}" width="${width}" height="${height}" alt="" loading="lazy" decoding="async"></span><span class="visuel-texte"><span class="visuel-nom">${escapeHtml(name)}</span>${detailText}</span><span class="visuel-action" aria-hidden="true">${action}</span></a></li>`;
}

function visualGroup({ kind, title, visuals }) {
  const list = `<ul class="visuels visuels-${kind}">${visuals.map((visual) => visualCard(visual, kind)).join('')}</ul>`;
  const body = kind === 'stories'
    ? `<div class="grille-stories">${list}<div class="encadre-partage"><p class="encadre-titre">Partage-les. <span>Tague tes proches.</span></p><p>Mets le lien soyonspartisans.fr en story ou en bio.</p></div></div>`
    : list;
  return `<div class="groupe-visuels"><h3>${escapeHtml(title)}</h3>${body}</div>`;
}

export function visualsSection() {
  return `<section class="fais-tourner" id="fais-tourner" tabindex="-1">
    <div class="section-tete"><h2>Fais tourner</h2><p>Télécharge les visuels et partage-les sur tes réseaux.</p><a class="btn secondaire tout-telecharger" href="${ARCHIVE_URL}" download>Tout télécharger ↓</a></div>
    ${VISUAL_GROUPS.map(visualGroup).join('\n    ')}
  </section>`;
}

// iPhone, iPod, et iPad, qui se présente comme un Mac mais répond au toucher.
export const isAppleMobile = (userAgent, maxTouchPoints) =>
  /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && maxTouchPoints > 1);
