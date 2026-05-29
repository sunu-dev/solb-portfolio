#!/usr/bin/env node
// ==========================================
// LINT KOREAN — 한국어 UI/UX SSOT 빌드 시 검증
// ==========================================
//
// 정책 SSOT: docs/KOREAN_UI_SYSTEM.md §5
//
// 목적: 빌드 차단으로 다음 위반이 prod에 유입되는 것을 방지:
//   1. "이(가)", "은(는)", "을(를)", "과(와)", "으로(로)" 괄호 표기
//      → koreanJosa.ts 유틸 미사용 시그널
//   2. 격식 종결 어휘 ("있습니다", "됩니다" 등)
//      → 토스 톤 페르소나 SSOT 위반 (단 약관·Disclaimer·법무 예외)
//
// 사용:
//   npm run lint:korean           # strict (위반 시 exit 1, CI 차단)
//   npm run lint:korean -- --soft # soft  (위반 시각화만, exit 0)
//
// 종료 코드:
//   0 — 위반 없음, 또는 --soft 모드
//   1 — 위반 발견 (strict 모드만 CI 차단)
//
// 점진 도입 패턴:
//   - 도입 직후엔 기존 66건 위반(2026-05-29 baseline)이 있으므로 prebuild는 --soft.
//   - V1.2에서 sweep 완료 후 strict로 격상 (package.json에서 --soft 제거).
//
// 동기 유지: src/utils/koreanCopy.ts:TOSS_TONE_MAP과 함께 변경.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');

// ============================================================
// 룰 1 — 한국어 조사 괄호 표기 (koreanJosa 미사용 시그널)
// ============================================================
const JOSA_PATTERNS = [
  { pattern: /이\(가\)/g, hint: 'iGa(name) 호출' },
  { pattern: /은\(는\)/g, hint: 'eunNeun(name) 호출' },
  { pattern: /을\(를\)/g, hint: 'eulReul(name) 호출' },
  { pattern: /과\(와\)/g, hint: 'gwaWa(name) 호출' },
  { pattern: /으로\(로\)/g, hint: 'euroRo(name) 호출' },
];

// ============================================================
// 룰 2 — 격식 종결 어휘 (토스 톤 페르소나 위반)
// koreanCopy.ts:TOSS_TONE_MAP과 동기 유지.
// ============================================================
const FORMAL_TONE_PATTERNS = [
  '있습니다', '없습니다', '됩니다', '됐습니다',
  '필요합니다', '제공됩니다', '추천합니다',
  '확인하세요', '주의하세요', '입력하세요', '선택하세요',
  '시작하세요', '이용하세요',
  '맞습니다', '아닙니다', '같습니다',
];

// ============================================================
// 격식 톤 검사 예외 경로 (약관·Disclaimer·법무 격식 유지 의무)
// ============================================================
const FORMAL_TONE_EXEMPT_PATHS = [
  'src/app/terms/page.tsx',
  'src/app/privacy/page.tsx',
  'src/components/common/Disclaimer.tsx',
  // 약관 마이그·README·docs는 src 밖이라 자연 제외
];

// ============================================================
// 파일 walk
// ============================================================
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

async function walkDir(dir, files = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walkDir(path.join(dir, entry.name), files);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

// ============================================================
// 검사
// ============================================================
function checkFile(filePath, content, violations) {
  const relPath = path.relative(ROOT, filePath);
  const lines = content.split('\n');
  const isFormalExempt = FORMAL_TONE_EXEMPT_PATHS.some(p => relPath === p || relPath.startsWith(p + '/'));

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // 룰 1: 조사 괄호 표기
    for (const { pattern, hint } of JOSA_PATTERNS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({
          file: relPath,
          line: lineNum,
          rule: 'josa-bracket',
          phrase: line.match(pattern)?.[0] || '',
          hint,
        });
      }
    }

    // 룰 2: 격식 종결 어휘 (예외 경로 제외)
    if (!isFormalExempt) {
      for (const phrase of FORMAL_TONE_PATTERNS) {
        if (line.includes(phrase)) {
          violations.push({
            file: relPath,
            line: lineNum,
            rule: 'formal-tone',
            phrase,
            hint: 'koreanCopy.toTossTone() 적용 또는 직접 구어체로',
          });
        }
      }
    }
  });
}

// ============================================================
// 실행
// ============================================================
async function main() {
  const isSoft = process.argv.includes('--soft');
  const files = await walkDir(SRC_DIR);
  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf-8');
    checkFile(file, content, violations);
  }

  if (violations.length === 0) {
    console.log('[lint:korean] ✓ 위반 없음 (조사 괄호 0건 · 격식 톤 0건)');
    process.exit(0);
  }

  // 그룹화: rule별 카운트
  const byRule = violations.reduce((acc, v) => {
    acc[v.rule] = (acc[v.rule] || 0) + 1;
    return acc;
  }, {});

  console.error(`[lint:korean] ✗ ${violations.length}건 위반 검출`);
  console.error(`  조사 괄호 표기: ${byRule['josa-bracket'] || 0}건`);
  console.error(`  격식 종결 어휘: ${byRule['formal-tone'] || 0}건`);
  console.error('');

  // 상위 30건만 출력
  for (const v of violations.slice(0, 30)) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  "${v.phrase}"  → ${v.hint}`);
  }
  if (violations.length > 30) {
    console.error(`  ... 외 ${violations.length - 30}건 (전체는 grep 권장)`);
  }
  console.error('');
  console.error('정책: docs/KOREAN_UI_SYSTEM.md · SSOT: src/utils/koreanJosa.ts · src/utils/koreanCopy.ts');
  if (isSoft) {
    console.error('');
    console.error('[lint:korean] --soft 모드: 위반 시각화 후 통과 (V1.2 sweep까지)');
    process.exit(0);
  }
  process.exit(1);
}

main().catch(err => {
  console.error('[lint:korean] 스크립트 오류:', err);
  process.exit(2);
});
