import { createDecipheriv, hkdfSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createPortfolioVaultKey, decryptPortfolioRecord, encryptPortfolioRecord,
  MAX_PORTFOLIO_PLAINTEXT_BYTES, parseEncryptedPortfolioRecord,
  PORTFOLIO_KEY_FORMAT, PORTFOLIO_RECORD_FORMAT, rewrapPortfolioVaultKey,
  unlockPortfolioVaultKey, type PortfolioRecordContext,
} from '@/lib/portfolioVaultCrypto';

const ownerId = 'vault-test-owner';
const context: PortfolioRecordContext = { ownerId, purpose: 'portfolio', revision: 1 };
const plaintext = new TextEncoder().encode('비공개 투자 메모 · synthetic fixture');
const secret = () => crypto.getRandomValues(new Uint8Array(32));
const corrupt = (text: string) => {
  const bytes = Buffer.from(text, 'base64url');
  bytes[0] ^= 1;
  return bytes.toString('base64url');
};

describe('portfolio vault: actual Web Crypto boundaries', () => {
  it('unlocks on a separate key handle and exposes no extractable data key', async () => {
    const material = secret();
    const { key, protectedKey } = await createPortfolioVaultKey(ownerId, material);
    const encrypted = await encryptPortfolioRecord(key, context, plaintext);
    const reopened = await unlockPortfolioVaultKey(ownerId, JSON.parse(JSON.stringify(protectedKey)), material);
    expect(await decryptPortfolioRecord(reopened, context, encrypted)).toEqual(plaintext);
    expect(key.cryptoKey.extractable).toBe(false);
    expect(reopened.cryptoKey.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key.cryptoKey)).rejects.toThrow();
    expect(Object.isFrozen(key)).toBe(true);
    expect(Object.keys(protectedKey).sort()).toEqual(['format', 'keyId', 'salt', 'wrappedKey']);
    expect(Object.keys(encrypted).sort()).toEqual(['ciphertext', 'format', 'iv', 'keyId']);
    expect(JSON.stringify(encrypted)).not.toContain('비공개');
    expect(JSON.stringify(protectedKey)).not.toContain(Buffer.from(material).toString('base64url'));
  });

  it('uses independent random keys, wrapping salts and IVs', async () => {
    const material = secret();
    const first = await createPortfolioVaultKey(ownerId, material);
    const second = await createPortfolioVaultKey(ownerId, material);
    const one = await encryptPortfolioRecord(first.key, context, plaintext);
    const two = await encryptPortfolioRecord(first.key, context, plaintext);
    expect(first.key.id).not.toBe(second.key.id);
    expect(first.protectedKey.salt).not.toBe(second.protectedKey.salt);
    expect(first.protectedKey.wrappedKey).not.toBe(second.protectedKey.wrappedKey);
    expect(one.iv).not.toBe(two.iv);
    expect(one.ciphertext).not.toBe(two.ciphertext);
    expect(Buffer.from(one.iv, 'base64url')).toHaveLength(12);
  });

  it('interoperates with independent Node/OpenSSL HKDF, AES-KW and AES-GCM', async () => {
    const material = secret();
    const { key, protectedKey } = await createPortfolioVaultKey(ownerId, material);
    const record = await encryptPortfolioRecord(key, context, plaintext);
    const kek = hkdfSync('sha256', material, Buffer.from(protectedKey.salt, 'base64url'),
      Buffer.from(JSON.stringify([PORTFOLIO_KEY_FORMAT, ownerId, protectedKey.keyId])), 32);
    const unwrap = createDecipheriv('id-aes256-wrap', Buffer.from(kek), Buffer.alloc(8, 0xa6));
    const rawKey = Buffer.concat([unwrap.update(Buffer.from(protectedKey.wrappedKey, 'base64url')), unwrap.final()]);
    const encrypted = Buffer.from(record.ciphertext, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', rawKey, Buffer.from(record.iv, 'base64url'));
    decipher.setAAD(Buffer.from(JSON.stringify([PORTFOLIO_RECORD_FORMAT, ownerId, key.id, 'portfolio', 1])));
    decipher.setAuthTag(encrypted.subarray(-16));
    expect(Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()])).toEqual(Buffer.from(plaintext));
    rawKey.fill(0);
  });

  it.each(['owner', 'secret', 'id', 'salt', 'wrappedKey'] as const)('rejects a wrong/tampered key %s', async field => {
    const material = secret();
    const { protectedKey } = await createPortfolioVaultKey(ownerId, material);
    const changed = { ...protectedKey };
    if (field === 'id') changed.keyId = corrupt(changed.keyId);
    if (field === 'salt') changed.salt = corrupt(changed.salt);
    if (field === 'wrappedKey') changed.wrappedKey = corrupt(changed.wrappedKey);
    await expect(unlockPortfolioVaultKey(field === 'owner' ? 'other-owner' : ownerId,
      changed, field === 'secret' ? secret() : material)).rejects.toMatchObject({ code: 'cannot_unlock' });
  });

  it.each(['ciphertext', 'iv'] as const)('rejects modified %s with a valid envelope shape', async field => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    const record = await encryptPortfolioRecord(key, context, plaintext);
    await expect(decryptPortfolioRecord(key, context, { ...record, [field]: corrupt(record[field]) }))
      .rejects.toMatchObject({ code: 'cannot_decrypt' });
  });

  it.each(['purpose', 'revision', 'owner'] as const)('authenticates %s instead of trusting storage metadata', async field => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    const record = await encryptPortfolioRecord(key, context, plaintext);
    const next = { ...context };
    if (field === 'purpose') next.purpose = 'backup';
    if (field === 'revision') next.revision = 2;
    if (field === 'owner') next.ownerId = 'other-owner';
    // Even relabelling the JS handle cannot bypass account binding in the GCM tag.
    await expect(decryptPortfolioRecord({ ...key, ownerId: next.ownerId }, next, record))
      .rejects.toMatchObject({ code: 'cannot_decrypt' });
  });

  it('rejects another data key even if its public key ID is relabelled', async () => {
    const first = await createPortfolioVaultKey(ownerId, secret());
    const second = await createPortfolioVaultKey(ownerId, secret());
    const record = await encryptPortfolioRecord(first.key, context, plaintext);
    await expect(decryptPortfolioRecord(second.key, context, record)).rejects.toMatchObject({ code: 'cannot_decrypt' });
    await expect(decryptPortfolioRecord({ ...second.key, id: first.key.id }, context, record))
      .rejects.toMatchObject({ code: 'cannot_decrypt' });
  });

  it('rewraps for a new unlock mechanism without changing the data key', async () => {
    const previous = secret();
    const next = secret();
    const { key, protectedKey } = await createPortfolioVaultKey(ownerId, previous);
    const record = await encryptPortfolioRecord(key, context, plaintext);
    const changed = await rewrapPortfolioVaultKey(ownerId, protectedKey, previous, next);
    expect(changed.keyId).toBe(protectedKey.keyId);
    expect(changed.salt).not.toBe(protectedKey.salt);
    expect(changed.wrappedKey).not.toBe(protectedKey.wrappedKey);
    const reopened = await unlockPortfolioVaultKey(ownerId, changed, next);
    expect(await decryptPortfolioRecord(reopened, context, record)).toEqual(plaintext);
    await expect(unlockPortfolioVaultKey(ownerId, changed, previous)).rejects.toMatchObject({ code: 'cannot_unlock' });
    // Rewrapping is not revocation: an old envelope plus the old secret still works.
    expect(await unlockPortfolioVaultKey(ownerId, protectedKey, previous)).toMatchObject({ id: key.id });
  });

  it('does not rewrap without the previous unlock material', async () => {
    const { protectedKey } = await createPortfolioVaultKey(ownerId, secret());
    await expect(rewrapPortfolioVaultKey(ownerId, protectedKey, secret(), secret()))
      .rejects.toMatchObject({ code: 'cannot_unlock' });
  });

  it.each([0, 8, 16, 31, 33])('rejects %i-byte inputs rather than using short passwords as keys', async length => {
    await expect(createPortfolioVaultKey(ownerId, new Uint8Array(length)))
      .rejects.toMatchObject({ code: 'invalid_unlock_material' });
  });

  it.each([0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid revision %s', async revision => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    await expect(encryptPortfolioRecord(key, { ...context, revision }, plaintext))
      .rejects.toMatchObject({ code: 'invalid_context' });
  });

  it('rejects an owner mismatch, invalid purpose and malformed owner ID', async () => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    await expect(encryptPortfolioRecord(key, { ...context, ownerId: 'other-owner' }, plaintext))
      .rejects.toMatchObject({ code: 'invalid_key' });
    await expect(encryptPortfolioRecord(key, { ...context, purpose: 'unexpected' as 'backup' }, plaintext))
      .rejects.toMatchObject({ code: 'invalid_context' });
    await expect(createPortfolioVaultKey('email@example.test', secret()))
      .rejects.toMatchObject({ code: 'invalid_context' });
  });

  it('round-trips an empty byte document with its authentication tag', async () => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    const record = await encryptPortfolioRecord(key, context, new Uint8Array());
    expect(await decryptPortfolioRecord(key, context, record)).toHaveLength(0);
  });

  it('bounds decoded size and preserves caller-owned plaintext and unlock buffers', async () => {
    const material = secret();
    const copy = material.slice();
    const { key } = await createPortfolioVaultKey(ownerId, material);
    const input = new Uint8Array(MAX_PORTFOLIO_PLAINTEXT_BYTES).fill(0x61);
    const record = await encryptPortfolioRecord(key, context, input);
    const restored = await decryptPortfolioRecord(key, context, record);
    // Native byte comparison keeps this 2 MiB boundary check fast under full-suite contention.
    expect(Buffer.from(restored).equals(Buffer.from(input))).toBe(true);
    expect(input[0]).toBe(0x61);
    expect(input[input.length - 1]).toBe(0x61);
    expect(material).toEqual(copy);
    await expect(encryptPortfolioRecord(key, context, new Uint8Array(MAX_PORTFOLIO_PLAINTEXT_BYTES + 1)))
      .rejects.toMatchObject({ code: 'payload_too_large' });
  });

  it.each(['legacy', 'extra', 'padding', 'truncated', 'oversized', 'noncanonical'] as const)
  ('rejects a malformed stored record: %s', async change => {
    const { key } = await createPortfolioVaultKey(ownerId, secret());
    const record: Record<string, unknown> = { ...await encryptPortfolioRecord(key, context, plaintext) };
    if (change === 'legacy') record.format = 'plaintext-v0';
    if (change === 'extra') record.stocks = { investing: [] };
    if (change === 'padding') record.keyId = `${record.keyId}==`;
    if (change === 'truncated') record.iv = 'a';
    if (change === 'oversized') record.ciphertext = 'a'.repeat(3_000_000);
    if (change === 'noncanonical') record.keyId = `${'A'.repeat(21)}B`;
    expect(() => parseEncryptedPortfolioRecord(record)).toThrow();
  });

  it('rejects additional plaintext fields in the protected key envelope', async () => {
    const material = secret();
    const { protectedKey } = await createPortfolioVaultKey(ownerId, material);
    await expect(unlockPortfolioVaultKey(ownerId, { ...protectedKey, userNote: 'private' }, material))
      .rejects.toMatchObject({ code: 'invalid_key' });
  });
});
