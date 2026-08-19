import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * cron 인증 경계 불변식 — 2026-08-18 감사 후속.
 *
 * 왜 필요한가: cron 9개가 각자 `verifyCronAuth`를 복제해 갖고 있었는데, 그중 `check-alerts`만
 * `if (!secret) return false` 가드가 빠져 있었다. `CRON_SECRET`이 미설정이면 템플릿 리터럴이
 * `"Bearer undefined"` 문자열이 되어, 같은 헤더를 보낸 외부 요청이 인증을 통과한다.
 *
 * 복제가 있는 한 이런 이탈은 다시 생긴다. 그래서 "cron 라우트는 공통 가드를 쓴다"를 테스트로 박제한다.
 */

const ROOT = path.resolve(__dirname, '../..');
const CRON_DIR = path.join(ROOT, 'src/app/api/cron');

/**
 * 공통 가드를 쓰지 않아도 되는 예외 — **이유와 함께** 등재해야 한다.
 *
 * `check-alerts`는 Vercel Cron(GET, CRON_SECRET)과 Upstash QStash(POST, 서명 검증)를
 * 동시에 받는 유일한 라우트다. QStash 분기는 `defineRoute`의 cron 모드가 다루지 않으므로
 * 자체 인증을 유지한다. 단 `if (!secret)` 가드는 반드시 있어야 한다(아래에서 검사).
 */
const EXEMPT = new Map<string, string>([
  ['check-alerts', 'QStash 서명 검증 분기 병행 — 공통 cron 모드로 표현 불가'],
]);

function cronRoutes(): { name: string; file: string; content: string }[] {
  return fs.readdirSync(CRON_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => {
      const file = path.join(CRON_DIR, e.name, 'route.ts');
      return { name: e.name, file, content: fs.readFileSync(file, 'utf8') };
    });
}

describe('cron 인증 — 공통 가드 사용 불변식', () => {
  it('cron 라우트가 존재한다', () => {
    expect(cronRoutes().length).toBeGreaterThanOrEqual(9);
  });

  it("예외를 제외한 모든 cron이 defineRoute({ auth: 'cron' })을 쓴다", () => {
    const offenders = cronRoutes()
      .filter(r => !EXEMPT.has(r.name))
      .filter(r => !(r.content.includes('defineRoute') && /auth:\s*'cron'/.test(r.content)))
      .map(r => r.name);

    expect(
      offenders,
      "cron 라우트는 defineRoute({ auth: 'cron' })로 인증한다. " +
      '자체 구현하면 CRON_SECRET 미설정 가드 같은 항목이 라우트마다 어긋난다. ' +
      '불가피하면 EXEMPT에 이유와 함께 등재할 것.',
    ).toEqual([]);
  });

  it('예외를 제외한 어떤 cron도 CRON_SECRET을 직접 비교하지 않는다', () => {
    const offenders = cronRoutes()
      .filter(r => !EXEMPT.has(r.name))
      .filter(r => {
        // 주석은 제외하고 실제 코드만 본다.
        const code = r.content
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
        return /process\.env\.CRON_SECRET/.test(code);
      })
      .map(r => r.name);

    expect(offenders, 'CRON_SECRET 비교는 apiRoute.ts 한 곳에만 둔다.').toEqual([]);
  });

  it('예외로 등재된 라우트도 CRON_SECRET 미설정 시 차단한다', () => {
    for (const [name, reason] of EXEMPT) {
      const file = path.join(CRON_DIR, name, 'route.ts');
      expect(fs.existsSync(file), `${name}: 예외 등재됐지만 파일이 없다`).toBe(true);
      expect(reason.length, `${name}: 예외 사유가 비어 있다`).toBeGreaterThan(0);

      const content = fs.readFileSync(file, 'utf8');
      // secret을 변수로 뽑아 falsy 검사를 한 뒤 비교해야 한다.
      // (`authHeader !== \`Bearer ${process.env.CRON_SECRET}\`` 직접 비교는 undefined 우회를 허용)
      const hasGuard =
        /const\s+secret\s*=\s*process\.env\.CRON_SECRET/.test(content) &&
        /!secret/.test(content);

      expect(
        hasGuard,
        `${name}: CRON_SECRET 미설정 가드가 없다. ` +
        'secret을 변수로 받아 `!secret`이면 차단해야 한다 — ' +
        '없으면 `Bearer undefined` 헤더가 인증을 통과한다.',
      ).toBe(true);
    }
  });
});
