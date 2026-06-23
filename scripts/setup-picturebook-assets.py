#!/usr/bin/env python3
"""Slice 不思議な絵本のタイル sheet into public/assets/picturebook/."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / 'assets-source' / 'picturebook-tiles.png'
OUT_DIR = ROOT / 'public' / 'assets' / 'picturebook'
COLS = 9
ROWS = 4


def slice_sheet(src: Path, out_dir: Path) -> None:
    im = Image.open(src).convert('RGBA')
    out_dir.mkdir(parents=True, exist_ok=True)
    im.save(out_dir / 'tilesheet.png')

    w, h = im.size
    cw, ch = w // COLS, h // ROWS
    for r in range(ROWS):
        for c in range(COLS):
            tile = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            tile.save(out_dir / f'tile_{r}_{c}.png')

    print(f'sliced {COLS}x{ROWS} from {src.name} ({w}x{h}) -> {out_dir.relative_to(ROOT)}')


def main() -> None:
    import sys

    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        raise SystemExit(f'source not found: {src}\nPlace your tileset at {DEFAULT_SRC}')
    slice_sheet(src, OUT_DIR)


if __name__ == '__main__':
    main()
