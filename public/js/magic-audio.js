/**
 * BGM / SE — /assets/audio/ 配下 + audio-config.json + localStorage
 */
(function (global) {
  const STORAGE_KEY = 'pop-magic-audio-v1';

  /** @type {{ bgm: Record<string, {label:string,file:string,volume?:number,loop?:boolean}>, se: Record<string, {label:string,file:string,volume?:number}> }} */
  let config = { bgm: {}, se: {} };

  /** @type {{ bgmVolume:number, seVolume:number, bgmMuted:boolean, seMuted:boolean, selectedBgm:string }} */
  let settings = {
    bgmVolume: 0.5,
    seVolume: 0.8,
    bgmMuted: false,
    seMuted: false,
    selectedBgm: 'field',
  };

  let currentBgmId = null;
  let bgmEl = null;
  let configLoaded = false;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.bgmVolume === 'number') settings.bgmVolume = parsed.bgmVolume;
      if (typeof parsed.seVolume === 'number') settings.seVolume = parsed.seVolume;
      if (typeof parsed.bgmMuted === 'boolean') settings.bgmMuted = parsed.bgmMuted;
      if (typeof parsed.seMuted === 'boolean') settings.seMuted = parsed.seMuted;
      if (typeof parsed.selectedBgm === 'string') settings.selectedBgm = parsed.selectedBgm;
    } catch (_) { /* ignore */ }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function hasStoredOverride() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  function normalizeUrl(url) {
    return String(url || '').normalize('NFD');
  }

  function getBgmEntry(id) {
    return config.bgm[id] || null;
  }

  function getSeEntry(id) {
    return config.se[id] || null;
  }

  function effectiveBgmVolume(id) {
    const entry = getBgmEntry(id);
    const base = entry?.volume ?? 0.5;
    if (settings.bgmMuted) return 0;
    return Math.max(0, Math.min(1, settings.bgmVolume * base));
  }

  function effectiveSeVolume(id) {
    const entry = getSeEntry(id);
    const base = entry?.volume ?? 0.8;
    if (settings.seMuted) return 0;
    return Math.max(0, Math.min(1, settings.seVolume * base));
  }

  function getBgmElement() {
    if (!bgmEl) {
      bgmEl = new Audio();
      bgmEl.loop = true;
      bgmEl.preload = 'auto';
    }
    return bgmEl;
  }

  function applyBgmVolume() {
    if (!bgmEl || !currentBgmId) return;
    bgmEl.volume = effectiveBgmVolume(currentBgmId);
  }

  async function loadConfig() {
    loadSettings();
    try {
      const res = await fetch('/data/audio-config.json');
      if (res.ok) {
        config = await res.json();
        if (!getBgmEntry(settings.selectedBgm)) {
          settings.selectedBgm = Object.keys(config.bgm)[0] || 'field';
        }
      }
    } catch (_) { /* fallback below */ }

    if (!Object.keys(config.bgm).length) {
      config.bgm = {
        field: { label: 'フィールド', file: '/assets/audio/BGM/フィールド.mp3', volume: 0.5, loop: true },
      };
    }
    if (!Object.keys(config.se).length) {
      config.se = {
        cast: { label: '魔法発動', file: '/assets/audio/SE/魔法発動.mp3', volume: 0.8 },
      };
    }
    configLoaded = true;
  }

  function playBgm(id) {
    const bgmId = id || settings.selectedBgm;
    const entry = getBgmEntry(bgmId);
    if (!entry) return;
    const url = normalizeUrl(entry.file);
    const el = getBgmElement();
    el.loop = entry.loop !== false;
    if (currentBgmId === bgmId && !el.paused) {
      applyBgmVolume();
      return;
    }
    currentBgmId = bgmId;
    el.src = url;
    el.volume = effectiveBgmVolume(bgmId);
    el.play().catch(() => {});
  }

  function pauseBgm() {
    if (bgmEl) bgmEl.pause();
  }

  function stopBgm() {
    if (!bgmEl) return;
    bgmEl.pause();
    bgmEl.currentTime = 0;
    currentBgmId = null;
  }

  function playSe(id) {
    const entry = getSeEntry(id);
    if (!entry) return;
    const el = new Audio(normalizeUrl(entry.file));
    el.volume = effectiveSeVolume(id);
    el.play().catch(() => {});
  }

  function getSettings() {
    return { ...settings };
  }

  function getBgmCatalog() {
    return { ...config.bgm };
  }

  function getSeCatalog() {
    return { ...config.se };
  }

  function setBgmVolume(v) {
    settings.bgmVolume = Math.max(0, Math.min(1, Number(v)));
    saveSettings();
    applyBgmVolume();
  }

  function setSeVolume(v) {
    settings.seVolume = Math.max(0, Math.min(1, Number(v)));
    saveSettings();
  }

  function setBgmMuted(muted) {
    settings.bgmMuted = !!muted;
    saveSettings();
    applyBgmVolume();
  }

  function setSeMuted(muted) {
    settings.seMuted = !!muted;
    saveSettings();
  }

  function setSelectedBgm(id) {
    if (!getBgmEntry(id)) return;
    settings.selectedBgm = id;
    saveSettings();
  }

  function resetSettings() {
    localStorage.removeItem(STORAGE_KEY);
    settings = {
      bgmVolume: 0.5,
      seVolume: 0.8,
      bgmMuted: false,
      seMuted: false,
      selectedBgm: Object.keys(config.bgm)[0] || 'field',
    };
    applyBgmVolume();
  }

  function previewBgm() {
    playBgm(settings.selectedBgm);
  }

  function previewSe(id = 'cast') {
    playSe(id);
  }

  loadSettings();

  global.MagicAudio = {
    STORAGE_KEY,
    loadConfig,
    playBgm,
    pauseBgm,
    stopBgm,
    playSe,
    getSettings,
    getBgmCatalog,
    getSeCatalog,
    setBgmVolume,
    setSeVolume,
    setBgmMuted,
    setSeMuted,
    setSelectedBgm,
    resetSettings,
    hasStoredOverride,
    previewBgm,
    previewSe,
    isConfigLoaded: () => configLoaded,
  };
})(window);
