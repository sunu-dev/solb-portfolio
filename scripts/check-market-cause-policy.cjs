/** Read-only real official-source corpus. No API keys, model calls or DB writes.
 * Saved at current retrieval time; never claims point-in-time historical access. */
const fs = require('node:fs'), path = require('node:path'), { createHash } = require('node:crypto');
const { load } = require('./check-market-cause-sec.cjs');
const root = path.resolve(__dirname, '..');
const { parsePolicyFeed, parsePolicyRelease, fetchPolicyText, POLICY_FEEDS } = load(path.join(root, 'src/lib/marketCause/sources/policyRelease.ts'));
const { evaluationSplit, assessNarrativeRollout } = load(path.join(root, 'src/lib/marketCause/evaluation.ts'));
const out = path.join(root, 'artifacts/market-cause-expansion-20261031');
const pause = () => new Promise(r => setTimeout(r, 1100));
(async () => {
  fs.mkdirSync(path.join(out, 'policy-corpus'), { recursive: true });
  const capturedDirectory = path.join(out, 'policy-corpus', new Date().toISOString().replace(/[:.]/g, '-')); fs.mkdirSync(capturedDirectory);
  const results = [], manifest = [];
  for (const authority of ['fed', 'bok']) {
    const now = new Date().toISOString();
    const xml = await fetchPolicyText(POLICY_FEEDS[authority]);
    const links = parsePolicyFeed(xml, authority, now).slice(0, 20);
    for (const link of links) {
      await pause();
      const file = authority + '-' + link.publishedAt.slice(0, 10);
      try {
        const html = await fetchPolicyText(link.url);
        const observedAt = new Date().toISOString();
        fs.writeFileSync(path.join(capturedDirectory, file + '.html'), html);
        const release = parsePolicyRelease(link, html, observedAt);
        fs.writeFileSync(path.join(capturedDirectory, file + '.json'), JSON.stringify(release, null, 2));
        results.push({ authority, publishedAt: link.publishedAt, status: 'parsed', action: release.action, lower: release.lower, upper: release.upper });
        const group = `${authority}:${link.publishedAt.slice(0, 10)}`;
        manifest.push({ id: file, eventGroup: group, market: authority === 'fed' ? 'us' : 'kr', kind: 'policy', scenario: null,
          split: evaluationSplit(group), mode: 'retrospective', developmentExposed: true, cutoff: observedAt,
          documents: [{ hash: createHash('sha256').update(html).digest('hex'), publishedAt: release.publishedAt, firstSeenAt: observedAt }],
          expected: null, actual: 'withhold', review: null,
          annotationStatus: 'pending_price_scenario_and_independent_review' });
      } catch (error) {
        results.push({ authority, publishedAt: link.publishedAt, status: 'withheld', reason: /^policy_[a-z_]+$/.test(error.message) ? error.message : 'transport_unavailable' });
      }
    }
  }
  // Scenario labels and reference answers remain unreviewed; parser coverage
  // cannot turn into a causal-quality score or 200 completed historical cases.
  const report = { checkedAt: new Date().toISOString(), scope: 'official rate decisions, retrospective parser coverage only',
    results, parsed: results.filter(r => r.status === 'parsed').length, total: results.length, independentlyReviewed: 0 };
  fs.writeFileSync(path.join(out, 'policy-source-report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(out, 'evaluation-manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(out, 'rollout-assessment.json'), JSON.stringify(assessNarrativeRollout(manifest, [], 'narrative-shadow-v4'), null, 2));
  console.log(JSON.stringify(report));
})().catch(() => { console.error('Official-source corpus check failed; no raw transport details logged.'); process.exitCode = 1; });
