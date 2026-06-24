/**
 * Sprout Lands — Basic Character Spritesheet (Cup Nooble)
 * 192×192 sheet, 48×48 frames, 4 directions × 4 walk frames.
 */
(function (global) {
  const SHEET_URL = '/assets/sprout/character.png';
  const FRAME = 48;
  const COLS = 4;
  const SCALE = 2;
  const BASE_TILE_PX = 32;
  const FOOT = [23, 31];

  function pixelScale() {
    const tilePx = global.MAP_TILE_PX || BASE_TILE_PX;
    return (tilePx * 0.42) / FRAME;
  }

  // Rows: down, up, left, right
  const ROW = { down: 0, up: 1, left: 2, right: 3 };

  const img = new Image();
  let ready = false;
  img.onload = () => { ready = true; };
  img.src = SHEET_URL;

  function pickRow(player) {
    return ROW[player.facing] ?? ROW.down;
  }

  function pickCol(player, gameFrame) {
    if (player.animState === 'attack') {
      const t = Math.max(0, player.animTimer || 0);
      const progress = Math.max(0, 18 - t);
      return Math.min(COLS - 1, Math.floor((progress / 18) * COLS));
    }
    if (!player.isMoving) return 0;
    return Math.floor(gameFrame / 6) % COLS;
  }

  function draw(ctx, player, gameFrame, cx, cy) {
    if (!ready) return false;

    const row = pickRow(player);
    const col = pickCol(player, gameFrame);
    const sx = col * FRAME;
    const sy = row * FRAME;
    const ps = pixelScale();
    const dw = FRAME * ps;
    const dh = FRAME * ps;
    const anchorX = Math.round(cx - FOOT[0] * ps);
    const anchorY = Math.round(cy - FOOT[1] * ps);

    if (player.invincibleTimer > 0 && Math.floor(gameFrame / 4) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, sx, sy, FRAME, FRAME, anchorX, anchorY, dw, dh);
    ctx.restore();
    ctx.globalAlpha = 1;
    return true;
  }

  global.SproutPlayerSprites = {
    SHEET_URL,
    FRAME,
    COLS,
    SCALE,
    FOOT,
    ROW,
    draw,
    isReady: () => ready,
  };
})(window);
