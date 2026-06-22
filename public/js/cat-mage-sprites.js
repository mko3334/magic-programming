/**
 * CAT-MAGE sprite sheet — 8×4 grid of 32×32 frames (facing right).
 * Sheet: /assets/cat-mage-sheet.png (256×128)
 */
(function (global) {
  const SHEET_URL = '/assets/cat-mage-sheet.png?v=2';
  const FRAME = 32;
  const COLS = 8;
  const SCALE = 2;
  const FOOT = [17, 29];

  const ROW = { idle: 0, walk: 1, attack: 2, hurt: 3 };
  const HURT_COL = 2;
  const ATTACK_FRAMES = 18;

  const img = new Image();
  let ready = false;
  img.onload = () => { ready = true; };
  img.src = SHEET_URL;

  function pickAnim(player) {
    if (player.animState === 'attack') return 'attack';
    if (player.invincibleTimer > 40) return 'hurt';
    if (player.isMoving) return 'walk';
    return 'idle';
  }

  function pickCol(player, anim, gameFrame) {
    if (anim === 'hurt') return HURT_COL;
    if (anim === 'attack') {
      const t = Math.max(0, player.animTimer || 0);
      const progress = ATTACK_FRAMES - t;
      return Math.min(COLS - 1, Math.floor((progress / ATTACK_FRAMES) * COLS));
    }
    const speed = anim === 'walk' ? 4 : 8;
    return Math.floor(gameFrame / speed) % COLS;
  }

  function draw(ctx, player, gameFrame, cx, cy) {
    if (!ready) return false;

    const anim = pickAnim(player);
    const row = ROW[anim];
    const col = pickCol(player, anim, gameFrame);
    const flip = player.facing === 'left';
    const sx = col * FRAME;
    const sy = row * FRAME;
    const dw = FRAME * SCALE;
    const dh = FRAME * SCALE;
    const anchorX = Math.round(cx - FOOT[0] * SCALE);
    const anchorY = Math.round(cy - FOOT[1] * SCALE);

    if (player.invincibleTimer > 0 && Math.floor(gameFrame / 4) % 2 === 0) {
      ctx.globalAlpha = 0.55;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (flip) {
      ctx.translate(anchorX + dw, anchorY);
      ctx.scale(-1, 1);
      ctx.drawImage(img, sx, sy, FRAME, FRAME, 0, 0, dw, dh);
    } else {
      ctx.drawImage(img, sx, sy, FRAME, FRAME, anchorX, anchorY, dw, dh);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    return true;
  }

  global.CatMageSprites = {
    SHEET_URL,
    FRAME,
    COLS,
    SCALE,
    FOOT,
    draw,
    isReady: () => ready,
  };
})(window);
