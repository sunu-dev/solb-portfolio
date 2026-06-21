#!/usr/bin/env node
/**
 * lint:tour-anchors — 투어 레지스트리 anchor ↔ 코드 data-tour 일치 검증 (빌드 게이트).
 *
 * 목적: tourRegistry.ts의 anchor가 코드에 data-tour="anchor"로 실재하지 않으면 CoachMark가
 *   TARGET_NOT_FOUND_DELAY(600ms) 후 그 스텝을 '무음 skip'한다(학습 누락). 이 데드 앵커를 빌드에서 차단.
 *   menuRegistry '데드 메뉴' 문제의 투어판 재발 방지(전략회의 검증가 지적).
 *
 * - 데드 앵커(레지스트리에 있으나 코드 data-tour 없음) = 오류(exit 1).
 * - 고아 마커(코드 data-tour인데 레지스트리에 없음)   = 경고(비치명적·정보).
 *
 * 주석 안 data-tour="..." 예시는 무시(코드 라인만 집계). lint-alerts.mjs 동형 주석 스트립.
 * --soft 플래그: 위반을 출력만 하고 exit 0(점진 도입용).
 */
import { promises as fs } from 'fs';
import path from 'path';

const ROOT = process.cwd();
const REGISTRY = path.join(ROOT, 'src/lib/tourRegistry.ts');
const SOFT = process.argv.includes('--soft');
const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx']);
const EXCLUDE = [/node_modules/, /\.next/, /dist/, /build/, /\.git/];

async function* walk(dir) {
  let entries;
  try { entries = await fs.readdir(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (EXCLUDE.some(p => p.test(full))) continue;
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile() && TARGET_EXTS.has(path.extname(entry.name))) yield full;
  }
}

/** 블록 주석(/* *​/)만 제거 — doc 주석 안 data-tour 예시를 마커로 오집계하지 않도록.
 *  라인 주석(//)은 제거하지 않는다: 'https://' 등 문자열 내부 //에서 절단되면 같은 라인의
 *  data-tour 마커가 소실돼 거짓 데드앵커(빌드 실패)가 될 수 있어서. (라인 주석 속 예시는
 *  설사 있어도 비치명적 '고아 경고'로만 노출되므로 안전한 방향.) */
function stripBlockComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '');
}

async function main() {
  // 1) 레지스트리 anchor 추출
  let registrySrc;
  try { registrySrc = await fs.readFile(REGISTRY, 'utf8'); }
  catch { console.error('[lint:tour-anchors] ✗ tourRegistry.ts를 읽을 수 없음:', REGISTRY); process.exit(1); }
  // 추출 정규식은 코드 마커(data-tour=["']...)와 대칭으로 양쪽 따옴표 허용 — 따옴표 스타일(Prettier 등)
  // 변경에 강건하게. 작은따옴표만 매칭하면 큰따옴표 anchor가 조용히 누락돼 데드앵커를 못 잡는다(안전하지 않은 방향).
  const anchorList = [...registrySrc.matchAll(/anchor:\s*["']([^"']+)["']/g)].map(m => m[1]);
  const registryAnchors = new Set(anchorList);
  if (registryAnchors.size === 0) {
    console.error('[lint:tour-anchors] ✗ 레지스트리에서 anchor를 찾지 못함 — 추출 패턴이 깨졌는지 확인.');
    process.exit(1);
  }
  // 중복 anchor(두 스텝이 같은 요소를 가리킴) — Set이 조용히 dedupe하므로 배열 단계에서 탐지.
  const dupAnchors = [...new Set(anchorList.filter((a, i) => anchorList.indexOf(a) !== i))];
  if (dupAnchors.length > 0) {
    console.error(`[lint:tour-anchors] ✗ 레지스트리 중복 anchor ${dupAnchors.length}건: ${dupAnchors.join(', ')} — 한 요소를 두 스텝이 가리킵니다.`);
    if (!SOFT) process.exit(1);
  }

  // 2) 코드 data-tour 마커 수집 (주석 제외)
  const marked = new Map(); // anchor -> [relative file paths]
  for await (const file of walk(path.join(ROOT, 'src'))) {
    const src = stripBlockComments(await fs.readFile(file, 'utf8'));
    for (const m of src.matchAll(/data-tour=["']([^"']+)["']/g)) {
      const a = m[1];
      if (a.includes('${')) continue; // 템플릿 보간(querySelector 동적 사용) 무시 — 정적 JSX 마커만 집계
      if (!marked.has(a)) marked.set(a, []);
      marked.get(a).push(path.relative(ROOT, file));
    }
  }

  // 3) 데드 앵커 / 고아 마커
  const dead = [...registryAnchors].filter(a => !marked.has(a));
  const orphan = [...marked.keys()].filter(a => !registryAnchors.has(a));

  for (const a of orphan) {
    console.warn(`[lint:tour-anchors] ⚠ 고아 data-tour(레지스트리에 없음): "${a}" — ${marked.get(a).join(', ')}`);
  }

  if (dead.length > 0) {
    console.error(`\n[lint:tour-anchors] ✗ 데드 앵커 ${dead.length}건 (레지스트리에 있으나 코드에 data-tour 없음 → 무음 skip):`);
    for (const a of dead) console.error(`  - "${a}"`);
    console.error('\n  → 해당 컴포넌트에 data-tour="앵커"를 추가하거나 레지스트리에서 스텝을 제거하세요.');
    if (!SOFT) process.exit(1);
  }

  console.log(
    `[lint:tour-anchors] ✓ 데드 앵커 0건 (레지스트리 ${registryAnchors.size} ↔ 코드 마커 ${marked.size}` +
    `${orphan.length ? ` · 고아 ${orphan.length}(경고)` : ''})`
  );
}

main();
