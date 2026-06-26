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

  // 3. マップデータを検証する
  const assertion = await page.evaluate(() => {
    // デバッグ用にデータを直接取得
    const mapData = window.createMapData;
    const enemy = mapData && mapData.enemies && mapData.enemies[0];
    const customEnemyId = enemy ? enemy.customEnemyId : null;
    const customEnemyData = customEnemyId ? mapData.customEnemies.find(e => e.id === customEnemyId) : null;
    
    return {
      mapDataRaw: mapData,
      hasEnemy: !!enemy,
      customEnemyId: customEnemyId,
      customEnemyName: customEnemyData ? customEnemyData.name : null,
      customEnemyHp: customEnemyData ? customEnemyData.maxHp : null,
      customEnemySpeed: customEnemyData ? customEnemyData.speed : null,
      customEnemyRadius: customEnemyData ? customEnemyData.radius : null
    };
  });

  console.log("Assertion result:", JSON.stringify(assertion, null, 2));

  if (assertion.hasEnemy && assertion.customEnemyName === 'ボススライム' && assertion.customEnemyHp === 100 && assertion.customEnemySpeed === 0.5 && assertion.customEnemyRadius === 32) {
    console.log("SUCCESS: Custom enemy data is correctly saved and linked in map data!");
  } else {
    console.error("FAIL: Custom enemy assertion failed.", assertion);
  }

  await page.screenshot({ path: 'debug_enemy_result.png' });
  console.log("Saved debug_enemy_result.png");

  console.log("\n--- CONSOLE LOGS ---");
  logs.forEach(l => console.log(l));

  await browser.close();
})();
