/* CIPHER VAULT 全流程功能测试：真实点击 + 断言 */
const path = require('path');
const pw = require('playwright-core');

const CHROME = 'C:\\Users\\Administrator\\AppData\\Local\\ms-playwright\\chromium-1232\\chrome-win64\\chrome.exe';
const HTML = 'file:///' + path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/');

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

  // ---- 初始化：清数据、设密码、解锁 ----
  await page.goto(HTML);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.fill('#lockPwd', '1234');
  await page.fill('#lockPwd2', '1234');
  await page.click('#lockBtn');
  await page.waitForTimeout(600);
  check('首次设置密码并解锁', !(await page.$('#lock.hidden')) === false && await page.$('#lock.hidden') !== null);

  const cards = () => page.evaluate(() => JSON.parse(localStorage.getItem('ciphervault.cards.v1') || '[]'));

  // ---- 1. 发布 3 张永久卡密 ----
  await page.evaluate(() => { location.hash = '#/publish'; });
  await page.fill('#pubPrefix', 'TEST');
  await page.fill('#pubCount', '3');
  await page.fill('#pubSegs', '3');
  await page.fill('#pubSegLen', '4');
  await page.click('.radio-c[data-mode="permanent"]');
  await page.click('#btnPublish');
  await page.waitForTimeout(300);
  await page.click('#mOk'); // 关闭成功弹窗
  await page.waitForTimeout(200);
  let c = await cards();
  check('发布 3 张卡密', c.length === 3, 'got ' + c.length);
  check('卡密格式正确', c.every(x => /^TEST-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(x.key)), c.map(x => x.key).join(','));
  check('卡密互不重复', new Set(c.map(x => x.key)).size === 3);

  // ---- 2. 截止日期模式（过去日期 → 已过期） ----
  await page.click('.radio-c[data-mode="until"]');
  await page.fill('#pubUntil', '2020-01-01');
  await page.fill('#pubCount', '1');
  await page.click('#btnPublish');
  await page.waitForTimeout(200);
  await page.click('#mOk');
  c = await cards();
  const expiredCard = c.find(x => x.expiresAt);
  check('截止日期模式写入 expiresAt', !!expiredCard && expiredCard.expiresAt < Date.now());

  // ---- 3. 首用后 N 天模式 ----
  await page.click('.radio-c[data-mode="firstuse"]');
  await page.fill('#pubDays', '30');
  await page.click('#btnPublish');
  await page.waitForTimeout(200);
  await page.click('#mOk');
  c = await cards();
  const fuCard = c.find(x => x.durationDays === 30 && !x.expiresAt);
  check('首用 N 天模式写入 durationDays', !!fuCard);

  // ---- 4. 卡密库渲染 & 搜索 ----
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  let rows = await page.$$('#libBody tr');
  check('卡密库显示 5 行', rows.length === 5, 'got ' + rows.length);
  await page.fill('#libSearch', fuCard.key.slice(0, 8));
  await page.waitForTimeout(200);
  rows = await page.$$('#libBody tr');
  check('搜索过滤生效', rows.length === 1, 'got ' + rows.length);
  await page.fill('#libSearch', '');

  // ---- 5. 撤回 + 恢复 ----
  const firstId = (await cards())[0].id;
  await page.click(`[data-act="revoke"][data-id="${firstId}"]`);
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  c = await cards();
  check('撤回后 revoked=true', c[0].revoked === true);
  const revokedRowText = await page.evaluate(id => {
    const tr = document.querySelector('#libBody tr[data-id="' + id + '"]');
    return tr ? tr.querySelector('.badge').textContent : '';
  }, firstId);
  check('列表显示已撤回徽章', revokedRowText.includes('已撤回'), revokedRowText);
  await page.click(`[data-act="restore"][data-id="${firstId}"]`);
  await page.waitForTimeout(200);
  c = await cards();
  check('恢复后 revoked=false', c[0].revoked === false);

  // ---- 6. 验证器：有效 / 不存在 / 撤回 / 过期 / 首用 ----
  await page.evaluate(() => { location.hash = '#/verify'; });
  await page.waitForTimeout(300);
  const validCard = (await cards()).find(x => !x.revoked && !x.expiresAt && !x.durationDays && !x.usedAt);

  await page.fill('#verifyInput', validCard.key);
  await page.click('#btnVerify');
  await page.waitForTimeout(300);
  check('验证：有效卡密 → 卡密有效', (await page.textContent('#verifyResult')).includes('卡密有效'));

  await page.fill('#verifyInput', 'NOPE-0000-0000-0000');
  await page.click('#btnVerify');
  await page.waitForTimeout(200);
  check('验证：不存在 → 卡密不存在', (await page.textContent('#verifyResult')).includes('卡密不存在'));

  const revoked = (await cards()).find(x => x.revoked);
  if (revoked) {
    await page.fill('#verifyInput', revoked.key);
    await page.click('#btnVerify');
    await page.waitForTimeout(200);
    check('验证：已撤回 → 不可用+已被撤回', (await page.textContent('#verifyResult')).includes('已被管理员撤回'));
  }

  await page.fill('#verifyInput', expiredCard.key);
  await page.click('#btnVerify');
  await page.waitForTimeout(200);
  check('验证：已过期 → 已过有效期', (await page.textContent('#verifyResult')).includes('已过有效期'));

  await page.fill('#verifyInput', fuCard.key);
  await page.click('#btnVerify');
  await page.waitForTimeout(300);
  const vr = await page.textContent('#verifyResult');
  check('验证：首用 N 天 → 有效+剩余 30 天', vr.includes('卡密有效') && vr.includes('30 天'), vr.slice(0, 80));
  c = await cards();
  check('验证后自动写入 usedAt', c.find(x => x.id === fuCard.id).usedAt > 0);

  // ---- 7. 导出 JSON → 校验内容 ----
  await page.evaluate(() => { location.hash = '#/data'; });
  await page.waitForTimeout(300);
  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btnExportJson')
  ]);
  const dlPath = path.join(__dirname, '..', 'screenshots', 'export-test.json');
  await dl.saveAs(dlPath);
  const exported = JSON.parse(require('fs').readFileSync(dlPath, 'utf8'));
  check('导出 JSON 含全部卡密', exported.cards.length === 5 && exported.app === 'CIPHER VAULT');

  // ---- 8. 导入 JSON（合并去重） ----
  const importData = {
    app: 'CIPHER VAULT', version: 1,
    cards: [
      { key: 'TEST-AAAA-BBBB-CCCC', note: '导入测试·新卡' },
      { key: exported.cards[0].key, note: '导入测试·重复卡' }
    ]
  };
  await page.setInputFiles('#importFile', {
    name: 'import.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(importData))
  });
  await page.waitForTimeout(400);
  c = await cards();
  check('导入合并：新增 1 张跳过 1 张', c.length === 6, 'got ' + c.length);
  check('导入的卡密备注正确', c.find(x => x.key === 'TEST-AAAA-BBBB-CCCC').note === '导入测试·新卡');

  // ---- 9. 批量撤回 ----
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  await page.click('#chkAll');
  await page.click('#btnBatchRevoke');
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  c = await cards();
  check('批量撤回全部勾选卡密', c.every(x => x.revoked === true));

  // ---- 10. 删除单张 ----
  const delId = c[0].id;
  await page.click(`[data-act="del"][data-id="${delId}"]`);
  await page.waitForTimeout(200);
  await page.click('#mOk');
  await page.waitForTimeout(200);
  c = await cards();
  check('删除单张卡密', c.length === 5 && !c.find(x => x.id === delId));

  // ---- 11. 自动锁定 ----
  await page.click('#btnLockNow');
  await page.waitForTimeout(300);
  check('立即锁定显示锁屏', await page.$('#lock:not(.hidden)') !== null);
  await page.fill('#lockPwd', '0000');
  await page.click('#lockBtn');
  await page.waitForTimeout(200);
  check('错误密码不解锁', (await page.textContent('#lockMsg')).includes('密码错误'));
  await page.fill('#lockPwd', '1234');
  await page.click('#lockBtn');
  await page.waitForTimeout(400);
  check('正确密码解锁', await page.$('#lock.hidden') !== null);

  // ---- 12. 编辑卡密 ----
  await page.evaluate(() => { location.hash = '#/library'; });
  await page.waitForTimeout(300);
  const edId = (await cards())[0].id;
  await page.click(`[data-act="edit"][data-id="${edId}"]`);
  await page.waitForTimeout(200);
  await page.fill('#edNote', '编辑后的备注');
  await page.selectOption('#edMode', 'firstuse');
  await page.fill('#edDays', '99');
  await page.click('#mOk');
  await page.waitForTimeout(200);
  c = await cards();
  const edited = c.find(x => x.id === edId);
  check('编辑备注+有效期规则', edited.note === '编辑后的备注' && edited.durationDays === 99);

  console.log('\nJS_PAGE_ERRORS=' + (errors.length ? errors.join(' | ') : 'none'));
  const failed = results.filter(r => !r.ok);
  console.log('SUMMARY: ' + (results.length - failed.length) + '/' + results.length + ' passed');
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
