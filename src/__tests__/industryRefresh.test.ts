import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('industry refresh refuses incomplete evidence', () => {
  it.each(['incomplete', 'unmapped'] as const)('leaves existing snapshots untouched on %s input', mode => {
    const dir = mkdtempSync(join(tmpdir(), 'joobi-industry-test-'));
    try {
      const rows = Array.from({ length: mode === 'incomplete' ? 1 : 4500 }, (_, i) => ['FIX' + i, 'Fixture', 'New unmapped industry', 100]);
      writeFileSync(join(dir, 'us-source.json'), JSON.stringify({ data: { columns: ['s', 'n', 'industry', 'marketCap'], rows, count: rows.length } }));
      writeFileSync(join(dir, 'krx-source.json'), JSON.stringify([['회사명', '시장구분', '종목코드', '업종', '주요제품'], ...Array.from({ length: 2300 }, () => ['Fixture', '코넥스', '000000', 'test', 'test'])]));
      const before = readFileSync('src/data/industry-catalog.json', 'utf8');
      const run = spawnSync(process.execPath, ['scripts/update-industry-catalog.mjs', '--source-dir', dir, '--output-dir', dir], { encoding: 'utf8' });
      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain(mode === 'incomplete' ? 'Incomplete US industry source' : 'Unmapped source labels');
      expect(readdirSync(dir)).not.toContain('industry-catalog.json');
      expect(readFileSync('src/data/industry-catalog.json', 'utf8')).toBe(before);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
