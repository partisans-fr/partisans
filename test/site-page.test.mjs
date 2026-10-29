import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';

// La page du site ne doit rien charger hors de son dossier : ni script, ni style, ni police, ni image.

const page = readFileSync(new URL('../site/index.html', import.meta.url), 'utf8');
const CSP =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; img-src \'self\' data:; base-uri \'none\'; form-action \'none\'">';

test('la page ne charge rien hors du site', () => {
  const external = /^(?:https?:|\/\/)/;
  for (const [, src] of page.matchAll(/\bsrc="([^"]*)"/g)) assert.doesNotMatch(src, external, src);
  for (const [link] of page.matchAll(/<link\b[^>]*>/g)) {
    const [, href] = link.match(/\bhref="([^"]*)"/) ?? [];
    assert.doesNotMatch(href ?? '', external, link);
  }
  assert.ok(page.includes(CSP));
  assert.doesNotMatch(page, /<script(?![^>]*\bsrc=)[^>]*>/);
  assert.doesNotMatch(page, /\sstyle=/);
  assert.doesNotMatch(page, /<style\b/);
});

const meta = (property) => page.match(new RegExp(`<meta property="${property}" content="([^"]*)">`))?.[1];
const siteFile = (path) => new URL(`../site/${path}`, import.meta.url);
// Largeur et hauteur d'un PNG : octets 16 à 24 de l'en-tête IHDR.
const pngSize = (path) => {
  const bytes = readFileSync(siteFile(path));
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
};

test('l\'image de partage vit à côté de l\'adresse du site', () => {
  assert.equal(meta('og:url'), 'https://soyonspartisans.fr/');
  assert.equal(meta('og:image'), `${meta('og:url')}partage.png`);
});

test('le manifeste et ses icônes existent aux bonnes tailles', () => {
  const manifest = JSON.parse(readFileSync(siteFile('manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.icons.length >= 2);
  for (const icon of manifest.icons) assert.equal(pngSize(icon.src), icon.sizes, icon.src);
  assert.equal(pngSize('icons/apple-touch-icon.png'), '180x180');
  assert.equal(pngSize('partage.png'), '1200x630');
});

const siteFiles = readdirSync(new URL('../site/', import.meta.url), { recursive: true });
const stylesheets = [...page.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map(([, href]) => href);

test('tout fichier appelé par la page existe', () => {
  for (const [, ref] of page.matchAll(/\b(?:src|href)="([^"]+)"/g)) assert.ok(existsSync(siteFile(ref)), ref);
});

test('les feuilles de style ne chargent que des fichiers du site', () => {
  assert.ok(stylesheets.length >= 1);
  for (const sheet of stylesheets) {
    const text = readFileSync(siteFile(sheet), 'utf8');
    assert.doesNotMatch(text, /@import/, sheet);
    for (const [, url] of text.matchAll(/url\(\s*['"]?([^'")]+)/g)) {
      assert.doesNotMatch(url, /^(?:[a-z]+:|\/\/)/, url);
      assert.ok(existsSync(siteFile(url)), url);
    }
  }
});

test('les polices sont servies par le site, avec leur licence', () => {
  for (const font of ['bricolage-grotesque', 'newsreader', 'newsreader-italique']) {
    assert.equal(readFileSync(siteFile(`polices/${font}.woff2`)).toString('latin1', 0, 4), 'wOF2', font);
  }
  for (const license of ['OFL-bricolage-grotesque.txt', 'OFL-newsreader.txt']) {
    assert.match(readFileSync(siteFile(`polices/${license}`), 'utf8'), /SIL Open Font License/);
  }
});

test('les couleurs du navigateur sont celles de la charte', () => {
  const manifest = JSON.parse(readFileSync(siteFile('manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.theme_color, '#C2341F');
  assert.equal(manifest.background_color, '#EFEBE3');
  assert.ok(page.includes('<meta name="theme-color" content="#C2341F">'));
});

test('les images vectorielles n\'embarquent aucune métadonnée', () => {
  for (const file of siteFiles.filter((f) => f.endsWith('.svg'))) {
    assert.doesNotMatch(readFileSync(siteFile(file), 'utf8'), /<metadata|c2pa/i, file);
  }
});

test('aucun tiret cadratin dans les fichiers du site', () => {
  for (const file of siteFiles.filter((f) => /\.(?:html|css|js|json|webmanifest)$/.test(f))) {
    assert.ok(!readFileSync(siteFile(file), 'utf8').includes(String.fromCodePoint(0x2014)), file);
  }
});
