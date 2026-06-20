#!/usr/bin/env node
// 일회성 codemod — border 컨텍스트의 라이트 보더 리터럴(#F2F4F6/#E5E8EB/rgba(242,244,246))을
// var(--border-light, <리터럴>)로 치환. lint:darkmode R4 sweep. 중립 회색만 건드려 컬러 상태색은 무관.
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'src');
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx']);
const IGNORE = new Set(['node_modules', '.next', 'dist', 'build']);
const DRY = process.argv.includes('--dry');

const RGBA = /rgba\(\s*242\s*,\s*244\s*,\s*246\s*(?:,\s*[\d.]+\s*)?\)/gi;
const P_OPEN = '⟦';
const P_CLOSE = '⟧';

// 한 문자열/라인 안에서 기존 var()를 보호하고 중립 리터럴만 토큰화.
function tokenize(s) {
  const saved = [];
  let v = s.replace(/var\([^)]*\)/g, (m) => { saved.push(m); return P_OPEN + (saved.length - 1) + P_CLOSE; });
  v = v
    .replace(/#F2F4F6/gi, 'var(--border-light, #F2F4F6)')
    .replace(/#E5E8EB/gi, 'var(--border-light, #E5E8EB)')
    .replace(RGBA, (m) => `var(--border-light, ${m})`);
  v = v.replace(new RegExp(P_OPEN + '(\\d+)' + P_CLOSE, 'g'), (_, i) => saved[+i]);
  return v;
}

async function walk(dir, files = []) {
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!IGNORE.has(e.name) && !e.name.startsWith('.')) await walk(path.join(dir, e.name), files); }
    else if (EXT.has(path.extname(e.name))) files.push(path.join(dir, e.name));
  }
  return files;
}

let filesChanged = 0, hits = 0;
for (const file of await walk(SRC)) {
  const orig = await fs.readFile(file, 'utf-8');
  const next = orig.split('\n').map((line) => {
    // border 속성이 있는 라인만 대상(같은 줄 배경이 중립 회색이면 오염 위험 → skip해 수동 처리).
    if (!/border(Top|Bottom|Left|Right|Color)?\s*:/.test(line)) return line;
    if (/background(Color)?\s*:\s*['"]?(#F2F4F6|#E5E8EB)/i.test(line)) return line;
    const out = tokenize(line);
    if (out !== line) hits++;
    return out;
  }).join('\n');
  if (next !== orig) {
    filesChanged++;
    console.log(`  ${path.relative(path.resolve(__dirname, '..'), file)}`);
    if (!DRY) await fs.writeFile(file, next);
  }
}
console.log(`\n[codemod] ${DRY ? '(dry) ' : ''}border 토큰화: ${hits}라인 / ${filesChanged}파일`);
