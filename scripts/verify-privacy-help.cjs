/* Actual Next help route, isolated verified source, synthetic auth configuration.
 * No production environment, authenticated sessions, or feedback submissions.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const { chromium } = require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const stage = '/private/tmp/joobi-vault-rollout-20261029';
const out = path.join(root, 'artifacts/portfolio-vault-rollout-20261029');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  assert.ok(!fs.existsSync(path.join(stage, '.vercel')));
  assert.ok(!fs.readdirSync(stage).some(name => name.startsWith('.env')));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const log = fs.openSync(path.join(out, 'help-next.log'), 'w');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'),
    'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: stage, stdio: ['ignore', log, log], env: {
      PATH: process.env.PATH, HOME: process.env.HOME, NODE_ENV: 'development',
      NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic.invalid',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-placeholder',
    },
  });
  let browser;
  try {
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (server.exitCode !== null) throw new Error('local Next server exited; inspect help-next.log');
      try {
        const response = await fetch(origin + '/help', { signal: AbortSignal.timeout(25_000) });
        if (response.ok) { ready = true; break; }
        if (response.status >= 500) throw new Error('help route failed');
      } catch (error) { if (error.message === 'help route failed') throw error; }
      await pause(500);
    }
    assert.ok(ready, 'help route readiness');
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const results = [];
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const suppressedExternalHosts = new Set();
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        suppressedExternalHosts.add(url.hostname);
        // External font/Kakao scripts are irrelevant to Q&A. Never contact them.
        return route.fulfill({ status: 200, contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const writes = [];
      page.on('request', request => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(new URL(request.url()).pathname); });
      await page.goto(origin + '/help#privacy', { waitUntil: 'networkidle' });
      const privacy = page.locator('#privacy');
      assert.equal(await privacy.locator('details').count(), 7);
      assert.equal(await privacy.locator('details[open]').count(), 0);
      const questions = privacy.locator('summary');
      for (let index = 0; index < 7; index++) {
        const question = questions.nth(index);
        await question.focus();
        await page.keyboard.press(index % 2 ? 'Space' : 'Enter');
        assert.equal(await privacy.locator('details').nth(index).getAttribute('open'), '');
        assert.ok(await privacy.locator('details').nth(index).locator('p').isVisible());
        await page.keyboard.press(index % 2 ? 'Space' : 'Enter');
      }
      await questions.nth(1).click();
      await questions.nth(2).click();
      assert.ok((await privacy.innerText()).includes('아직 적용되지는 않았어요'));
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `horizontal overflow at ${width}`);
      await privacy.screenshot({ path: path.join(out, `help-privacy-${width}.png`) });
      assert.deepEqual(errors, []);
      assert.deepEqual(writes, []);
      results.push({ width, questions: 7, keyboardOpenClose: true, horizontalOverflow: false,
        pageErrors: errors, applicationWrites: writes, suppressedExternalHosts: [...suppressedExternalHosts] });
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'help-browser-result.json'), JSON.stringify({
      checkedAt: new Date().toISOString(), browser: browser.version(), results,
      productionChanged: false, authenticatedFlowTested: false,
      limitations: ['Synthetic auth configuration; Q&A display and native disclosure behavior only',
        'External font and Kakao scripts suppressed; fallback system font used', 'Feedback was not sent'],
    }, null, 2) + '\n');
    console.log('Help Q&A: 320/390/1440px, seven keyboard disclosures, no overflow/page error/application write.');
  } finally {
    await browser?.close();
    server.kill('SIGTERM');
    await Promise.race([new Promise(resolve => server.once('exit', resolve)), pause(3_000)]);
    if (server.exitCode === null) server.kill('SIGKILL');
    fs.closeSync(log);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
