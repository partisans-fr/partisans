// Visuels de « Fais tourner » : chaque fichier à télécharger, sa vignette (taille réelle) et sa légende.
// scripts/preparer-visuels.py produit ces fichiers ; le zip les reprend dans cet ordre.

export const ARCHIVE_URL = 'visuels/soyons-partisans-visuels.zip';

export const VISUAL_GROUPS = [
  { kind: 'logos', title: 'Logos et bandeau', visuals: [
    { name: 'Badge', detail: 'PNG · avatar, sticker', file: 'visuels/soyons-partisans-badge.png', thumbnail: 'img/vignette-badge.webp', width: 480, height: 480 },
    { name: 'Bloc', detail: 'PNG · bannière, en-tête', file: 'visuels/soyons-partisans-bloc.png', thumbnail: 'img/vignette-bloc.webp', width: 640, height: 232 },
    { name: 'Bandeau de profil', detail: 'JPG 1500 × 500 · X, Bluesky, Facebook', file: 'visuels/soyons-partisans-bandeau-profil.jpg', thumbnail: 'img/vignette-bandeau-profil.webp', width: 1200, height: 400 },
  ] },
  { kind: 'posts', title: 'Posts carrés · 1080 × 1080', visuals: [
    { name: 'Leur haine vit de tes clics.', file: 'visuels/soyons-partisans-post-haine.jpg', thumbnail: 'img/vignette-post-haine.webp', width: 800, height: 800 },
    { name: 'De la force pour ceux qui luttent.', file: 'visuels/soyons-partisans-post-force.jpg', thumbnail: 'img/vignette-post-force.webp', width: 800, height: 800 },
    { name: 'Ne leur réponds pas.', file: 'visuels/soyons-partisans-post-reponds.jpg', thumbnail: 'img/vignette-post-reponds.webp', width: 800, height: 800 },
  ] },
  { kind: 'stories', title: 'Stories · 1080 × 1920', visuals: [
    { name: 'Soyons partisans.', file: 'visuels/soyons-partisans-story-soyons.jpg', thumbnail: 'img/vignette-story-soyons.webp', width: 600, height: 1067 },
    { name: 'La consigne', file: 'visuels/soyons-partisans-story-consigne.jpg', thumbnail: 'img/vignette-story-consigne.webp', width: 600, height: 1067 },
  ] },
];
