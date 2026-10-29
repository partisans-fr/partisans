#!/usr/bin/env python3
"""Recentre les flèches ← ↑ → ↓ d'une police sur la hauteur de ses capitales.

    python3 scripts/recentrer-fleches.py site/polices/dela-gothic-one.woff2

Dela Gothic One dessine ses flèches pour le japonais : → tombe 0,1 em sous le milieu des
capitales, ↓ 0,22 em. Le script les remonte (ou les descend) d'autant ; relancé, il ne change
plus rien. Outil local (fontTools), pas une dépendance du site.
"""

import sys

from fontTools.ttLib import TTFont

ARROWS = '←↑→↓'


def main(path):
    font = TTFont(path)
    glyf, cmap = font['glyf'], font.getBestCmap()
    cap_centre = font['OS/2'].sCapHeight / 2
    for char in ARROWS:
        glyph = glyf[cmap[ord(char)]]
        glyph.recalcBounds(glyf)
        shift = round(cap_centre - (glyph.yMin + glyph.yMax) / 2)
        if shift:
            glyph.coordinates.translate((0, shift))
            glyph.recalcBounds(glyf)
        print(f'{char} déplacée de {shift}')
    font.save(path)


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage : python3 scripts/recentrer-fleches.py <police>')
    main(sys.argv[1])
