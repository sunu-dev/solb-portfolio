/* Actual Next boundary + native Chrome WebAuthn/IDB, synthetic account/RPC.
 * Temporary route exists only in the unlinked verification directory.
 */
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const stage = '/private/tmp/joobi-vault-rollout-20261029';
const out = path.join(root, 'artifacts/portfolio-vault-rollout-20261029');
const fixtureRoute = path.join(stage, 'src/app/vault-check');
const ownerId = '11111111-1111-4111-8111-111111111111';
const modules = Object.fromEntries(['portfolioVaultCrypto', 'portfolioVaultPasskey'].map(name => [
  `/${name}.js`, ts.transpileModule(fs.readFileSync(path.join(root, `src/lib/${name}.ts`), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll("'./portfolioVaultCrypto'", "'/portfolioVaultCrypto.js'"),
]));
(async () => {
  assert.ok(!fs.existsSync(path.join(stage, '.vercel')));
  assert.ok(!fs.readdirSync(stage).some(name => name.startsWith('.env')));
  assert.ok(!fs.existsSync(fixtureRoute));
  fs.mkdirSync(fixtureRoute);
  fs.writeFileSync(path.join(fixtureRoute, 'page.tsx'), `import Boundary from '@/components/portfolio/PortfolioVaultBoundary';\nexport default function Page() { return <Boundary ownerId="${ownerId}" />; }\n`);
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const origin = `http://localhost:${port}`;
  const log = fs.openSync(path.join(out, 'vault-ui-next.log'), 'w');
  const server = spawn(process.execPath, [path.join(root, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: stage, stdio: ['ignore', log, log], env: { PATH: process.env.PATH, HOME: process.env.HOME,
      NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', NEXT_PUBLIC_PORTFOLIO_VAULT_READER: 'on',
      NEXT_PUBLIC_SUPABASE_URL: 'https://synthetic-vault.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-public-placeholder' },
  });
  let browser;
  try {
    const deadline = Date.now() + 90_000;
    let ready = false;
    while (Date.now() < deadline) {
      try { if ((await fetch(origin + '/vault-check', { signal: AbortSignal.timeout(20_000) })).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(ready);
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const checks = [];
    for (const width of [320, 390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      let response = { status: 'legacy' };
      const rpcCalls = []; const unexpected = []; const errors = [];
      const internalApiCalls = [];
      const migrationReads = [];
      let migrationRow = null;
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (modules[url.pathname]) return route.fulfill({ contentType: 'text/javascript', body: modules[url.pathname] });
        if (url.hostname === 'synthetic-vault.supabase.co') {
          if (url.pathname === '/rest/v1/user_portfolios' && route.request().method() === 'GET') {
            migrationReads.push(url.searchParams.get('user_id'));
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(migrationRow) });
          }
          if (url.pathname === '/rest/v1/rpc/read_portfolio_vault_v1') {
            rpcCalls.push(route.request().postDataJSON());
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(response) });
          }
          unexpected.push(url.pathname); return route.abort();
        }
        if (url.origin === origin && url.pathname.startsWith('/api/')) { internalApiCalls.push(url.pathname); return route.abort(); }
        if (url.origin === origin) return route.continue();
        return route.fulfill({ contentType: url.pathname.endsWith('.css') ? 'text/css' : 'text/javascript', body: '' });
      });
      const page = await context.newPage();
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/vault-check');
      await page.getByRole('heading', { name: '기존 기록을 먼저 확인해야 해요' }).waitFor().catch(async error => { console.log({ body: await page.locator('body').innerText(), errors, unexpected, rpcCalls }); throw error; });
      assert.equal(await page.getByRole('button', { name: '패스키로 잠금 해제', exact: true }).count(), 0);
      checks.push(`legacy-blocked-${width}`);
      await page.getByRole('button', { name: '기존 기록 확인하기', exact: true }).click();
      await page.getByText('옮길 투자 기록을 찾지 못했어요. 아직 새 보관함을 만들지는 않았어요.', { exact: true }).waitFor();
      assert.deepEqual(migrationReads, [`eq.${ownerId}`]);
      checks.push(`migration-empty-read-only-${width}`);
      migrationRow = { user_id: ownerId, stocks: { investing: [], watching: [], sold: [] },
        daily_snapshots: [], portfolio_history: [], updated_at: '2026-10-30T00:00:00Z', settings: {} };
      const rawLegacy = JSON.stringify({ version: 3, state: { portfolioOwnerId: ownerId, stocks: migrationRow.stocks,
        dailySnapshots: [], portfolioImportHistory: [], customEvents: [], recentSymbols: [],
        lastImportCheckpoint: null, investorType: 'growth', investorTypeSetAt: null } });
      await page.evaluate(raw => localStorage.setItem('solb-portfolio-storage', raw), rawLegacy);
      await page.getByRole('button', { name: '기존 기록 확인하기', exact: true }).click();
      await page.getByText('기기와 서버의 투자 기록이 일치해요. 기록 비교를 마쳤으며, 암호화 전환은 아직 실행하지 않았어요.', { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('solb-portfolio-storage')), rawLegacy);
      assert.deepEqual(migrationReads, [`eq.${ownerId}`, `eq.${ownerId}`]);
      checks.push(`migration-matching-sources-preserved-${width}`);
      await page.evaluate(() => localStorage.removeItem('solb-portfolio-storage'));
      migrationRow = null;
      const cdp = await context.newCDPSession(page);
      await cdp.send('WebAuthn.enable', { enableUI: false });
      await cdp.send('WebAuthn.addVirtualAuthenticator', { options: {
        protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true,
        hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true,
      } });
      response = await page.evaluate(async ownerId => {
        const v = await import('/portfolioVaultCrypto.js');
        const p = await import('/portfolioVaultPasskey.js');
        const made = await p.createPasskeyPortfolioVault(ownerId);
        const payload = { stocks: { investing: [{ symbol: 'PRIVATE_FIXTURE', shares: 3, avgCost: 112.75, targetReturn: 0 }], watching: [], sold: [] }, snapshots: [], history: [],
          privateState: { customEvents: [], recentSymbols: [], lastImportCheckpoint: null, investorType: 'diversified', investorTypeSetAt: null } };
        const record = await v.encryptPortfolioRecord(made.key, { ownerId, purpose: 'portfolio', revision: 1 }, new TextEncoder().encode(JSON.stringify(payload)));
        return { status: 'sealed', revision: 1, record, protectedKey: made.protectedKey, descriptor: made.descriptor };
      }, ownerId);
      const sealed = response;
      response = { status: 'invalid' };
      await page.reload();
      await page.getByRole('heading', { name: '기록을 열지 못했어요' }).waitFor();
      assert.equal(await page.getByText('PRIVATE_FIXTURE', { exact: true }).count(), 0);
      response = sealed;
      await page.getByRole('button', { name: '다시 확인하기', exact: true }).click();
      checks.push(`failed-read-retry-${width}`);
      const unlock = page.getByRole('button', { name: '패스키로 잠금 해제', exact: true });
      await unlock.waitFor();
      assert.equal(await page.getByText('PRIVATE_FIXTURE', { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(out, `vault-locked-${width}.png`), fullPage: true });
      await unlock.focus(); await page.keyboard.press('Enter');
      await page.getByText('PRIVATE_FIXTURE', { exact: true }).waitFor();
      assert.ok(await page.getByText('3주', { exact: true }).isVisible());
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      const raw = await page.evaluate(() => JSON.stringify({ ...localStorage }));
      assert.ok(!raw.includes('PRIVATE_FIXTURE') && !raw.includes('112.75'));
      assert.equal(await page.evaluate(() => localStorage.getItem('solb-portfolio-storage')), null);
      await page.screenshot({ path: path.join(out, `vault-open-${width}.png`), fullPage: true });
      await page.getByRole('button', { name: '기록 잠그기', exact: true }).click();
      await unlock.waitFor();
      assert.equal(await page.getByText('PRIVATE_FIXTURE', { exact: true }).count(), 0);
      await unlock.click(); await page.getByText('PRIVATE_FIXTURE', { exact: true }).waitFor();
      await page.reload(); await unlock.waitFor();
      assert.equal(await page.getByText('PRIVATE_FIXTURE', { exact: true }).count(), 0);
      // Exercise the actual Home/useAuth path with a synthetic locally stored
      // Supabase session. No Kakao/provider login or production account is used.
      await page.evaluate(ownerId => {
        const encode = value => btoa(JSON.stringify(value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
        const exp = Math.floor(Date.now() / 1000) + 3600;
        const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: ownerId, exp, aud: 'authenticated' })}.synthetic`;
        localStorage.setItem('sb-synthetic-vault-auth-token', JSON.stringify({ access_token: token,
          refresh_token: 'synthetic-refresh', expires_at: exp, expires_in: 3600, token_type: 'bearer',
          user: { id: ownerId, aud: 'authenticated', app_metadata: { provider: 'kakao' }, user_metadata: {},
            created_at: '2026-10-30T00:00:00Z' } }));
      }, ownerId);
      await page.goto(origin + '/');
      await unlock.waitFor();
      await unlock.click(); await page.getByText('PRIVATE_FIXTURE', { exact: true }).waitFor();
      await page.getByRole('button', { name: '기록 잠그기', exact: true }).click(); await unlock.waitFor();
      assert.deepEqual(internalApiCalls, []);
      checks.push(`actual-home-auth-boundary-${width}`);
      await page.evaluate(() => localStorage.setItem('solb_portfolio_recovery_v1:fixture', 'SYNTHETIC_OLD_RECORD'));
      const prior = rpcCalls.length;
      await page.reload();
      await page.getByRole('heading', { name: '기존 기록을 먼저 확인해야 해요' }).waitFor();
      assert.equal(rpcCalls.length, prior);
      await page.getByRole('button', { name: '기존 기록 확인하기', exact: true }).click();
      await page.getByText('따로 저장된 복구본이나 메모가 있어요. 이 자료도 빠짐없이 옮길 수 있도록 확인이 필요해요. 원본은 그대로 두었어요.', { exact: true }).waitFor();
      assert.equal(migrationReads.length, 2);
      checks.push(`migration-side-copy-blocks-read-${width}`);
      assert.equal(await page.evaluate(() => localStorage.getItem('solb_portfolio_recovery_v1:fixture')), 'SYNTHETIC_OLD_RECORD');
      assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
      assert.ok(rpcCalls.every(args => Object.keys(args).length === 1 && args.p_user_id === ownerId));
      checks.push(`native-unlock-lock-reopen-reload-${width}`, `no-plaintext-storage-${width}`, `legacy-source-preserved-${width}`, `no-private-network-writes-${width}`);
      await context.close();
    }
    fs.writeFileSync(path.join(out, 'vault-ui-result.json'), JSON.stringify({ checks, productionChanged: false, physicalDeviceTest: false,
      scope: 'Actual Next boundary, native Chrome WebAuthn virtual authenticator and IndexedDB; synthetic RPC and account; temporary fixture route plus actual Home/useAuth with synthetic stored session, not real OAuth integration' }, null, 2) + '\n');
    console.log(`${checks.length} UI checks passed; no production changes`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM'); fs.closeSync(log);
    fs.rmSync(fixtureRoute, { recursive: true, force: true });
    fs.rmSync(path.join(stage, '.next/dev/types'), { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
