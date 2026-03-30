import { ImageResponse } from 'next/og';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const returnPct = searchParams.get('return') || '0';
  const winRate = searchParams.get('winRate') || '0';
  const holdings = searchParams.get('holdings') || '0';
  const isGain = parseFloat(returnPct) >= 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '60px',
          background: 'linear-gradient(135deg, #0F2419 0%, #0F1B3D 50%, #1A1D2E 100%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'linear-gradient(135deg, #1B6B3A, #3182F6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
          }}>S</div>
          <span style={{ fontSize: 24, fontWeight: 700 }}>SOLB</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>폭풍우에도 흔들리지 않는 내 투자 비서</span>
        </div>

        {/* Return */}
        <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 40 }}>
          <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>총 수익률</span>
          <span style={{
            fontSize: 72, fontWeight: 800, lineHeight: 1,
            color: isGain ? '#EF4452' : '#3182F6',
          }}>
            {isGain ? '+' : ''}{returnPct}%
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 40 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>승률</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{winRate}%</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>종목 수</span>
            <span style={{ fontSize: 28, fontWeight: 700 }}>{holdings}개</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
