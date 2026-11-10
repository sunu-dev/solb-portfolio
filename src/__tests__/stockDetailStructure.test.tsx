import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AnalysisNavigation from '@/components/analysis/AnalysisNavigation';
import StockDetailIntroduction from '@/components/analysis/StockDetailIntroduction';
import StockCompanyOverview from '@/components/analysis/StockCompanyOverview';
import { companyStory } from '@/lib/companyStories';
import { getStoredIndustry } from '@/lib/storedIndustry';
import type { SectorProfile } from '@/lib/sectorExploration';

const noop = () => {};
const plain = (html: string) => html.replace(/<[^>]*>/g, '');
describe('common detail reading structure', () => {
  it('provides three clear destinations while retaining chart and personal anchors', () => {
    const html = renderToStaticMarkup(<AnalysisNavigation scrollRef={{ current: null }} hasChart hasCheckup hasResources hasAssistant hasPersonal layoutKey="TEST" />);
    expect(html.match(/<button/g)).toHaveLength(3);
    for (const label of ['지금 상황', '회사 이해', '내 투자']) expect(html).toContain(label);
    for (const id of ['anchor-overview', 'anchor-company', 'anchor-personal']) expect(html).toContain(`aria-controls="${id}"`);
    expect(html).not.toContain('주비 노트');
  });
  it('uses product understanding for a fund, and omits personal navigation when no personal section exists', () => {
    const html = renderToStaticMarkup(<AnalysisNavigation scrollRef={{ current: null }} hasChart hasResources hasAssistant isFund layoutKey="SOXL" />);
    expect(html.match(/<button/g)).toHaveLength(2); expect(html).toContain('상품 이해'); expect(html).not.toContain('회사 이해');
    expect(html).not.toContain('anchor-personal');
  });
  it('shows a known company headline and a reachable reading destination before the chart', () => {
    const html = renderToStaticMarkup(<StockDetailIntroduction symbol="340810.KQ" name="시선AI" isFund={false} onOpen={noop} />);
    expect(html).toContain('PC 화면을 보호하는 회사'); expect(html).toContain('시선AI 회사 이해로 이동');
  });
  it.each(['loading', 'rechecking', 'unavailable'] as const)('never resurrects a static headline while company evidence is %s', availability => {
    const profile: SectorProfile = { business: { symbol: '340810.KQ', level: 'missing', origin: 'engine', availability, sources: [] } };
    const html = renderToStaticMarkup(<StockDetailIntroduction symbol="340810.KQ" name="시선AI" isFund={false} profile={profile} onOpen={noop} />);
    expect(html).not.toContain('PC 화면을 보호하는 회사'); expect(html).not.toContain('얼굴인식');
  });
  it('reuses the known fund structure without describing SOXL as an operating company', () => {
    const html = renderToStaticMarkup(<StockDetailIntroduction symbol="SOXL" name="SOXL" isFund onOpen={noop} />);
    expect(plain(html)).toContain('반도체 기업'); expect(html).toContain('SOXL 상품 이해로 이동');
    expect(html).not.toContain('어떻게 돈을 버나요');
  });
  it('shows each sourced customer and revenue paragraph once and does not create an empty diagram disclosure', () => {
    const story = companyStory('340810.KQ')!;
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="340810.KQ" name="시선AI" profile={{ classification: getStoredIndustry('340810.KQ') }} />);
    const text = plain(html);
    expect(text.split(story.revenue)).toHaveLength(2); expect(text.split(story.customers)).toHaveLength(2);
    expect(html).not.toContain('돈이 들어오는 과정 살펴보기');
    expect(html).toContain('알체라·피앤피시큐어'); expect(html).toContain('secern.ai');
  });
  it('keeps an actual business diagram available for a supported company', () => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="MSFT" name="마이크로소프트" />);
    expect(html).toContain('돈이 들어오는 과정 살펴보기'); expect(html).toContain('고객의 사용이 매출로 이어지는 사업 구조');
  });
});
