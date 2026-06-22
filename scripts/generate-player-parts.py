#!/usr/bin/env python3
"""
Generate 64x64 skeletal player parts + socket items for Pop Magic.

Side-view chibi mage for top-down play — same palette & scale as pop-art.js.
Keep shapes tiny, outlined, and readable (Zelda / enemyWalk quality).
"""

import json

W = H = 64
FOOT_X, FOOT_Y = 32, 57

# Match public/js/pop-art.js — do not invent new colors
PAL = {
    ".": None,
    "O": "#1a2e1a",
    "%": "#ffd5b8",
    "e": "#1e293b",
    "E": "#ffffff",
    "+": "#1e40af",
    "-": "#3b82f6",
    "=": "#93c5fd",
    "{": "#fbbf24",
    "Y": "#fde047",
    "@": "#22d3ee",
    ";": "#67e8f8",
    "|": "#78350f",
    "/": "#92400e",
    "u": "#a8a29e",
    "U": "#78716c",
    "C": "#64748b",
    "x": "#475569",
    "H": "#dc2626",
    "h": "#ef4444",
    "j": "#fca5a5",
}

ANIM_NAMES = [
    "idle0", "idle1",
    "walk0", "walk1", "walk2", "walk3",
    "atk0", "atk1", "atk2", "atk3",
    "hurt",
]

BODY_DRAW_ORDER = ["back", "tail", "legs", "torso", "arm_back", "robe", "head", "arm_front"]
SOCKET_DRAW_ORDER = ["weapon", "hat"]

HAT_ORIGIN = (32, 17)
WEAPON_ORIGIN = (5, 38)


def blank():
    return [["." for _ in range(W)] for _ in range(H)]


def plot(g, x, y, c):
    if 0 <= x < W and 0 <= y < H:
        g[y][x] = c


def fill(g, x0, y0, x1, y1, c):
    for y in range(max(0, y0), min(H, y1 + 1)):
        for x in range(max(0, x0), min(W, x1 + 1)):
            plot(g, x, y, c)


def hline(g, x0, x1, y, c):
    for x in range(x0, x1 + 1):
        plot(g, x, y, c)


def vline(g, x, y0, y1, c):
    for y in range(y0, y1 + 1):
        plot(g, x, y, c)


def rows(g):
    return ["".join(r) for r in g]


def pose_from_name(name):
    leg = arm = atk = 0
    hurt = name == "hurt"
    if name.startswith("idle"):
        leg = int(name[-1]) % 2
    elif name.startswith("walk"):
        i = int(name[-1])
        leg = 1 if i % 2 == 0 else -1
        arm = i % 2
    elif name.startswith("atk"):
        i = int(name[-1])
        arm = i // 2
        atk = i
    return leg, arm, atk, hurt


def socket_coords(leg, arm, atk, hurt):
    """Per-frame bone socket positions in 64x64 canvas space (facing right)."""
    bob = 1 if leg else 0
    hand_x = 48 + arm + atk * 4
    hand_y = 36 - atk * 3 + bob
    head_x = 36
    head_y = 10 + bob
    if hurt:
        head_y += 1
        hand_x -= 2
    return {"head": [head_x, head_y], "hand": [hand_x, hand_y]}


# ── Body part drawers (fixed canvas layout) ──────────────────────────

def draw_tail(g):
    """Human mage — no tail."""
    return


def draw_legs(g, leg):
    ly, ry = 53 + (leg > 0), 53 + (leg < 0)
    # Tall mage boots
    fill(g, 26, ly, 34, ly + 9, "n")
    fill(g, 36, ry, 44, ry + 9, "n")
    fill(g, 27, ly + 1, 33, ly + 7, "W")
    fill(g, 37, ry + 1, 43, ry + 7, "W")
    hline(g, 26, 34, ly, "O")
    hline(g, 26, 34, ly + 9, "O")
    hline(g, 36, 44, ry, "O")
    hline(g, 36, 44, ry + 9, "O")
    hline(g, 27, 33, ly + 2, "Y")
    hline(g, 37, 43, ry + 2, "Y")
    plot(g, 29, ly + 8, "O")
    plot(g, 41, ry + 8, "O")


