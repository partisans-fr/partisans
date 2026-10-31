#!/usr/bin/env python3
"""Prépare l'avatar de chaque personne ou organisation de la liste.

    python3 scripts/preparer-avatars.py

Pour chaque nom de site/partisans.json, prend la première image trouvée : l'avatar Bluesky, l'avatar
Mastodon, puis, sur Wikimedia Commons, la photo (personne) ou le logo (organisation) de sa fiche
Wikidata. Écrit des carrés WebP de 96 px sans métadonnées dans site/img/avatars/, et site/lib/avatars.js,
qui associe chaque nom à son fichier et garde l'auteur et la licence des images de Commons.
Un nom sans image garde ses initiales sur le site. Outil local (Pillow), pas une dépendance du site.
"""

import html
import io
import json
import re
import time
import unicodedata
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
FOLDER = SITE / 'img' / 'avatars'
MODULE = SITE / 'lib' / 'avatars.js'
SIZE = 96  # deux fois les 40 px affichés
CARTE = '#F3ECDD'  # fond des lignes de compte, sous les logos transparents
USER_AGENT = 'Partisans-avatars/1.0 (https://soyonspartisans.fr)'
PEOPLE = {'politique', 'journaliste', 'influenceur'}

# Fiches Wikidata des noms dont la source n'en est pas une (vérifiées le 2026-10-31). Les deux NPA n'en
# ont pas exprès : depuis la scission de 2022, le logo de la fiche peut être celui de l'autre branche.
WIKIDATA = {
    'Fabien Gay': 'Q41099326',
    'Révolution Permanente': 'Q22981822',
    'Pierre-Emmanuel Barré': 'Q17350457',
    'Waly Dia': 'Q3565965',
    'Parti communiste français': 'Q192821',
    'Jeunes Communistes': 'Q1628816',
}

# Auteurs dont la fiche Commons met un long texte à la place du nom : le crédit qu'ils demandent.
AUTHORS = {
    'Ségolène Royal': 'Matthieu Riegler',
}


def clean_author(text):
    """Nom d'auteur lisible depuis le HTML de Commons : sans balises, sans doublon (« XX » quand le
    même nom est répété), « auteur inconnu » à la place d'« Unknown author »."""
    text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', text))).strip()
    half = len(text) // 2
    if text and text[:half] == text[half:]:
        text = text[:half]
    return 'auteur inconnu' if not text or text.lower() == 'unknown author' else text


def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                return response.read()
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 2:
                raise
            time.sleep(10)


def fetch_json(url):
    return json.loads(fetch(url))


def slug(name):
    ascii_name = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '-', ascii_name.lower()).strip('-')


def bluesky_avatar(entry):
    actor = entry.get('id') or entry['handle']
    profile = fetch_json(f'https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor={urllib.parse.quote(actor)}')
    return profile.get('avatar')


def mastodon_avatar(entry):
    user, instance = entry['handle'].split('@')
    account = fetch_json(f'https://{instance}/api/v1/accounts/lookup?acct={urllib.parse.quote(user)}')
    avatar = account.get('avatar_static')
    return None if not avatar or '/missing' in avatar else avatar


def commons_image(name, qid, is_person):
    """Photo (P18) d'une personne ou logo (P154) d'une organisation : (adresse de la vignette, crédit)."""
    time.sleep(1)
    entity = fetch_json(f'https://www.wikidata.org/wiki/Special:EntityData/{qid}.json')['entities'][qid]
    claims = entity['claims'].get('P18' if is_person else 'P154', [])
    if not claims:
        return None
    file_name = claims[0]['mainsnak']['datavalue']['value']
    time.sleep(1)
    query = urllib.parse.urlencode({
        'action': 'query', 'format': 'json', 'prop': 'imageinfo', 'iiprop': 'url|extmetadata',
        'iiurlwidth': 256, 'titles': f'File:{file_name}',
    })
    page = next(iter(fetch_json(f'https://commons.wikimedia.org/w/api.php?{query}')['query']['pages'].values()))
    info = page['imageinfo'][0]
    metadata = info.get('extmetadata', {})
    credit = {
        'author': AUTHORS.get(name) or clean_author(metadata.get('Artist', {}).get('value', '')),
        'license': metadata.get('LicenseShortName', {}).get('value', 'licence non précisée'),
        'url': info['descriptionurl'],
    }
    return info['thumburl'], credit


