/**
 * 不思議な絵本のタイル — tilesheet (9×4)
 */
(function (global) {
  const BASE = '/assets/picturebook/';
  const SHEET = BASE + 'tilesheet.png';
  const COLS = 9;
  const ROWS = 4;

  const CATALOG = [
    // row 0 — 地形
    { id: 'pb_grass',       col: 0, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    { id: 'pb_grass2',      col: 1, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    { id: 'pb_dirt',        col: 2, row: 0, kind: 'terrain', label: '土地面',     solid: false, water: false },
    { id: 'pb_path',        col: 3, row: 0, kind: 'terrain', label: '道',         solid: false, water: false },
    { id: 'pb_water',       col: 4, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_water2',      col: 5, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_water3',      col: 6, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_river',       col: 7, row: 0, kind: 'terrain', label: '川',         solid: false, water: true },
    { id: 'pb_grass_flower',col: 8, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    // row 1
    { id: 'pb_thorn',       col: 0, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn2',      col: 1, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn3',      col: 2, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn_river', col: 3, row: 1, kind: 'terrain', label: '茨の川岸',   solid: false, water: false },
    { id: 'pb_riverbank',   col: 4, row: 1, kind: 'terrain', label: '川岸',       solid: false, water: false },
    { id: 'pb_paper',       col: 5, row: 1, kind: 'terrain', label: '紙のフチ',   solid: false, water: false },
    { id: 'pb_grass_bundle',col: 6, row: 1, kind: 'prop',    label: '草の束',     solid: false, water: false, burn: true },
    { id: 'pb_flower',      col: 7, row: 1, kind: 'prop',    label: 'お花',       solid: false, water: false, burn: true },
    { id: 'pb_pebble',      col: 8, row: 1, kind: 'prop',    label: '小石',       solid: false, water: false },
    // row 2
    { id: 'pb_brick',       col: 0, row: 2, kind: 'prop',    label: 'レンガ壁',   solid: true,  water: false },
    { id: 'pb_brick_corner',col: 1, row: 2, kind: 'prop',    label: 'レンガ・角', solid: true,  water: false },
    { id: 'pb_moss_brick',  col: 2, row: 2, kind: 'prop',    label: '苔レンガ',   solid: true,  water: false },
    { id: 'pb_stone',       col: 3, row: 2, kind: 'prop',    label: '石壁',       solid: true,  water: false },
    { id: 'pb_stone_corner',col: 4, row: 2, kind: 'prop',    label: '石壁・角',   solid: true,  water: false },
    { id: 'pb_stone_corner2',col:5, row: 2, kind: 'prop',    label: '石壁・角',   solid: true,  water: false },
    { id: 'pb_moss_stone',  col: 6, row: 2, kind: 'prop',    label: '苔石壁',     solid: true,  water: false },
    { id: 'pb_fence',       col: 7, row: 2, kind: 'prop',    label: '木の柵',     solid: true,  water: false, burn: true },
    { id: 'pb_plank',       col: 8, row: 2, kind: 'prop',    label: '木の板壁',   solid: true,  water: false, burn: true },
    // row 3
    { id: 'pb_house_thatch',col: 0, row: 3, kind: 'prop',    label: '茅葺きの家', solid: true,  water: false },
    { id: 'pb_house_tile',  col: 1, row: 3, kind: 'prop',    label: '瓦屋根の家', solid: true,  water: false },
    { id: 'pb_house_wood',  col: 2, row: 3, kind: 'prop',    label: '木造の家',   solid: true,  water: false, burn: true },
    { id: 'pb_well',        col: 3, row: 3, kind: 'prop',    label: '井戸',       solid: true,  water: false },
    { id: 'pb_stairs',      col: 4, row: 3, kind: 'prop',    label: '石の階段',   solid: false, water: false },
    { id: 'pb_bridge',      col: 5, row: 3, kind: 'prop',    label: '木の橋',     solid: false, water: false, burn: true },
    { id: 'pb_bridge2',     col: 6, row: 3, kind: 'prop',    label: '木の橋',     solid: false, water: false, burn: true },
    { id: 'pb_plaster',     col: 7, row: 3, kind: 'prop',    label: '漆喰壁',     solid: true,  water: false },
    { id: 'pb_plaster_win', col: 8, row: 3, kind: 'prop',    label: '漆喰・窓',   solid: true,  water: false },
  ];

  const byId = Object.fromEntries(CATALOG.map((t) => [t.id, t]));
  const TERRAIN_IDS = new Set(CATALOG.filter((t) => t.kind === 'terrain').map((t) => t.id));
  const PROP_IDS = new Set(CATALOG.filter((t) => t.kind === 'prop').map((t) => t.id));
  const SOLID_IDS = new Set(CATALOG.filter((t) => t.solid).map((t) => t.id));
  const WATER_IDS = new Set(CATALOG.filter((t) => t.water).map((t) => t.id));
  const BURN_IDS = new Set(CATALOG.filter((t) => t.burn).map((t) => t.id));

  let sheet = null;
  let cellW = 0;
  let cellH = 0;
  let ready = false;

  function isPbType(type) {
    return typeof type === 'string' && type.startsWith('pb_');
  }

  function onLoad() {
    if (!sheet || !sheet.naturalWidth) return;
    cellW = Math.floor(sheet.naturalWidth / COLS);
    cellH = Math.floor(sheet.naturalHeight / ROWS);
    ready = true;
  }

  sheet = new Image();
  sheet.onload = onLoad;
  sheet.onerror = () => { ready = false; };
  sheet.src = SHEET;

  function specOf(type) {
    const entry = byId[type];
    if (!entry || !ready) return null;
    return {
      x: entry.col * cellW,
      y: entry.row * cellH,
      w: cellW,
      h: cellH,
      anchor: entry.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      scale: 1,
    };
  }

  function drawRect(ctx, spec, dx, dy, dw, dh) {
    if (!sheet || !sheet.complete || !sheet.naturalWidth) return false;
    ctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, dx, dy, dw, dh);
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

  function drawTerrainTile(ctx, type, tx, ty, tileSize) {
    const spec = specOf(type);
    if (!spec) return false;
    return drawRect(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawProp(ctx, type, cx, cy, tileSize) {
    const spec = specOf(type);
    if (!spec) return false;
    const scale = tileSize / Math.max(spec.w, spec.h);
    return drawAnchored(ctx, spec, cx, cy, scale);
  }

  function drawThumb(ctx, type, size) {
    const spec = specOf(type);
    if (!spec) return false;
    const scale = size / Math.max(spec.w, spec.h);
    const dw = spec.w * scale;
    const dh = spec.h * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    return drawRect(ctx, spec, dx, dy, dw, dh);
  }

  global.PictureBookAssets = {
    CATALOG,
    TERRAIN_IDS,
    PROP_IDS,
    SOLID_IDS,
    WATER_IDS,
    BURN_IDS,
    isPbType,
    isReady: () => ready,
    drawTerrainTile,
    drawProp,
    drawThumb,
    getDefaultLabel: (id) => byId[id]?.label || id,
  };
})(window);
