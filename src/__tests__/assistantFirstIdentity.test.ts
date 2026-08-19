import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MENU_ITEMS } from '@/lib/menuRegistry';

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

describe('개인 주식비서 우선 IA', () => {
  it('홈은 브리핑·자산을 먼저 렌더하고 기록 도구는 핵심 탭 뒤에 둔다', () => {
    const portfolio = source('../components/portfolio/PortfolioSection.tsx');
    const briefing = portfolio.indexOf('<MorningBriefing />');
    const dashboard = portfolio.indexOf('<Dashboard />');
    const recordCenter = portfolio.indexOf('<PortfolioRecordCenter', dashboard);
    const analysisTab = portfolio.indexOf("subTab === 'analysis'");

    expect(briefing).toBeGreaterThan(0);
    expect(dashboard).toBeGreaterThan(briefing);
    expect(recordCenter).toBeGreaterThan(analysisTab);
  });

  it('기록 도구는 기본 접힘 상태와 접근성 속성을 갖는다', () => {
    const recordCenter = source('../components/portfolio/PortfolioRecordCenter.tsx');
    expect(recordCenter).toContain('useState(false)');
    expect(recordCenter).toContain('aria-expanded={expanded}');
    expect(recordCenter).toContain('기록·가져오기·복구');
  });

  it('메뉴의 첫 약속은 기록이 아니라 자산·손익·챙길 일이다', () => {
    expect(MENU_ITEMS[0]).toMatchObject({
      id: 'portfolio',
      sub: '자산·손익·챙길 일',
    });
  });
});
