#!/usr/bin/env node
// ==========================================
// LINT DARKMODE — 다크모드 대비/색상 코어 SSOT 빌드 시 검증
// ==========================================
//
// 정책 SSOT: project_design_system 메모리 '다크 코어 표준' (2026-06-20 회의)
//
// 근본 원인: 다크모드가 (1)토큰 .dark 리매핑(강제 경로) + (2)하드코딩 색 substring
//   허용목록(globals.css)으로 쪼개져, 허용목록 밖 하드코딩 색·수동 active 색쌍이
//   안 뒤집혀 저대비가 매번 재발. 허용목록 확장 대신 토큰 강제 + 이 정적 검출로 차단.
//
// 룰:
//   R1 (active 색쌍 안티패턴 — 핵심): 한 style={{}} 객체 안에서
//      background 가 var(--text-primary|--pill-active-bg)(다크에서 밝게 뒤집힘) 인데
//      color 가 바른 토큰이 아닌 '#fff'/'#FFFFFF'/'white' 리터럴 → 다크에서 흰글자 on 흰배경.
//      → color를 var(--pill-active-fg) 또는 var(--text-inverse)로.
//   R3 (미정의 토큰): globals.css(:root/.dark)에 없는 var(--TOKEN) 참조 (특히 var(--text) 오타).
//      → 폴백 hex로 굳어 영영 안 뒤집힘.
//   R4 (라이트 보더 하드코딩): border류 값에 #F2F4F6/#E5E8EB/rgba(242,244,246) 리터럴.
//      → var(--border-light)로 (허용목록은 리터럴만 잡고 rgba 미매칭).
//
// 사용:
//   npm run lint:darkmode           # strict (위반 시 exit 1, CI 차단)
//   npm run lint:darkmode -- --soft # soft  (위반 시각화만, exit 0)
//
// 점진 도입: 도입 직후 surface/border/알파 baseline이 있으므로 prebuild는 --soft.
//   R1(핵심 버그 클래스)은 2026-06-20 sweep으로 0건이어야 함. sweep 완료 후 strict 격상.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'src');
const GLOBALS_CSS = path.join(SRC_DIR, 'app', 'globals.css');

const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build']);

// globals.css 외부 정의 토큰(프레임워크/런타임). R3 false-positive 방지용 allowlist.
const TOKEN_ALLOWLIST = new Set([]);

// var(--x, fallback) 의 fallback을 제거 → 남는 bare 리터럴만 '진짜 하드코딩'.
function stripVarFallbacks(s) {
  return s.replace(/var\(\s*--[a-z0-9-]+\s*,[^)]*\)/gi, 'var(--x)');
}

// style={{ ... }} 객체 블록 추출 (중첩 중괄호·멀티라인 대응)
function extractStyleBlocks(content) {
  const blocks = [];
  const re = /style=\{\{/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const start = m.index + m[0].length;
    let depth = 1, i = start;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      i++;
    }
    blocks.push({ text: content.slice(start, i - 1), startLine: content.slice(0, m.index).split('\n').length });
  }
  return blocks;
}

