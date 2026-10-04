import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

function boundedNumber(value: string | null, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : 0;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnPct = boundedNumber(searchParams.get('return'), -100, 999999);
  const gainRatio = boundedNumber(searchParams.get('gainRatio') ?? searchParams.get('winRate'), 0, 100);
  const holdings = Math.floor(boundedNumber(searchParams.get('holdings'), 0, 10000));
  const isSample = searchParams.get('sample') === '1';
  const isPartial = searchParams.get('partial') === '1';

  return new ImageResponse(
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 64px', background: '#FFFFFF', color: '#191F28', fontFamily: 'sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <svg width="48" height="48" viewBox="0 0 40 40" fill="none"><path d="M7 31 L15 20 L22 24 L33 10" stroke="#EF4452" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" /><circle cx="33" cy="10" r="3.2" fill="#EF4452" /></svg>
        <span style={{ fontSize: 30, fontWeight: 800 }}>주비</span>
        <span style={{ fontSize: 20, color: '#4E5968', marginLeft: 12 }}>{isSample ? '샘플 포트폴리오 · 가상 보유 예시' : '내 포트폴리오'}</span>
      </div>
      {isSample && <div style={{ display: 'flex', padding: '14px 18px', marginBottom: 22, borderRadius: 12, background: '#F2F4F6', fontSize: 19, color: '#4E5968' }}>실제 투자 성과가 아닌 체험용 가상 보유 예시예요.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 30 }}>
        <span style={{ fontSize: 21, color: '#4E5968', marginBottom: 10 }}>현재 평가수익률 · 원화 기준</span>
        <span style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.15, color: returnPct === 0 ? '#191F28' : returnPct > 0 ? '#D12F40' : '#2565BF' }}>{returnPct > 0 ? '+' : ''}{returnPct.toFixed(1)}%</span>
      </div>
      <div style={{ display: 'flex', gap: 56 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 19, color: '#4E5968' }}>평가이익 종목 비율</span><span style={{ fontSize: 30, fontWeight: 700 }}>{Math.round(gainRatio)}%</span></div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><span style={{ fontSize: 19, color: '#4E5968' }}>시세가 확인된 종목</span><span style={{ fontSize: 30, fontWeight: 700 }}>{holdings}개</span></div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'auto', paddingTop: 24, fontSize: 17, color: '#4E5968' }}><span>{isPartial ? '시세가 없는 종목은 계산에서 제외했어요. ' : ''}매매 성공률이나 확정된 수익을 뜻하지 않아요.</span><span>joobi.kr</span></div>
    </div>,
    { width: 1200, height: 630 },
  );
}
