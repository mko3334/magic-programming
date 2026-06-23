#!/usr/bin/env python3
"""Slice 不思議な絵本のタイル sheet and generate square crop metadata."""

from pathlib import Path
import json
import re

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SRC = ROOT / 'assets-source' / 'picturebook-tiles.png'
OUT_DIR = ROOT / 'public' / 'assets' / 'picturebook'
CROP_OUT = ROOT / 'public' / 'data' / 'picturebook-crop.json'
COLS = 9
ROWS = 4


def is_bg(r, g, b, a=255):
    if a < 25:
        return True
    if r > 232 and g > 228 and b > 215:
        return True
    if abs(r - g) < 12 and abs(g - b) < 18 and r > 210:
        return True
    return False


def load_tile_ids():
    js = (ROOT / 'public/js/picturebook-assets.js').read_text(encoding='utf-8')
    return re.findall(r"\{ id: '(pb_[^']+)'", js)


def detect_crops(im, cw, ch, ids):
    crops = {}
    for i, tid in enumerate(ids):
        row, col = divmod(i, COLS)
        x0, y0 = col * cw, row * ch
        tile = im.crop((x0, y0, x0 + cw, y0 + ch))
        px = tile.load()
        w, h = tile.size
        minx, miny, maxx, maxy = w, h, -1, -1
        for y in range(h):
            for x in range(w):
                if not is_bg(*px[x, y]):
                    minx = min(minx, x)
                    miny = min(miny, y)
                    maxx = max(maxx, x)
                    maxy = max(maxy, y)
        if maxx < minx:
            crops[tid] = {'left': 0, 'top': 0, 'right': 0, 'bottom': 0}
            continue
        pad = 2
        minx = max(0, minx - pad)
        miny = max(0, miny - pad)
        maxx = min(w - 1, maxx + pad)
        maxy = min(h - 1, maxy + pad)
        bw, bh = maxx - minx + 1, maxy - miny + 1
        side = max(bw, bh)
        cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
        sq_minx = int(round(cx - side / 2))
        sq_miny = int(round(cy - side / 2))
        sq_minx = max(0, min(sq_minx, w - side))
        sq_miny = max(0, min(sq_miny, h - side))
        crops[tid] = {
            'left': round(sq_minx / w, 4),
            'top': round(sq_miny / h, 4),
            'right': round((w - (sq_minx + side)) / w, 4),
            'bottom': round((h - (sq_miny + side)) / h, 4),
        }
    return crops


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

    ids = load_tile_ids()
    crops = detect_crops(im, cw, ch, ids)
    CROP_OUT.parent.mkdir(parents=True, exist_ok=True)
    CROP_OUT.write_text(
        json.dumps({'version': 1, 'cellAspect': round(cw / ch, 4), 'tiles': crops}, ensure_ascii=False, indent=2),
        encoding='utf-8',
    )
    print(f'sliced {COLS}x{ROWS} from {src.name} ({w}x{h}) -> {out_dir.relative_to(ROOT)}')
    print(f'wrote crops -> {CROP_OUT.relative_to(ROOT)} ({len(crops)} tiles)')


def main() -> None:
    import sys

    src = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SRC
    if not src.exists():
        raise SystemExit(f'source not found: {src}\nPlace your tileset at {DEFAULT_SRC}')
    slice_sheet(src, OUT_DIR)


if __name__ == '__main__':
    main()
