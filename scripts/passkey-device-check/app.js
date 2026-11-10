import { registerPortfolioPasskey, createPortfolioVaultUsingPasskey, createPortfolioVaultWithSelectedPasskey, unlockPasskeyPortfolioVault, parsePortfolioPasskeyDescriptor } from './portfolioVaultPasskey.js';
import { encryptPortfolioRecord, decryptPortfolioRecord, parseProtectedPortfolioKey, parseEncryptedPortfolioRecord } from './portfolioVaultCrypto.js';
const byId = id => document.getElementById(id);
const phrase = 'joobi-device-compatibility-synthetic-record-v1';
let fixture = null;
let setup = null;
let busy = false;
let startedAt = 0;
function encode(value) { return btoa(JSON.stringify(value)).replaceAll('+','-').replaceAll('/','_').replaceAll('=',''); }
function parse(value) {
  if (!value || typeof value !== 'object' || Object.keys(value).length !== 5 || value.version !== 1
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.ownerId)) throw new Error('invalid_fixture');
  const record = parseEncryptedPortfolioRecord(value.record);
  const protectedKey = parseProtectedPortfolioKey(value.protectedKey);
  if (record.keyId !== protectedKey.keyId) throw new Error('invalid_fixture');
  return { version:1, ownerId:value.ownerId, record, protectedKey, descriptor:parsePortfolioPasskeyDescriptor(value.descriptor) };
}
function showFixture(created = false) {
  byId('create').hidden = true;
  byId('existing').hidden = true;
  byId('finish').hidden = true;
  byId('verify').hidden = false;
  byId('transfer').hidden = false;
  byId('step-title').textContent = created ? 'Mac 준비 완료' : '이 기기에서 복원 확인';
  byId('explanation').textContent = created ? '패스키를 만들었어요. 이제 아래 링크를 iPhone으로 보내주세요.' : 'Mac에서 만든 패스키로 시험용 기록을 열어주세요. Apple 암호에서 동기화한 패스키를 선택해주세요.';
  byId('link').value = location.href;
}
function failure(error) {
  const code = ['unsupported','cancelled','not_allowed','cannot_unlock','cannot_decrypt','credential_failed','invalid_descriptor','invalid_fixture'].includes(error?.code || error?.message) ? (error.code || error.message) : 'check_failed';
  const stage = error?.operation === 'get' ? '패스키 사용' : error?.operation === 'create' ? '패스키 생성' : '기록 확인';
  const elapsed = startedAt ? Math.round((performance.now() - startedAt) / 1000) : 0;
  const detail = `${stage} / ${code} / ${elapsed}초`;
  byId('status').textContent = code === 'not_allowed'
    ? `패스키 인증을 완료하지 못했어요. 패스키를 찾지 못했거나 시간이 지난 경우에도 나오는 오류로, 직접 취소했다는 뜻은 아니에요. (${detail})`
    : code === 'cancelled' ? `인증 요청이 중단됐어요. 직접 취소했다는 뜻은 아니에요. (${detail})`
      : `이 기기에서 확인을 마치지 못했어요. 이 문구를 대화에 알려주세요. (${detail})`;
}
function setBusy(value) {
  busy = value; if (value) startedAt = performance.now();
  for (const id of ['create','existing','finish','verify']) byId(id).disabled = value;
}
function showSetup() {
  byId('create').hidden = true; byId('existing').hidden = true; byId('finish').hidden = false;
  byId('step-title').textContent = '패스키 저장 완료';
  byId('explanation').textContent = '아래 버튼을 눌러 방금 만든 패스키를 한 번 더 사용해주세요. 시험 기록을 준비한 뒤 iPhone으로 보낼 수 있어요.';
}
async function makeFixture(ownerId, made) {
  const bytes = new TextEncoder().encode(phrase);
  let record;
  try { record = await encryptPortfolioRecord(made.key, { ownerId, purpose:'portfolio', revision:1 }, bytes); } finally { bytes.fill(0); }
  fixture = parse({ version:1, ownerId, protectedKey:made.protectedKey, descriptor:made.descriptor, record });
  history.replaceState(null, '', `${location.pathname}#trial=${encode(fixture)}`);
  setup = null; showFixture(true); byId('status').textContent = '시험 기록 준비 완료';
}
byId('create').addEventListener('click', async () => {
  if (busy) return;
  setBusy(true); byId('status').textContent = '기기의 패스키 저장 안내를 따라주세요.';
  try {
    const ownerId = crypto.randomUUID();
    const descriptor = await registerPortfolioPasskey();
    setup = { ownerId, descriptor };
    // Public descriptor only; keeps a failed second ceremony resumable without
    // registering duplicate credentials. Never contains PRF output or a key.
    history.replaceState(null, '', `${location.pathname}#setup=${encode(setup)}`);
    showSetup(); byId('status').textContent = '패스키 저장 성공. 다음 버튼으로 계속해주세요.';
  } catch (error) { failure(error); }
  finally { setBusy(false); }
});
byId('finish').addEventListener('click', async () => {
  if (busy || !setup) return;
  setBusy(true); byId('status').textContent = '기기의 패스키 안내를 따라주세요.';
  try {
    const { ownerId, descriptor } = setup;
    const made = await createPortfolioVaultUsingPasskey(ownerId, descriptor);
    await makeFixture(ownerId, made);
  } catch (error) { failure(error); }
  finally { setBusy(false); }
});
byId('existing').addEventListener('click', async () => {
  if (busy || fixture) return;
  setBusy(true); byId('status').textContent = 'Apple 암호에 저장한 시험용 패스키를 선택해주세요.';
  try {
    const ownerId = crypto.randomUUID();
    // Exactly one user-triggered get(), with no registration or prior await.
    const made = await createPortfolioVaultWithSelectedPasskey(ownerId);
    await makeFixture(ownerId, made);
  } catch (error) { failure(error); }
  finally { setBusy(false); }
});
byId('verify').addEventListener('click', async () => {
  if (busy || !fixture) return;
  setBusy(true); byId('status').textContent = '기기의 패스키 안내를 따라주세요.'; byId('result').hidden = true;
  try {
    const key = await unlockPasskeyPortfolioVault(fixture.ownerId, fixture.protectedKey, fixture.descriptor);
    const bytes = await decryptPortfolioRecord(key, { ownerId:fixture.ownerId, purpose:'portfolio', revision:1 }, fixture.record);
    let matches;
    try { matches = new TextDecoder().decode(bytes) === phrase; } finally { bytes.fill(0); }
    if (!matches) throw new Error('invalid_fixture');
    byId('status').textContent = '패스키 사용·암호문 복호화·내용 일치 확인 완료';
    byId('result').hidden = false;
  } catch (error) { failure(error); }
  finally { setBusy(false); }
});
byId('copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(location.href); byId('status').textContent = '링크를 복사했어요. iPhone Safari에서 열어주세요.'; }
  catch { byId('link').focus(); byId('link').select(); byId('status').textContent = '아래 링크를 직접 복사하거나 Safari 공유 메뉴의 AirDrop을 이용해주세요.'; }
});
if (location.hash) {
  try {
    const isSetup = location.hash.startsWith('#setup=');
    if ((!isSetup && !location.hash.startsWith('#trial=')) || location.hash.length > 12_000) throw new Error('invalid_fixture');
    const text = location.hash.slice(7);
    if (!/^[A-Za-z0-9_-]+$/.test(text)) throw new Error('invalid_fixture');
    const data = JSON.parse(atob(text.replaceAll('-','+').replaceAll('_','/')));
    if (isSetup) {
      if (!data || Object.keys(data).length !== 2 || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.ownerId)) throw new Error('invalid_fixture');
      setup = { ownerId:data.ownerId, descriptor:parsePortfolioPasskeyDescriptor(data.descriptor) };
      showSetup();
    } else { fixture = parse(data); showFixture(); }
  } catch (error) {
    for (const id of ['create','existing','finish','verify']) byId(id).hidden = true;
    failure(error);
  }
}