// [^,;}]*로 background '속성 값' 안으로 제한 — JS 객체는 쉼표 구분이라 [^;]*는 다음 color 속성까지
// 넘어가 오탐(bg=brand-primary, color 분기의 var(--text-primary)를 잡음)을 낸다.
const R1_FLIP_BG = /background\s*:[^,;}]*var\(\s*--(text-primary|pill-active-bg)\b/;
const R1_BARE_WHITE = /color\s*:\s*[^,;}]*['"](#[fF]{3}|#[fF]{6}|white)['"]/;
const R4_BORDER = /(border|borderTop|borderBottom|borderLeft|borderRight|borderColor)\s*:\s*[^;}]*(#F2F4F6|#E5E8EB|rgba\(\s*242\s*,\s*244\s*,\s*246)/i;

function checkFile(filePath, content, definedTokens, violations) {
  const relPath = path.relative(ROOT, filePath);

  // R1 — style 블록 단위 (active 색쌍 안티패턴)
  for (const block of extractStyleBlocks(content)) {
    if (R1_FLIP_BG.test(block.text) && R1_BARE_WHITE.test(stripVarFallbacks(block.text))) {
      violations.push({ file: relPath, line: block.startLine, rule: 'R1-active-pair',
        phrase: 'flip-bg + bare white text', hint: 'color → var(--pill-active-fg) 또는 var(--text-inverse)' });
    }
  }

  // R3 / R4 — 라인 단위
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const lineNum = idx + 1;

    // R3 — 미정의 토큰 참조
    for (const tm of line.matchAll(/var\(\s*--([a-z0-9-]+)/gi)) {
      const tok = tm[1];
      if (!definedTokens.has(tok) && !TOKEN_ALLOWLIST.has(tok)) {
        violations.push({ file: relPath, line: lineNum, rule: 'R3-undef-token',
          phrase: `var(--${tok})`, hint: 'globals.css 미정의 — 오타(--text→--text-primary?) 또는 토큰 추가' });
      }
    }

    // R4 — 라이트 보더 하드코딩 (var 폴백 제거 후 bare 리터럴만)
    if (R4_BORDER.test(stripVarFallbacks(line))) {
      violations.push({ file: relPath, line: lineNum, rule: 'R4-hardcoded-border',
        phrase: line.match(/#F2F4F6|#E5E8EB|rgba\(\s*242[^)]*\)/i)?.[0] || '', hint: 'var(--border-light)로' });
    }
  });
}

async function walkDir(dir, files = []) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walkDir(path.join(dir, entry.name), files);
    } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

async function main() {
  const isSoft = process.argv.includes('--soft');

  // globals.css 정의 토큰 수집 (:root/.dark/@theme 의 모든 --x:)
  const css = await fs.readFile(GLOBALS_CSS, 'utf-8');
  const definedTokens = new Set();
  for (const m of css.matchAll(/--([a-z0-9-]+)\s*:/gi)) definedTokens.add(m[1]);

  const files = await walkDir(SRC_DIR);
  const violations = [];
  for (const file of files) {
    checkFile(file, await fs.readFile(file, 'utf-8'), definedTokens, violations);
  }

  if (violations.length === 0) {
    console.log('[lint:darkmode] ✓ 위반 없음 (R1 active 색쌍 0 · R3 미정의 토큰 0 · R4 보더 0)');
    process.exit(0);
  }

  // 심각도 순 정렬 — R1(흰글자 on 흰배경, 핵심 버그)을 항상 먼저 노출.
  const RULE_ORDER = { 'R1-active-pair': 0, 'R3-undef-token': 1, 'R4-hardcoded-border': 2 };
  violations.sort((a, b) => (RULE_ORDER[a.rule] ?? 9) - (RULE_ORDER[b.rule] ?? 9));

  const byRule = violations.reduce((a, v) => (a[v.rule] = (a[v.rule] || 0) + 1, a), {});
  console.error(`[lint:darkmode] ✗ ${violations.length}건 위반 검출`);
  console.error(`  R1 active 색쌍(흰글자 on 흰배경): ${byRule['R1-active-pair'] || 0}건`);
  console.error(`  R3 미정의 토큰: ${byRule['R3-undef-token'] || 0}건`);
  console.error(`  R4 라이트 보더 하드코딩: ${byRule['R4-hardcoded-border'] || 0}건`);
  console.error('');
  for (const v of violations.slice(0, 40)) {
    console.error(`  ${v.file}:${v.line}  [${v.rule}]  "${v.phrase}"  → ${v.hint}`);
  }
  if (violations.length > 40) console.error(`  ... 외 ${violations.length - 40}건`);
  console.error('');
  console.error('정책: project_design_system 다크 코어 표준 · 코어 토큰: globals.css --pill-active-bg/fg · --text-inverse');
  if (isSoft) {
    console.error('\n[lint:darkmode] --soft 모드: 위반 시각화 후 통과 (baseline sweep까지)');
    process.exit(0);
  }
  process.exit(1);
}

main().catch(err => { console.error('[lint:darkmode] 스크립트 오류:', err); process.exit(1); });
