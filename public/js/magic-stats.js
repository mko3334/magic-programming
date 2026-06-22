/**
 * 基礎魔法ステータス
 * 優先順位: localStorage（ゲーム内設定）> CSV > 内蔵デフォルト
 */
(function (global) {
  const GAME_FPS = 60;
  const STORAGE_KEY = 'pop-magic-basic-stats-v1';

  const STAT_HEADERS = [
    'id', '名前', '直接ダメージ', '持続ダメージ', '持続ダメージ量', '持続秒', '持続間隔秒',
    '質量', 'フィールド残留秒', '範囲ダメージ', '弾速', '欠片弾速', '拘束秒', '色', 'glow', 'icon', '備考',
  ];

  const STAT_IDS = ['fire', 'lightning', 'water', 'wood', 'earth'];

  let GEN_CONFIG = {};
  let MAGIC_COMBAT = {};
  let currentRows = [];

  const FALLBACK_CSV = `id,名前,直接ダメージ,持続ダメージ,持続ダメージ量,持続秒,持続間隔秒,質量,フィールド残留秒,範囲ダメージ,弾速,欠片弾速,拘束秒,色,glow,icon,備考
fire,炎,2,あり,1,3,1,2,2,0,8,0,0,#f97316,#ef4444,🔥,ヒット＋燃焼DoT。敵・木など燃える対象のHPを削る
lightning,雷,5,なし,0,0,1,3,2,4,8,0,0,#facc15,#eab308,⚡,生成時に範囲ダメージ。水と反応で範囲拡大
water,水,1.5,なし,0,0,1,2,2,0,4,3.5,0,#0ea5e9,#0284c7,💧,衝撃で左右分裂。炎を消火
wood,木,1,なし,0,0,1,1,2,0,8,0,2,#16a34a,#15803d,🌿,敵を拘束。橋・壁として配置
earth,土,3,なし,0,0,1,5,2,0,8,0,0,#78716c,#57534e,🪨,質量最大。弾速=弾速÷質量。重量スイッチ用`;

  function num(v, def) {
    const n = parseFloat(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : def;
  }

  function parseTruthy(val) {
    const v = String(val || '').trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'あり' || v === 'yes' || v === 'y';
  }

  function truthyLabel(val) {
    return parseTruthy(val) ? 'あり' : 'なし';
  }

  function secToFrames(sec) {
    return Math.max(0, Math.round(num(sec, 0) * GAME_FPS));
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex || '#ffffff').replace('#', '');
    if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function parseCSVLine(line) {
    const result = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQ = !inQ;
        continue;
      }
      if (c === ',' && !inQ) {
        result.push(cur);
        cur = '';
        continue;
      }
      cur += c;
    }
    result.push(cur);
    return result;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) return [];
    const headers = parseCSVLine(lines[0]).map((h) => h.trim());
    return lines.slice(1).map((line) => {
      const vals = parseCSVLine(line);
      const row = {};
      headers.forEach((h, i) => {
        row[h] = (vals[i] || '').trim();
      });
      return row;
    });
  }

  function rowVal(row, ...keys) {
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== '') return row[k];
    }
    return '';
  }

  function normalizeRow(row) {
    const id = rowVal(row, 'id', 'ID');
    if (!id) return null;
    const normalized = { id };
    STAT_HEADERS.forEach((h) => {
      if (h === 'id') return;
      if (h === '持続ダメージ') {
        normalized[h] = truthyLabel(row[h]);
        return;
      }
      normalized[h] = row[h] !== undefined ? String(row[h]) : '';
    });
    return normalized;
  }

  function buildFromRows(rows) {
    const nextGen = {};
    const nextCombat = {};
    currentRows = [];

    rows.forEach((raw) => {
      const row = normalizeRow(raw);
      if (!row) return;
      currentRows.push({ ...row });

      const id = row.id;
      const label = row['名前'] || id;
      const color = row['色'] || '#ffffff';
      const glow = row.glow || color;
      const mass = num(row['質量'], 1);
      const icon = row.icon || '?';

      nextGen[id] = {
        color,
        glow,
        fill: hexToRgba(color, 0.55),
        ring: hexToRgba(glow, 0.85),
        mass,
        label,
        icon,
      };

      nextCombat[id] = {
        hitDamage: num(row['直接ダメージ'], 1),
        hasDot: parseTruthy(row['持続ダメージ']),
        dotDamage: num(row['持続ダメージ量'], 1),
        dotDurationSec: num(row['持続秒'], 0),
        dotIntervalSec: num(row['持続間隔秒'], 1),
        mass,
        fieldLifetimeSec: num(row['フィールド残留秒'], 2),
        aoeDamage: num(row['範囲ダメージ'], 0),
        projectileSpeed: num(row['弾速'], 8),
        shardSpeed: num(row['欠片弾速'], 0),
        bindDurationSec: num(row['拘束秒'], 0),
        notes: row['備考'] || '',
      };
    });

    GEN_CONFIG = nextGen;
    MAGIC_COMBAT = nextCombat;
  }

  function emitUpdated() {
    global.dispatchEvent(new CustomEvent('magicstats:updated', { detail: { GEN_CONFIG, MAGIC_COMBAT, rows: getRows() } }));
  }

  function getCombat(id) {
    return (
      MAGIC_COMBAT[id] || {
        hitDamage: 1,
        hasDot: false,
        dotDamage: 1,
        dotDurationSec: 0,
        dotIntervalSec: 1,
        mass: 1,
        fieldLifetimeSec: 2,
        aoeDamage: 0,
        projectileSpeed: 8,
        shardSpeed: 0,
        bindDurationSec: 0,
      }
    );
  }

  function getFieldLifetimeFrames(type) {
    return secToFrames(getCombat(type).fieldLifetimeSec);
  }

  function getGenMass(id) {
    return Math.max(1, num(getCombat(id).mass, 1));
  }

  function getProjectileSpeed(gen, isWaterShard) {
    const c = getCombat(gen);
    let base;
    if (gen === 'water' && isWaterShard && c.shardSpeed > 0) base = c.shardSpeed;
    else if (c.projectileSpeed > 0) base = c.projectileSpeed;
    else base = 8;
    return base / getGenMass(gen);
  }

  function applyElementHitEffects(enemy, genType) {
    const st = getCombat(genType);
    if (st.hasDot) {
      enemy.burnTimer = secToFrames(st.dotDurationSec);
      enemy.burnTickTimer = secToFrames(st.dotIntervalSec);
    }
    if (st.bindDurationSec > 0) {
      enemy.applyEffect('stop');
      enemy.bindTimer = Math.max(enemy.bindTimer || 0, secToFrames(st.bindDurationSec));
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return Array.isArray(data) ? data : null;
    } catch (_) {
      return null;
    }
  }

  function saveToStorage(rows) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  }

  function hasStoredOverride() {
    try {
      return !!localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return false;
    }
  }

  async function resolveCsvUrl() {
    let csvUrl = '/data/basic-magic-stats.csv';
    try {
      const cfgRes = await fetch('/data/stats-config.json?t=' + Date.now());
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        if (cfg.csvUrl) csvUrl = cfg.csvUrl;
      }
    } catch (_) {
      /* optional */
    }
    return csvUrl;
  }

  async function fetchCsvText() {
    try {
      const csvUrl = await resolveCsvUrl();
      const sep = csvUrl.includes('?') ? '&' : '?';
      const res = await fetch(csvUrl + sep + 't=' + Date.now());
      if (!res.ok) throw new Error('CSV fetch failed: ' + res.status);
      return await res.text();
    } catch (_) {
      return FALLBACK_CSV;
    }
  }

  async function loadMagicStats(silent) {
    const stored = loadFromStorage();
    if (stored && stored.length) {
      buildFromRows(stored);
      if (!silent) console.log('[MagicStats] 保存済み設定を読み込みました', MAGIC_COMBAT);
      emitUpdated();
      return { GEN_CONFIG, MAGIC_COMBAT, source: 'storage' };
    }

    const text = await fetchCsvText();
    buildFromRows(parseCSV(text));
    if (!silent) console.log('[MagicStats] CSVから読み込みました', MAGIC_COMBAT);
    emitUpdated();
    return { GEN_CONFIG, MAGIC_COMBAT, source: 'csv' };
  }

  function saveMagicStats(rows) {
    const normalized = rows.map(normalizeRow).filter(Boolean);
    saveToStorage(normalized);
    buildFromRows(normalized);
    emitUpdated();
    return { GEN_CONFIG, MAGIC_COMBAT, source: 'storage' };
  }

  async function resetMagicStats() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {
      /* ignore */
    }
    const text = await fetchCsvText();
    buildFromRows(parseCSV(text));
    emitUpdated();
    return { GEN_CONFIG, MAGIC_COMBAT, source: 'csv' };
  }

  function getRows() {
    return currentRows.map((r) => ({ ...r }));
  }

  function getStatHeaders() {
    return STAT_HEADERS.slice();
  }

  function getStatIds() {
    return STAT_IDS.slice();
  }

  function startAutoReload(intervalMs) {
    if (!/^localhost$|^127\.0\.0\.1$/.test(global.location.hostname)) return;
    if (hasStoredOverride()) return;
    setInterval(() => {
      loadMagicStats(true);
    }, intervalMs || 3000);
  }

  global.MagicStats = {
    GAME_FPS,
    STORAGE_KEY,
    loadMagicStats,
    saveMagicStats,
    resetMagicStats,
    startAutoReload,
    hasStoredOverride,
    getGenConfig: () => GEN_CONFIG,
    getCombat,
    getFieldLifetimeFrames,
    getGenMass,
    getProjectileSpeed,
    applyElementHitEffects,
    secToFrames,
    getRows,
    getStatHeaders,
    getStatIds,
  };
})(window);
