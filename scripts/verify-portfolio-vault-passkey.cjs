// Native Chrome WebAuthn + virtual authenticator. No actual user credentials.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const modules = Object.fromEntries(['portfolioVaultCrypto', 'portfolioVaultPasskey'].map(name => [
  `/${name}.js`, ts.transpileModule(fs.readFileSync(path.join(root, `src/lib/${name}.ts`), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll("'./portfolioVaultCrypto'", "'/portfolioVaultCrypto.js'"),
]));
const options = {
  protocol: 'ctap2', ctap2Version: 'ctap2_1', transport: 'internal', hasResidentKey: true,
  hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true, hasPrf: true,
};
(async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': modules[req.url] ? 'text/javascript' : 'text/html',
      'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'self'; script-src 'self'" });
    res.end(modules[req.url] ?? '<!doctype html><title>주비 패스키 검증</title><p>합성 기록 · 가상 인증기</p>');
  });
  await new Promise(resolve => server.listen(0, 'localhost', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const origin = `http://localhost:${server.address().port}`;
    let externalRequests = 0;
    const errors = [];
    context.on('request', req => { if (!req.url().startsWith(origin + '/')) externalRequests++; });
    page.on('pageerror', err => errors.push(err.name));
    const cdp = await context.newCDPSession(page);
    await cdp.send('WebAuthn.enable', { enableUI: false });
    const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', { options });
    await page.goto(origin);
    const fixture = await page.evaluate(async () => {
      const v = await import('/portfolioVaultCrypto.js');
      const p = await import('/portfolioVaultPasskey.js');
      const ownerId = '11111111-1111-4111-8111-111111111111';
      const made = await p.createPasskeyPortfolioVault(ownerId);
      const record = await v.encryptPortfolioRecord(made.key, { ownerId, purpose: 'portfolio', revision: 1 },
        new TextEncoder().encode('SYNTHETIC_PRIVATE browser record'));
      return { protectedKey: made.protectedKey, descriptor: made.descriptor, record,
        nonExtractable: !made.key.cryptoKey.extractable, noStorageWrites: localStorage.length === 0 && sessionStorage.length === 0 };
    });
    assert.equal(fixture.nonExtractable, true);
    assert.equal(fixture.noStorageWrites, true);
    // Reload destroys all app memory/keys. Only the authenticator retains its
    // credential; test memory retains the same public envelope a DB would store.
    await page.reload();
    const checks = await page.evaluate(async stored => {
      const v = await import('/portfolioVaultCrypto.js');
      const p = await import('/portfolioVaultPasskey.js');
      const ownerId = '11111111-1111-4111-8111-111111111111';
      const key = await p.unlockPasskeyPortfolioVault(ownerId, stored.protectedKey, stored.descriptor);
      const plaintext = await v.decryptPortfolioRecord(key, { ownerId, purpose: 'portfolio', revision: 1 }, stored.record);
      async function failure(work) { try { await work(); return 'unexpected_success'; } catch (e) { return e.code; } }
      const abort = new AbortController(); abort.abort();
      return {
        reloadUnlocks: new TextDecoder().decode(plaintext) === 'SYNTHETIC_PRIVATE browser record',
        noStorageWrites: localStorage.length === 0 && sessionStorage.length === 0,
        wrongOwner: await failure(() => p.unlockPasskeyPortfolioVault('22222222-2222-4222-8222-222222222222', stored.protectedKey, stored.descriptor)),
        cancelled: await failure(() => p.unlockPasskeyPortfolioVault(ownerId, stored.protectedKey, stored.descriptor, abort.signal)),
        invalidDescriptor: await failure(() => p.unlockPasskeyPortfolioVault(ownerId, stored.protectedKey, { ...stored.descriptor, secret: 'must-not-pass' })),
        tamperedKey: await failure(() => p.unlockPasskeyPortfolioVault(ownerId, { ...stored.protectedKey, wrappedKey: stored.protectedKey.wrappedKey.split('').reverse().join('') }, stored.descriptor)),
      };
    }, fixture);
    assert.equal(checks.reloadUnlocks, true);
    assert.equal(checks.noStorageWrites, true);
    assert.equal(checks.wrongOwner, 'cannot_unlock');
    assert.equal(checks.cancelled, 'cancelled');
    assert.equal(checks.invalidDescriptor, 'invalid_descriptor');
    assert.equal(checks.tamperedKey, 'cannot_unlock');
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId });
    await cdp.send('WebAuthn.addVirtualAuthenticator', { options: { ...options, hasPrf: false } });
    const unsupported = await page.evaluate(async () => {
      const p = await import('/portfolioVaultPasskey.js');
      try { await p.createPasskeyPortfolioVault('11111111-1111-4111-8111-111111111111'); return 'unexpected_success'; }
      catch (e) { return e.code; }
    });
    assert.equal(unsupported, 'unsupported');
    assert.equal(externalRequests, 0);
    assert.deepEqual(errors, []);
    const result = { checkedAt: new Date().toISOString(), browser: await browser.version(),
      syntheticOnly: true, productionChanged: false, nativeWebAuthn: true, virtualAuthenticator: true,
      keyMaterialSaved: false, checks: { ...checks, unsupported }, externalRequests, pageErrors: errors.length,
      limitations: ['Virtual authenticator, same-device reload only', 'Physical Safari/iOS/Android and cross-device synced passkey recovery not tested',
        'Live portfolio hook and UI remain unconnected; no production privacy claim'] };
    const out = path.join(root, 'artifacts/portfolio-vault-rollout-20261029');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'passkey-browser-result.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err.name, err.message); process.exitCode = 1; });
