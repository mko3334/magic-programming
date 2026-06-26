const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const logs = [];
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on('pageerror', err => {
    logs.push(`[PAGE ERROR] ${err.message}\nStack:\n${err.stack}`);
  });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await page.click('#tab-create');
  await new Promise(r => setTimeout(r, 1000));

  // 1. カスタム敵を作成・登録する
  await page.evaluate(() => {
    const nameInput = document.getElementById('custom-enemy-name');
    const hpInput = document.getElementById('custom-enemy-hp');
    const speedSelect = document.getElementById('custom-enemy-speed');
    const sizeSelect = document.getElementById('custom-enemy-size');
    
    nameInput.value = 'ボススライム';
    hpInput.value = '100';
    speedSelect.value = '0.5';
    sizeSelect.value = '32';
  });

  // 「敵を登録する」ボタンをクリック
  await page.click('#btn-create-custom-enemy');
  await new Promise(r => setTimeout(r, 1000));
  console.log("Registered custom enemy: ボススライム");

  // パレットに追加されているか確認
  const customEnemyToolKey = await page.evaluate(() => {
    const tools = document.querySelectorAll('.create-tool-item');
    for (const t of tools) {
      if (t.dataset.tool && t.dataset.tool.startsWith('custom_enemy_')) {
        const input = t.querySelector('input');
        if (input && input.value.includes('ボススライム')) {
          t.click(); // パレットから選択
          return t.dataset.tool;
        }
      }
    }
    return null;
  });
  console.log("Selected custom enemy tool:", customEnemyToolKey);

  // 2. Canvas上の (5, 5) に配置
  const canvasRect = await page.evaluate(() => {
    const c = document.getElementById('createCanvas');
    const r = c.getBoundingClientRect();
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  });

  const gridW = 32;
  const gridH = 32;
  const targetX = canvasRect.x + (5 * gridW) + gridW / 2;
  const targetY = canvasRect.y + (5 * gridH) + gridH / 2;

  await page.mouse.click(targetX, targetY);
  await new Promise(r => setTimeout(r, 500));
  console.log("Placed custom enemy at (5, 5)");

  // 2.5. カスタムタイルを「敵キャラ」としてインポートして配置する
  console.log("Starting custom tile enemy import test...");
  await page.evaluate(() => {
    // ダミーのCanvasを作成して openCopyImportModal を呼び出す
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 64, 64);
    
    // コピーインポートモーダルを開く
    window.openCopyImportModal(canvas, 1, 1);
  });
  await new Promise(r => setTimeout(r, 500));

  // モーダル内で種別ボタンをクリックして「敵キャラ」にする
  await page.evaluate(() => {
    const typeBtn = document.querySelector('#tile-sheet-grid button.w-full.text-\\[10px\\]');
    if (typeBtn) {
      // 1回目のクリックで 'prop' -> 'enemy' に切り替わるはず（デフォルトは prop）
      typeBtn.click();
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // インポート実行をクリック
  await page.click('#btn-tile-sheet-confirm');
  await new Promise(r => setTimeout(r, 1000));
  console.log("Imported custom tile enemy");

  // パレットからインポートしたカスタムタイル（enemy）のツールキーを探して選択
  const customTileEnemyToolKey = await page.evaluate(() => {
    // 敵コンテナ内にあるカスタムタイル敵ツールを探す
    const container = document.getElementById('custom-enemies-container');
    const tools = container.querySelectorAll('.create-tool-item');
    for (const t of tools) {
      if (t.dataset.tool && t.dataset.tool.startsWith('custom_tile_')) {
        t.click();
        return t.dataset.tool;
      }
    }
    return null;
  });
  console.log("Selected custom tile enemy tool:", customTileEnemyToolKey);

  // Canvas上の (6, 6) に配置
  const targetX2 = canvasRect.x + (6 * gridW) + gridW / 2;
  const targetY2 = canvasRect.y + (6 * gridH) + gridH / 2;
  await page.mouse.click(targetX2, targetY2);
  await new Promise(r => setTimeout(r, 500));
  console.log("Placed custom tile enemy at (6, 6)");

  // 3. マップデータを検証する
  const assertion = await page.evaluate(() => {
    const mapData = window.createMapData;
    // 最初の敵 (5, 5) のカスタム敵
    const enemy1 = mapData && mapData.enemies && mapData.enemies.find(e => Math.floor(e.x / 32) === 5 && Math.floor(e.y / 32) === 5);
    const customEnemyId = enemy1 ? enemy1.customEnemyId : null;
    const customEnemyData = customEnemyId ? mapData.customEnemies.find(e => e.id === customEnemyId) : null;

    // 二番目の敵 (6, 6) のカスタムタイル敵
    const enemy2 = mapData && mapData.enemies && mapData.enemies.find(e => Math.floor(e.x / 32) === 6 && Math.floor(e.y / 32) === 6);
    const customTileEnemyId = enemy2 ? enemy2.customTileEnemyId : null;
    const customTileData = customTileEnemyId ? window.customTilesMap[customTileEnemyId] : null;

    return {
      mapDataRaw: mapData,
      hasEnemy1: !!enemy1,
      customEnemyId: customEnemyId,
      customEnemyName: customEnemyData ? customEnemyData.name : null,
      customEnemyHp: customEnemyData ? customEnemyData.maxHp : null,
      customEnemySpeed: customEnemyData ? customEnemyData.speed : null,
      customEnemyRadius: customEnemyData ? customEnemyData.radius : null,

      hasEnemy2: !!enemy2,
      customTileEnemyId: customTileEnemyId,
      customTileName: customTileData ? customTileData.name : null,
      customTileType: customTileData ? customTileData.type : null
    };
  });

  console.log("Assertion result:", JSON.stringify(assertion, null, 2));

  if (assertion.hasEnemy1 && assertion.customEnemyName === 'ボススライム' && assertion.customEnemyHp === 100 &&
      assertion.hasEnemy2 && assertion.customTileEnemyId && assertion.customTileType === 'enemy') {
    console.log("SUCCESS: Both custom enemy and custom tile enemy data are correctly saved and linked in map data!");
  } else {
    console.error("FAIL: Custom enemy or custom tile enemy assertion failed.", assertion);
  }

  await page.screenshot({ path: 'debug_enemy_result.png' });
  console.log("Saved debug_enemy_result.png");

  console.log("\n--- CONSOLE LOGS ---");
  logs.forEach(l => console.log(l));

  await browser.close();
})();
