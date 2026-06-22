#!/usr/bin/env python3
"""Extract clean 32x32 transparent CAT-MAGE frames from the labeled preview."""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public/assets/cat-mage-source.jpg"
OUT = ROOT / "public/assets/cat-mage-sheet.png"

FRAME = 32
COLS = 8
ROWS = 4
CELL_W = 108
CELL_H = 118
ORIGIN_X = 130
ORIGIN_Y = 20
INNER = 96  # crop inside each preview cell


def is_bg(r, g, b, a=255):
    if a < 20:
        return True
    # preview panel + grid lines
    if r > 188 and g > 195 and b > 200:
        return True
    if abs(r - g) < 8 and abs(g - b) < 12 and r > 170:
        return True
    return False


def is_label(r, g, b, a=255):
    if a < 20:
        return False
    return r < 95 and g < 95 and b < 105


def extract_frame(im, row, col):
    x0 = ORIGIN_X + col * CELL_W
    y0 = ORIGIN_Y + row * CELL_H
    cx = x0 + CELL_W // 2 - INNER // 2
    cy = y0 + CELL_H // 2 - INNER // 2
    crop = im.crop((cx, cy, cx + INNER, cy + INNER))

    px = crop.load()
    w, h = crop.size
    chars = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b, a) or is_label(r, g, b, a):
                px[x, y] = (0, 0, 0, 0)
            else:
                chars.append((x, y))

    if not chars:
        return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))

    xs = [p[0] for p in chars]
    ys = [p[1] for p in chars]
    minx, maxx = min(xs), max(xs)
    miny, maxy = min(ys), max(ys)
    sprite = crop.crop((minx, miny, maxx + 1, maxy + 1))

    sw, sh = sprite.size
    pad = 2
    max_h = FRAME - pad * 2
    max_w = FRAME - pad * 2
    scale = min(max_w / sw, max_h / sh, 1.0)
    nw = max(1, int(round(sw * scale)))
    nh = max(1, int(round(sh * scale)))
    if scale < 1.0:
        sprite = sprite.resize((nw, nh), Image.NEAREST)

    out = Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))
    ox = (FRAME - sprite.width) // 2
    oy = FRAME - pad - sprite.height  # feet near bottom
    out.paste(sprite, (ox, oy), sprite)
    return out


def main():
    src = SRC if SRC.exists() else ROOT / "public/assets/cat-mage-sheet.png"
    im = Image.open(src).convert("RGBA")
    sheet = Image.new("RGBA", (COLS * FRAME, ROWS * FRAME), (0, 0, 0, 0))
    for row in range(ROWS):
        for col in range(COLS):
            frame = extract_frame(im, row, col)
            sheet.paste(frame, (col * FRAME, row * FRAME))
    sheet.save(OUT)
    print("wrote", OUT, sheet.size)


if __name__ == "__main__":
    main()
