const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { chromium } = require('/Users/sunu/.npm/_npx/705bc6b22212b352/node_modules/playwright');
const root = path.resolve(__dirname, '..');
const sources = ['lib/portfolioVaultCrypto', 'lib/portfolioVaultLocal', 'lib/portfolioVaultPayload',
  'lib/portfolioVaultController', 'lib/portfolioVaultSync', 'lib/portfolioVaultPasskey',
  'lib/portfolioVaultRuntime', 'lib/portfolioVaultHandoff', 'lib/portfolioVaultMigration', 'lib/userStorage', 'lib/portfolioIdentity',
  'lib/portfolioSyncOutbox', 'lib/portfolioVaultPolicy', 'lib/portfolioReconciliation', 'config/constants', 'utils/dailySnapshot', 'utils/stockCurrency'];
const modules = Object.fromEntries(sources.map(name => [
  `/src/${name}.js`, ts.transpileModule(fs.readFileSync(path.join(root, `src/${name}.ts`), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replaceAll('process.env.NEXT_PUBLIC_PORTFOLIO_VAULT_READER', "'off'").replace(/from (['"])([^'"]+)\1/g, (_match, _quote, specifier) => {
    const resolved = specifier.startsWith('@/') ? `/src/${specifier.slice(2)}`
      : path.posix.resolve('/src', path.posix.dirname(name), specifier);
    assert.ok(sources.includes(resolved.slice(5)), `unlisted module: ${resolved}`);
    return `from '${resolved}.js'`;
  }),
]));
(async () => {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': modules[req.url] ? 'text/javascript' : 'text/html', 'Cache-Control': 'no-store' });
    res.end(modules[req.url] ?? '<!doctype html><title>암호화 로컬 보관 검증</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const origin = `http://127.0.0.1:${server.address().port}`;
    let externalRequests = 0;
    context.on('request', req => { if (!req.url().startsWith(origin + '/')) externalRequests++; });
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      const v = await import('/src/lib/portfolioVaultCrypto.js');
      const l = await import('/src/lib/portfolioVaultLocal.js');
      const payload = { stocks: { investing: [{ symbol: 'SYNTHETIC_PRIVATE', avgCost: 123.75, shares: 7,
        targetReturn: 20, notes: [{ text: 'synthetic private note', emoji: '📝', date: '2026-10-29' }] }], watching: [], sold: [] }, snapshots: [], history: [],
        privateState: { customEvents: [{ id: 'synthetic-event', name: 'private event', emoji: '📝', startDate: '2026-10-29',
          baseDate: '2026-10-28', endDate: null, description: 'private description', insight: 'private insight', basePrices: {}, baseMacro: {} }],
          recentSymbols: ['SYNTHETIC_PRIVATE'], lastImportCheckpoint: null, investorType: 'growth', investorTypeSetAt: null } };
      const ownerId = '11111111-1111-4111-8111-111111111111';
      const material = crypto.getRandomValues(new Uint8Array(32));
      const made = await v.createPortfolioVaultKey(ownerId, material);
      material.fill(0);
      const local = new l.PortfolioVaultLocal(made.key);
      const competing = new l.PortfolioVaultLocal(made.key);
      const checks = {};
      const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const failure = async work => { try { await work(); return 'unexpected_success'; } catch (e) { return e.code; } };
      checks.emptyIsExplicit = await local.read('outbox') === null;
      const racing = await Promise.all([local.write('outbox', payload, 4, null), competing.write('outbox', payload, 4, null)]);
      checks.twoWritersOneWinner = racing.filter(r => r.status === 'ok').length === 1 && racing.filter(r => r.status === 'conflict').length === 1;
      const first = await local.read('outbox');
      checks.reopensPayload = equal(first.payload, payload);
      const next = await local.write('outbox', payload, 4, first.token);
      checks.staleAcknowledgementPreservesNewEdit = !await competing.acknowledgeOutbox(first.token)
        && (await local.read('outbox')).token === next.token;
      checks.revisionDowngradeRejected = (await local.write('outbox', payload, 3, next.token)).status === 'conflict';
      const otherKey = await v.createPortfolioVaultKey('22222222-2222-4222-8222-222222222222', crypto.getRandomValues(new Uint8Array(32)));
      checks.otherAccountSeesNoRecord = await new l.PortfolioVaultLocal(otherKey.key).read('outbox') === null;
      const replacement = await v.createPortfolioVaultKey(ownerId, crypto.getRandomValues(new Uint8Array(32)));
      checks.wrongKeyCannotRead = (await failure(() => new l.PortfolioVaultLocal(replacement.key).read('outbox'))) === 'cannot_decrypt';
      checks.wrongKeyCannotReplace = (await failure(() => new l.PortfolioVaultLocal(replacement.key).write('outbox', payload, 4, next.token))) === 'invalid_record';
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open(l.PORTFOLIO_VAULT_DB, 1); r.onsuccess = () => resolve(r.result); r.onerror = reject; });
      async function raw(work, mode = 'readonly') {
        return new Promise((resolve, reject) => {
          const tx = db.transaction('records', mode); let output;
          const req = work(tx.objectStore('records')); req.onsuccess = () => { output = req.result; };
          tx.oncomplete = () => resolve(output); tx.onerror = tx.onabort = reject;
        });
      }
      const all = await raw(store => store.getAll());
      const serialized = JSON.stringify(all);
      checks.noPlaintextOrKeysAtRest = !['SYNTHETIC_PRIVATE', 'synthetic private note', 'private event', 'private insight', 'growth', '123.75', 'cryptoKey', 'protectedKey'].some(text => serialized.includes(text));
      // Exercise an actual IDB transaction abort on quota failure. No real disk
      // exhaustion is performed; the native put() fault is injected once.
      const originalPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function () { throw new DOMException('synthetic quota', 'QuotaExceededError'); };
      try { checks.quotaFailureExplicit = (await failure(() => local.write('outbox', payload, 5, next.token))) === 'storage_unavailable'; }
      finally { IDBObjectStore.prototype.put = originalPut; }
      checks.quotaFailurePreservesOldData = (await local.read('outbox')).token === next.token;
      const corrupted = { ...all[0], record: { ...all[0].record, ciphertext: 'bad=' } };
      await raw(store => store.put(corrupted), 'readwrite');
      checks.corruptionIsNotEmpty = (await failure(() => local.read('outbox'))) === 'invalid_record';
      await raw(store => store.put(all[0]), 'readwrite');
      checks.correctAcknowledgementRemovesOnlyOutbox = await local.acknowledgeOutbox(next.token) && await local.read('outbox') === null;
      const pending = local.write('backup', payload, 4, null);
      local.lock();
      checks.lockCancelsPendingEncryptionWrite = (await failure(() => pending)) === 'locked';
      checks.noWriteAfterLock = await competing.read('backup') === null;
      checks.lockPreventsRead = (await failure(() => local.read('outbox'))) === 'locked';
      checks.noLocalStorageCopies = localStorage.length === 0 && sessionStorage.length === 0;
      // Exercise the composed workflow with a deliberately faulting RPC server.
      // Native PostgreSQL permissions are verified separately, not mocked here.
      const { PortfolioVaultController } = await import('/src/lib/portfolioVaultController.js');
      const { sealPortfolioPayload } = await import('/src/lib/portfolioVaultPayload.js');
      const account = crypto.randomUUID();
      const material2 = crypto.getRandomValues(new Uint8Array(32));
      const vault = await v.createPortfolioVaultKey(account, material2);
      const descriptor = { format: 'joobi-webauthn-prf-v1', credentialId: 'YWJj', input: vault.protectedKey.salt };
      let remoteRevision = 1;
      let remoteRecord = await sealPortfolioPayload(vault.key, { ownerId: account, purpose: 'portfolio', revision: 1 }, payload);
      let saveCount = 0;
      let mode = 'normal';
      let saveGate = null;
      let saveStarted = () => {};
      const sent = [];
      const rpc = async (name, args) => {
        sent.push(JSON.stringify({ name, args }));
        if (args.p_user_id !== account) return { data: null, error: { code: '42501' } };
        if (name === 'read_portfolio_vault_v1') return { data: { status: 'sealed', revision: remoteRevision,
          record: remoteRecord, protectedKey: vault.protectedKey, descriptor }, error: null };
        if (name === 'save_portfolio_vault_v1') {
          if (saveGate) { saveStarted(); await saveGate; }
          if (mode === 'offline') throw new Error('synthetic connection loss');
          if (mode === 'disabled') return { data: { status: 'disabled' }, error: null };
          if (args.p_expected_revision !== remoteRevision) return { data: { status: 'conflict' }, error: null };
          remoteRevision++; remoteRecord = args.p_record; saveCount++;
          if (mode === 'lost-response') throw new Error('synthetic loss AFTER commit');
          return { data: { status: 'ok', revision: remoteRevision }, error: null };
        }
        throw new Error('Unexpected RPC, especially a plaintext fallback');
      };
      // This callback deliberately uses a synthetic user secret. Native WebAuthn
      // is separately tested in verify-portfolio-vault-passkey.cjs.
      const unlock = (id, stored) => v.unlockPortfolioVaultKey(id, stored.protectedKey, material2);
      const controller = new PortfolioVaultController(rpc, unlock);
      await controller.open(account);
      const edited = structuredClone(payload); edited.stocks.investing[0].shares = 8;
      await controller.edit(edited);
      checks.controllerPersistsBeforePending = controller.getSnapshot().status === 'pending'
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 8;
      mode = 'lost-response';
      await failure(() => controller.flush());
      checks.ambiguousCommitRetainsEncryptedOutbox = controller.getSnapshot().status === 'unsynced'
        && await new l.PortfolioVaultLocal(vault.key).read('outbox') !== null;
      mode = 'normal';
      await controller.flush();
      checks.ambiguousCommitRecoveredWithoutDuplicateWrite = saveCount === 1 && controller.getSnapshot().status === 'ready'
        && await new l.PortfolioVaultLocal(vault.key).read('outbox') === null;
      const nextEdit = structuredClone(edited); nextEdit.stocks.investing[0].shares = 9;
      await controller.edit(nextEdit);
      mode = 'offline';
      await failure(() => controller.flush());
      controller.lock();
      checks.controllerLockClearsExposedPrivateState = equal(controller.getSnapshot(), { status: 'locked' });
      const reopened = new PortfolioVaultController(rpc, unlock);
      mode = 'normal';
      await reopened.open(account);
      checks.reopenRecoversPendingEncryptedEdit = reopened.getSnapshot().status === 'pending'
        && reopened.getSnapshot().payload.stocks.investing[0].shares === 9;
      // Another device writes different content before this pending edit retries.
      remoteRevision++;
      const competingPayload = structuredClone(edited); competingPayload.stocks.investing[0].shares = 10;
      remoteRecord = await sealPortfolioPayload(vault.key, { ownerId: account, purpose: 'portfolio', revision: remoteRevision }, competingPayload);
      const beforeConflict = saveCount;
      await reopened.flush();
      checks.cloudConflictDoesNotSilentlyOverwrite = reopened.getSnapshot().status === 'conflict' && saveCount === beforeConflict;
      await reopened.resolveConflict('local');
      await reopened.flush();
      checks.explicitConflictChoiceCanSave = reopened.getSnapshot().status === 'ready'
        && saveCount === beforeConflict + 1 && reopened.getSnapshot().payload.stocks.investing[0].shares === 9;
      const incomplete = structuredClone(edited); delete incomplete.privateState;
      checks.controllerRejectsOmittedPersonalState = (await failure(() => reopened.edit(incomplete))) === 'invalid_payload';
      const personalEdit = structuredClone(edited); personalEdit.privateState.customEvents[0].insight = 'new private insight';
      await reopened.edit(personalEdit);
      remoteRevision++;
      remoteRecord = await sealPortfolioPayload(vault.key, { ownerId: account, purpose: 'portfolio', revision: remoteRevision }, edited);
      const beforePersonalConflict = saveCount;
      await reopened.flush();
      checks.personalOnlyConflictPreservesPendingEdit = reopened.getSnapshot().status === 'conflict'
        && reopened.getSnapshot().payload.privateState.customEvents[0].insight === 'new private insight'
        && saveCount === beforePersonalConflict;
      await reopened.resolveConflict('local');
      await reopened.flush();
      const deadline = work => Promise.race([work, new Promise((_, reject) => setTimeout(() => reject(new Error('local operation waited on network')), 3_000))]);
      await reopened.edit(edited);
      let releaseSave;
      saveGate = new Promise(resolve => { releaseSave = resolve; });
      const started = new Promise(resolve => { saveStarted = resolve; });
      const slowSave = reopened.flush();
      await deadline(started);
      const duringNetwork = structuredClone(edited); duringNetwork.stocks.investing[0].shares = 11;
      await deadline(reopened.edit(duringNetwork));
      checks.newEditDurableWhileNetworkStalled = (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 11;
      releaseSave(); saveGate = null;
      await slowSave;
      checks.oldNetworkReplyDoesNotDeleteNewEdit = reopened.getSnapshot().status === 'pending'
        && reopened.getSnapshot().payload.stocks.investing[0].shares === 11
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).revision === remoteRevision + 1;
      await reopened.flush();
      checks.rebasedNewEditEventuallySaves = reopened.getSnapshot().status === 'ready'
        && reopened.getSnapshot().payload.stocks.investing[0].shares === 11;
      await reopened.edit(edited);
      mode = 'disabled';
      await reopened.flush();
      checks.serverDisableLocksViewAndPreservesOutbox = reopened.getSnapshot().status === 'disabled'
        && await new l.PortfolioVaultLocal(vault.key).read('outbox') !== null;
      reopened.lock();

      // Synchronous store changes + real crypto/IDB + real runtime/controller.
      // The store port here is synthetic; the actual Zustand adapter has its own
      // tests. No real auth session or investment data is used.
      const { PortfolioVaultRuntime } = await import('/src/lib/portfolioVaultRuntime.js');
      const { registerPortfolioVaultHandoff, finishPortfolioVaultHandoff } = await import('/src/lib/portfolioVaultHandoff.js');
      const listeners = new Set();
      let uiOwner = account, uiPayload = structuredClone(payload), uiView;
      const notify = () => { for (const listener of listeners) listener(); };
      const port = {
        read: () => ({ ownerId: uiOwner, payload: uiPayload }),
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
        apply: (owner, next) => { if (owner !== uiOwner) throw new Error('wrong owner'); uiPayload = structuredClone(next); notify(); },
        status: (owner, next) => { if (owner === uiOwner) { uiView = next; notify(); } },
        clear: owner => { if (owner === uiOwner) { uiOwner = null; uiPayload = null; notify(); } },
      };
      mode = 'normal';
      const runtimeController = new PortfolioVaultController(rpc, unlock);
      const runtime = new PortfolioVaultRuntime(account, runtimeController, port, 60_000);
      registerPortfolioVaultHandoff(account, runtime);
      await runtime.open();
      const runtimeEdit = structuredClone(uiPayload); runtimeEdit.stocks.investing[0].shares = 12;
      uiPayload = runtimeEdit; notify();
      checks.runtimeMarksUnsavedSynchronously = uiView.localPending === true;
      await runtime.saveLocally();
      checks.runtimeDurableBeforeSavedIndicator = uiView.localPending === false
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 12;
      saveGate = new Promise(resolve => { releaseSave = resolve; });
      const runtimeSaveStarted = new Promise(resolve => { saveStarted = resolve; });
      const runtimeCloud = runtime.flush();
      const runtimeCloudResult = runtimeCloud.catch(error => error.code);
      await deadline(runtimeSaveStarted);
      const latestUiEdit = structuredClone(uiPayload); latestUiEdit.stocks.investing[0].shares = 13;
      uiPayload = latestUiEdit; notify();
      const closeOne = finishPortfolioVaultHandoff(account), closeTwo = finishPortfolioVaultHandoff(account);
      await deadline(Promise.all([closeOne, closeTwo]));
      checks.logoutWaitsForNewestEncryptedEditWithoutNetwork = uiOwner === null && uiPayload === null
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 13;
      checks.logoutLocksControllerAndDetachesStore = runtimeController.getSnapshot().status === 'locked' && listeners.size === 0;
      releaseSave(); saveGate = null;
      await runtimeCloudResult;
      checks.lateResponseCannotRepopulateLoggedOutStore = uiOwner === null && uiPayload === null;

      uiOwner = account; uiPayload = structuredClone(payload);
      const resumedRuntime = new PortfolioVaultRuntime(account, new PortfolioVaultController(rpc, unlock), port, 60_000);
      registerPortfolioVaultHandoff(account, resumedRuntime);
      await resumedRuntime.open();
      checks.reloginRetainsNewestEditAfterAmbiguousOlderCommit = uiPayload.stocks.investing[0].shares === 13
        && resumedRuntime.getSnapshot().status === 'conflict';
      await resumedRuntime.resolveConflict('local');
      await resumedRuntime.flush();
      const quotaEdit = structuredClone(uiPayload); quotaEdit.stocks.investing[0].shares = 14;
      IDBObjectStore.prototype.put = function () { throw new DOMException('synthetic quota', 'QuotaExceededError'); };
      uiPayload = quotaEdit; notify();
      await failure(() => resumedRuntime.saveLocally());
      const quotaClose = await failure(() => finishPortfolioVaultHandoff(account));
      checks.failedDurabilityBlocksLogoutAndRetainsNewestEdit = quotaClose === 'local_save_failed'
        && uiOwner === account && uiPayload.stocks.investing[0].shares === 14 && resumedRuntime.getSnapshot().localError;
      IDBObjectStore.prototype.put = originalPut;
      await finishPortfolioVaultHandoff(account);
      checks.retryCompletesHandoffWithEncryptedEdit = uiOwner === null
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 14;

      uiOwner = account; uiPayload = structuredClone(payload);
      const killController = new PortfolioVaultController(rpc, unlock);
      const killRuntime = new PortfolioVaultRuntime(account, killController, port, 60_000);
      registerPortfolioVaultHandoff(account, killRuntime);
      await killRuntime.open();
      saveGate = new Promise(resolve => { releaseSave = resolve; });
      const killSaveStarted = new Promise(resolve => { saveStarted = resolve; });
      mode = 'disabled';
      const disabledFlush = killRuntime.flush();
      await deadline(killSaveStarted);
      const nativeEncrypt = SubtleCrypto.prototype.encrypt;
      let releaseEncryption;
      const encryptionGate = new Promise(resolve => { releaseEncryption = resolve; });
      SubtleCrypto.prototype.encrypt = async function (...args) { await encryptionGate; return nativeEncrypt.apply(this, args); };
      const duringDisable = structuredClone(uiPayload); duringDisable.stocks.investing[0].shares = 16;
      uiPayload = duringDisable; notify();
      releaseSave(); saveGate = null;
      await disabledFlush;
      checks.disableClosesReaderButWaitsForAcceptedEncryption = uiOwner === account
        && killRuntime.getSnapshot().closing && killRuntime.getSnapshot().localPending;
      releaseEncryption(); SubtleCrypto.prototype.encrypt = nativeEncrypt;
      await deadline(finishPortfolioVaultHandoff(account));
      checks.disableDrainsAcceptedEditBeforeLock = uiOwner === null && killController.getSnapshot().status === 'locked'
        && (await new l.PortfolioVaultLocal(vault.key).read('outbox')).payload.stocks.investing[0].shares === 16;
      checks.rpcNeverContainsInvestmentPlaintext = !sent.some(text => text.includes('SYNTHETIC_PRIVATE') || text.includes('synthetic private note') || text.includes('123.75'));
      // Native Web Locks serialize simultaneous transition intents. No original
      // plaintext source is removed, even after server confirmation.
      const migration = await import('/src/lib/portfolioVaultMigration.js');
      const migrationOwner = crypto.randomUUID();
      const migrationMaterial = crypto.getRandomValues(new Uint8Array(32));
      const migrationKey = await v.createPortfolioVaultKey(migrationOwner, migrationMaterial);
      const migrationDescriptor = { format: 'joobi-webauthn-prf-v1', credentialId: 'YWJj',
        input: btoa(String.fromCharCode(...new Uint8Array(32).fill(2))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '') };
      const intent = { ...migrationKey, descriptor: migrationDescriptor, payload,
        expectedUpdatedAt: '2026-10-30T00:00:00.123456+00:00' };
      localStorage.setItem('solb-portfolio-storage', 'SYNTHETIC_SOURCE_TO_PRESERVE');
      const preparations = await Promise.allSettled([
        migration.preparePortfolioVaultMigration(intent, localStorage),
        migration.preparePortfolioVaultMigration(intent, localStorage),
      ]);
      checks.nativeMigrationLockPreservesFirstIntent = preparations.filter(item => item.status === 'fulfilled').length === 1
        && preparations.filter(item => item.status === 'rejected' && item.reason.code === 'pending_migration').length === 1;
      const journalText = localStorage.getItem(migration.PORTFOLIO_MIGRATION_PREFIX + migrationOwner);
      checks.migrationJournalHidesPortfolioAndCas = !journalText.includes('SYNTHETIC_PRIVATE')
        && !journalText.includes('private description') && !journalText.includes(intent.expectedUpdatedAt);
      let migrationRemote = { status: 'legacy' };
      let migrationWrites = 0;
      const migrationRpc = async (name, args) => {
        if (name === 'read_portfolio_vault_v1') return { data: migrationRemote, error: null };
        migrationWrites++;
        migrationRemote = { status: 'sealed', revision: 1, record: args.p_record,
          protectedKey: args.p_protected_key, descriptor: args.p_descriptor };
        throw new Error('synthetic lost response');
      };
      const migrationUnlock = (id, envelope) => v.unlockPortfolioVaultKey(id, envelope, migrationMaterial);
      const firstCommit = await migration.commitPortfolioVaultMigration(migrationOwner, localStorage, migrationRpc, migrationUnlock);
      const resumedCommit = await migration.commitPortfolioVaultMigration(migrationOwner, localStorage, migrationRpc, migrationUnlock);
      checks.migrationResumesAmbiguousCommitWithoutRewrite = firstCommit.status === 'confirmed'
        && resumedCommit.status === 'confirmed' && migrationWrites === 1;
      checks.migrationKeepsOriginalSourceUntilSeparateCleanup = localStorage.getItem('solb-portfolio-storage') === 'SYNTHETIC_SOURCE_TO_PRESERVE';
      migrationMaterial.fill(0);
      material2.fill(0);
      db.close();
      return checks;
    });
    for (const [check, passed] of Object.entries(result)) assert.equal(passed, true, check);
    assert.equal(externalRequests, 0);
    const out = path.join(root, 'artifacts/portfolio-vault-rollout-20261029');
    fs.mkdirSync(out, { recursive: true });
    const report = { checkedAt: new Date().toISOString(), browser: await browser.version(), checks: result,
      externalRequests, productionChanged: false, syntheticOnly: true,
      limitations: ['Chrome only; physical-device private browsing/quota behavior not verified',
        'Concurrent instances in one page exercise IDB transaction serialization; actual multi-tab integration remains',
        'Controller uses a synthetic RPC for injected failures and synthetic unlock material; DB and native WebAuthn tested separately',
        'Existing Zustand/outbox/recovery paths have not yet been switched or purged'] };
    fs.writeFileSync(path.join(out, 'local-browser-result.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(err => { console.error(err.name, err.message); process.exitCode = 1; });
