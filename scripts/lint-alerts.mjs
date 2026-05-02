#!/usr/bin/env node
// ==========================================
// LINT ALERTS — 컴플라이언스 단어 검사
// ==========================================
//
// 정책 SSOT: docs/NOTIFICATION_POLICY.md §4.1
//
// 목적: 빌드/CI 차단으로 매수·매도 권유 어휘가 사용자 노출 알림 텍스트에
//       유입되는 것을 방지. 런타임 validateAlertMessage()는 dev 경고만이므로
//       prod 빌드 전에 정적 검사 한 단계 추가.
//
// 사용:
//   npm run lint:alerts
//
// 종료 코드:
//   0 — 위반 없음
//   1 — 위반 발견 (CI 차단)

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// 컴플라이언스 단어 — alertCompliance.ts와 동기 유지 (양쪽 변경 시 함께)
const FORBIDDEN_PHRASES = [
  '지금 사세요',
  '지금 매수',
  '지금 매도',
  '매수하세요',
  '매도하세요',
  '매수 추천',
  '매도 추천',
  '추천 종목',
  '매수 타이밍',
  '매도 타이밍',
  '사야 한다',
  '팔아야 한다',
  '사야합니다',
  '팔아야합니다',
  '확실한 수익',
  '수익 보장',
  '100% 보장',
  '반드시 오릅니다',
  '반드시 떨어집니다',
];

/**
 * 검사에서 제외할 파일·디렉토리.
 *
 * 알림 메시지를 직접 생성하지 않는 곳들:
 * - AI 프롬프트 (모델에게 "이렇게 말하지 마"고 지시하는 곳)
 * - 투자자 유형 설명 (안티패턴 묘사)
 * - 정책·어휘 정의 자체
 */
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.next/,
  /dist/,
  /build/,
  /\.git/,
  /scripts\/lint-alerts/,                     // 본인 제외
  /utils\/alertCompliance\.ts$/,              // 어휘 정의
  /docs\/NOTIFICATION_POLICY\.md$/,           // 정책 문서
  /config\/analysisPrompt\.ts$/,              // AI 프롬프트 — "이렇게 말하지 마" 지시
  /config\/investorTypes\.ts$/,               // 투자자 유형 묘사 — "이런 조급함은 회피"
];

/**
 * 한 줄 단위 inline 예외:
 * 줄 끝에 `// lint-alerts-ignore` 코멘트가 있으면 그 줄은 검사 안 함.
 * 교육·역사 컨텍스트(과거형 매수 타이밍 등) 한정 사용.
 */
const INLINE_PRAGMA = 'lint-alerts-ignore';

/** 검사 대상 확장자 */
const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

async function* walk(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (EXCLUDE_PATTERNS.some(p => p.test(full))) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && TARGET_EXTS.has(path.extname(entry.name))) yield full;
  }
}

/**
 * 한 파일 검사 — 줄 단위 스캔.
 * 주석 안 표현은 허용 (TODO 등에 어휘 언급은 OK).
 */
async function lintFile(filePath) {
  const content = await fs.readFile(filePath, 'utf8');
  const lines = content.split('\n');
  const violations = [];

  let inBlockComment = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // 블록 주석 추적 (단순)
    const blockStart = line.indexOf('/*');
    const blockEnd = line.indexOf('*/');
    if (inBlockComment) {
      if (blockEnd >= 0) { inBlockComment = false; line = line.slice(blockEnd + 2); }
      else continue;
    }
    if (blockStart >= 0 && blockEnd < 0) { inBlockComment = true; line = line.slice(0, blockStart); }

    // 라인 주석 제거
    const lineCmt = line.indexOf('//');
    const stripped = lineCmt >= 0 ? line.slice(0, lineCmt) : line;

    // inline 예외 pragma
    if (lines[i].includes(INLINE_PRAGMA)) continue;

    for (const phrase of FORBIDDEN_PHRASES) {
      if (stripped.includes(phrase)) {
        violations.push({
          file: path.relative(ROOT, filePath),
          line: i + 1,
          phrase,
          context: lines[i].trim().slice(0, 200),
        });
      }
    }
  }

  return violations;
}

async function main() {
  const allViolations = [];

  for await (const file of walk(path.join(ROOT, 'src'))) {
    const v = await lintFile(file);
    allViolations.push(...v);
  }

  if (allViolations.length === 0) {
    console.log('[lint:alerts] ✓ 금지 어휘 검출 없음');
    process.exit(0);
  }

  console.error(`[lint:alerts] ✗ 컴플라이언스 위반 ${allViolations.length}건:\n`);
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}  "${v.phrase}"`);
    console.error(`    → ${v.context}\n`);
  }
  console.error('docs/NOTIFICATION_POLICY.md §4.1 참조 — 매수/매도 권유 어휘는 알림 메시지에 사용 금지.');
  process.exit(1);
}

main().catch(err => {
  console.error('[lint:alerts] 스크립트 오류:', err);
  process.exit(2);
});
