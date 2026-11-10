import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { getStoredIndustry } from '@/lib/storedIndustry';
import StockCompanyOverview from '@/components/analysis/StockCompanyOverview';

describe('company-first reading', () => {
  it('shows verified revenue without opening an industry or business disclosure', () => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="MSFT" name="마이크로소프트" />);
    expect(html.indexOf('Azure 등 클라우드 사용료')).toBeLessThan(html.indexOf('<details'));
    expect(html).toContain('2025 연차보고서');
  });
  it('does not turn a summary-only company into a fabricated revenue breakdown', () => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="TSLA" name="테슬라" />);
    expect(html).toContain('자세한 수익 구조는 아직 정리하지 못했어요');
    expect(html).not.toContain('어떻게 돈을 버나요?');
  });
  it('labels unknown businesses as information rather than a company explanation', () => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="UNKNOWN" name="미확인" />);
    expect(html).toContain('종목·업종 정보');
    expect(html).toContain('이 회사의 사업 소개는 주비에 아직 준비되지 않았어요');
    expect(html).not.toContain('어떤 회사인가요?');
    expect(html).not.toContain('<figure');
    expect(html).not.toContain('data-company-reading-guide');
  });
  it.each(['NFLX', '009150.KS', 'MSFT', 'TSLA'])('keeps fictional earnings out of %s and its reading guide closed', symbol => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol={symbol} name={symbol} profile={{ classification: getStoredIndustry(symbol) }} />);
    expect(html).not.toMatch(/20%|10%|기대에는 못 미쳤|시장 예상.*실제 결과/);
    expect(html).toMatch(/<details[^>]*data-company-reading-guide/);
    expect(html).not.toMatch(/<details[^>]*open/);
    expect(html).toContain('이 종목의 실적 평가나 등락 이유를 뜻하지 않아요');
  });
  it('keeps sourced business facts visible for Netflix, without a fictional market verdict', () => {
    const html = renderToStaticMarkup(<StockCompanyOverview symbol="NFLX" name="넷플릭스" />);
    expect(html).toContain('회원 구독료가 주된 수입');
    expect(html).toContain('광고주도 고객');
    expect(html).toContain('2025 연차보고서');
    expect(html).toContain('aria-label="사업 설명의 근거"');
    expect(html).not.toContain('아직 준비되지');
  });
});
