import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import ContextExploration from '@/components/explore/ContextExploration';

describe('stock detail reading entry', () => {
  it('starts with a company-specific question and previews the hidden reading', () => {
    const html = renderToStaticMarkup(<ContextExploration symbol="NVDA" context="엔비디아" topics={['earnings']} />);
    expect(html).toContain('엔비디아는 어떤 회사인가요?');
    expect(html.indexOf('엔비디아는 어떤 회사인가요?')).toBeLessThan(html.indexOf('사업별로 보기'));
    expect(html.indexOf('엔비디아와 메모리 회사는 경쟁 상대인가요?')).toBeLessThan(html.indexOf('HBM이 뭐길래'));
    expect(html).toContain('연결된 질문 더 보기');
    // A source-only company must not promise a customer/revenue explanation.
    expect(html).not.toContain('어떻게 돈을 벌고, 누가 이 제품을 쓸까요?');
  });
  it('offers the existing reviewed business explanation where it is available', () => {
    const html = renderToStaticMarkup(<ContextExploration symbol="MSFT" context="마이크로소프트" topics={['earnings']} />);
    expect(html).toContain('어떻게 돈을 벌고, 누가 이 제품을 쓸까요?');
    expect(html).toContain('data-company-business="MSFT"');
    expect(html).toContain('어떻게 돈을 버나요?');
  });
  it('keeps general exploration independent from company-specific copy', () => {
    const html = renderToStaticMarkup(<ContextExploration context="내 투자" topics={['earnings']} />);
    expect(html).toContain('먼저 이 질문부터');
    expect(html).not.toContain('이 회사를 이해하는 다음 질문');
  });
});
