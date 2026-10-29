import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageProblems } from '../scripts/check-privacy.mjs';
import { ARCHIVE_URL, VISUAL_GROUPS, isAppleMobile, visualsSection } from '../site/lib/visuals.js';

// Images du site : visuels de « Fais tourner » en pleine taille, zip, images affichées légères et propres.

const siteFile = (path) => fileURLToPath(new URL(`../site/${path}`, import.meta.url));
const siteFiles = readdirSync(siteFile(''), { recursive: true }).map((path) => path.replaceAll('\\', '/'));
const visuals = VISUAL_GROUPS.flatMap((group) => group.visuals);

// Largeur et hauteur d'un PNG (en-tête IHDR) ou d'un JPEG (premier segment SOF0 ou SOF2).
const imageSize = (bytes) => {
  if (bytes.readUInt32BE(0) === 0x89504e47) return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
  let offset = 2;
  while (bytes[offset] === 0xff) {
    const marker = bytes[offset + 1];
    if (marker === 0xc0 || marker === 0xc2) return `${bytes.readUInt16BE(offset + 7)}x${bytes.readUInt16BE(offset + 5)}`;
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  return null;
};
const sizeOf = (path) => imageSize(readFileSync(siteFile(path)));

test('chaque visuel a son fichier et sa vignette', () => {
  for (const visual of visuals) {
    assert.ok(existsSync(siteFile(visual.file)), visual.file);
    assert.ok(existsSync(siteFile(visual.thumbnail)), visual.thumbnail);
  }
});

test('les visuels gardent leur pleine taille', () => {
  const expected = ['1080x1080', '1614x584', '1500x500', '1080x1080', '1080x1080', '1080x1080', '1080x1920', '1080x1920'];
  assert.deepEqual(visuals.map((visual) => sizeOf(visual.file)), expected);
});

test('le zip contient les huit visuels, tels quels, et rien d\'autre', () => {
  const zip = readFileSync(siteFile(ARCHIVE_URL));
  const downloads = VISUAL_GROUPS.flatMap((group) => group.visuals.map((visual) => visual.file));
  const entries = [];
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const start = offset + 30 + nameLength + extraLength;
    entries.push({ method: zip.readUInt16LE(offset + 8), date: zip.readUInt16LE(offset + 12), extraLength, name: zip.toString('utf8', offset + 30, offset + 30 + nameLength), data: zip.subarray(start, start + size) });
    offset = start + size;
  }
  assert.equal(zip.readUInt32LE(offset), 0x02014b50);
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
  assert.equal(zip.readUInt16LE(zip.length - 12), downloads.length);
  assert.deepEqual(entries.map((entry) => entry.name), downloads.map((file) => basename(file)));
  for (const [i, entry] of entries.entries()) {
    assert.equal(entry.method, 0);
    assert.equal(entry.extraLength, 0);
    assert.equal(entry.date, 0x21); // 1er janvier 1980
    assert.ok(entry.data.equals(readFileSync(siteFile(downloads[i]))), entry.name);
  }
});

test('aucune image du site ne porte de métadonnées', () => {
  const images = siteFiles.filter((path) => ['.png', '.jpg', '.webp'].includes(extname(path)));
  assert.ok(images.length >= 20, `${images.length} images`);
  for (const path of images) assert.deepEqual(imageProblems(path, readFileSync(siteFile(path))), [], path);
});

test('les images affichées restent légères', () => {
  for (const path of siteFiles.filter((path) => path.startsWith('img/'))) {
    assert.ok(statSync(siteFile(path)).size <= 160 * 1024, path);
  }
  assert.ok(statSync(siteFile('partage.png')).size < 300 * 1024);
  assert.equal(sizeOf('partage.png'), '1200x630');
});

test('les favicons ont leur taille', () => {
  assert.equal(sizeOf('icons/favicon-16.png'), '16x16');
  assert.equal(sizeOf('icons/favicon-32.png'), '32x32');
});

// Rendu de la section « Fais tourner ».

const section = visualsSection();
const assertInOrder = (html, texts) => {
  const positions = texts.map((text) => html.indexOf(text));
  assert.ok(positions.every((p) => p >= 0), `absent : ${texts.filter((_, i) => positions[i] < 0).join(', ')}`);
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
};

test('la tête propose le zip', () => {
  assert.ok(section.includes('<div class="section-tete"><h2>Fais tourner</h2><p>Télécharge les visuels et partage-les sur tes réseaux.</p><a class="btn secondaire tout-telecharger" href="visuels/soyons-partisans-visuels.zip" download>Tout télécharger ↓</a></div>'));
});

test('les groupes, dans l\'ordre', () => {
  assertInOrder(section, [
    '<h3>Logos et bandeau</h3>',
    '<ul class="visuels visuels-logos">',
    '<h3>Posts carrés · 1080 × 1080</h3>',
    '<ul class="visuels visuels-posts">',
    '<h3>Stories · 1080 × 1920</h3>',
    '<div class="grille-stories"><ul class="visuels visuels-stories">',
  ]);
});

test('un post se télécharge depuis sa vignette', () => {
  assert.ok(section.includes('<li class="visuel" data-anim="drop"><a href="visuels/soyons-partisans-post-haine.jpg" download data-visuel><span class="visuel-image"><img src="img/vignette-post-haine.webp" width="800" height="800" alt="" loading="lazy" decoding="async"></span><span class="visuel-texte"><span class="visuel-nom">Leur haine vit de tes clics.</span></span><span class="visuel-action" aria-hidden="true"><span class="action-mot">Télécharger </span>↓</span></a></li>'));
});

test('un logo dit son format et son usage', () => {
  const badge = section.match(/<li class="visuel"[^>]*><a href="visuels\/soyons-partisans-badge.png".*?<\/li>/s)[0];
  assert.ok(badge.includes('<span class="visuel-texte"><span class="visuel-nom">Badge</span><span class="visuel-detail">PNG · avatar, sticker</span></span><span class="visuel-action" aria-hidden="true">↓</span>'));
});

test('huit visuels, huit cartes qui tombent', () => {
  assert.equal(section.match(/data-visuel>/g).length, 8);
  assert.equal(section.match(/data-anim="drop"/g).length, 8);
});

test('l\'encadré dit où mettre le lien', () => {
  assert.ok(section.includes('<div class="grille-stories"><ul class="visuels visuels-stories">'));
  const stories = section.slice(section.indexOf('<div class="grille-stories">'));
  assert.match(stories, /<\/ul><div class="encadre-partage"><p class="encadre-titre">Partage-les\. <span>Tague tes proches\.<\/span><\/p><p>Mets le lien soyonspartisans\.fr en story ou en bio\.<\/p><\/div><\/div>/);
});

test('isAppleMobile reconnaît iPhone et iPad', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
  assert.equal(isAppleMobile(iphone, 5), true);
  assert.equal(isAppleMobile(mac, 5), true);
  assert.equal(isAppleMobile(mac, 0), false);
  assert.equal(isAppleMobile(android, 5), false);
});
