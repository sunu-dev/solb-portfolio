import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { IntradayCandles } from '@/lib/intradayCandles';
import IntradayPriceSummary from '@/components/analysis/IntradayPriceSummary';
import StockCompanyOverview from '@/components/analysis/StockCompanyOverview';
import { companyBusinessProfile } from '@/lib/companyBusinessProfile';
import { companyStory } from '@/lib/companyStories';
import { getStoredIndustry } from '@/lib/storedIndustry';
import { industryGroup, type IndustryGroup } from '@/lib/industryRegistry';
import CatalogIndustryExploration from '@/components/explore/CatalogIndustryExploration';
import ContextExploration from '@/components/explore/ContextExploration';

vi.mock('react', async () => ({ ...await vi.importActual<typeof import('react')>('react'), useEffectEvent: (fn: unknown) => fn }));
const capture = vi.hoisted(() => ({ exit: undefined as undefined | (() => void) }));
vi.mock('@/components/explore/CatalogIndustryExploration', async () => {
  const actual = await vi.importActual<typeof import('@/components/explore/CatalogIndustryExploration')>('@/components/explore/CatalogIndustryExploration');
  return { ...actual, default: (props: Parameters<typeof actual.default>[0]) => { capture.exit = props.onExit; return <actual.default {...props} />; } };
});
const candles: IntradayCandles = { s: 'ok', interval: '5m', timeZone: 'Asia/Seoul', sessionDate: '2026-11-03', asOf: 1793685600,
  t: [1793678400, 1793678700], o: [2820, 2810], c: [2800, 2790], h: [2950, 2820], l: [2710, 2780], v: [10, 20] };
const profile = getStoredIndustry('340810.KQ');
const group = industryGroup(profile.industryId)!;
const handlers = { onIndustry: vi.fn(), onTopic: vi.fn(), onSector: vi.fn(), onExit: vi.fn(), onCompany: vi.fn() };
const clean = (html: string) => html.replace(/<[^>]*>/g, '');

describe('intraday range uses actual highs and lows', () => {
  it('separates extremes from the line closes and explains the difference', () => {
    const html = renderToStaticMarkup(<IntradayPriceSummary data={candles} currency="KRW" />);
    expect(clean(html)).toContain('최저2,710원최고2,950원');
    expect(clean(html)).toContain('마지막 가격2,790원'); expect(html).not.toContain('5분 구간 가격은');
    expect(html).toContain('aria-valuemin="2710"'); expect(html).toContain('aria-valuemax="2950"'); expect(html).toContain('aria-valuenow="2790"');
    expect(html).toContain('마지막으로 거래된 가격'); expect(html).toContain('그 사이에 더 낮거나 높은');
    expect(html).toContain('아직 받지 못한 거래'); expect(html).toContain('<dl');
    expect(html).not.toMatch(/<details[^>]*open/);
  });
  it('keeps native dollars and uses a suitable explanation for candlesticks', () => {
    const html = renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, l: [12.34], h: [15.67] }} currency="USD" level="detail" />);
    expect(html).toContain('$12.34'); expect(html).toContain('$15.67'); expect(html).not.toContain('원');
    expect(html).not.toContain('선과 가격 범위');
  });
  it('does not render zero or non-finite extremes as real prices', () => {
    for (const bad of [{ l: [], h: [] }, { l: [0], h: [10] }, { l: [NaN], h: [10] }, { l: [1], h: [Infinity] }, { l: [20], h: [10] }]) {
      expect(renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, ...bad }} currency="KRW" />)).toBe('');
    }
  });
  it('does not clamp an invalid last price into the displayed range', () => {
    for (const close of [0, NaN, Infinity, 3000, 2700]) {
      const html = renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, c: [2800, close] }} currency="KRW" />);
      expect(html).not.toContain('role="meter"'); expect(html).not.toContain('마지막 가격'); expect(html).toContain('2,710원');
    }
  });
  it('keeps exact range endpoints and avoids a fake percentage for a flat range', () => {
    for (const close of [2710, 2950]) {
      const html = renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, c: [2800, close], l: [2710, 2710], h: [2950, 2950] }} currency="KRW" />);
      expect(html).toContain(`aria-valuenow="${close}"`);
    }
    const flat = renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, o: [100], c: [100], h: [100], l: [100] }} currency="KRW" />);
    expect(flat).toContain('가격이 같았어요'); expect(flat).not.toContain('role="meter"'); expect(flat).not.toMatch(/NaN|Infinity/);
  });
  it('does not describe rounded fractional differences as zero dollars higher', () => {
    const html = renderToStaticMarkup(<IntradayPriceSummary data={{ ...candles, c: [12.3401], l: [12.34], h: [15.67] }} currency="USD" />);
    expect(html).toContain('최저 가격 근처'); expect(html).not.toContain('$0.00');
  });
});

