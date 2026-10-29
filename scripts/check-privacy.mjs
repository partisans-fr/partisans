#!/usr/bin/env node
// Garde-fou d'anonymat : vérifie qu'aucune information personnelle ne part dans un commit.
//
//   node scripts/check-privacy.mjs                     tout ce qui peut être commité
//   node scripts/check-privacy.mjs --staged            fichiers indexés (hook pre-commit)
//   node scripts/check-privacy.mjs --message <fichier> message de commit (hook commit-msg)
//
// Les motifs personnels (noms, pseudos, adresses) vivent dans .git/info/privacy-patterns,
// un par ligne : ce fichier n'est jamais commité ni publié.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const gitRaw = (...args) => execFileSync('git', args, { maxBuffer: 64 * 1024 * 1024 });

const GENERIC_PATTERNS = [
  { label: 'chemin absolu Linux/macOS', regex: /\/(home|Users)\/[^/\s'"`]+\// },
  { label: 'chemin absolu WSL', regex: /\/mnt\/[a-z]\// },
  { label: 'chemin absolu Windows', regex: /[A-Za-z]:\\Users\\/i },
  { label: 'lien de session claude.ai (lié à un compte)', regex: /claude\.ai\/code\/session/i },
];

const PNG_ALLOWED_CHUNKS = new Set(['IHDR', 'PLTE', 'tRNS', 'IDAT', 'IEND', 'sRGB', 'gAMA']);
const JPEG_MARKER_NAMES = { 0xe1: 'EXIF/XMP', 0xe2: 'profil ICC', 0xeb: 'C2PA/JUMBF', 0xed: 'IPTC', 0xfe: 'commentaire' };
const WEBP_ALLOWED_CHUNKS = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH']);
const UNCHECKED_IMAGES = new Set(['.gif', '.ico', '.bmp', '.tif', '.tiff', '.heic', '.avif']);

function loadPersonalPatterns() {
  const path = git('rev-parse', '--git-path', 'info/privacy-patterns');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => line.toLowerCase());
}

function findLeaks(text, personalPatterns) {
  const lower = text.toLowerCase();
  const leaks = personalPatterns.filter((p) => lower.includes(p)).map((p) => `motif personnel « ${p} »`);
  for (const { label, regex } of GENERIC_PATTERNS) {
    if (regex.test(text)) leaks.push(label);
  }
  return leaks;
}

function pngMetadataProblems(buffer) {
  const problems = [];
  let offset = 8;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (!PNG_ALLOWED_CHUNKS.has(type)) problems.push(`bloc PNG « ${type} » (métadonnées)`);
    offset += 12 + length;
  }
  return problems;
}

function jpegMetadataProblems(buffer) {
  const problems = [];
  let offset = 2;
  while (offset + 4 <= buffer.length && buffer[offset] === 0xff) {
    const marker = buffer[offset + 1];
    if (marker === 0xda) break; // début des données d'image
    // Seul le segment JFIF (APP0) est gardé : APP1 à APP15 et les commentaires portent des métadonnées.
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) problems.push(`segment JPEG ${JPEG_MARKER_NAMES[marker] ?? 'APPn'}`);
    offset += 2 + buffer.readUInt16BE(offset + 2);
  }
  return problems;
}

function webpMetadataProblems(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    return ['fichier WebP illisible'];
  }
  const problems = [];
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    if (!WEBP_ALLOWED_CHUNKS.has(type)) problems.push(`bloc WebP « ${type} » (métadonnées)`);
    offset += 8 + size + (size & 1);
  }
  return problems;
}

export function imageProblems(path, buffer) {
  const ext = extname(path).toLowerCase();
  if (ext === '.png') return pngMetadataProblems(buffer);
  if (ext === '.jpg' || ext === '.jpeg') return jpegMetadataProblems(buffer);
  if (ext === '.webp') return webpMetadataProblems(buffer);
  if (UNCHECKED_IMAGES.has(ext)) return ['format d\'image non vérifié : convertis en PNG sans métadonnées'];
  return [];
}

function fileProblems(path, buffer, personalPatterns) {
  const ext = extname(path).toLowerCase();
  const problems = findLeaks(path, personalPatterns).map((p) => `nom de fichier : ${p}`);
  problems.push(...imageProblems(path, buffer));

  const binary = ['.png', '.jpg', '.jpeg', '.webp'].includes(ext);
  const text = buffer.toString(binary ? 'latin1' : 'utf8');
  if (ext === '.svg' && /<metadata|<rdf:|sodipodi:|inkscape:/i.test(text)) {
    problems.push('métadonnées SVG (éditeur, chemins de fichiers)');
  }
  problems.push(...findLeaks(text, personalPatterns));
  return problems;
}

function identityProblems(personalPatterns) {
  const problems = [];
  let localEmail = '';
  try {
    localEmail = git('config', '--local', 'user.email');
  } catch {}
  if (!localEmail) problems.push('aucune identité git locale : le commit utiliserait ta config globale');

  for (const variable of ['GIT_AUTHOR_IDENT', 'GIT_COMMITTER_IDENT']) {
    const ident = git('var', variable).replace(/\s\d+\s[+-]\d{4}$/, '');
    if (!/noreply/i.test(ident)) problems.push(`${variable} n'est pas une adresse noreply : ${ident}`);
    for (const leak of findLeaks(ident, personalPatterns)) problems.push(`${variable} : ${leak}`);
  }
  return problems;
}

function main() {
  const args = process.argv.slice(2);
  const personalPatterns = loadPersonalPatterns();
  if (!personalPatterns) {
    console.error('Garde-fou inactif : .git/info/privacy-patterns est introuvable. Lance scripts/install-hooks.sh.');
    process.exit(1);
  }

  const report = [];

  if (args[0] === '--message') {
    const message = readFileSync(args[1], 'utf8')
      .split('\n')
      .filter((line) => !line.startsWith('#'))
      .join('\n');
    report.push(...findLeaks(message, personalPatterns).map((p) => `message de commit : ${p}`));
  } else {
    report.push(...identityProblems(personalPatterns).map((p) => `identité : ${p}`));

    const staged = args[0] === '--staged';
    const paths = staged
      ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR')
      : git('ls-files', '--cached', '--others', '--exclude-standard');

    for (const path of paths.split('\n').filter(Boolean)) {
      if (!staged && !existsSync(path)) continue;
      const buffer = staged ? gitRaw('show', `:${path}`) : readFileSync(path);
      report.push(...fileProblems(path, buffer, personalPatterns).map((p) => `${path} : ${p}`));
    }
  }

  if (report.length) {
    console.error('Fuite potentielle d\'identité, commit refusé :');
    for (const line of report) console.error(`  - ${line}`);
    process.exit(1);
  }
  console.log('Garde-fou d\'anonymat : RAS.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
