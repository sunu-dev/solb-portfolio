import { describe, expect, it } from 'vitest';
import { adminMfaSetup, adminMfaError } from '@/lib/adminMfaSetup';
describe('TOTP enrollment prerequisites', () => {
  it('blocks email-less Kakao accounts before QR enrollment', () => {
    expect(adminMfaSetup({ email: '', factors: [] }).emailReady).toBe(false);
  });
  it('does not accept unconfirmed email or pending new_email', () => {
    expect(adminMfaSetup({ email: 'test@example.test' }).emailReady).toBe(false);
    expect(adminMfaSetup({ new_email: 'test@example.test' })).toMatchObject({ emailReady: false, pendingEmail: 'test@example.test' });
  });
  it('allows enrollment after the Auth server confirms email', () => {
    expect(adminMfaSetup({ email: 'test@example.test', email_confirmed_at: '2026-11-17T00:00:00Z' }).emailReady).toBe(true);
  });
  it('never echoes arbitrary provider messages or secrets', () => {
    expect(adminMfaError({ code: 'unexpected_failure', message: 'private secret' }, '안내')).toBe('안내');
    expect(adminMfaError({ code: 'mfa_totp_enroll_not_enabled' }, '안내')).toContain('꺼져');
  });
});
