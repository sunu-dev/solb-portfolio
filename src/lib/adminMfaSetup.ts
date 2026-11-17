import type { User } from '@supabase/supabase-js';

/** Hosted TOTP currently derives AccountName from the confirmed Auth email. */
export function adminMfaSetup(user: Pick<User, 'email' | 'email_confirmed_at' | 'new_email' | 'factors'>) {
  return {
    factors: (user.factors ?? []).filter(f => f.factor_type === 'totp' && f.status === 'verified'),
    emailReady: Boolean(user.email?.trim() && user.email_confirmed_at),
    pendingEmail: user.new_email ?? '',
  };
}

export function adminMfaError(error: unknown, fallback: string): string {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  switch (code) {
    case 'email_exists': case 'email_address_not_authorized':
      return '이 이메일로 연결하지 못했어요. 다른 계정에서 사용 중인지 또는 이메일 발송 설정을 확인해 주세요.';
    case 'over_email_send_rate_limit': case 'over_request_rate_limit':
      return '요청이 잠시 많아졌어요. 조금 기다린 뒤 다시 시도해 주세요.';
    case 'mfa_totp_enroll_not_enabled': case 'mfa_totp_verify_not_enabled':
      return '인증 앱 기능이 서버에서 꺼져 있어요. 운영 설정 확인이 필요해요.';
    case 'mfa_factor_name_conflict':
      return '완료하지 않은 등록 정보가 있어요. 다시 확인한 뒤 등록을 시작해 주세요.';
    case 'session_expired': case 'session_not_found': case 'bad_jwt':
      return '로그인 시간이 만료됐어요. 다시 로그인한 뒤 시도해 주세요.';
    default: return fallback;
  }
}
