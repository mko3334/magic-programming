/**
 * Pop Magic — 見下ろし像素画（ゼルダ風フォレスト）
 */
(function (global) {
  const PX = 2;
  const OUTLINE = '#1a2e1a';
  const TILE_COLS = 16;

  const PAL = {
    '.': null,
    O: '#1a2e1a',
    o: '#0f172a',
    K: '#fca5a5',
    k: '#fecaca',
    H: '#dc2626',
    h: '#ef4444',
    Y: '#fde047',
    E: '#ffffff',
    e: '#1e293b',
    R: '#7c3aed',
    r: '#a78bfa',
    M: '#4c1d95',
    C: '#22c55e',
    c: '#86efac',
    B: '#15803d',
    D: '#78350f',
    d: '#92400e',
    G: '#4ade80',
    g: '#86efac',
    G2: '#16a34a',
    G3: '#14532d',
    S: '#94a3b8',
    s: '#cbd5e1',
    S2: '#64748b',
    S3: '#475569',
    W: '#a16207',
    w: '#d97706',
    T: '#fde68a',
    t: '#fbbf24',
    F: '#fb923c',
    f: '#ea580c',
    P: '#f472b6',
    p: '#ec4899',
    P2: '#be185d',
    U: '#78716c',
    u: '#a8a29e',
    U2: '#57534e',
    I: '#166534',
    i: '#22c55e',
    X: '#44403c',
    x: '#292524',
    A: '#22d3ee',
    a: '#67e8f9',
    L: '#0891b2',
    l: '#06b6d4',
    N: '#64748b',
    n: '#334155',
    Z: '#eab308',
    z: '#fef08a',
    Q: '#5eead4',
    q: '#99f6e4',
    Q2: '#2dd4bf',
    V: '#b45309',
    v: '#d97706',
    J: '#ef4444',
    j: '#fca5a5',
    '*': '#fda4af',
    '&': '#fb7185',
    '%': '#ffd5b8',
    '+': '#1e40af',
    '-': '#3b82f6',
    '=': '#93c5fd',
    '{': '#fbbf24',
    '}': '#fde047',
    '[': '#2563eb',
    ']': '#60a5fa',
    '>': '#ec4899',
    '<': '#f472b6',
    '|': '#78350f',
    '@': '#22d3ee',
    ';': '#67e8f8',
  };

  const SPR = {
    tileGrass: [
      'GGGGGGGGGGGGGGGG',
      'GgGGgGGgGGgGGgGG',
      'GGGGGGGGGGGGGGGG',
      'GgG2GGgG2GGgG2GG',
      'GGGGGGGGGGGGGGGG',
      'GgGGgGGgGGgGGgGG',
      'GGGGGGGGGGGGGGGG',
      'GgG2GGgG2GGgG2GG',
      'GGGGGGGGGGGGGGGG',
      'GgGGgGGgGGgGGgGG',
      'GGGGGGGGGGGGGGGG',
      'GgG2GGgG2GGgG2GG',
      'GGGGGGGGGGGGGGGG',
      'GgGGgGGgGGgGGgGG',
      'GGGGGGGGGGGGGGGG',
      'GgG2GGgG2GGgG2GG',
    ],
    tilePath: [
      'QQQQQQQQQQQQQQQQ',
      'QqQ2qQqQ2qQqQ2qQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQQqQQqQQqQQqQQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQ2qQqQ2qQqQ2qQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQQqQQqQQqQQqQQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQ2qQqQ2qQqQ2qQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQQqQQqQQqQQqQQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQ2qQqQ2qQqQ2qQ',
      'QQQQQQQQQQQQQQQQ',
      'QqQQqQQqQQqQQqQQ',
    ],
    tileWater: [
      'LLLLLLLLLLLLLLLL',
      'LlaLLlaLLlaLLlaL',
      'LLLLLLLLLLLLLLLL',
      'LlALLlALLlALLlAL',
      'LLLLLLLLLLLLLLLL',
      'LlaLLlaLLlaLLlaL',
      'LLLLLLLLLLLLLLLL',
      'LlALLlALLlALLlAL',
      'LLLLLLLLLLLLLLLL',
      'LlaLLlaLLlaLLlaL',
      'LLLLLLLLLLLLLLLL',
      'LlALLlALLlALLlAL',
      'LLLLLLLLLLLLLLLL',
      'LlaLLlaLLlaLLlaL',
      'LLLLLLLLLLLLLLLL',
      'LlALLlALLlALLlAL',
    ],
    enemyWalk: [
      '....OOOOOO....',
      '..OOVvvvVOO..',
      '.OOVvvvvvVOO.',
      'OOEVvvvvvVEOO',
      'OOEOOOOEOOEOO',
      'OOOVvvvvvVOOO',
      '.OOVvvvvvVOO.',
      '..OOVvvvVOO..',
      '....OOOOOO....',
    ],
    chest: [
      '....OOOOOO....',
      '...OWWWWWWWO..',
      '...OWTTTTTWO..',
      '...OWTYYYTWO..',
      '...OWWWWWWWO..',
      '..OOWWWWWWOO..',
      '..OOWWTTWWOO..',
      '...OOOOOOOO...',
    ],
    tree: [
      '....OOOOOO....',
      '..OOGGGGGGOO..',
      '.OOGGGGGGGGOO.',
      'OOGGGGiiGGGGOO',
      'OOGGGGiiGGGGOO',
      'OOGGGGGGGGGGOO',
      'OOGGGGGGGGGGOO',
      '.OOGGDDGGGOO..',
      '..OOODDDOOO...',
      '....OOOOOO....',
    ],
    bush: [
      '..OOOOOO..',
      '.OOGGGGGO.',
      'OOGGGGGGGO',
      'OOGGiiGGGO',
      'OOGGiiGGGO',
      'OOGGGGGGGO',
      'OOGGgGGgGO',
      '.OOGGGGGO.',
      '..OOOOOO..',
    ],
    bushFire: [
      '..OOOOOO..',
      '.OOFFFFFO.',
      'OOFFFFFffO',
      'OOFFffFFFO',
      'OOFFffFFFO',
      'OOFFFFFFFfO',
      'OOFfFFfFFO',
      '.OOFFFFFfO',
      '..OOOOOO..',
    ],
    log: [
      '....OOOO....',
      '..OODDDDOO..',
      '.OODDDDDDDO.',
      'OODDDDDDDDOD',
      'OODDDDDDDDOD',
      '.OODDDDDDDO.',
      '..OODDDDOO..',
      '....OOOO....',
    ],
    stump: [
      '....OOOO....',
      '..OODDDDOO..',
      '.OODvvvDDO.',
      'OODvvvvvDDO',
      'OODvvvvvDDO',
      '.OODvvvDDO.',
      '..OODDDDOO..',
      '....OOOO....',
    ],
    mushroom: [
      '....OOOO....',
      '..OOJJJJOO..',
      '.OOJEEJEEJOO',
      'OOOJJJJJJJOO',
      'OOODDDDDDDOO',
      '..OODDDDDOO.',
      '....OOOO....',
    ],
    grassTuft: [
      '......OO......',
      '.....OGGO.....',
      '....OGGGOO....',
      '.....OGGO.....',
      '......OO......',
    ],
    rock: [
      '....OOOO....',
      '..OOSSSSOO..',
      '.OOSSSSSSOO.',
      'OOSSSSSSSSOO',
      'OOSssSSssSOO',
      'OOSSSSSSSSOO',
      '.OOSSSSSSOO.',
      '..OOSSSSOO..',
      '....OOOO....',
    ],
    earth: [
      'OOOOOOOO',
      'OUUUUUUO',
      'OUUuuUUO',
      'OUUuuUUO',
      'OUUUUUUO',
      'OUUgUUgUO',
      'OOOOOOOO',
    ],
    wood: [
      'OOOOOOOO',
      'OIIIIiIO',
      'OIIIIiIO',
      'OIIIIiIO',
      'OIIIIiIO',
      'OIIIIiIO',
      'OOOOOOOO',
    ],
    woodBurn: [
      'OOOOOOOO',
      'OFFffFfO',
      'OFFffFfO',
      'OFFffFfO',
      'OFFffFfO',
      'OFFffFfO',
      'OOOOOOOO',
    ],
    machine: [
      '....OOOO....',
      '..OOnnnnOO..',
      '.OOnnnnnnOO.',
      'OOnnZTTZnnOO',
      'OOnnnnnnnnOO',
      '.OOnnnnnnOO.',
      '..OOOOOOOO..',
    ],
    machineOn: [
      '....OOOO....',
      '..OOzzzzOO..',
      '.OOzzzzzzOO.',
      'OOzzZTTZzzOO',
      'OOzzzzzzzzOO',
      '.OOzzzzzzOO.',
      '..OOOOOOOO..',
    ],
    switchOff: [
      'OOOOOOOOOO',
      'OnnnnnnnnO',
      'OnnnnnnnnO',
      'OOOOOOOOOO',
    ],
    switchOn: [
      'OOOOOOOOOO',
      'OzzzzzzzzO',
      'OzzzzzzzzO',
      'OOOOOOOOOO',
    ],
  };

  const PROP_SPRITES = {
    tree: SPR.tree,
    bush: SPR.bush,
    rock: SPR.rock,
    log: SPR.log,
    stump: SPR.stump,
    mushroom: SPR.mushroom,
    grassTuft: SPR.grassTuft,
  };

  const SOLID_PROP_TYPES = new Set(['tree', 'bush', 'rock', 'log', 'stump']);
  const TERRAIN_TYPES = ['grass', 'path', 'water'];

  function terrainKey(gx, gy) {
    return `${gx},${gy}`;
  }

  function getTerrainAt(terrainMap, gx, gy) {
    if (!terrainMap) return 'grass';
    return terrainMap[terrainKey(gx, gy)] || 'grass';
  }

  function seed(x, y) {
    return Math.abs(((x * 73856093) ^ (y * 19349663)) % 997);
  }

  function setupCrisp(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.webkitImageSmoothingEnabled = false;
    ctx.mozImageSmoothingEnabled = false;
    ctx.msImageSmoothingEnabled = false;
  }

  function getPal(effectType, burning) {
    const p = { ...PAL };
    if (effectType === 'stop') {
      p.C = '#94a3b8'; p.c = '#cbd5e1'; p.B = '#64748b';
    } else if (effectType === 'slow') {
      p.C = '#38bdf8'; p.c = '#7dd3fc'; p.B = '#0284c7';
    } else if (effectType === 'speedup') {
      p.C = '#fbbf24'; p.c = '#fde68a'; p.B = '#d97706';
    }
    if (burning) {
      p.G = '#fb923c'; p.g = '#f97316'; p.G2 = '#ea580c'; p.i = '#fde047';
    }
    return p;
  }

  function blit(ctx, rows, cx, cy, scale, flipX, palette) {
    palette = palette || PAL;
    scale = scale || PX;
    if (!rows || !rows.length) return;
    const h = rows.length;
    const w = rows[0].length;
    const ox = Math.round(cx - (w * scale) / 2);
    const oy = Math.round(cy - (h * scale) / 2);
    ctx.save();
    setupCrisp(ctx);
    for (let y = 0; y < h; y++) {
      const row = rows[y];
      for (let x = 0; x < row.length; x++) {
        const ch = flipX ? row[row.length - 1 - x] : row[x];
        const col = palette[ch];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }
    ctx.restore();
  }

  function blitAt(ctx, rows, x, y, scale, flipX, palette) {
    if (typeof flipX === 'object' && flipX !== null && !Array.isArray(flipX)) {
      palette = flipX;
      flipX = false;
    }
    palette = palette || PAL;
    scale = scale || PX;
    if (!rows || !rows.length) return;
    const h = rows.length;
    const w = rows[0].length;
    ctx.save();
    setupCrisp(ctx);
    for (let ry = 0; ry < h; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < row.length; rx++) {
        const sx = flipX ? row.length - 1 - rx : rx;
        const col = palette[row[sx]];
        if (!col) continue;
        ctx.fillStyle = col;
        ctx.fillRect(x + rx * scale, y + ry * scale, scale, scale);
      }
    }
    ctx.restore();
  }

  function drawShadow(ctx, cx, cy, rw, rh) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.beginPath();
    ctx.ellipse(Math.round(cx), Math.round(cy + 2), rw, rh, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerrainTile(ctx, type, tx, ty, tileSize, gx, gy, frame) {
    const CSA = global.CustomSheetAssets;
    if (CSA && CSA.isCustomType(type) && CSA.isReady() && CSA.drawTerrainTile(ctx, type, tx, ty, tileSize)) {
      return;
    }
    const PB = global.PictureBookAssets;
    if (PB && PB.isPbType(type) && PB.isReady() && PB.drawTerrainTile(ctx, type, tx, ty, tileSize)) {
      return;
    }
    const SA = global.SproutAssets;
    if (SA && SA.isReady() && SA.drawTerrainTile(ctx, type, tx, ty, tileSize, gx, gy, frame)) {
      return;
    }
    const scale = tileSize / TILE_COLS;
    let rows = SPR.tileGrass;
    let pal = { ...PAL };
    if (type === 'path') {
      rows = SPR.tilePath;
    } else if (type === 'water') {
      rows = SPR.tileWater;
      if (((gx + gy + Math.floor(performance.now() / 400)) % 3) === 0) {
        pal.l = '#22d3ee';
      }
    } else if ((gx + gy) % 2 === 0) {
      pal.G = '#4ade80';
      pal.g = '#86efac';
    }
    blitAt(ctx, rows, tx, ty, scale, pal);
  }

  function drawGround(ctx, w, h, frame, tileSize, terrainMap) {
    tileSize = tileSize || 320;
    setupCrisp(ctx);
    const SA = global.SproutAssets;
    const paperBg = terrainMap && Object.values(terrainMap).some((v) => typeof v === 'string' && v.startsWith('pb_'));
    ctx.fillStyle = paperBg ? '#faf6ee' : (SA && SA.isReady() ? '#8ecf6a' : '#4ade80');
    ctx.fillRect(0, 0, w, h);

    const cols = Math.ceil(w / tileSize);
    const rows = Math.ceil(h / tileSize);

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const tx = gx * tileSize;
        const ty = gy * tileSize;
        const type = getTerrainAt(terrainMap, gx, gy);
        drawTerrainTile(ctx, type, tx, ty, tileSize, gx, gy, frame);
      }
    }

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const type = getTerrainAt(terrainMap, gx, gy);
        if (type !== 'grass') continue;
        const tx = gx * tileSize;
        const ty = gy * tileSize;
        if (SA && SA.isReady()) {
          SA.drawGrassDeco(ctx, tx, ty, tileSize, gx, gy);
          continue;
        }
        const s = seed(gx, gy);
        if (s % 19 === 0) {
          blitAt(ctx, SPR.grassTuft, tx + tileSize / 2 - 6, ty + tileSize / 2 - 6, 2, PAL);
        }
        if (s % 23 === 0) {
          ctx.fillStyle = s % 2 ? '#f9a8d4' : '#fde68a';
          ctx.fillRect(tx + 6 + (s % 8), ty + 6 + (s % 6), 2, 2);
        }
      }
    }
  }

  function drawBurnOverlay(ctx, block) {
    if (!block.isBurning) return;
    ctx.save();
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(block.x + 1, block.y + 1, block.width - 2, block.height - 2);
    ctx.restore();
  }

  function drawMapProp(ctx, type, block, frame) {
    if (!block.active) return;
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height - 2;
    const SA = global.SproutAssets;

    if (isSolidPropType(type)) {
      drawShadow(ctx, cx, cy + 4, block.width * 0.35, block.height * 0.12);
    }

    const CSA = global.CustomSheetAssets;
    if (CSA && CSA.isCustomType(type) && CSA.isReady()) {
      if (block.sticker && CSA.isObjectType(type) && CSA.drawObjectSticker(ctx, type, block.x, block.y)) {
        drawBurnOverlay(ctx, block);
        return;
      }
      if (CSA.isObjectType(type) && CSA.drawPropBlock(ctx, type, block)) {
        drawBurnOverlay(ctx, block);
        return;
      }
      if (CSA.isSetType(type) && CSA.drawPropBlock(ctx, type, block)) {
        drawBurnOverlay(ctx, block);
        return;
      }
      if (CSA.isSheetType(type) && CSA.drawProp(ctx, type, cx, cy, block.width)) {
        drawBurnOverlay(ctx, block);
        return;
      }
    }

    const PB = global.PictureBookAssets;
    if (PB && PB.isPbType(type) && PB.isReady() && PB.drawProp(ctx, type, cx, cy, block.width)) {
      drawBurnOverlay(ctx, block);
      return;
    }

    if (SA && SA.isReady() && SA.drawProp(ctx, type, cx, cy, block.width)) {
      drawBurnOverlay(ctx, block);
      return;
    }

    const rows = PROP_SPRITES[type] || SPR.bush;
    const scale = Math.max(2, Math.floor(block.width / rows[0].length));
    blit(ctx, rows, cx, cy - block.height / 2, scale, false, PAL);
    drawBurnOverlay(ctx, block);
  }

  function drawPlayer(ctx, player, frame) {
    const cx = player.x;
    const cy = player.y;
    const SPS = global.SproutPlayerSprites;

    drawShadow(ctx, cx, cy + 4, Math.max(18, player.radius * 0.9), 6);

    if (SPS && SPS.draw(ctx, player, frame, cx, cy)) {
      if (player.effectType === 'stop') {
        blitAt(ctx, ['O..', '.O.'], cx - 14, cy - 28, 2, false, { ...PAL, O: '#fff', '.': null });
      }
      if (player.burnTimer > 0) {
        drawBurnOverlay(ctx, {
          x: cx - player.radius,
          y: cy - player.radius,
          width: player.radius * 2,
          height: player.radius * 2,
          isBurning: true,
        });
      }
      return;
    }

    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(cx, cy, player.radius, 0, Math.PI * 2);
    ctx.fill();
    if (player.burnTimer > 0) {
      drawBurnOverlay(ctx, {
        x: cx - player.radius,
        y: cy - player.radius,
        width: player.radius * 2,
        height: player.radius * 2,
        isBurning: true,
      });
    }
  }

  function drawEnemy(ctx, enemy, frame) {
    if (!enemy.active) return;
    const bob = Math.round(Math.sin(frame * 0.16 + enemy.offset) * 1);
    const cx = enemy.x;
    const cy = enemy.y + bob;
    const burning = enemy.burnTimer > 0;

    drawShadow(ctx, cx, cy + enemy.radius * 0.35, enemy.radius * 0.6, 4);
    blit(ctx, SPR.enemyWalk, cx, cy, PX, false, getPal(enemy.effectType, burning));

    if (enemy.effectType === 'stop') {
      blit(ctx, ['O..', '.O.'], cx - 10, cy - 12, 2, false, { ...PAL, O: '#fff', '.': null });
    }

    if (enemy.hp < enemy.maxHp && enemy.hp > 0) {
      const barW = 28;
      const bx = Math.round(cx - barW / 2);
      const by = Math.round(cy - enemy.radius - 12);
      ctx.fillStyle = OUTLINE;
      ctx.fillRect(bx - 1, by - 1, barW + 2, 6);
      ctx.fillStyle = '#334155';
      ctx.fillRect(bx, by, barW, 4);
      ctx.fillStyle = '#fb7185';
      ctx.fillRect(bx, by, Math.round(barW * (enemy.hp / enemy.maxHp)), 4);
    }
  }

  function drawChest(ctx, chest, frame) {
    if (!chest.active) return;
    const bounce = Math.round(Math.sin(frame * 0.1) * 1);
    const cx = chest.x + chest.width / 2;
    const cy = chest.y + chest.height / 2 + bounce;
    const SA = global.SproutAssets;
    drawShadow(ctx, cx, chest.y + chest.height, chest.width * 0.4, 3);
    if (SA && SA.isReady() && SA.drawChestSprite(ctx, cx, cy, frame)) {
      if (Math.sin(frame * 0.18) > 0.4) {
        blit(ctx, ['.Y.', 'Y.Y', '.Y.'], cx + 10, cy - 10, 2, false, PAL);
      }
      return;
    }
    blit(ctx, SPR.chest, cx, cy, PX, false, PAL);
    if (Math.sin(frame * 0.18) > 0.4) {
      blit(ctx, ['.Y.', 'Y.Y', '.Y.'], cx + 10, cy - 10, 2, false, PAL);
    }
  }

  function drawTileProp(ctx, rows, block, burning, customPal) {
    const cx = block.x + block.width / 2;
    const cy = block.y + block.height / 2;
    const scale = Math.max(2, Math.floor(block.width / rows[0].length));
    drawShadow(ctx, cx, cy + block.height * 0.1, block.width * 0.35, 4);
    blit(ctx, rows, cx, cy, scale, false, customPal || (burning ? getPal(null, true) : PAL));
  }

  function drawIbara(ctx, block) {
    if (!block.active) return;
    drawMapProp(ctx, 'bush', block);
  }

  function drawRock(ctx, block) {
    if (!block.active) return;
    drawMapProp(ctx, 'rock', block);
  }

  function drawEarth(ctx, block) {
    if (!block.active) return;
    drawTileProp(ctx, SPR.earth, block, false);
  }

  function drawWood(ctx, block) {
    if (!block.active) return;
    let rows = SPR.wood;
    let pal = PAL;
    if (block.isCharcoal) {
      rows = ['OOOOOOOO', 'OXXXXXXO', 'OXXXXXXO', 'OXXXXXXO', 'OXXXXXXO', 'OXXXXXXO', 'OOOOOOOO'];
    } else if (block.isBurning) {
      rows = SPR.woodBurn;
    } else if (block.grown) {
      pal = { ...PAL, I: '#14532d', i: '#166534' };
    }
    drawTileProp(ctx, rows, block, block.isBurning, pal);
  }

  function drawMachine(ctx, machine) {
    const cx = machine.x + machine.width / 2;
    const cy = machine.y + machine.height / 2;
    drawShadow(ctx, cx, machine.y + machine.height, machine.width * 0.4, 3);
    blit(ctx, machine.active ? SPR.machineOn : SPR.machine, cx, cy, PX, false, PAL);
  }

  function drawWeightSwitch(ctx, sw) {
    const cx = sw.x + sw.width / 2;
    const cy = sw.y + sw.height / 2;
    blit(ctx, sw.pressed ? SPR.switchOn : SPR.switchOff, cx, cy, PX, false, PAL);
    ctx.fillStyle = sw.pressed ? '#713f12' : '#e2e8f0';
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(sw.pressed ? 'ON' : 'OFF', cx, cy + 3);
    ctx.textAlign = 'left';
  }

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function isSolidPropType(type) {
    const CSA = global.CustomSheetAssets;
    if (CSA && CSA.isCustomType(type) && CSA.SOLID_IDS.has(type)) return true;
    const CO = global.CutoutAssets;
    if (CO && CO.isCutoutType(type) && CO.SOLID_IDS.has(type)) return true;
    const PB = global.PictureBookAssets;
    if (PB && PB.isPbType(type) && PB.SOLID_IDS.has(type)) return true;
    return SOLID_PROP_TYPES.has(type);
  }

  function isWaterTerrain(type) {
    const PB = global.PictureBookAssets;
    if (PB && PB.isPbType(type) && PB.WATER_IDS.has(type)) return true;
    return type === 'water';
  }

  function drawCreateToolThumb(ctx, kind, size, frame) {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, size, size);

    const SA = global.SproutAssets;
    const f = frame || 0;

    const CSA = global.CustomSheetAssets;
    if (CSA && CSA.isCustomType(kind) && CSA.isReady() && CSA.drawThumb(ctx, kind, size)) {
      return;
    }

    const PB = global.PictureBookAssets;
    if (PB && PB.isPbType(kind) && PB.isReady() && PB.drawThumb(ctx, kind, size)) {
      return;
    }

    if (kind === 'grass' || kind === 'path' || kind === 'water') {
      drawTerrainTile(ctx, kind, 0, 0, size, 0, 0, f);
      return;
    }

    if (kind === 'player') {
      const SPS = global.SproutPlayerSprites;
      const stub = {
        facing: 'down',
        animState: 'idle',
        isMoving: false,
        animTimer: 0,
        invincibleTimer: 0,
      };
      if (SPS && SPS.draw(ctx, stub, f, size / 2, size - 1)) return;
      ctx.fillStyle = '#3b82f6';
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, 8, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind === 'enemy') {
      drawEnemy(ctx, {
        x: size / 2,
        y: size / 2 + 2,
        radius: 10,
        active: true,
        hp: 10,
        maxHp: 10,
        effectType: null,
        offset: 0,
        burnTimer: 0,
      }, f);
      return;
    }

    if (kind === 'chest') {
      drawChest(ctx, {
        x: size / 2 - 12,
        y: size - 18,
        width: 24,
        height: 16,
        active: true,
      }, f);
      return;
    }

    drawMapProp(ctx, kind, {
      x: 0,
      y: 0,
      width: size,
      height: size,
      active: true,
      isBurning: false,
    }, f);
  }

  global.PopArt = {
    PX,
    TILE_COLS,
    TERRAIN_TYPES,
    SOLID_PROP_TYPES,
    terrainKey,
    getTerrainAt,
    isSolidPropType,
    isWaterTerrain,
    drawCreateToolThumb,
    setupCrisp,
    drawGround,
    drawMapProp,
    drawPlayer,
    drawEnemy,
    drawChest,
    drawIbara,
    drawRock,
    drawEarth,
    drawWood,
    drawMachine,
    drawWeightSwitch,
    roundRect,
  };
})(window);
