import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isAdminIdentity } from '@/lib/adminAuth';

/**
 * 관리자 신원 경계 불변식 — 2026-08-18 감사 후속.
 *
 * 두 가지를 박제한다:
 *  1. 허용목록이 **클라이언트 번들에 들어갈 수 있는 파일**에 다시 등장하지 않는다.
 *     예전에는 15개 파일에 리터럴이 복제됐고 그중 3개가 클라이언트 컴포넌트라
 *     파운더 이메일 2개와 UUID가 빌드 산출물 청크에 실렸다.
 *  2. `isAdminIdentity` 판정 규칙(이메일 대소문자 무시, id 또는 email 중 하나만 맞아도 통과,
 *     빈 신원은 거부)이 유지된다.
 */

const ROOT = path.resolve(__dirname, '../..');

/** 허용목록이 존재해도 되는 유일한 곳 */
const ALLOWED_FILES = new Set([
  'src/lib/adminAuth.ts',
  'src/__tests__/adminAuthBoundary.test.ts',
]);

/**
 * 특정 값이 아니라 **신원 목록을 선언하는 행위**를 잡는다 — 관리자를 교체해도 룰이 유지된다.
 * 약관·개인정보처리방침의 공개 연락처 이메일은 의도된 노출이라 대상이 아니다(선언 패턴에 안 걸림).
 */
const ADMIN_LITERAL_PATTERNS = [
  /ADMIN_EMAILS\s*[:=]/,
  /ADMIN_IDS\s*[:=]/,
  /FOUNDER_EMAILS\s*[:=]/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i,
];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe('관리자 허용목록 — 클라이언트 누출 불변식', () => {
  it('adminAuth.ts 밖에서는 관리자 리터럴이 등장하지 않는다', () => {
    const offenders: string[] = [];

    for (const file of walk(path.join(ROOT, 'src'))) {
      const rel = path.relative(ROOT, file).split(path.sep).join('/');
      if (ALLOWED_FILES.has(rel)) continue;

      const content = fs.readFileSync(file, 'utf8');
      for (const pattern of ADMIN_LITERAL_PATTERNS) {
        if (pattern.test(content)) {
          offenders.push(`${rel} ← ${pattern}`);
          break;
        }
      }
    }

    expect(
      offenders,
      '관리자 신원은 src/lib/adminAuth.ts 한 곳에만 둔다. ' +
      '클라이언트 컴포넌트에 넣으면 빌드 산출물로 노출된다. ' +
      'UI 게이팅은 useIsAdmin()(→ /api/me/admin), 서버 판정은 requireAdmin()/defineRoute({auth:\'admin\'}) 사용.',
    ).toEqual([]);
  });
});

describe('isAdminIdentity 판정 규칙', () => {
  const originalEmails = process.env.ADMIN_EMAILS;
  const originalIds = process.env.ADMIN_IDS;

  afterEach(() => {
    if (originalEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = originalEmails;
    if (originalIds === undefined) delete process.env.ADMIN_IDS;
    else process.env.ADMIN_IDS = originalIds;
  });

  it('null·undefined 신원은 거부한다', () => {
    expect(isAdminIdentity(null)).toBe(false);
    expect(isAdminIdentity(undefined)).toBe(false);
  });

  it('허용목록에 없는 신원은 거부한다', () => {
    process.env.ADMIN_EMAILS = 'ops@example.com';
    process.env.ADMIN_IDS = 'id-allowed';
    expect(isAdminIdentity({ id: 'id-other', email: 'someone@example.com' })).toBe(false);
  });

  it('이메일만 맞아도, id만 맞아도 통과한다', () => {
    process.env.ADMIN_EMAILS = 'ops@example.com';
    process.env.ADMIN_IDS = 'id-allowed';
    expect(isAdminIdentity({ id: 'id-other', email: 'ops@example.com' })).toBe(true);
    expect(isAdminIdentity({ id: 'id-allowed', email: null })).toBe(true);
  });

  it('이메일 비교는 대소문자를 무시한다', () => {
    process.env.ADMIN_EMAILS = 'Ops@Example.com';
    process.env.ADMIN_IDS = 'nobody';
    expect(isAdminIdentity({ id: 'x', email: 'ops@example.com' })).toBe(true);
    expect(isAdminIdentity({ id: 'x', email: 'OPS@EXAMPLE.COM' })).toBe(true);
  });

  it('이메일이 비어 있어도 id가 아니면 통과시키지 않는다', () => {
    process.env.ADMIN_EMAILS = 'ops@example.com';
    process.env.ADMIN_IDS = 'id-allowed';
    expect(isAdminIdentity({ id: 'x', email: '' })).toBe(false);
    expect(isAdminIdentity({ id: 'x' })).toBe(false);
  });
});
