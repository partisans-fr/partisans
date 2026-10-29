#!/usr/bin/env python3
"""Produit les images du site depuis le handoff de l'identité « Soyons Partisans ».

    python3 scripts/preparer-visuels.py <dossier du handoff>

Écrit dans site/ : poings, silhouettes du logo, grain et vignettes (img/), visuels à télécharger
et leur zip (visuels/), favicons et icônes (icons/), image d'aperçu du lien (partage.png).
Aucune métadonnée ne suit : profils de couleur, EXIF et commentaires sont retirés.
Outil local (Pillow), pas une dépendance du site.
"""

import sys
import zipfile
from pathlib import Path

from PIL import Image

SITE = Path(__file__).resolve().parent.parent / 'site'
PAPIER = '#EADFC8'
ROUGE = '#D7261E'

# Dans l'ordre de VISUAL_GROUPS (site/lib/visuals.js) : le zip les reprend ainsi.
DOWNLOADS = [
    ('complements/badge.png', 'soyons-partisans-badge.png'),
    ('complements/bloc.png', 'soyons-partisans-bloc.png'),
    ('visuels-jpg-2/bandeau-profil.jpg', 'soyons-partisans-bandeau-profil.jpg'),
    ('visuels-jpg-2/carrousel-A/1-extreme-droite-vit-de-tes-clics.jpg', 'soyons-partisans-carrousel-1-slide-1.jpg'),
    ('visuels-jpg-2/carrousel-A/2-ne-lui-reponds-pas.jpg', 'soyons-partisans-carrousel-1-slide-2.jpg'),
    ('visuels-jpg-2/carrousel-B/1-donne-de-la-force.jpg', 'soyons-partisans-carrousel-2-slide-1.jpg'),
    ('visuels-jpg-2/carrousel-B/2-ne-lui-reponds-pas.jpg', 'soyons-partisans-carrousel-2-slide-2.jpg'),
    ('visuels-jpg/02-stories/story-1-soyons.jpg', 'soyons-partisans-story-soyons.jpg'),
    ('visuels-jpg/02-stories/story-2-consigne.jpg', 'soyons-partisans-story-consigne.jpg'),
]

THUMBNAILS = [
    ('complements/badge.png', 'vignette-badge.webp', 480),
    ('complements/bloc.png', 'vignette-bloc.webp', 640),
    ('visuels-jpg-2/bandeau-profil.jpg', 'vignette-bandeau-profil.webp', 1200),
    ('visuels-jpg-2/carrousel-A/1-extreme-droite-vit-de-tes-clics.jpg', 'vignette-carrousel-1-slide-1.webp', 800),
    ('visuels-jpg-2/carrousel-A/2-ne-lui-reponds-pas.jpg', 'vignette-carrousel-1-slide-2.webp', 800),
    ('visuels-jpg-2/carrousel-B/1-donne-de-la-force.jpg', 'vignette-carrousel-2-slide-1.webp', 800),
    ('visuels-jpg-2/carrousel-B/2-ne-lui-reponds-pas.jpg', 'vignette-carrousel-2-slide-2.webp', 800),
    ('visuels-jpg/02-stories/story-1-soyons.jpg', 'vignette-story-soyons.webp', 600),
    ('visuels-jpg/02-stories/story-2-consigne.jpg', 'vignette-story-consigne.webp', 600),
]

ICONS = [
    ('assets/favicon/favicon-16.png', 'favicon-16.png'),
    ('assets/favicon/favicon-32.png', 'favicon-32.png'),
    ('assets/favicon/apple-touch-icon-180.png', 'apple-touch-icon.png'),
    ('assets/favicon/icon-512.png', 'icon-512.png'),
]


def open_clean(path):
    image = Image.open(path)
    image.load()
    image.info = {}
    return image


def to_height(image, height):
    return image.resize((round(image.width * height / image.height), height), Image.LANCZOS)


def to_width(image, width):
    return image.resize((width, round(image.height * width / image.width)), Image.LANCZOS)