describe('Siseon AI company understanding', () => {
  it('uses a sourced company explanation for both Korean symbol forms', () => {
    for (const symbol of ['340810', '340810.KQ']) {
      const business = companyBusinessProfile(symbol, profile);
      expect(business.level).toBe('detailed'); expect(business.summary).toContain('PC 화면');
      expect(business.customers).toContain('금융회사'); expect(business.revenue).toContain('설치·연결');
      expect(business.watch).toContain('새 계약과 실제 매출');
      expect(business.sources.some(source => source.url.includes('20260320000041'))).toBe(true);
      expect(business.sources.some(source => source.url.includes('secern.ai/'))).toBe(true);
    }
  });
  it('puts company products and revenue before broad industry exploration and exposes all actual answers', () => {
    const story = companyStory('340810.KQ')!;
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="340810.KQ" name="시선AI" profile={{ classification: profile }} />);
    expect(html.indexOf('얼굴로 본인을 확인하는')).toBeLessThan(html.indexOf('data-explanation-entry'));
    expect(html.indexOf('설치·연결하는 작업에서 매출')).toBeLessThan(html.indexOf('data-explanation-entry'));
    for (const question of story.questions) { expect(html).toContain(question.question); expect(html).toContain(question.answer); }
    expect(html).not.toContain('플랫폼예요'); expect(html).not.toContain('산업의 기업 예시를 살펴봐요');
    expect(html).not.toContain('제공된 업종 분류');
  });
  it('keeps engine withdrawal and security restrictions ahead of the editorial story', () => {
    const withheld = companyBusinessProfile('340810.KQ', profile, { symbol: '340810.KQ', level: 'missing', origin: 'engine', sources: [], availability: 'rechecking' });
    expect(withheld.level).toBe('missing'); expect(withheld.summary).toBeUndefined();
    expect(companyBusinessProfile('340810.KQ', { ...profile, status: 'etp' }).level).toBe('restricted');
  });
});

describe('classification is a compact list, not an invented business relationship', () => {
  it('shows product-bearing other companies without the generic picture or the originating company', () => {
    const html = renderToStaticMarkup(<CatalogIndustryExploration {...handlers} group={group} current={profile} context="정보기술" />);
    expect(html).toContain('같은 업종으로 분류된 회사'); expect(html).toContain('만드는 제품과 고객은 다를 수');
    expect(html).not.toContain('시선AI와 같은 업종에는'); expect(html).not.toContain('aria-label="시선AI"');
    expect(html).not.toContain('<figure'); expect(html).not.toContain('<img');
    expect(html).toContain('매출과 이익의 차이');
    expect(html).not.toContain('이것도 궁금하지 않으세요');
  });
  it('preserves a previously selected originating company and shows its actual explanation', () => {
    const html = renderToStaticMarkup(<CatalogIndustryExploration {...handlers} group={group} current={profile} context="정보기술" selectedCompanySymbol="340810.KQ" />);
    expect(html).toContain('시선AI는 어떤 회사인가요?'); expect(html).toContain('SEEU ON');
    expect(html).toContain('시선AI 종목으로 이동'); expect(html).not.toContain('<figure');
  });
  it('describes an empty comparison list as a Joobi coverage gap', () => {
    const empty: IndustryGroup = { ...group, examples: [{ symbol: profile.symbol, name: profile.name, marketCap: null }] };
    const html = renderToStaticMarkup(<CatalogIndustryExploration {...handlers} group={empty} current={profile} context="정보기술" />);
    expect(html).toContain('아직 주비 목록에 없어요'); expect(html).not.toContain('aria-label="시선AI"');
  });
  it('the first industry back action closes the enclosing reader rather than replacing it with another generic sector page', () => {
    const close = vi.fn();
    renderToStaticMarkup(<ContextExploration topics={['compare']} context="정보기술" industryOnly symbol="340810.KQ" profile={{ classification: profile }} onClose={close} />);
    expect(capture.exit).toBeTypeOf('function'); capture.exit!(); expect(close).toHaveBeenCalledOnce();
  });
});
