/* 调试：解锁流程 */
const path = require('path');
const pw = require('playwright-core');
const CHROME = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1232\\chrome-win64\\chrome.exe';
const HTML = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

(async () => {
  const browser = await pw.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  page.on('console', m => console.log('CONSOLE[' + m.type() + ']:', m.text()));

  await page.goto(HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#lockPwd', '1234');
  await page.fill('#lockPwd2', '1234');
  await page.click('#lockBtn');
  await page.waitForTimeout(600);
  console.log('1 after-setup  lock.class =', await page.evaluate(() => document.querySelector('#lock').className));

  await page.click('#btnLockNow');
  await page.waitForTimeout(400);
  console.log('2 after-lock    lock.class =', await page.evaluate(() => document.querySelector('#lock').className));

  await page.fill('#lockPwd', '0000');
  await page.click('#lockBtn');
  await page.waitForTimeout(400);
  console.log('3 wrong-pwd msg =', await page.textContent('#lockMsg'));

  await page.fill('#lockPwd', '1234');
  console.log('4 pwd value     =', await page.inputValue('#lockPwd'));
  await page.click('#lockBtn');
  await page.waitForTimeout(600);
  console.log('5 after-unlock  lock.class =', await page.evaluate(() => document.querySelector('#lock').className));
  console.log('6 auth ls       =', await page.evaluate(() => localStorage.getItem('ciphervault.auth.v1')));
  console.log('7 hash match    =', await page.evaluate(() => {
    const a = JSON.parse(localStorage.getItem('ciphervault.auth.v1'));
    return sha256(a.salt + ':' + '1234') === a.hash;
  }));
  await browser.close();
})().catch(e => { console.error('FATAL', e); process.exit(1); });
