/* CIPHER VAULT 自动化截图验证 */
const path = require('path');
const pw = require('playwright-core');

const CHROME = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1232\\chrome-win64\\chrome.exe';
const HTML = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const OUT = path.resolve(__dirname, '..', 'screenshots');

(async () => {
  const browser = await pw.chromium.launch({
    executablePath: CHROME,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-color-profile=srgb']
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });

  // 1. 锁屏（首次设置密码）
  await page.goto(HTML);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '01-lock-setup.png') });

  // 2. 注入演示数据并解锁 → 仪表盘
  await page.evaluate(() => window.__vault.seed());
  await page.evaluate(() => window.__vault.unlock());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, '02-dashboard.png') });

  // 3. 卡密库
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, '03-library.png') });

  // 4. 发布页
  await page.evaluate(() => { location.hash = '#/publish'; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, '04-publish.png') });

  // 5. 验证器：取一张有效卡密验证
  await page.evaluate(() => { location.hash = '#/verify'; });
  await page.waitForTimeout(400);
  const key = await page.evaluate(() => {
    const cards = JSON.parse(localStorage.getItem('ciphervault.cards.v1') || '[]');
    const c = cards.find(x => !x.revoked && !x.expiresAt && !x.usedAt) || cards[0];
    return c ? c.key : '';
  });
  if (key) {
    await page.fill('#verifyInput', key);
    await page.click('#btnVerify');
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, '05-verify.png') });
  }

  // 6. 数据管理
  await page.evaluate(() => { location.hash = '#/data'; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(OUT, '06-data.png') });

  // 7. 移动端仪表盘
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { location.hash = '#/dashboard'; });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, '07-mobile.png') });

  // 8. 移动端卡密库
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(OUT, '08-mobile-library.png') });

  console.log('JS_ERRORS=' + (errors.length ? '\n' + errors.join('\n') : 'none'));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
