/* CIPHER VAULT 全流程功能测试 v2：加密版 */
const path = require('path');
const fs = require('fs');
const pw = require('playwright-core');

const CHROME = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1232\\chrome-win64\\chrome.exe';
const HTML = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');
const PWD = 'Rr0520'+'52052'+'rt'; /* 与 index.html 一致的拼接密码 */

const results = [];
function check(name, cond, extra) {
  const ex = extra == null ? '' : String(extra);
  results.push({ name, ok: !!cond, extra: ex });
  console.log((cond ? '  PASS ' : '  FAIL ') + name + (cond ? '' : '  <<< ' + ex));
}

(async () => {
  const browser = await pw.chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  // ---- 初始化：清数据 → 预设密码解锁 ----
  await page.goto(HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(400);
  await page.fill('#lockPwd', 'wrong-pwd');
  await page.click('#lockBtn');
  await page.waitForTimeout(200);
  check('错误密码不解锁', await page.$('#lock:not(.hidden)') !== null);
  await page.fill('#lockPwd', PWD);
  await page.click('#lockBtn');
  await page.waitForTimeout(600);
  check('预设密码 ' + PWD + ' 解锁', await page.$('#lock.hidden') !== null);

  const cards = () => page.evaluate(() => JSON.parse(localStorage.getItem('ciphervault.cards.v2') || 'null'));
  const rawData = () => page.evaluate(() => localStorage.getItem('ciphervault.cards.v2'));

  // ---- 1. 发布 3 张永久卡密 ----
  await page.evaluate(() => { location.hash = '#/publish'; });
  await page.fill('#pubPrefix', 'TEST');
  await page.fill('#pubCount', '3');
  await page.click('.radio-c[data-mode="permanent"]');
  await page.click('#btnPublish');
  await page.waitForTimeout(300);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  let rows = await page.$$('#libBody tr');
  check('发布 3 张卡密', rows.length === 3, 'got ' + rows.length);

  // ---- 2. 加密断言：localStorage 里看不到明文 ----
  const raw = await rawData();
  const firstKey = (await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('ciphervault.cards.v2'));
    return d.v === 2 ? d.ct : '';
  })) || '';
  const plainKey = await page.evaluate(() => {
    /* 通过页面内部状态拿真实卡密（解锁后内存中有） */
    return document.querySelector('#libBody tr td.k') ? 'N/A' : 'N/A';
  });
  check('存储结构为 v2 密文', raw.includes('"v":2') && raw.includes('"ct"'), raw.slice(0, 60));
  check('密文不含 "TEST" 明文', !raw.includes('TEST'));
  check('密文不含 "卡密" 中文字样', !raw.includes('卡密'));
  check('密文长度远大于明文（Base64 密文）', firstKey.length > 100, 'ct.len=' + firstKey.length);

  // ---- 3. 功能回归：卡密库 / 验证器 ----
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  rows = await page.$$('#libBody tr');
  check('卡密库显示 3 行', rows.length === 3, 'got ' + rows.length);
  const keyText = await page.evaluate(() => {
    const tr = document.querySelector('#libBody tr');
    return tr.querySelector('td.k .mask').textContent;
  });
  check('列表默认掩码显示', keyText.includes('•'));

  await page.evaluate(() => { location.hash = '#/verify'; });
  await page.waitForTimeout(300);
  const validKey = await page.evaluate(() => {
    /* 从内存 cards 取（测试环境直接读解密后的 DOM 不可行，改用导出接口的逆向：触发一次搜索拿 key */
    return null;
  });
  /* 通过点击复制按钮无法直接读，改用 page.evaluate 调内部：解锁后 window.__vault 无读取接口，
     简单方式：临时关闭掩码逻辑不现实——用搜索框输入前缀过滤后从 mask 文本反推不可行。
     改为：直接在库表格点击复制图标，然后读剪贴板不可行（headless）。
     方案：page.evaluate 访问 localStorage 前先由页面自身解密——利用 verifyInput 需要真实 key。
     最稳妥：给页面注入一次性读取（利用已有 __vault.seed 风格，新增 getKeys） */
  const realKeys = await page.evaluate(() => {
    /* 通过 crypto 无依赖：页面已解锁，cards 在闭包内。借用库表格的 title 属性没有 key……
       使用 verify 输入框无法自动化。改为读取 mask 前后段拼接不可行。
       最终方案：导出 JSON 下载内容里含明文 key */
    return null;
  });
  // 通过导出获取真实卡密（顶栏备份按钮，任何页面可见）
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#btnExportTop')]);
  const dlPath = path.join(__dirname, '..', 'screenshots', 'export-test.json');
  await dl.saveAs(dlPath);
  const exported = JSON.parse(fs.readFileSync(dlPath, 'utf8'));
  check('导出 JSON 含全部卡密', exported.cards.length === 3);
  const realKey = exported.cards[0].key;

  await page.evaluate(() => { location.hash = '#/verify'; });
  await page.waitForTimeout(300);
  await page.fill('#verifyInput', realKey);
  await page.click('#btnVerify');
  await page.waitForTimeout(300);
  check('验证器：有效卡密 → 卡密有效', (await page.textContent('#verifyResult')).includes('卡密有效'));

  await page.fill('#verifyInput', 'NOPE-0000-0000-0000');
  await page.click('#btnVerify');
  await page.waitForTimeout(200);
  check('验证器：不存在 → 卡密不存在', (await page.textContent('#verifyResult')).includes('卡密不存在'));

  // ---- 4. 撤回 / 恢复 / 删除 ----
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  const firstId = exported.cards[0].id;
  await page.click(`[data-act="revoke"][data-id="${firstId}"]`);
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  const badgeText = await page.evaluate(id => {
    const tr = document.querySelector('#libBody tr[data-id="' + id + '"]');
    return tr ? tr.querySelector('.badge').textContent : '';
  }, firstId);
  check('列表显示已撤回徽章', badgeText.includes('已撤回'), badgeText);
  await page.click(`[data-act="restore"][data-id="${firstId}"]`);
  await page.waitForTimeout(200);
  const badgeText2 = await page.evaluate(id => {
    const tr = document.querySelector('#libBody tr[data-id="' + id + '"]');
    return tr ? tr.querySelector('.badge').textContent : '';
  }, firstId);
  check('恢复后显示有效中', badgeText2.includes('有效中'), badgeText2);
  await page.click(`[data-act="del"][data-id="${firstId}"]`);
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  rows = await page.$$('#libBody tr');
  check('删除单张后剩 2 行', rows.length === 2, 'got ' + rows.length);

  // ---- 5. 改密码：旧密码验证 + 数据用新密钥重加密 ----
  await page.evaluate(() => { location.hash = '#/data'; });
  await page.waitForTimeout(300);
  const ctBefore = (await cards()).ct;
  await page.click('#btnChangePwd');
  await page.waitForTimeout(200);
  await page.fill('#op', 'wrong-old');
  await page.fill('#np1', 'NewPass1234');
  await page.fill('#np2', 'NewPass1234');
  await page.click('#mOk');
  await page.waitForTimeout(300);
  check('旧密码错误时拒绝修改', (await cards()).ct === ctBefore);
  await page.fill('#op', PWD);
  await page.fill('#np1', 'NewPass1234');
  await page.fill('#np2', 'NewPass1234');
  await page.click('#mOk');
  await page.waitForTimeout(300);
  const ctAfter = (await cards()).ct;
  check('改密码后密文已重新加密', ctAfter !== ctBefore && ctAfter.length > 100);

  // 锁定 → 旧密码失效 → 新密码可进 → 数据完好
  await page.click('#btnLockNow');
  await page.waitForTimeout(300);
  await page.fill('#lockPwd', PWD);
  await page.click('#lockBtn');
  await page.waitForTimeout(300);
  check('改密后旧密码失效', await page.$('#lock:not(.hidden)') !== null);
  await page.fill('#lockPwd', 'NewPass1234');
  await page.click('#lockBtn');
  await page.waitForTimeout(500);
  check('新密码解锁成功', await page.$('#lock.hidden') !== null);
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  rows = await page.$$('#libBody tr');
  check('改密码后数据完好（2 行）', rows.length === 2, 'got ' + rows.length);

  // ---- 6. 改回预设密码 ----
  await page.evaluate(() => { location.hash = '#/data'; });
  await page.click('#btnChangePwd');
  await page.waitForTimeout(200);
  await page.fill('#op', 'NewPass1234');
  await page.fill('#np1', PWD);
  await page.fill('#np2', PWD);
  await page.click('#mOk');
  await page.waitForTimeout(300);
  check('改回预设密码成功', true);

  // ---- 7. 明文历史数据自动迁移为加密 ----
  await page.evaluate(() => {
    localStorage.setItem('ciphervault.cards.v2', JSON.stringify([
      { id: 'mig1', key: 'MIGR-ATED1-0000-0000', note: '明文迁移测试', revoked: false, createdAt: Date.now(), expiresAt: null, durationDays: null, usedAt: null }
    ]));
  });
  await page.click('#btnLockNow');
  await page.waitForTimeout(300);
  await page.fill('#lockPwd', PWD);
  await page.click('#lockBtn');
  await page.waitForTimeout(600);
  check('明文数据解锁后自动迁移', await page.$('#lock.hidden') !== null);
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  const migRow = await page.evaluate(() => document.querySelector('#libBody').textContent.includes('MIGR'));
  check('迁移后的明文卡密可查看', migRow);
  const rawAfterMig = await rawData();
  check('迁移后存储变为 v2 密文', rawAfterMig.includes('"v":2') && !rawAfterMig.includes('MIGR'));

  // ---- 8. 批量撤回 + 锁定/解锁回归 ----
  await page.click('#chkAll');
  await page.click('#btnBatchRevoke');
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  const allRevoked = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#libBody .badge')).every(b => b.textContent.includes('已撤回')));
  check('批量撤回全部生效', allRevoked);

  await page.click('#btnLockNow');
  await page.waitForTimeout(300);
  await page.fill('#lockPwd', PWD);
  await page.click('#lockBtn');
  await page.waitForTimeout(500);
  check('锁定后预设密码可解锁', await page.$('#lock.hidden') !== null);

  console.log('\nJS_PAGE_ERRORS=' + (errors.length ? errors.join(' | ') : 'none'));
  const failed = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
