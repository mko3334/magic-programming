#!/usr/bin/env python3
"""Copy Sprout Lands PNGs into public/assets/sprout for the web game."""

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/assets/sprout'
BASIC = ROOT / 'Sprout Lands - Sprites - Basic pack'
SORRY = ROOT / 'Sprout Sorry pack/Early Access/Plant update 2'

COPY = {
    BASIC / 'Tilesets/Grass.png': OUT / 'grass.png',
    BASIC / 'Tilesets/Water.png': OUT / 'water.png',
    BASIC / 'Tilesets/Tilled_Dirt.png': OUT / 'tilled-dirt.png',
    BASIC / 'Objects/Basic_Grass_Biom_things.png': OUT / 'grass-biom.png',
    SORRY / 'Trees, stumps and bushes v2.png': OUT / 'trees-bushes.png',
    BASIC / 'Objects/Chest.png': OUT / 'chest.png',
    BASIC / 'Characters/Basic Charakter Spritesheet.png': OUT / 'character.png',
}

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for src, dst in COPY.items():
        if not src.exists():
            print('skip missing', src)
            continue
        shutil.copy2(src, dst)
        print('copied', dst.relative_to(ROOT))
    print('done')

if __name__ == '__main__':
    main()
