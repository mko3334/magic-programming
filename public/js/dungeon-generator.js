/**
 * プロシージャルダンジョン生成（A* 経路 + 茨ゲート + ノイズ地形）
 * Sprout 標準タイル（grass / path / water）を使用
 */
(function (global) {
  const DIRS = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];

  function cellKey(gx, gy) {
    return `${gx},${gy}`;
  }

  function inBounds(gx, gy, cols, rows) {
    return gx >= 0 && gx < cols && gy >= 0 && gy < rows;
  }

  function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickRandom(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  function manhattan(a, b) {
    return Math.abs(a.gx - b.gx) + Math.abs(a.gy - b.gy);
  }

  function astar(cols, rows, start, goal, blocked) {
    const open = [{ ...start, f: 0, g: 0 }];
    const cameFrom = new Map();
    const gScore = new Map([[cellKey(start.gx, start.gy), 0]]);
    const closed = new Set();

    while (open.length) {
      open.sort((a, b) => a.f - b.f);
      const current = open.shift();
      const ck = cellKey(current.gx, current.gy);
      if (closed.has(ck)) continue;
      closed.add(ck);

      if (current.gx === goal.gx && current.gy === goal.gy) {
        const path = [];
        let cur = ck;
        while (cur) {
          const [gx, gy] = cur.split(',').map(Number);
          path.push({ gx, gy });
          cur = cameFrom.get(cur);
        }
        return path.reverse();
      }

      for (const [dx, dy] of DIRS) {
        const nx = current.gx + dx;
        const ny = current.gy + dy;
        const nk = cellKey(nx, ny);
        if (!inBounds(nx, ny, cols, rows) || blocked.has(nk)) continue;

        const tentative = (gScore.get(ck) || 0) + 1;
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          cameFrom.set(nk, ck);
          gScore.set(nk, tentative);
          const f = tentative + manhattan({ gx: nx, gy: ny }, goal);
          open.push({ gx: nx, gy: ny, f, g: tentative });
        }
      }
    }
    return null;
  }

  function buildFallbackPath(cols, rows, start, goal) {
    const path = [];
    let gx = start.gx;
    let gy = start.gy;
    path.push({ gx, gy });
    while (gx !== goal.gx) {
      gx += gx < goal.gx ? 1 : -1;
      path.push({ gx, gy });
    }
    while (gy !== goal.gy) {
      gy += gy < goal.gy ? 1 : -1;
      path.push({ gx, gy });
    }
    return path;
  }

  function uniqueCells(cells) {
    const seen = new Set();
    return cells.filter((c) => {
      const k = cellKey(c.gx, c.gy);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  /**
   * @param {{ cols: number, rows: number, tileW: number, tileH: number, seed?: number }} opts
   */
  function generate(opts) {
    const cols = Math.max(8, opts.cols | 0);
    const rows = Math.max(6, opts.rows | 0);
    const tileW = opts.tileW || 32;
    const tileH = opts.tileH || 32;
    const rand = mulberry32(opts.seed ?? Date.now());

    const margin = 2;
    const startPool = [];
    const goalPool = [];
    for (let gy = margin; gy < rows - margin; gy++) {
      startPool.push({ gx: margin, gy });
      goalPool.push({ gx: cols - margin - 1, gy });
    }

    const start = pickRandom(rand, startPool);
    const goal = pickRandom(rand, goalPool);
    let path = astar(cols, rows, start, goal, new Set());
    if (!path || path.length < 4) {
      path = buildFallbackPath(cols, rows, start, goal);
    }

    const pathSet = new Set(path.map((p) => cellKey(p.gx, p.gy)));
    const terrain = {};

    for (let gy = 0; gy < rows; gy++) {
      for (let gx = 0; gx < cols; gx++) {
        const k = cellKey(gx, gy);
        if (pathSet.has(k)) {
          terrain[k] = 'path';
          continue;
        }
        const roll = rand();
        if (roll < 0.12) terrain[k] = 'water';
        else terrain[k] = 'grass';
      }
    }

    const gateCount = rand() < 0.45 ? 2 : 1;
    const gateCells = [];
    const minI = Math.max(2, Math.floor(path.length * 0.2));
    const maxI = Math.min(path.length - 3, Math.floor(path.length * 0.8));
    const used = new Set([cellKey(start.gx, start.gy), cellKey(goal.gx, goal.gy)]);

    for (let g = 0; g < gateCount && maxI > minI; g++) {
      let tries = 0;
      while (tries < 30) {
        const idx = minI + Math.floor(rand() * (maxI - minI));
        const cell = path[idx];
        const k = cellKey(cell.gx, cell.gy);
        if (!used.has(k)) {
          gateCells.push(cell);
          used.add(k);
          break;
        }
        tries++;
      }
    }

    if (!gateCells.length && path.length > 4) {
      const mid = path[Math.floor(path.length / 2)];
      gateCells.push(mid);
    }

    const props = [];
    path.forEach((p, i) => {
      if (i < 1 || i > path.length - 2) return;
      for (const [dx, dy] of DIRS) {
        const gx = p.gx + dx;
        const gy = p.gy + dy;
        const k = cellKey(gx, gy);
        if (!inBounds(gx, gy, cols, rows) || pathSet.has(k)) continue;
        if (terrain[k] === 'water') continue;
        if (rand() < 0.12) {
          props.push({ gridX: gx, gridY: gy, type: rand() < 0.5 ? 'grassTuft' : 'bush' });
        }
      }
    });

    const center = (cell) => ({
      x: cell.gx * tileW + tileW / 2,
      y: cell.gy * tileH + tileH / 2,
    });

    return {
      cols,
      rows,
      terrain,
      path,
      start,
      goal,
      gateCells: uniqueCells(gateCells),
      props,
      player: center(start),
      chest: center(goal),
      seed: opts.seed ?? Date.now(),
    };
  }

  global.DungeonGenerator = {
    generate,
    cellKey,
  };
})(window);
