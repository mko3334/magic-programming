/**
 * 不思議な絵本のタイル — tilesheet (9×4) + 正方形トリミング
 */
(function (global) {
  const BASE = '/assets/picturebook/';
  const SHEET = BASE + 'tilesheet.png';
  const CROP_URL = '/data/picturebook-crop.json';
  const CROP_STORAGE_KEY = 'pop-magic-picturebook-crop-v1';
  const COLS = 9;
  const ROWS = 4;

  const CATALOG = [
    { id: 'pb_grass',       col: 0, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    { id: 'pb_grass2',      col: 1, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    { id: 'pb_dirt',        col: 2, row: 0, kind: 'terrain', label: '土地面',     solid: false, water: false },
    { id: 'pb_path',        col: 3, row: 0, kind: 'terrain', label: '道',         solid: false, water: false },
    { id: 'pb_water',       col: 4, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_water2',      col: 5, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_water3',      col: 6, row: 0, kind: 'terrain', label: '水面',       solid: false, water: true },
    { id: 'pb_river',       col: 7, row: 0, kind: 'terrain', label: '川',         solid: false, water: true },
    { id: 'pb_grass_flower',col: 8, row: 0, kind: 'terrain', label: '草地',       solid: false, water: false },
    { id: 'pb_thorn',       col: 0, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn2',      col: 1, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn3',      col: 2, row: 1, kind: 'prop',    label: '茨',         solid: true,  water: false, burn: true },
    { id: 'pb_thorn_river', col: 3, row: 1, kind: 'terrain', label: '茨の川岸',   solid: false, water: false },
    { id: 'pb_riverbank',   col: 4, row: 1, kind: 'terrain', label: '川岸',       solid: false, water: false },
    { id: 'pb_paper',       col: 5, row: 1, kind: 'terrain', label: '紙のフチ',   solid: false, water: false },
    { id: 'pb_grass_bundle',col: 6, row: 1, kind: 'prop',    label: '草の束',     solid: false, water: false, burn: true },
    { id: 'pb_flower',      col: 7, row: 1, kind: 'prop',    label: 'お花',       solid: false, water: false, burn: true },
    { id: 'pb_pebble',      col: 8, row: 1, kind: 'prop',    label: '小石',       solid: false, water: false },
    { id: 'pb_brick',       col: 0, row: 2, kind: 'prop',    label: 'レンガ壁',   solid: true,  water: false },
    { id: 'pb_brick_corner',col: 1, row: 2, kind: 'prop',    label: 'レンガ・角', solid: true,  water: false },
    { id: 'pb_moss_brick',  col: 2, row: 2, kind: 'prop',    label: '苔レンガ',   solid: true,  water: false },
    { id: 'pb_stone',       col: 3, row: 2, kind: 'prop',    label: '石壁',       solid: true,  water: false },
    { id: 'pb_stone_corner',col: 4, row: 2, kind: 'prop',    label: '石壁・角',   solid: true,  water: false },
    { id: 'pb_stone_corner2',col:5, row: 2, kind: 'prop',    label: '石壁・角',   solid: true,  water: false },
    { id: 'pb_moss_stone',  col: 6, row: 2, kind: 'prop',    label: '苔石壁',     solid: true,  water: false },
    { id: 'pb_fence',       col: 7, row: 2, kind: 'prop',    label: '木の柵',     solid: true,  water: false, burn: true },
    { id: 'pb_plank',       col: 8, row: 2, kind: 'prop',    label: '木の板壁',   solid: true,  water: false, burn: true },
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

  const EMPTY_CROP = { left: 0, top: 0, right: 0, bottom: 0 };

  let sheet = null;
  let cellW = 0;
  let cellH = 0;
  let sheetReady = false;
  let cropsReady = false;
  let defaultCrops = {};
  let cropOverrides = {};

  function isPbType(type) {
    return typeof type === 'string' && type.startsWith('pb_');
  }

  function isReady() {
    return sheetReady && cropsReady;
  }

  function clampCrop(crop) {
    const left = Math.max(0, Math.min(0.45, Number(crop.left) || 0));
    const top = Math.max(0, Math.min(0.45, Number(crop.top) || 0));
    const right = Math.max(0, Math.min(0.45, Number(crop.right) || 0));
    const bottom = Math.max(0, Math.min(0.45, Number(crop.bottom) || 0));
    if (left + right >= 0.92 || top + bottom >= 0.92) {
      return { ...EMPTY_CROP };
    }
    return { left, top, right, bottom };
  }

  function loadCropOverridesFromStorage() {
    try {
      const raw = localStorage.getItem(CROP_STORAGE_KEY);
      if (!raw) {
        cropOverrides = {};
        return;
      }
      const data = JSON.parse(raw);
      cropOverrides = {};
      Object.entries(data || {}).forEach(([id, crop]) => {
        if (byId[id]) cropOverrides[id] = clampCrop(crop);
      });
    } catch (_) {
      cropOverrides = {};
    }
  }

  function saveCropOverrides() {
    try {
      localStorage.setItem(CROP_STORAGE_KEY, JSON.stringify(cropOverrides));
    } catch (_) { /* ignore */ }
    global.dispatchEvent(new Event('picturebook:crops-updated'));
  }

  async function loadDefaultCrops() {
    try {
      const res = await fetch(CROP_URL);
      if (!res.ok) throw new Error('crop fetch failed');
      const data = await res.json();
      defaultCrops = data.tiles || {};
    } catch (_) {
      defaultCrops = {};
      CATALOG.forEach((t) => { defaultCrops[t.id] = { ...EMPTY_CROP }; });
    }
    loadCropOverridesFromStorage();
    cropsReady = true;
  }

  function getCrop(id) {
    const base = defaultCrops[id] || EMPTY_CROP;
    const over = cropOverrides[id];
    return clampCrop(over ? { ...base, ...over } : { ...base });
  }

  function getAllCrops() {
    const out = {};
    CATALOG.forEach((t) => { out[t.id] = getCrop(t.id); });
    return out;
  }

  function setCrop(id, crop) {
    if (!byId[id]) return;
    cropOverrides[id] = clampCrop(crop);
    saveCropOverrides();
  }

  function resetCrop(id) {
    delete cropOverrides[id];
    saveCropOverrides();
  }

  function resetAllCrops() {
    cropOverrides = {};
    saveCropOverrides();
  }

  function squareSourceRect(entry, crop) {
    const x0 = entry.col * cellW;
    const y0 = entry.row * cellH;
    const l = crop.left * cellW;
    const t = crop.top * cellH;
    const r = crop.right * cellW;
    const b = crop.bottom * cellH;
    const innerW = cellW - l - r;
    const innerH = cellH - t - b;
    if (innerW <= 2 || innerH <= 2) {
      const side = Math.min(cellW, cellH);
      const ox = (cellW - side) / 2;
      const oy = (cellH - side) / 2;
      return { x: x0 + ox, y: y0 + oy, w: side, h: side };
    }
    const side = Math.min(innerW, innerH);
    const cx = l + innerW / 2;
    const cy = t + innerH / 2;
    return {
      x: x0 + cx - side / 2,
      y: y0 + cy - side / 2,
      w: side,
      h: side,
    };
  }

  function specOf(type) {
    const entry = byId[type];
    if (!entry || !isReady()) return null;
    const crop = getCrop(type);
    const rect = squareSourceRect(entry, crop);
    return {
      ...rect,
      anchor: entry.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      scale: 1,
      entry,
    };
  }

  function onSheetLoad() {
    if (!sheet || !sheet.naturalWidth) return;
    cellW = Math.floor(sheet.naturalWidth / COLS);
    cellH = Math.floor(sheet.naturalHeight / ROWS);
    sheetReady = true;
    global.dispatchEvent(new Event('picturebook:sheet-ready'));
  }

  sheet = new Image();
  sheet.onload = onSheetLoad;
  sheet.onerror = () => { sheetReady = false; };
  sheet.src = SHEET;
  loadDefaultCrops();

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
    const scale = tileSize / spec.w;
    return drawAnchored(ctx, spec, cx, cy, scale);
  }

  function drawThumb(ctx, type, size) {
    const spec = specOf(type);
    if (!spec) return false;
    const scale = size / spec.w;
    const dw = spec.w * scale;
    const dh = spec.h * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;
    return drawRect(ctx, spec, dx, dy, dw, dh);
  }

    /** 調整モード用：セル枠＋正方形トリム領域をプレビュー */
  function drawAdjustPreview(ctx, type, canvasW, canvasH) {
    const entry = byId[type];
    if (!entry || !sheetReady) return false;
    const crop = getCrop(type);
    const rect = squareSourceRect(entry, crop);
    const x0 = entry.col * cellW;
    const y0 = entry.row * cellH;

    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const pad = 10;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const cellScale = Math.min(availW / cellW, availH / cellH);
    const drawCellW = cellW * cellScale;
    const drawCellH = cellH * cellScale;
    const ox = (canvasW - drawCellW) / 2;
    const oy = (canvasH - drawCellH) / 2;

    ctx.drawImage(sheet, x0, y0, cellW, cellH, ox, oy, drawCellW, drawCellH);

    const innerL = crop.left * drawCellW;
    const innerT = crop.top * drawCellH;
    const innerW = drawCellW - (crop.left + crop.right) * drawCellW;
    const innerH = drawCellH - (crop.top + crop.bottom) * drawCellH;
    const side = Math.min(innerW, innerH);
    const cx = ox + innerL + innerW / 2;
    const cy = oy + innerT + innerH / 2;
    const sqX = cx - side / 2;
    const sqY = cy - side / 2;

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(ox, oy, drawCellW, drawCellH);
    ctx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, sqX, sqY, side, side);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ox, oy, drawCellW, drawCellH);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sqX, sqY, side, side);
    return true;
  }

  global.PictureBookAssets = {
    CATALOG,
    TERRAIN_IDS,
    PROP_IDS,
    SOLID_IDS,
    WATER_IDS,
    BURN_IDS,
    COLS,
    ROWS,
    isPbType,
    isReady,
    getCrop,
    getAllCrops,
    setCrop,
    resetCrop,
    resetAllCrops,
    drawTerrainTile,
    drawProp,
    drawThumb,
    drawAdjustPreview,
    getDefaultLabel: (id) => byId[id]?.label || id,
    getCellSize: () => ({ cellW, cellH }),
  };
})(window);
