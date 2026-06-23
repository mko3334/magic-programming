/**
 * スマホ向けタッチ操作（左：仮想スティック / 右：魔法ボタン）
 */
(function (global) {
  const RADIUS = 56;
  const DEADZONE = 0.14;

  const state = {
    enabled: false,
    visible: false,
    active: false,
    pointerId: null,
    originX: 0,
    originY: 0,
    x: 0,
    y: 0,
    onCast: null,
  };

  let zoneEl = null;
  let baseEl = null;
  let stickEl = null;
  const magicEls = {};

  function isMobileContext() {
    const coarse = global.matchMedia('(pointer: coarse)').matches;
    const narrowPortrait = global.innerWidth < 900 && global.innerHeight > global.innerWidth;
    const touch = (global.navigator.maxTouchPoints || 0) > 0;
    return coarse || (touch && narrowPortrait);
  }

  function clampStick(dx, dy) {
    const dist = Math.hypot(dx, dy);
    if (dist <= RADIUS) return { dx, dy };
    return { dx: (dx / dist) * RADIUS, dy: (dy / dist) * RADIUS };
  }

  function placeJoystick(clientX, clientY) {
    if (!baseEl) return;
    baseEl.classList.remove('is-hidden');
    baseEl.style.left = `${clientX}px`;
    baseEl.style.top = `${clientY}px`;
    stickEl.style.transform = 'translate(-50%, -50%)';
  }

  function hideJoystick() {
    if (!baseEl) return;
    baseEl.classList.add('is-hidden');
    stickEl.style.transform = 'translate(-50%, -50%)';
  }

  function updateStickVisual(dx, dy) {
    if (!stickEl) return;
    stickEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  }

  function onZonePointerDown(e) {
    if (!state.enabled || !state.visible) return;
    if (e.pointerType === 'mouse' && !global.matchMedia('(pointer: coarse)').matches) return;
    e.preventDefault();
    state.active = true;
    state.pointerId = e.pointerId;
    state.originX = e.clientX;
    state.originY = e.clientY;
    state.x = 0;
    state.y = 0;
    placeJoystick(e.clientX, e.clientY);
    zoneEl.setPointerCapture(e.pointerId);
  }

  function onZonePointerMove(e) {
    if (!state.active || e.pointerId !== state.pointerId) return;
    e.preventDefault();
    let dx = e.clientX - state.originX;
    let dy = e.clientY - state.originY;
    const clamped = clampStick(dx, dy);
    dx = clamped.dx;
    dy = clamped.dy;
    state.x = dx / RADIUS;
    state.y = dy / RADIUS;
    updateStickVisual(dx, dy);
  }

  function endJoystick(e) {
    if (e && e.pointerId !== state.pointerId) return;
    state.active = false;
    state.pointerId = null;
    state.x = 0;
    state.y = 0;
    hideJoystick();
    if (zoneEl && e) {
      try { zoneEl.releasePointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    }
  }

  function onMagicPointerDown(e, slot) {
    if (!state.enabled || !state.visible) return;
    e.preventDefault();
    e.currentTarget.classList.add('is-pressed');
    if (typeof state.onCast === 'function') state.onCast(slot);
  }

  function onMagicPointerUp(e) {
    e.currentTarget.classList.remove('is-pressed');
  }

  function bindElements() {
    zoneEl = document.getElementById('mobile-joystick-zone');
    baseEl = document.getElementById('mobile-joystick-base');
    stickEl = document.getElementById('mobile-joystick-stick');
    ['z', 'x', 'c'].forEach((slot) => {
      magicEls[slot] = document.getElementById(`mobile-magic-${slot}`);
    });
    if (!zoneEl || !baseEl || !stickEl) return false;

    zoneEl.addEventListener('pointerdown', onZonePointerDown);
    zoneEl.addEventListener('pointermove', onZonePointerMove);
    zoneEl.addEventListener('pointerup', endJoystick);
    zoneEl.addEventListener('pointercancel', endJoystick);

    Object.entries(magicEls).forEach(([slot, btn]) => {
      if (!btn) return;
      btn.addEventListener('pointerdown', (e) => onMagicPointerDown(e, slot));
      btn.addEventListener('pointerup', onMagicPointerUp);
      btn.addEventListener('pointercancel', onMagicPointerUp);
      btn.addEventListener('pointerleave', onMagicPointerUp);
    });
    return true;
  }

  function init(options) {
    options = options || {};
    if (!isMobileContext()) return false;
    if (!bindElements()) return false;

    state.enabled = true;
    state.onCast = options.onCast || null;
    document.body.classList.add('mobile-mode');
    return true;
  }

  function setVisible(visible) {
    state.visible = !!visible && state.enabled;
    const panel = document.getElementById('mobile-controls');
    if (!panel) return;
    panel.classList.toggle('is-active', state.visible);
    if (!state.visible) endJoystick();
  }

  function getMoveVector() {
    if (!state.enabled || !state.visible || !state.active) {
      return { active: false, x: 0, y: 0 };
    }
    const mag = Math.hypot(state.x, state.y);
    if (mag < DEADZONE) return { active: true, x: 0, y: 0 };
    return { active: true, x: state.x / mag, y: state.y / mag, rawX: state.x, rawY: state.y };
  }

  function updateMagicLabels(labels) {
    ['z', 'x', 'c'].forEach((slot) => {
      const btn = magicEls[slot];
      if (!btn) return;
      const label = labels && labels[slot] ? labels[slot] : '未登録';
      const textEl = btn.querySelector('.mobile-magic-label');
      if (textEl) textEl.textContent = label;
    });
  }

  global.MobileControls = {
    init,
    setVisible,
    getMoveVector,
    updateMagicLabels,
    isEnabled: () => state.enabled,
    isVisible: () => state.visible,
    isMobileContext,
  };
})(window);
