import { test } from 'node:test';
import assert from 'node:assert/strict';
import { imageProblems } from '../scripts/check-privacy.mjs';

const riff = (type) => {
  const head = Buffer.alloc(8);
  head.write(type, 0, 'ascii');
  head.writeUInt32LE(4, 4);
  return Buffer.concat([head, Buffer.alloc(4)]);
};
const webp = (...types) => {
  const body = Buffer.concat([Buffer.from('WEBP'), ...types.map(riff)]);
  const head = Buffer.from('RIFF0000');
  head.writeUInt32LE(body.length, 4);
  return Buffer.concat([head, body]);
};
const jpeg = (...markers) =>
  Buffer.concat([Buffer.from([0xff, 0xd8]), ...markers.map((m) => Buffer.from([0xff, m, 0, 4, 0, 0])), Buffer.from([0xff, 0xda, 0, 2])]);

test('un WebP sans métadonnées passe', () => {
  assert.deepEqual(imageProblems('a.webp', webp('VP8X', 'ALPH', 'VP8 ')), []);
  assert.deepEqual(imageProblems('b.webp', webp('VP8L')), []);
});

test('un WebP avec EXIF, XMP ou profil ICC est refusé', () => {
  for (const type of ['EXIF', 'XMP ', 'ICCP']) assert.equal(imageProblems('a.webp', webp('VP8X', type, 'VP8 ')).length, 1, type);
});

test('un fichier .webp illisible est refusé', () => {
  assert.equal(imageProblems('a.webp', Buffer.from('pas une image')).length, 1);
});

test('un JPEG ne garde que son segment JFIF', () => {
  assert.deepEqual(imageProblems('a.jpg', jpeg(0xe0, 0xdb)), []);
  for (const marker of [0xe1, 0xe2, 0xeb, 0xed, 0xfe]) assert.equal(imageProblems('a.jpg', jpeg(0xe0, marker)).length, 1, marker.toString(16));
});

test('les autres formats d\'image restent refusés, le reste passe', () => {
  assert.equal(imageProblems('a.gif', Buffer.alloc(0)).length, 1);
  assert.deepEqual(imageProblems('a.txt', Buffer.from('texte')), []);
});
