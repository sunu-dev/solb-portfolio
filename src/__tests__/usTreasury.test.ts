import { describe, it, expect } from 'vitest';
import { parseTreasuryXml, toUs10Y } from '@/lib/usTreasury';

/** 실제 피드(OData Atom) 형태를 축약한 fixture 생성기 */
function entry(date: string, y: string | null): string {
  return `<entry>
<id>x</id>
<content type="application/xml">
<m:properties>
<d:Id m:type="Edm.Int32">1</d:Id>
<d:NEW_DATE m:type="Edm.DateTime">${date}T00:00:00</d:NEW_DATE>
<d:BC_2YEAR m:type="Edm.Double">4.19</d:BC_2YEAR>
${y === null ? '' : `<d:BC_10YEAR m:type="Edm.Double">${y}</d:BC_10YEAR>`}
<d:BC_30YEAR m:type="Edm.Double">4.90</d:BC_30YEAR>
</m:properties>
</content>
</entry>`;
}

describe('parseTreasuryXml', () => {
  it('entry마다 날짜와 10년물을 뽑고 다른 만기(2Y·30Y)와 혼동하지 않는다', () => {
    const xml = `<feed>${entry('2026-08-15', '4.67')}${entry('2026-08-18', '4.72')}</feed>`;
    expect(parseTreasuryXml(xml)).toEqual([
      { date: '2026-08-15', yield10y: 4.67 },
      { date: '2026-08-18', yield10y: 4.72 },
    ]);
  });

  it('날짜 역순 입력도 오름차순으로 정렬한다', () => {
    const xml = `<feed>${entry('2026-08-18', '4.72')}${entry('2026-08-15', '4.67')}</feed>`;
    expect(parseTreasuryXml(xml).map(p => p.date)).toEqual(['2026-08-15', '2026-08-18']);
  });

  it('BC_10YEAR가 없거나 숫자가 아닌 entry는 버린다', () => {
    const xml = `<feed>${entry('2026-08-15', null)}${entry('2026-08-16', 'N/A')}${entry('2026-08-18', '4.72')}</feed>`;
    expect(parseTreasuryXml(xml)).toEqual([{ date: '2026-08-18', yield10y: 4.72 }]);
  });

  it('빈 문서는 빈 배열', () => {
    expect(parseTreasuryXml('<feed></feed>')).toEqual([]);
  });
});

describe('toUs10Y', () => {
  it('최신 값과 전 영업일 대비 %p를 계산한다 (부동소수점 반올림 포함)', () => {
    const r = toUs10Y([
      { date: '2026-08-15', yield10y: 4.67 },
      { date: '2026-08-18', yield10y: 4.72 },
    ]);
    expect(r).toEqual({ yield10y: 4.72, changePp: 0.05, asOfDate: '2026-08-18', prevDate: '2026-08-15' });
  });

  it('하락도 부호 그대로', () => {
    const r = toUs10Y([
      { date: '2026-08-15', yield10y: 4.72 },
      { date: '2026-08-18', yield10y: 4.6 },
    ]);
    expect(r?.changePp).toBe(-0.12);
  });

  it('비교 대상이 없으면 changePp는 null — 0으로 위장하지 않는다', () => {
    const r = toUs10Y([{ date: '2026-08-18', yield10y: 4.72 }]);
    expect(r?.changePp).toBeNull();
    expect(r?.prevDate).toBeNull();
  });

  it('빈 시계열은 null', () => {
    expect(toUs10Y([])).toBeNull();
  });
});
