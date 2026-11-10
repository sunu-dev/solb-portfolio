import { describe, expect, it } from 'vitest';
import { contractContext } from '@/lib/contractContext';
import { discoveryTags } from '@/config/stockQuestions';
describe('contract headlines are not interchangeable',()=>{
  it('does not classify a quarterly dividend or schedule as earnings without earnings evidence',()=>{
    expect(discoveryTags('다음 분기 배당 지급 일정')).toEqual(['dividends']);
    expect(discoveryTags('다음 분기 주주총회 개최')).not.toContain('earnings');
    expect(discoveryTags('분기 영업이익 발표')).toContain('earnings');
  });
  it.each([
    'Allarity Therapeutics, Tumim Stone Capital과 600만 달러 주식 매입 계약 종료',
    'Acme terminates stock purchase agreement with Investor',
    '신규 주식 인수 계약 체결', '대출 계약 체결', '임대차 계약 연장', '계약 관련 안내',
    '납품 계약 해지', '신규 공급 계약 협상', '회사가 공급 계약 체결을 추진',
  ])('does not recommend backlog for %s',title=>expect(discoveryTags(title)).not.toContain('backlog'));
  it.each(['회사가 신규 수주 계약을 발표했다','반도체 공급 계약 체결','Acme enters supply agreement','수주 잔고 증가'])('preserves sales concepts for %s',title=>expect(discoveryTags(title)).toContain('backlog'));
  it('does not let another article suppress a genuine sales article',()=>{
    const titles=['주식 매입 계약 종료','고객과 반도체 공급 계약 체결'];
    expect([...new Set(titles.flatMap(discoveryTags))]).toContain('backlog');
    expect(contractContext(titles[0]).kind).toBe('securities');
  });
});

