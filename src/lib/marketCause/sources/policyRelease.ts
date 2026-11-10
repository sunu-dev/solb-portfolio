import { digest, instant, validDay } from '../normalizeFacts';
import type { PolicyAuthority, PolicyRelease } from '../officialTypes';

export const POLICY_RELEASE_VERSION = 'official-policy-v1';
export const POLICY_FEEDS = {
  fed: 'https://www.federalreserve.gov/feeds/press_monetary.xml',
  bok: 'https://www.bok.or.kr/portal/bbs/P0000559/news.rss?',
} as const;
export interface PolicyLink { authority: PolicyAuthority; url: string; publishedAt: string }
function decode(text: string): string {
  return text.replace(/&#(x[\da-f]+|\d+);/gi, (_, n: string) => {
    const value = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : '';
  }).replace(/&nbsp;/gi, ' ').replace(/&quot;/gi, '"').replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&amp;/gi, '&');
}
export function canonicalPolicyUrl(authority: PolicyAuthority, raw: string): string {
  const u = new URL(raw);
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash) throw new Error('policy_source_identity');
  if (authority === 'fed') {
    if (u.hostname !== 'www.federalreserve.gov' || !/^\/newsevents\/pressreleases\/monetary\d{8}a\.htm$/.test(u.pathname) || u.search) throw new Error('policy_source_identity');
    return u.href;
  }
  const id = u.searchParams.get('nttId');
  if (u.hostname !== 'www.bok.or.kr' || u.pathname !== '/portal/bbs/P0000559/view.do' || !/^\d{8}$/.test(id ?? '')) throw new Error('policy_source_identity');
  // The official RSS emits an empty menuNo, which returns 404. Use the same
  // release ID with the official monetary-policy press section's menu number.
  return `https://www.bok.or.kr/portal/bbs/P0000559/view.do?nttId=${id}&menuNo=200690`;
}
export function parsePolicyFeed(xml: string, authority: PolicyAuthority, now: string): PolicyLink[] {
  if (!Number.isFinite(instant(now)) || Buffer.byteLength(xml) > 2_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('invalid_policy_feed');
  const tag = (item: string, name: string) => decode(item.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '') ?? '').trim();
  const out: PolicyLink[] = [];
  for (const item of xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? []) {
    const title = tag(item, 'title');
    if (authority === 'fed' ? title !== 'Federal Reserve issues FOMC statement' : !/^통화정책방향\(20\d{2}\.\d{1,2}\.\d{1,2}\)$/.test(title)) continue;
    const time = Date.parse(tag(item, 'pubDate'));
    if (!Number.isFinite(time) || time > Date.parse(now)) continue;
    const url = canonicalPolicyUrl(authority, tag(item, 'link'));
    const publishedAt = new Date(time).toISOString();
    const day = authority === 'fed' ? url.match(/monetary(\d{4})(\d{2})(\d{2})a/)?.slice(1).join('-')
      : title.match(/\((\d{4})\.(\d{1,2})\.(\d{1,2})\)/)?.slice(1).map(v => v.padStart(2, '0')).join('-');
    // BOK is dated in Korea; FED releases happen on the same UTC calendar day.
    const dated = new Date(time + (authority === 'bok' ? 9 * 3600000 : 0)).toISOString().slice(0, 10);
    if (!day || !validDay(day) || day !== dated) throw new Error('policy_date_mismatch');
    out.push({ authority, url, publishedAt });
  }
  return [...new Map(out.map(item => [item.url, item])).values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}
function paragraphs(html: string): string[] {
  const clean = html.replace(/<!--[^]*?-->/g, '').replace(/<(head|script|style|table|noscript)\b[^>]*>[^]*?<\/\1>/gi, '')
    .replace(/<([a-z][\w:-]*)\b[^>]*(?:\bhidden\b|aria-hidden=["']true["']|display\s*:\s*none)[^>]*>[^]*?<\/\1>/gi, '');
  return [...clean.matchAll(/<p\b[^>]*>([^]*?)<\/p>/gi)]
    .map(([, p]) => decode(p.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim()).filter(p => p.length <= 8000);
}
function rate(raw: string): string {
  const value = raw.trim().replace(/[‐‑–]/g, '-');
  const mixed = value.match(/^(\d+)-(1\/4|1\/2|3\/4)$/);
  const fractions: Record<string, number> = { '1/4': .25, '1/2': .5, '3/4': .75 };
  const n = mixed ? Number(mixed[1]) + fractions[mixed[2]] : Object.hasOwn(fractions, value) ? fractions[value] : /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0 || n > 30) throw new Error('policy_rate_invalid');
  return String(n);
}
/** Only the committee's actual decision sentence qualifies. Votes, forecasts,
 * dissent and mentions of previous meetings cannot supply the current rate. */
export function parsePolicyEvidence(authority: PolicyAuthority, evidence: string): Pick<PolicyRelease, 'action' | 'lower' | 'upper'> {
  if (evidence.length > 8000) throw new Error('policy_evidence_limit');
  if (authority === 'fed') {
    const m = evidence.match(/^The Committee (?:decided|seeks) to (maintain|raise|lower) the target range for the federal funds rate (?:by [\d/ -]+ percentage points? )?(?:at|to) ([\d/ .‐‑–-]+) to ([\d/ .‐‑–-]+) percent(?:[,.]|$)/);
    if (!m) throw new Error('policy_decision_unparsed');
    const lower = rate(m[2]), upper = rate(m[3]);
    if (Number(upper) < Number(lower) || Number(upper) - Number(lower) > 1) throw new Error('policy_range_invalid');
    return { action: m[1] === 'maintain' ? 'hold' : m[1] === 'raise' ? 'raise' : 'cut', lower, upper };
  }
  const held = evidence.match(/^(?:□\s*)?금융통화위원회는 다음 통화정책방향 결정시까지 한국은행 기준금리를 현 수준\((\d+(?:\.\d{1,2})?)%\)에서 유지하여 통화정책을 운용하기로 하였다\./);
  if (held) return { action: 'hold', lower: rate(held[1]), upper: rate(held[1]) };
  const m = evidence.match(/^(?:□\s*)?금융통화위원회는 다음 통화정책방향 결정시까지 한국은행 기준금리를 현재의 (\d+(?:\.\d{1,2})?)% 수준에서 (?:(유지)하여|(\d+(?:\.\d{1,2})?)%로 (상향|하향) 조정하여) 통화정책을 운용하기로 하였다\./);
  if (!m) throw new Error('policy_decision_unparsed');
  const previous = rate(m[1]), current = m[2] ? previous : rate(m[3]);
  const action = m[2] ? 'hold' : m[4] === '상향' ? 'raise' : 'cut';
  if (action === 'raise' && Number(current) <= Number(previous) || action === 'cut' && Number(current) >= Number(previous)) throw new Error('policy_direction_conflict');
  return { action, lower: current, upper: current };
}
export function parsePolicyRelease(link: PolicyLink, html: string, observedAt: string): PolicyRelease {
  if (canonicalPolicyUrl(link.authority, link.url) !== link.url || !Number.isFinite(instant(observedAt))
    || !Number.isFinite(instant(link.publishedAt)) || instant(link.publishedAt) > instant(observedAt) || Buffer.byteLength(html) > 2_000_000) throw new Error('policy_source_invalid');
  const date = new Date(instant(link.publishedAt) + (link.authority === 'bok' ? 9 * 3600000 : 0));
  const visibleDate = link.authority === 'fed'
    ? new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(date)
    : `${date.getUTCFullYear()}.${date.getUTCMonth() + 1}.${date.getUTCDate()}`;
  const header = link.authority === 'fed' ? html.match(/<p\b[^>]*class=["']article__time["'][^>]*>([^<]*)<\/p>/i)?.[1]?.trim()
    : html.match(/<title>([^]*?)<\/title>/i)?.[1]?.match(/통화정책방향\(([^)]+)\)/)?.[1];
  if (header !== visibleDate) throw new Error('policy_document_date_mismatch');
  const candidates = paragraphs(html).filter(p => link.authority === 'fed' ? /^The Committee (?:decided|seeks) to (?:maintain|raise|lower) the target range for the federal funds rate/.test(p)
    : /^(?:□\s*)?금융통화위원회는 다음 통화정책방향 결정시까지 한국은행 기준금리를/.test(p));
  if (candidates.length !== 1) throw new Error('policy_ambiguous_decision');
  const evidence = candidates[0];
  return { ...link, observedAt, contentHash: digest(paragraphs(html)), policy: POLICY_RELEASE_VERSION, evidence, ...parsePolicyEvidence(link.authority, evidence) };
}
export async function fetchPolicyText(url: string, fetcher: typeof fetch = fetch): Promise<string> {
  const allowed = Object.values(POLICY_FEEDS).includes(url as typeof POLICY_FEEDS.fed) || (['fed', 'bok'] as const).some(authority => {
    try { return canonicalPolicyUrl(authority, url) === url; } catch { return false; }
  });
  if (!allowed) throw new Error('policy_source_identity');
  const r = await fetcher(url, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(12000), headers: { 'User-Agent': 'Joobi/1.0 sunu.develop@gmail.com' } });
  if (!r.ok) throw new Error(r.status === 404 || r.status === 410 ? 'policy_source_removed' : 'policy_transport_unavailable');
  if (!r.body || Number(r.headers.get('content-length')) > 2_000_000) throw new Error('policy_source_limit');
  const reader = r.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; length += value.length;
    if (length > 2_000_000) throw new Error('policy_source_limit'); chunks.push(value); }
  } finally { await reader.cancel().catch(() => undefined); }
  return Buffer.concat(chunks).toString('utf8');
}
