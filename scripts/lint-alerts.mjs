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

// 컴플라이언스 단어 — alertCompliance.ts가 런타임 SSOT.
//
// ⚠️ 의도적 부분집합: alertCompliance.ts의 FORBIDDEN_PHRASES는 더 크다(개인맞춤추천·단일종목
//    레버리지·소프트방향 동사 '담으세요/정리하세요' 등). 그 어휘들은 일반 UI 카피에서도 흔히
//    쓰여 정적 전체 스캔에 넣으면 과차단되므로 런타임(validateAlertMessage/sanitize) 전용으로 둔다.
//    여기 정적 lint는 '문장으로 등장하면 거의 항상 위반'인 명백한 매매권유·수익보장 코어만 검사한다.
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

// digest '왜 움직였나' 사후 해설 전용 — 인과·미래 단정 (alertCompliance.ts DIGEST_CAUSAL_FORBIDDEN 미러).
// 이 어휘들('때문에' 등)은 일반 코드/카피에 흔해 전역 검사는 과차단이라, digest 소스 파일에만 적용한다.
// 런타임 1차 방어는 gateDigestNote()(드롭)이고, 이 정적 검사는 digest 소스에 인과 단정 문자열이
// 하드코딩되는 회귀를 빌드에서 잡는 2차 그물.
const DIGEST_CAUSAL_FORBIDDEN = [
  '때문에', '때문입니다', '때문이에요',
  '덕분에', '덕분입니다',
  '영향으로 상승', '영향으로 하락', '여파로',
  '로 인해', '으로 인해',
  '확실히', '분명히', '틀림없이',
  '오를 것', '내릴 것', '상승할 것', '하락할 것', '급등할', '급락할',
];

/** digest 사후 해설을 생성·조립하는 소스 파일에만 DIGEST_CAUSAL_FORBIDDEN을 적용 */
const DIGEST_FILE_RE = /morning-brief|digest/;

// 세무 카피 — 세무사법 §20③/§2 오인 표현 (alertCompliance.ts TAX_FORBIDDEN_PHRASES 미러).
// 전역엔 과차단('세무사'·'환급'·'절세' 단독은 안전 카피)이라 세무 소스 파일에만 적용한다.
// 런타임 1차 방어는 gateTaxAdvice()(드롭)이고, 이 정적 검사는 세무 UI/카피에 위험 주장이
// 하드코딩되는 회귀를 빌드에서 잡는 2차 그물.
const TAX_FORBIDDEN_PHRASES = [
  '세무대리', '세무 대리', '신고대행', '신고 대행', '신고를 대행', '대신 신고', '신고 대신',
  '기장대행', '기장 대행', '대신 신고해', '신고해드',
  '세무상담', '세무 상담', '세무자문', '세무 자문', '세무 컨설팅',
  '절세전문', '절세 전문', '절세 컨설팅', '절세 상담',
  '환급해드', '환급받아드', '세금 돌려드',
  '세무 비서', '세무비서',
];
/** 세무 기능 소스 파일에만 TAX_FORBIDDEN_PHRASES를 적용 (taxRates·tax UI·tax API) */
const TAX_FILE_RE = /tax|양도세/i;

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
  const isDigestFile = DIGEST_FILE_RE.test(filePath);
  const isTaxFile = TAX_FILE_RE.test(filePath);

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

    // digest 소스 파일 한정 — 인과·미래 단정 (전역엔 과차단이라 미적용)
    if (isDigestFile) {
      for (const phrase of DIGEST_CAUSAL_FORBIDDEN) {
        if (stripped.includes(phrase)) {
          violations.push({
            file: path.relative(ROOT, filePath),
            line: i + 1,
            phrase: `[digest 인과단정] ${phrase}`,
            context: lines[i].trim().slice(0, 200),
          });
        }
      }
    }

    // 세무 소스 파일 한정 — 세무대리·상담 오인 표현 (세무사법 §20③/§2)
    if (isTaxFile) {
      for (const phrase of TAX_FORBIDDEN_PHRASES) {
        if (stripped.includes(phrase)) {
          violations.push({
            file: path.relative(ROOT, filePath),
            line: i + 1,
            phrase: `[세무사법 오인] ${phrase}`,
            context: lines[i].trim().slice(0, 200),
          });
        }
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