def draw_torso(g):
    # Neck + collared shirt under robe
    fill(g, 33, 30, 39, 33, "K")
    fill(g, 28, 33, 44, 39, "S")
    fill(g, 29, 34, 43, 38, "s")
    hline(g, 28, 44, 33, "O")
    hline(g, 28, 44, 39, "O")
    vline(g, 28, 33, 39, "O")
    vline(g, 44, 33, 39, "O")
    # Open collar V
    plot(g, 35, 34, "O")
    plot(g, 36, 34, "O")
    plot(g, 34, 35, "s")
    plot(g, 37, 35, "s")
    plot(g, 35, 36, "K")
    plot(g, 36, 36, "K")
    # Shoulder line
    hline(g, 27, 45, 34, "O")
    hline(g, 27, 45, 35, "O")


def draw_head(g, hurt):
    """Handsome bishonen mage — sharp jaw, swept hair, confident eyes."""
    # Hair back / volume
    fill(g, 26, 10, 46, 22, "H")
    fill(g, 27, 11, 45, 21, "h")
    fill(g, 28, 12, 44, 18, "e")

    # Face (narrow, sharp chin)
    fill(g, 30, 19, 42, 30, "K")
    fill(g, 31, 20, 41, 29, "k")
    plot(g, 35, 30, "K")
    plot(g, 36, 30, "K")
    hline(g, 30, 42, 19, "O")
    vline(g, 30, 19, 30, "O")
    vline(g, 42, 19, 30, "O")

    # Swept fringe / stylish hair
    fill(g, 28, 10, 38, 16, "H")
    fill(g, 29, 11, 37, 15, "h")
    plot(g, 30, 10, "i")
    plot(g, 32, 9, "i")
    plot(g, 34, 8, "i")
    plot(g, 36, 9, "i")
    fill(g, 40, 12, 46, 22, "H")
    fill(g, 41, 13, 45, 20, "h")
    plot(g, 44, 14, "i")
    plot(g, 45, 16, "i")
    hline(g, 28, 32, 17, "O")

    if hurt:
        plot(g, 32, 24, "X")
        plot(g, 33, 24, "e")
        plot(g, 34, 24, "X")
        plot(g, 38, 24, "X")
        plot(g, 39, 24, "e")
        plot(g, 40, 24, "X")
        plot(g, 33, 21, "X")
        plot(g, 39, 21, "X")
    else:
        # Sharp handsome eyes
        hline(g, 31, 35, 22, "O")
        hline(g, 37, 41, 22, "O")
        fill(g, 31, 23, 35, 26, "E")
        fill(g, 37, 23, 41, 26, "E")
        fill(g, 32, 24, 34, 25, "B")
        fill(g, 38, 24, 40, 25, "B")
        plot(g, 33, 24, "b")
        plot(g, 39, 24, "b")
        plot(g, 34, 23, "E")
        plot(g, 40, 23, "E")
        hline(g, 31, 35, 23, "O")
        hline(g, 31, 35, 26, "O")
        hline(g, 37, 41, 23, "O")
        hline(g, 37, 41, 26, "O")

    # Nose + confident mouth
    plot(g, 35, 27, "O")
    plot(g, 36, 27, "O")
    hline(g, 34, 37, 28, "O")
    plot(g, 37, 28, "O")

    # Neck
    fill(g, 33, 30, 39, 32, "K")
    vline(g, 33, 30, 32, "O")
    vline(g, 39, 30, 32, "O")


