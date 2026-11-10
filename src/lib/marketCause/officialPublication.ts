import type { OfficialPolicyCard, OfficialPolicyFeed, OfficialSnapshot } from './officialTypes';
import { canonicalPolicyUrl, parsePolicyEvidence, POLICY_RELEASE_VERSION } from './sources/policyRelease';
import { instant } from './normalizeFacts';
import { requireServiceClient } from '../supabaseServer';
/** Public projection is rebuilt from a strict parser, not stored model prose. */
export function projectPolicyCard(snapshot: OfficialSnapshot, now: string): OfficialPolicyCard | null {
  const r = snapshot.release;
  if (!r || snapshot.status === 'withheld' || r.policy !== POLICY_RELEASE_VERSION || !['fed', 'bok'].includes(r.authority)) return null;
  const times = [now, snapshot.checkedAt, r.observedAt, r.publishedAt].map(instant);
  if (!times.every(Number.isFinite) || times[1] > times[0] || times[2] > times[1] || times[3] > times[2]
    || times[0] - times[2] > 36 * 3600000 || times[0] - times[3] > 90 * 86400000 || !/^[a-f0-9]{64}$/.test(r.contentHash)) return null;
  try {
    if (canonicalPolicyUrl(r.authority, r.url) !== r.url) return null;
    const checked = parsePolicyEvidence(r.authority, r.evidence);
    if (checked.action !== r.action || checked.lower !== r.lower || checked.upper !== r.upper) return null;
  } catch { return null; }
  const isUS = r.authority === 'fed';
  const label = isUS ? '미국 연준' : '한국은행';
  const rate = r.lower === r.upper ? `${r.lower}%` : `${r.lower}~${r.upper}%`;
  const verb = r.action === 'hold' ? '유지했어요' : r.action === 'raise' ? '올렸어요' : '내렸어요';
  return { id: `${r.authority}:${r.contentHash}`, authority: r.authority, market: isUS ? 'us' : 'kr',
    title: `${label}, ${isUS ? '목표금리' : '기준금리'} ${rate} ${r.action === 'hold' ? '동결' : r.action === 'raise' ? '인상' : '인하'}`,
    summary: `${label}이 ${isUS ? '정책금리의 목표 범위를' : '기준금리를'} ${rate}로 ${verb}.`,
    meaning: '정책금리는 중앙은행이 정하는 돈의 가격이에요. 대출 이자와 기업이 자금을 구하는 비용에 영향을 줘요.',
    path: r.action === 'hold' ? ['정책금리를 그대로 유지했어요.', '대출·채권 금리는 앞으로의 금리 전망에 따라 따로 움직일 수 있어요.', '기업의 이자 부담과 실적 전망이 달라지는지 함께 봐요.']
      : r.action === 'raise' ? ['정책금리를 올렸어요.', '다른 조건이 같다면 돈을 빌리는 비용이 높아질 수 있어요.', '대출이 많은 기업의 이익이나 소비·투자에 부담이 될 수 있어요.']
        : ['정책금리를 내렸어요.', '다른 조건이 같다면 돈을 빌리는 비용이 낮아질 수 있어요.', '기업의 이자 부담이 줄 수 있지만 경기 둔화에 대응한 결정인지도 봐야 해요.'],
    condition: '이 경로는 일반적인 영향 설명이에요. 실제 주가 반응은 발표 전 예상, 환율과 기업 상황에 따라 달라져요. 이번 주가 변동의 원인으로 확인한 내용은 아니에요.',
    watch: isUS ? '미국 국채금리와 원·달러 환율, 보유 기업의 이자 비용과 달러 매출을 함께 살펴보세요.' : '국내 대출·채권 금리와 원·달러 환율, 보유 기업의 차입 부담을 함께 살펴보세요.',
    publishedAt: r.publishedAt, checkedAt: r.observedAt, sourceUrl: r.url, corrected: snapshot.corrected };
}
/** One service-only read of two fixed public-source heads. Never runs collectors,
 * models, writes or accesses user rows. A failed gate/read returns no new cards. */
export async function readOfficialPolicies(now = new Date().toISOString()): Promise<OfficialPolicyFeed> {
  try {
    const { data, error } = await requireServiceClient().rpc('read_market_cause_official');
    if (error || !data || data.enabled !== true || !Array.isArray(data.snapshots)) return { cards: [], warnings: [] };
    const cards: OfficialPolicyCard[] = []; const warnings: string[] = [];
    for (const snapshot of data.snapshots.slice(0, 2) as OfficialSnapshot[]) {
      const card = projectPolicyCard(snapshot, now);
      if (card) cards.push(card);
      if (!card || snapshot.status !== 'verified') warnings.push('일부 기준금리 발표 자료를 다시 확인 중이에요. 확인 시각과 공식 원문을 함께 봐주세요.');
    }
    return { cards, warnings: [...new Set(warnings)] };
  } catch { return { cards: [], warnings: [] }; }
}
