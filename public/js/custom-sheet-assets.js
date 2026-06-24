/**
 * ユーザー定義グリッドシート（等間隔スクエア切り抜き）+ マスセット
 * 複数シートグループ対応（追加取込・名前付きグループ）
 */
(function (global) {
  const STORAGE_KEY = 'pop-magic-custom-sheet-v2';
  const LEGACY_STORAGE_KEY = 'pop-magic-custom-sheet-v1';
  const SHEET_DATA_KEY = 'pop-magic-custom-sheet-image-v1';
  const LEGACY_SHEET_BLOB_KEY = 'sheet-image';
  const SHEET_DB_NAME = 'pop-magic-sheet-db';
  const SHEET_DB_STORE = 'blobs';
  const GROUP_PREFIX = 'grp_';
  const ID_PREFIX = 'gs_';
  const SET_PREFIX = 'gset_';
  const OBJECT_PREFIX = 'gobj_';
  const DISPLAY_TILE_SIZE = 32;

  const EMPTY_GRID = {
    offsetX: 0,
    offsetY: 0,
    cellSize: 64,
    gap: 8,
    cols: 4,
    rows: 4,
    keyBlack: true,
  };

  const EMPTY_CROP = { left: 0, top: 0, right: 0, bottom: 0 };

  let groups = [];
  let activeGroupId = null;
  let nextGroupId = 1;
  let globalNextSetId = 1;
  let ready = false;

  const sheetImages = new Map();
  const sheetObjectUrls = new Map();
  const cellCache = new Map();
  const displayCache = new Map();

  const byId = {};
  const CATALOG = [];
  const TERRAIN_IDS = new Set();
  const PROP_IDS = new Set();
  const SOLID_IDS = new Set();

  function blobKeyForGroup(groupId, legacyBlob) {
    if (legacyBlob) return LEGACY_SHEET_BLOB_KEY;
    return `sheet-image-${groupId}`;
  }

  function revokeGroupObjectUrl(groupId) {
    const url = sheetObjectUrls.get(groupId);
    if (url) {
      URL.revokeObjectURL(url);
      sheetObjectUrls.delete(groupId);
    }
  }

  function openSheetDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(SHEET_DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(SHEET_DB_STORE)) {
          req.result.createObjectStore(SHEET_DB_STORE);
        }
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  }

  function idbGetBlob(key) {
    return openSheetDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(SHEET_DB_STORE, 'readonly');
      const req = tx.objectStore(SHEET_DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    }));
  }

  function idbSetBlob(key, blob) {
    return openSheetDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(SHEET_DB_STORE, 'readwrite');
      tx.objectStore(SHEET_DB_STORE).put(blob, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  function idbDeleteBlob(key) {
    return openSheetDb().then((db) => new Promise((resolve, reject) => {
      const tx = db.transaction(SHEET_DB_STORE, 'readwrite');
      tx.objectStore(SHEET_DB_STORE).delete(key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    })).catch(() => false);
  }

  function getGroup(groupId) {
    return groups.find((g) => g.id === groupId) || null;
  }

  function getActiveGroup() {
    return getGroup(activeGroupId) || groups[0] || null;
  }

  function allocGroupId() {
    while (groups.some((g) => g.id === `${GROUP_PREFIX}${nextGroupId}`)) nextGroupId += 1;
    const id = `${GROUP_PREFIX}${nextGroupId}`;
    nextGroupId += 1;
    return id;
  }

  function createEmptyGroup(name, options = {}) {
    return {
      id: options.id || allocGroupId(),
      name: (name || '取込シート').trim() || '取込シート',
      importMode: options.importMode || 'grid',
      legacyCellIds: !!options.legacyCellIds,
      legacyBlob: !!options.legacyBlob,
      grid: { ...EMPTY_GRID },
      cells: [],
      sets: [],
      object: null,
      collapsed: !!options.collapsed,
    };
  }

  function objectIdForGroup(group) {
    const num = group.id.replace(GROUP_PREFIX, '');
    return `${OBJECT_PREFIX}${num}`;
  }

  function createObjectGroup(name, options = {}) {
    const group = createEmptyGroup(name, { ...options, importMode: 'object' });
    group.grid.cols = 1;
    group.grid.rows = 1;
    group.object = {
      id: objectIdForGroup(group),
      label: group.name,
      enabled: !!options.enabled,
      kind: options.kind || 'prop',
      solid: !!options.solid,
      footprintW: Math.max(1, Math.min(4, Number(options.footprintW) || 1)),
      footprintH: Math.max(1, Math.min(4, Number(options.footprintH) || 1)),
      crop: { ...EMPTY_CROP },
    };
    return group;
  }

  function cellIdForGroup(group, col, row) {
    if (group.legacyCellIds) return `${ID_PREFIX}${col}_${row}`;
    const num = group.id.replace(GROUP_PREFIX, '');
    return `${ID_PREFIX}g${num}_${col}_${row}`;
  }

  function findCellContext(id) {
    for (const group of groups) {
      const cell = group.cells.find((c) => c.id === id);
      if (cell) return { group, cell };
    }
    return null;
  }

  function findSetContext(id) {
    for (const group of groups) {
      const set = group.sets.find((s) => s.id === id);
      if (set) return { group, set };
    }
    return null;
  }

  function findObjectContext(id) {
    for (const group of groups) {
      if (group.object?.id === id) return { group, object: group.object };
    }
    return null;
  }

  function getObject(id) {
    return findObjectContext(id)?.object || byId[id] || null;
  }

  function loadSheetImageForGroup(group, blob) {
    return new Promise((resolve, reject) => {
      revokeGroupObjectUrl(group.id);
      const url = URL.createObjectURL(blob);
      sheetObjectUrls.set(group.id, url);
      const img = new Image();
      img.onload = () => {
        sheetImages.set(group.id, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function loadSheetImageFromDataUrlForGroup(group, dataUrl) {
    return new Promise((resolve, reject) => {
      revokeGroupObjectUrl(group.id);
      const img = new Image();
      img.onload = () => {
        sheetImages.set(group.id, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  function cacheKey(groupId, x, y, w, h, keyBlack) {
    return `${groupId}|${x}|${y}|${w}|${h}|${keyBlack ? 1 : 0}`;
  }

  function invalidateCellCache() {
    cellCache.clear();
    displayCache.clear();
  }

  function crispDownscale(source, srcW, srcH, dstW, dstH) {
    let current = source;
    let cw = srcW;
    let ch = srcH;
    while (cw > dstW * 2 || ch > dstH * 2) {
      const nw = Math.max(dstW, Math.floor(cw / 2));
      const nh = Math.max(dstH, Math.floor(ch / 2));
      const tmp = document.createElement('canvas');
      tmp.width = nw;
      tmp.height = nh;
      const tctx = tmp.getContext('2d');
      global.PopArt?.setupCrisp?.(tctx);
      tctx.drawImage(current, 0, 0, cw, ch, 0, 0, nw, nh);
      current = tmp;
      cw = nw;
      ch = nh;
    }
    if (cw === dstW && ch === dstH) return current;
    const out = document.createElement('canvas');
    out.width = dstW;
    out.height = dstH;
    const octx = out.getContext('2d');
    global.PopArt?.setupCrisp?.(octx);
    octx.drawImage(current, 0, 0, cw, ch, 0, 0, dstW, dstH);
    return out;
  }

  function getSourceCellCanvas(groupId, spec) {
    const sheet = sheetImages.get(groupId);
    if (!sheet) return null;
    if (spec.keyBlack) {
      return getCachedCellCanvas(groupId, spec.x, spec.y, spec.w, spec.h, spec.keyBlack);
    }
    const tmp = document.createElement('canvas');
    tmp.width = spec.w;
    tmp.height = spec.h;
    const tctx = tmp.getContext('2d');
    global.PopArt?.setupCrisp?.(tctx);
    tctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, 0, 0, spec.w, spec.h);
    return tmp;
  }

  function displayCacheKey(groupId, spec, dstW, dstH) {
    return `${groupId}|${spec.x}|${spec.y}|${spec.w}|${spec.h}|${spec.keyBlack ? 1 : 0}|${dstW}|${dstH}`;
  }

  function getCachedDisplayCanvas(groupId, spec, dstW, dstH) {
    const tw = Math.max(1, Math.round(dstW));
    const th = Math.max(1, Math.round(dstH));
    if (spec.w === tw && spec.h === th) {
      return getSourceCellCanvas(groupId, spec);
    }
    const key = displayCacheKey(groupId, spec, tw, th);
    if (displayCache.has(key)) return displayCache.get(key);
    const src = getSourceCellCanvas(groupId, spec);
    const scaled = crispDownscale(src, spec.w, spec.h, tw, th);
    displayCache.set(key, scaled);
    return scaled;
  }

  function getCachedCellCanvas(groupId, x, y, w, h, keyBlack) {
    const key = cacheKey(groupId, x, y, w, h, keyBlack);
    if (cellCache.has(key)) return cellCache.get(key);

    const sheet = sheetImages.get(groupId);
    if (!sheet) return null;

    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tctx = tmp.getContext('2d');
    global.PopArt?.setupCrisp?.(tctx);
    tctx.drawImage(sheet, x, y, w, h, 0, 0, w, h);

    if (keyBlack) {
      const img = tctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i] < 48 && d[i + 1] < 48 && d[i + 2] < 48) d[i + 3] = 0;
      }
      tctx.putImageData(img, 0, 0);
    }

    cellCache.set(key, tmp);
    return tmp;
  }

  function prewarmCellCacheForGroup(group) {
    const sheet = sheetImages.get(group.id);
    if (!sheet || !sheet.complete) return;
    group.cells.filter((c) => c.enabled).forEach((cell) => {
      const spec = specOfCell(group, cell);
      if (!spec) return;
      getCachedDisplayCanvas(group.id, spec, DISPLAY_TILE_SIZE, DISPLAY_TILE_SIZE);
    });
  }

  function prewarmAllCellCaches() {
    invalidateCellCache();
    groups.forEach((group) => {
      if (group.importMode === 'object') prewarmObjectCacheForGroup(group);
      else prewarmCellCacheForGroup(group);
    });
  }

  function isSheetType(type) {
    return typeof type === 'string' && type.startsWith(ID_PREFIX);
  }

  function isSetType(type) {
    return typeof type === 'string' && type.startsWith(SET_PREFIX);
  }

  function isObjectType(type) {
    return typeof type === 'string' && type.startsWith(OBJECT_PREFIX);
  }

  function isCustomType(type) {
    return isSheetType(type) || isSetType(type) || isObjectType(type);
  }

  function cellRectForGroup(group, col, row) {
    const grid = group.grid;
    const x = grid.offsetX + col * (grid.cellSize + grid.gap);
    const y = grid.offsetY + row * (grid.cellSize + grid.gap);
    return { x, y, w: grid.cellSize, h: grid.cellSize };
  }

  function clampCrop(crop) {
    const left = Math.max(0, Math.min(0.45, Number(crop?.left) || 0));
    const top = Math.max(0, Math.min(0.45, Number(crop?.top) || 0));
    const right = Math.max(0, Math.min(0.45, Number(crop?.right) || 0));
    const bottom = Math.max(0, Math.min(0.45, Number(crop?.bottom) || 0));
    return { left, top, right, bottom };
  }

  function getCellCrop(cell) {
    return clampCrop(cell?.crop || EMPTY_CROP);
  }

  function squareSourceRect(group, cell, crop) {
    const base = cellRectForGroup(group, cell.col, cell.row);
    const cellW = base.w;
    const cellH = base.h;
    const c = crop || EMPTY_CROP;
    const l = c.left * cellW;
    const t = c.top * cellH;
    const r = c.right * cellW;
    const b = c.bottom * cellH;
    const innerW = cellW - l - r;
    const innerH = cellH - t - b;
    if (innerW <= 2 || innerH <= 2) {
      const side = Math.min(cellW, cellH);
      const ox = (cellW - side) / 2;
      const oy = (cellH - side) / 2;
      return { x: base.x + ox, y: base.y + oy, w: side, h: side };
    }
    const side = Math.min(innerW, innerH);
    const cx = l + innerW / 2;
    const cy = t + innerH / 2;
    return {
      x: base.x + cx - side / 2,
      y: base.y + cy - side / 2,
      w: side,
      h: side,
    };
  }

  function allocSetId() {
    while (groups.some((g) => g.sets.some((s) => s.id === `${SET_PREFIX}${globalNextSetId}`))) {
      globalNextSetId += 1;
    }
    const id = `${SET_PREFIX}${globalNextSetId}`;
    globalNextSetId += 1;
    return id;
  }

  function normalizeSetMembers(memberCells) {
    const minCol = Math.min(...memberCells.map((c) => c.col));
    const minRow = Math.min(...memberCells.map((c) => c.row));
    const maxCol = Math.max(...memberCells.map((c) => c.col));
    const maxRow = Math.max(...memberCells.map((c) => c.row));
    return {
      anchorCol: minCol,
      anchorRow: minRow,
      widthCells: maxCol - minCol + 1,
      heightCells: maxRow - minRow + 1,
      members: memberCells.map((c) => ({
        cellId: c.id,
        col: c.col,
        row: c.row,
        dx: c.col - minCol,
        dy: c.row - minRow,
      })),
    };
  }

  function rebuildCatalog() {
    CATALOG.length = 0;
    Object.keys(byId).forEach((k) => delete byId[k]);
    TERRAIN_IDS.clear();
    PROP_IDS.clear();
    SOLID_IDS.clear();

    groups.forEach((group) => {
      const cellsInEnabledSets = new Set();
      group.sets.filter((s) => s.enabled).forEach((s) => {
        s.members.forEach((m) => cellsInEnabledSets.add(m.cellId));
      });

      group.cells.filter((c) => c.enabled && !cellsInEnabledSets.has(c.id)).forEach((c) => {
        const entry = { ...c, isSet: false, groupId: group.id, groupName: group.name };
        CATALOG.push(entry);
        byId[entry.id] = entry;
        if (entry.kind === 'terrain') TERRAIN_IDS.add(entry.id);
        else PROP_IDS.add(entry.id);
        if (entry.solid) SOLID_IDS.add(entry.id);
      });

      group.sets.filter((s) => s.enabled).forEach((s) => {
        const entry = { ...s, isSet: true, groupId: group.id, groupName: group.name };
        CATALOG.push(entry);
        byId[entry.id] = entry;
        if (entry.kind === 'terrain') TERRAIN_IDS.add(entry.id);
        else PROP_IDS.add(entry.id);
        if (entry.solid) SOLID_IDS.add(entry.id);
      });

      if (group.importMode === 'object' && group.object?.enabled) {
        const entry = {
          ...group.object,
          isSet: false,
          isObject: true,
          groupId: group.id,
          groupName: group.name,
          widthCells: group.object.footprintW,
          heightCells: group.object.footprintH,
        };
        CATALOG.push(entry);
        byId[entry.id] = entry;
        if (entry.kind === 'terrain') TERRAIN_IDS.add(entry.id);
        else PROP_IDS.add(entry.id);
        if (entry.solid) SOLID_IDS.add(entry.id);
      }
    });

    ready = groups.some((g) => {
      const img = sheetImages.get(g.id);
      return img && img.complete && img.naturalWidth && groupHasAdopted(g);
    }) || CATALOG.length > 0;

    global.dispatchEvent(new Event('customsheet:updated'));
  }

  function groupHasAdopted(group) {
    if (group.importMode === 'object') return !!group.object?.enabled;
    const cellsInSets = new Set();
    group.sets.filter((s) => s.enabled).forEach((s) => s.members.forEach((m) => cellsInSets.add(m.cellId)));
    return group.cells.some((c) => c.enabled && !cellsInSets.has(c.id))
      || group.sets.some((s) => s.enabled);
  }

  function serializeGroups() {
    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      importMode: g.importMode || 'grid',
      legacyCellIds: !!g.legacyCellIds,
      legacyBlob: !!g.legacyBlob,
      grid: { ...g.grid },
      cells: g.cells.map((c) => ({ ...c })),
      sets: g.sets.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })),
      object: g.object ? { ...g.object, crop: { ...g.object.crop } } : null,
      collapsed: !!g.collapsed,
    }));
  }

  function getConfig() {
    const group = getActiveGroup();
    if (!group) {
      return { grid: { ...EMPTY_GRID }, cells: [], sets: [], nextSetId: globalNextSetId };
    }
    return {
      grid: { ...group.grid },
      cells: group.cells.map((c) => ({ ...c })),
      sets: group.sets.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })),
      nextSetId: globalNextSetId,
    };
  }

  function setConfig(config) {
    const group = getActiveGroup();
    if (!group) return;
    group.grid = { ...EMPTY_GRID, ...(config.grid || {}) };
    group.cells = (config.cells || []).map((c) => ({ ...c }));
    group.sets = (config.sets || []).map((s) => ({ ...s, members: (s.members || []).map((m) => ({ ...m })) }));
    if (config.nextSetId) globalNextSetId = config.nextSetId;
    rebuildCatalog();
  }

  function generateCellsFromGridForGroup(group) {
    const prev = Object.fromEntries(group.cells.map((c) => [`${c.col},${c.row}`, c]));
    const next = [];
    for (let row = 0; row < group.grid.rows; row++) {
      for (let col = 0; col < group.grid.cols; col++) {
        const key = `${col},${row}`;
        const old = prev[key];
        next.push({
          id: cellIdForGroup(group, col, row),
          col,
          row,
          label: old?.label || `タイル ${col + 1}-${row + 1}`,
          enabled: old?.enabled ?? false,
          kind: old?.kind || 'prop',
          solid: old?.solid ?? false,
          setId: old?.setId || null,
          crop: old?.crop ? { ...old.crop } : { ...EMPTY_CROP },
        });
      }
    }
    group.cells = next;
    pruneSetsAfterGridChange(group);
    rebuildCatalog();
  }

  function generateCellsFromGrid() {
    const group = getActiveGroup();
    if (!group) return;
    generateCellsFromGridForGroup(group);
  }

  function pruneSetsAfterGridChange(group) {
    const cellIds = new Set(group.cells.map((c) => c.id));
    group.sets = group.sets.filter((set) => {
      const validMembers = set.members.filter((m) => cellIds.has(m.cellId));
      if (validMembers.length < 2) {
        validMembers.forEach((m) => {
          const c = group.cells.find((t) => t.id === m.cellId);
          if (c) c.setId = null;
        });
        return false;
      }
      if (validMembers.length !== set.members.length) {
        const memberCells = validMembers.map((m) => group.cells.find((c) => c.id === m.cellId)).filter(Boolean);
        Object.assign(set, normalizeSetMembers(memberCells));
      }
      return true;
    });
    group.cells.forEach((c) => {
      if (c.setId && !group.sets.some((s) => s.id === c.setId)) c.setId = null;
    });
  }

  function migrateLegacyStorage() {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      const group = createEmptyGroup('取込シート', {
        id: `${GROUP_PREFIX}1`,
        legacyCellIds: true,
        legacyBlob: true,
      });
      group.grid = { ...EMPTY_GRID, ...(data.grid || {}) };
      group.cells = data.cells || [];
      group.sets = data.sets || [];
      globalNextSetId = data.nextSetId || 1;
      nextGroupId = 2;
      return group;
    } catch (_) {
      return null;
    }
  }

  function loadGroupsFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        groups = (data.groups || []).map((g) => ({
          id: g.id,
          name: g.name || '取込シート',
          importMode: g.importMode || 'grid',
          legacyCellIds: !!g.legacyCellIds,
          legacyBlob: !!g.legacyBlob,
          grid: { ...EMPTY_GRID, ...(g.grid || {}) },
          cells: g.cells || [],
          sets: g.sets || [],
          object: g.object ? { ...g.object, crop: { ...(g.object.crop || EMPTY_CROP) } } : null,
          collapsed: !!g.collapsed,
        }));
        activeGroupId = data.activeGroupId || groups[0]?.id || null;
        nextGroupId = data.nextGroupId || (groups.length ? Math.max(...groups.map((g) => Number(g.id.replace(GROUP_PREFIX, '')) || 0)) + 1 : 1);
        globalNextSetId = data.globalNextSetId || 1;
        return true;
      }
    } catch (_) {
      groups = [];
    }

    const migrated = migrateLegacyStorage();
    if (migrated) {
      groups = [migrated];
      activeGroupId = migrated.id;
      return true;
    }
    return false;
  }

  function loadGroupImage(group) {
    const key = blobKeyForGroup(group.id, group.legacyBlob);
    return idbGetBlob(key).then((blob) => {
      if (blob) {
        return loadSheetImageForGroup(group, blob).catch(() => {
          sheetImages.delete(group.id);
          return false;
        });
      }

      if (!group.legacyBlob) return false;

      const dataUrl = localStorage.getItem(SHEET_DATA_KEY);
      if (!dataUrl) return false;

      return loadSheetImageFromDataUrlForGroup(group, dataUrl).then(() => fetch(dataUrl)
        .then((r) => r.blob())
        .then((migrated) => idbSetBlob(key, migrated))
        .then(() => localStorage.removeItem(SHEET_DATA_KEY))
        .catch(() => {})
        .then(() => true)).catch(() => {
        sheetImages.delete(group.id);
        return false;
      });
    });
  }

  function loadFromStorage() {
    loadGroupsFromStorage();
    rebuildCatalog();

    if (!groups.length) {
      rebuildCatalog();
      return Promise.resolve(false);
    }

    const hadLegacy = !!localStorage.getItem(LEGACY_STORAGE_KEY);

    return Promise.all(groups.map(loadGroupImage)).then((results) => {
      prewarmAllCellCaches();
      rebuildCatalog();
      if (hadLegacy && groups.length) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            groups: serializeGroups(),
            activeGroupId,
            nextGroupId,
            globalNextSetId,
          }));
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        } catch (_) { /* ignore */ }
      }
      return results.some(Boolean);
    }).catch(() => {
      rebuildCatalog();
      return false;
    });
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        groups: serializeGroups(),
        activeGroupId,
        nextGroupId,
        globalNextSetId,
      }));
    } catch (_) { /* ignore */ }
  }

  function finalizeGroupSheetLoad(group, options = {}) {
    if (options.regenerateGrid && !group.cells.length) {
      autoFitGridFromImage(group);
    }
    if (options.regenerateGrid) {
      generateCellsFromGridForGroup(group);
    }
    prewarmCellCacheForGroup(group);
    saveToStorage();
    rebuildCatalog();
    return true;
  }

  function setSheetBlobForGroup(group, blob, options = {}) {
    if (!blob) return Promise.reject(new Error('empty blob'));
    const key = blobKeyForGroup(group.id, group.legacyBlob);
    return idbSetBlob(key, blob)
      .then(() => loadSheetImageForGroup(group, blob))
      .then(() => {
        localStorage.removeItem(SHEET_DATA_KEY);
        finalizeGroupSheetLoad(group, options);
        return group;
      });
  }

  function appendSheetFile(file, groupName) {
    if (!file) return Promise.reject(new Error('empty file'));
    const group = createEmptyGroup(groupName || `シート ${groups.length + 1}`);
    groups.push(group);
    activeGroupId = group.id;
    return setSheetBlobForGroup(group, file, { regenerateGrid: true });
  }

  function appendObjectFile(file, options = {}) {
    if (!file) return Promise.reject(new Error('empty file'));
    const name = (options.name || `オブジェクト ${groups.length + 1}`).trim();
    const group = createObjectGroup(name, options);
    groups.push(group);
    activeGroupId = group.id;
    return setSheetBlobForGroup(group, file, { regenerateGrid: false }).then(() => {
      prewarmObjectCacheForGroup(group);
      return group;
    });
  }

  function getActiveObject() {
    const group = getActiveGroup();
    return group?.importMode === 'object' ? group.object : null;
  }

  function updateObject(idOrGroupId, partial) {
    let group = idOrGroupId.startsWith(GROUP_PREFIX) ? getGroup(idOrGroupId) : findObjectContext(idOrGroupId)?.group;
    if (!group?.object) return;
    if (partial.name !== undefined) {
      group.name = String(partial.name || group.name).trim() || group.name;
    }
    if (partial.label !== undefined) group.object.label = String(partial.label || group.object.label).trim() || group.object.label;
    if (partial.enabled !== undefined) group.object.enabled = !!partial.enabled;
    if (partial.kind !== undefined) group.object.kind = partial.kind;
    if (partial.solid !== undefined) group.object.solid = !!partial.solid;
    if (partial.footprintW !== undefined) {
      group.object.footprintW = Math.max(1, Math.min(4, Number(partial.footprintW) || 1));
    }
    if (partial.footprintH !== undefined) {
      group.object.footprintH = Math.max(1, Math.min(4, Number(partial.footprintH) || 1));
    }
    if (partial.keyBlack !== undefined) group.grid.keyBlack = !!partial.keyBlack;
    if (partial.crop) group.object.crop = clampCrop(partial.crop);
    invalidateCellCache();
    prewarmObjectCacheForGroup(group);
    rebuildCatalog();
    saveToStorage();
  }

  function objectSourceRect(group, object) {
    const sheet = sheetImages.get(group.id);
    if (!sheet || !object) return null;
    const crop = clampCrop(object.crop);
    const w = sheet.naturalWidth;
    const h = sheet.naturalHeight;
    const l = crop.left * w;
    const t = crop.top * h;
    const r = crop.right * w;
    const b = crop.bottom * h;
    return {
      x: l,
      y: t,
      w: Math.max(1, w - l - r),
      h: Math.max(1, h - t - b),
      keyBlack: group.grid.keyBlack,
      groupId: group.id,
    };
  }

  function objectSpecOf(type) {
    const ctx = findObjectContext(type);
    if (!ctx) return null;
    const spec = objectSourceRect(ctx.group, ctx.object);
    if (!spec) return null;
    return {
      ...spec,
      anchor: ctx.object.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      footprintW: ctx.object.footprintW,
      footprintH: ctx.object.footprintH,
      kind: ctx.object.kind,
    };
  }

  function getObjectFootprint(type) {
    const obj = getObject(type);
    if (!obj) return [];
    const members = [];
    for (let dy = 0; dy < obj.footprintH; dy++) {
      for (let dx = 0; dx < obj.footprintW; dx++) {
        members.push({ dx, dy });
      }
    }
    return members;
  }

  function prewarmObjectCacheForGroup(group) {
    if (group.importMode !== 'object' || !group.object) return;
    const spec = objectSourceRect(group, group.object);
    if (!spec) return;
    getCachedDisplayCanvas(group.id, spec, DISPLAY_TILE_SIZE, DISPLAY_TILE_SIZE);
  }

  function drawObjectPropBlock(ctx, type, block) {
    const spec = objectSpecOf(type);
    if (!spec) return false;
    const totalW = block.width * spec.footprintW;
    const totalH = block.height * spec.footprintH;
    const cx = block.x + totalW / 2;
    const cy = block.y + totalH - 2;
    const scale = totalW / spec.w;
    return drawAnchored(ctx, spec, cx, cy, scale);
  }

  function drawObjectTerrainTile(ctx, type, tx, ty, tileSize) {
    const spec = objectSpecOf(type);
    if (!spec) return false;
    return blitCell(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawObjectPreview(ctx, canvasW, canvasH, groupId) {
    global.PopArt?.setupCrisp?.(ctx);
    const group = getGroup(groupId) || getActiveGroup();
    if (!group?.object) return false;
    const sheet = sheetImages.get(group.id);
    if (!sheet || !sheet.complete) return false;
    const spec = objectSourceRect(group, group.object);
    if (!spec) return false;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cellSize = Math.min(canvasW / (group.object.footprintW + 0.5), canvasH / (group.object.footprintH + 1));
    const gridW = cellSize * group.object.footprintW;
    const gridH = cellSize * group.object.footprintH;
    const ox = (canvasW - gridW) / 2;
    const oy = (canvasH - gridH) / 2;

    ctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, ox, oy, gridW, gridH);

    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    for (let row = 0; row < group.object.footprintH; row++) {
      for (let col = 0; col < group.object.footprintW; col++) {
        ctx.strokeRect(ox + col * cellSize + 0.5, oy + row * cellSize + 0.5, cellSize - 1, cellSize - 1);
      }
    }
    ctx.setLineDash([]);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px Nunito, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${group.object.footprintW}×${group.object.footprintH} マス`, canvasW / 2, Math.min(canvasH - 8, oy + gridH + 14));
    return true;
  }

  function setSheetFile(file) {
    return appendSheetFile(file);
  }

  function setSheetDataUrl(dataUrl) {
    const group = createEmptyGroup(`シート ${groups.length + 1}`);
    groups.push(group);
    activeGroupId = group.id;
    return fetch(dataUrl)
      .then((r) => r.blob())
      .then((blob) => setSheetBlobForGroup(group, blob, { regenerateGrid: true }))
      .catch(() => loadSheetImageFromDataUrlForGroup(group, dataUrl).then(() => {
        finalizeGroupSheetLoad(group, { regenerateGrid: true });
        try {
          localStorage.setItem(SHEET_DATA_KEY, dataUrl);
        } catch (e) {
          console.warn('CustomSheet: image too large for localStorage', e);
        }
        return true;
      }));
  }

  function findBestGrid(w, h) {
    let best = null;
    let bestScore = Infinity;
    const sizes = [128, 96, 64, 48, 32, 24, 16];
    const gaps = [0, 1, 2, 4, 8];

    sizes.forEach((size) => {
      gaps.forEach((gap) => {
        for (let cols = 1; cols <= 64; cols++) {
          const usedW = cols * size + Math.max(0, cols - 1) * gap;
          const dw = Math.abs(usedW - w);
          if (dw > Math.max(4, gap * 2 + 2)) continue;

          for (let rows = 1; rows <= 64; rows++) {
            const usedH = rows * size + Math.max(0, rows - 1) * gap;
            const dh = Math.abs(usedH - h);
            if (dh > Math.max(4, gap * 2 + 2)) continue;

            const sizeBonus = size === 32 ? 0 : size === 64 ? 1 : 2;
            const score = dw + dh + sizeBonus;
            if (score < bestScore) {
              bestScore = score;
              best = { cellSize: size, gap, cols, rows };
            }
          }
        }
      });
    });

    if (best) return best;
    const size = 32;
    return {
      cellSize: size,
      gap: 0,
      cols: Math.max(1, Math.floor(w / size)),
      rows: Math.max(1, Math.floor(h / size)),
    };
  }

  function autoFitGridFromImage(groupArg) {
    const group = groupArg || getActiveGroup();
    if (!group) return;
    const sheet = sheetImages.get(group.id);
    if (!sheet) return;
    const w = sheet.naturalWidth;
    const h = sheet.naturalHeight;
    group.grid.offsetX = 0;
    group.grid.offsetY = 0;
    const fit = findBestGrid(w, h);
    group.grid.cellSize = fit.cellSize;
    group.grid.gap = fit.gap;
    group.grid.cols = fit.cols;
    group.grid.rows = fit.rows;
  }

  function hasAdoptedTiles() {
    return CATALOG.length > 0;
  }

  function getNativeTileSize() {
    const group = getActiveGroup();
    const size = Math.round(Number(group?.grid.cellSize) || 32);
    return Math.max(16, Math.min(128, size));
  }

  function updateGrid(partial) {
    const group = getActiveGroup();
    if (!group) return;
    const keyBlackChanged = partial.keyBlack !== undefined && partial.keyBlack !== group.grid.keyBlack;
    group.grid = { ...group.grid, ...partial };
    if (keyBlackChanged || partial.cellSize !== undefined || partial.offsetX !== undefined
      || partial.offsetY !== undefined || partial.gap !== undefined) {
      invalidateCellCache();
    }
    generateCellsFromGridForGroup(group);
    prewarmCellCacheForGroup(group);
    saveToStorage();
  }

  function updateCell(id, partial) {
    const ctx = findCellContext(id);
    if (!ctx) return;
    const { group, cell: c } = ctx;
    if (c.setId && (partial.enabled === true || partial.enabled === false)) {
      return;
    }
    if (partial.crop) partial.crop = clampCrop(partial.crop);
    Object.assign(c, partial);
    if (partial.crop) {
      invalidateCellCache();
      prewarmCellCacheForGroup(group);
    }
    rebuildCatalog();
    saveToStorage();
  }

  function getCrop(id) {
    const objCtx = findObjectContext(id);
    if (objCtx) return clampCrop(objCtx.object.crop);
    const ctx = findCellContext(id);
    return ctx ? getCellCrop(ctx.cell) : { ...EMPTY_CROP };
  }

  function setCrop(id, crop) {
    const objCtx = findObjectContext(id);
    if (objCtx) {
      updateObject(objCtx.object.id, { crop: clampCrop(crop) });
      global.dispatchEvent(new Event('customsheet:crops-updated'));
      return;
    }
    updateCell(id, { crop: clampCrop(crop) });
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function resetCrop(id) {
    const objCtx = findObjectContext(id);
    if (objCtx) {
      updateObject(objCtx.object.id, { crop: { ...EMPTY_CROP } });
      global.dispatchEvent(new Event('customsheet:crops-updated'));
      return;
    }
    updateCell(id, { crop: { ...EMPTY_CROP } });
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function resetAllCrops() {
    groups.forEach((group) => {
      group.cells.forEach((c) => { c.crop = { ...EMPTY_CROP }; });
      if (group.object) group.object.crop = { ...EMPTY_CROP };
    });
    invalidateCellCache();
    prewarmAllCellCaches();
    rebuildCatalog();
    saveToStorage();
    global.dispatchEvent(new Event('customsheet:crops-updated'));
  }

  function getSet(id) {
    return findSetContext(id)?.set || byId[id] || null;
  }

  function createSet(memberIds, label, options = {}) {
    const group = getActiveGroup();
    if (!group) return null;
    const uniqueIds = [...new Set(memberIds)];
    const memberCells = uniqueIds.map((id) => group.cells.find((c) => c.id === id)).filter(Boolean);
    if (memberCells.length < 2) return null;
    if (memberCells.some((c) => c.setId)) return null;

    const id = allocSetId();
    const set = {
      id,
      label: (label || `セット ${group.sets.length + 1}`).trim(),
      enabled: true,
      kind: options.kind || 'prop',
      solid: !!options.solid,
      ...normalizeSetMembers(memberCells),
    };
    group.sets.push(set);
    memberCells.forEach((c) => {
      c.setId = id;
      c.enabled = true;
    });
    rebuildCatalog();
    saveToStorage();
    return set;
  }

  function updateSet(id, partial) {
    const ctx = findSetContext(id);
    if (!ctx) return;
    Object.assign(ctx.set, partial);
    rebuildCatalog();
    saveToStorage();
  }

  function deleteSet(id) {
    const ctx = findSetContext(id);
    if (!ctx) return;
    const { group, set } = ctx;
    set.members.forEach((m) => {
      const c = group.cells.find((t) => t.id === m.cellId);
      if (c) {
        c.setId = null;
        c.enabled = false;
      }
    });
    group.sets = group.sets.filter((s) => s.id !== id);
    rebuildCatalog();
    saveToStorage();
  }

  function specOfCell(group, entry) {
    const sheet = sheetImages.get(group.id);
    if (!entry || !sheet) return null;
    const rect = squareSourceRect(group, entry, getCellCrop(entry));
    return {
      ...rect,
      anchor: entry.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      keyBlack: group.grid.keyBlack,
      groupId: group.id,
    };
  }

  function specOf(type) {
    if (isSetType(type)) return setSpecOf(type);
    if (isObjectType(type)) return objectSpecOf(type);
    const ctx = findCellContext(type);
    if (ctx) return specOfCell(ctx.group, ctx.cell);
    const entry = byId[type];
    if (entry && entry.groupId) {
      const group = getGroup(entry.groupId);
      if (group) return specOfCell(group, entry);
    }
    return null;
  }

  function setSpecOf(type) {
    const ctx = findSetContext(type);
    const set = ctx?.set || getSet(type);
    if (!set) return null;
    const group = ctx?.group || getGroup(byId[type]?.groupId);
    if (!group || !sheetImages.get(group.id)) return null;
    return {
      isSet: true,
      kind: set.kind,
      anchor: set.kind === 'terrain' ? [0, 0] : [0.5, 0.92],
      keyBlack: group.grid.keyBlack,
      groupId: group.id,
      widthCells: set.widthCells,
      heightCells: set.heightCells,
      members: set.members.map((m) => {
        const cell = group.cells.find((c) => c.id === m.cellId);
        const spec = cell ? specOfCell(group, cell) : cellRectForGroup(group, m.col, m.row);
        return { ...spec, dx: m.dx, dy: m.dy, cellId: m.cellId, kind: cell?.kind || set.kind, groupId: group.id };
      }),
    };
  }

  function blitCell(ctx, spec, dx, dy, dw, dh) {
    const groupId = spec.groupId;
    const sheet = groupId ? sheetImages.get(groupId) : null;
    if (!sheet || !sheet.complete) return false;

    global.PopArt?.setupCrisp?.(ctx);
    const tw = Math.max(1, Math.round(dw));
    const th = Math.max(1, Math.round(dh));

    if (spec.w === tw && spec.h === th && !spec.keyBlack) {
      ctx.drawImage(sheet, spec.x, spec.y, spec.w, spec.h, dx, dy, tw, th);
      return true;
    }

    const cached = getCachedDisplayCanvas(groupId, spec, tw, th);
    if (!cached) return false;
    ctx.drawImage(cached, dx, dy, tw, th);
    return true;
  }

  function drawAnchored(ctx, spec, cx, cy, scale) {
    const side = spec.w * scale;
    const ax = spec.anchor[0];
    const ay = spec.anchor[1];
    const dx = Math.round(cx - side * ax);
    const dy = Math.round(cy - side * ay);
    return blitCell(ctx, spec, dx, dy, side, side);
  }

  function drawSetTerrain(ctx, type, tx, ty, tileSize) {
    const spec = setSpecOf(type);
    if (!spec) return false;
    let ok = false;
    spec.members.forEach((m) => {
      const memberSpec = { x: m.x, y: m.y, w: m.w, h: m.h, keyBlack: spec.keyBlack, groupId: spec.groupId };
      if (blitCell(ctx, memberSpec, tx + m.dx * tileSize, ty + m.dy * tileSize, tileSize, tileSize)) ok = true;
    });
    return ok;
  }

  function drawSetProp(ctx, type, block) {
    const spec = setSpecOf(type);
    if (!spec) return false;
    let ok = false;
    spec.members.forEach((m) => {
      const cx = block.x + m.dx * block.width + block.width / 2;
      const cy = block.y + m.dy * block.height + block.height - 2;
      const memberSpec = { ...m, anchor: spec.anchor, keyBlack: spec.keyBlack, groupId: spec.groupId };
      if (drawAnchored(ctx, memberSpec, cx, cy, block.width / m.w)) ok = true;
    });
    return ok;
  }

  function drawTerrainTile(ctx, type, tx, ty, tileSize) {
    if (isSetType(type)) return drawSetTerrain(ctx, type, tx, ty, tileSize);
    if (isObjectType(type)) return drawObjectTerrainTile(ctx, type, tx, ty, tileSize);
    const spec = specOf(type);
    if (!spec) return false;
    return blitCell(ctx, spec, tx, ty, tileSize, tileSize);
  }

  function drawProp(ctx, type, cx, cy, tileSize) {
    const spec = specOf(type);
    if (!spec || spec.isSet) return false;
    return drawAnchored(ctx, spec, cx, cy, tileSize / spec.w);
  }

  function drawPropBlock(ctx, type, block) {
    if (isSetType(type)) return drawSetProp(ctx, type, block);
    if (isObjectType(type)) return drawObjectPropBlock(ctx, type, block);
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height - 2;
    return drawProp(ctx, type, cx, cy, block.width);
  }

  function drawThumb(ctx, type, size) {
    if (isObjectType(type)) {
      const spec = objectSpecOf(type);
      if (!spec) return false;
      const scale = size / Math.max(spec.w, spec.h);
      const side = Math.max(spec.w, spec.h) * scale;
      const dx = (size - spec.w * scale) / 2;
      const dy = (size - spec.h * scale) / 2;
      return blitCell(ctx, spec, dx, dy, spec.w * scale, spec.h * scale);
    }
    if (isSetType(type)) {
      const spec = setSpecOf(type);
      if (!spec) return false;
      const scale = size / Math.max(spec.widthCells, spec.heightCells) / spec.members[0].w;
      let ok = false;
      spec.members.forEach((m) => {
        const side = m.w * scale;
        const dx = (m.dx + 0.5) * size / spec.widthCells - side / 2;
        const dy = (m.dy + 0.5) * size / spec.heightCells - side / 2;
        const memberSpec = { ...m, keyBlack: spec.keyBlack, groupId: spec.groupId };
        if (blitCell(ctx, memberSpec, dx, dy, side, side)) ok = true;
      });
      return ok;
    }
    const spec = specOf(type);
    if (!spec) return false;
    const scale = size / spec.w;
    const side = spec.w * scale;
    const dx = (size - side) / 2;
    const dy = (size - side) / 2;
    return blitCell(ctx, spec, dx, dy, side, side);
  }

  function gridContentSize(group) {
    const grid = group.grid;
    const w = grid.offsetX + grid.cols * grid.cellSize + Math.max(0, grid.cols - 1) * grid.gap;
    const h = grid.offsetY + grid.rows * grid.cellSize + Math.max(0, grid.rows - 1) * grid.gap;
    return { w: Math.max(w, grid.cellSize), h: Math.max(h, grid.cellSize) };
  }

  function drawGridOverlay(ctx, group, scale, ox, oy, highlightCol, highlightRow, pickCellKeys) {
    const picked = pickCellKeys instanceof Set ? pickCellKeys : new Set();
    const grid = group.grid;

    for (let row = 0; row < grid.rows; row++) {
      for (let col = 0; col < grid.cols; col++) {
        const rect = cellRectForGroup(group, col, row);
        const sx = ox + rect.x * scale;
        const sy = oy + rect.y * scale;
        const sw = rect.w * scale;
        const sh = rect.h * scale;
        const cell = group.cells.find((c) => c.col === col && c.row === row);
        const enabled = cell?.enabled;
        const inSet = !!cell?.setId;
        const pickedCell = picked.has(`${col},${row}`);

        ctx.strokeStyle = (col === highlightCol && row === highlightRow)
          ? '#f97316'
          : pickedCell ? '#a855f7'
            : inSet ? '#6366f1'
              : enabled ? '#22c55e' : '#64748b';
        ctx.lineWidth = (col === highlightCol && row === highlightRow) ? 3 : 1.5;
        ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);

        if (enabled || inSet) {
          ctx.fillStyle = inSet ? 'rgba(99,102,241,0.18)' : 'rgba(34,197,94,0.15)';
          ctx.fillRect(sx, sy, sw, sh);
        }
      }
    }

    group.sets.forEach((set) => {
      const x = ox + cellRectForGroup(group, set.anchorCol, set.anchorRow).x * scale;
      const y = oy + cellRectForGroup(group, set.anchorCol, set.anchorRow).y * scale;
      const w = set.widthCells * grid.cellSize * scale + Math.max(0, set.widthCells - 1) * grid.gap * scale;
      const h = set.heightCells * grid.cellSize * scale + Math.max(0, set.heightCells - 1) * grid.gap * scale;
      ctx.strokeStyle = set.enabled ? '#6366f1' : '#94a3b8';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.setLineDash([]);
    });
  }

  function drawGridPreview(ctx, canvasW, canvasH, highlightCol, highlightRow, pickCellKeys) {
    global.PopArt?.setupCrisp?.(ctx);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const group = getActiveGroup();
    if (!group) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PNGを選択してシートを追加してください', canvasW / 2, canvasH / 2);
      return false;
    }

    const sheet = sheetImages.get(group.id);
    const hasSheet = !!(sheet && sheet.complete && sheet.naturalWidth);
    const content = hasSheet
      ? { w: sheet.naturalWidth, h: sheet.naturalHeight }
      : gridContentSize(group);
    const scale = Math.min(canvasW / content.w, canvasH / content.h) * (hasSheet ? 1 : 0.92);
    const dw = content.w * scale;
    const dh = content.h * scale;
    const ox = (canvasW - dw) / 2;
    const oy = (canvasH - dh) / 2;

    if (hasSheet) {
      ctx.drawImage(sheet, ox, oy, dw, dh);
    } else {
      ctx.fillStyle = '#334155';
      ctx.fillRect(ox, oy, dw, dh);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + 0.5, oy + 0.5, dw - 1, dh - 1);
    }

    drawGridOverlay(ctx, group, scale, ox, oy, highlightCol, highlightRow, pickCellKeys);

    if (!hasSheet) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px Nunito, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PNGを選択するとシート画像が表示されます', canvasW / 2, Math.min(canvasH - 12, oy + dh + 18));
    }

    return hasSheet;
  }

  function drawAdjustPreview(ctx, id, canvasW, canvasH) {
    global.PopArt?.setupCrisp?.(ctx);
    const objCtx = findObjectContext(id);
    if (objCtx) {
      const { group, object } = objCtx;
      const sheet = sheetImages.get(group.id);
      if (!sheet || !sheet.complete) return false;
      const crop = clampCrop(object.crop);
      const w = sheet.naturalWidth;
      const h = sheet.naturalHeight;
      ctx.fillStyle = '#faf6ee';
      ctx.fillRect(0, 0, canvasW, canvasH);
      const pad = 10;
      const availW = canvasW - pad * 2;
      const availH = canvasH - pad * 2;
      const scale = Math.min(availW / w, availH / h);
      const drawW = w * scale;
      const drawH = h * scale;
      const ox = (canvasW - drawW) / 2;
      const oy = (canvasH - drawH) / 2;
      ctx.drawImage(sheet, 0, 0, w, h, ox, oy, drawW, drawH);
      const innerL = crop.left * drawW;
      const innerT = crop.top * drawH;
      const innerW = drawW - (crop.left + crop.right) * drawW;
      const innerH = drawH - (crop.top + crop.bottom) * drawH;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(ox + innerL, oy + innerT, innerW, innerH);
      const src = objectSourceRect(group, object);
      ctx.drawImage(sheet, src.x, src.y, src.w, src.h, ox + innerL, oy + innerT, innerW, innerH);
      ctx.strokeStyle = '#f97316';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(ox + innerL, oy + innerT, innerW, innerH);
      return true;
    }
    const ctxCell = findCellContext(id);
    if (!ctxCell) return false;
    const { group, cell } = ctxCell;
    const sheet = sheetImages.get(group.id);
    if (!sheet || !sheet.complete) return false;

    const crop = getCellCrop(cell);
    const base = cellRectForGroup(group, cell.col, cell.row);

    ctx.fillStyle = '#faf6ee';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const pad = 10;
    const availW = canvasW - pad * 2;
    const availH = canvasH - pad * 2;
    const cellScale = Math.min(availW / base.w, availH / base.h);
    const drawCellW = base.w * cellScale;
    const drawCellH = base.h * cellScale;
    const ox = (canvasW - drawCellW) / 2;
    const oy = (canvasH - drawCellH) / 2;

    ctx.drawImage(sheet, base.x, base.y, base.w, base.h, ox, oy, drawCellW, drawCellH);

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
    const sqSrc = squareSourceRect(group, cell, crop);
    const sqDrawSide = side;
    ctx.drawImage(sheet, sqSrc.x, sqSrc.y, sqSrc.w, sqSrc.h, sqX, sqY, sqDrawSide, sqDrawSide);

    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(ox, oy, drawCellW, drawCellH);
    ctx.setLineDash([]);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(sqX, sqY, sqDrawSide, sqDrawSide);
    return true;
  }

  function getSetFootprint(setId) {
    const set = getSet(setId);
    if (!set) return [];
    return set.members.map((m) => ({ dx: m.dx, dy: m.dy }));
  }

  function getCellsForGroup(groupId) {
    const group = getGroup(groupId);
    return group ? group.cells.map((c) => ({ ...c })) : [];
  }

  function getSetsForGroup(groupId) {
    const group = getGroup(groupId);
    return group ? group.sets.map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })) : [];
  }

  function collectGroupAssetIds(groupId) {
    const group = getGroup(groupId);
    if (!group) return { cellIds: [], setIds: [], objectIds: [] };
    return {
      cellIds: group.cells.map((c) => c.id),
      setIds: group.sets.map((s) => s.id),
      objectIds: group.object?.id ? [group.object.id] : [],
    };
  }

  function deleteGroup(groupId) {
    const group = getGroup(groupId);
    if (!group) return null;
    const removed = collectGroupAssetIds(groupId);

    revokeGroupObjectUrl(groupId);
    sheetImages.delete(groupId);
    invalidateCellCache();

    const blobKey = blobKeyForGroup(groupId, group.legacyBlob);
    idbDeleteBlob(blobKey);

    groups = groups.filter((g) => g.id !== groupId);
    if (activeGroupId === groupId) {
      activeGroupId = groups[0]?.id || null;
    }

    saveToStorage();
    rebuildCatalog();
    global.dispatchEvent(new CustomEvent('customsheet:group-deleted', { detail: removed }));
    if (activeGroupId) global.dispatchEvent(new Event('customsheet:active-changed'));
    global.dispatchEvent(new Event('customsheet:updated'));
    return removed;
  }

  function hasAnySheetImage() {
    return groups.some((g) => {
      const img = sheetImages.get(g.id);
      return img && img.complete && img.naturalWidth;
    });
  }

  function getGroups() {
    return groups.map((g) => {
      const img = sheetImages.get(g.id);
      let adoptedCount = 0;
      if (g.importMode === 'object') {
        adoptedCount = g.object?.enabled ? 1 : 0;
      } else {
        const cellsInSets = new Set();
        g.sets.filter((s) => s.enabled).forEach((s) => s.members.forEach((m) => cellsInSets.add(m.cellId)));
        adoptedCount = g.cells.filter((c) => c.enabled && !cellsInSets.has(c.id)).length
          + g.sets.filter((s) => s.enabled).length;
      }
      return {
        id: g.id,
        name: g.name,
        importMode: g.importMode || 'grid',
        collapsed: !!g.collapsed,
        hasImage: !!(img && img.complete && img.naturalWidth),
        adoptedCount,
        objectId: g.object?.id || null,
      };
    });
  }

  function setActiveGroup(groupId) {
    if (!getGroup(groupId)) return false;
    activeGroupId = groupId;
    saveToStorage();
    global.dispatchEvent(new Event('customsheet:active-changed'));
    return true;
  }

  function getActiveGroupId() {
    return activeGroupId;
  }

  function updateGroup(groupId, partial) {
    const group = getGroup(groupId);
    if (!group) return;
    if (partial.name !== undefined) {
      group.name = String(partial.name || '取込シート').trim() || '取込シート';
    }
    if (partial.collapsed !== undefined) {
      group.collapsed = !!partial.collapsed;
    }
    rebuildCatalog();
    saveToStorage();
    global.dispatchEvent(new Event('customsheet:updated'));
  }

  function isGroupCollapsed(groupId) {
    return !!getGroup(groupId)?.collapsed;
  }

  function getDefaultLabel(id) {
    if (byId[id]?.label) return byId[id].label;
    const obj = getObject(id);
    if (obj) return obj.label;
    const ctx = findCellContext(id);
    if (ctx) return ctx.cell.label;
    const set = getSet(id);
    return set?.label || id;
  }

  function cellRect(col, row) {
    const group = getActiveGroup();
    if (!group) return { x: 0, y: 0, w: 32, h: 32 };
    return cellRectForGroup(group, col, row);
  }

  loadFromStorage();

  global.CustomSheetAssets = {
    ID_PREFIX,
    SET_PREFIX,
    OBJECT_PREFIX,
    GROUP_PREFIX,
    get CATALOG() { return CATALOG; },
    TERRAIN_IDS,
    PROP_IDS,
    SOLID_IDS,
    isSheetType,
    isSetType,
    isObjectType,
    isCustomType,
    isReady: () => ready,
    getConfig,
    setConfig,
    getGrid: () => ({ ...(getActiveGroup()?.grid || EMPTY_GRID) }),
    getCells: () => (getActiveGroup()?.cells || []).map((c) => ({ ...c })),
    getSets: () => (getActiveGroup()?.sets || []).map((s) => ({ ...s, members: s.members.map((m) => ({ ...m })) })),
    getCellsForGroup,
    getSetsForGroup,
    collectGroupAssetIds,
    deleteGroup,
    hasAnySheetImage,
    getGroups,
    getActiveGroupId,
    setActiveGroup,
    updateGroup,
    isGroupCollapsed,
    getSet,
    getSetFootprint,
    getObject,
    getObjectFootprint,
    getActiveObject,
    updateObject,
    hasSheetImage: () => {
      const group = getActiveGroup();
      if (!group) return false;
      const sheet = sheetImages.get(group.id);
      return !!(sheet && sheet.complete && sheet.naturalWidth);
    },
    getSheetImage: () => {
      const group = getActiveGroup();
      if (!group) return null;
      const sheet = sheetImages.get(group.id);
      return sheet && sheet.complete ? sheet : null;
    },
    updateGrid,
    updateCell,
    getCrop,
    setCrop,
    resetCrop,
    resetAllCrops,
    createSet,
    updateSet,
    deleteSet,
    generateCellsFromGrid,
    setSheetDataUrl,
    setSheetBlob: (blob) => {
      const group = getActiveGroup() || createEmptyGroup('取込シート');
      if (!getGroup(group.id)) groups.push(group);
      activeGroupId = group.id;
      return setSheetBlobForGroup(group, blob, { regenerateGrid: true });
    },
    setSheetFile,
    appendSheetFile,
    appendObjectFile,
    autoFitGridFromImage,
    hasAdoptedTiles,
    getNativeTileSize,
    saveToStorage,
    loadFromStorage,
    drawTerrainTile,
    drawProp,
    drawPropBlock,
    drawThumb,
    drawAdjustPreview,
    drawGridPreview,
    drawObjectPreview,
    getDefaultLabel,
    cellRect,
  };
})(window);
