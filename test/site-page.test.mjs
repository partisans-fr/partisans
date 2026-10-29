import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
  assert.equal(meta('og:url'), 'https://partisans.netlify.app/');
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
