/**
 * Sprout Lands tile & prop sprites (Cup Nooble)
 * Assets copied to /assets/sprout/
 */
(function (global) {
  const BASE = '/assets/sprout/';
  const TILE = 16;

  const SHEETS = {
    grass: BASE + 'grass.png',
    water: BASE + 'water.png',
    dirt: BASE + 'tilled-dirt.png',
    biom: BASE + 'grass-biom.png',
    trees: BASE + 'trees-bushes.png',
    chest: BASE + 'chest.png',
  };

  const images = {};
  let pending = Object.keys(SHEETS).length;
  let ready = false;

  function onLoad() {
    pending -= 1;
    if (pending <= 0) ready = true;
  }

  Object.entries(SHEETS).forEach(([key, url]) => {
    const img = new Image();
    img.onload = onLoad;
    img.onerror = onLoad;
    img.src = url;
    images[key] = img;
  });

  const TERRAIN = {
    grass: [
      { sheet: 'grass', x: 0, y: 64, w: TILE, h: TILE },
      { sheet: 'grass', x: 16, y: 64, w: TILE, h: TILE },
      { sheet: 'grass', x: 32, y: 64, w: TILE, h: TILE },
    ],
    path: { sheet: 'dirt', x: 32, y: 32, w: TILE, h: TILE },
    water: { sheet: 'water', frames: 4, x: 0, y: 0, w: TILE, h: TILE },
  };

  const PROPS = {
    tree: { sheet: 'trees', x: 97, y: 0, w: 44, h: 48, anchor: [0.5, 0.92], scale: 0.88 },
    bush: { sheet: 'trees', x: 68, y: 16, w: 24, h: 31, anchor: [0.5, 0.95], scale: 0.78 },
    rock: { sheet: 'biom', x: 82, y: 2, w: 13, h: 13, anchor: [0.5, 1], scale: 1.05 },
    log: { sheet: 'biom', x: 0, y: 48, w: 32, h: 16, anchor: [0.5, 0.85], scale: 0.82 },
    stump: { sheet: 'trees', x: 1, y: 48, w: 15, h: 16, anchor: [0.5, 1], scale: 0.95 },
    mushroom: { sheet: 'biom', x: 128, y: 18, w: 16, h: 12, anchor: [0.5, 1], scale: 1.0 },
    grassTuft: { sheet: 'biom', x: 80, y: 67, w: 16, h: 12, anchor: [0.5, 1], scale: 0.75 },
  };

  const CHEST = { sheet: 'chest', x: 16, y: 18, w: 16, h: 14, anchor: [0.5, 0.9], scale: 2.2 };

  function imgOf(sheetKey) {
    return images[sheetKey] || null;
  }

  function drawRect(ctx, spec, dx, dy, dw, dh) {
    const img = imgOf(spec.sheet);
    if (!img || !img.complete || !img.naturalWidth) return false;
    ctx.drawImage(img, spec.x, spec.y, spec.w, spec.h, dx, dy, dw + 1, dh + 1);
    return true;
  }

  function drawAnchored(ctx, spec, cx, cy, extraScale) {
    const scale = (spec.scale || 1) * (extraScale || 1);
    const dw = spec.w * scale;
    const dh = spec.h * scale;
    const ax = spec.anchor ? spec.anchor[0] : 0.5;
    const ay = spec.anchor ? spec.anchor[1] : 1;
    const dx = Math.round(cx - dw * ax);
    const dy = Math.round(cy - dh * ay);
    return drawRect(ctx, spec, dx, dy, dw, dh);
  }

  function drawTerrainTile(ctx, type, tx, ty, tileSize, gx, gy, frame) {
    const scale = tileSize / TILE;
    let spec;
    if (type === 'path') {
      spec = TERRAIN.path;
    } else if (type === 'water') {
      const f = Math.floor((frame || 0) / 8) % TERRAIN.water.frames;
      spec = { ...TERRAIN.water, x: f * TILE };
    } else {
      const variants = TERRAIN.grass;
      spec = variants[Math.abs(gx + gy) % variants.length];
    }
    return drawRect(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawGrassDeco(ctx, tx, ty, tileSize, gx, gy) {
    const s = Math.abs(((gx * 73856093) ^ (gy * 19349663)) % 997);
    if (s % 19 !== 0) return;
    const cx = tx + tileSize / 2;
    const cy = ty + tileSize - 2;
    drawAnchored(ctx, PROPS.grassTuft, cx, cy, 0.9);
  }

  function drawProp(ctx, type, cx, cy, tileSize, options) {
    options = options || {};
    const spec = PROPS[type];
    if (!spec) return false;
    const merged = { ...spec, scale: (spec.scale || 1) * (tileSize / TILE) };
    const ok = drawAnchored(ctx, merged, cx, cy, 1);
    return ok;
  }

  function drawChestSprite(ctx, cx, cy, frame) {
    const bounce = Math.round(Math.sin((frame || 0) * 0.1) * 1);
    const merged = { ...CHEST, scale: CHEST.scale * 2 };
    return drawAnchored(ctx, merged, cx, cy + bounce, 1);
  }

  global.SproutAssets = {
    TILE,
    TERRAIN,
    PROPS,
    CHEST,
    isReady: () => ready,
    drawTerrainTile,
    drawGrassDeco,
    drawProp,
    drawChestSprite,
  };
})(window);