def square(data, is_logo):
    """Carré de SIZE px : un logo tient en entier, une photo est recadrée (un portrait, plutôt vers le haut)."""
    image = Image.open(io.BytesIO(data))
    image.load()
    image = image.convert('RGBA')
    background = Image.new('RGBA', image.size, CARTE)
    background.alpha_composite(image)
    image = background.convert('RGB')
    if is_logo:
        image.thumbnail((SIZE - 12, SIZE - 12), Image.LANCZOS)
        canvas = Image.new('RGB', (SIZE, SIZE), CARTE)
        canvas.paste(image, ((SIZE - image.width) // 2, (SIZE - image.height) // 2))
        return canvas
    side = min(image.size)
    left = (image.width - side) // 2
    top = (image.height - side) // 5
    return image.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)


def find_image(name, entries):
    """Première image trouvée pour un nom : (adresse, crédit ou None, logo ?, source)."""
    by_platform = {entry['platform']: entry for entry in entries}
    for platform, getter in (('bluesky', bluesky_avatar), ('mastodon', mastodon_avatar)):
        if platform in by_platform:
            try:
                url = getter(by_platform[platform])
            except Exception as error:  # un réseau injoignable ne bloque pas les autres
                print(f'  {name} : {platform} injoignable ({error})')
                url = None
            if url:
                return url, None, False, platform
    qids = [match.group(1) for entry in entries for match in [re.search(r'wikidata\.org/wiki/(Q\d+)', entry['source'])] if match]
    qid = qids[0] if qids else WIKIDATA.get(name)
    if qid:
        is_person = entries[0]['category'] in PEOPLE
        found = commons_image(name, qid, is_person)
        if found:
            return found[0], found[1], not is_person, 'commons'
    return None


def main():
    data = json.loads((SITE / 'partisans.json').read_text(encoding='utf-8'))
    names = {}
    for entry in data['entries']:
        names.setdefault(entry['displayName'], []).append(entry)

    FOLDER.mkdir(exist_ok=True)
    avatars, sources = {}, {}
    for name, entries in names.items():
        found = find_image(name, entries)
        if not found:
            sources.setdefault('aucune', []).append(name)
            continue
        url, credit, is_logo, source = found
        file_name = f'{slug(name)}.webp'
        square(fetch(url), is_logo).save(FOLDER / file_name, quality=80, method=6)
        avatars[name] = {'file': file_name, **({'credit': credit} if credit else {})}
        sources.setdefault(source, []).append(name)

    for path in FOLDER.iterdir():
        if path.name not in {avatar['file'] for avatar in avatars.values()}:
            path.unlink()

    MODULE.write_text(
        '// Produit par scripts/preparer-avatars.py : ne pas modifier à la main.\n'
        '// Avatar de chaque nom de la liste (dans img/avatars/), avec l\'auteur et la licence des images de\n'
        '// Wikimedia Commons. Un nom absent garde ses initiales.\n\n'
        f'export const AVATARS = {json.dumps(avatars, ensure_ascii=False, indent=2)};\n',
        encoding='utf-8',
    )

    for source, found_names in sources.items():
        print(f'{source} ({len(found_names)}) : {", ".join(found_names)}')
    sizes = [path.stat().st_size for path in FOLDER.iterdir()]
    print(f'{len(sizes)} avatars, {sum(sizes) // 1024} Ko en tout, {max(sizes) // 1024} Ko au plus')


if __name__ == '__main__':
    main()
