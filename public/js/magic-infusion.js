/**
 * 魔力注入 — 基礎魔法ブロックごとのステータス微調整
 * 魔力は戦闘・攻略でランダム獲得。注入レベルは localStorage に保存。
 */
(function (global) {
  const STORAGE_KEY = 'pop-magic-infusion-v1';
  const LEVEL_MIN = -100;
  const LEVEL_MAX = 100;
  /** 1魔力 = 注入レベル±1（非時間系）。時間系（*Sec / waitSec）は ±0.1秒 */
  const PCT_PER_LEVEL = 0.01;
  const MANA_PER_LEVEL = 1;
  const NUM_PER_LEVEL = 1;
  const SEC_PER_LEVEL = 0.1;
  const WAIT_BASE_SEC = 1;
  const PULL_BASE_DURATION_SEC = 0.5;

  /** @type {{ mana: number, levels: Record<string, Record<string, number>> }} */
  let state = { mana: 0, levels: {} };

  function clampLevel(n) {
    return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, Math.round(n)));
  }

  function fmtPct(level) {
    return `${100 + level}%`;
  }

  function applyPct(base, level) {
    return base * (1 + level * PCT_PER_LEVEL);
  }

  function applyPctFloored(base, level, floor) {
    return Math.max(floor, applyPct(base, level));
  }

  function fmtAdd(level) {
    return level >= 0 ? `+${level}` : `${level}`;
  }

  function applyAdd(base, level) {
    return base + level * NUM_PER_LEVEL;
  }

  function formatGenValue(val) {
    const r = Math.round(val * 10) / 10;
    return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(/\.0$/, '');
  }

  function genStatSuffix(statId) {
    if (statId.endsWith('Sec')) return '秒';
    return '';
  }

  function isSecStatId(statId) {
    return statId.endsWith('Sec') || statId === 'waitSec';
  }

  function perLevelForStat(statId) {
    return isSecStatId(statId) ? SEC_PER_LEVEL : NUM_PER_LEVEL;
  }

  /** ジェネレート用: ダメージ等 ±1 / 秒系 ±0.1 */
  function makeGenStat(statId, label, opts = {}) {
    const min = opts.min ?? 0;
    const perLevel = perLevelForStat(statId);
    return {
      id: statId,
      label,
      fmt(level, genId) {
        const combat = global.MagicStats?.getCombat(genId) || {};
        const base = combat[statId] ?? 0;
        const val = Math.max(min, base + level * perLevel);
        return formatGenValue(val) + genStatSuffix(statId);
      },
      apply(b, l) {
        return Math.max(min, b + l * perLevel);
      },
    };
  }

  /** トリガ待機: 基礎秒数 ±0.1秒 / 魔力 */
  function makeSecStat(statId, label, baseSec, opts = {}) {
    const min = opts.min ?? 0;
    return {
      id: statId,
      label,
      base: baseSec,
      fmt(level) {
        const val = Math.max(min, baseSec + level * SEC_PER_LEVEL);
        return formatGenValue(val) + '秒';
      },
      apply(b, l) {
        const base = b !== undefined ? b : baseSec;
        return Math.max(min, base + l * SEC_PER_LEVEL);
      },
    };
  }

  /** アクション用: 基礎値 ±1 / 魔力（吸引強度など） */
  function makeActNumStat(statId, label, baseVal, opts = {}) {
    const min = opts.min ?? 0;
    return {
      id: statId,
      label,
      base: baseVal,
      fmt(level) {
        return formatGenValue(Math.max(min, baseVal + level * NUM_PER_LEVEL));
      },
      apply(b, l) {
        const base = b !== undefined ? b : baseVal;
        return Math.max(min, base + l * NUM_PER_LEVEL);
      },
    };
  }

  /** 初期値(0)から level まで離れるのに投じた魔力（|level| × 1） */
  function manaInvestedForLevel(level) {
    return Math.abs(level) * MANA_PER_LEVEL;
  }

  function getAdjustDeltaCost(blockId, statId, delta) {
    const cur = getLevel(blockId, statId);
    const next = clampLevel(cur + delta);
    if (next === cur) return 0;
    return manaInvestedForLevel(next) - manaInvestedForLevel(cur);
  }

  function infusionCost() {
    return MANA_PER_LEVEL;
  }

  function getLevel(blockId, statId) {
    return clampLevel(state.levels[blockId]?.[statId] ?? 0);
  }

  function setLevel(blockId, statId, level) {
    if (!state.levels[blockId]) state.levels[blockId] = {};
    state.levels[blockId][statId] = clampLevel(level);
  }

  function multFromLevel(level) {
    return 1 + level * PCT_PER_LEVEL;
  }

  /** ブロック定義: level = 初期値からのズレ（1 = 1魔力分） */
  const pct = { fmt: (l) => fmtPct(l), apply: applyPct };
  const addLv = { fmt: fmtAdd, apply: applyAdd, base: 0 };

  const BLOCK_DEFS = {
    fire: {
      label: '炎', icon: '🔥', category: 'gen',
      stats: [
        makeGenStat('hitDamage', 'ダメージ'),
        makeGenStat('fieldLifetimeSec', '残留時間'),
        makeGenStat('dotDamage', '燃焼ダメージ(DoT)'),
        makeGenStat('dotDurationSec', '燃焼時間'),
      ],
    },
    lightning: {
      label: '雷', icon: '⚡️', category: 'gen',
      stats: [
        makeGenStat('hitDamage', 'ダメージ'),
        makeGenStat('aoeDamage', '範囲ダメージ'),
        makeGenStat('fieldLifetimeSec', '残留時間'),
      ],
    },
    water: {
      label: '水', icon: '💧', category: 'gen',
      stats: [
        makeGenStat('hitDamage', 'ダメージ'),
        makeGenStat('projectileSpeed', '弾速', { min: 0.5 }),
        makeGenStat('shardSpeed', '欠片弾速', { min: 0.5 }),
        makeGenStat('fieldLifetimeSec', '残留時間'),
      ],
    },
    wood: {
      label: '木', icon: '🌿', category: 'gen',
      stats: [
        makeGenStat('hitDamage', 'ダメージ'),
        makeGenStat('bindDurationSec', '拘束時間'),
        makeGenStat('fieldLifetimeSec', '残留時間'),
      ],
    },
    earth: {
      label: '土', icon: '🪨', category: 'gen',
      stats: [
        makeGenStat('hitDamage', 'ダメージ'),
        makeGenStat('mass', '質量', { min: 0.5 }),
        makeGenStat('fieldLifetimeSec', '残留時間'),
      ],
    },
    forward: {
      label: '前へ', icon: '➡️', category: 'vec',
      stats: [{ id: 'speedMult', label: '弾速', ...pct, base: 1 }],
    },
    zigzag: {
      label: 'ジグザグ', icon: '〰️', category: 'vec',
      stats: [
        { id: 'speedMult', label: '弾速', ...pct, base: 1 },
        { id: 'ampMult', label: '振幅', ...pct, base: 1 },
      ],
    },
    return: {
      label: '戻る', icon: '🪃', category: 'vec',
      stats: [{ id: 'speedMult', label: '帰還速度', ...pct, base: 1 }],
    },
    bounce: {
      label: '跳ねる', icon: '🏐', category: 'vec',
      stats: [
        { id: 'speedMult', label: '弾速', ...pct, base: 1 },
        { id: 'bounceMult', label: '跳ね返り', ...pct, base: 1 },
      ],
    },
    orbit: {
      label: '回る', icon: '🔄', category: 'vec',
      stats: [
        { id: 'radiusMult', label: '軌道半径', ...pct, base: 1 },
        { id: 'speedMult', label: '回転速度', ...pct, base: 1 },
      ],
    },
    homing: {
      label: 'ホーミング', icon: '🎯', category: 'vec',
      stats: [
        { id: 'speedMult', label: '追尾速度', ...pct, base: 1 },
        { id: 'turnMult', label: '旋回性能', ...pct, base: 1 },
      ],
    },
    touch: {
      label: '触れたら', icon: '💥', category: 'trig',
      stats: [{ id: 'radiusMult', label: '判定半径', ...pct, base: 1 }],
    },
    tap: {
      label: 'タップ待機', icon: '👆', category: 'trig',
      stats: [{ id: 'tapWindowMult', label: '反応猶予', ...pct, base: 1 }],
    },
    wait: {
      label: '待機', icon: '⏱️', category: 'trig',
      stats: [makeSecStat('waitSec', '待機時間', WAIT_BASE_SEC, { min: 0.1 })],
    },
    explode: {
      label: '爆発', icon: '💥', category: 'act',
      stats: [
        { id: 'radiusMult', label: '爆風半径', ...pct, base: 1 },
        { id: 'powerMult', label: '爆発威力', ...pct, base: 1 },
      ],
    },
    pull: {
      label: '吸引', icon: '🧲', category: 'act',
      stats: [
        { id: 'radiusMult', label: '吸引半径', ...pct, base: 1 },
        makeActNumStat('attractStrength', '吸引強度(>質量)', 2, { min: 0.5 }),
        makeSecStat('pullDurationSec', '吸引時間', PULL_BASE_DURATION_SEC, { min: 0.1 }),
      ],
    },
    split: {
      label: '分裂', icon: '🔱', category: 'act',
      stats: [
        { id: 'spreadMult', label: '分裂角度', ...pct, base: 1 },
        { id: 'speedMult', label: '子弾速度', ...pct, base: 1 },
      ],
    },
    grow: {
      label: '巨大化', icon: '🏔️', category: 'act',
      stats: [
        { id: 'scaleMult', label: '拡大率', ...pct, base: 1 },
        { id: 'fieldBoostMult', label: '残留強化', ...pct, base: 1 },
      ],
    },
    hard: {
      label: '強固', icon: '🛡️', category: 'act',
      stats: [{ id: 'durabilityAdd', label: '貫通力', ...addLv }],
    },
    stop: {
      label: '止める', icon: '🛑', category: 'act',
      stats: [
        { id: 'radiusMult', label: '効果半径', ...pct, base: 1 },
        { id: 'durationMult', label: '効果時間', ...pct, base: 1 },
      ],
    },
    slow: {
      label: 'スロー', icon: '🐢', category: 'act',
      stats: [
        { id: 'radiusMult', label: '効果半径', ...pct, base: 1 },
        { id: 'durationMult', label: '効果時間', ...pct, base: 1 },
      ],
    },
    speedup: {
      label: '加速', icon: '🐇', category: 'act',
      stats: [
        { id: 'radiusMult', label: '効果半径', ...pct, base: 1 },
        { id: 'durationMult', label: '効果時間', ...pct, base: 1 },
      ],
    },
    repeat: {
      label: '最初から', icon: '🔁', category: 'ctrl',
      stats: [{ id: 'repeatAdd', label: '追加リピート', ...addLv }],
    },
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.mana === 'number') state.mana = Math.max(0, Math.floor(data.mana));
      if (data.levels && typeof data.levels === 'object') state.levels = data.levels;
    } catch (_) {
      /* ignore */
    }
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (_) {
      /* ignore */
    }
    global.dispatchEvent(new CustomEvent('magicinfusion:updated', { detail: { mana: state.mana } }));
  }

  function getMana() {
    return state.mana;
  }

  function addMana(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    const gained = Math.floor(amount);
    state.mana += gained;
    save();
    return gained;
  }

  function setMana(amount) {
    state.mana = Math.max(0, Math.floor(amount));
    save();
    return state.mana;
  }

  /** ランダムドロップ: 敵撃破 */
  function rollEnemyDrop() {
    if (Math.random() > 0.38) return 0;
    return addMana(1 + Math.floor(Math.random() * 3));
  }

  /** ダンジョン階層クリア */
  function grantClearBonus() {
    return addMana(6 + Math.floor(Math.random() * 10));
  }

  function getBlockDef(blockId) {
    return BLOCK_DEFS[blockId] || null;
  }

  function getAllBlockIds() {
    return Object.keys(BLOCK_DEFS);
  }

  function getBlockTotalLevel(blockId) {
    const def = BLOCK_DEFS[blockId];
    if (!def) return 0;
    return def.stats.reduce((s, st) => s + Math.abs(getLevel(blockId, st.id)), 0);
  }

  function adjustStat(blockId, statId, delta) {
    const def = BLOCK_DEFS[blockId];
    if (!def) return { ok: false, reason: 'unknown' };
    const stat = def.stats.find((s) => s.id === statId);
    if (!stat) return { ok: false, reason: 'unknown_stat' };

    const cur = getLevel(blockId, statId);
    const next = clampLevel(cur + delta);
    if (next === cur) return { ok: false, reason: 'limit' };

    const prevInvested = manaInvestedForLevel(cur);
    const nextInvested = manaInvestedForLevel(next);
    const diff = nextInvested - prevInvested;

    if (diff > 0) {
      if (state.mana < diff) return { ok: false, reason: 'nomana', cost: diff };
      state.mana -= diff;
    } else if (diff < 0) {
      state.mana += -diff;
    }

    setLevel(blockId, statId, next);
    save();
    return { ok: true, level: next, mana: state.mana, delta: diff };
  }

  function getSetLevelCost(blockId, statId, targetLevel) {
    const cur = getLevel(blockId, statId);
    const next = clampLevel(targetLevel);
    return manaInvestedForLevel(next) - manaInvestedForLevel(cur);
  }

  function setStatLevel(blockId, statId, targetLevel) {
    const def = BLOCK_DEFS[blockId];
    if (!def) return { ok: false, reason: 'unknown' };
    const stat = def.stats.find((s) => s.id === statId);
    if (!stat) return { ok: false, reason: 'unknown_stat' };

    const cur = getLevel(blockId, statId);
    const next = clampLevel(targetLevel);
    if (next === cur) return { ok: false, reason: 'same', level: cur };

    const diff = manaInvestedForLevel(next) - manaInvestedForLevel(cur);
    if (diff > 0) {
      if (state.mana < diff) return { ok: false, reason: 'nomana', cost: diff, level: cur };
      state.mana -= diff;
    } else if (diff < 0) {
      state.mana += -diff;
    }

    setLevel(blockId, statId, next);
    save();
    return { ok: true, level: next, mana: state.mana, delta: diff, from: cur };
  }

  function applyStat(blockId, statId, baseValue) {
    const def = BLOCK_DEFS[blockId];
    if (!def) return baseValue;
    const stat = def.stats.find((s) => s.id === statId);
    if (!stat) return baseValue;
    const level = getLevel(blockId, statId);
    const base = baseValue !== undefined ? baseValue : (stat.base ?? 1);
    return stat.apply(base, level);
  }

  /** ジェネレート属性の戦闘ステータス（注入反映） */
  function getInfusedCombat(genId) {
    const base = global.MagicStats.getCombat(genId);
    const out = { ...base };
    const def = BLOCK_DEFS[genId];
    if (!def || def.category !== 'gen') return out;

    def.stats.forEach((st) => {
      if (out[st.id] !== undefined) {
        out[st.id] = applyStat(genId, st.id, out[st.id]);
      }
    });
    return out;
  }

  function getInfusedFieldLifetimeFrames(genId) {
    const c = getInfusedCombat(genId);
    return global.MagicStats.secToFrames(c.fieldLifetimeSec);
  }

  function getInfusedProjectileSpeed(genId, isWaterShard, vecId) {
    const c = getInfusedCombat(genId);
    let base;
    if (genId === 'water' && isWaterShard && c.shardSpeed > 0) base = c.shardSpeed;
    else if (c.projectileSpeed > 0) base = c.projectileSpeed;
    else base = 8;
    const mass = Math.max(0.5, c.mass);
    let speed = base / mass;
    if (vecId) speed *= applyStat(vecId, 'speedMult', 1);
    return speed;
  }

  function getInfusedVecMult(vecId, statId, baseVal = 1) {
    if (!vecId || !BLOCK_DEFS[vecId]) return baseVal;
    return applyStat(vecId, statId, baseVal);
  }

  function getInfusedWaitSec(trigVal) {
    let baseSec = WAIT_BASE_SEC;
    if (trigVal === 'time_half') baseSec = 0.5;
    else if (trigVal === 'time') baseSec = 1;
    else if (trigVal !== 'wait') return WAIT_BASE_SEC;
    return applyStat('wait', 'waitSec', baseSec);
  }

  function getInfusedTrigWaitFrames(trigVal) {
    if (trigVal !== 'wait' && trigVal !== 'time_half' && trigVal !== 'time') return 60;
    const sec = getInfusedWaitSec(trigVal);
    return Math.max(1, global.MagicStats.secToFrames(sec));
  }

  function getInfusedTrigRadiusMult(trigVal) {
    if (trigVal === 'touch') return applyStat('touch', 'radiusMult', 1);
    return 1;
  }

  function getInfusedPullDurationSec() {
    return applyStat('pull', 'pullDurationSec', PULL_BASE_DURATION_SEC);
  }

  function getInfusedPullDurationFrames() {
    return Math.max(1, global.MagicStats.secToFrames(getInfusedPullDurationSec()));
  }

  function getInfusedAct(blockId) {
    const def = BLOCK_DEFS[blockId];
    if (!def || def.category !== 'act') return {};
    const out = {};
    def.stats.forEach((st) => {
      out[st.id] = applyStat(blockId, st.id, st.base ?? 1);
    });
    return out;
  }

  function getInfusedCtrlRepeatBonus() {
    return applyStat('repeat', 'repeatAdd', 0);
  }

  function applyInfusedElementHitEffects(enemy, genType) {
    const st = getInfusedCombat(genType);
    if (st.hasDot) {
      enemy.burnTimer = global.MagicStats.secToFrames(st.dotDurationSec);
      enemy.burnTickTimer = global.MagicStats.secToFrames(st.dotIntervalSec);
    }
    if (st.bindDurationSec > 0) {
      enemy.applyEffect('stop');
      enemy.bindTimer = Math.max(enemy.bindTimer || 0, global.MagicStats.secToFrames(st.bindDurationSec));
    }
  }

  function getEffectiveVecFromBlocks(blocks) {
    const vecs = blocks.filter((b) => b.type === 'vec');
    return vecs.length ? vecs[vecs.length - 1].val : null;
  }

  load();

  global.MagicInfusion = {
    STORAGE_KEY,
    LEVEL_MIN,
    LEVEL_MAX,
    PCT_PER_LEVEL,
    NUM_PER_LEVEL,
    SEC_PER_LEVEL,
    WAIT_BASE_SEC,
    PULL_BASE_DURATION_SEC,
    MANA_PER_LEVEL,
    BLOCK_DEFS,
    load,
    save,
    getMana,
    addMana,
    setMana,
    rollEnemyDrop,
    grantClearBonus,
    getBlockDef,
    getAllBlockIds,
    getLevel,
    getBlockTotalLevel,
    adjustStat,
    setStatLevel,
    getSetLevelCost,
    applyStat,
    getInfusedCombat,
    getInfusedFieldLifetimeFrames,
    getInfusedProjectileSpeed,
    getInfusedVecMult,
    getInfusedWaitSec,
    getInfusedTrigWaitFrames,
    getInfusedTrigRadiusMult,
    getInfusedPullDurationSec,
    getInfusedPullDurationFrames,
    getInfusedAct,
    getInfusedCtrlRepeatBonus,
    applyInfusedElementHitEffects,
    getEffectiveVecFromBlocks,
    infusionCost,
    manaInvestedForLevel,
    getAdjustDeltaCost,
  };
})(window);