def draw_arm_back(g, arm, atk):
    ax = 39 + arm
    ay = 34 - atk
    fill(g, ax, ay, ax + 3, ay + 9, "S")
    fill(g, ax + 1, ay + 1, ax + 2, ay + 8, "s")
    plot(g, ax, ay, "O")
    plot(g, ax + 3, ay + 9, "O")
    # Robe sleeve cuff
    fill(g, ax, ay + 6, ax + 3, ay + 9, "]")


def draw_arm_front(g, arm, atk):
    ax = 44 + arm + atk
    ay = 32 - atk * 2
    fill(g, ax, ay, ax + 4, ay + 11, "K")
    fill(g, ax + 1, ay + 1, ax + 3, ay + 9, "k")
    vline(g, ax, ay, ay + 11, "O")
    vline(g, ax + 4, ay, ay + 11, "O")
    hline(g, ax, ax + 4, ay, "O")
    fill(g, ax, ay + 7, ax + 4, ay + 11, "]")
    hline(g, ax, ax + 4, ay + 7, "O")


def draw_robe(g, leg, colors):
    dark, mid, light, trim = colors
    ly = 53 + (leg > 0)
    ry = 53 + (leg < 0)
    fill(g, 22, 34, 48, 53, mid)
    fill(g, 24, 36, 46, 51, dark)
    fill(g, 26, 38, 44, 49, light)
    # High collar
    fill(g, 27, 33, 43, 36, dark)
    hline(g, 27, 43, 33, trim)
    hline(g, 25, 45, 35, trim)
    hline(g, 25, 45, 36, trim)
    plot(g, 34, 40, "Y")
    plot(g, 35, 41, "Y")
    if leg > 0:
        fill(g, 26, 53, 34, 54, mid)
    if leg < 0:
        fill(g, 36, 53, 44, 54, mid)


def draw_back(g, cape):
    if not cape:
        return
    fill(g, 16, 33, 26, 52, "C")
    fill(g, 17, 35, 25, 50, "x")
    fill(g, 18, 37, 24, 48, "N")
    # Cape flutter tip
    plot(g, 16, 50, "x")
    plot(g, 15, 51, "C")
    plot(g, 17, 52, "x")


# ── Socket item drawers (standalone — only the item pixels) ─────────

def draw_hat_item(g, hurt):
    """Wizard hat — sits on swept hair."""
    fill(g, 24, 8, 48, 19, "-")
    fill(g, 26, 6, 46, 12, "+")
    fill(g, 28, 4, 44, 10, "+")
    fill(g, 30, 2, 42, 8, "+")
    fill(g, 32, 10, 40, 12, "=")
    hline(g, 24, 48, 19, "O")
    hline(g, 24, 48, 8, "O")
    plot(g, 33, 3, "Y")
    plot(g, 34, 2, "Y")
    plot(g, 35, 3, "Y")
    plot(g, 39, 7, "Y")
    plot(g, 40, 6, "Y")
    if hurt:
        plot(g, 34, 1, "X")
        plot(g, 36, 0, "X")


def draw_weapon_item(g, arm, atk):
    """Staff as standalone item; grip stays near WEAPON_ORIGIN."""
    gx, gy = WEAPON_ORIGIN
    sx = gx + 35 + arm + atk * 4
    sy = gy - 30 - atk * 4
    for y in range(max(0, sy), min(H, gy + 2)):
        plot(g, sx, y, "|")
        plot(g, sx + 1, y, "/")
    ox, oy = sx + 3 + atk * 2, max(2, sy - 4 - atk)
    fill(g, ox, oy, ox + 6, oy + 6, "@")
    fill(g, ox + 1, oy + 1, ox + 5, oy + 5, ";")
    plot(g, ox, oy, "O")
    plot(g, ox + 6, oy, "O")
    plot(g, ox, oy + 6, "O")
    plot(g, ox + 6, oy + 6, "O")
    if atk >= 2:
        for i in range(7):
            plot(g, ox + 7 + i, oy + 2, ";")
            plot(g, ox + 7 + i, oy + 3, "@")


