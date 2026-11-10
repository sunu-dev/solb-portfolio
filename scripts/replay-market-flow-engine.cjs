const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'artifacts/market-flow-engine-20261031');
const modules = new Map();
function load(file) {
  file = path.resolve(file);
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const result = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }, reportDiagnostics: true });
  assert.equal(result.diagnostics?.length ?? 0, 0);
  const localRequire = name => name.startsWith('@/') ? load(path.join(root, 'src', name.slice(2) + '.ts'))
    : name.startsWith('.') ? load(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, module, module.exports);
  return module.exports;
}
const { buildMarketFlowBriefs } = load(path.join(root, 'src/lib/marketFlowEngine.ts'));
const raw = JSON.parse(fs.readFileSync(path.join(out, 'public-observations.json'), 'utf8')).rows.map(row => row.payload);
const feed = JSON.parse(fs.readFileSync(path.join(out, 'public-feed.json'), 'utf8'));
const now = Date.parse(feed.servedAt);
const briefs = buildMarketFlowBriefs([...raw, ...feed.events.filter(e => e.kind !== 'move')], feed.runs, now);
assert.ok(briefs.length);
for (const brief of briefs) {
  assert.equal(brief.benchmarks.length, 2);
  assert.ok(brief.breadth === null || brief.breadth.available <= 11);
  assert.ok(brief.companies.every(item => Number.isFinite(item.relativeToIndex)));
}
fs.writeFileSync(path.join(out, 'live-replay.json'), JSON.stringify({ replayedAt: new Date().toISOString(),
  source: 'Read-only public market observations, not investment records', productionChanged: false,
  observedCount: raw.length, briefs, limitation: 'Legacy collection has not yet collected the eight new company targets' }, null, 2) + '\n');
console.log(JSON.stringify(briefs.map(b => ({ market: b.market, sessionDate: b.sessionDate, headline: b.headline,
  summary: b.summary, breadth: b.breadth, freshness: b.freshness, evidence: b.evidence.map(e => e.id) })), null, 2));