def strip_jpeg(data: bytes) -> bytes:
    """Garde le JPEG entier sauf ses segments APP1 à APP15, ses commentaires et ce qui suit la fin
    de l'image (marqueur FFD9), sans réencoder."""
    kept, i = bytearray(data[:2]), 2
    while data[i] == 0xFF and data[i + 1] != 0xDA:
        marker, length = data[i + 1], int.from_bytes(data[i + 2:i + 4], 'big')
        if not (0xE1 <= marker <= 0xEF or marker == 0xFE):
            kept += data[i:i + 2 + length]
        i += 2 + length
    end = data.rfind(b'\xff\xd9') + 2
    return bytes(kept + data[i:end])


def write_archive(destination, files):
    """Zip sans compression ni date réelle : les images ne se compressent pas, et rien ne date l'export."""
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_STORED) as archive:
        for path in files:
            info = zipfile.ZipInfo(path.name, date_time=(1980, 1, 1, 0, 0, 0))
            info.external_attr = 0o644 << 16
            archive.writestr(info, path.read_bytes())


def solid_from_mask(mask, color):
    """Aplat de couleur qui prend l'alpha du masque."""
    flat = Image.new('RGBA', mask.size, color)
    flat.putalpha(mask.getchannel('A'))
    return flat


def report(path):
    print(f'{path.relative_to(SITE)}  {path.stat().st_size // 1024} Ko')


def main(handoff):
    source = lambda path: handoff / path
    img, visuels, icons = SITE / 'img', SITE / 'visuels', SITE / 'icons'
    for folder in (img, visuels, icons):
        folder.mkdir(exist_ok=True)

    outputs = []

    def save(image, path, **options):
        image.save(path, **options)
        outputs.append(path)

    papier = open_clean(source('assets/poing/poing-papier.png'))
    rouge = open_clean(source('assets/poing/poing-rouge.png'))
    save(papier, img / 'poing-papier.webp', quality=75, method=6)
    save(to_height(papier, 880), img / 'poing-papier-880.webp', quality=75, method=6)
    save(to_height(rouge, 180), img / 'poing-rouge-180.webp', quality=85, method=6)
    save(to_height(papier, 180), img / 'poing-papier-180.webp', quality=85, method=6)

    mask = to_height(open_clean(source('assets/poing/masque-silhouette-blanc.png')), 76)
    save(solid_from_mask(mask, ROUGE), img / 'silhouette-rouge.png', optimize=True)
    save(solid_from_mask(mask, PAPIER), img / 'silhouette-papier.png', optimize=True)

    grain = open_clean(source('complements/grain.png')).convert('RGBA')
    paper = Image.new('RGB', grain.size, PAPIER)
    paper.paste(grain, mask=grain)
    save(paper.quantize(32, method=Image.Quantize.MEDIANCUT), img / 'grain.png', optimize=True)

    for path, name, width in THUMBNAILS:
        save(to_width(open_clean(source(path)), width), img / name, quality=80, method=6)

    downloads = []
    for path, name in DOWNLOADS:
        destination = visuels / name
        if name.endswith('.png'):
            save(open_clean(source(path)), destination, optimize=True)
        else:
            destination.write_bytes(strip_jpeg(source(path).read_bytes()))
            outputs.append(destination)
        downloads.append(destination)
    write_archive(visuels / 'soyons-partisans-visuels.zip', downloads)
    outputs.append(visuels / 'soyons-partisans-visuels.zip')

    for path, name in ICONS:
        save(open_clean(source(path)), icons / name, optimize=True)
    save(open_clean(source('assets/favicon/icon-512.png')).resize((192, 192), Image.LANCZOS), icons / 'icon-192.png', optimize=True)

    preview = open_clean(source('complements/partage.png')).convert('RGB')
    save(preview.quantize(256, method=Image.Quantize.FASTOCTREE), SITE / 'partage.png', optimize=True)

    for path in outputs:
        report(path)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage : python3 scripts/preparer-visuels.py <dossier du handoff>')
    main(Path(sys.argv[1]))