def main():
    part_frames = {
        "tail": {"default": {}},
        "legs": {"default": {}},
        "torso": {"default": {}},
        "head": {"default": {}},
        "arm_back": {"default": {}},
        "arm_front": {"default": {}},
        "robe": {"blue": {}, "red": {}},
        "back": {"none": {}, "cape": {}},
    }

    for name in ANIM_NAMES:
        leg, arm, atk, hurt = pose_from_name(name)
        g = blank(); draw_tail(g); part_frames["tail"]["default"][name] = rows(g)
        g = blank(); draw_legs(g, leg); part_frames["legs"]["default"][name] = rows(g)
        g = blank(); draw_torso(g); part_frames["torso"]["default"][name] = rows(g)
        g = blank(); draw_head(g, hurt); part_frames["head"]["default"][name] = rows(g)
        g = blank(); draw_arm_back(g, arm, atk); part_frames["arm_back"]["default"][name] = rows(g)
        g = blank(); draw_arm_front(g, arm, atk); part_frames["arm_front"]["default"][name] = rows(g)
        g = blank(); draw_robe(g, leg, ("]", "[", "L", "{")); part_frames["robe"]["blue"][name] = rows(g)
        g = blank(); draw_robe(g, leg, ("p", "P", "q", "Y")); part_frames["robe"]["red"][name] = rows(g)
        g = blank(); draw_back(g, False); part_frames["back"]["none"][name] = rows(g)
        g = blank(); draw_back(g, True); part_frames["back"]["cape"][name] = rows(g)

    socket_items = {"hat": {}, "weapon": {}}
    for name in ANIM_NAMES:
        leg, arm, atk, hurt = pose_from_name(name)
        g = blank(); draw_hat_item(g, hurt)
        socket_items["hat"].setdefault("wizard", {})[name] = {"rows": rows(g), "origin": list(HAT_ORIGIN)}
        g = blank(); draw_weapon_item(g, arm, atk)
        socket_items["weapon"].setdefault("crystal_staff", {})[name] = {"rows": rows(g), "origin": list(WEAPON_ORIGIN)}

    sockets = {name: socket_coords(*pose_from_name(name)) for name in ANIM_NAMES}

    catalog = {
        "back": {"none": {"label": "なし", "icon": "—"}, "cape": {"label": "マント", "icon": "🧣"}},
        "robe": {"blue": {"label": "青ローブ", "icon": "🟦"}, "red": {"label": "赤ローブ", "icon": "🟥"}},
        "hat": {"wizard": {"label": "魔導帽", "icon": "🎩"}},
        "weapon": {"crystal_staff": {"label": "水晶の杖", "icon": "🪄"}},
        "legs": {"default": {"label": "ブーツ", "icon": "👢"}},
        "torso": {"default": {"label": "シャツ", "icon": "👔"}},
        "head": {"default": {"label": "顔・髪", "icon": "🧙"}},
        "arm": {"default": {"label": "腕", "icon": "💪"}},
    }

    default_equip = {
        "back": "none",
        "robe": "blue",
        "legs": "default",
        "torso": "default",
        "head": "default",
        "arm": "default",
        "hat": "wizard",
        "weapon": "crystal_staff",
    }

    out = "/Users/motoyamayuuki/.gemini/antigravity/scratch/magic-programming/public/js/player-parts.js"

    with open(out, "w", encoding="utf-8") as f:
        f.write("// Skeletal 64x64 player — scripts/generate-player-parts.py\n")
        f.write("(function (global) {\n")
        f.write("  const PAL = " + json.dumps(PAL, ensure_ascii=False) + ";\n")
        f.write("  const SIZE = 64;\n")
        f.write("  const SCALE = 2.5;\n")
        f.write("  const FOOT = " + json.dumps([FOOT_X, FOOT_Y]) + ";\n")
        f.write("  const BODY_DRAW_ORDER = " + json.dumps(BODY_DRAW_ORDER) + ";\n")
        f.write("  const SOCKET_DRAW_ORDER = " + json.dumps(SOCKET_DRAW_ORDER) + ";\n")
        f.write("  const ANIM_NAMES = " + json.dumps(ANIM_NAMES) + ";\n")
        f.write("  const DEFAULT_EQUIP = " + json.dumps(default_equip, ensure_ascii=False) + ";\n")
        f.write("  const CATALOG = " + json.dumps(catalog, ensure_ascii=False) + ";\n")
        f.write("  const SOCKETS = " + json.dumps(sockets) + ";\n")

        f.write("  const PARTS = ")
        f.write(json.dumps(part_frames, ensure_ascii=False))
        f.write(";\n")

        f.write("  const SOCKET_ITEMS = ")
        f.write(json.dumps(socket_items, ensure_ascii=False))
        f.write(";\n")

        f.write("""
  function getAnimName(player, frame) {
    if (player.animState === 'attack') {
      const t = Math.max(0, player.animTimer || 0);
      const progress = Math.max(0, 18 - t);
      return 'atk' + Math.min(3, Math.floor(progress / 4.5));
    }
    if (player.invincibleTimer > 40) return 'hurt';
    if (player.isMoving) return 'walk' + (Math.floor(frame / 4) % 4);
    return 'idle' + (Math.floor(frame / 16) % 2);
  }

  function resolvePartId(slot, equipment) {
    const equip = equipment || DEFAULT_EQUIP;
    if (slot === 'arm_back' || slot === 'arm_front') return equip.arm || DEFAULT_EQUIP.arm || 'default';
    return equip[slot] || DEFAULT_EQUIP[slot] || 'default';
  }

  function getBodyFrame(slot, partId, animName) {
    const data = PARTS[slot];
    if (!data) return null;
    const variant = data[partId] || data[Object.keys(data)[0]];
    return variant ? (variant[animName] || variant.idle0) : null;
  }

  function getSocketItem(slot, itemId, animName) {
    const data = SOCKET_ITEMS[slot];
    if (!data) return null;
    const variant = data[itemId] || data[Object.keys(data)[0]];
    if (!variant) return null;
    return variant[animName] || variant.idle0;
  }

  function getBodyLayers(equipment, animName) {
    return BODY_DRAW_ORDER.map((slot) => ({
      slot,
      partId: resolvePartId(slot, equipment),
      rows: getBodyFrame(slot, resolvePartId(slot, equipment), animName),
    })).filter((l) => l.rows);
  }

  function getSocketLayers(equipment, animName) {
    const equip = equipment || DEFAULT_EQUIP;
    const sk = SOCKETS[animName] || SOCKETS.idle0;
    return SOCKET_DRAW_ORDER.map((slot) => {
      const itemId = equip[slot] || DEFAULT_EQUIP[slot];
      const item = getSocketItem(slot, itemId, animName);
      if (!item || !item.rows) return null;
      return { slot, itemId, rows: item.rows, origin: item.origin, socket: sk[slot === 'hat' ? 'head' : 'hand'] };
    }).filter(Boolean);
  }

  function listSlotOptions(slot) {
    const pool = PARTS[slot] || SOCKET_ITEMS[slot] || {};
    return Object.keys(pool).map((id) => ({
      id,
      ...(CATALOG[slot] && CATALOG[slot][id] ? CATALOG[slot][id] : { label: id, icon: '?' }),
    }));
  }

  global.PlayerParts = {
    PAL, SIZE, SCALE, FOOT,
    BODY_DRAW_ORDER, SOCKET_DRAW_ORDER,
    ANIM_NAMES, DEFAULT_EQUIP, CATALOG,
    SOCKETS, PARTS, SOCKET_ITEMS,
    getAnimName, getBodyFrame, getSocketItem,
    getBodyLayers, getSocketLayers, listSlotOptions,
  };
})(window);
""")

    print("wrote", out)


if __name__ == "__main__":
    main()
