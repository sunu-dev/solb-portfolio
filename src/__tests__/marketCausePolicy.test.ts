import { describe, it, expect, vi } from 'vitest';
import { parsePolicyFeed, parsePolicyRelease, parsePolicyEvidence, fetchPolicyText, canonicalPolicyUrl } from '@/lib/marketCause/sources/policyRelease';
import { projectPolicyCard } from '@/lib/marketCause/officialPublication';
import { collectPolicyRelease } from '@/lib/marketCause/policyCollector';
import type { ShadowPort, ShadowSnapshot } from '@/lib/marketCause/shadowCycle';
const now = '2026-10-31T05:00:00Z';
const fedUrl = 'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm';
const fedLink = { authority: 'fed' as const, url: fedUrl, publishedAt: '2026-10-28T18:00:00.000Z' };
const fed = 'The Committee decided to maintain the target range for the federal funds rate at 3-3/4 to 4 percent, in support of the Federal Reserve\'s dual mandate.';
const bok = '□ 금융통화위원회는 다음 통화정책방향 결정시까지 한국은행 기준금리를 현재의 3.00% 수준에서 유지하여 통화정책을 운용하기로 하였다.';
const feed = `<rss><channel><item><title>Federal Reserve issues FOMC statement</title><link>${fedUrl}</link><pubDate>Wed, 28 Oct 2026 18:00:00 GMT</pubDate></item></channel></rss>`;
const html = `<head><meta content="ignore"></head><p class="article__time">October 28, 2026</p><p>${fed}</p><p>Voting against the monetary policy action were members who preferred to raise the target range for the federal funds rate by 1/4 percentage point at this meeting.</p>`;
describe('official rate source parsing and public projection', () => {
  it('extracts the actual range while ignoring dissent, hidden text and markup', () => {
    const r = parsePolicyRelease(fedLink, html + `<p hidden>The Committee decided to raise the target range for the federal funds rate to 7 to 8 percent.</p>`, now);
    expect(r).toMatchObject({ lower: '3.75', upper: '4', action: 'hold' });
    expect(projectPolicyCard({ status: 'verified', release: r, checkedAt: now, reason: null, corrected: false }, now)).toMatchObject({ market: 'us', title: '미국 연준, 목표금리 3.75~4% 동결' });
  });
  it.each(['raise', 'lower'])('handles %s and fractional changes without interpreting the increment as the resulting rate', action => {
    expect(parsePolicyEvidence('fed', `The Committee decided to ${action} the target range for the federal funds rate by 1/4 percentage point to 3-1/2 to 3-3/4 percent.`)).toMatchObject({ lower: '3.5', upper: '3.75', action: action === 'raise' ? 'raise' : 'cut' });
  });
  it('distinguishes Korean previous and current rates and checks direction', () => {
    expect(parsePolicyEvidence('bok', bok)).toMatchObject({ lower: '3', action: 'hold' });
    expect(parsePolicyEvidence('bok', bok.replace('현재의 3.00% 수준에서', '현 수준(3.50%)에서'))).toMatchObject({ lower: '3.5', action: 'hold' });
    expect(parsePolicyEvidence('bok', bok.replace('3.00% 수준에서 유지하여', '2.75% 수준에서 3.00%로 상향 조정하여'))).toMatchObject({ lower: '3', action: 'raise' });
    expect(() => parsePolicyEvidence('bok', bok.replace('3.00% 수준에서 유지하여', '2.75% 수준에서 3.00%로 하향 조정하여'))).toThrow('direction_conflict');
  });
  it('rejects duplicate decisions, quotations, forecasts, unsupported wording and reversed ranges', () => {
    expect(() => parsePolicyRelease(fedLink, html + `<p>${fed}</p>`, now)).toThrow('ambiguous');
    expect(() => parsePolicyRelease(fedLink, html.replace(fed, `Last month: ${fed}`), now)).toThrow('ambiguous');
    expect(() => parsePolicyRelease(fedLink, html.replace('October 28, 2026', 'October 27, 2026'), now)).toThrow('document_date_mismatch');
    expect(() => parsePolicyEvidence('fed', fed.replace('3-3/4 to 4', '5 to 4'))).toThrow('range_invalid');
    expect(() => parsePolicyEvidence('fed', fed.replace('decided', 'is expected'))).toThrow('unparsed');
  });
  it('normalizes the broken official BOK menu URL but rejects arbitrary hosts or credentials', () => {
    expect(canonicalPolicyUrl('bok', 'https://www.bok.or.kr/portal/bbs/P0000559/view.do?nttId=11065823&menuNo=')).toContain('nttId=11065823&menuNo=200690');
    expect(() => canonicalPolicyUrl('fed', fedUrl.replace('www.federalreserve.gov', 'www.federalreserve.gov.evil.test'))).toThrow();
    expect(() => canonicalPolicyUrl('fed', fedUrl.replace('https://', 'https://user@'))).toThrow();
  });
  it('binds the feed timestamp to the release URL date and ignores future releases', () => {
    expect(parsePolicyFeed(feed, 'fed', now)).toEqual([fedLink]);
    expect(parsePolicyFeed(feed, 'fed', '2026-10-27T00:00:00Z')).toEqual([]);
    expect(() => parsePolicyFeed(feed.replace('28 Oct', '29 Oct'), 'fed', now)).toThrow('date_mismatch');
    expect(() => parsePolicyFeed('<!DOCTYPE rss>' + feed, 'fed', now)).toThrow('invalid_policy_feed');
  });
  it('rechecks stored numeric values, timestamps and TTL before any public display', () => {
    const release = parsePolicyRelease(fedLink, html, now);
    const snapshot = { status: 'verified' as const, release, checkedAt: now, reason: null, corrected: false };
    expect(projectPolicyCard({ ...snapshot, release: { ...release, upper: '5' } }, now)).toBeNull();
    expect(projectPolicyCard(snapshot, '2026-11-02T00:00:00Z')).toBeNull();
    expect(projectPolicyCard({ ...snapshot, status: 'withheld' }, now)).toBeNull();
    expect(projectPolicyCard(snapshot, '2026-10-30T00:00:00Z')).toBeNull();
  });
  it('bounds transport and disallows redirects and nonregistered URLs', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('ok'));
    expect(await fetchPolicyText(fedUrl, fetcher)).toBe('ok');
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: 'error', cache: 'no-store' });
    await expect(fetchPolicyText('http://localhost/private', fetcher)).rejects.toThrow('identity');
    await expect(fetchPolicyText(fedUrl, vi.fn(async () => new Response('x', { headers: { 'content-length': '2000001' } })))).rejects.toThrow('limit');
    await expect(fetchPolicyText(fedUrl, vi.fn(async () => new Response('', { status: 410 })))).rejects.toThrow('removed');
  });
});
function setup() {
  let saved: { revision: number; snapshot: ShadowSnapshot } | null = null;
  const completed = new Set<string>();
  const port: ShadowPort = {
    read: vi.fn(async () => saved),
    claim: vi.fn<ShadowPort['claim']>(async key => completed.has(key) ? { status: 'finished' } : { status: 'claimed', fence: 1 }),
    publish: vi.fn<ShadowPort['publish']>(async input => { saved = { revision: input.expectedRevision + 1, snapshot: input.snapshot }; if (!input.retryable) completed.add(input.key); return 'stored'; }),
  };
  let clock = now;
  const text = vi.fn<(url: string) => Promise<string>>(async url => url.includes('/feeds/') ? feed : html);
  return { deps: { port, enabled: vi.fn(async () => true), now: () => clock, text }, read: () => saved,
    nextDay: () => { clock = '2026-11-01T05:00:00Z'; } };
}
describe('official refresh and correction lifecycle', () => {
  it('leases before network, skips duplicate delivery, and never spends model tokens', async () => {
    const s = setup(); s.deps.text.mockImplementation(async url => { expect(s.deps.port.claim).toHaveBeenCalled(); return url.includes('/feeds/') ? feed : html; });
    expect(await collectPolicyRelease('fed', s.deps)).toMatchObject({ status: 'stored', sourceStatus: 'verified', modelCalls: 0 });
    expect((await collectPolicyRelease('fed', s.deps)).status).toBe('finished'); expect(s.deps.text).toHaveBeenCalledTimes(2);
  });
  it('retracts an old card when a changed document cannot be verified', async () => {
    const s = setup(); await collectPolicyRelease('fed', s.deps); s.nextDay();
    s.deps.text.mockImplementation(async url => url.includes('/feeds/') ? feed : '<p>Statement withdrawn for correction.</p>');
    expect(await collectPolicyRelease('fed', s.deps)).toMatchObject({ sourceStatus: 'withheld' });
    expect(s.read()?.snapshot.official?.release).toBeNull(); expect(s.read()?.snapshot.decision.disposition).toBe('withdrawn');
  });
  it('retains the original verification time on transport outage and marks a valid correction', async () => {
    const s = setup(); await collectPolicyRelease('fed', s.deps); s.nextDay(); s.deps.text.mockRejectedValueOnce(new Error('network failure with private data'));
    expect(await collectPolicyRelease('fed', s.deps)).toMatchObject({ sourceStatus: 'source_unavailable', reason: 'policy_transport_unavailable' });
    expect(s.read()?.snapshot.official?.release?.observedAt).toBe(now);
    s.deps.text.mockImplementation(async url => url.includes('/feeds/') ? feed : html.replace('3-3/4 to 4', '3-1/2 to 3-3/4'));
    await collectPolicyRelease('fed', s.deps);
    expect(s.read()?.snapshot.official).toMatchObject({ corrected: true, status: 'verified', release: { lower: '3.5', upper: '3.75' } });
  });
});
