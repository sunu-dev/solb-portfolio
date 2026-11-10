/** Fresh browser contexts, public navigation only. No portfolio/account mutations. */
const { chromium } = require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const origin = process.env.MARKET_CAUSE_ORIGIN || 'https://joobi.kr';
const out = path.resolve('artifacts/market-cause-expansion-20261031/browser', origin.includes('localhost') ? 'local' : 'production');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true }); const checks = [];
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } }); const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      const more = page.getByRole('button', { name: '시장 소식과 이후 변화 더 보기', exact: true });
      await more.waitFor({ timeout: 60000 }); await more.click();
      const official = page.locator('[data-official-policy]'); await official.waitFor({ timeout: 45000 });
      await page.waitForFunction(() => document.querySelectorAll('[data-official-policy] article').length === 2);
      assert.equal(await official.locator('article').count(), 2);
      await official.getByText('내 투자와 어떻게 이어지나요?', { exact: true }).first().click();
      assert.ok(await official.getByRole('heading', { name: '영향이 전달되는 과정', exact: true }).first().isVisible());
      assert.ok(await official.locator('a').first().getAttribute('href').then(u => /^https:\/\/www\.(bok\.or\.kr|federalreserve\.gov)/.test(u)));
      await official.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, `report-${width}.png`) });
      const watch = page.locator('[data-market-watch]').filter({ has: official });
      await watch.getByRole('button', { name: '한국', exact: true }).click();
      assert.equal(await official.locator('article').count(), 1); assert.match(await official.innerText(), /한국은행/);
      await watch.getByRole('button', { name: '미국', exact: true }).click();
      assert.equal(await official.locator('article').count(), 1); assert.match(await official.innerText(), /미국 연준/);
      const disclosure = official.locator('summary').first(); await disclosure.focus();
      const before = await official.locator('details').first().getAttribute('open');
      await page.keyboard.press('Enter');
      assert.notEqual(await official.locator('details').first().getAttribute('open'), before);
      if (await official.locator('details').first().getAttribute('open') === null) await disclosure.click();
      await page.getByRole('button', { name: '다크 모드로 전환', exact: true }).click();
      await official.scrollIntoViewIfNeeded();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(out, `report-dark-${width}.png`) });
      checks.push(`keyboard-disclosure-${width}`, `dark-mode-layout-${width}`);
      await watch.getByRole('button', { name: '산업별', exact: true }).click();
      assert.equal(await page.locator('[data-official-policy]').count(), 0);
      assert.deepEqual(errors, []);
      checks.push(`public-policy-detail-${width}`, `official-source-link-${width}`, `market-filters-${width}`, `no-overflow-${width}`, `no-browser-errors-${width}`);
      await page.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), origin, checks }, null, 2));
  console.log(JSON.stringify({ origin, checks }));
})().catch(error => { console.error(error); process.exitCode = 1; });
